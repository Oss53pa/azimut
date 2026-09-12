import type { SiteData, TravelProfile, FaceTemplate } from '@azimut/core-model';
import { resolveFaceContent } from './resolve-face.js';
import { computeContentHash } from './compute-hashes.js';

/**
 * D7.3 — Staleness engine.
 *
 * Given the content hashes recorded when a set of faces were last compiled, and
 * the current site, decide exactly which faces are stale. A face is stale when
 * its recomputed content_hash differs from the recorded one — or when its
 * content can no longer be resolved (it changed to unresolvable). This is the
 * mechanism behind the operating promise: a destination change marks exactly
 * the faces that mention it, never more, never fewer.
 *
 * The comparison is pure hash equality; the strictness of D7.1's content_hash
 * composition is what makes the stale set exact.
 */
export type FaceHashDescriptor = {
  /** Opaque identifier of the face (e.g. support id + side). */
  readonly id: string;
  readonly node_id: string;
  readonly template: FaceTemplate;
  readonly profile: TravelProfile;
  readonly charter_id: string | null;
  readonly charter_version: string | null;
  readonly rules_pack_id: string | null;
  readonly rules_pack_version: string | null;
  readonly active_langs: readonly string[];
  readonly dimensions: { readonly width_mm: number; readonly height_mm: number };
  /** content_hash recorded at the last compilation of this face. */
  readonly previous_content_hash: string;
};

export type FaceStaleness = {
  readonly id: string;
  readonly previous_content_hash: string;
  /** Recomputed hash, or null when the face no longer resolves. */
  readonly current_content_hash: string | null;
  readonly stale: boolean;
};

export type StalenessReport = {
  readonly faces: readonly FaceStaleness[];
  readonly stale_ids: readonly string[];
  readonly stale_count: number;
};

export function computeStaleFaces(
  site: SiteData,
  faces: readonly FaceHashDescriptor[],
): StalenessReport {
  const results: FaceStaleness[] = [];
  const staleIds: string[] = [];

  for (const face of faces) {
    const resolved = resolveFaceContent(
      site,
      face.template,
      face.node_id,
      face.profile,
    );

    let current: string | null;
    let stale: boolean;
    if (resolved.ok) {
      current = computeContentHash({
        resolved: resolved.value,
        template: face.template,
        charter_id: face.charter_id,
        charter_version: face.charter_version,
        rules_pack_id: face.rules_pack_id,
        rules_pack_version: face.rules_pack_version,
        active_langs: face.active_langs,
        dimensions: face.dimensions,
      });
      stale = current !== face.previous_content_hash;
    } else {
      // The face no longer resolves — its content has effectively changed.
      current = null;
      stale = true;
    }

    results.push({
      id: face.id,
      previous_content_hash: face.previous_content_hash,
      current_content_hash: current,
      stale,
    });
    if (stale) staleIds.push(face.id);
  }

  return { faces: results, stale_ids: staleIds, stale_count: staleIds.length };
}
