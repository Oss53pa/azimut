import type {
  BoundRulesPacks, FaceTemplate, Finding, Outcome, SiteData, TravelProfile,
} from '@azimut/core-model';
import { computeFaceContentHash } from '@azimut/core-model';
import { resolveFaceContent } from './resolve-face.js';
import type { ResolvedFace } from './resolve-face.js';

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
 * D7.2 — the hash is the single one, `computeFaceContentHash` from core-model.
 * This module only maps a resolved face into its input.
 */

/** What, besides the resolved content, enters a face's content_hash (T-2.14a §3.1). */
export type FaceHashContext = {
  /** The template's version; its key is the template id. */
  readonly template_version: string;
  readonly charter?: { readonly id: string; readonly version: string };
  /** D7.1 — base and overlay, each with its key and version. */
  readonly rules_packs: BoundRulesPacks;
  readonly active_langs: readonly string[];
  readonly dimensions: { readonly width_mm: number; readonly height_mm: number };
  readonly pictogram_ids: readonly string[];
};

/**
 * The content_hash of a resolved face, through the single implementation.
 * Refuses as it does: no bound pack, invalid dimensions, unserializable content.
 */
export function resolvedFaceContentHash(
  resolved: ResolvedFace,
  template: FaceTemplate,
  context: FaceHashContext,
): Outcome<string> {
  return computeFaceContentHash({
    blocks: resolved.blocks.map(block => block.content),
    template: { key: template.id, version: context.template_version },
    ...(context.charter === undefined ? {} : { charter: context.charter }),
    rules_packs: context.rules_packs,
    active_langs: context.active_langs,
    width_mm: context.dimensions.width_mm,
    height_mm: context.dimensions.height_mm,
    pictogram_ids: context.pictogram_ids,
  });
}

export type FaceHashDescriptor = FaceHashContext & {
  /** Opaque identifier of the face (e.g. support id + side). */
  readonly id: string;
  readonly node_id: string;
  readonly template: FaceTemplate;
  readonly profile: TravelProfile;
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

/**
 * The stale faces of a site, or a refusal.
 *
 * A face whose content no longer resolves is stale: its content changed. A
 * face whose hash cannot be computed is not: nothing can be said of it, and
 * D7.2 forbids a partial empreinte. The report is then refused, each refusal
 * naming its face (A7).
 */
export function computeStaleFaces(
  site: SiteData,
  faces: readonly FaceHashDescriptor[],
): Outcome<StalenessReport> {
  const results: FaceStaleness[] = [];
  const staleIds: string[] = [];
  const refusals: Finding[] = [];

  for (const face of faces) {
    const resolved = resolveFaceContent(site, face.template, face.node_id, face.profile);
    let current: string | null = null;
    if (resolved.ok) {
      const hash = resolvedFaceContentHash(resolved.value, face.template, face);
      if (!hash.ok) {
        refusals.push(...hash.findings.map(f => ({
          ...f, entity: { kind: 'support_face', id: face.id },
        })));
        continue;
      }
      current = hash.value;
    }
    const stale = current === null || current !== face.previous_content_hash;
    results.push({
      id: face.id,
      previous_content_hash: face.previous_content_hash,
      current_content_hash: current,
      stale,
    });
    if (stale) staleIds.push(face.id);
  }

  if (refusals.length > 0) return { ok: false, findings: refusals };
  return {
    ok: true,
    value: { faces: results, stale_ids: staleIds, stale_count: staleIds.length },
    warnings: [],
  };
}
