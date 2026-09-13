import type { SiteData, Support, Finding } from '@azimut/core-model';
import type { LoadedRulesPack, RulesPackIndex } from '@azimut/engine-graph';
import { resolveSiteRulesPack } from '@azimut/engine-graph';

/**
 * The rules pack in effect for a site, resolved once per render batch. An
 * explicit pack wins; otherwise the site's binding (A5.8 `Site.rules_pack_id`)
 * is resolved through the supplied corpus index. Resolution findings
 * (RULES.PACK_NOT_BOUND) are returned, never thrown — a missing pack skips the
 * quality checks, it does not stop artwork production. Shared by the single-face
 * and delivery-archive handlers so both bind a pack the same way.
 */
export function resolveEffectivePack(
  site: SiteData,
  explicit: LoadedRulesPack | undefined,
  index: RulesPackIndex | undefined,
): { readonly pack: LoadedRulesPack | undefined; readonly findings: readonly Finding[] } {
  if (explicit !== undefined) return { pack: explicit, findings: [] };
  if (index === undefined) return { pack: undefined, findings: [] };
  const resolved = resolveSiteRulesPack(site.site.rules_pack_id, index);
  return resolved.ok
    ? { pack: resolved.value, findings: [] }
    : { pack: undefined, findings: resolved.findings };
}

/**
 * The support-instance attributes (A5.6) that scope the quality checks, as a
 * partial to spread into an artwork render call. Empty when the support is
 * undefined, so the render falls back to its own defaults (wayfinding, no
 * legibility check). Takes the already-resolved support so the caller scans the
 * support list once.
 */
export function supportRenderParams(
  support: Support | undefined,
): {
  readonly supportRegistry?: string;
  readonly supportContext?: string;
  readonly readingDistanceM?: number;
  readonly overrideWidthMm?: number;
  readonly overrideHeightMm?: number;
} {
  if (support === undefined) return {};
  return {
    supportRegistry: support.registry,
    supportContext: support.context,
    readingDistanceM: support.reading_distance_m,
    ...(support.width_mm !== undefined ? { overrideWidthMm: support.width_mm } : {}),
    ...(support.height_mm !== undefined ? { overrideHeightMm: support.height_mm } : {}),
  };
}
