import { describe, it, expect } from 'vitest';
import { dependencyOrder } from '../fixture-cleanup.js';

/**
 * A5.11 — le retrait d'un décor d'essai suit l'ordre de dépendance, faute de
 * cascade. L'ordre se calcule, il ne s'écrit pas : ces essais portent sur le
 * calcul, sans base.
 */
describe('A5.11 — ordre de dépendance du retrait', () => {
  it('place une fille avant sa mère', () => {
    const order = dependencyOrder(
      ['site', 'building', 'level'],
      [
        { child: 'building', parent: 'site' },
        { child: 'level', parent: 'building' },
      ],
    );
    expect(order).toEqual(['level', 'building', 'site']);
  });

  it('respecte une dépendance indirecte, quel que soit l’ordre donné', () => {
    const edges = [
      { child: 'edge', parent: 'node' },
      { child: 'node', parent: 'level' },
      { child: 'level', parent: 'building' },
      { child: 'building', parent: 'site' },
    ];
    const tables = ['site', 'node', 'edge', 'level', 'building'];
    const order = dependencyOrder(tables, edges);
    for (const { child, parent } of edges) {
      expect(order.indexOf(child)).toBeLessThan(order.indexOf(parent));
    }
  });

  it('départage les ex aequo par nom, pour que deux appels concordent (A9)', () => {
    const tables = ['zeta', 'alpha', 'beta'];
    expect(dependencyOrder(tables, [])).toEqual(['alpha', 'beta', 'zeta']);
    expect(dependencyOrder([...tables].reverse(), [])).toEqual(dependencyOrder(tables, []));
  });

  it('ignore une arête qui sort du périmètre', () => {
    const order = dependencyOrder(
      ['site'],
      [{ child: 'building', parent: 'site' }, { child: 'site', parent: 'organization' }],
    );
    expect(order).toEqual(['site']);
  });

  it('ignore une clé qui pointe sur sa propre table', () => {
    const order = dependencyOrder(
      ['node', 'edge'],
      [{ child: 'node', parent: 'node' }, { child: 'edge', parent: 'node' }],
    );
    expect(order).toEqual(['edge', 'node']);
  });

  it('n’escamote aucune table prise dans un cycle', () => {
    // Le schéma n'en porte pas. Si un cycle apparaissait, la table doit
    // rester dans la liste : la suppression échouera en le disant, ce qui
    // vaut mieux qu'un décor à moitié retiré.
    const order = dependencyOrder(
      ['a', 'b', 'c'],
      [{ child: 'a', parent: 'b' }, { child: 'b', parent: 'a' }],
    );
    expect([...order].sort()).toEqual(['a', 'b', 'c']);
  });

  it('rend chaque table une fois et une seule', () => {
    const tables = ['site', 'building', 'level', 'footprint'];
    const order = dependencyOrder(tables, [
      { child: 'building', parent: 'site' },
      { child: 'building', parent: 'site' },
      { child: 'level', parent: 'building' },
      { child: 'footprint', parent: 'level' },
    ]);
    expect(order).toHaveLength(tables.length);
    expect(new Set(order).size).toBe(tables.length);
  });
});
