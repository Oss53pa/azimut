/**
 * S6.6 — suivre le journal des commandes d'un site.
 *
 * Décision d'Oss53pa du 21 novembre 2026 (Q4) : le poste interroge le journal
 * à intervalle fixe, par PostgREST, sous les politiques de cloisonnement. La
 * note `docs/note-s6-0-transport-propagation.md` en donne les raisons : la
 * garantie sans perte vient du journal, pas du transport.
 *
 * Trois exigences de S6.6, et où chacune est tenue :
 *  · aucune commande perdue après une coupure : le curseur n'avance que sur
 *    des entrées lues et relues, et la lecture suivante repart de lui ;
 *  · aucune appliquée deux fois : une entrée dont le numéro n'est pas le
 *    suivant du curseur n'est pas rendue ;
 *  · aucune commande d'une autre organisation : la lecture passe par la base
 *    et ses politiques, et chaque commande est relue par `parseCommand`, qui
 *    rejoue la propriété unique et le registre de sécurité.
 *
 * Ce fichier lit et ordonne. Il n'applique rien : c'est le rôle de
 * `applyRemoteCommand` (S6.3), chez l'appelant.
 */
import { parseCommand } from '@azimut/core-model';
import type { EntityCommand, Finding, Outcome } from '@azimut/core-model';
import type { SinkConfig } from './postgrest-sink.js';
import type { JournaledWrite } from './journaled-sink.js';
import { bearerToken } from '../auth/access-token.js';

/**
 * Intervalle d'interrogation. Constante technique, sans origine normative :
 * la valeur initiale se mesure selon D13 sur le premier site réel.
 */
export const JOURNAL_POLL_INTERVAL_MS = 1000;

/** Nombre maximal d'entrées lues par interrogation. */
export const JOURNAL_PAGE_SIZE = 200;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type JournalEntry = {
  readonly seq: number;
  readonly authorId: string;
  readonly command: EntityCommand;
};

/** Où en est le poste : le dernier numéro qu'il a reçu, et ceux qu'il a écrits. */
export type JournalCursor = {
  readonly siteId: string;
  readonly lastSeq: number;
  /** Numéros écrits par ce poste et pas encore relus. */
  readonly own: ReadonlySet<number>;
};

export function startCursor(siteId: string, lastSeq = 0): JournalCursor {
  return { siteId, lastSeq, own: new Set() };
}

/** Inscrit au curseur les numéros qu'une écriture de ce poste a reçus. */
export function recordOwnWrite(cursor: JournalCursor, write: JournaledWrite): JournalCursor {
  const own = new Set(cursor.own);
  for (let seq = write.lastSeq - write.count + 1; seq <= write.lastSeq; seq += 1) own.add(seq);
  return { ...cursor, own };
}

export type ReadOutcome =
  | { readonly ok: true; readonly entries: readonly JournalEntry[] }
  | { readonly ok: false; readonly cause: string; readonly findings: readonly Finding[] };

/**
 * Lit les entrées qui suivent `afterSeq`, dans l'ordre du journal.
 *
 * Chaque ligne reçue est vérifiée avant de servir : forme, numéro, et commande
 * relue par `parseCommand`. Une ligne qui ne se relit pas arrête la lecture à
 * elle, et le refus le dit : la sauter ferait diverger ce poste des autres.
 */
