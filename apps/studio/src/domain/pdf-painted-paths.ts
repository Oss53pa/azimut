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
 * Version 29 : le contenu lu est celui de la page retenue, suivi par
 * `pdf-page-nature.ts`. Ce module dit, d'un flux de contenu décodé, combien de
 * chemins il peint et quels objets externes il invoque par `Do`.
 */
import { isPdfWhitespace } from './pdf-streams.js';
import { PDF_DELIMITERS, endOfLine, endOfLiteralString, endOfToken } from './pdf-syntax.js';

export type ContentScan = {
  /** Chemins peints. */
  readonly painted: number;
  /** Noms des objets externes invoqués par `Do`, dans l'ordre, sans doublon. */
  readonly invoked: readonly string[];
};

const PATH_CONSTRUCTION = new Set(['m', 'l', 'c', 'v', 'y', 're', 'h']);
const PATH_PAINTING = new Set(['S', 's', 'f', 'F', 'f*', 'B', 'B*', 'b', 'b*']);

/** Compte les chemins peints d'un flux de contenu décodé. */
export function countPaintedPaths(content: string): number {
  return scanContent(content).painted;
}

/** Lit un flux de contenu décodé : chemins peints et objets invoqués. */
export function scanContent(content: string): ContentScan {
  let painted = 0;
  let pathOpen = false;
  const invoked = new Set<string>();
  let lastName: string | null = null;
  let i = 0;
  while (i < content.length) {
    const ch = content.charAt(i);
    if (isPdfWhitespace(ch)) { i += 1; continue; }
    if (ch === '%') { i = endOfLine(content, i); continue; }
    if (ch === '(') { i = endOfLiteralString(content, i); continue; }
    if (ch === '<') { i = content.charAt(i + 1) === '<' ? i + 2 : endOf(content, i, '>'); continue; }
    if (ch === '/') { const end = endOfToken(content, i + 1); lastName = content.slice(i + 1, end); i = end; continue; }
    if (PDF_DELIMITERS.includes(ch)) { lastName = null; i += 1; continue; }
    const end = endOfToken(content, i);
    const token = content.slice(i, end);
    i = end;
    if (token === 'Do' && lastName !== null) invoked.add(lastName);
    lastName = null;
    if (token === 'BI') { i = endOfInlineImage(content, i); continue; }
    if (PATH_CONSTRUCTION.has(token)) pathOpen = true;
    else if (PATH_PAINTING.has(token)) { if (pathOpen) painted += 1; pathOpen = false; }
    else if (token === 'n') pathOpen = false;
  }
  return { painted, invoked: [...invoked] };
}

function endOf(content: string, from: number, closing: string): number {
  const at = content.indexOf(closing, from + 1);
  return at < 0 ? content.length : at + 1;
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
