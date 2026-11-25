/**
 * S6.1b, décisions Q6 et Q7 — l'habillage exprimé en commandes d'entité.
 *
 * L'éditeur émet `Command<DocumentPatch>` : l'état des formes touchées, et
 * l'ordre de superposition entier, avant et après le geste. La base, le
 * journal (0078), la propagation et l'annulation par inverse (S6.8) ne
 * connaissent que des commandes de ligne. Ce module traduit l'un en l'autre :
 * une couche ou une forme apparue est une création, disparue une
 * suppression, changée une modification qui ne porte que ses colonnes
 * changées.
 *
 * L'ordre de superposition devient `decoration_shape.z_order` (Q6) : le rang
 * de la forme dans l'ordre du site. Une forme que le geste ne touche pas mais
 * dont le rang change reçoit une modification de son seul `z_order`.
 *
 * Les valeurs suivent ce que la base attend (0086) : géométrie et style en
 * texte JSON, noms de colonnes et de clés en `snake_case`, rôles de charte
 * seulement, jamais une couleur. L'organisation est celle de la session
 * (A6.1), jamais celle qu'une forme porterait.
 *
 * Pur et déterministe (A9, E4.4) : même geste, mêmes commandes, dans le même
 * ordre.
 */
import { buildCommand, codePointCompare } from '@azimut/core-model';
import type { EntityCommand, Outcome, RowValues } from '@azimut/core-model';
import type { Command } from './command.js';
import type { DocumentPatch } from './editor-document.js';
import type { DecorationGeometry, DecorationLayer, DecorationShape, DecorationStyle } from './scene-objects.js';

export type DecorationWrite = {
  readonly orgId: string;
  readonly timestamp: string;
  readonly groupKey: string | null;
};

const MODULE = '01-socle' as const;

/** La géométrie telle que 0086 la range. */
export function storedGeometry(geometry: DecorationGeometry): string {
  switch (geometry.type) {
    case 'polygon':
    case 'polyline':
      return JSON.stringify({ type: geometry.type, points: geometry.points.map(p => ({ x_m: p.x_m, y_m: p.y_m })) });
    case 'rectangle':
      return JSON.stringify({
        type: 'rectangle', origin: { x_m: geometry.origin.x_m, y_m: geometry.origin.y_m },
        width_m: geometry.width_m, height_m: geometry.height_m,
      });
    case 'ellipse':
      return JSON.stringify({
        type: 'ellipse', center: { x_m: geometry.center.x_m, y_m: geometry.center.y_m },
        rx_m: geometry.rx_m, ry_m: geometry.ry_m,
      });
    case 'symbol_ref':
      return JSON.stringify({
        type: 'symbol_ref', position: { x_m: geometry.position.x_m, y_m: geometry.position.y_m },
        symbol_id: geometry.symbolId, scale: geometry.scale,
      });
  }
}

/** Le style tel que 0086 le range : des rôles, une épaisseur, une opacité. */
export function storedStyle(style: DecorationStyle): string {
  return JSON.stringify({
    fill_role: style.fillRole,
    stroke_role: style.strokeRole,
    stroke_width_m: style.strokeWidth_m,
    opacity: style.opacity,
  });
}

function layerValues(layer: DecorationLayer, orgId: string): RowValues {
  return {
    id: layer.id, org_id: orgId, site_id: layer.siteId, level_id: layer.levelId,
    name: layer.name, z_order: layer.zOrder, visible: layer.visible,
    print_visible: layer.printVisible, locked: layer.locked,
  };
}

function shapeValues(shape: DecorationShape, zOrder: number, orgId: string): RowValues {
  return {
    id: shape.id, org_id: orgId, layer_id: shape.layerId, kind: shape.kind,
    geometry: storedGeometry(shape.geometry), style_role: shape.styleRole,
    label: shape.label, rotation_deg: String(shape.rotation_deg),
    z_order: zOrder, style: storedStyle(shape.style),
  };
}

/** Les colonnes qui diffèrent, avec leurs deux valeurs ; null si aucune. */
function changed(before: RowValues, after: RowValues): { before: RowValues; after: RowValues } | null {
  const b: Record<string, RowValues[string]> = {};
  const a: Record<string, RowValues[string]> = {};
  for (const column of Object.keys(after).sort(codePointCompare)) {
    if (column === 'id' || before[column] === after[column]) continue;
    b[column] = before[column] ?? null;
    a[column] = after[column] ?? null;
  }
  return Object.keys(a).length === 0 ? null : { before: b, after: a };
}

