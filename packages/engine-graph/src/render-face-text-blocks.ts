/**
 * Rendu des blocs de texte d'une face : en-tête, liste de destinations,
 * pictogramme, flèche, texte libre — et les tailles de police que le contrôle
 * d'encombrement relit (source unique). Sortis de `render-face.ts`.
 */
import type { ResolvedContent } from './resolve-face.js';
import { esc, pickName, type FaceTheme } from './face-svg.js';

/**
 * Header font size (em, mm). Single source with the fit check: capped by the
 * block height (h·0.5) and width (w·0.06) so the renderer and the overflow
 * measurement agree on the size drawn.
 */
export function headerFontSizeMm(w: number, h: number): number {
  return Math.min(h * 0.5, w * 0.06);
}

export function renderHeader(
  content: Extract<ResolvedContent, { type: 'header' }>,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: FaceTheme,
  fontFamily: string,
): string {
  const fontSize = headerFontSizeMm(w, h);
  const cx = x + w / 2;
  const cy = y + h / 2 + fontSize * 0.35;
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}"` +
    ` fill="${esc(theme.accent)}" />\n` +
    `<text x="${cx}" y="${cy}" text-anchor="middle"` +
    ` font-family="${esc(fontFamily)}" font-size="${fontSize}"` +
    ` fill="${esc(theme.background)}">${esc(content.site_name)}</text>`
  );
}

const CARDINAL_ANGLES: Readonly<Record<string, number>> = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
};

function cardinalToAngle(direction: string): number {
  return CARDINAL_ANGLES[direction] ?? 0;
}

/**
 * The rendered font size (em), in millimetres, of the destination-list block —
 * the primary denomination text of a wayfinding face. Single source: the
 * renderer draws text at exactly this size and the legibility measurement reads
 * it back, so the two never drift (INV-4). The em size is not the cap height;
 * converting to cap/x-height needs the font's own metrics (partie G) and is
 * deliberately left to whoever consumes this against a normative factor.
 */
export function destinationListFontSizeMm(
  blockHeightMm: number,
  entryCount: number,
): number {
  if (entryCount <= 0) return 0;
  const lineHeight = Math.min(
    blockHeightMm / (entryCount + 0.5),
    blockHeightMm * 0.15,
  );
  return lineHeight * 0.6;
}

/**
 * M04.G3 — l'inverse du calcul ci-dessus : la hauteur de bloc minimale pour que le
 * texte y soit dessiné à au moins `fontSizeMm`.
 *
 * Écrit ici, contre la fonction qu'elle inverse, pour que les deux ne dérivent
 * pas. `destinationListFontSizeMm(h, n) = 0,6 × h × min(1/(n+0,5) ; 0,15)`, donc
 * la hauteur cherchée est `f / (0,6 × min(1/(n+0,5) ; 0,15))`. Aucune valeur
 * normative n'entre ici : `fontSizeMm` est la hauteur exigée, elle vient du
 * paquet de règles et jamais de ce fichier.
 */
export function destinationListBlockHeightMm(
  fontSizeMm: number,
  entryCount: number,
): number {
  if (entryCount <= 0 || fontSizeMm <= 0) return 0;
  const ratio = Math.min(1 / (entryCount + 0.5), 0.15);
  return fontSizeMm / (0.6 * ratio);
}

export function renderDestinationList(
  content: Extract<ResolvedContent, { type: 'destination_list' }>,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: FaceTheme,
  fontFamily: string,
  lang: string | undefined,
): string {
  const entries = content.entries;
  if (entries.length === 0) return '';

  // lineHeight keeps its original expression (byte-identical positioning); the
  // font size comes from the shared helper — the same `lineHeight * 0.6` value,
  // so no float round-trip drift and one source for the measured height.
  const lineHeight = Math.min(h / (entries.length + 0.5), h * 0.15);
  const fontSize = destinationListFontSizeMm(h, entries.length);
  const parts: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    const name = pickName(entry.names, lang);
    const ty = y + lineHeight * (i + 1);
    const dist =
      entry.distance_m !== null
        ? ` — ${Math.round(entry.distance_m)} m`
        : '';

    if (entry.direction) {
      const arrowSize = fontSize * 0.9;
      const arrowX = x + arrowSize * 0.5;
      const arrowY = ty - arrowSize * 0.35;
      const angle = cardinalToAngle(entry.direction);
      parts.push(
        `<g transform="translate(${arrowX},${arrowY}) rotate(${angle})">` +
        `<polygon points="0,${-arrowSize * 0.4} ${arrowSize * 0.25},${arrowSize * 0.2} ${-arrowSize * 0.25},${arrowSize * 0.2}"` +
        ` fill="${esc(theme.accent)}" /></g>`,
      );
    }

    const textX = entry.direction ? x + fontSize * 1.4 : x + fontSize * 0.5;
    parts.push(
      `<text x="${textX}" y="${ty}"` +
      ` font-family="${esc(fontFamily)}" font-size="${fontSize}"` +
      ` fill="${esc(theme.text_primary)}">${esc(name)}` +
      `<tspan fill="${esc(theme.text_secondary)}">${esc(dist)}</tspan></text>`,
    );
  }
  return parts.join('\n');
}

export function renderPictogram(
  content: Extract<ResolvedContent, { type: 'pictogram' }>,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: FaceTheme,
): string {
  if (!content.svg_path) {
    return (
      `<rect x="${x}" y="${y}" width="${w}" height="${h}"` +
      ` fill="none" stroke="${esc(theme.border)}" stroke-dasharray="2" />`
    );
  }
  const size = Math.min(w, h) * 0.8;
  const tx = x + (w - size) / 2;
  const ty = y + (h - size) / 2;
  return (
    `<g transform="translate(${tx},${ty}) scale(${size / 30})">\n` +
    `<path d="${esc(content.svg_path)}" fill="${esc(theme.text_primary)}" />\n</g>`
  );
}

export function renderArrow(
  content: Extract<ResolvedContent, { type: 'arrow' }>,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: FaceTheme,
): string {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const size = Math.min(w, h) * 0.4;
  const dir = content.direction;
  let rotation = 0;
  if (dir === 'right') rotation = 0;
  else if (dir === 'left') rotation = 180;
  else if (dir === 'up') rotation = -90;
  else if (dir === 'down') rotation = 90;
  else if (dir === 'forward') rotation = 0;

  return (
    `<g transform="translate(${cx},${cy}) rotate(${rotation})">\n` +
    `<polygon points="${-size},${size * 0.4} ${size},0 ${-size},${-size * 0.4}"` +
    ` fill="${esc(theme.accent)}" />\n</g>`
  );
}

export function renderFreeText(
  content: Extract<ResolvedContent, { type: 'free_text' }>,
  x: number,
  y: number,
  _w: number,
  h: number,
  theme: FaceTheme,
  fontFamily: string,
  lang: string | undefined,
): string {
  const fontSize = Math.min(h * 0.4, 8);
  const ty = y + h / 2 + fontSize * 0.35;
  // D8.3 — un texte saisi sur la face se lit dans la langue active, comme un
  // nom de destination ; à défaut, le texte du gabarit.
  const text = content.texts !== undefined && Object.keys(content.texts).length > 0
    ? pickName(content.texts, lang)
    : content.text;
  return (
    `<text x="${x + 2}" y="${ty}"` +
    ` font-family="${esc(fontFamily)}" font-size="${fontSize}"` +
    ` fill="${esc(theme.text_primary)}">${esc(text)}</text>`
  );
}
