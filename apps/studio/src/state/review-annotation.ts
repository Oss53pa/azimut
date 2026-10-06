import type { EntityCommand } from '@azimut/core-model';
import { buildCommand, codePointCompare } from '@azimut/core-model';

/**
 * J4 (partie J) — l'annotation en révision : une remarque de relecture
 * ancrée sur une ligne du tableau des messages, une face, un support ou une
 * zone (migration 0073, module 02).
 *
 * Rédigée au clavier, ou tracée au stylet : le tracé est gardé tel quel, comme
 * une note manuscrite, sans reconnaissance d'écriture (décision de
 * l'utilisateur). Trois états ; une annotation ouverte bloque l'approbation
 * (R12, `REVIEW.ANNOTATION_OPEN`). Qui la clôt, et quand, la base le signe.
 *
 * Elle n'apparaît jamais dans un livrable : aucun chargeur de site ne la lit.
 */
export const ANCHOR_KINDS = ['message_line', 'support_face', 'support', 'zone'] as const;
export type AnchorKind = (typeof ANCHOR_KINDS)[number];
export type AnnotationAnchor = { readonly kind: AnchorKind; readonly id: string };

export const ANNOTATION_STATES = ['open', 'resolved', 'rejected'] as const;
export type AnnotationState = (typeof ANNOTATION_STATES)[number];

/** Un point du tracé, rapporté au cadre de saisie (0 à 1), avec sa pression. */
export type InkPoint = { readonly x: number; readonly y: number; readonly p: number };
export type InkNote = readonly (readonly InkPoint[])[];

export type AnnotationReply = { readonly id: string; readonly body: string; readonly created_at: string };

export type ReviewAnnotation = {
  readonly id: string;
  readonly anchor: AnnotationAnchor;
  readonly state: AnnotationState;
  readonly body: string;
  readonly ink: InkNote | null;
  readonly created_at: string;
  readonly replies: readonly AnnotationReply[];
};

/** La colonne de l'ancre, par genre : une seule est remplie (0073). */
const ANCHOR_COLUMN: Readonly<Record<AnchorKind, string>> = {
  message_line: 'message_line_id',
  support_face: 'support_face_id',
  support: 'support_id',
  zone: 'zone_id',
};

type Row = { readonly table: string; readonly id: string; readonly values: Readonly<Record<string, unknown>> };

function live(row: Row): boolean {
  const deleted = row.values['deleted_at'];
  return deleted === undefined || deleted === null || deleted === '';
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function inkOf(raw: unknown): InkNote | null {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw); } catch { return null; }
  }
  if (!Array.isArray(value)) return null;
  const strokes: InkPoint[][] = [];
  for (const stroke of value) {
    if (!Array.isArray(stroke)) return null;
    const points: InkPoint[] = [];
    for (const point of stroke) {
      if (typeof point !== 'object' || point === null) return null;
      const { x, y, p } = point as Record<string, unknown>;
      if (typeof x !== 'number' || typeof y !== 'number') return null;
      points.push({ x, y, p: typeof p === 'number' ? p : 0 });
    }
    strokes.push(points);
  }
  return strokes.length === 0 ? null : strokes;
}

function anchorOf(values: Readonly<Record<string, unknown>>): AnnotationAnchor | null {
  const found = ANCHOR_KINDS.filter(kind => text(values[ANCHOR_COLUMN[kind]]) !== '');
  const kind = found[0];
  if (found.length !== 1 || kind === undefined) return null;
  return { kind, id: text(values[ANCHOR_COLUMN[kind]]) };
}

function isState(value: unknown): value is AnnotationState {
  return (ANNOTATION_STATES as readonly unknown[]).includes(value);
}

/**
 * Les annotations de la session et leur fil, dans l'ordre de création. Une
 * ligne sans ancre unique ou sans état connu n'est pas montrée.
 */
export function readAnnotations(rows: readonly Row[]): readonly ReviewAnnotation[] {
  const replies = new Map<string, AnnotationReply[]>();
  for (const row of rows) {
    if (row.table !== 'review_annotation_reply' || !live(row)) continue;
    const parent = text(row.values['annotation_id']);
    const list = replies.get(parent) ?? [];
    list.push({ id: row.id, body: text(row.values['body']), created_at: text(row.values['created_at']) });
    replies.set(parent, list);
  }
  const out: ReviewAnnotation[] = [];
  for (const row of rows) {
    if (row.table !== 'review_annotation' || !live(row)) continue;
    const anchor = anchorOf(row.values);
    const state = row.values['state'] ?? 'open';
    if (anchor === null || !isState(state)) continue;
    out.push({
      id: row.id, anchor, state,
      body: text(row.values['body']),
      ink: inkOf(row.values['ink']),
      created_at: text(row.values['created_at']),
      replies: [...(replies.get(row.id) ?? [])].sort((a, b) =>
        codePointCompare(a.created_at, b.created_at) || codePointCompare(a.id, b.id)),
    });
  }
  return out;
}

