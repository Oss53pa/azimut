import { buildFileName, buildArchiveName, canonicalSerialize } from '@azimut/core-model';
import type { FileNameParts, Outcome, Finding } from '@azimut/core-model';

/**
 * D11 — Delivery archive assembler.
 *
 * A delivery groups the files produced for one site/building/level/version.
 * Each produced file is named by the deterministic D11 scheme
 * (`buildFileName`); the archive itself is named by the same scheme without the
 * per-support segments (`buildArchiveName`) and carries an index file that
 * echoes the quantitative — the inventory a manufacturer reads without the
 * software.
 *
 * The output is deterministic: entries are sorted by file name and the index is
 * canonically serialized. A name collision (two produced files resolving to the
 * same D11 name, e.g. after middle-truncation) is reported as
 * PACKAGE.DUPLICATE_PATH and fails the assembly.
 *
 * The index's quantitative comes from the single quantity engine
 * (`computeQuantities`), supplied by the caller as {@link DeliveryQuantities} —
 * it is never recomputed here (INV-1: no data duplicated for a rendering).
 */

/** One produced file to place in the delivery. */
export type DeliveryItem = {
  readonly parts: FileNameParts;
  readonly bytes: Uint8Array;
};

/** Per-support-type quantity (mirrors the quantity engine's TypeQuantity). */
export type DeliveryTypeQuantity = {
  readonly support_type_key: string;
  readonly support_type_name: string;
  readonly count: number;
  readonly face_count: number;
};

export type DeliveryBuildingQuantity = {
  readonly building_id: string;
  readonly building_name: string;
  readonly count: number;
};

export type DeliveryLevelQuantity = {
  readonly level_id: string;
  readonly level_name: string;
  readonly building_id: string;
  readonly count: number;
};

/**
 * The authoritative quantitative for a delivery, produced by the quantity
 * engine and passed in verbatim — structurally the serializable form of the
 * engine's QuantityReport.
 */
export type DeliveryQuantities = {
  readonly total_supports: number;
  readonly total_faces: number;
  readonly by_type: readonly DeliveryTypeQuantity[];
  readonly by_building: readonly DeliveryBuildingQuantity[];
  readonly by_level: readonly DeliveryLevelQuantity[];
  readonly cross_check_ok: boolean;
};

export type DeliveryArchiveInput = {
  readonly site_code: string;
  readonly building: string;
  readonly level: string;
  readonly version: number;
  /** Archive container extension, e.g. `zip`. */
  readonly extension: string;
  readonly items: readonly DeliveryItem[];
  /** Authoritative quantitative from the quantity engine (INV-1). */
  readonly quantities: DeliveryQuantities;
};

/** One line of the delivery index — a produced file and its identity. */
export type DeliveryIndexEntry = {
  readonly file_name: string;
  readonly type_code: string;
  readonly reference: string;
  readonly face: string;
  readonly version: number;
  readonly byte_size: number;
};

/**
 * The index a manufacturer reads: the archive's own file manifest (entries,
 * file_count, total_bytes) plus the authoritative quantitative from the quantity
 * engine (`quantities`) — echoed, not recomputed.
 */
export type DeliveryIndex = {
  readonly archive: string;
  readonly site_code: string;
  readonly building: string;
  readonly level: string;
  readonly version: number;
  readonly file_count: number;
  readonly total_bytes: number;
  readonly quantities: DeliveryQuantities;
  readonly entries: readonly DeliveryIndexEntry[];
};

export type DeliveryArchive = {
  readonly archive_name: string;
  readonly index_name: string;
  readonly index: DeliveryIndex;
  /** The archive contents: each produced file by name, plus the index file. */
  readonly files: ReadonlyMap<string, Uint8Array>;
};

const encoder = new TextEncoder();

function duplicate(name: string): Finding {
  return {
    code: 'PACKAGE.DUPLICATE_PATH',
    severity: 'blocking',
    entity: null,
    params: { path: name },
    ruleRef: null,
  };
}

export function assembleDeliveryArchive(
  input: DeliveryArchiveInput,
): Outcome<DeliveryArchive> {
  const archiveName = buildArchiveName({
    site_code: input.site_code,
    building: input.building,
    level: input.level,
    version: input.version,
    extension: input.extension,
  });
  const indexName = `${archiveName.replace(/\.[^.]*$/, '')}_INDEX.json`;

  // Name every item and detect collisions.
  const named = input.items.map((item) => ({
    name: buildFileName(item.parts),
    item,
  }));

  const findings: Finding[] = [];
  const seen = new Set<string>();
  for (const { name } of named) {
    if (seen.has(name)) {
      findings.push(duplicate(name));
    }
    seen.add(name);
  }
  if (findings.length > 0) {
    return { ok: false, findings };
  }

  // Deterministic order: by file name.
  const sorted = [...named].sort((a, b) => a.name.localeCompare(b.name));

  const entries: DeliveryIndexEntry[] = [];
  let totalBytes = 0;
  const files = new Map<string, Uint8Array>();

  for (const { name, item } of sorted) {
    files.set(name, item.bytes);
    totalBytes += item.bytes.length;
    entries.push({
      file_name: name,
      type_code: item.parts.type_code,
      reference: item.parts.reference,
      face: item.parts.face,
      version: item.parts.version,
      byte_size: item.bytes.length,
    });
  }

  const index: DeliveryIndex = {
    archive: archiveName,
    site_code: input.site_code,
    building: input.building,
    level: input.level,
    version: input.version,
    file_count: sorted.length,
    total_bytes: totalBytes,
    quantities: input.quantities,
    entries,
  };

  files.set(indexName, encoder.encode(canonicalSerialize(index)));

  return {
    ok: true,
    value: { archive_name: archiveName, index_name: indexName, index, files },
    warnings: [],
  };
}
