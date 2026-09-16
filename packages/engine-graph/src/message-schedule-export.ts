/**
 * H2.5 — Exports du tableau des messages.
 *
 * « Exportable en tableur et en document, avec un identifiant stable
 * par ligne. »
 *
 * L'export en tableur développe une ligne par mention : un bloc de
 * destinations produit autant de lignes que de destinations annoncées,
 * parce que c'est ainsi qu'un tableau des messages se relit. Le modèle,
 * lui, reste une ligne par bloc — l'export est un rendu, pas la donnée.
 */

import type { MessageLine, MessageSchedule } from './message-schedule.js';

export type ScheduleLang = 'fr' | 'en';

// ---------------------------------------------------------------------------
// Libellés
// ---------------------------------------------------------------------------

type ExportLabels = {
  readonly lineId: string;
  readonly support: string;
  readonly face: string;
  readonly block: string;
  readonly kind: string;
  readonly level: string;
  readonly decisionPoint: string;
  readonly destination: string;
  readonly direction: string;
  readonly distance: string;
  readonly textFr: string;
  readonly textEn: string;
  readonly stale: string;
  readonly yes: string;
  readonly no: string;
  readonly title: string;
  readonly version: string;
  readonly generatedAt: string;
  readonly state: string;
  readonly inputsHash: string;
  readonly lineCount: string;
};

const LABELS: Readonly<Record<ScheduleLang, ExportLabels>> = {
  fr: {
    lineId: 'Identifiant',
    support: 'Support',
    face: 'Face',
    block: 'Bloc',
    kind: 'Type de bloc',
    level: 'Niveau d’information',
    decisionPoint: 'Point de décision',
    destination: 'Destination',
    direction: 'Direction',
    distance: 'Distance (m)',
    textFr: 'Texte FR',
    textEn: 'Texte EN',
    stale: 'Périmé',
    yes: 'OUI',
    no: 'NON',
    title: 'Tableau des messages',
    version: 'Version',
    generatedAt: 'Généré le',
    state: 'État',
    inputsHash: 'Empreinte des entrées',
    lineCount: 'Nombre de lignes',
  },
  en: {
    lineId: 'Identifier',
    support: 'Support',
    face: 'Face',
    block: 'Block',
    kind: 'Block kind',
    level: 'Information level',
    decisionPoint: 'Decision point',
    destination: 'Destination',
    direction: 'Direction',
    distance: 'Distance (m)',
    textFr: 'Text FR',
    textEn: 'Text EN',
    stale: 'Stale',
    yes: 'YES',
    no: 'NO',
    title: 'Message schedule',
    version: 'Version',
    generatedAt: 'Generated at',
    state: 'State',
    inputsHash: 'Inputs hash',
    lineCount: 'Line count',
  },
};

// ---------------------------------------------------------------------------
// Tableur
// ---------------------------------------------------------------------------

function escapeCsvField(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

type ExportRow = readonly string[];

function rowsOfLine(line: MessageLine, labels: ExportLabels): readonly ExportRow[] {
  const common = [
    line.id,
    line.support_id,
    String(line.face_index),
    String(line.block_index),
    line.block_kind,
    line.information_level === null ? '' : String(line.information_level),
    line.decision_point_id,
  ];
  const staleCell = line.stale ? labels.yes : labels.no;

  if (line.entries.length === 0) {
    return [[...common, '', line.direction ?? '', '', '', '', staleCell]];
  }

  return line.entries.map((entry): ExportRow => [
    ...common,
    entry.destination_id ?? '',
    entry.direction ?? line.direction ?? '',
    entry.distance_m === null ? '' : String(entry.distance_m),
    entry.text['fr'] ?? '',
    entry.text['en'] ?? '',
    staleCell,
  ]);
}

/** Export en tableur, une ligne par mention. */
export function messageScheduleToCsv(
  schedule: MessageSchedule,
  lang: ScheduleLang = 'fr',
): string {
  const l = LABELS[lang];
  const out: string[] = [];

  out.push([
    l.lineId, l.support, l.face, l.block, l.kind, l.level, l.decisionPoint,
    l.destination, l.direction, l.distance, l.textFr, l.textEn, l.stale,
  ].map(escapeCsvField).join(';'));

  const ordered = [...schedule.lines].sort((a, b) =>
    a.support_id.localeCompare(b.support_id) ||
    a.face_index - b.face_index ||
    a.block_index - b.block_index,
  );

  for (const line of ordered) {
    for (const row of rowsOfLine(line, l)) {
      out.push(row.map(escapeCsvField).join(';'));
    }
  }

  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

/**
 * Export en document, destiné à la validation par la maîtrise
 * d'ouvrage. En-tête traçable : version, état, empreinte des entrées.
 */
export function messageScheduleToMarkdown(
  schedule: MessageSchedule,
  lang: ScheduleLang = 'fr',
): string {
  const l = LABELS[lang];
  const out: string[] = [];

  out.push(`# ${l.title}`);
  out.push('');
  out.push(`- ${l.version} : ${String(schedule.version)}`);
  out.push(`- ${l.state} : ${schedule.state}`);
  out.push(`- ${l.generatedAt} : ${schedule.generated_at}`);
  out.push(`- ${l.inputsHash} : ${schedule.inputs_hash}`);
  out.push(`- ${l.lineCount} : ${String(schedule.lines.length)}`);
  out.push('');

  const header = [
    l.lineId, l.support, l.face, l.kind, l.level, l.decisionPoint,
    l.destination, l.direction, l.textFr, l.textEn, l.stale,
  ];
  out.push(`| ${header.join(' | ')} |`);
  out.push(`| ${header.map(() => '---').join(' | ')} |`);

  const ordered = [...schedule.lines].sort((a, b) =>
    a.support_id.localeCompare(b.support_id) ||
    a.face_index - b.face_index ||
    a.block_index - b.block_index,
  );

  for (const line of ordered) {
    for (const row of rowsOfLine(line, l)) {
      // Le document omet la colonne de distance du tableur.
      const cells = [
        row[0] ?? '', row[1] ?? '', row[2] ?? '', row[4] ?? '', row[5] ?? '',
        row[6] ?? '', row[7] ?? '', row[8] ?? '', row[10] ?? '', row[11] ?? '',
        row[12] ?? '',
      ];
      out.push(`| ${cells.map(c => c.replace(/\|/g, '\\|')).join(' | ')} |`);
    }
  }

  return out.join('\n');
}
