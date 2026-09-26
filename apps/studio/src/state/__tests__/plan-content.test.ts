import { describe, it, expect } from 'vitest';
import { deflateSync } from 'node:zlib';
import {
  judgePlanPrecision, planPrecisionWarnings, sniffPlanContent, unreadablePlanWarnings,
} from '../plan-content.js';
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

describe('M2 — la nature du fichier se lit dans ses octets', () => {
  it('reconnaît PDF, PNG, JPEG et DXF, texte comme binaire', () => {
    expect(sniffPlanContent(pdf(plain('')))).toBe('pdf');
    expect(sniffPlanContent(PNG_HEAD)).toBe('png');
    expect(sniffPlanContent(JPEG_HEAD)).toBe('jpeg');
    expect(sniffPlanContent(dxf([['ENTITIES', ['LINE']]]))).toBe('dxf');
    expect(sniffPlanContent(latin1('AutoCAD Binary DXF\r\n\x1a\0'))).toBe('dxf');
    expect(sniffPlanContent(latin1('PK\x03\x04'))).toBe('unknown');
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
    const warnings = await planPrecisionWarnings(PNG_HEAD, 'niveau-0.png');
    expect(warnings).toEqual([{
      code: 'IMPORT.RASTER_PRECISION_LIMITED',
      severity: 'warning',
      entity: null,
      params: { content: 'raster', file: 'niveau-0.png' },
      ruleRef: 'partieM-M2',
    }]);
  });

  it('c’est le contenu qui compte : un JPEG nommé .pdf, un PDF nommé .png', async () => {
    const jpegAsPdf = await planPrecisionWarnings(JPEG_HEAD, 'plan.pdf');
    expect(jpegAsPdf.map(w => w.params['content'])).toEqual(['raster']);
    expect(await planPrecisionWarnings(pdf(plain('0 0 m 1 0 l S')), 'plan.png')).toEqual([]);
  });

  it('un PDF qui se présente comme vectoriel sans l’être lève l’avertissement', async () => {
    const scan = pdf(flate('q 595 0 0 842 0 0 cm /Im0 Do Q'), scannedImage);
    const warnings = await planPrecisionWarnings(scan, 'plan-vectoriel.pdf');
    expect(warnings.map(w => [w.code, w.severity, w.params['content']]))
      .toEqual([['IMPORT.RASTER_PRECISION_LIMITED', 'warning', 'pdf_without_paths']]);
  });

  it('un fichier illisible lève l’avertissement, contenu indéterminé', () => {
    expect(unreadablePlanWarnings('plan.pdf').map(w => [w.code, w.params['content']]))
      .toEqual([['IMPORT.RASTER_PRECISION_LIMITED', 'undetermined']]);
  });

  it('un fond vectoriel ne lève rien', async () => {
    expect(await planPrecisionWarnings(dxf([['ENTITIES', ['LINE']]]), 'plan.dxf')).toEqual([]);
  });
});
