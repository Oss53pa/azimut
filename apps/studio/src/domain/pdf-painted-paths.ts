/**
 * M2 (partie M), version 27 — « Un fichier sans contenu vectoriel exploitable
 * est accepté en dernier recours et lève `IMPORT.RASTER_PRECISION_LIMITED`.
 * Cela vise l'image en mode point comme le PDF qui se présente comme vectoriel
 * sans l'être : c'est le contenu qui est contrôlé, jamais l'extension. »
 *
 * Ce module compte les tracés peints d'un PDF : un chemin construit (`m`, `l`,
 * `c`, `v`, `y`, `re`, `h`) puis peint (`S`, `s`, `f`, `F`, `f*`, `B`, `B*`,
 * `b`, `b*`). Un chemin fermé par `n` ne peint rien : c'est la découpe qui
 * entoure l'image d'un plan numérisé, et elle ne fait pas un tracé.
 *
 * Il ne lit que ce qu'il sait lire sans bibliothèque : les flux sans filtre et
 * les flux `FlateDecode`, décompressés par `DecompressionStream`, que le
 * navigateur et Node fournissent. Un flux qu'il ne sait pas décoder est
 * compté comme tel, jamais supposé vide ni supposé vectoriel.
 */

export type PdfPaintedPaths = {
  /** Chemins peints dans les flux de contenu lus. */
  readonly painted: number;
  /** Flux de contenu qui n'ont pas pu être décodés. */
  readonly undecodable: number;
};

/** Flux qui ne sont pas du contenu de page : images, polices, index, métadonnées. */
const NOT_CONTENT = [
  /\/Subtype\s*\/Image\b/,
  /\/Type\s*\/(?:ObjStm|XRef|Metadata|EmbeddedFile)\b/,
  /\/Length[123]\b/,
  /\/Subtype\s*\/(?:Type1C|CIDFontType0C|OpenType|XML)\b/,
] as const;

export async function countPdfPaintedPaths(bytes: Uint8Array): Promise<PdfPaintedPaths> {
  // Un octet, un caractère : les positions du texte sont celles des octets.
  const text = new TextDecoder('latin1').decode(bytes);
  let painted = 0;
  let undecodable = 0;
  const streamStart = /(?<!end)stream(?:\r\n|\n)/g;
  for (let match = streamStart.exec(text); match !== null; match = streamStart.exec(text)) {
    const dataStart = match.index + match[0].length;
    const marker = text.indexOf('endstream', dataStart);
    if (marker < 0) break;
    // La fin de ligne qui précède `endstream` n'appartient pas aux données :
    // la garder ferait refuser le flux compressé pour octets en trop.
    // Une longueur directe fait foi ; une référence indirecte (`12 0 R`) ne se
    // résout pas sans la table des objets, et l'on s'en tient au marqueur.
    const dict = dictionaryBefore(text, match.index);
    const declared = /\/Length\s+(\d+)\b(?!\s+\d+\s+R)/.exec(dict)?.[1];
    let dataEnd = marker;
    if (declared !== undefined && dataStart + Number(declared) <= marker) {
      dataEnd = dataStart + Number(declared);
    } else {
      if (text.charAt(dataEnd - 1) === '\n') dataEnd -= 1;
      if (text.charAt(dataEnd - 1) === '\r') dataEnd -= 1;
    }
    if (NOT_CONTENT.some(pattern => pattern.test(dict))) continue;
    const content = await decodeStream(dict, bytes.subarray(dataStart, dataEnd));
    if (content === null) { undecodable += 1; continue; }
    painted += countPaintedPaths(content);
  }
  return { painted, undecodable };
}

