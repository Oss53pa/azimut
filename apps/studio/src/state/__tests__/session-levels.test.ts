import { describe, it, expect } from 'vitest';
import { levelsOfSession } from '../session-scope.js';
import type { SessionState, StoredRow } from '../session-store.js';

/**
 * T-1.5 — la session multi-niveaux.
 *
 * L'atelier ne connaissait qu'un niveau, celui du chemin, alors que le
 * magasin en porte autant que le site en compte : la session charge le site
 * entier. Sans ce lecteur, l'outil de liaison verticale n'avait pas de
 * seconde extrémité à désigner, et c'est pour cela qu'il n'était pas
 * constructible.
 */

function state(rows: readonly StoredRow[]): SessionState {
  return { rows, queued: [], online: true };
}

function level(id: string, buildingId: string, ordinal: number, over: Record<string, unknown> = {}): StoredRow {
  return {
    table: 'level',
    id,
    values: {
      id,
      org_id: 'org-1',
      building_id: buildingId,
      name: id,
      ordinal,
      elevation_m: ordinal * 3.2,
      ...over,
    },
  };
}

describe('levelsOfSession (T-1.5)', () => {
  it('rend les niveaux que le magasin porte', () => {
    const { levels } = levelsOfSession(state([
      level('rdc', 'b-1', 0),
      level('r1', 'b-1', 1),
    ]));
    expect(levels.map(l => l.id)).toEqual(['rdc', 'r1']);
    expect(levels[1]?.elevation_m).toBe(3.2);
  });

  /** A9 : deux lectures d'un même magasin rendent la même liste. */
  it('ordonne par bâtiment, puis par rang', () => {
    const rows = [
      level('b2-r1', 'b-2', 1),
      level('b1-r2', 'b-1', 2),
      level('b1-ss1', 'b-1', -1),
      level('b2-rdc', 'b-2', 0),
    ];
    const first = levelsOfSession(state(rows)).levels.map(l => l.id);
    const again = levelsOfSession(state([...rows].reverse())).levels.map(l => l.id);
    expect(first).toEqual(['b1-ss1', 'b1-r2', 'b2-rdc', 'b2-r1']);
    expect(again).toEqual(first);
  });

  /**
   * Rien n'est complété. Un niveau sans rang n'est pas rangé au rang zéro :
   * il se compterait alors parmi les niveaux du bâtiment, à une place que
   * personne n'a saisie.
   */
  it('écarte et compte un niveau illisible au lieu de le compléter', () => {
    const broken: StoredRow = {
      table: 'level', id: 'sans-rang',
      values: { id: 'sans-rang', org_id: 'org-1', building_id: 'b-1', name: 'X' },
    };
    const { levels, unreadable } = levelsOfSession(state([level('rdc', 'b-1', 0), broken]));
    expect(levels.map(l => l.id)).toEqual(['rdc']);
    expect(unreadable).toEqual(['sans-rang']);
  });

  it('rend une liste vide sur un magasin sans niveau', () => {
    expect(levelsOfSession(state([])).levels).toEqual([]);
  });
});
