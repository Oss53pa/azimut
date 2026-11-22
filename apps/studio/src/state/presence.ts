/**
 * S6.7b — la présence sur un niveau, côté poste (migration 0081).
 *
 * G4.2 : « Les utilisateurs ayant le niveau ouvert sont affichés en permanence
 * dans la barre d'état, avec leur nom et l'heure de leur dernière
 * modification. » Le poste s'annonce sur le niveau qu'il a ouvert, renouvelle
 * son annonce plus souvent que la base ne l'oublie (30 secondes, 0081), la
 * retire en partant, et lit qui d'autre est là.
 *
 * Chaque ligne reçue est relue avant de servir, comme les entrées du journal :
 * une ligne qui ne se relit pas est écartée, sans faire tomber les autres.
 */
import type { SinkConfig } from './postgrest-sink.js';
import { bearerToken } from '../auth/access-token.js';

/** Renouvellement de l'annonce. Constante technique, sous les 30 s de 0081. */
export const PRESENCE_HEARTBEAT_MS = 10_000;

/** Lecture des présents. Constante technique, sans origine normative. */
export const PRESENCE_POLL_MS = 3_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Les rôles d'un rattachement (A5.1, 0079) : le libellé s'en tire au catalogue. */
export const PRESENCE_ROLES = [
  'admin', 'designer', 'owner_rep', 'vendor', 'operator', 'auditor', 'marketing',
] as const;
export type PresenceRole = (typeof PRESENCE_ROLES)[number];

export type SelectionRef = { readonly table: string; readonly id: string };
export type WorkZone = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

export type Presence = {
  readonly userId: string;
  /** Le nom affiché (Q12) ; `null` : seul le rôle se montre. */
  readonly displayName: string | null;
  readonly role: PresenceRole;
  readonly selection: readonly SelectionRef[];
  readonly zone: WorkZone | null;
  /** La dernière commande de ce membre sur le niveau, lue au journal. */
  readonly lastChangeAt: string | null;
};

function isRole(value: unknown): value is PresenceRole {
  return typeof value === 'string' && (PRESENCE_ROLES as readonly string[]).includes(value);
}

function selectionOf(value: unknown): readonly SelectionRef[] | null {
  if (!Array.isArray(value)) return null;
  const refs: SelectionRef[] = [];
  for (const item of value as unknown[]) {
    if (typeof item !== 'object' || item === null) return null;
    const { table, id } = item as Record<string, unknown>;
    if (typeof table !== 'string' || typeof id !== 'string' || !UUID.test(id)) return null;
    refs.push({ table, id });
  }
  return refs;
}

function zoneOf(value: unknown): WorkZone | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'object') return undefined;
  const { x, y, w, h } = value as Record<string, unknown>;
  const all = [x, y, w, h];
  if (!all.every(n => typeof n === 'number' && Number.isFinite(n))) return undefined;
  return { x: x as number, y: y as number, w: w as number, h: h as number };
}

/** Relit une ligne de `level_presence_list` ; `null` si elle ne se relit pas. */
export function presenceOf(row: unknown): Presence | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;
  const userId = r['user_id'];
  const displayName = r['display_name'];
  const lastChange = r['last_change_at'];
  if (typeof userId !== 'string' || !UUID.test(userId)) return null;
  if (displayName !== null && typeof displayName !== 'string') return null;
  if (!isRole(r['role'])) return null;
  const selection = selectionOf(r['selection']);
  const zone = zoneOf(r['zone']);
  if (selection === null || zone === undefined) return null;
  if (lastChange !== null && (typeof lastChange !== 'string' || Number.isNaN(Date.parse(lastChange)))) return null;
  return {
    userId, displayName: displayName === '' ? null : displayName, role: r['role'],
    selection, zone, lastChangeAt: lastChange,
  };
}

/** Les autres présents, dans un ordre stable : ce poste ne se voit pas lui-même. */
export function othersPresent(rows: readonly unknown[], selfId: string | null): readonly Presence[] {
  return rows
    .map(presenceOf)
    .filter((p): p is Presence => p !== null && p.userId !== selfId)
    .sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));
}

function headers(config: SinkConfig): Record<string, string> {
  return {
    apikey: config.apiKey,
    Authorization: `Bearer ${config.accessToken ?? bearerToken(config.apiKey)}`,
    'Content-Profile': config.schema,
    'Accept-Profile': config.schema,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function rpc(
  config: SinkConfig, name: string, body: unknown, fetchImpl: typeof fetch, keepalive = false,
): Promise<Response | null> {
  try {
    return await fetchImpl(`${config.url}/rpc/${name}`, {
      method: 'POST', headers: headers(config), body: JSON.stringify(body), keepalive,
    });
  } catch {
    return null;
  }
}

/** S'annonce sur le niveau. Rend vrai si la base l'a accepté. */
export async function touchPresence(
  config: SinkConfig, levelId: string, selection: readonly SelectionRef[], zone: WorkZone | null,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!UUID.test(levelId)) return false;
  const response = await rpc(config, 'touch_presence',
    { p_level_id: levelId, p_selection: selection, p_zone: zone }, fetchImpl);
  return response?.ok === true;
}

/** Retire l'annonce. `keepalive` : la requête survit à la fermeture de l'onglet. */
export async function leavePresence(
  config: SinkConfig, levelId: string, fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!UUID.test(levelId)) return;
  await rpc(config, 'leave_presence', { p_level_id: levelId }, fetchImpl, true);
}

/** Les présents du niveau, ou `null` si la lecture a échoué. */
export async function readPresence(
  config: SinkConfig, levelId: string, fetchImpl: typeof fetch = fetch,
): Promise<readonly unknown[] | null> {
  if (!UUID.test(levelId)) return null;
  const response = await rpc(config, 'level_presence_list', { p_level_id: levelId }, fetchImpl);
  if (response === null || !response.ok) return null;
  try {
    const rows = await response.json() as unknown;
    return Array.isArray(rows) ? rows as unknown[] : null;
  } catch {
    return null;
  }
}