/** Le dictionnaire `<< … >>` qui précède un mot-clé `stream`. */
function dictionaryBefore(text: string, streamIndex: number): string {
  let end = streamIndex - 1;
  while (end >= 0 && isWhitespace(text.charAt(end))) end -= 1;
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

async function decodeStream(dict: string, data: Uint8Array): Promise<string | null> {
  const filter = /\/Filter\s*(\[[^\]]*\]|\/[A-Za-z0-9]+)/.exec(dict)?.[1];
  const filters = filter === undefined ? [] : [...filter.matchAll(/\/([A-Za-z0-9]+)/g)].map(m => m[1]);
  if (filters.length === 0) return new TextDecoder('latin1').decode(data);
  const flate = filters.length === 1 && (filters[0] === 'FlateDecode' || filters[0] === 'Fl');
  if (!flate || /\/Predictor\s*(?:[2-9]|\d\d)/.test(dict)) return null;
  try {
    const stream = new Blob([new Uint8Array(data)]).stream()
      .pipeThrough(new DecompressionStream('deflate'));
    const inflated = new Uint8Array(await new Response(stream).arrayBuffer());
    return new TextDecoder('latin1').decode(inflated);
  } catch {
    return null;
  }
}

const PATH_CONSTRUCTION = new Set(['m', 'l', 'c', 'v', 'y', 're', 'h']);
const PATH_PAINTING = new Set(['S', 's', 'f', 'F', 'f*', 'B', 'B*', 'b', 'b*']);
const DELIMITERS = '()<>[]{}/%';

/** Compte les chemins peints d'un flux de contenu décodé. */
export function countPaintedPaths(content: string): number {
  let painted = 0;
  let pathOpen = false;
  let i = 0;
  while (i < content.length) {
    const ch = content.charAt(i);
    if (isWhitespace(ch)) { i += 1; continue; }
    if (ch === '%') { i = endOfLine(content, i); continue; }
    if (ch === '(') { i = endOfLiteralString(content, i); continue; }
    if (ch === '<') { i = content.charAt(i + 1) === '<' ? i + 2 : endOf(content, i, '>'); continue; }
    if (ch === '/') { i = endOfToken(content, i + 1); continue; }
    if (DELIMITERS.includes(ch)) { i += 1; continue; }
    const end = endOfToken(content, i);
    const token = content.slice(i, end);
    i = end;
    if (token === 'BI') { i = endOfInlineImage(content, i); continue; }
    if (PATH_CONSTRUCTION.has(token)) pathOpen = true;
    else if (PATH_PAINTING.has(token)) { if (pathOpen) painted += 1; pathOpen = false; }
    else if (token === 'n') pathOpen = false;
  }
  return painted;
}

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t' || ch === '\f' || ch === '\0';
}

function endOfToken(content: string, from: number): number {
  let i = from;
  while (i < content.length && !isWhitespace(content.charAt(i)) && !DELIMITERS.includes(content.charAt(i))) i += 1;
  return i;
}

function endOfLine(content: string, from: number): number {
  let i = from;
  while (i < content.length && content.charAt(i) !== '\n' && content.charAt(i) !== '\r') i += 1;
  return i;
}

function endOf(content: string, from: number, closing: string): number {
  const at = content.indexOf(closing, from + 1);
  return at < 0 ? content.length : at + 1;
}

/** Une chaîne littérale : parenthèses imbriquées, échappements par `\`. */
function endOfLiteralString(content: string, from: number): number {
  let depth = 0;
  for (let i = from; i < content.length; i += 1) {
    const ch = content.charAt(i);
    if (ch === '\\') { i += 1; continue; }
    if (ch === '(') depth += 1;
    else if (ch === ')') { depth -= 1; if (depth === 0) return i + 1; }
  }
  return content.length;
}

/** Une image en ligne : `BI … ID <octets> EI`, dont les octets ne sont pas du contenu. */
function endOfInlineImage(content: string, from: number): number {
  const data = /\sID\s/g;
  data.lastIndex = from;
  const start = data.exec(content);
  if (start === null) return content.length;
  const close = /\sEI(?=\s|$)/g;
  close.lastIndex = start.index + start[0].length;
  const end = close.exec(content);
  return end === null ? content.length : end.index + end[0].length;
}
