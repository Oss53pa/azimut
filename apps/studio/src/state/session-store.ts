/**
 * F15, `state/` — le magasin de session de la tranche M (partie M).
 *
 * Il tient ce que l'opérateur construit pendant le parcours de M8 : le site,
 * son niveau, le calage, les empreintes, les nœuds, les arêtes. Il n'est pas
 * une base : c'est l'état local, celui que E5.4 veut sauvegardé.
 *
 * E5.4 : « Sauvegarde locale à chaque commande validée, en stockage local du
 * navigateur, distincte de la synchronisation serveur. Reprise proposée à la
 * réouverture après incident, avec choix explicite de l'utilisateur entre
 * l'état local et l'état serveur. Aucune fusion silencieuse. »
 *
 * E5.3 : ce qui est écrit hors ligne attend en file, et part à la
 * synchronisation. La pile d'annulation est alors vidée.
 */
import type { EntityCommand, Outcome, Point } from '@azimut/core-model';

/** Une ligne telle que le magasin la garde : la table, l'identifiant, l'état. */
export type StoredRow = {
  readonly table: string;
  readonly id: string;
  readonly values: Readonly<Record<string, unknown>>;
};

export type SessionState = {
  readonly rows: readonly StoredRow[];
  /** Commandes écrites localement et pas encore synchronisées (E5.3). */
  readonly queued: readonly EntityCommand[];
  readonly online: boolean;
};

export const EMPTY_SESSION: SessionState = { rows: [], queued: [], online: true };

/** Applique une commande à l'état local. Le magasin ne refuse rien : il suit. */
export function applyToSession(state: SessionState, command: EntityCommand): SessionState {
  const rows = [...state.rows];
  const index = rows.findIndex(r => r.table === command.table && r.id === command.id);

  if (command.operation === 'delete') {
    return { ...state, rows: rows.filter((_, i) => i !== index) };
  }

  const values = { ...(index >= 0 ? rows[index]?.values ?? {} : {}), ...(command.after ?? {}) };
  const row: StoredRow = { table: command.table, id: command.id, values };
  if (index >= 0) rows[index] = row;
  else rows.push(row);
  return { ...state, rows };
}

/** Les lignes d'une table, dans l'ordre d'écriture. */
export function rowsOf(state: SessionState, table: string): readonly StoredRow[] {
  return state.rows.filter(r => r.table === table);
}

export function countOf(state: SessionState, table: string): number {
  return rowsOf(state, table).length;
}

// ---------------------------------------------------------------------------
// E5.4 — la sauvegarde locale
// ---------------------------------------------------------------------------

/** La clé du stockage local. Une par site : deux sites ne se mélangent pas. */
export function storageKey(siteId: string): string {
  return `azimut.session.${siteId}`;
}

/**
 * Sauvegarde l'état local. Appelée après chaque commande validée.
 *
 * Le stockage peut être refusé — navigation privée, quota, site bloqué. Un
 * refus n'interrompt pas le travail : il fait perdre la reprise après
 * incident, pas la session en cours.
 */
