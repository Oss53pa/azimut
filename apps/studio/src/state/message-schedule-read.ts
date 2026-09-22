/**
 * Relecture d'un tableau des messages depuis les lignes du magasin de session.
 *
 * L'écran de la partie R affiche un tableau enregistré, pas un tableau
 * recalculé : R4 lit sa version, son état, sa date de génération et
 * l'empreinte de ses entrées sur `message_schedule`, et R5 lit ses colonnes
 * sur `message_line`. Ce module refait donc le chemin inverse de
 * `writeScheduleCommands`, et lui seul : un second chemin de résolution
 * contredirait l'invariant 1.
 *
 * Il ne juge rien. Une ligne qu'il ne sait pas lire est écartée avec son
 * motif, plutôt que devinée : afficher une ligne à moitié lue à la maîtrise
 * d'ouvrage lui ferait valider ce que personne n'a écrit.
 */
import type { MessageEntry, MessageLine, MessageSchedule } from '@azimut/engine-graph';
import { isScheduleState, messageLineId } from '@azimut/engine-graph';
import type { ContentBlockKind } from '@azimut/core-model';
import type { SessionState, StoredRow } from './session-store.js';
import { rowsOf } from './session-store.js';
import type { Exclusion } from './message-schedule-commands.js';

export type ReadSchedule = {
  readonly schedule: MessageSchedule;
  /** R9 — l'écartement de M02.W9, par identifiant stable de ligne. */
  readonly exclusions: ReadonlyMap<string, Exclusion>;
  /**
   * L'identifiant de stockage de chaque ligne, par identifiant stable.
   * R7.3 en a besoin pour relier une ligne à la donnée dont elle dérive.
   */
  readonly rowIds: ReadonlyMap<string, string>;
  /** Lignes illisibles, nommées : jamais écartées en silence. */
  readonly unreadable: readonly string[];
};

// ---------------------------------------------------------------------------
// Lecture typée d'une valeur stockée
// ---------------------------------------------------------------------------

function text(values: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = values[key];
  return typeof value === 'string' ? value : null;
}

function integer(values: Readonly<Record<string, unknown>>, key: string): number | null {
  const value = values[key];
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^-?[0-9]+$/.test(value)) return Number(value);
  return null;
}

function boolean(values: Readonly<Record<string, unknown>>, key: string): boolean {
  const value = values[key];
  if (typeof value === 'boolean') return value;
  return value === 'true';
}

