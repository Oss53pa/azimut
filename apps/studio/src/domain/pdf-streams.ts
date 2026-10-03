/**
 * M2 (partie M) — la lecture des flux d'un PDF, commune au compte des tracés
 * et au compte des pages.
 *
 * Elle ne lit que ce qu'elle sait lire sans bibliothèque (A3.3) : les flux sans
 * filtre et les flux `FlateDecode`, décompressés par `DecompressionStream`,
 * que le navigateur et Node fournissent. Un flux qu'elle ne sait pas décoder
 * rend `null`, jamais un contenu supposé.
 */

export type PdfStream = {
  /** Position du mot-clé `stream` dans le fichier. */
  readonly at: number;
  /** Le dictionnaire `<< … >>` qui le précède. */
  readonly dict: string;
  /** Les octets du flux, encore codés. */
  readonly data: Uint8Array;
};

/** Un octet, un caractère : les positions du texte sont celles des octets. */
export function pdfText(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes);
}

export function isPdfWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t' || ch === '\f' || ch === '\0';
}

export function listPdfStreams(bytes: Uint8Array, text: string = pdfText(bytes)): PdfStream[] {
  const streams: PdfStream[] = [];
  const streamStart = /(?<!end)stream(?:\r\n|\n)/g;
  for (let match = streamStart.exec(text); match !== null; match = streamStart.exec(text)) {
    const dataStart = match.index + match[0].length;
    const marker = text.indexOf('endstream', dataStart);
    if (marker < 0) break;
    const dict = dictionaryBefore(text, match.index);
    streams.push({ at: match.index, dict, data: bytes.subarray(dataStart, dataEnd(text, dict, dataStart, marker)) });
  }
  return streams;
}

/**
 * La fin des données. Une longueur directe fait foi ; une référence indirecte
 * (`12 0 R`) ne se résout pas sans la table des objets, et l'on s'en tient au
 * marqueur, sans la fin de ligne qui le précède : la garder ferait refuser le
 * flux compressé pour octets en trop.
 */
function dataEnd(text: string, dict: string, dataStart: number, marker: number): number {
  const declared = /\/Length\s+(\d+)\b(?!\s+\d+\s+R)/.exec(dict)?.[1];
  if (declared !== undefined && dataStart + Number(declared) <= marker) return dataStart + Number(declared);
  let end = marker;
  if (text.charAt(end - 1) === '\n') end -= 1;
  if (text.charAt(end - 1) === '\r') end -= 1;
  return end;
}

/** Le dictionnaire `<< … >>` qui précède un mot-clé `stream`. */
function dictionaryBefore(text: string, streamIndex: number): string {
  let end = streamIndex - 1;
  while (end >= 0 && isPdfWhitespace(text.charAt(end))) end -= 1;
  if (text.slice(end - 1, end + 1) !== '>>') return '';
  let depth = 0;
  for (let k = end; k > 0; k -= 1) {
    const pair = text.slice(k - 1, k + 1);
    if (pair === '>>') { depth += 1; k -= 1; } else if (pair === '<<') {
      depth -= 1;
      if (depth === 0) return text.slice(k - 1, end + 1);
      k -= 1;
    }
  }
  return '';
}

/** Le contenu décodé d'un flux, ou `null` s'il n'est pas décodable ici. */
export async function decodePdfStream(stream: Pick<PdfStream, 'dict' | 'data'>): Promise<string | null> {
  const filter = /\/Filter\s*(\[[^\]]*\]|\/[A-Za-z0-9]+)/.exec(stream.dict)?.[1];
  const filters = filter === undefined ? [] : [...filter.matchAll(/\/([A-Za-z0-9]+)/g)].map(m => m[1]);
  if (filters.length === 0) return pdfText(stream.data);
  const flate = filters.length === 1 && (filters[0] === 'FlateDecode' || filters[0] === 'Fl');
  if (!flate || /\/Predictor\s*(?:[2-9]|\d\d)/.test(stream.dict)) return null;
  try {
    const inflating = new Blob([new Uint8Array(stream.data)]).stream()
      .pipeThrough(new DecompressionStream('deflate'));
    return pdfText(new Uint8Array(await new Response(inflating).arrayBuffer()));
  } catch {
    return null;
  }
}