export function saveSession(
  siteId: string,
  state: SessionState,
  storage: Storage | null,
): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(storageKey(siteId), JSON.stringify({
      rows: state.rows,
      queued: state.queued,
    }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Relit l'état local, ou `null` s'il n'y en a pas.
 *
 * E5.4 : « Reprise proposée à la réouverture après incident, avec choix
 * explicite de l'utilisateur entre l'état local et l'état serveur. Aucune
 * fusion silencieuse. » Cette fonction *propose* — elle ne restaure rien
 * d'elle-même, et ne fusionne jamais.
 */
export function readSession(siteId: string, storage: Storage | null): SessionState | null {
  if (storage === null) return null;
  try {
    const raw = storage.getItem(storageKey(siteId));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { rows, queued } = parsed as { rows?: unknown; queued?: unknown };
    return {
      rows: Array.isArray(rows) ? rows as readonly StoredRow[] : [],
      queued: Array.isArray(queued) ? queued as readonly EntityCommand[] : [],
      online: true,
    };
  } catch {
    // Un état local illisible vaut une absence d'état local : proposer une
    // reprise depuis des octets qu'on ne comprend pas serait pire que rien.
    return null;
  }
}

export function clearSession(siteId: string, storage: Storage | null): void {
  try { storage?.removeItem(storageKey(siteId)); } catch { /* voir saveSession */ }
}

// ---------------------------------------------------------------------------
// E5.3 — hors ligne, et la synchronisation
// ---------------------------------------------------------------------------

/**
 * Écrit une suite de commandes.
 *
 * Hors ligne, elles entrent en file et l'état local avance : M8 (partie M)
 * critère 3 veut que « le même parcours soit réalisable hors ligne ». En
 * ligne, elles partent, et n'entrent en file que si l'envoi échoue — sans
 * quoi une coupure au milieu du parcours perdrait le travail.
 */
export async function writeToSession(
  state: SessionState,
  commands: readonly EntityCommand[],
  send: (commands: readonly EntityCommand[]) => Promise<Outcome<unknown>>,
): Promise<SessionState> {
  let next = state;
  for (const command of commands) next = applyToSession(next, command);

  if (!state.online) {
    return { ...next, queued: [...next.queued, ...commands] };
  }

  const sent = await send(commands);
  return sent.ok ? next : { ...next, queued: [...next.queued, ...commands] };
}

/**
 * Vide la file au retour du réseau.
 *
 * Tout ou rien : une file à moitié partie laisserait le dépôt dans un état que
 * personne ne sait décrire. Ce qui échoue reste en file et repartira.
 */
export async function flushQueue(
  state: SessionState,
  send: (commands: readonly EntityCommand[]) => Promise<Outcome<unknown>>,
): Promise<{ readonly state: SessionState; readonly flushed: number }> {
  if (state.queued.length === 0) return { state: { ...state, online: true }, flushed: 0 };

  const sent = await send(state.queued);
  return sent.ok
    ? { state: { ...state, queued: [], online: true }, flushed: state.queued.length }
    : { state: { ...state, online: true }, flushed: 0 };
}

// ---------------------------------------------------------------------------
// Lecture de ce que le parcours a construit
// ---------------------------------------------------------------------------

/** La géométrie d'une empreinte, relue depuis l'état local. */
export function footprintVertices(row: StoredRow): readonly Point[] {
  const raw = row.values['geometry'];
  if (typeof raw !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const vertices = (parsed as { vertices?: unknown }).vertices;
    return Array.isArray(vertices) ? vertices as readonly Point[] : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// E5.4 — la reprise, et ce qui la distingue d'une simple navigation
// ---------------------------------------------------------------------------

/**
 * La marque qu'un onglet porte tant qu'il travaille sur un site.
 *
 * Elle vit dans le stockage de session du navigateur : elle disparaît à la
 * fermeture de l'onglet, et ne suit pas l'onglet voisin. C'est exactement ce
 * qui sépare les deux cas que E5.4 traite différemment — passer d'un écran à
 * l'autre du même parcours, et rouvrir l'application sur un travail laissé là.
 */
export function openMarkKey(siteId: string): string {
  return `azimut.session.open.${siteId}`;
}

export function markOpenInTab(siteId: string, tabStorage: Storage | null): void {
  try { tabStorage?.setItem(openMarkKey(siteId), '1'); } catch { /* voir saveSession */ }
}

export function isOpenInTab(siteId: string, tabStorage: Storage | null): boolean {
  if (tabStorage === null) return false;
  try { return tabStorage.getItem(openMarkKey(siteId)) !== null; }
  catch { return false; }
}

/**
 * Ce qu'il faut faire d'un état local trouvé à l'ouverture d'un écran.
 *
 * Trois cas, et un seul appelle une question :
 *
 *   · `rien` — il n'y a pas d'état local, ou il est vide ;
 *   · `poursuivre` — cet onglet travaille déjà sur ce site. Changer d'écran
 *     n'est pas rouvrir : reposer la question à chaque écran rendrait le
 *     parcours de M8 (partie M) critère 1 impraticable, et il n'y a d'ailleurs
 *     rien à arbitrer, l'état local étant celui qu'on vient d'écrire ;
 *   · `proposer` — un travail a été laissé là par un autre onglet, ou par une
 *     session interrompue. C'est la réouverture après incident : l'utilisateur
 *     tranche, et rien n'est fusionné.
 */
export type ResumeDecision =
  | { readonly kind: 'rien' }
  | { readonly kind: 'poursuivre'; readonly state: SessionState }
  | { readonly kind: 'proposer'; readonly state: SessionState };

export function resumeDecision(
  saved: SessionState | null,
  openInTab: boolean,
): ResumeDecision {
  if (saved === null || saved.rows.length === 0) return { kind: 'rien' };
  return openInTab ? { kind: 'poursuivre', state: saved } : { kind: 'proposer', state: saved };
}

/**
 * Le rang du dernier identifiant local d'un état repris.
 *
 * Les identifiants de session sont tirés en suite — `…-000000000001`, puis
 * `…-000000000002`. Reprendre un état sans reprendre ce compteur ferait
 * réécrire les lignes déjà là au lieu d'en ajouter : la reprise perdrait
 * exactement ce qu'elle prétend sauver.
 */
export function highestLocalRank(rows: readonly StoredRow[]): number {
  let highest = 0;
  for (const row of rows) {
    const match = /^00000000-0000-4000-8000-([0-9a-f]{12})$/.exec(row.id);
    if (match?.[1] === undefined) continue;
    highest = Math.max(highest, Number.parseInt(match[1], 16));
  }
  return highest;
}
