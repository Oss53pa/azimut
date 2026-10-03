import { describe, it, expect } from 'vitest';
import type { Footprint, SiteZone, SiteFact } from '@azimut/core-model';
import {
  PARKING_CAPACITY_KEY, PARKING_UNDIGITIZED_SPACES_KEY, PARKING_UNDIGITIZED_REASON_KEY,
} from '@azimut/core-model';
import { auditParking } from '../audit-parking.js';

/**
 * Section S8, règles S-35 à S-37 — le stationnement sur les objets du socle.
 *
 * Ces essais portaient sur trois tables d'un module de stationnement que la
 * section S8 a retirées. Ils portent désormais sur ce qui les remplace : une
 * zone de nature `parking` qui déclare ses empreintes, des empreintes de
 * nature `parking_space`, et les faits d'A5.11 qui disent la capacité annoncée
 * et les places qu'une surface non numérisée est censée porter.
 */

const CARRE = (n: number): Footprint['geometry'] => ({
  vertices: [
    { x_m: n, y_m: 0 }, { x_m: n + 2, y_m: 0 },
    { x_m: n + 2, y_m: 5 }, { x_m: n, y_m: 5 },
  ],
});

function zone(id: string, footprintIds: readonly string[]): SiteZone {
  return {
    id,
    org_id: 'org-test-001',
    level_id: 'lvl-1',
    name: `Parking ${id}`,
    kind: 'parking',
    footprint_ids: [...footprintIds],
  };
}

