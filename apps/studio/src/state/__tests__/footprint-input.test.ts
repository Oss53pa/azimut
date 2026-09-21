import { describe, it, expect } from 'vitest';
import { acceptFootprint, FOOTPRINT_KINDS, UNIT_CODE_MAX } from '../footprint-input.js';
import type { FootprintDraft, FootprintContext } from '../footprint-input.js';
import type { Point } from '@azimut/core-model';

const SQUARE: readonly Point[] = [
  { x_m: 0, y_m: 0 }, { x_m: 5, y_m: 0 }, { x_m: 5, y_m: 4 }, { x_m: 0, y_m: 4 },
];

const EMPTY: FootprintContext = { codesOnLevel: [], existing: [] };

function draft(over: Partial<FootprintDraft> = {}): FootprintDraft {
  return { vertices: SQUARE, unitCode: 'B12', kind: 'cell', categoryId: null, ...over };
}

function codes(over: Partial<FootprintDraft> = {}, context = EMPTY): string[] {
  const r = acceptFootprint(draft(over), context);
  return r.ok ? [] : r.findings.map(f => f.code);
}

/**
 * M3 (partie M) — « Contrôles à la saisie ». « Un refus n'efface jamais le
 * travail en cours. Il empêche la validation et dit pourquoi. »
 */
describe('M3 (partie M) — contrôles du contour', () => {
  it('accepte un rectangle', () => {
    expect(acceptFootprint(draft(), EMPTY).ok).toBe(true);
  });

  it('refuse moins de trois sommets', () => {
    expect(codes({ vertices: [{ x_m: 0, y_m: 0 }, { x_m: 1, y_m: 0 }] }))
      .toContain('GEOM.POLYGON_TOO_FEW_VERTICES');
  });

  /** M3 (partie M), critère 1 — « Un polygone auto-intersectant est refusé avec son code. » */
  it('refuse un contour auto-sécant', () => {
    const bowtie: readonly Point[] = [
      { x_m: 0, y_m: 0 }, { x_m: 4, y_m: 4 }, { x_m: 4, y_m: 0 }, { x_m: 0, y_m: 4 },
    ];
    expect(codes({ vertices: bowtie })).toContain('GEOM.POLYGON_SELF_INTERSECTING');
  });

  it('refuse une surface sous la tolérance', () => {
    const sliver: readonly Point[] = [
      { x_m: 0, y_m: 0 }, { x_m: 0.001, y_m: 0 }, { x_m: 0.001, y_m: 0.001 },
    ];
    expect(codes({ vertices: sliver })).toContain('GEOM.POLYGON_DEGENERATE');
  });

  it('les quatre natures sont celles de M3 (partie M)', () => {
    expect([...FOOTPRINT_KINDS]).toEqual(['cell', 'circulation', 'technical', 'vertical_core']);
  });
});

/**
 * M3 (partie M), critère 2 — « Les coordonnées stockées sont en mètres, quantifiées au
 * millimètre. » E4 : la quantification se fait à la validation du geste.
 */
describe('M3 (partie M) — quantification au millimètre', () => {
  it('quantifie les sommets à la fermeture', () => {
    const r = acceptFootprint(draft({
      vertices: [
        { x_m: 0.00049, y_m: 0 }, { x_m: 5.0004, y_m: 0 },
        { x_m: 5.0004, y_m: 4.0016 }, { x_m: 0, y_m: 4.0016 },
      ],
    }), EMPTY);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.vertices[0]?.x_m).toBe(0);
      expect(r.value.vertices[1]?.x_m).toBe(5);
      expect(r.value.vertices[2]?.y_m).toBe(4.002);
    }
  });

  /**
   * M3 (partie M), critère 3 — « Une empreinte tracée à la souris et la même saisie au
   * clavier produisent des données identiques. » Le pointeur rend des réels,
   * le clavier des valeurs rondes : quantifier les deux les rend égales.
   */
  it('souris et clavier produisent les mêmes données', () => {
    const pointeur = acceptFootprint(draft({
      vertices: [
        { x_m: 0.0001, y_m: -0.0002 }, { x_m: 4.99988, y_m: 0.00013 },
        { x_m: 5.00021, y_m: 3.99977 }, { x_m: -0.00009, y_m: 4.00018 },
      ],
    }), EMPTY);
    const clavier = acceptFootprint(draft({ vertices: SQUARE }), EMPTY);
    expect(pointeur.ok && clavier.ok).toBe(true);
    if (pointeur.ok && clavier.ok) {
      expect(pointeur.value.vertices).toEqual(clavier.value.vertices);
    }
  });

  /**
   * Les contrôles portent sur les valeurs quantifiées, celles qui seront
   * écrites. Juger l'une et écrire l'autre laisserait passer un contour
   * dégénéré d'un micron.
   */
  it('juge la surface après quantification, pas avant', () => {
    const microscopique: readonly Point[] = [
      { x_m: 0, y_m: 0 }, { x_m: 0.0004, y_m: 0 }, { x_m: 0.0004, y_m: 0.0004 },
    ];
    expect(codes({ vertices: microscopique })).toContain('GEOM.POLYGON_DEGENERATE');
  });
});

