import type { PDFPage } from 'pdf-lib';
import { rgb, degrees } from 'pdf-lib';

/**
 * Minimal SVG-to-PDF renderer for the controlled vocabulary
 * produced by renderFace: rect, text, tspan, polygon, path, g.
 *
 * PDF coordinates have origin at bottom-left with Y going up,
 * while SVG has origin at top-left with Y going down.
 * All Y values are flipped: pdfY = pageHeight - svgY.
 */

type Transform = {
  readonly tx: number;
  readonly ty: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly rotateDeg: number;
};

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '');
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r: r / 255, g: g / 255, b: b / 255 };
}

function attr(tag: string, name: string): string {
  const pattern = new RegExp(`${name}="([^"]*)"`, 'i');
  const m = tag.match(pattern);
  return m?.[1] ?? '';
}

function numAttr(tag: string, name: string): number {
  return parseFloat(attr(tag, name)) || 0;
}

function parseTransform(raw: string): Transform {
  let tx = 0;
  let ty = 0;
  let scaleX = 1;
  let scaleY = 1;
  let rotateDeg = 0;

  const translateMatch = raw.match(/translate\(([^)]+)\)/);
  if (translateMatch) {
    const parts = (translateMatch[1] ?? '').split(/[,\s]+/);
    tx = parseFloat(parts[0] ?? '0') || 0;
    ty = parseFloat(parts[1] ?? '0') || 0;
  }

  const scaleMatch = raw.match(/scale\(([^)]+)\)/);
  if (scaleMatch) {
    const parts = (scaleMatch[1] ?? '').split(/[,\s]+/);
    scaleX = parseFloat(parts[0] ?? '1') || 1;
    scaleY = parts.length > 1 ? (parseFloat(parts[1] ?? '1') || 1) : scaleX;
  }

  const rotateMatch = raw.match(/rotate\(([^)]+)\)/);
  if (rotateMatch) {
    rotateDeg = parseFloat(rotateMatch[1] ?? '0') || 0;
  }

  return { tx, ty, scaleX, scaleY, rotateDeg };
}

function composeTransform(parent: Transform, child: Transform): Transform {
  return {
    tx: parent.tx + child.tx * parent.scaleX,
    ty: parent.ty + child.ty * parent.scaleY,
    scaleX: parent.scaleX * child.scaleX,
    scaleY: parent.scaleY * child.scaleY,
    rotateDeg: parent.rotateDeg + child.rotateDeg,
  };
}