export async function readJournalSince(
  config: SinkConfig,
  siteId: string,
  afterSeq: number,
  fetchImpl: typeof fetch = fetch,
): Promise<ReadOutcome> {
  if (!UUID.test(siteId) || !Number.isSafeInteger(afterSeq) || afterSeq < 0) {
    return { ok: false, cause: 'arguments', findings: [] };
  }
  const search = new URLSearchParams({
    select: 'seq,author_id,command',
    site_id: `eq.${siteId}`,
    seq: `gt.${String(afterSeq)}`,
    order: 'seq.asc',
    limit: String(JOURNAL_PAGE_SIZE),
  });

  let response: Response;
  try {
    response = await fetchImpl(`${config.url}/command_journal?${search.toString()}`, {
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${config.accessToken ?? bearerToken(config.apiKey)}`,
        'Accept-Profile': config.schema,
        Accept: 'application/json',
      },
    });
  } catch {
    return { ok: false, cause: 'transport', findings: [] };
  }
  if (!response.ok) return { ok: false, cause: String(response.status), findings: [] };

  let rows: unknown;
  try {
    rows = await response.json() as unknown;
  } catch {
    return { ok: false, cause: 'response', findings: [] };
  }
  if (!Array.isArray(rows)) return { ok: false, cause: 'response', findings: [] };

  const entries: JournalEntry[] = [];
  for (const row of rows as unknown[]) {
    const entry = entryOf(row);
    if (entry === null) return { ok: false, cause: 'response', findings: [] };
    if (!entry.ok) return { ok: false, cause: 'command', findings: entry.findings };
    entries.push(entry.value);
  }
  return { ok: true, entries };
}

function entryOf(
  row: unknown,
): { ok: true; value: JournalEntry } | { ok: false; findings: readonly Finding[] } | null {
  if (typeof row !== 'object' || row === null) return null;
  const { seq, author_id: authorId, command } = row as Record<string, unknown>;
  if (!Number.isSafeInteger(seq) || (seq as number) < 1) return null;
  if (typeof authorId !== 'string' || !UUID.test(authorId)) return null;
  if (typeof command !== 'object' || command === null) return null;

  const parsed = parseCommand(JSON.stringify(command));
  if (!parsed.ok) return { ok: false, findings: parsed.findings };
  return { ok: true, value: { seq: seq as number, authorId, command: parsed.value } };
}

/**
 * Le dernier numéro du journal du site, ou `null` si la lecture a échoué. Un
 * site sans entrée rend 0.
 *
 * Le poste le lit avant de relire le site : une commande inscrite entre les
 * deux est alors à la fois dans le site relu et dans la suite du journal, et
 * l'appliquer deux fois ne change rien, puisqu'elle porte ses valeurs.
 */
export async function readJournalHead(
  config: SinkConfig,
  siteId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<number | null> {
  if (!UUID.test(siteId)) return null;
  const search = new URLSearchParams({
    select: 'seq', site_id: `eq.${siteId}`, order: 'seq.desc', limit: '1',
  });
  try {
    const response = await fetchImpl(`${config.url}/command_journal?${search.toString()}`, {
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${config.accessToken ?? bearerToken(config.apiKey)}`,
        'Accept-Profile': config.schema,
        Accept: 'application/json',
      },
    });
    if (!response.ok) return null;
    const rows = await response.json() as unknown;
    if (!Array.isArray(rows)) return null;
    if (rows.length === 0) return 0;
    const seq = (rows[0] as Record<string, unknown> | null)?.['seq'];
    return Number.isSafeInteger(seq) && (seq as number) > 0 ? seq as number : null;
  } catch {
    return null;
  }
}

/** Un émetteur, vu de qui suit le journal. */
export type JournalSend = (commands: readonly EntityCommand[]) => Promise<Outcome<unknown>>;

/**
 * Enveloppe un émetteur pour que le suivi reconnaisse les écritures de ce
 * poste : le compteur `inFlight` suspend l'interrogation tant qu'une écriture
 * est en vol, et les numéros rendus sont inscrits au curseur.
 */
export function trackOwnWrites(
  send: JournalSend,
  cursor: { current: JournalCursor | null },
  inFlight: { current: number },
): JournalSend {
  return async commands => {
    inFlight.current += 1;
    try {
      const out = await send(commands);
      if (out.ok && isJournaledWrite(out.value) && cursor.current !== null) {
        cursor.current = recordOwnWrite(cursor.current, out.value);
      }
      return out;
    } finally {
      inFlight.current -= 1;
    }
  };
}

