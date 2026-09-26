import { deflateSync } from 'node:zlib';

/**
 * Des PDF d'essai, construits octet par octet : aucun plan réel (A2.4). Ils
 * n'ont ni table de références ni polices : le lecteur n'en a pas besoin, il
 * suit les objets depuis le catalogue que désigne `/Root`.
 */

export const latin1 = (text: string): Uint8Array => Uint8Array.from(text, ch => ch.charCodeAt(0));

export type PdfStreamSpec = {
  readonly dict: string;
  readonly data: Uint8Array;
  /** La longueur déclarée, quand elle n'est pas écrite en clair : `5 0 R`. */
  readonly length?: string;
};

/** Un objet : un dictionnaire ou un tableau écrit en clair, ou un flux. */
export type PdfObjectSpec = string | PdfStreamSpec;

export const plain = (content: string): PdfStreamSpec => ({ dict: '', data: latin1(content) });
export const flate = (content: string): PdfStreamSpec =>
  ({ dict: '/Filter /FlateDecode', data: new Uint8Array(deflateSync(latin1(content))) });

/** Une « image » dont les octets imitent des opérateurs de tracé : elle ne doit pas compter. */
export const scannedImage: PdfStreamSpec = {
  dict: '/Type /XObject /Subtype /Image /Width 2 /Height 2 /BitsPerComponent 8 /ColorSpace /DeviceGray',
  data: latin1('0 0 m 10 0 l S 0 0 5 5 re f'),
};

/** Un formulaire : un contenu que la page invoque par `Do`. */
export const form = (content: string, resources = ''): PdfStreamSpec => ({
  dict: `/Type /XObject /Subtype /Form /BBox [0 0 100 100]${resources === '' ? '' : ` /Resources ${resources}`}`,
  data: latin1(content),
});

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}

/** Les objets numérotés à partir de 1, dans l'ordre, puis la fin donnée. */
export function pdfFile(objects: readonly PdfObjectSpec[], tail = 'trailer\n<< /Root 1 0 R >>\n'): Uint8Array {
  const parts: Uint8Array[] = [latin1('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n')];
  objects.forEach((object, i) => {
    if (typeof object === 'string') { parts.push(latin1(`${i + 1} 0 obj\n${object}\nendobj\n`)); return; }
    parts.push(latin1(`${i + 1} 0 obj\n<< ${object.dict} /Length ${object.length ?? object.data.length} >>\nstream\n`));
    parts.push(object.data);
    parts.push(latin1('\nendstream\nendobj\n'));
  });
  parts.push(latin1(`${tail}%%EOF\n`));
  return concat(parts);
}

/**
 * Un PDF d'une page : catalogue (1), nœud des pages (2), page (3), puis les
 * flux de contenu, puis les objets externes, nommés `X0`, `X1`… dans les
 * ressources de la page.
 */
export function onePagePdf(contents: readonly PdfStreamSpec[], externals: readonly PdfStreamSpec[] = []): Uint8Array {
  const first = 4;
  const contentRefs = contents.map((_, i) => `${first + i} 0 R`).join(' ');
  const xobjects = externals.map((_, i) => `/X${i} ${first + contents.length + i} 0 R`).join(' ');
  return pdfFile([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /Contents [${contentRefs}] /Resources << /XObject << ${xobjects} >> >> >>`,
    ...contents,
    ...externals,
  ]);
}