function parsed(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Contenu d'une ligne
// ---------------------------------------------------------------------------

/**
 * Le `content jsonb` de N2.2 tel que le chemin d'écriture le pose : le type du
 * bloc et ses mentions. R5 affiche les mentions en colonnes distinctes par
 * langue, il faut donc les retrouver structurées.
 */
type LineContent = {
  readonly block_kind: ContentBlockKind;
  readonly entries: readonly MessageEntry[];
};

function readEntry(value: unknown): MessageEntry | null {
  if (!isRecord(value)) return null;
  const rawText = value['text'];
  if (!isRecord(rawText)) return null;

  const byLang: Record<string, string> = {};
  for (const [lang, written] of Object.entries(rawText)) {
    if (typeof written === 'string') byLang[lang] = written;
  }

  const destination = value['destination_id'];
  const direction = value['direction'];
  const distance = value['distance_m'];
  return {
    destination_id: typeof destination === 'string' ? destination : null,
    text: byLang,
    direction: typeof direction === 'string' ? direction : null,
    distance_m: typeof distance === 'number' ? distance : null,
  };
}

/** Les types de bloc de A5.6, et eux seuls : aucun autre ne se lit. */
const BLOCK_KINDS: readonly ContentBlockKind[] = [
  'header', 'destination_list', 'pictogram', 'arrow', 'map',
  'legend', 'free_text', 'logo', 'emergency_info',
];

function isBlockKind(value: unknown): value is ContentBlockKind {
  return typeof value === 'string' && BLOCK_KINDS.some(kind => kind === value);
}

function readContent(raw: string | null): LineContent | null {
  const value = parsed(raw);
  if (!isRecord(value)) return null;
  const kind = value['block_kind'];
  if (!isBlockKind(kind)) return null;
  const rawEntries = value['entries'];
  if (!Array.isArray(rawEntries)) return null;

  const entries: MessageEntry[] = [];
  for (const candidate of rawEntries) {
    const entry = readEntry(candidate);
    if (entry === null) return null;
    entries.push(entry);
  }
  return { block_kind: kind, entries };
}

function readExclusion(raw: string | null): Exclusion | null {
  const value = parsed(raw);
  if (!isRecord(value)) return null;
  const cap = value['cap'];
  const ruleRef = value['rule_ref'];
  const excluded = value['excluded_priority'];
  const lastKept = value['last_kept_priority'];
  if (typeof cap !== 'number' || typeof ruleRef !== 'string') return null;
  if (typeof excluded !== 'number' || typeof lastKept !== 'number') return null;
  return { cap, ruleRef, excludedPriority: excluded, lastKeptPriority: lastKept };
}

// ---------------------------------------------------------------------------
// Lignes
// ---------------------------------------------------------------------------

function readLine(row: StoredRow): MessageLine | null {
  const v = row.values;
  const supportId = text(v, 'support_id');
  const faceIndex = integer(v, 'face_index');
  const blockIndex = integer(v, 'block_index');
  const decisionPointId = text(v, 'decision_point_id');
  const level = integer(v, 'information_level');
  const content = readContent(text(v, 'content'));

  if (supportId === null || faceIndex === null || blockIndex === null) return null;
  // M02.W4 : une ligne sans point de décision ne peut pas exister. Une telle
  // ligne en magasin est une donnée fausse, pas une ligne à afficher.
  if (decisionPointId === null || decisionPointId.trim() === '') return null;
  if (content === null) return null;
  if (level !== 1 && level !== 2 && level !== 3 && level !== 4) return null;

  return {
    id: messageLineId(supportId, faceIndex, blockIndex),
    support_id: supportId,
    face_index: faceIndex,
    block_index: blockIndex,
    block_kind: content.block_kind,
    entries: content.entries,
    pictogram_id: text(v, 'pictogram_id'),
    direction: text(v, 'direction'),
    information_level: level,
    decision_point_id: decisionPointId,
    stale: boolean(v, 'stale'),
  };
}

// ---------------------------------------------------------------------------
// Tableau
// ---------------------------------------------------------------------------

/**
 * Le tableau enregistré pour un site.
 *
 * Sans `version`, c'est la version la plus haute — celle que R4 affiche.
 * Avec, c'est cette version-là : R11 (partie R) en compare deux, et la
 * comparaison ne peut pas se contenter de la dernière.
 *
 * `null` quand la version demandée n'existe pas, ou qu'aucune n'existe : c'est
 * l'état vide de R16, « jamais un tableau vide présenté comme un résultat ».
 */
export function readSchedule(
  session: SessionState,
  siteId: string,
  version?: number,
): ReadSchedule | null {
  const heads = rowsOf(session, 'message_schedule')
    .filter(row => text(row.values, 'site_id') === siteId);
  if (heads.length === 0) return null;

  const head = version === undefined
    ? latest(heads)
    : heads.find(row => integer(row.values, 'version') === version) ?? null;
  if (head === null) return null;

  const storedVersion = integer(head.values, 'version');
  const state = text(head.values, 'state');
  const generatedAt = text(head.values, 'generated_at');
  const inputsHash = text(head.values, 'inputs_hash');
  if (storedVersion === null || state === null || !isScheduleState(state)) return null;
  if (generatedAt === null || inputsHash === null) return null;

  const lines: MessageLine[] = [];
  const exclusions = new Map<string, Exclusion>();
  const rowIds = new Map<string, string>();
  const unreadable: string[] = [];

  for (const row of rowsOf(session, 'message_line')) {
    if (text(row.values, 'schedule_id') !== head.id) continue;
    const line = readLine(row);
    if (line === null) {
      unreadable.push(row.id);
      continue;
    }
    lines.push(line);
    rowIds.set(line.id, row.id);
    if (boolean(row.values, 'excluded')) {
      const exclusion = readExclusion(text(row.values, 'exclusion_reason'));
      // M02.W9 : l'écartement est tracé, jamais silencieux. Un écartement sans
      // motif lisible rend la ligne illisible plutôt qu'écartée sans raison.
      if (exclusion === null) {
        lines.pop();
        rowIds.delete(line.id);
        unreadable.push(row.id);
        continue;
      }
      exclusions.set(line.id, exclusion);
    }
  }

  return {
    schedule: {
      site_id: siteId,
      version: storedVersion,
      state,
      generated_at: generatedAt,
      inputs_hash: inputsHash,
      lines,
    },
    exclusions,
    rowIds,
    unreadable,
  };
}

/**
 * La version la plus haute. R4 (partie R) affiche une version, et R12 fait de l'ancienne
 * un brouillon remplacé : c'est la dernière qui est le tableau courant.
 */
function latest(rows: readonly StoredRow[]): StoredRow | null {
  let best: StoredRow | null = null;
  let bestVersion = -1;
  for (const row of rows) {
    const version = integer(row.values, 'version');
    if (version === null || version <= bestVersion) continue;
    best = row;
    bestVersion = version;
  }
  return best;
}

/** Toutes les versions enregistrées pour un site, de la plus haute à la plus basse. */
export function scheduleVersions(
  session: SessionState,
  siteId: string,
): readonly number[] {
  const versions: number[] = [];
  for (const row of rowsOf(session, 'message_schedule')) {
    if (text(row.values, 'site_id') !== siteId) continue;
    const version = integer(row.values, 'version');
    if (version !== null) versions.push(version);
  }
  return versions.sort((a, b) => b - a);
}
