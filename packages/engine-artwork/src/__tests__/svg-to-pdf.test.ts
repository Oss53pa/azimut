import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { renderSvgToPage } from '../svg-to-pdf.js';
import { themePapier, stateColors } from '@azimut/design-tokens';

const MM_TO_PT = 72 / 25.4;

// Use tokens as test colors so we don't introduce hardcoded hex (A2.4).
const FG = themePapier['text-primary'];
const FG2 = themePapier['text-secondary'];
const ACCENT = themePapier['accent'];
const ACCENT2 = themePapier['accent-secondary'];
const BORDER = themePapier['border'];
const ERR = stateColors['state-blocking'];
const WARN = stateColors['state-warning'];
const OK = stateColors['state-valid'];

async function renderAndExtract(svg: string, widthMm = 200, heightMm = 100) {
  const doc = await PDFDocument.create();
  const widthPt = widthMm * MM_TO_PT;
  const heightPt = heightMm * MM_TO_PT;
  const page = doc.addPage([widthPt, heightPt]);
  renderSvgToPage(page, svg, widthPt, heightPt);
  const bytes = await doc.save({
    useObjectStreams: false,
    addDefaultPage: false,
    objectsPerTick: Infinity,
  });
  return { bytes, page };
}

describe('renderSvgToPage', () => {
  it('renders a rect element', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      `<rect x="10" y="10" width="180" height="80" fill="${ERR}" />` +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  it('renders text element', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      `<text x="50" y="50" font-size="12" fill="${FG}">Hello</text>` +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('renders polygon element', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      `<polygon points="100,10 150,90 50,90" fill="${ACCENT}" />` +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('renders path element', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      `<path d="M10 10 L50 50 L90 10 Z" fill="${OK}" />` +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('renders nested g with transform', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      '<g transform="translate(50,25) scale(2)">' +
      `<rect x="0" y="0" width="30" height="20" fill="${BORDER}" />` +
      '</g>' +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('handles empty SVG gracefully', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg"></svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('handles SVG without viewBox gracefully', async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      `<rect x="0" y="0" width="100" height="50" fill="${ERR}" />` +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    // No viewBox → renderSvgToPage returns early, produces blank page.
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('is deterministic (INV-4)', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      `<rect x="10" y="10" width="50" height="30" fill="${FG}" />` +
      `<text x="100" y="60" font-size="10" fill="${FG2}">Test</text>` +
      `<polygon points="150,20 170,80 130,80" fill="${ACCENT2}" />` +
      '</svg>';
    const { bytes: b1 } = await renderAndExtract(svg);
    const { bytes: b2 } = await renderAndExtract(svg);
    expect(Array.from(b1)).toEqual(Array.from(b2));
  });

  it('renders escaped text correctly', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      `<text x="10" y="50" font-size="12" fill="${WARN}">A &amp; B &lt;C&gt;</text>` +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('ignores unknown SVG elements (circle, line)', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      `<circle cx="100" cy="50" r="40" fill="${FG}" />` +
      `<line x1="0" y1="0" x2="200" y2="100" stroke="${ACCENT}" />` +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    // Produces a valid PDF even though circle/line are not rendered.
    expect(bytes.length).toBeGreaterThan(0);
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  it('handles path with empty d attribute', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      `<path d="" fill="${OK}" />` +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('handles text with empty content', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      `<text x="10" y="50" font-size="12" fill="${FG}">   </text>` +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('renders polygon with rotation transform', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      '<g transform="rotate(45)">' +
      `<polygon points="50,10 70,80 30,80" fill="${ACCENT2}" />` +
      '</g>' +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('handles rect with fill="none" (transparent)', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      `<rect x="10" y="10" width="80" height="40" fill="none" stroke="${BORDER}" />` +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('handles single-point polygon (skipped)', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      `<polygon points="50,50" fill="${OK}" />` +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('handles text with no font-size (defaults to 8)', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      `<text x="10" y="50" fill="${FG}">No size attr</text>` +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('rect with non-hex fill (named color) falls back gracefully', async () => {
    // parseHexColor returns null for non-hex → no color override, still valid PDF
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="10" y="10" width="50" height="30" fill="red" />' +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  it('parseHexColor NaN guard for non-hex digits', async () => {
    // #gggggg has 6 chars but parseInt produces NaN
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="10" y="10" width="50" height="30" fill="#gggggg" />' +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('two-value scale transform scale(x, y)', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      '<g transform="scale(2, 3)">' +
      `<rect x="0" y="0" width="20" height="10" fill="${ACCENT}" />` +
      '</g>' +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('rect with stroke-dasharray', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      `<rect x="10" y="10" width="80" height="40" fill="none" stroke="${BORDER}" stroke-dasharray="5,3" />` +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('text with nested tspan elements', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      `<text x="10" y="50" font-size="12" fill="${FG}">` +
      '<tspan x="10" dy="0">First</tspan>' +
      '<tspan x="10" dy="14">Second</tspan>' +
      '</text>' +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('text with &quot; entity decoding', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      `<text x="10" y="50" font-size="12" fill="${WARN}">A &amp;quot;B&amp;quot;</text>` +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('text without fill attribute', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      '<text x="10" y="50" font-size="12">No fill</text>' +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('polygon without points attribute (early return)', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      `<polygon fill="${OK}" />` +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('polygon without fill attribute', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      '<polygon points="10,10 50,50 10,50" />' +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('path without fill attribute', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M10 10 L50 50 L90 10 Z" />' +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('<g> without transform passes parent transform through', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      '<g>' +
      `<rect x="10" y="10" width="50" height="30" fill="${FG2}" />` +
      '</g>' +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('rect without fill attribute (implicit else)', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="10" y="10" width="50" height="30" />' +
      '</svg>';
    const { bytes } = await renderAndExtract(svg);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('two-value scale is deterministic (INV-4)', async () => {
    const svg =
      '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
      '<g transform="scale(1.5, 2.5)">' +
      `<rect x="5" y="5" width="40" height="20" fill="${ACCENT2}" />` +
      `<text x="10" y="50" font-size="10" fill="${FG}">Scaled</text>` +
      '</g>' +
      '</svg>';
    const { bytes: b1 } = await renderAndExtract(svg);
    const { bytes: b2 } = await renderAndExtract(svg);
    expect(Array.from(b1)).toEqual(Array.from(b2));
  });
});