/** M3 (partie M) : « Code de cellule | requis, unique par niveau, 1 à 20 caractères ». */
describe('M3 (partie M) — code de cellule', () => {
  it('refuse un code vide', () => {
    expect(codes({ unitCode: '  ' })).toContain('DATA.UNIT_CODE_REQUIRED');
  });

  it(`refuse au-delà de ${UNIT_CODE_MAX} caractères`, () => {
    expect(codes({ unitCode: 'x'.repeat(UNIT_CODE_MAX + 1) })).toContain('DATA.UNIT_CODE_REQUIRED');
  });

  it('refuse un code déjà porté au niveau', () => {
    expect(codes({ unitCode: 'B12' }, { ...EMPTY, codesOnLevel: ['B12'] }))
      .toContain('DATA.CODE_DUPLICATE');
  });

  /** « B12 » et « b12 » sont le même local pour quiconque lit un plan. */
  it('juge l’unicité sans tenir compte de la casse', () => {
    expect(codes({ unitCode: 'b12' }, { ...EMPTY, codesOnLevel: ['B12'] }))
      .toContain('DATA.CODE_DUPLICATE');
  });
});

/**
 * M3 (partie M) : « Empreintes superposées | avertissement, tracé accepté. » Un
 * recouvrement est parfois voulu — une mezzanine, un volume traversant — donc
 * il se signale sans refuser.
 */
describe('M3 (partie M) — recouvrement', () => {
  const voisin: readonly Point[] = [
    { x_m: 3, y_m: 2 }, { x_m: 8, y_m: 2 }, { x_m: 8, y_m: 6 }, { x_m: 3, y_m: 6 },
  ];

  it('accepte le tracé et prévient', () => {
    const r = acceptFootprint(draft(), { ...EMPTY, existing: [voisin] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings.map(f => f.code)).toEqual(['GEOM.FOOTPRINTS_OVERLAP']);
  });

  it('ne prévient pas pour deux empreintes disjointes', () => {
    const loin: readonly Point[] = [
      { x_m: 50, y_m: 50 }, { x_m: 55, y_m: 50 }, { x_m: 55, y_m: 54 }, { x_m: 50, y_m: 54 },
    ];
    const r = acceptFootprint(draft(), { ...EMPTY, existing: [loin] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings).toEqual([]);
  });

  /** Le contour entièrement inclus n'a aucune arête qui croise l'autre. */
  it('voit une empreinte entièrement contenue dans une autre', () => {
    const dedans: readonly Point[] = [
      { x_m: 1, y_m: 1 }, { x_m: 2, y_m: 1 }, { x_m: 2, y_m: 2 }, { x_m: 1, y_m: 2 },
    ];
    const r = acceptFootprint(draft({ vertices: dedans }), { ...EMPTY, existing: [SQUARE] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings.map(f => f.code)).toEqual(['GEOM.FOOTPRINTS_OVERLAP']);
  });
});

/** M3 (partie M) : « Surface | calculé | lecture seule, m2, 1 décimale ». */
describe('M3 (partie M) — surface calculée', () => {
  it('rend la surface à une décimale', () => {
    const r = acceptFootprint(draft(), EMPTY);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.areaM2).toBe(20);
  });

  it('arrondit à la décimale, sans la dépasser', () => {
    const r = acceptFootprint(draft({
      vertices: [
        { x_m: 0, y_m: 0 }, { x_m: 3.333, y_m: 0 },
        { x_m: 3.333, y_m: 3.333 }, { x_m: 0, y_m: 3.333 },
      ],
    }), EMPTY);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.areaM2).toBe(11.1);
  });
});
