import type { BoundRulesPacks, Outcome, Finding, SiteRulesBinding } from '@azimut/core-model';
import { boundPackId } from '@azimut/core-model';
import type { LoadedRulesPack } from './rule-resolution.js';
import { mergeCountryOverlay } from './overlay.js';

/**
 * The rules-pack corpus, keyed by the identifier a site binds to
 * (A5.8 `site_rules_binding.rules_pack_id`).
 */
export type RulesPackIndex = ReadonlyMap<string, LoadedRulesPack>;

/** One corpus entry: the bound id and the directory that holds the pack. */
export type RulesPackSource = {
  /** The id a site binds to — matches `site_rules_binding.rules_pack_id` / `rules_pack.id`. */
  readonly id: string;
  /** Directory under `rules-packs/` holding the manifest and rule files. */
  readonly directory: string;
};

function packNotBound(rulesPackId: string | null): Finding {
  return {
    code: 'RULES.PACK_NOT_BOUND',
    severity: 'blocking',
    entity: null,
    params: rulesPackId === null ? {} : { rules_pack_id: rulesPackId },
    ruleRef: null,
  };
}

/**
 * Le paquet en vigueur pour un site, depuis ses rattachements — A5.8 et D3.6.
 *
 * « Cette table fait foi pour le rattachement d'un site à ses paquets. Un site
 * porte au plus un socle et au plus une surcouche pays. Précédence, pour une
 * règle : la surcouche l'emporte sur le socle. » D3.6 précise comment : la
 * règle pays ne prime que si elle durcit, et `mergeCountryOverlay` le tient.
 *
 * - Aucun rattachement : `RULES.PACK_NOT_BOUND`, sans paramètre.
 * - Un paquet rattaché mais absent du corpus : `RULES.PACK_NOT_BOUND`, qui le
 *   nomme. Le site ne se compose pas sur la moitié de ses règles.
 * - Un socle seul : le socle.
 * - Un socle et une surcouche : leur fusion, refusée si la surcouche assouplit.
 * - Une surcouche seule : la surcouche. A5.8 admet le cas ; sans socle, D3.6
 *   n'a rien à comparer et chacune de ses règles est additive, ce que la
 *   fusion avec un socle vide donnerait de toute façon.
 *
 * Le résolveur ne lit ni le disque ni la base : l'index vient de la racine de
 * composition, qui choisit sa source (D3.4.3, D3.4.4).
 */
/** Le socle et la surcouche d'un site, lus dans l'index, ou le refus qui les nomme. */
function boundPacks(
  bindings: readonly SiteRulesBinding[],
  index: RulesPackIndex,
): Outcome<{ readonly base?: LoadedRulesPack; readonly overlay?: LoadedRulesPack }> {
  const baseId = boundPackId(bindings, 'base');
  const overlayId = boundPackId(bindings, 'overlay');
  if (baseId === null && overlayId === null) {
    return { ok: false, findings: [packNotBound(null)] };
  }

  const missing = [baseId, overlayId]
    .filter((id): id is string => id !== null && !index.has(id));
  if (missing.length > 0) {
    return { ok: false, findings: missing.map(id => packNotBound(id)) };
  }

  const base = baseId === null ? undefined : index.get(baseId);
  const overlay = overlayId === null ? undefined : index.get(overlayId);
  return {
    ok: true,
    value: { ...(base === undefined ? {} : { base }), ...(overlay === undefined ? {} : { overlay }) },
    warnings: [],
  };
}

export function resolveSiteRulesPack(
  bindings: readonly SiteRulesBinding[],
  index: RulesPackIndex,
): Outcome<LoadedRulesPack> {
  const bound = boundPacks(bindings, index);
  if (!bound.ok) return bound;
  const { base, overlay } = bound.value;
  if (base !== undefined && overlay !== undefined) return mergeCountryOverlay(base, overlay);
  const only = base ?? overlay;
  return only === undefined
    ? { ok: false, findings: [packNotBound(null)] }
    : { ok: true, value: only, warnings: [] };
}

/**
 * Les paquets d'un site tels que l'empreinte de contenu les porte — D7.1.
 *
 * « Les deux rattachements entrent dans l'empreinte, et non le seul résultat
 * de leur fusion. » `mergeCountryOverlay` garde la clé et la version du socle :
 * lire l'identité du paquet fusionné ferait perdre la surcouche. Cette
 * fonction lit donc chaque rattachement pour lui-même, sans fusionner, et
 * refuse dans les mêmes cas que `resolveSiteRulesPack` : annexe T, §8, un site
 * sans paquet n'a pas d'empreinte.
 */
export function boundRulesPackIdentities(
  bindings: readonly SiteRulesBinding[],
  index: RulesPackIndex,
): Outcome<BoundRulesPacks> {
  const bound = boundPacks(bindings, index);
  if (!bound.ok) return bound;
  const { base, overlay } = bound.value;
  return {
    ok: true,
    value: {
      ...(base === undefined ? {} : { base: { key: base.key, version: base.version } }),
      ...(overlay === undefined ? {} : { overlay: { key: overlay.key, version: overlay.version } }),
    },
    warnings: [],
  };
}
