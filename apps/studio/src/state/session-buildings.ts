/**
 * Le nom des bâtiments que la session porte, par identifiant.
 *
 * Lecture de confort, distincte de `graphScopeFromSession` : la barre de
 * niveaux a besoin du seul nom, et faire passer par le lecteur du moteur un
 * écran qui veut une étiquette lui imposerait de lire aussi les empreintes et
 * le graphe.
 *
 * Un bâtiment sans nom lisible est absent de la table plutôt que porté sous
 * un nom inventé : la barre affiche alors le niveau seul, ce qui est exact.
 */
import type { SessionState } from './session-store.js';
import { rowsOf } from './session-store.js';
import { text } from './row-values.js';

export function buildingNames(session: SessionState): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const row of rowsOf(session, 'building')) {
    const name = text(row.values, 'name');
    if (name !== null) names.set(row.id, name);
  }
  return names;
}
