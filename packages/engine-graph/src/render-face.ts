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
};

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

function renderDestinationList(
  content: Extract<ResolvedContent, { type: 'destination_list' }>,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: FaceTheme,
  fontFamily: string,
): string {
  const entries = content.entries;
  if (entries.length === 0) return '';

  const lineHeight = Math.min(
    h / (entries.length + 0.5),
    h * 0.15,
  );
  const fontSize = lineHeight * 0.6;
  const parts: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    const nameValues = Object.values(entry.names);
    const name = nameValues.length > 0 ? nameValues[0] : '';
    const ty = y + lineHeight * (i + 1);
    const dist =
      entry.distance_m !== null
        ? ` — ${Math.round(entry.distance_m)} m`
        : '';

    parts.push(
      `<text x="${x + fontSize * 0.5}" y="${ty}"` +
      ` font-family="${esc(fontFamily)}" font-size="${fontSize}"` +
      ` fill="${esc(theme.text_primary)}">${esc(name ?? '')}` +
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

function renderPlaceholder(
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: FaceTheme,
  fontFamily: string,
): string {
  const fontSize = Math.min(h * 0.3, 6);
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}"` +
    ` fill="none" stroke="${esc(theme.border)}" stroke-dasharray="3" />\n` +
    `<text x="${x + w / 2}" y="${y + h / 2 + fontSize * 0.35}"` +
    ` text-anchor="middle" font-family="${esc(fontFamily)}"` +
    ` font-size="${fontSize}" fill="${esc(theme.text_secondary)}">${esc(label)}</text>`
  );
}

function renderBlock(
  block: ResolvedBlock,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: FaceTheme,
  fontFamily: string,
): string {
  const content = block.content;
  switch (content.type) {
    case 'header':
      return renderHeader(content, x, y, w, h, theme, fontFamily);
    case 'destination_list':
      return renderDestinationList(content, x, y, w, h, theme, fontFamily);
    case 'pictogram':
      return renderPictogram(content, x, y, w, h, theme);
    case 'arrow':
      return renderArrow(content, x, y, w, h, theme);
    case 'free_text':
      return renderFreeText(content, x, y, w, h, theme, fontFamily);
    case 'map':
      return renderPlaceholder('[Plan]', x, y, w, h, theme, fontFamily);
    case 'logo':
      return renderPlaceholder('[Logo]', x, y, w, h, theme, fontFamily);
    case 'emergency_info':
      return renderPlaceholder('[Urgence]', x, y, w, h, theme, fontFamily);
  }
}

export function renderFace(
  face: ResolvedFace,
  options: RenderFaceOptions,
): string {
  const { width_mm, height_mm, theme, font_family } = options;
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

  for (const block of sorted) {
    const bx = (block.region.x_pct / 100) * width_mm;
    const by = (block.region.y_pct / 100) * height_mm;
    const bw = (block.region.w_pct / 100) * width_mm;
    const bh = (block.region.h_pct / 100) * height_mm;

    parts.push(renderBlock(block, bx, by, bw, bh, theme, font_family));
  }

  parts.push('</svg>');
  return parts.join('\n');
}
