/**
 * E6.3 — Accessible names for the habillage layer.
 *
 * "Chaque objet expose un nom accessible construit depuis ses données
 * métier, jamais depuis sa forme." A decoration object carries no
 * business attribute (E9.2), so its name comes from its own label and
 * kind — never from its outline, its size, or its colour.
 */

import type { DecorationShape } from './scene-objects.js';
import type { Translate } from '../i18n/i18n-context.js';
import type { UiMessageKey } from '../i18n/messages.js';

const KIND_KEYS: Readonly<Record<string, UiMessageKey>> = {
  area: 'editor.decoration.area',
  path: 'editor.decoration.path',
  symbol: 'editor.decoration.symbol',
  group: 'editor.decoration.group',
};

/**
 * Accessible name of a decoration shape. A shape with no label falls
 * back to its kind and identifier, so the name stays stable and never
 * describes the geometry.
 */
export function decorationLabel(shape: DecorationShape, t: Translate): string {
  const key = KIND_KEYS[shape.kind];
  const kindLabel = key ? t(key) : t('editor.decoration.fallback');
  return shape.label === '' ? `${kindLabel} ${shape.id}` : `${kindLabel} ${shape.label}`;
}
