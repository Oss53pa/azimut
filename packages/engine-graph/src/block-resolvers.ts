/**
 * K-Tier-A — les résolveurs des blocs dont le contenu tient dans le gabarit
 * (plan, légende, logo, consigne de sécurité). Partagés par la résolution
 * directe et par la lecture du tableau des messages ; sortis de
 * `resolve-face.ts` pour tenir la limite de taille des fichiers.
 */
import type { Pictogram } from '@azimut/core-model';
import type { LegendEntry, ResolvedContent } from './resolve-face.js';

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * A `map` block shows a pre-rendered plan. engine-graph does not render plans
 * (that is engine-layout's job, one layer up); the plan SVG is provided as a
 * sanitized `plan_svg` string in the block config, or null when none is
 * supplied yet. `caption` labels the frame.
 */
export function resolveMapContent(config: Record<string, unknown>): ResolvedContent {
  return {
    type: 'map',
    plan_svg: asStringOrNull(config['plan_svg']),
    caption: asString(config['caption'], ''),
  };
}

/**
 * A `legend` block lists symbol → meaning rows, declared in the template config
 * (E9.4). Each entry may carry a pictogram path and always a label.
 */
export function resolveLegendContent(config: Record<string, unknown>): ResolvedContent {
  const raw = config['entries'];
  const entries: LegendEntry[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item !== null && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        entries.push({
          symbol_path: asStringOrNull(rec['symbol_path']),
          label: asString(rec['label'], ''),
        });
      }
    }
  }
  return { type: 'legend', entries };
}

/**
 * A `logo` block embeds a sanitized inline SVG (`svg_markup`, per E14) provided
 * in the config; when none is supplied the `label` (defaulting to the org name)
 * is drawn instead. Never free-drawn — resolved from data (INV-2).
 */
export function resolveLogoContent(
  config: Record<string, unknown>,
  defaultLabel: string,
): ResolvedContent {
  return {
    type: 'logo',
    svg_markup: asStringOrNull(config['svg_markup']),
    label: asString(config['label'], defaultLabel),
  };
}

/**
 * An `emergency_info` block carries regulatory instruction text (held in data,
 * never in code — INV-5) and a safety-registry pictogram resolved read-only by
 * category (INV-3). The pictogram must belong to the `safety` registry.
 */
export function resolveEmergencyContent(
  config: Record<string, unknown>,
  pictograms: readonly Pictogram[],
): ResolvedContent {
  const catId = asStringOrNull(config['pictogram_category_id']);
  const picto =
    catId !== null
      ? pictograms.find((p) => p.registry === 'safety' && p.category_id === catId)
      : undefined;
  return {
    type: 'emergency_info',
    text: asString(config['text'], ''),
    svg_path: picto?.svg_path ?? null,
  };
}
