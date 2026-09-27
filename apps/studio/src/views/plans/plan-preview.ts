/**
 * Thèmes des aperçus de plans dans le studio.
 *
 * Comme l'aperçu de face (`signage/face-preview.ts`), un aperçu de plan est
 * rendu par le moteur dans les jetons de l'interface : ce n'est pas le plan
 * émis. Le plan livré prend ses couleurs de la charte du site et, pour tout ce
 * qui relève de l'évacuation, du registre de sécurité (INV-3) ; le compilateur
 * les lui fournit. L'accent marque ce que le moteur a calculé — le
 * cheminement et le repère « vous êtes ici » (M7.10 de la partie M).
 */
import type { EvacuationTheme, OrientedPlanTheme } from '@azimut/engine-layout';

export const PLAN_PREVIEW_FONT_FAMILY = 'system-ui, sans-serif';

export const ORIENTED_PLAN_PREVIEW_THEME: OrientedPlanTheme = {
  background: 'var(--surface-panel)',
  footprint_fill: 'var(--surface-sunken)',
  footprint_stroke: 'var(--border-strong)',
  edge_stroke: 'var(--border-interactive)',
  edge_evacuation_stroke: 'var(--text-secondary)',
  node_fill: 'var(--surface-panel)',
  node_stroke: 'var(--text-secondary)',
  node_safety_fill: 'var(--text-secondary)',
  text_primary: 'var(--text-primary)',
  text_secondary: 'var(--text-secondary)',
  marker_fill: 'var(--accent)',
  marker_stroke: 'var(--accent)',
};

export const EVACUATION_PREVIEW_THEME: EvacuationTheme = {
  background: 'var(--surface-panel)',
  footprint_fill: 'var(--surface-sunken)',
  footprint_stroke: 'var(--border-strong)',
  route_stroke: 'var(--accent)',
  route_arrow: 'var(--accent)',
  non_route_stroke: 'var(--border-hairline)',
  exit_fill: 'var(--text-primary)',
  exit_stroke: 'var(--text-primary)',
  assembly_fill: 'var(--surface-panel)',
  assembly_stroke: 'var(--text-primary)',
  node_fill: 'var(--surface-panel)',
  node_stroke: 'var(--text-secondary)',
  text_primary: 'var(--text-primary)',
  text_secondary: 'var(--text-secondary)',
  marker_fill: 'var(--accent)',
  marker_stroke: 'var(--accent)',
};