/** `count` empreintes de place, préfixées par l'identifiant du parking. */
function places(parkingId: string, count: number): Footprint[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${parkingId}-p${String(i).padStart(3, '0')}`,
    org_id: 'org-test-001',
    level_id: 'lvl-1',
    geometry: CARRE(i * 3),
    kind: 'parking_space' as const,
  }));
}

function fait(key: string, value: number | string, kind: string, id: string): SiteFact {
  return {
    key,
    value,
    status: 'existing',
    source_ref: 'Plan RDJ indice 20',
    declared_at: '2026-01-05',
    target: { kind, id },
    forbidden: [],
  };
}

const capacite = (id: string, n: number): SiteFact =>
  fait(PARKING_CAPACITY_KEY, n, 'zone', id);

const nonNumerisee = (footprintId: string, n: number): SiteFact =>
  fait(PARKING_UNDIGITIZED_SPACES_KEY, n, 'footprint', footprintId);

/** S-37 — le motif qui accompagne la marque ; sans lui, un avertissement. */
const motif = (footprintId: string): SiteFact =>
  fait(PARKING_UNDIGITIZED_REASON_KEY, 'Calque absent du plan fourni', 'footprint', footprintId);

describe('auditParking — capacité annoncée et places tracées (S-36)', () => {
  it('ne signale rien quand les places tracées couvrent la capacité', () => {
    const fps = places('ouest', 40);
    const report = auditParking({
      zones: [zone('ouest', fps.map(f => f.id))],
      footprints: fps,
      facts: [capacite('ouest', 40)],
    });
    expect(report.findings).toEqual([]);
    expect(report.counted_spaces).toBe(40);
    expect(report.digitized_count).toBe(40);
    expect(report.parking_count).toBe(1);
  });

  it('refuse un parking numérisé à moitié, sans surface non numérisée déclarée', () => {
    // Le cas visé : 89 places annoncées, 40 tracées, et rien qui dise où le
    // plan s'arrête. Un plan d'accueil annoncerait sinon une capacité
    // inexistante.
    const fps = places('souterrain', 40);
    const report = auditParking({
      zones: [zone('souterrain', fps.map(f => f.id))],
      footprints: fps,
      facts: [capacite('souterrain', 89)],
    });
    const [finding] = report.findings;
    expect(finding?.code).toBe('PARK.CAPACITY_UNEXPLAINED');
    expect(finding?.severity).toBe('blocking');
    expect(finding?.ruleRef).toBe('S-37');
    expect(finding?.entity).toEqual({ kind: 'zone', id: 'souterrain' });
    expect(finding?.params['missing']).toBe(49);
    expect(finding?.params['counted']).toBe(40);
    expect(finding?.params['digitized']).toBe(40);
  });

  it('ne contrôle rien quand aucune capacité n’est annoncée', () => {
    // S-36 fait du fait le terme de la comparaison. Un parking dont personne
    // n'a annoncé la capacité n'est pas en écart, il est sans annonce.
    const fps = places('ouest', 3);
    const report = auditParking({
      zones: [zone('ouest', fps.map(f => f.id))],
      footprints: fps,
      facts: [],
    });
    expect(report.findings).toEqual([]);
    expect(report.counted_spaces).toBe(3);
  });

  it('refuse un dépassement, que nulle surface non numérisée n’explique', () => {
    // Asymétrie voulue : numériser moins s'explique, numériser plus jamais.
    const fps = places('surface', 31);
    const report = auditParking({
      zones: [zone('surface', fps.map(f => f.id))],
      footprints: fps,
      facts: [capacite('surface', 30)],
    });
    expect(report.findings[0]?.code).toBe('PARK.CAPACITY_EXCEEDED');
    expect(report.findings[0]?.ruleRef).toBe('S-36');
    expect(report.findings[0]?.params['counted']).toBe(31);
  });

  it('compte un parking sans aucune place comme entièrement non numérisé', () => {
    const report = auditParking({
      zones: [zone('vide', [])],
      footprints: [],
      facts: [capacite('vide', 12)],
    });
    expect(report.findings[0]?.params['missing']).toBe(12);
  });

  it('ne compte pas une empreinte qu’aucune zone ne déclare', () => {
    // Le rattachement est déclaré, non calculé (A5.2). Une place hors zone est
    // l'affaire de `DATA.PARKING_SPACE_WITHOUT_ZONE`, pas de celle-ci.
    const fps = places('ouest', 3);
    const report = auditParking({
      zones: [zone('ouest', [fps[0]?.id ?? ''])],
      footprints: fps,
      facts: [capacite('ouest', 1)],
    });
    expect(report.findings).toEqual([]);
    expect(report.counted_spaces).toBe(1);
  });

  it('ignore une empreinte déclarée qui n’est pas une place', () => {
    const fps = places('ouest', 1);
    const sol: Footprint = {
      id: 'fp-sol', org_id: 'org-test-001', level_id: 'lvl-1',
      geometry: CARRE(50), kind: 'outdoor',
    };
    const report = auditParking({
      zones: [zone('ouest', ['fp-sol', ...fps.map(f => f.id)])],
      footprints: [sol, ...fps],
      facts: [capacite('ouest', 1)],
    });
    expect(report.findings).toEqual([]);
    expect(report.counted_spaces).toBe(1);
  });

  it('est déterministe, quel que soit l’ordre reçu', () => {
    const a = places('a', 3);
    const b = places('b', 1);
    const input = {
      zones: [zone('b', b.map(f => f.id)), zone('a', a.map(f => f.id))],
      footprints: [...a, ...b],
      facts: [capacite('a', 3), capacite('b', 1)],
    };
    const shuffled = {
      zones: [...input.zones].reverse(),
      footprints: [...input.footprints].reverse(),
      facts: [...input.facts].reverse(),
    };
    expect(JSON.stringify(auditParking(input)))
      .toBe(JSON.stringify(auditParking(shuffled)));
  });
});

describe('S-37 — la surface non numérisée explique l’écart, à concurrence', () => {
  it('admet l’écart quand la surface déclare exactement ce qui manque', () => {
    // 40 places tracées, une surface de plus déclarant 49 places : le compte
    // est de 89, et la capacité annoncée est couverte.
    const fps = places('souterrain', 40);
    const surface: Footprint = {
      id: 'fp-surface', org_id: 'org-test-001', level_id: 'lvl-1',
      geometry: CARRE(200), kind: 'parking_space',
    };
    const report = auditParking({
      zones: [zone('souterrain', ['fp-surface', ...fps.map(f => f.id)])],
      footprints: [surface, ...fps],
      facts: [capacite('souterrain', 89), nonNumerisee('fp-surface', 49), motif('fp-surface')],
    });
    expect(report.findings).toEqual([]);
  });

  it('n’admet l’écart qu’à concurrence des places déclarées', () => {
    // La marque déclare 20 places, il en manquait 49 : le reste demeure
    // inexpliqué, et c'est ce que « à concurrence » veut dire.
    const fps = places('souterrain', 40);
    const surface: Footprint = {
      id: 'fp-surface', org_id: 'org-test-001', level_id: 'lvl-1',
      geometry: CARRE(200), kind: 'parking_space',
    };
    const report = auditParking({
      zones: [zone('souterrain', ['fp-surface', ...fps.map(f => f.id)])],
      footprints: [surface, ...fps],
      facts: [capacite('souterrain', 89), nonNumerisee('fp-surface', 20)],
    });
    expect(report.findings[0]?.code).toBe('PARK.CAPACITY_UNEXPLAINED');
    expect(report.findings[0]?.params['missing']).toBe(29);
  });

  it('ne laisse pas une marque excessive passer pour une explication', () => {
    // Déclarer 60 places sur une surface d'un parking annoncé à 50 est un
    // dépassement, comme en tracer soixante.
    const surface: Footprint = {
      id: 'fp-surface', org_id: 'org-test-001', level_id: 'lvl-1',
      geometry: CARRE(0), kind: 'parking_space',
    };
    const report = auditParking({
      zones: [zone('ouest', ['fp-surface'])],
      footprints: [surface],
      facts: [capacite('ouest', 50), nonNumerisee('fp-surface', 60)],
    });
    expect(report.findings[0]?.code).toBe('PARK.CAPACITY_EXCEEDED');
    expect(report.findings[0]?.params['counted']).toBe(60);
    // Une seule surface dessinée, soixante places déclarées : les deux comptes
    // diffèrent, et l'anomalie les porte tous les deux.
    expect(report.findings[0]?.params['digitized']).toBe(1);
  });

  it('une marque ne vaut pas une place en plus de ce qu’elle déclare', () => {
    // L'empreinte marquée vaut son compte, et non son compte plus un : c'est
    // une surface, pas un emplacement.
    const surface: Footprint = {
      id: 'fp-surface', org_id: 'org-test-001', level_id: 'lvl-1',
      geometry: CARRE(0), kind: 'parking_space',
    };
    const report = auditParking({
      zones: [zone('ouest', ['fp-surface'])],
      footprints: [surface],
      facts: [capacite('ouest', 12), nonNumerisee('fp-surface', 12), motif('fp-surface')],
    });
    expect(report.findings).toEqual([]);
  });

  it('ne se laisse pas réduire la capacité expliquée par une marque négative', () => {
    const surface: Footprint = {
      id: 'fp-surface', org_id: 'org-test-001', level_id: 'lvl-1',
      geometry: CARRE(0), kind: 'parking_space',
    };
    const report = auditParking({
      zones: [zone('ouest', ['fp-surface'])],
      footprints: [surface],
      facts: [capacite('ouest', 1), nonNumerisee('fp-surface', -5)],
    });
    expect(report.findings[0]?.params['counted']).toBe(0);
  });

  it('ne lit pas la marque d’une autre empreinte', () => {
    const fps = places('ouest', 1);
    const report = auditParking({
      zones: [zone('ouest', fps.map(f => f.id))],
      footprints: fps,
      facts: [capacite('ouest', 50), nonNumerisee('fp-ailleurs', 49)],
    });
    expect(report.findings[0]?.code).toBe('PARK.CAPACITY_UNEXPLAINED');
    expect(report.findings[0]?.params['missing']).toBe(49);
  });
});

/**
 * S-38 — « Le comptage des places obéit à une règle unique : une empreinte de
 * place vaut une place, sauf si elle est marquée non numérisée, auquel cas
 * elle vaut le nombre déclaré par son fait et ne compte jamais en plus pour
 * elle-même. Sans cette règle, chaque surface non numérisée fausserait le
 * compte d'une unité. »
 *
 * La règle est venue après le retrait de la table `parking_uncovered_area`,
 * qui l'avait rendue nécessaire. Ces essais l'éprouvent pour elle-même, et non
 * à travers un écart de capacité : c'est le compte qui est en cause, pas sa
 * comparaison.
 */
describe('S-38 — la règle de comptage, éprouvée pour elle-même', () => {
  function compte(marques: readonly (number | null)[]): number {
    const fps = places('ouest', marques.length);
    return auditParking({
      zones: [zone('ouest', fps.map(f => f.id))],
      footprints: fps,
      facts: fps.flatMap((f, i) => {
        const marque = marques[i];
        return marque === null || marque === undefined
          ? [] : [nonNumerisee(f.id, marque)];
      }),
    }).counted_spaces;
  }

  it('compte une empreinte ordinaire pour une place', () => {
    expect(compte([null, null, null])).toBe(3);
  });

  it('compte une empreinte marquée pour ce qu’elle déclare, et rien de plus', () => {
    // C'est l'unité de l'écart que la règle nomme : 50, jamais 51.
    expect(compte([50])).toBe(50);
  });

  it('ne fausse pas le compte d’une unité par surface marquée', () => {
    // Trois surfaces marquées : sans la règle, le compte vaudrait 63 au lieu
    // de 60. C'est exactement l'erreur que S-38 prévient.
    expect(compte([20, 20, 20])).toBe(60);
  });

  it('mêle sans confusion les places tracées et les surfaces marquées', () => {
    expect(compte([null, null, 20, null])).toBe(23);
  });

  it('admet une marque à zéro, surface relevée qui ne porte aucune place', () => {
    // Distincte d'une empreinte sans marque, qui vaut une. C'est la seule
    // façon de dire « cette étendue a été regardée, elle est vide ».
    expect(compte([0])).toBe(0);
    expect(compte([null])).toBe(1);
  });

  it('sépare le compte des places du compte des empreintes', () => {
    const fps = places('ouest', 2);
    const report = auditParking({
      zones: [zone('ouest', fps.map(f => f.id))],
      footprints: fps,
      facts: [nonNumerisee(fps[0]?.id ?? '', 30)],
    });
    expect(report.digitized_count).toBe(2);
    expect(report.counted_spaces).toBe(31);
  });
});

describe('A5.11 — un fait non publiable au livrable', () => {
  const fps = places('ouest', 2);
  const proposition = (): SiteFact =>
    ({ ...capacite('ouest', 2), status: 'proposal' });

  it('tolère une proposition à l’atelier', () => {
    const report = auditParking({
      zones: [zone('ouest', fps.map(f => f.id))],
      footprints: fps,
      facts: [proposition()],
    });
    expect(report.findings).toEqual([]);
  });

  it('refuse la même proposition portée à un livrable (règle M01.S11)', () => {
    const report = auditParking({
      zones: [zone('ouest', fps.map(f => f.id))],
      footprints: fps,
      facts: [proposition()],
    }, true);
    const finding = report.findings.find(f => f.code === 'PARK.PROPOSAL_AS_EXISTING');
    expect(finding?.entity).toEqual({ kind: 'zone', id: 'ouest' });
    expect(finding?.params['key']).toBe(PARKING_CAPACITY_KEY);
    expect(finding?.ruleRef).toBe('M01.S11');
  });

  it('refuse aussi un fait à vérifier, et sur une empreinte de place', () => {
    const report = auditParking({
      zones: [zone('ouest', fps.map(f => f.id))],
      footprints: fps,
      facts: [
        capacite('ouest', 2),
        { ...nonNumerisee(fps[0]?.id ?? '', 0), status: 'to_verify' },
      ],
    }, true);
    const codes = report.findings.filter(f => f.code === 'PARK.PROPOSAL_AS_EXISTING');
    expect(codes).toHaveLength(1);
    expect(codes[0]?.entity?.kind).toBe('footprint');
  });

  it('ne juge pas un fait qui ne désigne aucun objet du stationnement', () => {
    const report = auditParking({
      zones: [zone('ouest', fps.map(f => f.id))],
      footprints: fps,
      facts: [
        capacite('ouest', 2),
        { ...capacite('zone-inconnue', 9), status: 'proposal' },
      ],
    }, true);
    expect(report.findings.map(f => f.code)).not.toContain('PARK.PROPOSAL_AS_EXISTING');
  });
});
