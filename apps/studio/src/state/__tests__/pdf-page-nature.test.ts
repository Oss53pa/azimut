import { describe, it, expect } from 'vitest';
import { inspectPlanContent, precisionOfPage } from '../plan-content.js';
import type { PlanPrecision } from '../plan-content.js';
import { scanContent } from '../../domain/pdf-painted-paths.js';
import { flate, form, latin1, pdfFile, plain, scannedImage } from './pdf-fixtures.js';
import type { PdfObjectSpec } from './pdf-fixtures.js';

/**
 * M2 (partie M), version 29 — « Pour un document de plusieurs pages, la
 * nature se juge sur la page retenue, en suivant les objets qu'elle
 * référence, et non sur le fichier entier [...]. Quand le suivi ne permet pas
 * de conclure, la nature est indéterminée, jamais vectorielle. »
 */

const PATH = '0 0 m 100 0 l S';
const CATALOG = '<< /Type /Catalog /Pages 2 0 R >>';

async function natures(objects: readonly PdfObjectSpec[], tail?: string): Promise<PlanPrecision[]> {
  const inspection = await inspectPlanContent(pdfFile(objects, tail));
  return Array.from({ length: inspection.pageCount ?? 0 }, (_, i) => precisionOfPage(inspection, i + 1));
}

