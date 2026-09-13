import type { ResolvedFace, ResolvedBlock, ResolvedContent } from './resolve-face.js';

export type FaceTheme = {
  readonly background: string;
  readonly text_primary: string;
  readonly text_secondary: string;
  readonly accent: string;
  readonly border: string;
};

export type RenderFaceOptions = {
  readonly width_mm: number;
  readonly height_mm: number;
  readonly theme: FaceTheme;
  readonly font_family: string;
  /**
   * D12 — active language to render destination names in. When omitted, the
   * first available variant is used (deterministic by resolution order),
   * preserving the previous behavior. When set, the named variant is used,
   * falling back to the first available one if that language is missing.
   */
  readonly lang?: string;
};

/**
 * D12 — pick the destination name for the active language, falling back
 * deterministically to the first available variant when the language is
 * absent (a missing variant is reported separately as LAYOUT.LANG_VARIANT_MISSING).
 */
function pickName(
  names: Readonly<Record<string, string>>,
  lang: string | undefined,
): string {
  if (lang !== undefined && names[lang] !== undefined) return names[lang];
  const firstKey = Object.keys(names)[0];
  return firstKey !== undefined ? (names[firstKey] as string) : '';
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHeader(
  content: Extract<ResolvedContent, { type: 'header' }>,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: FaceTheme,
  fontFamily: string,
): string {
  const fontSize = Math.min(h * 0.5, w * 0.06);
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

function renderDestinationList(
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

function renderPictogram(
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

function renderArrow(
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

function renderFreeText(
  content: Extract<ResolvedContent, { type: 'free_text' }>,
  x: number,
  y: number,
  _w: number,
  h: number,
  theme: FaceTheme,
  fontFamily: string,
): string {
  const fontSize = Math.min(h * 0.4, 8);
  const ty = y + h / 2 + fontSize * 0.35;
  return (
    `<text x="${x + 2}" y="${ty}"` +
    ` font-family="${esc(fontFamily)}" font-size="${fontSize}"` +
    ` fill="${esc(theme.text_primary)}">${esc(content.text)}</text>`
  );
}

/**
 * Embed a sanitized inline SVG asset (E14) into a block region as a nested
 * `<svg>` viewport. The markup is trusted as already sanitized by the import
 * layer and is embedded verbatim, which keeps the output deterministic.
 */
function embedSvg(markup: string, x: number, y: number, w: number, h: number): string {
  return (
    `<svg x="${x}" y="${y}" width="${w}" height="${h}">\n` +
    `${markup}\n` +
    `</svg>`
  );
}

function centeredLabel(
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  fontFamily: string,
): string {
  if (label === '') return '';
  const fontSize = Math.min(h * 0.3, 6);
  return (
    `<text x="${x + w / 2}" y="${y + h / 2 + fontSize * 0.35}"` +
    ` text-anchor="middle" font-family="${esc(fontFamily)}"` +
    ` font-size="${fontSize}" fill="${esc(fill)}">${esc(label)}</text>`
  );
}

function renderLogo(
  content: Extract<ResolvedContent, { type: 'logo' }>,
  x: number, y: number, w: number, h: number,
  theme: FaceTheme, fontFamily: string,
): string {
  if (content.svg_markup !== null) return embedSvg(content.svg_markup, x, y, w, h);
  return centeredLabel(content.label, x, y, w, h, theme.text_secondary, fontFamily);
}

function renderMap(
  content: Extract<ResolvedContent, { type: 'map' }>,
  x: number, y: number, w: number, h: number,
  theme: FaceTheme, fontFamily: string,
): string {
  const frame =
    `<rect x="${x}" y="${y}" width="${w}" height="${h}"` +
    ` fill="none" stroke="${esc(theme.border)}" />`;
  if (content.plan_svg !== null) return `${frame}\n${embedSvg(content.plan_svg, x, y, w, h)}`;
  return `${frame}\n${centeredLabel(content.caption, x, y, w, h, theme.text_secondary, fontFamily)}`;
}

function renderLegend(
  content: Extract<ResolvedContent, { type: 'legend' }>,
  x: number, y: number, w: number, h: number,
  theme: FaceTheme, fontFamily: string,
): string {
  const entries = content.entries;
  if (entries.length === 0) return '';
  const lineHeight = Math.min(h / (entries.length + 0.5), h * 0.15);
  const fontSize = lineHeight * 0.6;
  const parts: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    const rowY = y + lineHeight * (i + 0.5);
    const symbolSize = fontSize;
    if (entry.symbol_path !== null) {
      parts.push(
        `<g transform="translate(${x},${rowY - symbolSize}) scale(${symbolSize / 30})">` +
        `<path d="${esc(entry.symbol_path)}" fill="${esc(theme.text_primary)}" /></g>`,
      );
    } else {
      parts.push(
        `<rect x="${x}" y="${rowY - symbolSize}" width="${symbolSize}" height="${symbolSize}"` +
        ` fill="${esc(theme.accent)}" />`,
      );
    }
    parts.push(
      `<text x="${x + symbolSize * 1.4}" y="${rowY - symbolSize * 0.1}"` +
      ` font-family="${esc(fontFamily)}" font-size="${fontSize}"` +
      ` fill="${esc(theme.text_primary)}">${esc(entry.label)}</text>`,
    );
  }
  return parts.join('\n');
}

function renderEmergency(
  content: Extract<ResolvedContent, { type: 'emergency_info' }>,
  x: number, y: number, w: number, h: number,
  theme: FaceTheme, fontFamily: string,
): string {
  const parts: string[] = [];
  const hasPicto = content.svg_path !== null;
  const pictoSize = Math.min(h * 0.8, w * 0.3);
  if (hasPicto) {
    const px = x + pictoSize * 0.1;
    const py = y + (h - pictoSize) / 2;
    parts.push(
      `<g transform="translate(${px},${py}) scale(${pictoSize / 30})">` +
      `<path d="${esc(content.svg_path as string)}" fill="${esc(theme.text_primary)}" /></g>`,
    );
  }
  if (content.text !== '') {
    const textX = hasPicto ? x + pictoSize * 1.3 : x + 2;
    const fontSize = Math.min(h * 0.35, 6);
    parts.push(
      `<text x="${textX}" y="${y + h / 2 + fontSize * 0.35}"` +
      ` font-family="${esc(fontFamily)}" font-size="${fontSize}"` +
      ` fill="${esc(theme.text_primary)}">${esc(content.text)}</text>`,
    );
  }
  return parts.join('\n');
}

function renderBlock(
  block: ResolvedBlock,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: FaceTheme,
  fontFamily: string,
  lang: string | undefined,
): string {
  const content = block.content;
  switch (content.type) {
    case 'header':
      return renderHeader(content, x, y, w, h, theme, fontFamily);
    case 'destination_list':
      return renderDestinationList(content, x, y, w, h, theme, fontFamily, lang);
    case 'pictogram':
      return renderPictogram(content, x, y, w, h, theme);
    case 'arrow':
      return renderArrow(content, x, y, w, h, theme);
    case 'free_text':
      return renderFreeText(content, x, y, w, h, theme, fontFamily);
    case 'map':
      return renderMap(content, x, y, w, h, theme, fontFamily);
    case 'legend':
      return renderLegend(content, x, y, w, h, theme, fontFamily);
    case 'logo':
      return renderLogo(content, x, y, w, h, theme, fontFamily);
    case 'emergency_info':
      return renderEmergency(content, x, y, w, h, theme, fontFamily);
  }
}

/** A rendered face plus the measurements a normative check reads back. */
export type FaceRender = {
  readonly svg: string;
  /**
   * Smallest destination-list font size (em, mm) drawn on the face, or null
   * when the face carries no denomination text. The legibility check compares
   * this against the minimum height a rules pack requires for the reading
   * distance (LEGIBILITY.MIN_CHAR_HEIGHT).
   */
  readonly min_text_font_size_mm: number | null;
};

function renderFaceParts(
  face: ResolvedFace,
  options: RenderFaceOptions,
): FaceRender {
  const { width_mm, height_mm, theme, font_family, lang } = options;
  const parts: string[] = [];

  parts.push(
    `<svg viewBox="0 0 ${width_mm} ${height_mm}"` +
    ` xmlns="http://www.w3.org/2000/svg"` +
    ` width="${width_mm}mm" height="${height_mm}mm">`,
  );

  parts.push(
    `<rect x="0" y="0" width="${width_mm}" height="${height_mm}"` +
    ` fill="${esc(theme.background)}" />`,
  );

  const sorted = [...face.blocks].sort(
    (a, b) => a.ordinal - b.ordinal || a.kind.localeCompare(b.kind),
  );

  let minTextFontSizeMm: number | null = null;
  for (const block of sorted) {
    const bx = (block.region.x_pct / 100) * width_mm;
    const by = (block.region.y_pct / 100) * height_mm;
    const bw = (block.region.w_pct / 100) * width_mm;
    const bh = (block.region.h_pct / 100) * height_mm;

    if (block.content.type === 'destination_list') {
      const count = block.content.entries.length;
      if (count > 0) {
        const fs = destinationListFontSizeMm(bh, count);
        minTextFontSizeMm = minTextFontSizeMm === null
          ? fs
          : Math.min(minTextFontSizeMm, fs);
      }
    }

    parts.push(renderBlock(block, bx, by, bw, bh, theme, font_family, lang));
  }

  parts.push('</svg>');
  return { svg: parts.join('\n'), min_text_font_size_mm: minTextFontSizeMm };
}

export function renderFace(
  face: ResolvedFace,
  options: RenderFaceOptions,
): string {
  return renderFaceParts(face, options).svg;
}

/**
 * Render a face and return, alongside the SVG, the measurements a normative
 * check reads back. The SVG is byte-for-byte identical to {@link renderFace}'s
 * (same layout pass) — the measures are recorded, never re-derived.
 */
export function renderFaceWithMeasures(
  face: ResolvedFace,
  options: RenderFaceOptions,
): FaceRender {
  return renderFaceParts(face, options);
}
