import { describe, it, expect } from 'vitest';
import { refMinimal } from '@azimut/testkit';
import { validateGraph } from '@azimut/engine-graph';
import { graphScopeFromSession } from '../session-scope.js';
import { sessionFromSite } from '../session-from-site.js';
import { EMPTY_SESSION } from '../session-store.js';
import type { SessionState, StoredRow } from '../session-store.js';

/**
 * M5 (partie M) — l'écran de validation fait tourner le moteur.
 *
 * L'enjeu de ces essais est l'aller-retour : un site de référence, versé dans
 * une session puis relu, doit rendre le verdict que le moteur rend sur le site
 * lui-même. Sans cela, l'écran validerait une image dégradée de la saisie, et
 * un opérateur verrait des anomalies qui n'existent pas — ou, plus grave,
 * n'en verrait pas.
 */
function sessionOf(rows: readonly StoredRow[]): SessionState {
  return { ...EMPTY_SESSION, rows };
}

describe('M5 (partie M) — ce que la session donne à valider', () => {
  it('rend le verdict du site sur ce que la session porte du site', () => {
    const scope = graphScopeFromSession(sessionFromSite(refMinimal));
    expect(scope.unreadable).toEqual([]);
    // Comparé au site privé de son annuaire, et non au site entier : la
    // session de la tranche 1 ne porte pas de destination, et prétendre que
    // les deux verdicts coïncident laisserait croire que l'aller-retour
    // conserve un annuaire qu'il ne transporte pas.
    expect(validateGraph(scope.scope)).toEqual(validateGraph({
      ...refMinimal, destinations: [], destination_names: [],
    }));
  });

  it('retrouve empreintes, niveaux et bâtiments', () => {
    const { scope } = graphScopeFromSession(sessionFromSite(refMinimal));
    expect(scope.footprints.map(f => f.id).sort())
      .toEqual([...refMinimal.footprints.map(f => f.id)].sort());
    expect(scope.levels.map(l => l.id).sort())
      .toEqual([...refMinimal.levels.map(l => l.id)].sort());
    expect(scope.buildings.map(b => b.id).sort())
      .toEqual([...refMinimal.buildings.map(b => b.id)].sort());
  });

  /**
   * Le chemin d'écriture aplatit la géométrie en JSON ; le dépôt la porte
   * déjà analysée. Les deux formes doivent rendre la même empreinte, faute de
   * quoi la moitié des empreintes seraient illisibles selon leur provenance.
   */
  it('lit une géométrie portée en JSON comme une géométrie analysée', () => {
    const first = refMinimal.footprints[0];
    if (first === undefined) throw new Error('le site de référence doit porter une empreinte');
    const { scope, unreadable } = graphScopeFromSession(sessionOf([{
      table: 'footprint',
      id: first.id,
      values: {
        org_id: first.org_id,
        level_id: first.level_id,
        kind: first.kind,
        geometry: JSON.stringify({ vertices: first.geometry.vertices }),
      },
    }]));
    expect(unreadable).toEqual([]);
    expect(scope.footprints[0]?.geometry).toEqual(first.geometry);
  });

  it('compte une ligne illisible au lieu de la compléter', () => {
    const { scope, unreadable } = graphScopeFromSession(sessionOf([{
      table: 'footprint',
      id: 'fp-sans-geometrie',
      values: { org_id: 'org', level_id: 'lvl', kind: 'cell' },
    }]));
    expect(scope.footprints).toEqual([]);
    expect(unreadable).toEqual(['fp-sans-geometrie']);
  });

  /**
   * Un niveau sans son ordinal n'est pas un niveau à l'ordinal zéro. Le
   * deviner placerait une entité au rez-de-chaussée sans que personne l'ait
   * dit, et les contrôles inter-niveaux jugeraient une pile inventée.
   */
  it('écarte un niveau dont un champ requis manque', () => {
    const { scope, unreadable } = graphScopeFromSession(sessionOf([{
      table: 'level',
      id: 'lvl-sans-ordinal',
      values: { org_id: 'org', building_id: 'bat', name: 'R+1', elevation_m: 3 },
    }]));
    expect(scope.levels).toEqual([]);
    expect(unreadable).toEqual(['lvl-sans-ordinal']);
  });

  /**
   * L'annuaire entre avec le module 02. Tant qu'il n'est pas là, la portée
   * doit rester vide plutôt que d'être devinée depuis les empreintes : une
   * destination inventée ferait lever `GRAPH.DESTINATION_UNLINKED` sur une
   * entité que personne n'a saisie.
   */
  it('ne porte aucune destination tant que l’annuaire n’existe pas', () => {
    const { scope } = graphScopeFromSession(sessionFromSite(refMinimal));
    expect(scope.destinations).toEqual([]);
    expect(scope.destination_names).toEqual([]);
  });
});