describe('M2 — chaque page se juge sur ses propres objets', () => {
  it('les tracés d’une page ne masquent pas leur absence sur une autre', async () => {
    expect(await natures([
      CATALOG,
      '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
      '<< /Type /Page /Parent 2 0 R /Contents 5 0 R >>',
      '<< /Type /Page /Parent 2 0 R /Contents 6 0 R /Resources << /XObject << /Im0 7 0 R >> >> >>',
      plain(PATH),
      flate('q 595 0 0 842 0 0 cm /Im0 Do Q'),
      scannedImage,
    ])).toEqual(['vector', 'pdf_without_paths']);
  });

  it('l’ordre des pages est celui de l’arbre, non celui du fichier', async () => {
    expect(await natures([
      CATALOG,
      '<< /Type /Pages /Kids [4 0 R 3 0 R] /Count 2 >>',
      '<< /Type /Page /Parent 2 0 R /Contents 5 0 R >>',
      '<< /Type /Page /Parent 2 0 R >>',
      plain(PATH),
    ])).toEqual(['pdf_without_paths', 'vector']);
  });

  it('l’arbre se suit à travers des nœuds intermédiaires', async () => {
    expect(await natures([
      CATALOG,
      '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 3 >>',
      '<< /Type /Pages /Parent 2 0 R /Kids [5 0 R 6 0 R] /Count 2 >>',
      '<< /Type /Page /Parent 2 0 R /Contents 7 0 R >>',
      '<< /Type /Page /Parent 3 0 R >>',
      '<< /Type /Page /Parent 3 0 R >>',
      plain(PATH),
    ])).toEqual(['pdf_without_paths', 'pdf_without_paths', 'vector']);
  });

  it('une page sans contenu ne porte aucun tracé', async () => {
    expect(await natures([CATALOG, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R >>']))
      .toEqual(['pdf_without_paths']);
  });

  it('le contenu peut être un tableau rangé dans un objet à part', async () => {
    expect(await natures([
      CATALOG,
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>',
      '[5 0 R 6 0 R]',
      plain('0 0 m 100 0 l'),
      plain('S'),
    ])).toEqual(['vector']);
  });
});

describe('M2 — la page se suit dans les objets qu’elle invoque', () => {
  const page = (resources: string): string => `<< /Type /Page /Parent 2 0 R /Contents 4 0 R ${resources} >>`;
  const pages = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';

  it('un formulaire invoqué porte ses tracés', async () => {
    expect(await natures([CATALOG, pages, page('/Resources << /XObject << /Fm0 5 0 R >> >>'), plain('/Fm0 Do'), form(PATH)]))
      .toEqual(['vector']);
  });

  it('les ressources héritées de l’arbre se suivent', async () => {
    const inherited = '<< /Type /Pages /Kids [3 0 R] /Count 1 /Resources << /XObject << /Fm0 5 0 R >> >> >>';
    expect(await natures([CATALOG, inherited, page(''), plain('/Fm0 Do'), form(PATH)])).toEqual(['vector']);
  });

  it('un formulaire déclaré mais jamais invoqué ne compte pas', async () => {
    const shared = '<< /Type /Pages /Kids [3 0 R] /Count 1 /Resources << /XObject << /Fm0 5 0 R >> >> >>';
    expect(await natures([CATALOG, shared, page(''), plain('q Q'), form(PATH)])).toEqual(['pdf_without_paths']);
  });

  it('un formulaire imbriqué se suit dans ses propres ressources', async () => {
    const outer = form('/Fm1 Do', '<< /XObject << /Fm1 6 0 R >> >>');
    expect(await natures([CATALOG, pages, page('/Resources << /XObject << /Fm0 5 0 R >> >>'), plain('/Fm0 Do'), outer, form(PATH)]))
      .toEqual(['vector']);
  });

  it('les tracés d’une annotation ne sont pas ceux de la page', async () => {
    const annotated = '<< /Type /Page /Parent 2 0 R /Contents 4 0 R /Annots [5 0 R] >>';
    const annotation = '<< /Type /Annot /Subtype /Ink /Rect [0 0 10 10] /AP << /N 6 0 R >> >>';
    expect(await natures([CATALOG, pages, annotated, plain('q Q'), annotation, form(PATH)])).toEqual(['pdf_without_paths']);
  });
});

describe('M2 — un suivi qui ne conclut pas rend la page indéterminée, jamais vectorielle', () => {
  const pages = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';

  it('un flux de tracés que nul arbre de pages ne désigne', async () => {
    const orphan = latin1('%PDF-1.4\n1 0 obj\n<< /Length 15 >>\nstream\n0 0 m 100 0 l S\nendstream\nendobj\n%%EOF\n');
    const inspection = await inspectPlanContent(orphan);
    expect(precisionOfPage(inspection, 1)).toBe('undetermined');
  });

  it('un nom invoqué absent des ressources', async () => {
    expect(await natures([CATALOG, pages, '<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>', plain('/Fm0 Do')]))
      .toEqual(['undetermined']);
  });

  it('un contenu qui désigne un objet introuvable', async () => {
    expect(await natures([CATALOG, pages, '<< /Type /Page /Parent 2 0 R /Contents 9 0 R >>'])).toEqual(['undetermined']);
  });

  it('un formulaire qui s’invoque lui-même', async () => {
    const loop = form('/Fm0 Do', '<< /XObject << /Fm0 5 0 R >> >>');
    const page = '<< /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources << /XObject << /Fm0 5 0 R >> >> >>';
    expect(await natures([CATALOG, pages, page, plain('/Fm0 Do'), loop])).toEqual(['undetermined']);
  });

  it('un arbre qui boucle sur lui-même', async () => {
    const looping = '<< /Type /Pages /Kids [2 0 R] /Count 1 >>';
    expect(await natures([CATALOG, looping])).toEqual(['undetermined']);
  });

  it('un tracé lu conclut, même quand un autre objet ne se lit pas', async () => {
    const page = '<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>';
    expect(await natures([CATALOG, pages, page, plain(`${PATH} /Fm9 Do`)])).toEqual(['vector']);
  });
});

describe('M2 — le lecteur de contenu relève les objets invoqués', () => {
  it('un nom suivi de Do, une fois chacun, et rien d’autre', () => {
    expect(scanContent('q /Im0 Do Q /Fm1 Do /Im0 Do /GS0 gs (/Faux Do) Tj').invoked).toEqual(['Im0', 'Fm1']);
  });
});
