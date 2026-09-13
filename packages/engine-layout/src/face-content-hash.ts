import { empreinte } from '@azimut/core-model';
import type { Finding, Outcome } from '@azimut/core-model';

/**
 * T-2.14a §3 — Content empreinte of a resolved face.
 *
 * Exactly seven elements go into the hash (§3.1): the resolved content block by
 * block in order, the template key and version, the charter id and version, the
 * rules-pack key and version, the active languages (sorted), the computed
 * dimensions in whole millimetres, and the referenced pictogram ids (sorted).
 *
 * Everything else is excluded (§3.2): support and face ids, any timestamp,
 * author/reviewer ids, the version number, the artwork path, the version state,
 * and the placement inputs (render order, azimuth, reading distance) — these
 * only influence the computed dimensions, which are already in the hash.
 *
 * The input is self-contained on purpose: engine-layout must not depend on
 * engine-graph, so the caller maps a resolved face into this shape (one entry
 * per block, in block order, carrying that block's resolved content as plain
 * data).
 */
export type FaceContentHashInput = {
  /** Resolved content of each block, in block order (§3.1.1). */
  readonly blocks: readonly unknown[];
  /** Template key and version (§3.1.2). */
  readonly template_key: string;
  readonly template_version: string;
  /** Charter id and version (§3.1.3); omitted from the hash when absent. */
  readonly charter_id?: string;
  readonly charter_version?: string;
  /** Rules-pack key and version (§3.1.4); absence is a blocking anomaly (§8). */
  readonly rules_pack_key?: string;
  readonly rules_pack_version?: string;
  /** Active languages of the face (§3.1.5); sorted here. */
  readonly active_langs: readonly string[];
  /** Computed dimensions in whole millimetres (§3.1.6); null/≤0 is an error (§8). */
  readonly width_mm: number | null;
  readonly height_mm: number | null;
  /** Referenced pictogram ids (§3.1.7); sorted here. */
  readonly pictogram_ids: readonly string[];
};

function blocking(code: string, params: Record<string, string | number>): Finding {
  return { code, severity: 'blocking', entity: null, params, ruleRef: null };
}

function validDimension(value: number | null): boolean {
  return value !== null && Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

/**
 * Compute the content empreinte of a face, or a blocking finding when it cannot
 * be computed. Refuses (no hash) when the rules pack is absent (§8) or when a
 * computed dimension is null, non-integer, zero or negative (§8) — refusing is
 * the correct behaviour, an empreinte on incomplete data would be worse than
 * none.
 */
export function computeFaceContentHash(
  input: FaceContentHashInput,
): Outcome<string> {
  if (input.rules_pack_key === undefined || input.rules_pack_key === '') {
    return { ok: false, findings: [blocking('RULES.PACK_NOT_BOUND', {})] };
  }
  if (!validDimension(input.width_mm) || !validDimension(input.height_mm)) {
    return {
      ok: false,
      findings: [blocking('DATA.FACE_DIMENSIONS_INVALID', {
        width_mm: input.width_mm ?? 'null',
        height_mm: input.height_mm ?? 'null',
      })],
    };
  }

  // The object carries only the seven §3.1 elements. `empreinte` omits any
  // absent field (charter), so a face with no charter and a face whose charter
  // fields are absent hash identically (§4.3 / §5). Unordered sets are sorted;
  // block order is preserved.
  const value = {
    blocks: input.blocks,
    template: { key: input.template_key, version: input.template_version },
    charter: input.charter_id !== undefined
      ? { id: input.charter_id, version: input.charter_version }
      : undefined,
    rules_pack: { key: input.rules_pack_key, version: input.rules_pack_version },
    langs: [...input.active_langs].sort(),
    dimensions: { width_mm: input.width_mm, height_mm: input.height_mm },
    pictograms: [...input.pictogram_ids].sort(),
  };

  return { ok: true, value: empreinte(value), warnings: [] };
}
