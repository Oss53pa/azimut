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
