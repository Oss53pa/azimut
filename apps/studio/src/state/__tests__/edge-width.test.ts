import { describe, it, expect } from 'vitest';
import { inheritedEdgeWidthM, FALLBACK_EDGE_WIDTH_M } from '../edge-width.js';
import type { SessionState, StoredRow } from '../session-store.js';

/**
 * M4 (partie M), propriétés d'une arête : « Largeur utile — défaut : hérité du
 * bâtiment, `building.default_edge_width_m`. »
 *
 * L'écran posait une valeur unique, écrite dans son code, pour toutes les
 * arêtes de tous les sites. Un site dont un bâtiment a des circulations
 * larges et un autre des couloirs étroits recevait la même largeur partout, et
 * l'opérateur la reprenait arête par arête.
 */

function state(rows: readonly StoredRow[]): SessionState {
  return { rows, queued: [], online: true };
}

function building(id: string, values: Record<string, unknown> = {}): StoredRow {
  return {
    table: 'building', id,
    values: { id, org_id: 'org-1', site_id: 'site-1', name: id, ...values },
  };
}

function level(id: string, buildingId: string): StoredRow {
  return {
    table: 'level', id,
    values: {
      id, org_id: 'org-1', building_id: buildingId,
      name: id, ordinal: 0, elevation_m: 0,
    },
  };
}

describe('inheritedEdgeWidthM (M4, partie M — largeur héritée du bâtiment)', () => {
  it('rend la largeur déclarée par le bâtiment du niveau', () => {
    const session = state([
      building('b-1', { default_edge_width_m: 2.4 }),
      level('rdc', 'b-1'),
    ]);
    expect(inheritedEdgeWidthM(session, 'rdc')).toBe(2.4);
  });

  /**
   * Le fait que l'héritage rend visible : deux bâtiments d'un même site, deux
   * largeurs. C'est le cas que la valeur écrite dans l'écran effaçait.
   */
  it('donne à chaque bâtiment la sienne', () => {
    const session = state([
      building('b-1', { default_edge_width_m: 2.4 }),
      building('b-2', { default_edge_width_m: 1.1 }),
      level('galerie', 'b-1'),
      level('annexe', 'b-2'),
    ]);
    expect(inheritedEdgeWidthM(session, 'galerie')).toBe(2.4);
    expect(inheritedEdgeWidthM(session, 'annexe')).toBe(1.1);
  });

  /** La colonne est nullable : un bâtiment relevé sans ses largeurs existe. */
  it('rend la valeur d’ouverture quand le bâtiment n’en déclare aucune', () => {
    const session = state([building('b-1'), level('rdc', 'b-1')]);
    expect(inheritedEdgeWidthM(session, 'rdc')).toBe(FALLBACK_EDGE_WIDTH_M);
  });

  it('lit une largeur donnée en texte, comme la base la rend', () => {
    const session = state([
      building('b-1', { default_edge_width_m: '1.8' }),
      level('rdc', 'b-1'),
    ]);
    expect(inheritedEdgeWidthM(session, 'rdc')).toBe(1.8);
  });

  /**
   * La contrainte de la colonne est `IS NULL OR > 0`. Une largeur nulle ou
   * négative ne vient donc pas de la base. La retenir ferait refuser toute
   * arête pour largeur non positive, sans que l'écran dise pourquoi.
   */
  it('écarte une largeur non positive ou illisible', () => {
    for (const declared of [0, -1.2, 'large', null]) {
      const session = state([
        building('b-1', { default_edge_width_m: declared }),
        level('rdc', 'b-1'),
      ]);
      expect(inheritedEdgeWidthM(session, 'rdc'), String(declared))
        .toBe(FALLBACK_EDGE_WIDTH_M);
    }
  });

  it('rend la valeur d’ouverture sur un niveau ou un bâtiment absent', () => {
    expect(inheritedEdgeWidthM(state([]), 'rdc')).toBe(FALLBACK_EDGE_WIDTH_M);
    expect(inheritedEdgeWidthM(state([level('rdc', 'b-absent')]), 'rdc'))
      .toBe(FALLBACK_EDGE_WIDTH_M);
    const orphan: StoredRow = {
      table: 'level', id: 'rdc',
      values: { id: 'rdc', org_id: 'org-1', name: 'RDC', ordinal: 0, elevation_m: 0 },
    };
    expect(inheritedEdgeWidthM(state([orphan]), 'rdc')).toBe(FALLBACK_EDGE_WIDTH_M);
  });
});
