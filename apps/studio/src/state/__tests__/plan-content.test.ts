import { describe, it, expect } from 'vitest';
import { deflateSync } from 'node:zlib';
import { inspectPlanContent, planPrecisionWarnings, sniffPlanFormat } from '../plan-content.js';
import type { PlanPrecision } from '../plan-content.js';
import { countPdfPages } from '../../domain/pdf-pages.js';
import { countPaintedPaths } from '../../domain/pdf-painted-paths.js';

/**
 * M2 (partie M), version 27 — `IMPORT.RASTER_PRECISION_LIMITED`, jugé sur le
 * contenu, jamais sur l'extension.
 *
 * Les fichiers d'essai sont construits ici, octet par octet : aucun plan réel
 * (A2.4). Un PDF d'essai n'a ni table de références ni polices : le contrôle
 * n'en a pas besoin, il ne lit que les flux.
 */

const latin1 = (text: string): Uint8Array => Uint8Array.from(text, ch => ch.charCodeAt(0));

type PdfStream = { readonly dict: string; readonly data: Uint8Array };

function pdf(...streams: readonly PdfStream[]): Uint8Array {
  const parts: Uint8Array[] = [latin1('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n')];
  streams.forEach((stream, i) => {
    parts.push(latin1(`${i + 1} 0 obj\n<< ${stream.dict} /Length ${stream.data.length} >>\nstream\n`));
    parts.push(stream.data);
    parts.push(latin1('\nendstream\nendobj\n'));
  });
  parts.push(latin1('%%EOF\n'));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}

const plain = (content: string): PdfStream => ({ dict: '', data: latin1(content) });
const flate = (content: string): PdfStream => ({ dict: '/Filter /FlateDecode', data: new Uint8Array(deflateSync(latin1(content))) });

/** Une « image » dont les octets imitent des opérateurs de tracé : elle ne doit pas compter. */
const scannedImage: PdfStream = {
  dict: '/Type /XObject /Subtype /Image /Width 2 /Height 2 /BitsPerComponent 8 /ColorSpace /DeviceGray',
  data: latin1('0 0 m 10 0 l S 0 0 5 5 re f'),
};

const PNG_HEAD = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG_HEAD = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]);

function dxf(sections: readonly [string, readonly string[]][]): Uint8Array {
  const lines = ['999', 'essai'];
  for (const [name, entities] of sections) {
    lines.push('0', 'SECTION', '2', name);
    for (const entity of entities) lines.push('0', entity, '8', 'calque');
    lines.push('0', 'ENDSEC');
  }
  lines.push('0', 'EOF');
  return latin1(lines.join('\r\n'));
}

async function judgePlanPrecision(bytes: Uint8Array): Promise<PlanPrecision> {
  return (await inspectPlanContent(bytes)).precision;
}

async function warningsOf(bytes: Uint8Array, name: string) {
  return planPrecisionWarnings(await judgePlanPrecision(bytes), name);
}

describe('M2 — la nature du fichier se lit dans ses octets', () => {
  it('reconnaît PDF, PNG, JPEG et DXF, texte comme binaire', () => {
    expect(sniffPlanFormat(pdf(plain('')))).toBe('pdf');
    expect(sniffPlanFormat(PNG_HEAD)).toBe('png');
    expect(sniffPlanFormat(JPEG_HEAD)).toBe('jpg');
    expect(sniffPlanFormat(dxf([['ENTITIES', ['LINE']]]))).toBe('dxf');
    expect(sniffPlanFormat(latin1('AutoCAD Binary DXF\r\n\x1a\0'))).toBe('dxf');
    expect(sniffPlanFormat(latin1('PK\x03\x04'))).toBeNull();
  });
});

