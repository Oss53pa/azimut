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
 * Les flux se lisent par `pdf-streams.ts`. Un flux qui ne se décode pas est
 * compté comme tel, jamais supposé vide ni supposé vectoriel.
 */
import { decodePdfStream, isPdfWhitespace, listPdfStreams } from './pdf-streams.js';

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
  let painted = 0;
  let undecodable = 0;
  for (const stream of listPdfStreams(bytes)) {
    if (NOT_CONTENT.some(pattern => pattern.test(stream.dict))) continue;
    const content = await decodePdfStream(stream);
    if (content === null) { undecodable += 1; continue; }
    painted += countPaintedPaths(content);
  }
  return { painted, undecodable };
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
    if (isPdfWhitespace(ch)) { i += 1; continue; }
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

function endOfToken(content: string, from: number): number {
  let i = from;
  while (i < content.length && !isPdfWhitespace(content.charAt(i)) && !DELIMITERS.includes(content.charAt(i))) i += 1;
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
