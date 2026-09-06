/**
 * E7.3 — Alignment and distribution operations.
 *
 * All operations take a set of bounding boxes and return
 * computed positions. They never mutate geometry directly —
 * the caller applies the results via Command (E5).
 */

// ---------------------------------------------------------------------------
// Bounding box for alignment
// ---------------------------------------------------------------------------

export type AlignableBounds = {
  readonly id: string;
  readonly minX_m: number;
  readonly minY_m: number;
  readonly maxX_m: number;
  readonly maxY_m: number;
};

export type AlignmentResult = {
  readonly id: string;
  readonly dx_m: number;
  readonly dy_m: number;
};

// ---------------------------------------------------------------------------
// Alignment operations
// ---------------------------------------------------------------------------

export type AlignAxis = 'left' | 'center_h' | 'right' | 'top' | 'center_v' | 'bottom';

/**
 * Compute deltas to align items along an axis.
 * Items align to the extremum of the selection in the given direction.
 */
export function computeAlignment(
  items: readonly AlignableBounds[],
  axis: AlignAxis,
): readonly AlignmentResult[] {
  if (items.length < 2) return [];

  let target: number;

  switch (axis) {
    case 'left':
      target = Math.min(...items.map(i => i.minX_m));
      return items.map(i => ({ id: i.id, dx_m: target - i.minX_m, dy_m: 0 }));
    case 'right':
      target = Math.max(...items.map(i => i.maxX_m));
      return items.map(i => ({ id: i.id, dx_m: target - i.maxX_m, dy_m: 0 }));
    case 'center_h':
      target = items.reduce((s, i) => s + (i.minX_m + i.maxX_m) / 2, 0) / items.length;
      return items.map(i => ({ id: i.id, dx_m: target - (i.minX_m + i.maxX_m) / 2, dy_m: 0 }));
    case 'top':
      target = Math.max(...items.map(i => i.maxY_m));
      return items.map(i => ({ id: i.id, dx_m: 0, dy_m: target - i.maxY_m }));
    case 'bottom':
      target = Math.min(...items.map(i => i.minY_m));
      return items.map(i => ({ id: i.id, dx_m: 0, dy_m: target - i.minY_m }));
    case 'center_v':
      target = items.reduce((s, i) => s + (i.minY_m + i.maxY_m) / 2, 0) / items.length;
      return items.map(i => ({ id: i.id, dx_m: 0, dy_m: target - (i.minY_m + i.maxY_m) / 2 }));
  }
}

// ---------------------------------------------------------------------------
// Distribution operations
// ---------------------------------------------------------------------------

export type DistributeAxis = 'horizontal' | 'vertical';

/**
 * Distribute items evenly along an axis.
 * The first and last items (by position) stay fixed; intermediate
 * items are spaced equally between them.
 */
export function computeDistribution(
  items: readonly AlignableBounds[],
  axis: DistributeAxis,
): readonly AlignmentResult[] {
  if (items.length < 3) return [];

  const sorted = [...items].sort((a, b) => {
    if (axis === 'horizontal') {
      const ca = (a.minX_m + a.maxX_m) / 2;
      const cb = (b.minX_m + b.maxX_m) / 2;
      return ca - cb || a.id.localeCompare(b.id);
    }
    const ca = (a.minY_m + a.maxY_m) / 2;
    const cb = (b.minY_m + b.maxY_m) / 2;
    return ca - cb || a.id.localeCompare(b.id);
  });

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === undefined || last === undefined) return [];
  const count = sorted.length;

  if (axis === 'horizontal') {
    const firstCenter = (first.minX_m + first.maxX_m) / 2;
    const lastCenter = (last.minX_m + last.maxX_m) / 2;
    const step = (lastCenter - firstCenter) / (count - 1);

    return sorted.map((item, idx) => {
      const currentCenter = (item.minX_m + item.maxX_m) / 2;
      const targetCenter = firstCenter + step * idx;
      return { id: item.id, dx_m: targetCenter - currentCenter, dy_m: 0 };
    });
  }

  const firstCenter = (first.minY_m + first.maxY_m) / 2;
  const lastCenter = (last.minY_m + last.maxY_m) / 2;
  const step = (lastCenter - firstCenter) / (count - 1);

  return sorted.map((item, idx) => {
    const currentCenter = (item.minY_m + item.maxY_m) / 2;
    const targetCenter = firstCenter + step * idx;
    return { id: item.id, dx_m: 0, dy_m: targetCenter - currentCenter };
  });
}

// ---------------------------------------------------------------------------
// Z-order operations (E7.3)
// ---------------------------------------------------------------------------

export type ZOrderOp = 'bring_front' | 'send_back' | 'bring_forward' | 'send_backward';

/**
 * Compute new draw order for z-order operations.
 *
 * @param allIds - All object ids in current draw order (index 0 = backmost).
 * @param selectedIds - Ids to move.
 * @param op - Which z-order operation.
 * @returns New ordered list of all ids.
 */
export function computeZOrder(
  allIds: readonly string[],
  selectedIds: readonly string[],
  op: ZOrderOp,
): readonly string[] {
  const selectedSet = new Set(selectedIds);
  const others = allIds.filter(id => !selectedSet.has(id));
  const selected = allIds.filter(id => selectedSet.has(id));

  if (selected.length === 0) return allIds;

  switch (op) {
    case 'bring_front':
      return [...others, ...selected];
    case 'send_back':
      return [...selected, ...others];
    case 'bring_forward': {
      // Move each selected item one position forward
      const result = [...allIds];
      for (let i = result.length - 2; i >= 0; i--) {
        const cur = result[i];
        const next = result[i + 1];
        if (cur !== undefined && next !== undefined && selectedSet.has(cur) && !selectedSet.has(next)) {
          result[i] = next;
          result[i + 1] = cur;
        }
      }
      return result;
    }
    case 'send_backward': {
      const result = [...allIds];
      for (let i = 1; i < result.length; i++) {
        const cur = result[i];
        const prev = result[i - 1];
        if (cur !== undefined && prev !== undefined && selectedSet.has(cur) && !selectedSet.has(prev)) {
          result[i] = prev;
          result[i - 1] = cur;
        }
      }
      return result;
    }
  }
}