type Draft = {
  readonly table: 'decoration_layer' | 'decoration_shape';
  readonly id: string;
  readonly before: RowValues | null;
  readonly after: RowValues | null;
};

function draftsFor(
  table: Draft['table'], id: string, before: RowValues | null, after: RowValues | null,
): readonly Draft[] {
  if (before === null && after === null) return [];
  if (before === null || after === null) return [{ table, id, before, after }];
  const diff = changed(before, after);
  return diff === null ? [] : [{ table, id, ...diff }];
}

function layerDrafts(before: DocumentPatch, after: DocumentPatch, orgId: string) {
  const ids = [...new Set([...before.layers, ...after.layers].map(l => l.id))].sort(codePointCompare);
  const created: Draft[] = [];
  const updated: Draft[] = [];
  const deleted: Draft[] = [];
  for (const id of ids) {
    const b = before.layers.find(l => l.id === id);
    const a = after.layers.find(l => l.id === id);
    const drafts = draftsFor('decoration_layer', id,
      b === undefined ? null : layerValues(b, orgId), a === undefined ? null : layerValues(a, orgId));
    (b === undefined ? created : a === undefined ? deleted : updated).push(...drafts);
  }
  return { created, updated, deleted };
}

/**
 * L'état d'une forme dans un état du geste : la forme du créneau si le geste
 * la touche, sinon celle qu'on connaît, inchangée, à son rang de cet état.
 */
function shapeIn(
  patch: DocumentPatch, id: string, untouched: DecorationShape | null, orgId: string,
): RowValues | null {
  const rank = patch.order.indexOf(id);
  const slot = patch.slots.find(s => s.id === id);
  const shape = slot === undefined ? untouched : slot.shape;
  if (shape === null || rank < 0) return null;
  return shapeValues(shape, rank, orgId);
}

/**
 * Les commandes de ligne d'un geste d'habillage, dans l'ordre où la base doit
 * les appliquer : couches créées et modifiées, formes créées et modifiées,
 * formes supprimées, couches supprimées.
 *
 * `known` donne les formes que le geste ne touche pas et dont le rang peut
 * changer : celles du document au moment du geste.
 */
export function decorationCommands(
  command: Command<DocumentPatch>,
  known: readonly DecorationShape[],
  write: DecorationWrite,
): Outcome<readonly EntityCommand[]> {
  const { before, after } = command;
  const layers = layerDrafts(before, after, write.orgId);

  const touched = new Set([...before.slots, ...after.slots].map(s => s.id));
  const rankAfter = new Map(after.order.map((id, i) => [id, i]));
  const rankBefore = new Map(before.order.map((id, i) => [id, i]));
  const moved = [...rankAfter.keys()].filter(id => rankBefore.has(id) && rankBefore.get(id) !== rankAfter.get(id));
  const ids = [...new Set([...touched, ...moved])].sort((x, y) =>
    (rankAfter.get(x) ?? Number.MAX_SAFE_INTEGER) - (rankAfter.get(y) ?? Number.MAX_SAFE_INTEGER)
    || (rankBefore.get(x) ?? Number.MAX_SAFE_INTEGER) - (rankBefore.get(y) ?? Number.MAX_SAFE_INTEGER)
    || codePointCompare(x, y));

  const written: Draft[] = [];
  const removed: Draft[] = [];
  for (const id of ids) {
    const untouched = known.find(s => s.id === id) ?? null;
    const drafts = draftsFor('decoration_shape', id,
      shapeIn(before, id, untouched, write.orgId), shapeIn(after, id, untouched, write.orgId));
    for (const draft of drafts) (draft.after === null ? removed : written).push(draft);
  }

  const commands: EntityCommand[] = [];
  for (const draft of [...layers.created, ...layers.updated, ...written, ...removed, ...layers.deleted]) {
    const built = buildCommand({
      operation: draft.before === null ? 'create' : draft.after === null ? 'delete' : 'update',
      module: MODULE,
      table: draft.table,
      id: draft.id,
      org_id: write.orgId,
      before: draft.before,
      after: draft.after,
      timestamp: write.timestamp,
      groupKey: write.groupKey,
    });
    if (!built.ok) return { ok: false, findings: built.findings };
    commands.push(built.value);
  }
  return { ok: true, value: commands, warnings: [] };
}