describe('M2 — un PDF est vectoriel s’il porte au moins un tracé peint', () => {
  it('un tracé sans filtre', async () => {
    expect(await judgePlanPrecision(pdf(plain('0 0 m 100 0 l S')))).toBe('vector');
  });

  it('un tracé dans un flux compressé', async () => {
    expect(await judgePlanPrecision(pdf(flate('10 10 100 50 re f')))).toBe('vector');
  });

  it('une longueur déclarée par référence indirecte se lit jusqu’au marqueur', async () => {
    const data = new Uint8Array(deflateSync(latin1('0 0 m 5 5 l S')));
    const indirect = latin1('%PDF-1.4\n1 0 obj\n<< /Filter /FlateDecode /Length 2 0 R >>\nstream\n');
    const tail = latin1('\nendstream\nendobj\n2 0 obj\n' + String(data.length) + '\nendobj\n%%EOF\n');
    const file = new Uint8Array(indirect.length + data.length + tail.length);
    file.set(indirect, 0);
    file.set(data, indirect.length);
    file.set(tail, indirect.length + data.length);
    expect(await judgePlanPrecision(file)).toBe('vector');
  });

  it('un plan numérisé : une image posée sur la page, et rien d’autre', async () => {
    const page = flate('q 595 0 0 842 0 0 cm /Im0 Do Q');
    expect(await judgePlanPrecision(pdf(page, scannedImage))).toBe('pdf_without_paths');
  });

  it('la découpe qui entoure l’image ne fait pas un tracé', async () => {
    const page = flate('0 0 595 842 re W n q 595 0 0 842 0 0 cm /Im0 Do Q');
    expect(await judgePlanPrecision(pdf(page, scannedImage))).toBe('pdf_without_paths');
  });

  it('un flux illisible n’est présumé ni vide ni vectoriel', async () => {
    const lzw: PdfStream = { dict: '/Filter /LZWDecode', data: latin1('\x80\x0b\x60\x50') };
    const broken: PdfStream = { dict: '/Filter /FlateDecode', data: latin1('pas du deflate') };
    expect(await judgePlanPrecision(pdf(lzw))).toBe('undetermined');
    expect(await judgePlanPrecision(pdf(broken))).toBe('undetermined');
  });

  it('un flux illisible ne masque pas un tracé lu ailleurs', async () => {
    const lzw: PdfStream = { dict: '/Filter /LZWDecode', data: latin1('\x80\x0b') };
    expect(await judgePlanPrecision(pdf(lzw, plain('0 0 m 1 1 l S')))).toBe('vector');
  });
});

describe('M2 — le lecteur de contenu ne prend pas pour un tracé ce qui n’en est pas', () => {
  it('ni le texte d’une chaîne, ni une image en ligne, ni un commentaire', () => {
    expect(countPaintedPaths('BT /F1 12 Tf (0 0 m 10 0 l S) Tj ET')).toBe(0);
    expect(countPaintedPaths('BI /W 2 /H 2 /BPC 8 /CS /G ID 0 0 m S f EI')).toBe(0);
    expect(countPaintedPaths('% 0 0 m 10 0 l S\n')).toBe(0);
  });

  it('compte chaque chemin peint une fois', () => {
    expect(countPaintedPaths('0 0 m 1 0 l S 0 0 1 1 re f 2 2 m 3 3 l h B*')).toBe(3);
    expect(countPaintedPaths('S f')).toBe(0);
  });
});

describe('M2 — un DXF est vectoriel s’il porte une entité géométrique', () => {
  it('une ligne dans les entités', async () => {
    expect(await judgePlanPrecision(dxf([['ENTITIES', ['LINE']]]))).toBe('vector');
  });

  it('une image seule n’est pas un tracé', async () => {
    expect(await judgePlanPrecision(dxf([['ENTITIES', ['IMAGE', 'TEXT']]]))).toBe('dxf_without_geometry');
  });

  it('un bloc inséré porte ses tracés, un bloc jamais inséré non', async () => {
    const blocks: [string, readonly string[]] = ['BLOCKS', ['BLOCK', 'LWPOLYLINE', 'ENDBLK']];
    expect(await judgePlanPrecision(dxf([blocks, ['ENTITIES', ['INSERT']]]))).toBe('vector');
    expect(await judgePlanPrecision(dxf([blocks, ['ENTITIES', ['TEXT']]]))).toBe('dxf_without_geometry');
  });

  it('un DXF binaire n’est pas lu, et le dit', async () => {
    expect(await judgePlanPrecision(latin1('AutoCAD Binary DXF\r\n\x1a\0'))).toBe('undetermined');
  });
});

