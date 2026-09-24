import { describe, it, expect } from 'vitest';
import { refMinimal } from '@azimut/testkit';
import type { GraphScope } from '../graph-scope.js';
import { validateGraph } from '../validate-graph.js';

/**
 * La validation du graphe ne demande que ce qu'elle lit.
 *
 * L'enjeu n'est pas la commodité : il est qu'un appelant qui ne porte pas de
 * site complet — l'atelier de M5 (partie M), qui tient une session de travail
 * — puisse appeler le moteur sans inventer une organisation, une fiche de
 * site ou un paquet de règles qu'aucun contrôle ne regarde.
 *
 * Deux choses sont vérifiées ici, et la seconde compte autant que la première :
 * un site entier reste accepté, et rend exactement le même verdict.
 */
describe('la validation du graphe ne demande que ce qu\'elle lit', () => {
  const scope: GraphScope = {
    buildings: refMinimal.buildings,
    levels: refMinimal.levels,
    graph: refMinimal.graph,
    destinations: refMinimal.destinations,
    destination_names: refMinimal.destination_names,
    footprints: refMinimal.footprints,
    travel_profiles: refMinimal.travel_profiles,
  };

  it('accepte les sept champs seuls, sans le reste du site', () => {
    const outcome = validateGraph(scope);
    expect(outcome.ok).toBe(true);
  });

  it('rend le même verdict que sur le site entier', () => {
    const partial = validateGraph(scope);
    const whole = validateGraph(refMinimal);
    expect(partial).toEqual(whole);
  });

  it('juge le graphe réduit, et non le site dont il vient', () => {
    // Une seule altération : le graphe est vidé de ses arêtes. Chaque nœud
    // devient orphelin, et le moteur doit le dire sur le sous-ensemble comme
    // il le dirait sur le site.
    const severed: GraphScope = {
      ...scope,
      graph: { ...scope.graph, edges: [] },
    };
    const outcome = validateGraph(severed);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings.some(f => f.code === 'GRAPH.NODE_ORPHAN')).toBe(true);
  });
});
