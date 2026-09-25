import { describe, it, expect } from 'vitest';
import { auditParkingZones } from '../audit-parking-zones.js';
import { runChecks } from '../run-checks.js';
import { refMultilevel } from '@azimut/testkit';
import type { Footprint, SiteData, SiteZone } from '@azimut/core-model';

/**
 * S8, règle S-35 — `DATA.PARKING_SPACE_WITHOUT_ZONE`.
 *
 * Le contrôle n'était pas calculable avant la version 17 : A5.2 ne donnait à
 * `zone` ni géométrie ni liste d'empreintes. Il figurait aux non construits de
 * `tests/catalogue-consolide` avec ce motif, et il en sort.
 */

function premierNiveau(): string {
  const [niveau] = refMultilevel.levels;
  if (niveau === undefined) throw new Error('aucun niveau de référence');
  return niveau.id;
}

const NIVEAU = premierNiveau();

/** Un rectangle de place, 2,5 m sur 5 : la forme ne joue aucun rôle ici. */
function place(id: string): Footprint {
  return {
    id,
    org_id: refMultilevel.organization.id,
    level_id: NIVEAU,
    kind: 'parking_space',
    geometry: {
      vertices: [
        { x_m: 0, y_m: 0 }, { x_m: 2.5, y_m: 0 },
        { x_m: 2.5, y_m: 5 }, { x_m: 0, y_m: 5 },
      ],
    },
  };
}

function zone(id: string, kind: SiteZone['kind'], footprintIds: readonly string[]): SiteZone {
  return {
    id,
    org_id: refMultilevel.organization.id,
    level_id: NIVEAU,
    name: id,
    kind,
    footprint_ids: footprintIds,
  };
}

/**
 * Le site de référence sans son stationnement.
 *
 * `refMultilevel` porte désormais un parking conforme — une zone et quatre
 * places. Chaque cas ci-dessous pose le sien, et repart donc d'un site qui n'en
 * porte aucun : sans cela, les places de référence s'ajouteraient à chaque
 * compte et aucune attente ne se lirait plus.
 */
const SANS_STATIONNEMENT: SiteData = {
  ...refMultilevel,
  footprints: refMultilevel.footprints.filter(f => f.kind !== 'parking_space'),
  zones: [],
};

function site(
  places: readonly Footprint[],
  zones: readonly SiteZone[] | undefined,
): SiteData {
  return {
    ...SANS_STATIONNEMENT,
    footprints: [...SANS_STATIONNEMENT.footprints, ...places],
    ...(zones === undefined ? {} : { zones }),
  };
}

