/**
 * E6.3 — Accessible names for the habillage layer.
 *
 * "Chaque objet expose un nom accessible construit depuis ses données
 * métier, jamais depuis sa forme." A decoration object carries no
 * business attribute (E9.2), so its name comes from its own label and
 * kind — never from its outline, its size, or its colour.
 */

import type { DecorationShape } from './scene-objects.js';

const KIND_LABELS: Readonly<Record<string, string>> = {
  area: 'Zone d’habillage',
  path: 'Tracé d’habillage',
  symbol: 'Symbole d’habillage',
  group: 'Groupe d’habillage',
};

/**
 * Accessible name of a decoration shape. A shape with no label falls
 * back to its kind and identifier, so the name stays stable and never
 * describes the geometry.
 */
export function decorationLabel(shape: DecorationShape): string {
  const kindLabel = KIND_LABELS[shape.kind] ?? 'Objet d’habillage';
  return shape.label === '' ? `${kindLabel} ${shape.id}` : `${kindLabel} ${shape.label}`;
}
