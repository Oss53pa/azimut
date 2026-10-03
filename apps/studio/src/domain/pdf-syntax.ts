/**
 * M2 (partie M) — la syntaxe des objets PDF, commune au lecteur de contenu et
 * au lecteur de dictionnaires : où finit un nom, une chaîne, une valeur.
 *
 * Une valeur mal formée rend `null`, jamais une fin supposée : le suivi d'une
 * page qui bute sur elle ne conclut pas (version 29).
 */
import { isPdfWhitespace } from './pdf-streams.js';

export const PDF_DELIMITERS = '()<>[]{}/%';

export function endOfToken(text: string, from: number): number {
  let i = from;
  while (i < text.length && !isPdfWhitespace(text.charAt(i)) && !PDF_DELIMITERS.includes(text.charAt(i))) i += 1;
  return i;
}

export function endOfLine(text: string, from: number): number {
  let i = from;
  while (i < text.length && text.charAt(i) !== '\n' && text.charAt(i) !== '\r') i += 1;
  return i;
}

/** Une chaîne littérale : parenthèses imbriquées, échappements par `\`. */
export function endOfLiteralString(text: string, from: number): number {
  let depth = 0;
  for (let i = from; i < text.length; i += 1) {
    const ch = text.charAt(i);
    if (ch === '\\') { i += 1; continue; }
    if (ch === '(') depth += 1;
    else if (ch === ')') { depth -= 1; if (depth === 0) return i + 1; }
  }
  return text.length;
}

/** Saute les blancs et les commentaires. */
export function skipSpace(text: string, from: number): number {
  let i = from;
  while (i < text.length) {
    const ch = text.charAt(i);
    if (isPdfWhitespace(ch)) i += 1;
    else if (ch === '%') i = endOfLine(text, i);
    else break;
  }
  return i;
}

const REFERENCE = /\d+\s+\d+\s+R(?![^\s()<>[\]{}/%])/y;

/** La fin de la valeur qui commence en `from`, ou `null` si elle est mal formée. */
export function endOfValue(text: string, from: number): number | null {
  const ch = text.charAt(from);
  if (from >= text.length) return null;
  if (text.startsWith('<<', from)) return endOfSequence(text, from + 2, '>>');
  if (ch === '[') return endOfSequence(text, from + 1, ']');
  if (ch === '(') return closedAt(text, endOfLiteralString(text, from), ')');
  if (ch === '<') { const at = text.indexOf('>', from); return at < 0 ? null : at + 1; }
  if (ch === '/') return endOfToken(text, from + 1);
  REFERENCE.lastIndex = from;
  if (REFERENCE.test(text)) return REFERENCE.lastIndex;
  const end = endOfToken(text, from);
  return end > from ? end : null;
}

function closedAt(text: string, end: number, closing: string): number | null {
  return text.charAt(end - 1) === closing ? end : null;
}

/** Les valeurs d'un dictionnaire ou d'un tableau, jusqu'à leur fermeture. */
function endOfSequence(text: string, from: number, closing: string): number | null {
  let i = skipSpace(text, from);
  while (i < text.length) {
    if (text.startsWith(closing, i)) return i + closing.length;
    const end = endOfValue(text, i);
    if (end === null) return null;
    i = skipSpace(text, end);
  }
  return null;
}

/**
 * Les entrées de premier niveau du dictionnaire qui commence en `from`. Les
 * clés imbriquées n'y figurent pas : un `/Contents` d'annotation écrite en
 * ligne n'est pas le contenu de la page.
 */
export function parseDictionary(text: string, from: number): ReadonlyMap<string, string> | null {
  const start = skipSpace(text, from);
  if (!text.startsWith('<<', start)) return null;
  const entries = new Map<string, string>();
  let i = skipSpace(text, start + 2);
  while (i < text.length) {
    if (text.startsWith('>>', i)) return entries;
    if (text.charAt(i) !== '/') return null;
    const keyEnd = endOfToken(text, i + 1);
    const valueStart = skipSpace(text, keyEnd);
    const valueEnd = endOfValue(text, valueStart);
    if (valueEnd === null) return null;
    entries.set(text.slice(i + 1, keyEnd), text.slice(valueStart, valueEnd));
    i = skipSpace(text, valueEnd);
  }
  return null;
}

/** Le numéro d'objet d'une référence `12 0 R`, ou `null` si la valeur n'en est pas une. */
export function referenceOf(value: string | undefined): number | null {
  const match = /^\s*(\d+)\s+\d+\s+R\s*$/.exec(value ?? '');
  return match === null ? null : Number(match[1]);
}

/** Les références d'un tableau `[1 0 R 2 0 R]`, ou `null` s'il porte autre chose. */
export function referencesOf(value: string): number[] | null {
  const inner = /^\s*\[([^\]]*)\]\s*$/.exec(value)?.[1];
  if (inner === undefined) return null;
  const refs = [...inner.matchAll(/(\d+)\s+\d+\s+R/g)].map(m => Number(m[1]));
  const rest = inner.replace(/(\d+)\s+\d+\s+R/g, '').trim();
  return rest === '' ? refs : null;
}
