/**
 * R5, R6, R9 et R10 (partie R) — les lignes du tableau des messages telles que
 * l'écran les présente.
 *
 * Module pur : il ne dessine rien et ne lit aucune horloge. Il prend un
 * tableau enregistré et rend les lignes ordonnées, groupées, filtrées et
 * datées de leur état, avec le nombre de lignes que les filtres masquent.
 *
 * R6.2 : « Un filtre oublié ne doit jamais faire croire qu'une ligne n'existe
 * pas. » C'est la raison d'être de `hidden` : le compte des lignes masquées
 * est calculé ici, pas laissé à la charge de l'écran.
 */
import type { MessageLine, MessageSchedule } from '@azimut/engine-graph';
import type { Finding } from '@azimut/core-model';
import type { Exclusion } from './message-schedule-commands.js';

// ---------------------------------------------------------------------------
// Identifiant stable — partie R, sections R5 et R11
// ---------------------------------------------------------------------------

/**
 * R5 (partie R) : « Code du support, face, bloc · `D-042/F1/B3` · formé à
 * partir de `support.code` ».
 *
 * Les index de face et de bloc sont imprimés tels que le modèle les stocke.
 * R5 en donne un exemple, jamais une origine de numérotation ; inventer un
 * décalage de un ferait porter à l'identifiant une valeur que la donnée
 * n'a pas.
 *
 * Sans code de support, l'identifiant n'est pas formable. La cellule est alors
 * marquée plutôt que muette, comme R5 le demande déjà pour une langue active
 * sans contenu. `support.code` est requis par A5.6 ; la colonne n'est encore
 * nullable en base que parce que la rendre requise transformerait des données.
 */
export function stableLineId(
  supportCode: string | null,
  faceIndex: number,
  blockIndex: number,
): string | null {
  if (supportCode === null || supportCode.trim() === '') return null;
  return `${supportCode}/F${String(faceIndex)}/B${String(blockIndex)}`;
}

// ---------------------------------------------------------------------------
// État d'une ligne (R10)
// ---------------------------------------------------------------------------

/** R10 — les quatre présentations d'une ligne, et elles seules. */
export const LINE_STATES = ['current', 'stale', 'blocking', 'excluded'] as const;
export type LineState = (typeof LINE_STATES)[number];

export type ScheduleRow = {
  readonly line: MessageLine;
  /** R5 (partie R), première colonne. `null` quand le support n'a pas de code lisible. */
  readonly stableId: string | null;
  readonly supportCode: string | null;
  readonly state: LineState;
  /** Les anomalies portées par cette ligne, pour la pastille et le détail. */
  readonly findings: readonly Finding[];
  /** R9 — le motif de l'écartement, quand la ligne est écartée. */
  readonly exclusion: Exclusion | null;
};

export type RowInputs = {
  readonly schedule: MessageSchedule;
  /** Code lisible de chaque support, par identifiant (A5.6). */
  readonly supportCodes: ReadonlyMap<string, string>;
  readonly exclusions: ReadonlyMap<string, Exclusion>;
  /** Anomalies du tableau, telles que les contrôles les rendent. */
  readonly findings: readonly Finding[];
};

/**
 * Les lignes du tableau, dans l'ordre par défaut de R5 (partie R) : par identifiant
 * stable. R6.1 regroupe ensuite par support, face puis bloc, ce que cet ordre
 * produit déjà quand le code de support existe.
 */
export function buildRows(inputs: RowInputs): readonly ScheduleRow[] {
  const byLine = new Map<string, Finding[]>();
  for (const finding of inputs.findings) {
    if (finding.entity?.kind !== 'message_line') continue;
    const list = byLine.get(finding.entity.id) ?? [];
    list.push(finding);
    byLine.set(finding.entity.id, list);
  }

  const rows = inputs.schedule.lines.map(line => {
    const supportCode = inputs.supportCodes.get(line.support_id) ?? null;
    const findings = byLine.get(line.id) ?? [];
    const exclusion = inputs.exclusions.get(line.id) ?? null;
    return {
      line,
      stableId: stableLineId(supportCode, line.face_index, line.block_index),
      supportCode,
      state: stateOf(line, findings, exclusion),
      findings,
      exclusion,
    };
  });

  return [...rows].sort(compareRows);
}

/**
 * R10 — l'ordre de priorité des états.
 *
 * Une ligne écartée n'est jamais composée : c'est ce qu'il faut dire d'elle
 * avant tout le reste. Vient ensuite l'anomalie bloquante, puis la péremption.
 */
function stateOf(
  line: MessageLine,
  findings: readonly Finding[],
  exclusion: Exclusion | null,
): LineState {
  if (exclusion !== null) return 'excluded';
  if (findings.some(f => f.severity === 'blocking')) return 'blocking';
  if (line.stale) return 'stale';
  return 'current';
}

function compareRows(a: ScheduleRow, b: ScheduleRow): number {
  const byId = (a.stableId ?? a.line.support_id).localeCompare(b.stableId ?? b.line.support_id);
  if (byId !== 0) return byId;
  return a.line.face_index - b.line.face_index || a.line.block_index - b.line.block_index;
}

// ---------------------------------------------------------------------------
// Filtres et recherche (R6.2 (partie R), R6.3)
// ---------------------------------------------------------------------------

/** R6.2 (partie R) — les neuf filtres, et eux seuls. */
export type ScheduleFilters = {
  readonly supportIds: readonly string[];
  readonly directions: readonly string[];
  readonly informationLevels: readonly number[];
  readonly decisionPointIds: readonly string[];
  readonly staleOnly: boolean;
  readonly anomaliesOnly: boolean;
  /** R9 : les lignes écartées sont masquées par défaut. */
  readonly showExcluded: boolean;
  /** R6.3 (partie R) — recherche, tolérante aux accents et à la casse. */
  readonly search: string;
};

