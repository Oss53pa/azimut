import { describe, it, expect } from 'vitest';
import { edgeLengthBetween, computeEdgeLengths } from '../edge-length.js';
import type { EdgeLengthInput } from '../edge-length.js';

const LEVELS = [
  { id: 'lvl-0', elevation_m: 0 },
  { id: 'lvl-1', elevation_m: 3 },
];

function node(id: string, x: number, y: number, level = 'lvl-0'): EdgeLengthInput['nodes'][number] {
  return { id, level_id: level, position: { x_m: x, y_m: y } };
}

function edge(id: string, from: string, to: string): EdgeLengthInput['edges'][number] {
  return { id, from_node_id: from, to_node_id: to };
}

/**
 * M01.S6 — la longueur d'une arête est calculée depuis ses extrémités.
 */
describe('edgeLengthBetween', () => {
  it('mesure dans le plan quand les deux bouts sont au même niveau', () => {
    const length = edgeLengthBetween(
      { position: { x_m: 0, y_m: 0 }, elevation_m: 0 },
      { position: { x_m: 3, y_m: 4 }, elevation_m: 0 },
    );
    expect(length).toBe(5);
  });

  it('compte la dénivelée entre deux niveaux', () => {
    // Deux nœuds superposés, trois mètres d'écart de niveau : trois mètres,
    // et non zéro.
    const length = edgeLengthBetween(
      { position: { x_m: 10, y_m: 10 }, elevation_m: 0 },
      { position: { x_m: 10, y_m: 10 }, elevation_m: 3 },
    );
    expect(length).toBe(3);
  });

  it('combine le plan et la dénivelée', () => {
    const length = edgeLengthBetween(
      { position: { x_m: 0, y_m: 0 }, elevation_m: 0 },
      { position: { x_m: 3, y_m: 0 }, elevation_m: 4 },
    );
    expect(length).toBe(5);
  });

  it('rend zéro pour deux bouts confondus', () => {
    const at = { position: { x_m: 7, y_m: 7 }, elevation_m: 2 };
    expect(edgeLengthBetween(at, at)).toBe(0);
  });

  it('ne dépend pas du sens de parcours', () => {
    const a = { position: { x_m: 1, y_m: 2 }, elevation_m: 0 };
    const b = { position: { x_m: 9, y_m: 12 }, elevation_m: 3 };
    expect(edgeLengthBetween(a, b)).toBe(edgeLengthBetween(b, a));
  });
});

describe('computeEdgeLengths', () => {
  const input: EdgeLengthInput = {
    levels: LEVELS,
    nodes: [
      node('n-a', 0, 0),
      node('n-b', 30, 40),
      node('n-up', 0, 0, 'lvl-1'),
      node('n-orphan-level', 0, 0, 'lvl-inconnu'),
    ],
    edges: [
      edge('e-flat', 'n-a', 'n-b'),
      edge('e-vertical', 'n-a', 'n-up'),
      edge('e-dangling', 'n-a', 'n-absent'),
      edge('e-orphan-level', 'n-a', 'n-orphan-level'),
    ],
  };

  it('mesure chaque arête dont les deux bouts sont connus', () => {
    const lengths = computeEdgeLengths(input);
    expect(lengths.get('e-flat')).toBe(50);
    expect(lengths.get('e-vertical')).toBe(3);
  });

  it('n’invente aucune longueur pour une arête sans extrémité connue', () => {
    // En inventer une masquerait le nœud manquant que `validateGraph` signale.
    const lengths = computeEdgeLengths(input);
    expect(lengths.has('e-dangling')).toBe(false);
  });

  it('mesure quand même une arête dont le niveau est inconnu', () => {
    // Le nœud existe et sa position dans le plan reste vraie ; l'anomalie est
    // le niveau orphelin, pas l'arête.
    const lengths = computeEdgeLengths(input);
    expect(lengths.get('e-orphan-level')).toBe(0);
  });

  it('rend le même résultat quel que soit l’ordre d’entrée (invariant 4)', () => {
    const reversed: EdgeLengthInput = {
      levels: [...input.levels].reverse(),
      nodes: [...input.nodes].reverse(),
      edges: [...input.edges].reverse(),
    };
    expect([...computeEdgeLengths(reversed)].sort())
      .toEqual([...computeEdgeLengths(input)].sort());
  });

  it('rend une carte vide quand il n’y a pas d’arête', () => {
    expect(computeEdgeLengths({ ...input, edges: [] }).size).toBe(0);
  });
});
