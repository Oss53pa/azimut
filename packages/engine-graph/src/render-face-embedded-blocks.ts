/**
 * Rendu des blocs d'une face dont le contenu est un actif ou une liste : logo,
 * plan, légende, consigne de sécurité. Sortis de `render-face.ts`.
 */
import type { ResolvedContent } from './resolve-face.js';
import { esc, type FaceTheme } from './face-svg.js';

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

export function renderLogo(
  content: Extract<ResolvedContent, { type: 'logo' }>,
  x: number, y: number, w: number, h: number,
  theme: FaceTheme, fontFamily: string,
): string {
  if (content.svg_markup !== null) return embedSvg(content.svg_markup, x, y, w, h);
  return centeredLabel(content.label, x, y, w, h, theme.text_secondary, fontFamily);
}

export function renderMap(
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

export function renderLegend(
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

export function renderEmergency(
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