export const NO_FILTERS: ScheduleFilters = {
  supportIds: [],
  directions: [],
  informationLevels: [],
  decisionPointIds: [],
  staleOnly: false,
  anomaliesOnly: false,
  showExcluded: false,
  search: '',
};

export type FilteredRows = {
  readonly rows: readonly ScheduleRow[];
  /** R6.2 (partie R) — le nombre de lignes que les filtres retirent de la vue. */
  readonly hidden: number;
  /** R9 — comptées à part, elles figurent dans la barre d'état. */
  readonly excluded: number;
};

/**
 * R6.3 (partie R) : « Tolérante aux accents et à la casse. »
 *
 * La normalisation Unicode sépare la lettre de son signe diacritique, que la
 * plage `̀`–`ͯ` retire ensuite. Une recherche de « gare » trouve
 * ainsi « Garé » sans qu'aucune table d'équivalence ne soit écrite à la main.
 */
export function foldForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('fr');
}

function searchableText(row: ScheduleRow): string {
  const parts: string[] = [
    row.stableId ?? '',
    row.supportCode ?? '',
    row.line.decision_point_id,
  ];
  for (const entry of row.line.entries) {
    for (const written of Object.values(entry.text)) parts.push(written);
  }
  return foldForSearch(parts.join(' '));
}

export function applyFilters(
  rows: readonly ScheduleRow[],
  filters: ScheduleFilters,
): FilteredRows {
  const needle = foldForSearch(filters.search.trim());
  const kept = rows.filter(row => matches(row, filters, needle));
  return {
    rows: kept,
    hidden: rows.length - kept.length,
    excluded: rows.filter(row => row.state === 'excluded').length,
  };
}

function matches(
  row: ScheduleRow,
  filters: ScheduleFilters,
  needle: string,
): boolean {
  // R9 : masquées par défaut, visibles par le filtre « Écartées ».
  if (row.state === 'excluded' && !filters.showExcluded) return false;

  if (filters.supportIds.length > 0
    && !filters.supportIds.includes(row.line.support_id)) return false;

  if (filters.directions.length > 0
    && (row.line.direction === null || !filters.directions.includes(row.line.direction))) {
    return false;
  }

  if (filters.informationLevels.length > 0
    && (row.line.information_level === null
      || !filters.informationLevels.includes(row.line.information_level))) {
    return false;
  }

  if (filters.decisionPointIds.length > 0
    && !filters.decisionPointIds.includes(row.line.decision_point_id)) return false;

  if (filters.staleOnly && row.state !== 'stale') return false;
  if (filters.anomaliesOnly && row.findings.length === 0) return false;
  if (needle !== '' && !searchableText(row).includes(needle)) return false;

  return true;
}

/** Les filtres actifs, pour les pastilles retirables de R6.2 (partie R). */
export function activeFilterCount(filters: ScheduleFilters): number {
  let count = 0;
  if (filters.supportIds.length > 0) count += 1;
  if (filters.directions.length > 0) count += 1;
  if (filters.informationLevels.length > 0) count += 1;
  if (filters.decisionPointIds.length > 0) count += 1;
  if (filters.staleOnly) count += 1;
  if (filters.anomaliesOnly) count += 1;
  if (filters.showExcluded) count += 1;
  if (filters.search.trim() !== '') count += 1;
  return count;
}

// ---------------------------------------------------------------------------
// Regroupement (R6.1 (partie R))
// ---------------------------------------------------------------------------

/** R6.1 (partie R) — les quatre regroupements disponibles. */
export const GROUPINGS = ['support', 'zone', 'level', 'decision_point'] as const;
export type Grouping = (typeof GROUPINGS)[number];

export type RowGroup = {
  readonly key: string;
  /**
   * Ce que l'en-tête de groupe rappelle.
   *
   * `null` quand le rattachement demandé n'est pas déclaré pour ces supports :
   * l'écran le nomme alors en toutes lettres. Un en-tête vide laisserait
   * croire à un groupe sans nom plutôt qu'à une donnée absente.
   */
  readonly heading: string | null;
  readonly rows: readonly ScheduleRow[];
};

export type GroupingContext = {
  /** Zone d'orientation de chaque support, par identifiant de support. */
  readonly zoneOfSupport: ReadonlyMap<string, string>;
  /** Niveau de chaque support, par identifiant de support. */
  readonly levelOfSupport: ReadonlyMap<string, string>;
};

/**
 * Regroupe les lignes. Par défaut par support, « puis ordonnées par face et
 * par bloc », ce que l'ordre de `buildRows` donne déjà.
 *
 * Le regroupement par point de décision est celui qui sert à vérifier la
 * continuité, règle M02.W5 : il met côte à côte tout ce qu'un même point
 * annonce.
 */
export function groupRows(
  rows: readonly ScheduleRow[],
  grouping: Grouping,
  context: GroupingContext,
): readonly RowGroup[] {
  const UNATTACHED = '\u0000';
  const groups = new Map<string, ScheduleRow[]>();
  for (const row of rows) {
    const key = groupKeyOf(row, grouping, context) ?? UNATTACHED;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, list]) => ({
      key,
      heading: key === UNATTACHED ? null : key,
      rows: list,
    }));
}

function groupKeyOf(
  row: ScheduleRow,
  grouping: Grouping,
  context: GroupingContext,
): string | null {
  switch (grouping) {
    case 'support':
      return row.supportCode ?? row.line.support_id;
    case 'zone':
      return context.zoneOfSupport.get(row.line.support_id) ?? null;
    case 'level':
      return context.levelOfSupport.get(row.line.support_id) ?? null;
    case 'decision_point':
      return row.line.decision_point_id;
  }
}
