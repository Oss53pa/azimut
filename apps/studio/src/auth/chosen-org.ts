/**
 * AUTH.4 — l'organisation choisie, gardée pour l'onglet.
 *
 * Commodité du poste, rien de plus : la valeur n'ouvre aucun droit. Elle ne
 * sert qu'à présélectionner un rattachement que la base vient de relire ; une
 * valeur périmée ou forgée, qui ne désigne aucun rattachement relu, est
 * ignorée. Elle est rangée par utilisateur : une autre personne connectée
 * dans le même onglet n'hérite pas du choix.
 *
 * `sessionStorage`, comme la session d'authentification : le choix vit avec
 * l'onglet et tombe avec lui. Le stockage peut être refusé (navigation
 * privée) : le choix est alors redemandé, sans erreur.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREFIX = 'azimut.studio.org.';

export type ChoiceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): ChoiceStorage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readChosenOrg(userId: string, storage: ChoiceStorage | null = browserStorage()): string | null {
  if (storage === null || !UUID.test(userId)) return null;
  try {
    const value = storage.getItem(PREFIX + userId);
    return value !== null && UUID.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeChosenOrg(
  userId: string,
  orgId: string | null,
  storage: ChoiceStorage | null = browserStorage(),
): void {
  if (storage === null || !UUID.test(userId)) return;
  try {
    if (orgId === null || !UUID.test(orgId)) storage.removeItem(PREFIX + userId);
    else storage.setItem(PREFIX + userId, orgId);
  } catch {
    // Stockage refusé : le choix vaut pour cet affichage, il sera redemandé.
  }
}