describe('M2 — IMPORT.RASTER_PRECISION_LIMITED, un avertissement jugé sur le contenu', () => {
  it('une image en mode point lève l’avertissement', async () => {
    const warnings = await warningsOf(PNG_HEAD, 'niveau-0.png');
    expect(warnings).toEqual([{
      code: 'IMPORT.RASTER_PRECISION_LIMITED',
      severity: 'warning',
      entity: null,
      params: { content: 'raster', file: 'niveau-0.png' },
      ruleRef: 'partieM-M2',
    }]);
  });

  it('c’est le contenu qui compte : un JPEG nommé .pdf, un PDF nommé .png', async () => {
    const jpegAsPdf = await warningsOf(JPEG_HEAD, 'plan.pdf');
    expect(jpegAsPdf.map(w => w.params['content'])).toEqual(['raster']);
    expect(await warningsOf(pdf(plain('0 0 m 1 0 l S')), 'plan.png')).toEqual([]);
  });

  it('un PDF qui se présente comme vectoriel sans l’être lève l’avertissement', async () => {
    const scan = pdf(flate('q 595 0 0 842 0 0 cm /Im0 Do Q'), scannedImage);
    const warnings = await warningsOf(scan, 'plan-vectoriel.pdf');
    expect(warnings.map(w => [w.code, w.severity, w.params['content']]))
      .toEqual([['IMPORT.RASTER_PRECISION_LIMITED', 'warning', 'pdf_without_paths']]);
  });

  it('un fond vectoriel ne lève rien', async () => {
    expect(await warningsOf(dxf([['ENTITIES', ['LINE']]]), 'plan.dxf')).toEqual([]);
  });
});

/** Un PDF fait d'objets écrits en clair, et d'une fin libre (bande-annonce). */
function pdfObjects(objects: readonly string[], tail: string): Uint8Array {
  const body = objects.map((o, i) => `${i + 1} 0 obj\n${o}\nendobj\n`).join('');
  return latin1(`%PDF-1.7\n${body}${tail}%%EOF\n`);
}

const pageTree = (count: number): string[] => [
  '<< /Type /Catalog /Pages 2 0 R >>',
  `<< /Type /Pages /Kids [] /Count ${count} >>`,
  ...Array.from({ length: count }, () => '<< /Type /Page /Parent 2 0 R >>'),
];

describe('M2 — le nombre de pages d’un PDF se lit dans son arbre des pages', () => {
  it('lit le compte du nœud des pages que désigne le catalogue', async () => {
    expect(await countPdfPages(pdfObjects(pageTree(3), 'trailer\n<< /Root 1 0 R >>\n'))).toBe(3);
    expect(await countPdfPages(pdfObjects(pageTree(1), 'trailer\n<< /Root 1 0 R >>\n'))).toBe(1);
  });

  it('une mise à jour incrémentale l’emporte sur la révision précédente', async () => {
    const update = '2 0 obj\n<< /Type /Pages /Kids [] /Count 2 >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n';
    expect(await countPdfPages(pdfObjects(pageTree(3), `trailer\n<< /Root 1 0 R >>\n${update}`))).toBe(2);
  });

  it('lit un catalogue rangé dans un flux d’objets compressé', async () => {
    const catalog = '<< /Type /Catalog /Pages 2 0 R >>';
    const pages = '<< /Type /Pages /Kids [] /Count 4 >>';
    const header = `1 0 2 ${catalog.length + 1} `;
    const packed = new Uint8Array(deflateSync(latin1(`${header}${catalog} ${pages}`)));
    const objStm = latin1(`%PDF-1.7\n10 0 obj\n<< /Type /ObjStm /N 2 /First ${header.length} /Filter /FlateDecode /Length ${packed.length} >>\nstream\n`);
    const tail = latin1('\nendstream\nendobj\n11 0 obj\n<< /Type /XRef /Root 1 0 R /Length 0 >>\nstream\n\nendstream\nendobj\n%%EOF\n');
    const bytes = new Uint8Array(objStm.length + packed.length + tail.length);
    bytes.set(objStm, 0);
    bytes.set(packed, objStm.length);
    bytes.set(tail, objStm.length + packed.length);
    expect(await countPdfPages(bytes)).toBe(4);
  });

  it('sans arbre lisible, compte les objets de type page', async () => {
    const pages = ['<< /Type /Page >>', '<< /Type /Page >>', '<< /Type /Pages /Count 0 >>'];
    expect(await countPdfPages(pdfObjects(pages, ''))).toBe(2);
  });

  it('rien de lisible : le nombre de pages est inconnu, et non supposé', async () => {
    expect(await countPdfPages(latin1('%PDF-1.4 fond de plan d’essai'))).toBeNull();
  });

  it('l’inspection porte le nombre de pages d’un PDF, et nul autre', async () => {
    expect((await inspectPlanContent(pdfObjects(pageTree(5), 'trailer\n<< /Root 1 0 R >>\n'))).pageCount).toBe(5);
    expect((await inspectPlanContent(PNG_HEAD)).pageCount).toBeNull();
  });
});
