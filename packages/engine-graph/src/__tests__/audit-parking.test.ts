import { describe, it, expect } from 'vitest';
import type { Parking, ParkingSpace, Provenance, UncoveredArea } from '@azimut/core-model';
import { auditParking } from '../audit-parking.js';

const EXISTANT: Provenance = { status: 'existant', source: 'Plan RDJ indice 20' };

const CARRE: Parking['geometry'] = {
  vertices: [
    { x_m: 0, y_m: 0 }, { x_m: 20, y_m: 0 }, { x_m: 20, y_m: 20 }, { x_m: 0, y_m: 20 },
  ],
};

function parking(id: string, capacity: number, provenance: Provenance = EXISTANT): Parking {
  return {
    id,
    org_id: 'org-test-001',
    level_id: 'lvl-1',
    geometry: CARRE,
    name: `Parking ${id}`,
    free: true,
    declared_capacity: capacity,
    provenance,
  };
}

function spaces(parkingId: string, count: number, provenance: Provenance = EXISTANT): ParkingSpace[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${parkingId}-p${String(i).padStart(3, '0')}`,
    org_id: 'org-test-001',
    parking_id: parkingId,
    kind: 'standard' as const,
    row: 'A',
    provenance,
  }));
}

const NONE: UncoveredArea[] = [];

describe('auditParking (M2)', () => {
  it('ne signale rien quand les places numérisées couvrent la capacité', () => {
    const report = auditParking({
      parkings: [parking('ouest', 40)],
      spaces: spaces('ouest', 40),
      uncovered: NONE,
    });
    expect(report.findings).toEqual([]);
    expect(report.space_count).toBe(40);
  });

  it('refuse un parking numérisé à moitié sans zone non couverte déclarée', () => {
    // Le cas que M2 (complément atelier) vise : 89 annoncées, 40 vues, et rien qui dise où le plan
    // s'arrête. Un plan d'accueil annoncerait sinon une capacité inexistante.
    const report = auditParking({
      parkings: [parking('souterrain', 89)],
      spaces: spaces('souterrain', 40),
      uncovered: NONE,
    });
    const [finding] = report.findings;
    expect(finding?.code).toBe('PARK.CAPACITY_UNEXPLAINED');
    expect(finding?.severity).toBe('blocking');
    expect(finding?.params['missing']).toBe(49);
  });

  it('accepte le même écart dès que la zone non couverte est déclarée', () => {
    const report = auditParking({
      parkings: [parking('souterrain', 89)],
      spaces: spaces('souterrain', 40),
      uncovered: [{ id: 'z-1', org_id: 'org-test-001', parking_id: 'souterrain', reason: 'Plan coupé au bord de page' }],
    });
    expect(report.findings).toEqual([]);
  });

  it('refuse un dépassement, que nulle zone non couverte n’explique', () => {
    // Asymétrie voulue : numériser moins s'explique, numériser plus jamais.
    const report = auditParking({
      parkings: [parking('surface', 30)],
      spaces: spaces('surface', 31),
      uncovered: [{ id: 'z-1', org_id: 'org-test-001', parking_id: 'surface', reason: 'peu importe' }],
    });
    expect(report.findings[0]?.code).toBe('PARK.CAPACITY_EXCEEDED');
    expect(report.findings[0]?.params['digitised']).toBe(31);
  });

  it('refuse un objet sans source, quel que soit son statut', () => {
    const report = auditParking({
      parkings: [parking('ouest', 1, { status: 'existant', source: '   ' })],
      spaces: spaces('ouest', 1),
      uncovered: NONE,
    });
    expect(report.findings.map(f => f.code)).toContain('PARK.SOURCE_MISSING');
  });

  it('tolère une proposition à l’atelier', () => {
    const proposition: Provenance = { status: 'proposition', source: 'Détection assistée' };
    const report = auditParking({
      parkings: [parking('ouest', 2, proposition)],
      spaces: spaces('ouest', 2, proposition),
      uncovered: NONE,
    });
    expect(report.findings).toEqual([]);
  });

  it('refuse la même proposition portée à un livrable (P1, complément atelier)', () => {
    const proposition: Provenance = { status: 'proposition', source: 'Détection assistée' };
    const report = auditParking({
      parkings: [parking('ouest', 2, proposition)],
      spaces: spaces('ouest', 2, proposition),
      uncovered: NONE,
    }, true);
    const codes = report.findings.map(f => f.code);
    expect(codes.filter(c => c === 'PARK.PROPOSAL_AS_EXISTING')).toHaveLength(3);
    expect(report.findings[0]?.ruleRef).toBe('atelier-P1');
  });

  it('refuse aussi un objet à vérifier au livrable', () => {
    const aVerifier: Provenance = { status: 'a_verifier', source: 'Relevé partiel' };
    const report = auditParking({
      parkings: [parking('ouest', 0, aVerifier)],
      spaces: [],
      uncovered: NONE,
    }, true);
    expect(report.findings.map(f => f.code)).toContain('PARK.PROPOSAL_AS_EXISTING');
  });

  it('est déterministe, quel que soit l’ordre reçu', () => {
    const input = {
      parkings: [parking('b', 1), parking('a', 3)],
      spaces: [...spaces('a', 1), ...spaces('b', 1)],
      uncovered: NONE,
    };
    const shuffled = {
      parkings: [...input.parkings].reverse(),
      spaces: [...input.spaces].reverse(),
      uncovered: NONE,
    };
    expect(JSON.stringify(auditParking(input))).toBe(JSON.stringify(auditParking(shuffled)));
  });

  it('compte un parking sans aucune place comme entièrement non numérisé', () => {
    const report = auditParking({
      parkings: [parking('vide', 12)],
      spaces: [],
      uncovered: NONE,
    });
    expect(report.findings[0]?.params['missing']).toBe(12);
  });
});

describe('une place retirée ne compte plus', () => {
  const RETIRE: Provenance = { status: 'retire', source: 'Plan RDC indice 19' };

  it('ne fait pas passer un parking complet pour un parking en dépassement', () => {
    // 40 annoncées, 40 existantes, 2 retirées. Compter les retirées ferait
    // 42 et lèverait un dépassement qui n'existe pas.
    const report = auditParking({
      parkings: [parking('ouest', 40)],
      spaces: [...spaces('ouest', 40), ...spaces('ouest-r', 2, RETIRE).map(s => ({
        ...s, parking_id: 'ouest',
      }))],
      uncovered: NONE,
    });
    expect(report.findings).toEqual([]);
  });

  it('voit le trou que deux places retirées laissent', () => {
    // 40 annoncées, 38 existantes, 2 retirées : il manque bien deux places,
    // et c'est exactement l'écart que M2 (complément atelier) demande de voir.
    const report = auditParking({
      parkings: [parking('ouest', 40)],
      spaces: [...spaces('ouest', 38), ...spaces('ouest-r', 2, RETIRE).map(s => ({
        ...s, parking_id: 'ouest',
      }))],
      uncovered: NONE,
    });
    expect(report.findings[0]?.code).toBe('PARK.CAPACITY_UNEXPLAINED');
    expect(report.findings[0]?.params['missing']).toBe(2);
  });

  it('compte une proposition : elle est sur le plan, quelqu’un l’a tracée', () => {
    const proposition: Provenance = { status: 'proposition', source: 'Détection' };
    const report = auditParking({
      parkings: [parking('ouest', 2)],
      spaces: [...spaces('ouest', 1), ...spaces('ouest-p', 1, proposition).map(s => ({
        ...s, parking_id: 'ouest',
      }))],
      uncovered: NONE,
    });
    expect(report.findings).toEqual([]);
  });
});
