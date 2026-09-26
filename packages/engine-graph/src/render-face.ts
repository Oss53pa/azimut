import type { Finding } from '@azimut/core-model';
import type { ResolvedFace, ResolvedBlock } from './resolve-face.js';
import { esc, pickName, type FaceTheme } from './face-svg.js';
import {
  headerFontSizeMm, destinationListFontSizeMm,
  renderHeader, renderDestinationList, renderPictogram, renderArrow, renderFreeText,
} from './render-face-text-blocks.js';
import { renderLogo, renderMap, renderLegend, renderEmergency } from './render-face-embedded-blocks.js';

// Réexportés : l'API du rendu reste celle de ce fichier.
export type { FaceTheme } from './face-svg.js';
export {
  headerFontSizeMm, destinationListFontSizeMm, destinationListBlockHeightMm,
} from './render-face-text-blocks.js';

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
      return renderFreeText(content, x, y, w, h, theme, fontFamily, lang);
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

/**
 * Whether the face renders any mark in the accent colour. Single source with
 * the renderer: the header bar, arrow blocks, legend swatches, and the
 * direction arrows of a destination list are drawn in `theme.accent`; every
 * other block uses text or background colours. The accent (pictogram) contrast
 * check is meaningful only when this holds — a face with none of these draws no
 * accent, so checking its accent colour would raise a spurious anomaly.
 */
export function faceUsesAccent(face: ResolvedFace): boolean {
  return face.blocks.some((block) => {
    const content = block.content;
    switch (content.type) {
      case 'header':
      case 'arrow':
      case 'legend':
        return true;
      case 'destination_list':
        return content.entries.some((e) => e.direction !== null);
      default:
        return false;
    }
  });
}

/**
 * Deterministic text measurement (G5.1): the width in millimetres of `text`
 * drawn at `fontSizeMm`, computed from a versioned font-metrics table, never the
 * browser. Supplied by the caller — no metrics table ships in the repository
 * yet, so the content-fit check below stays dormant until one is provided.
 */
export type TextMeasure = (text: string, fontSizeMm: number) => number;

/**
 * Content-fit control (A7.2, LAYOUT.CONTENT_OVERFLOW): the composition-level
 * check that a face's text fits the format it is drawn in. Each primary text —
 * the header's site name and each destination name — is measured at the exact
 * size the renderer draws it (shared font-size helpers) against the width of its
 * block; a piece wider than its block raises a blocking anomaly. Text overflow
 * is thus detected by calculation, never visually (E12/D14). Returns [] when no
 * text overflows; runs only when a `measure` is supplied.
 */
export function checkFaceContentFit(
  face: ResolvedFace,
  options: RenderFaceOptions,
  measure: TextMeasure,
): readonly Finding[] {
  const { width_mm, height_mm, lang } = options;
  const findings: Finding[] = [];

  const flag = (blockKind: string, text: string, fontSizeMm: number, availableMm: number): void => {
    if (text.length === 0) return;
    const measured = measure(text, fontSizeMm);
    if (measured > availableMm) {
      findings.push({
        code: 'LAYOUT.CONTENT_OVERFLOW',
        severity: 'blocking',
        entity: { kind: 'face_block', id: blockKind },
        params: { measured_mm: measured, available_mm: availableMm },
        ruleRef: null,
      });
    }
  };

  for (const block of face.blocks) {
    const bw = (block.region.w_pct / 100) * width_mm;
    const bh = (block.region.h_pct / 100) * height_mm;
    const content = block.content;
    if (content.type === 'header') {
      flag(block.kind, content.site_name, headerFontSizeMm(bw, bh), bw);
    } else if (content.type === 'destination_list' && content.entries.length > 0) {
      const fontSize = destinationListFontSizeMm(bh, content.entries.length);
      for (const entry of content.entries) {
        flag(block.kind, pickName(entry.names, lang), fontSize, bw);
      }
    }
  }
  return findings;
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
