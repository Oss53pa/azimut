import type { UiMessageKey } from '../../i18n/messages.js';
import type { ArticleAxis } from './articles.js';

/** L'objet de chaque article, par axe du règlement. */
export const AXIS_KEYS: Readonly<Record<ArticleAxis, UiMessageKey>> = {
  height: 'tenant.axis.height',
  overhang: 'tenant.axis.overhang',
  material: 'tenant.axis.material',
  lighting: 'tenant.axis.lighting',
  forbidden_feature: 'tenant.axis.forbidden',
};

const PART_KEYS: Readonly<Record<string, UiMessageKey>> = {
  elevation: 'tenant.part.elevation',
  section: 'tenant.part.section',
  material_samples: 'tenant.part.samples',
};

/**
 * La clé de libellé d'une pièce de dossier, ou `null` : une pièce que
 * l'interface ne connaît pas s'affiche telle quelle, elle ne prend pas le nom
 * d'une autre.
 */
export function partKey(key: string): UiMessageKey | null {
  return PART_KEYS[key] ?? null;
}
