import { describe, it, expect } from 'vitest';
import { acceptAxis } from '../graph-axis.js';
import type { AxisContext } from '../graph-axis.js';

/**
 * M4 (partie M) critère 1 — « Un axe tracé en une passe produit les nœuds et
 * arêtes attendus, sans doublon. »
 *
 * « Sans doublon » est la moitié du critère, et la seule qui se casse en
 * silence : un axe qui repose un nœud sur un nœud existant rend un graphe où
 * deux points confondus à l'écran sont disjoints au calcul, et rien ne le dit
 * avant que l'itinéraire échoue.
 */
function contextOf(overrides: Partial<AxisContext> = {}): AxisContext {
  let n = 0;
  return {
    nodes: [],
    edges: [],
    levelId: 'lvl-1',
    kind: 'junction',
    widthM: 1.4,
    direction: 'both',
    mintId: () => { n += 1; return `id-${String(n)}`; },
    ...overrides,
  };
}

const A = { x_m: 0, y_m: 0 };
const B = { x_m: 10, y_m: 0 };
const C = { x_m: 20, y_m: 0 };

describe('M4 (partie M) critère 1 — l’axe de circulation', () => {
  it('produit un nœud par sommet et une arête par segment', () => {
    const outcome = acceptAxis([A, B, C], contextOf());
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.nodes).toHaveLength(3);
    expect(outcome.value.edges).toHaveLength(2);
    expect(outcome.value.reused).toEqual([]);
  });

  it('calcule la longueur de chaque arête, jamais saisie', () => {
    const outcome = acceptAxis([A, B, C], contextOf());
    if (!outcome.ok) throw new Error('l’axe doit être accepté');
    expect(outcome.value.edges.map(e => e.edge.lengthM)).toEqual([10, 10]);
  });

  /**
   * Le doublon de nœud : un sommet posé sur un nœud existant le reprend. Deux
   * nœuds superposés se ressemblent à l'écran et font deux graphes disjoints
   * au calcul.
   */
  it('reprend un nœud existant au lieu d’en empiler un second', () => {
    const outcome = acceptAxis([A, B], contextOf({
      nodes: [{ id: 'n-existant', position: A }],
    }));
    if (!outcome.ok) throw new Error('l’axe doit être accepté');
    expect(outcome.value.nodes).toHaveLength(1);
    expect(outcome.value.reused).toEqual(['n-existant']);
    expect(outcome.value.edges[0]?.edge.fromNodeId).toBe('n-existant');
  });

  /** Le contre-exemple : un sommet hors tolérance crée bien un nœud. */
  it('crée un nœud quand le sommet est hors de la tolérance de coïncidence', () => {
    const outcome = acceptAxis([{ x_m: 0.002, y_m: 0 }, B], contextOf({
      nodes: [{ id: 'n-existant', position: A }],
    }));
    if (!outcome.ok) throw new Error('l’axe doit être accepté');
    expect(outcome.value.nodes).toHaveLength(2);
    expect(outcome.value.reused).toEqual([]);
  });

  /**
   * Le doublon d'arête : un segment qui redouble une arête existante ne la
   * recrée pas. Le graphe porterait deux chemins là où il y en a un, et toute
   * longueur cumulée serait fausse.
   */
  it('ne recrée pas une arête que le graphe porte déjà', () => {
    const outcome = acceptAxis([A, B, C], contextOf({
      nodes: [{ id: 'n-a', position: A }, { id: 'n-b', position: B }],
      edges: [{ fromNodeId: 'n-a', toNodeId: 'n-b' }],
    }));
    if (!outcome.ok) throw new Error('l’axe doit être accepté');
    expect(outcome.value.edges).toHaveLength(1);
    expect(outcome.value.skipped).toBe(1);
  });

  /** Le sens ne distingue pas deux arêtes : A5.3 le porte sur l'arête. */
  it('reconnaît une arête existante quelle que soit son orientation', () => {
    const outcome = acceptAxis([A, B], contextOf({
      nodes: [{ id: 'n-a', position: A }, { id: 'n-b', position: B }],
      edges: [{ fromNodeId: 'n-b', toNodeId: 'n-a' }],
    }));
    if (!outcome.ok) throw new Error('l’axe doit être accepté');
    expect(outcome.value.edges).toEqual([]);
    expect(outcome.value.skipped).toBe(1);
  });

  /**
   * Un axe qui repasse par son propre sommet ne double pas davantage : la
   * boucle se ferme sur le nœud déjà créé dans la même passe.
   */
  it('ne double pas un sommet repris dans la même passe', () => {
    const outcome = acceptAxis([A, B, C, A], contextOf());
    if (!outcome.ok) throw new Error('l’axe doit être accepté');
    expect(outcome.value.nodes).toHaveLength(3);
    expect(outcome.value.edges).toHaveLength(3);
  });

  /**
   * Deux sommets coïncidents résolvent vers le même nœud : le segment
   * n'existe pas, et le refuser lèverait `GRAPH.EDGE_SELF_LOOP` sur un geste
   * que l'opérateur n'a pas fait.
   */
  it('passe un segment dont les deux extrémités sont le même nœud', () => {
    const outcome = acceptAxis([A, A, B], contextOf());
    if (!outcome.ok) throw new Error('l’axe doit être accepté');
    expect(outcome.value.nodes).toHaveLength(2);
    expect(outcome.value.edges).toHaveLength(1);
    expect(outcome.value.skipped).toBe(1);
  });

  it('ne produit rien sous deux points', () => {
    const outcome = acceptAxis([A], contextOf());
    if (!outcome.ok) throw new Error('un axe sans segment n’est pas une anomalie');
    expect(outcome.value.nodes).toEqual([]);
    expect(outcome.value.edges).toEqual([]);
  });

  /**
   * INV-4 : deux passes sur les mêmes données rendent le même résultat. Les
   * identifiants viennent de l'appelant, et le module n'en tire aucun.
   */
  it('rend deux fois le même résultat pour la même saisie', () => {
    const first = acceptAxis([A, B, C], contextOf());
    const second = acceptAxis([A, B, C], contextOf());
    expect(first).toEqual(second);
  });
});