function applyPoint(
  t: Transform,
  x: number,
  y: number,
): { x: number; y: number } {
  const rad = (t.rotateDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const sx = x * t.scaleX;
  const sy = y * t.scaleY;
  return {
    x: t.tx + sx * cos - sy * sin,
    y: t.ty + sx * sin + sy * cos,
  };
}

function drawRect(
  page: PDFPage,
  tag: string,
  transform: Transform,
  pageHeight: number,
): void {
  const x = numAttr(tag, 'x');
  const y = numAttr(tag, 'y');
  const w = numAttr(tag, 'width');
  const h = numAttr(tag, 'height');
  const fill = attr(tag, 'fill');
  const stroke = attr(tag, 'stroke');
  const dashArray = attr(tag, 'stroke-dasharray');

  const pt = applyPoint(transform, x, y);

  const opts: Record<string, unknown> = {
    x: pt.x,
    y: pageHeight - pt.y - h * transform.scaleY,
    width: w * transform.scaleX,
    height: h * transform.scaleY,
  };

  if (fill && fill !== 'none') {
    const c = parseHexColor(fill);
    if (c) opts['color'] = rgb(c.r, c.g, c.b);
  } else if (fill === 'none') {
    opts['color'] = rgb(1, 1, 1);
    opts['opacity'] = 0;
  }

  if (stroke && stroke !== 'none') {
    const c = parseHexColor(stroke);
    if (c) {
      opts['borderColor'] = rgb(c.r, c.g, c.b);
      opts['borderWidth'] = 0.5;
    }
    if (dashArray) {
      const parts = dashArray.split(/[,\s]+/).map(Number);
      opts['borderDashArray'] = parts;
    }
  }

  page.drawRectangle(opts as Parameters<PDFPage['drawRectangle']>[0]);
}

function drawText(
  page: PDFPage,
  tag: string,
  transform: Transform,
  pageHeight: number,
): void {
  // Extract text between > and </text> or </tspan>
  const textContent = tag
    .replace(/<tspan[^>]*>/gi, '')
    .replace(/<\/tspan>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

  if (textContent.trim().length === 0) return;

  const x = numAttr(tag, 'x');
  const y = numAttr(tag, 'y');
  const fontSize = numAttr(tag, 'font-size') || 8;
  const fill = attr(tag, 'fill');

  const pt = applyPoint(transform, x, y);

  const opts: Record<string, unknown> = {
    x: pt.x,
    y: pageHeight - pt.y,
    size: fontSize * transform.scaleX,
  };

  if (fill) {
    const c = parseHexColor(fill);
    if (c) opts['color'] = rgb(c.r, c.g, c.b);
  }

  page.drawText(textContent, opts as Parameters<PDFPage['drawText']>[1]);
}

function drawPolygon(
  page: PDFPage,
  tag: string,
  transform: Transform,
  pageHeight: number,
): void {
  const pointsStr = attr(tag, 'points');
  if (!pointsStr) return;

  const fill = attr(tag, 'fill');
  const pairs = pointsStr.trim().split(/\s+/);
  const coords: Array<{ x: number; y: number }> = [];
  for (const pair of pairs) {
    const [px, py] = pair.split(',');
    coords.push({
      x: parseFloat(px ?? '0') || 0,
      y: parseFloat(py ?? '0') || 0,
    });
  }

  if (coords.length < 2) return;

  // Build SVG path from polygon points.
  let d = `M ${coords[0]?.x ?? 0} ${coords[0]?.y ?? 0}`;
  for (let i = 1; i < coords.length; i++) {
    d += ` L ${coords[i]?.x ?? 0} ${coords[i]?.y ?? 0}`;
  }
  d += ' Z';

  const opts: Record<string, unknown> = {
    x: transform.tx,
    y: pageHeight - transform.ty,
    scale: transform.scaleX,
  };

  if (fill) {
    const c = parseHexColor(fill);
    if (c) opts['color'] = rgb(c.r, c.g, c.b);
  }

  if (transform.rotateDeg !== 0) {
    opts['rotate'] = degrees(-transform.rotateDeg);
  }

  page.drawSvgPath(d, opts as Parameters<PDFPage['drawSvgPath']>[1]);
}

function drawPath(
  page: PDFPage,
  tag: string,
  transform: Transform,
  pageHeight: number,
): void {
  const d = attr(tag, 'd');
  if (!d) return;

  const fill = attr(tag, 'fill');

  const opts: Record<string, unknown> = {
    x: transform.tx,
    y: pageHeight - transform.ty,
    scale: transform.scaleX,
  };

  if (fill) {
    const c = parseHexColor(fill);
    if (c) opts['color'] = rgb(c.r, c.g, c.b);
  }

  page.drawSvgPath(d, opts as Parameters<PDFPage['drawSvgPath']>[1]);
}

/**
 * Render the SVG string produced by renderFace onto a PDFPage.
 * The SVG uses the same coordinate system as the page (in mm),
 * scaled to pt via the MM_TO_PT factor.
 */
export function renderSvgToPage(
  page: PDFPage,
  svg: string,
  pageWidthPt: number,
  pageHeightPt: number,
): void {
  // Parse viewBox to get SVG coordinate space.
  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
  if (!viewBoxMatch) return;
  const [, , vbW, vbH] = (viewBoxMatch[1] ?? '0 0 100 100').split(/\s+/);
  const svgW = parseFloat(vbW ?? '100');
  const svgH = parseFloat(vbH ?? '100');

  // Scale from SVG units (mm) to PDF points.
  const scaleX = pageWidthPt / svgW;
  const scaleY = pageHeightPt / svgH;

  const baseTransform: Transform = {
    tx: 0,
    ty: 0,
    scaleX,
    scaleY,
    rotateDeg: 0,
  };

  renderElements(page, svg, baseTransform, pageHeightPt);
}

function renderElements(
  page: PDFPage,
  content: string,
  parentTransform: Transform,
  pageHeight: number,
): void {
  // Match top-level SVG elements.
  const tagPattern = /<(rect|text|polygon|path|g)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(content)) !== null) {
    const tagName = (match[1] ?? '').toLowerCase();
    const fullTag = match[0] ?? '';
    const attrs = match[2] ?? '';
    const inner = match[3] ?? '';

    if (tagName === 'g') {
      const transformStr = attr(`<g ${attrs}>`, 'transform');
      const childTransform = transformStr
        ? composeTransform(parentTransform, parseTransform(transformStr))
        : parentTransform;
      renderElements(page, inner, childTransform, pageHeight);
    } else if (tagName === 'rect') {
      drawRect(page, fullTag, parentTransform, pageHeight);
    } else if (tagName === 'text') {
      drawText(page, fullTag, parentTransform, pageHeight);
    } else if (tagName === 'polygon') {
      drawPolygon(page, fullTag, parentTransform, pageHeight);
    } else if (tagName === 'path') {
      drawPath(page, fullTag, parentTransform, pageHeight);
    }
  }
}
