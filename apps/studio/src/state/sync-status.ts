/**
 * F5.2 — l'état de synchronisation que la barre d'état de l'atelier porte en
 * permanence. Pur : il se déduit de ce que la session sait déjà.
 *
 * Un seul état s'affiche, le plus grave d'abord :
 *  · `local` : aucune base configurée, rien ne part (M8, partie M, critère 3) ;
 *  · `pending` : des gestes attendent en file un retour du réseau (E5.3) ;
 *  · `direct` : une base, mais aucune session ouverte : l'écriture part sans
 *    suivi du journal, et ce que d'autres écrivent ne paraît pas ici ;
 *  · `unreachable` : la dernière lecture du journal a échoué. Ce que d'autres
 *    écrivent n'arrive plus, jusqu'à la prochaine lecture réussie ;
 *  · `synced` : le journal se lit, rien n'attend.
 */
export type SyncStatus =
  | { readonly kind: 'local' }
  | { readonly kind: 'pending'; readonly count: number }
  | { readonly kind: 'direct' }
  | { readonly kind: 'unreachable' }
  | { readonly kind: 'synced' };

export function syncStatusOf(inputs: {
  /** Un émetteur vers la base existe. */
  readonly remote: boolean;
  /** Le journal du site est suivi (session ouverte). */
  readonly followed: boolean;
  /** Gestes en file. */
  readonly queued: number;
  /** La dernière lecture du journal a échoué. */
  readonly readFailing: boolean;
}): SyncStatus {
  if (!inputs.remote) return { kind: 'local' };
  if (inputs.queued > 0) return { kind: 'pending', count: inputs.queued };
  if (!inputs.followed) return { kind: 'direct' };
  if (inputs.readFailing) return { kind: 'unreachable' };
  return { kind: 'synced' };
}