/** Ce qu'un émetteur journalisé rend en cas de succès. */
export function isJournaledWrite(value: unknown): value is JournaledWrite {
  if (typeof value !== 'object' || value === null) return false;
  const { lastSeq, count } = value as Record<string, unknown>;
  return Number.isSafeInteger(lastSeq) && Number.isSafeInteger(count);
}

export type FollowStep = {
  readonly cursor: JournalCursor;
  /** Les commandes des autres postes, à appliquer dans cet ordre. */
  readonly received: readonly JournalEntry[];
  /**
   * Vrai si la lecture a sauté un numéro. Le curseur s'arrête avant le trou :
   * le journal est sans trou par construction, et un trou annonce une lecture
   * incomplète, pas une entrée à ignorer.
   */
  readonly gap: boolean;
};

/**
 * Avance le curseur sur des entrées lues. Pur : ni horloge, ni réseau.
 *
 * Une entrée déjà reçue est écartée, ce qui rend une relecture sans effet.
 * Une entrée écrite par ce poste fait avancer le curseur sans être rendue :
 * elle est déjà appliquée ici.
 */
export function follow(cursor: JournalCursor, entries: readonly JournalEntry[]): FollowStep {
  let lastSeq = cursor.lastSeq;
  const own = new Set(cursor.own);
  const received: JournalEntry[] = [];

  for (const entry of entries) {
    if (entry.seq <= lastSeq) continue;
    if (entry.seq !== lastSeq + 1) {
      return { cursor: { ...cursor, lastSeq, own }, received, gap: true };
    }
    lastSeq = entry.seq;
    if (own.delete(entry.seq)) continue;
    received.push(entry);
  }
  return { cursor: { ...cursor, lastSeq, own }, received, gap: false };
}

/** Programme un appel différé et rend de quoi l'annuler. Injecté aux essais. */
export type Schedule = (run: () => void, delayMs: number) => () => void;

const browserSchedule: Schedule = (run, delayMs) => {
  const handle = setTimeout(run, delayMs);
  return () => { clearTimeout(handle); };
};

/**
 * Interroge le journal sans fin, une lecture à la fois, jusqu'à l'arrêt.
 *
 * Une lecture en échec ne fait pas avancer le curseur : l'interrogation
 * suivante relit depuis le même point. C'est ce qui rend une coupure sans
 * perte.
 *
 * `busy` dit qu'une écriture de ce poste est en vol. L'interrogation attend
 * alors son retour : lue avant que l'écriture ait rendu ses numéros, une
 * commande de ce poste passerait pour celle d'un autre.
 */
export function pollJournal(options: {
  readonly read: (afterSeq: number) => Promise<ReadOutcome>;
  readonly cursor: () => JournalCursor;
  readonly onStep: (step: FollowStep) => void;
  readonly onFailure: (outcome: Extract<ReadOutcome, { ok: false }>) => void;
  readonly busy?: () => boolean;
  readonly schedule?: Schedule;
  readonly intervalMs?: number;
}): () => void {
  const schedule = options.schedule ?? browserSchedule;
  const interval = options.intervalMs ?? JOURNAL_POLL_INTERVAL_MS;
  let stopped = false;
  let cancel: () => void = () => undefined;

  const tick = async (): Promise<void> => {
    if (options.busy?.() !== true) {
      let outcome: ReadOutcome;
      try {
        outcome = await options.read(options.cursor().lastSeq);
      } catch {
        outcome = { ok: false, cause: 'exception', findings: [] };
      }
      if (stopped) return;
      if (outcome.ok) options.onStep(follow(options.cursor(), outcome.entries));
      else options.onFailure(outcome);
    }
    if (!stopped) cancel = schedule(() => { void tick(); }, interval);
  };

  cancel = schedule(() => { void tick(); }, 0);
  return () => {
    stopped = true;
    cancel();
  };
}
