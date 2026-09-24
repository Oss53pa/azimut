import { describe, it, expect } from 'vitest';
import {
  acceptBuilding, acceptLevel, levelDraftComplete, nextOrdinal,
  buildingCommands, levelCommands, renameCommands, deleteLevelCommands,
  EMPTY_STRUCTURE, BUILDING_NAME_MAX,
} from '../site-structure.js';

/**
 * M1bis (partie M) — fiche de site, bâtiments et niveaux.
 *
 * Les quatre premiers critères d'acceptation de l'écran se jugent ici ; le
 * cinquième, le parcours au clavier, dans `tests/e2e/m1bis-fiche-site.spec.ts`.
 */

const WRITE = {
  orgId: 'org-1',
  siteId: 'site-1',
  timestamp: '2026-01-01T00:00:00.000Z',
};

describe('acceptBuilding', () => {
  it('rend un bâtiment nommé, sans accès indépendant par défaut', () => {
    const outcome = acceptBuilding(
      { name: '  Bâtiment A  ', independentAccess: false, defaultEdgeWidthM: null },
      EMPTY_STRUCTURE,
    );
    if (!outcome.ok) throw new Error(outcome.findings.map(f => f.code).join(', '));
    expect(outcome.value.name).toBe('Bâtiment A');
    expect(outcome.value.independentAccess).toBe(false);
    expect(outcome.value.defaultEdgeWidthM).toBeNull();
  });

  it('refuse un nom vide et un nom trop long', () => {
    for (const name of ['', '   ', 'x'.repeat(BUILDING_NAME_MAX + 1)]) {
      const outcome = acceptBuilding(
        { name, independentAccess: false, defaultEdgeWidthM: null }, EMPTY_STRUCTURE);
      expect(outcome.ok, JSON.stringify(name.slice(0, 12))).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.findings.map(f => f.code)).toContain('DATA.NAME_REQUIRED');
    }
  });

  /** M1bis : « unique par site ». L'unicité se juge sur le nom normalisé. */
  it('refuse un nom déjà porté, à la casse et aux espaces de bord près', () => {
    const outcome = acceptBuilding(
      { name: ' bâtiment a ', independentAccess: false, defaultEdgeWidthM: null },
      { ...EMPTY_STRUCTURE, buildingNames: ['Bâtiment A'] },
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings.map(f => f.code)).toContain('DATA.NAME_DUPLICATE');
  });

  it('quantifie la largeur d’arête par défaut au millimètre', () => {
    const outcome = acceptBuilding(
      { name: 'B', independentAccess: true, defaultEdgeWidthM: 1.40049 }, EMPTY_STRUCTURE);
    if (!outcome.ok) throw new Error('refusé');
    expect(outcome.value.defaultEdgeWidthM).toBe(1.4);
    expect(outcome.value.independentAccess).toBe(true);
  });
});

describe('acceptLevel', () => {
  const complete = { name: 'R+1', ordinal: 1, elevationM: 4.2 };

  it('rend un niveau nommé, rangé et coté', () => {
    const outcome = acceptLevel(complete, EMPTY_STRUCTURE);
    if (!outcome.ok) throw new Error(outcome.findings.map(f => f.code).join(', '));
    expect(outcome.value).toEqual({ name: 'R+1', ordinal: 1, elevationM: 4.2 });
  });

  /** Critère 2 de M1bis : deux niveaux de même rang sont refusés. */
  it('refuse un rang déjà porté dans le bâtiment', () => {
    const outcome = acceptLevel(complete, { ...EMPTY_STRUCTURE, ordinals: [0, 1] });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings.map(f => f.code)).toContain('DATA.LEVEL_ORDINAL_DUPLICATE');
  });

  it('admet un rang négatif, pour un sous-sol', () => {
    const outcome = acceptLevel({ ...complete, name: 'SS1', ordinal: -1, elevationM: -3 },
      { ...EMPTY_STRUCTURE, ordinals: [0] });
    if (!outcome.ok) throw new Error('refusé');
    expect(outcome.value.ordinal).toBe(-1);
    expect(outcome.value.elevationM).toBe(-3);
  });

  it('refuse un nom de niveau déjà porté dans le bâtiment', () => {
    const outcome = acceptLevel(complete, { ...EMPTY_STRUCTURE, levelNames: ['R+1'] });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings.map(f => f.code)).toContain('DATA.NAME_DUPLICATE');
  });

  /**
   * Un brouillon incomplet n'est pas une anomalie : l'action est refusée par
   * l'écran. M1bis donne un code au rang en double, aucun à l'absence de rang
   * ou d'altitude, et en inventer un ajouterait au catalogue.
   */
  it('un brouillon incomplet est refusé sans code', () => {
    for (const draft of [
      { name: '', ordinal: 1, elevationM: 0 },
      { name: 'R+1', ordinal: null, elevationM: 0 },
      { name: 'R+1', ordinal: 1.5, elevationM: 0 },
      { name: 'R+1', ordinal: 1, elevationM: null },
    ]) {
      expect(levelDraftComplete(draft), JSON.stringify(draft)).toBe(false);
      const outcome = acceptLevel(draft, EMPTY_STRUCTURE);
      expect(outcome.ok).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.findings).toEqual([]);
    }
    expect(levelDraftComplete(complete)).toBe(true);
  });
});

