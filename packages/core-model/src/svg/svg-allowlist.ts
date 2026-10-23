/**
 * Lot 5 de l'audit (D-7) et E14.2 : ce qu'un SVG peut contenir.
 *
 * Trois sorts, et pas d'autre :
 *  - **gardé** : un élément ou un attribut de cette liste, valeur contrôlée ;
 *  - **retiré** : les métadonnées que E14.2 demande d'ôter (titre, description,
 *    métadonnées, éléments et attributs d'éditeur nommés par espace) ;
 *  - **refusé** : tout le reste. Le fichier entier est alors rejeté.
 *
 * Deux profils. `asset` pour un fichier reçu (logo, plan, visuel) ; `render`
 * pour ce que les moteurs produisent eux-mêmes, qui y ajoute l'animation
 * d'itinéraire (`animate`, `set`, restreints à trois propriétés), le titre
 * d'infobulle et les attributs `data-*`.
 */

export type SvgProfile = 'asset' | 'render';

const SHAPES = [
  'svg', 'g', 'defs', 'symbol', 'use', 'path', 'rect', 'circle', 'ellipse', 'line',
  'polyline', 'polygon', 'text', 'tspan', 'textPath', 'linearGradient', 'radialGradient',
  'stop', 'clipPath', 'mask', 'pattern', 'marker',
];

const ELEMENTS: Readonly<Record<SvgProfile, ReadonlySet<string>>> = {
  asset: new Set(SHAPES),
  render: new Set([...SHAPES, 'animate', 'set', 'title']),
};

/** Retirés avec leur contenu, sans refus (E14.2 : suppression des métadonnées). */
const STRIPPED_ELEMENTS: Readonly<Record<SvgProfile, ReadonlySet<string>>> = {
  asset: new Set(['metadata', 'title', 'desc']),
  render: new Set(['metadata', 'desc']),
};

/** Espaces de noms d'éditeurs vectoriels : éléments et attributs retirés. */
const EDITOR_PREFIXES = ['inkscape:', 'sodipodi:', 'sketch:', 'serif:', 'i:', 'x:', 'graph:', 'figma:'];

const PRESENTATION = [
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap',
  'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'opacity',
  'clip-path', 'clip-rule', 'mask', 'marker-start', 'marker-mid', 'marker-end', 'stop-color',
  'stop-opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
  'text-anchor', 'dominant-baseline', 'alignment-baseline', 'baseline-shift', 'letter-spacing',
  'word-spacing', 'text-decoration', 'visibility', 'display', 'color', 'vector-effect',
  'shape-rendering', 'paint-order',
];

/** Propriétés acceptées dans un attribut `style`, comme en attribut. */
export const STYLE_PROPERTIES: ReadonlySet<string> = new Set(PRESENTATION);

const GEOMETRY = [
  'id', 'class', 'xmlns', 'xmlns:xlink', 'xml:space', 'version', 'viewBox', 'preserveAspectRatio',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy', 'width', 'height', 'd',
  'points', 'transform', 'pathLength', 'markerWidth', 'markerHeight', 'refX', 'refY', 'orient',
  'markerUnits', 'patternUnits', 'patternContentUnits', 'patternTransform', 'gradientUnits',
  'gradientTransform', 'spreadMethod', 'offset', 'clipPathUnits', 'maskUnits', 'maskContentUnits',
  'dx', 'dy', 'rotate', 'textLength', 'lengthAdjust', 'startOffset', 'style', 'href', 'xlink:href',
];

const ANIMATION = ['attributeName', 'from', 'to', 'dur', 'begin', 'end', 'repeatCount', 'values', 'keyTimes', 'calcMode'];

const ATTRIBUTES: Readonly<Record<SvgProfile, ReadonlySet<string>>> = {
  asset: new Set([...GEOMETRY, ...PRESENTATION]),
  render: new Set([...GEOMETRY, ...PRESENTATION, ...ANIMATION]),
};

/** Les seules propriétés qu'une animation des moteurs peut viser : jamais un lien. */
export const ANIMATED_PROPERTIES: ReadonlySet<string> = new Set(['stroke-dashoffset', 'visibility', 'opacity']);

/** Attributs dont la valeur est un renvoi : seulement vers un élément du même document. */
export const REFERENCE_ATTRIBUTES: ReadonlySet<string> = new Set(['href', 'xlink:href']);

export type Verdict = 'keep' | 'strip' | 'refuse';

export function elementVerdict(profile: SvgProfile, name: string): Verdict {
  if (ELEMENTS[profile].has(name)) return 'keep';
  if (STRIPPED_ELEMENTS[profile].has(name)) return 'strip';
  if (EDITOR_PREFIXES.some(p => name.startsWith(p))) return 'strip';
  return 'refuse';
}

export function attributeVerdict(profile: SvgProfile, name: string): Verdict {
  if (ATTRIBUTES[profile].has(name)) return 'keep';
  if (profile === 'render' && /^data-[a-z0-9-]+$/.test(name)) return 'keep';
  if (EDITOR_PREFIXES.some(p => name.startsWith(p)) || name.startsWith('xmlns:')) return 'strip';
  if (name.startsWith('data-')) return 'strip';
  return 'refuse';
}