describe('DATA.PARKING_SPACE_WITHOUT_ZONE — S8, règle S-35', () => {
  it('ne signale rien sur un site sans aucune place', () => {
    // Le contrôle naît sans rien à dire ; sans cette vérification, une panne
    // aurait l'air d'une vertu.
    const report = auditParkingZones(SANS_STATIONNEMENT);
    expect(report.space_count).toBe(0);
    expect(report.findings).toEqual([]);
  });

  it('ne signale rien non plus sur le site de référence, qui en porte', () => {
    // `refMultilevel` déclare quatre places et la zone qui les revendique :
    // un site de référence reste un site valide.
    const report = auditParkingZones(refMultilevel);
    expect(report.space_count).toBe(4);
    expect(report.findings).toEqual([]);
  });

  it('admet une place revendiquée par une zone de nature `parking`', () => {
    const report = auditParkingZones(
      site([place('fp-p1')], [zone('z-ouest', 'parking', ['fp-p1'])]),
    );
    expect(report.space_count).toBe(1);
    expect(report.parking_zone_count).toBe(1);
    expect(report.findings).toEqual([]);
  });

  it('signale une place qu’aucune zone ne revendique', () => {
    const report = auditParkingZones(
      site([place('fp-p1')], [zone('z-ouest', 'parking', [])]),
    );
    const [finding] = report.findings;
    expect(report.findings).toHaveLength(1);
    expect(finding?.code).toBe('DATA.PARKING_SPACE_WITHOUT_ZONE');
    expect(finding?.severity).toBe('warning');
    expect(finding?.entity).toEqual({ kind: 'footprint', id: 'fp-p1' });
    expect(finding?.params['level_id']).toBe(NIVEAU);
    expect(finding?.ruleRef).toBe('S-35');
  });

  it('signale toutes les places quand le site ne déclare aucune zone', () => {
    // Le cas où tout manque, et celui où il faut le plus parler. Un contrôle
    // qui se tairait faute de zone ne dirait rien précisément là où rien n'est
    // déclaré.
    for (const zones of [undefined, [] as readonly SiteZone[]]) {
      const report = auditParkingZones(site([place('fp-p1'), place('fp-p2')], zones));
      expect(report.findings.map(f => f.entity?.id)).toEqual(['fp-p1', 'fp-p2']);
      expect(report.parking_zone_count).toBe(0);
    }
  });

  it('ne compte pas une zone d’une autre nature, même si elle revendique la place', () => {
    // Le cas décisif de la règle. S-35 dit « une zone de nature `parking` », et
    // une zone technique qui revendiquerait une place ne la rattache à aucun
    // parking : aucune capacité annoncée ne la couvrirait, et l'écart de S-36
    // resterait invisible.
    const report = auditParkingZones(
      site([place('fp-p1')], [zone('z-tech', 'technical', ['fp-p1'])]),
    );
    expect(report.parking_zone_count).toBe(0);
    expect(report.findings.map(f => f.code)).toEqual(['DATA.PARKING_SPACE_WITHOUT_ZONE']);
  });

  it('accepte qu’une place soit revendiquée par deux parkings', () => {
    // Deux zones qui se recouvrent sont un cas qu'A5.2 admet, puisqu'elle rend
    // l'appartenance déclarée plutôt que calculée. Le contrôle ne juge pas le
    // recouvrement, il juge l'absence.
    const report = auditParkingZones(site([place('fp-p1')], [
      zone('z-a', 'parking', ['fp-p1']),
      zone('z-b', 'parking', ['fp-p1']),
    ]));
    expect(report.findings).toEqual([]);
  });

  it('ne juge que les empreintes de nature `parking_space`', () => {
    // Une cellule hors de toute zone n'est pas une anomalie : la règle porte
    // sur les places, et S-40 dit qu’une place n’est ni une destination ni une
    // cellule.
    const report = auditParkingZones(site([], [zone('z-ouest', 'parking', [])]));
    expect(refMultilevel.footprints.length).toBeGreaterThan(0);
    expect(report.space_count).toBe(0);
    expect(report.findings).toEqual([]);
  });

  it('rend ses anomalies dans l’ordre des identifiants, quel que soit celui des lignes', () => {
    // A9 : deux lectures d'un même état rendent le même rapport.
    const dans_un_sens = [place('fp-b'), place('fp-a'), place('fp-c')];
    const dans_l_autre = [...dans_un_sens].reverse();
    for (const places of [dans_un_sens, dans_l_autre]) {
      expect(auditParkingZones(site(places, [])).findings.map(f => f.entity?.id))
        .toEqual(['fp-a', 'fp-b', 'fp-c']);
    }
  });

  it('remonte jusqu’à runChecks, aux deux modes, et se nomme', () => {
    for (const mode of ['atelier', 'livrable'] as const) {
      const r = runChecks(site([place('fp-p1')], [zone('z-ouest', 'parking', [])]), {}, { mode });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.checks_run).toContain('parking_space_zone');
      expect(r.value.findings.map(f => f.code)).toContain('DATA.PARKING_SPACE_WITHOUT_ZONE');
    }
  });

  it('ne se nomme pas exercé sur un site sans aucune place', () => {
    const r = runChecks(SANS_STATIONNEMENT, {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.checks_run).not.toContain('parking_space_zone');
  });

  it('se nomme exercé dès qu’une place est tracée', () => {
    const r = runChecks(refMultilevel, {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.checks_run).toContain('parking_space_zone');
  });
});