describe('nextOrdinal', () => {
  it('propose zéro sur un bâtiment sans niveau, puis la suite du plus élevé', () => {
    expect(nextOrdinal([])).toBe(0);
    expect(nextOrdinal([0, 1, 2])).toBe(3);
    // Un sous-sol ne fait pas reculer la proposition.
    expect(nextOrdinal([-2, -1, 0])).toBe(1);
  });
});

describe('commandes de structure', () => {
  /**
   * M1bis : « Nouveau bâtiment | Crée un bâtiment, et un premier niveau nommé
   * par défaut ». Les deux commandes portent le même groupe : un geste, une
   * annulation (E5.2).
   */
  it('créer un bâtiment crée son premier niveau, dans un seul groupe', () => {
    const accepted = acceptBuilding(
      { name: 'Annexe', independentAccess: true, defaultEdgeWidthM: 1.4 }, EMPTY_STRUCTURE);
    if (!accepted.ok) throw new Error('refusé');

    const built = buildingCommands(
      accepted.value, { id: 'lvl-1', name: 'RDC' }, { buildingId: 'bldg-1' }, WRITE);
    if (!built.ok) throw new Error(built.findings.map(f => f.code).join(', '));

    expect(built.value.map(c => c.table)).toEqual(['building', 'level']);
    expect(new Set(built.value.map(c => c.groupKey)).size).toBe(1);
    expect(built.value[0]?.after?.['site_id']).toBe('site-1');
    expect(built.value[0]?.after?.['independent_access']).toBe(true);
    expect(built.value[1]?.after?.['building_id']).toBe('bldg-1');
    expect(built.value[1]?.after?.['ordinal']).toBe(0);
  });

  it('un bâtiment sans largeur par défaut n’écrit pas la colonne', () => {
    const accepted = acceptBuilding(
      { name: 'B', independentAccess: false, defaultEdgeWidthM: null }, EMPTY_STRUCTURE);
    if (!accepted.ok) throw new Error('refusé');
    const built = buildingCommands(
      accepted.value, { id: 'l', name: 'RDC' }, { buildingId: 'b' }, WRITE);
    if (!built.ok) throw new Error('refusé');
    expect(Object.keys(built.value[0]?.after ?? {})).not.toContain('default_edge_width_m');
  });

  it('créer un niveau écrit une ligne rattachée au bâtiment', () => {
    const accepted = acceptLevel({ name: 'R+2', ordinal: 2, elevationM: 8.4 }, EMPTY_STRUCTURE);
    if (!accepted.ok) throw new Error('refusé');
    const built = levelCommands(accepted.value, { levelId: 'lvl-2', buildingId: 'bldg-1' }, WRITE);
    if (!built.ok) throw new Error('refusé');
    expect(built.value).toHaveLength(1);
    expect(built.value[0]?.after).toMatchObject({
      building_id: 'bldg-1', name: 'R+2', ordinal: 2, elevation_m: '8.4',
    });
  });

  it('le renommage porte l’avant et l’après, donc s’annule', () => {
    const built = renameCommands('building', 'bldg-1', 'Ancien', ' Nouveau ', [], WRITE);
    if (!built.ok) throw new Error('refusé');
    expect(built.value[0]?.operation).toBe('update');
    expect(built.value[0]?.before).toEqual({ name: 'Ancien' });
    expect(built.value[0]?.after).toEqual({ name: 'Nouveau' });
  });

  it('le renommage refuse un nom déjà porté', () => {
    const built = renameCommands('level', 'lvl-1', 'RDC', 'R+1', ['R+1'], WRITE);
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.findings.map(f => f.code)).toContain('DATA.NAME_DUPLICATE');
  });
});

describe('suppression d’un niveau', () => {
  const row = {
    id: 'lvl-1',
    values: {
      id: 'lvl-1', org_id: 'org-1', building_id: 'bldg-1',
      name: 'R+1', ordinal: 1, elevation_m: '4.2',
    },
  };

  /** Critère 3 de M1bis : un niveau peuplé ne se supprime pas. */
  it('refuse un niveau portant des empreintes ou des nœuds', () => {
    for (const occupancy of [
      { footprints: 1, nodes: 0 },
      { footprints: 0, nodes: 3 },
      { footprints: 2, nodes: 2 },
    ]) {
      const built = deleteLevelCommands(row, occupancy, WRITE);
      expect(built.ok, JSON.stringify(occupancy)).toBe(false);
      if (built.ok) continue;
      expect(built.findings.map(f => f.code)).toContain('DATA.LEVEL_NOT_EMPTY');
    }
  });

  /**
   * `before` porte la ligne entière : sans elle, l'annulation ne pourrait pas
   * rétablir le niveau supprimé (E5.1).
   */
  it('supprime un niveau vide, et l’annulation peut le rétablir', () => {
    const built = deleteLevelCommands(row, { footprints: 0, nodes: 0 }, WRITE);
    if (!built.ok) throw new Error(built.findings.map(f => f.code).join(', '));
    expect(built.value[0]?.operation).toBe('delete');
    expect(built.value[0]?.after).toBeNull();
    expect(built.value[0]?.before).toMatchObject({ name: 'R+1', ordinal: 1 });
  });
});
