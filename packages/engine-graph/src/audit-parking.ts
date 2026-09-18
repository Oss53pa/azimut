import type {
  Finding, Parking, ParkingSpace, Provenance, UncoveredArea,
} from '@azimut/core-model';
import { PUBLISHABLE_STATUSES, countsAsDigitised } from '@azimut/core-model';

/**
 * Contrôle du stationnement — complément atelier, M2.
 *
 * M2 pose une règle qui n'a l'air de rien : « Les places se reprennent du plan
 * source, trait pour trait. Là où le plan source s'arrête, la zone est marquée
 * non couverte ; Azimut ne complète pas par extrapolation. »
 *
 * Ce module la rend opposable. Un parking annoncé à 89 places dont 40 sont
 * numérisées est dans un de deux états : ou bien le plan s'arrête quelque part
 * et on l'a dit, ou bien il manque 49 places que personne n'a vues. Les deux se
 * ressemblent à l'écran et ne se ressemblent pas du tout sur le terrain. Sans
 * ce contrôle, le second passe pour le premier, et un plan d'accueil annonce
 * une capacité que le parking n'a pas.
 *
 * D'où l'asymétrie assumée : numériser moins qu'annoncé est recevable **à
 * condition de l'avoir déclaré**, numériser plus ne l'est jamais. Un dépassement
 * ne s'explique par aucune zone non couverte ; il dit que la capacité annoncée
 * est fausse, ou qu'une place a été comptée deux fois.
 */
export type ParkingReport = {
  readonly parking_count: number;
  readonly space_count: number;
  readonly findings: readonly Finding[];
};

export type ParkingInput = {
  readonly parkings: readonly Parking[];
  readonly spaces: readonly ParkingSpace[];
  readonly uncovered: readonly UncoveredArea[];
};

function sourceFinding(kind: string, id: string, provenance: Provenance): Finding | null {
  if (provenance.source.trim() !== '') return null;
  return {
    code: 'PARK.SOURCE_MISSING',
    severity: 'blocking',
    entity: { kind, id },
    params: { status: provenance.status },
    ruleRef: 'atelier-M2',
  };
}

/**
 * Audite le stationnement d'un site.
 *
 * `forDeliverable` durcit le contrôle : hors livrable, une proposition est un
 * état de travail légitime ; portée à un livrable, elle s'afficherait comme un
 * fait, ce que P1 refuse. Le même jeu d'objets est donc acceptable à l'atelier
 * et refusé à l'impression, et c'est voulu.
 */
export function auditParking(
  input: ParkingInput,
  forDeliverable = false,
): ParkingReport {
  const findings: Finding[] = [];

  const parkings = [...input.parkings].sort((l, r) => l.id.localeCompare(r.id));
  const spaces = [...input.spaces].sort((l, r) => l.id.localeCompare(r.id));

  // Une place retirée ne compte pas : la compter ferait passer un parking
  // amputé pour complet, et pire, un parking où deux places ont été retirées
  // pour un parking en dépassement. C'est exactement l'écart que M2 demande de
  // voir, inversé par une ligne d'historique.
  const spacesByParking = new Map<string, number>();
  for (const space of spaces) {
    if (!countsAsDigitised(space.provenance.status)) continue;
    spacesByParking.set(space.parking_id, (spacesByParking.get(space.parking_id) ?? 0) + 1);
  }
  const uncoveredParkings = new Set(input.uncovered.map((area) => area.parking_id));

  for (const parking of parkings) {
    const found = sourceFinding('parking', parking.id, parking.provenance);
    if (found !== null) findings.push(found);

    const digitised = spacesByParking.get(parking.id) ?? 0;

    if (digitised > parking.declared_capacity) {
      findings.push({
        code: 'PARK.CAPACITY_EXCEEDED',
        severity: 'blocking',
        entity: { kind: 'parking', id: parking.id },
        params: { digitised, declared: parking.declared_capacity },
        ruleRef: 'atelier-M2',
      });
    } else if (digitised < parking.declared_capacity && !uncoveredParkings.has(parking.id)) {
      findings.push({
        code: 'PARK.CAPACITY_UNEXPLAINED',
        severity: 'blocking',
        entity: { kind: 'parking', id: parking.id },
        params: {
          digitised,
          declared: parking.declared_capacity,
          missing: parking.declared_capacity - digitised,
        },
        ruleRef: 'atelier-M2',
      });
    }
  }

  for (const space of spaces) {
    const found = sourceFinding('parking_space', space.id, space.provenance);
    if (found !== null) findings.push(found);
  }

  if (forDeliverable) {
    const carried: readonly { kind: string; id: string; provenance: Provenance }[] = [
      ...parkings.map((p) => ({ kind: 'parking', id: p.id, provenance: p.provenance })),
      ...spaces.map((s) => ({ kind: 'parking_space', id: s.id, provenance: s.provenance })),
    ];
    for (const object of carried) {
      if (PUBLISHABLE_STATUSES.includes(object.provenance.status)) continue;
      findings.push({
        code: 'PARK.PROPOSAL_AS_EXISTING',
        severity: 'blocking',
        entity: { kind: object.kind, id: object.id },
        params: { status: object.provenance.status },
        ruleRef: 'atelier-P1',
      });
    }
  }

  return {
    parking_count: parkings.length,
    space_count: spaces.length,
    findings,
  };
}
