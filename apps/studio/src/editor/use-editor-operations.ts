/**
 * E7.3 + E5 — Editing operations bound to the document.
 *
 * Each operation computes its result with the pure engines (alignment,
 * clipboard, shape geometry), turns it into a reversible command, and
 * executes it. Nothing here mutates the document directly.
 *
 * The timestamp of a command is supplied by this layer, never read
 * inside a command or an engine (E5.1). It is injectable so a test can
 * replay a sequence without touching the clock (E4.4).
 */

import { useCallback, useMemo } from 'react';
import type { AlignAxis, DistributeAxis, ZOrderOp } from './alignment.js';
import { computeAlignment, computeDistribution, computeZOrder } from './alignment.js';
import type { ClipboardPayload, PasteResult } from './clipboard.js';
import type { ShapeCommandData } from './command-integration.js';
import type { DecorationShape } from './scene-objects.js';
import { DEFAULT_DECORATION_STYLE } from './scene-objects.js';
import type { EditorDocument } from './editor-document.js';
import { documentOrder, findShape } from './editor-document.js';
import {
  createShapesCommand,
  defaultLayer,
  deleteShapesCommand,
  moveShapesCommand,
  nextShapeId,
  reorderShapesCommand,
  CMD_SHAPE_PASTE,
} from './document-commands.js';
import { buildClipboardPayload, shapesFromClipboard } from './document-clipboard.js';
import { geometryFromCommandData, kindForGeometry, shapeBounds } from './shape-geometry.js';
import type { EditorDocumentApi } from './use-editor-document.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export type UseEditorOperationsOptions = {
  readonly documentApi: EditorDocumentApi;
  readonly orgId: string;
  readonly siteId: string;
  readonly levelId: string;
  readonly selectedIds: readonly string[];
  /** ISO-8601 timestamp source. Injected so tests can replay (E4.4). */
  readonly now?: (() => string) | undefined;
  /** Called after an operation, to announce its result (E6.3). */
  readonly onAnnounce?: ((message: string) => void) | undefined;
};

export type EditorOperations = {
  /** Turn a committed tool gesture into a shape. */
  readonly commitShape: (data: ShapeCommandData) => void;
  readonly deleteSelected: () => void;
  readonly align: (axis: AlignAxis) => void;
  readonly distribute: (axis: DistributeAxis) => void;
  readonly setZOrder: (op: ZOrderOp) => void;
  readonly buildPayload: (ids: readonly string[]) => ClipboardPayload | null;
  readonly paste: (result: PasteResult & { ok: true }) => void;
  readonly cut: (ids: readonly string[]) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultNow(): string {
  return new Date().toISOString();
}

function selectedBounds(
  doc: EditorDocument,
  ids: readonly string[],
): readonly ReturnType<typeof shapeBounds>[] {
  return ids.map(id => {
    const shape = findShape(doc, id);
    return shape === null ? null : shapeBounds(shape);
  });
}

function definedBounds(
  doc: EditorDocument,
  ids: readonly string[],
): readonly NonNullable<ReturnType<typeof shapeBounds>>[] {
  const result: NonNullable<ReturnType<typeof shapeBounds>>[] = [];
  for (const bounds of selectedBounds(doc, ids)) {
    if (bounds !== null) result.push(bounds);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEditorOperations(
  options: UseEditorOperationsOptions,
): EditorOperations {
  const {
    documentApi, orgId, siteId, levelId, selectedIds,
    now = defaultNow, onAnnounce,
  } = options;
  const { document, execute } = documentApi;

  const layer = useMemo(
    () => defaultLayer(orgId, siteId, levelId),
    [orgId, siteId, levelId],
  );

  const announce = useCallback((message: string) => {
    onAnnounce?.(message);
  }, [onAnnounce]);

  // ---- Creation ----

  const commitShape = useCallback((data: ShapeCommandData) => {
    const geometry = geometryFromCommandData(data);
    if (geometry === null) return;

    const shape: DecorationShape = {
      id: nextShapeId(document),
      orgId,
      layerId: layer.id,
      kind: kindForGeometry(geometry),
      geometry,
      styleRole: null,
      style: DEFAULT_DECORATION_STYLE,
      label: '',
      rotation_deg: 0,
    };

    const command = createShapesCommand(document, [shape], layer, now());
    if (command === null) return;
    execute(command);
    announce('Objet créé.');
  }, [document, execute, orgId, layer, now, announce]);

  // ---- Deletion ----

  const deleteSelected = useCallback(() => {
    const command = deleteShapesCommand(document, selectedIds, now());
    if (command === null) return;
    execute(command);
    announce(`${String(command.before.slots.length)} objet(s) supprimé(s).`);
  }, [document, execute, selectedIds, now, announce]);

  // ---- Alignment and distribution ----

  const align = useCallback((axis: AlignAxis) => {
    const deltas = computeAlignment(definedBounds(document, selectedIds), axis);
    const command = moveShapesCommand(document, deltas, now());
    if (command === null) return;
    execute(command);
    announce('Alignement appliqué.');
  }, [document, execute, selectedIds, now, announce]);

  const distribute = useCallback((axis: DistributeAxis) => {
    const deltas = computeDistribution(definedBounds(document, selectedIds), axis);
    const command = moveShapesCommand(document, deltas, now());
    if (command === null) return;
    execute(command);
    announce('Répartition appliquée.');
  }, [document, execute, selectedIds, now, announce]);

  // ---- Draw order ----

  const setZOrder = useCallback((op: ZOrderOp) => {
    const order = computeZOrder(documentOrder(document), selectedIds, op);
    const command = reorderShapesCommand(document, order, now());
    if (command === null) return;
    execute(command);
    announce('Ordre de superposition modifié.');
  }, [document, execute, selectedIds, now, announce]);

  // ---- Clipboard ----

  const buildPayload = useCallback((ids: readonly string[]) => {
    return buildClipboardPayload(document, ids, { orgId, siteId, levelId });
  }, [document, orgId, siteId, levelId]);

  const paste = useCallback((result: PasteResult & { ok: true }) => {
    const shapes = shapesFromClipboard(result.items, result.offset, {
      orgId,
      layerId: layer.id,
      idAt: (index: number) => nextShapeId(document, index),
    });
    const command = createShapesCommand(
      document, shapes, layer, now(), CMD_SHAPE_PASTE,
    );
    if (command === null) return;
    execute(command);
    announce(`${String(shapes.length)} objet(s) collé(s).`);
  }, [document, execute, orgId, layer, now, announce]);

  const cut = useCallback((ids: readonly string[]) => {
    const command = deleteShapesCommand(document, ids, now());
    if (command === null) return;
    execute(command);
    announce(`${String(command.before.slots.length)} objet(s) coupé(s).`);
  }, [document, execute, now, announce]);

  return {
    commitShape,
    deleteSelected,
    align,
    distribute,
    setZOrder,
    buildPayload,
    paste,
    cut,
  };
}