/** Les annotations d'une entité. */
export function annotationsOn(annotations: readonly ReviewAnnotation[], anchor: AnnotationAnchor): readonly ReviewAnnotation[] {
  return annotations.filter(a => a.anchor.kind === anchor.kind && a.anchor.id === anchor.id);
}

/**
 * Les annotations ouvertes sur les lignes d'un tableau : ce que R12 oppose à
 * l'approbation (`REVIEW.ANNOTATION_OPEN`).
 */
export function openAnnotationIdsOn(
  annotations: readonly ReviewAnnotation[], lineIds: readonly string[],
): readonly string[] {
  const lines = new Set(lineIds);
  return annotations
    .filter(a => a.state === 'open' && a.anchor.kind === 'message_line' && lines.has(a.anchor.id))
    .map(a => a.id)
    .sort(codePointCompare);
}

export type AnnotationWrite = {
  readonly orgId: string;
  readonly siteId: string;
  readonly timestamp: string;
};

export type AnnotateOutcome =
  | { readonly kind: 'written'; readonly commands: readonly EntityCommand[] }
  | { readonly kind: 'empty' }
  | { readonly kind: 'refused' };

/**
 * Une remarque, posée sur une ou plusieurs entités : « annoter la sélection
 * d'une même remarque crée une annotation par ligne » (R8). Un seul geste,
 * une seule annulation. Une remarque vide — ni texte, ni tracé — n'est pas
 * écrite.
 */
export function annotateCommands(
  targets: readonly { readonly id: string; readonly anchor: AnnotationAnchor }[],
  note: { readonly body: string; readonly ink: InkNote | null },
  write: AnnotationWrite,
): AnnotateOutcome {
  const body = note.body.trim();
  const ink = note.ink !== null && note.ink.some(s => s.length > 0) ? note.ink : null;
  if (body === '' && ink === null) return { kind: 'empty' };
  const first = targets[0];
  if (first === undefined) return { kind: 'empty' };
  const commands: EntityCommand[] = [];
  for (const target of targets) {
    const built = buildCommand({
      operation: 'create', module: '02-wayfinding', table: 'review_annotation', id: target.id,
      org_id: write.orgId, timestamp: write.timestamp, groupKey: `annotate:${first.id}`,
      after: {
        id: target.id, org_id: write.orgId, site_id: write.siteId,
        [ANCHOR_COLUMN[target.anchor.kind]]: target.anchor.id,
        state: 'open', body, ink: ink === null ? null : JSON.stringify(ink),
      },
    });
    if (!built.ok) return { kind: 'refused' };
    commands.push(built.value);
  }
  return { kind: 'written', commands };
}

/** Une réponse au fil d'une annotation. */
export function replyCommand(
  annotationId: string, replyId: string, body: string, write: Pick<AnnotationWrite, 'orgId' | 'timestamp'>,
): EntityCommand | null {
  const trimmed = body.trim();
  if (trimmed === '') return null;
  const built = buildCommand({
    operation: 'create', module: '02-wayfinding', table: 'review_annotation_reply', id: replyId,
    org_id: write.orgId, timestamp: write.timestamp, groupKey: `reply:${replyId}`,
    after: { id: replyId, org_id: write.orgId, annotation_id: annotationId, body: trimmed },
  });
  return built.ok ? built.value : null;
}

/**
 * Traiter ou refuser une annotation, ou la rouvrir. La signature — qui, quand —
 * est posée par la base au changement d'état (0073) : l'appelant ne la
 * fournit pas, il ne pourrait que la falsifier.
 */
export function setStateCommand(
  annotation: ReviewAnnotation, state: AnnotationState, write: Pick<AnnotationWrite, 'orgId' | 'timestamp'>,
): EntityCommand | null {
  if (annotation.state === state) return null;
  const built = buildCommand({
    operation: 'update', module: '02-wayfinding', table: 'review_annotation', id: annotation.id,
    org_id: write.orgId, timestamp: write.timestamp, groupKey: `annotation-state:${annotation.id}:${write.timestamp}`,
    before: { state: annotation.state }, after: { state },
  });
  return built.ok ? built.value : null;
}
