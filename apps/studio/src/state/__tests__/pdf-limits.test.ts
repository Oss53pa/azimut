import { describe, it, expect } from 'vitest';
import { inspectPlanContent } from '../plan-content.js';
import { acceptPlanFile } from '../plan-import.js';
import { flate, onePagePdf, pdfFile, PDF_LIMITS, PLAN_MAX_BYTES } from './pdf-fixtures.js';

/**
 * Lot 5 de l'audit : la lecture d'un PDF est bornée par la configuration (D-5).
 *
 * Une bombe de décompression ne se décompresse que jusqu'à la borne, puis le
 * fichier est refusé, comme un fichier trop lourd. Un PDF qui annonce plus de
 * pages que la borne est refusé sans être parcouru.
 */
describe('lot 5 : les bornes de lecture d’un PDF', () => {
  it('une bombe de décompression est refusée, sans être décompressée en entier', async () => {
    // Quelques kilo-octets compressés, plusieurs mégaoctets une fois lus.
    const bomb = onePagePdf([flate(`0 0 m 1 1 l S\n${' '.repeat(4_000_000)}`)]);
    const inspection = await inspectPlanContent(bomb, { ...PDF_LIMITS, maxInflatedBytes: 1_000_000 });
    expect(inspection.limitExceeded).toBe('inflated');
    const verdict = acceptPlanFile({ name: 'bombe.pdf', byteSize: bomb.length, page: null }, inspection, PLAN_MAX_BYTES);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.findings.map(f => f.code)).toContain('IMPORT.FILE_TOO_LARGE');
  });

  it('le même contenu passe sous la borne de référence', async () => {
    const pdf = onePagePdf([flate(`0 0 m 1 1 l S\n${' '.repeat(4_000_000)}`)]);
    const inspection = await inspectPlanContent(pdf, PDF_LIMITS);
    expect(inspection.limitExceeded).toBeUndefined();
    expect(inspection.pages).toEqual(['vector']);
  });

  it('un PDF qui annonce plus de pages que la borne est refusé', async () => {
    const pages = pdfFile([
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>',
      '<< /Type /Page /Parent 2 0 R >>', '<< /Type /Page /Parent 2 0 R >>', '<< /Type /Page /Parent 2 0 R >>',
    ]);
    const inspection = await inspectPlanContent(pages, { ...PDF_LIMITS, maxPages: 2 });
    expect(inspection.limitExceeded).toBe('pages');
  });

  it('un fichier plus lourd que la borne du fond est refusé', () => {
    const verdict = acceptPlanFile({ name: 'lourd.pdf', byteSize: PLAN_MAX_BYTES + 1, page: null },
      { format: 'pdf', pageCount: 1, pages: ['vector'] }, PLAN_MAX_BYTES);
    expect(verdict.ok).toBe(false);
  });
});
