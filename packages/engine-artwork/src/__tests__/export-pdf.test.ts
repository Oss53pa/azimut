import { describe, it, expect } from 'vitest';
import { exportArtworkPdf } from '../export-pdf.js';
import type { ExportPdfOptions } from '../export-pdf.js';

const SAMPLE_SVG =
  '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">' +
  '<rect x="10" y="10" width="180" height="80" fill="none" stroke="black"/>' +
  '<text x="100" y="55" text-anchor="middle" font-size="14">Bureau A</text>' +
  '</svg>';

const FIXED_DATE = new Date('2024-06-15T12:00:00Z');

function makeOptions(
  overrides?: Partial<ExportPdfOptions>,
): ExportPdfOptions {
  return {
    svg: SAMPLE_SVG,
    target: 'pdf-x4',
    title: 'Test Face',
    width_mm: 200,
    height_mm: 100,
    creation_date: FIXED_DATE,
    ...overrides,
  };
}

describe('exportArtworkPdf', () => {
  it('produces a valid PDF', async () => {
    const pdf = await exportArtworkPdf(makeOptions());
    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(pdf.length).toBeGreaterThan(0);

    const header = new TextDecoder().decode(pdf.slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  it('produces deterministic output (INV-4)', async () => {
    const opts = makeOptions();
    const pdf1 = await exportArtworkPdf(opts);
    const pdf2 = await exportArtworkPdf(opts);

    expect(pdf1.length).toBe(pdf2.length);

    const bytes1 = Array.from(pdf1);
    const bytes2 = Array.from(pdf2);
    expect(bytes1).toEqual(bytes2);
  });

  it('produces different output for different inputs', async () => {
    const pdfA = await exportArtworkPdf(makeOptions({ title: 'Face A' }));
    const pdfB = await exportArtworkPdf(makeOptions({ title: 'Face B' }));

    const areEqual =
      pdfA.length === pdfB.length &&
      pdfA.every((b, i) => b === pdfB[i]);
    expect(areEqual).toBe(false);
  });

  it('supports pdf-a target', async () => {
    const pdf = await exportArtworkPdf(makeOptions({ target: 'pdf-a' }));
    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(pdf.length).toBeGreaterThan(0);
  });

  it('respects dimensions', async () => {
    const small = await exportArtworkPdf(
      makeOptions({ width_mm: 50, height_mm: 50 }),
    );
    const large = await exportArtworkPdf(
      makeOptions({ width_mm: 500, height_mm: 500 }),
    );
    expect(small.length).not.toBe(large.length);
  });
});
