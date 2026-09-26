/**
 * M2 (partie M) — la table des objets d'un PDF, lue sans bibliothèque (A3.3).
 *
 * Les objets se lisent dans l'ordre du fichier, la dernière révision d'un
 * objet l'emportant, qu'elle soit écrite en clair ou rangée dans un flux
 * d'objets (`/Type /ObjStm`) : c'est ce qu'une mise à jour incrémentale
 * produit. Le catalogue est celui que désigne le dernier `/Root` du fichier.
 */
import { decodePdfStream, listPdfStreams, pdfText } from './pdf-streams.js';
import type { PdfStream } from './pdf-streams.js';
import { parseDictionary, referenceOf } from './pdf-syntax.js';

export type PdfObject = {
  /** Le texte de l'objet, entre `obj` et `endobj`. */
  readonly body: string;
  /** Son flux, s'il en porte un. Un objet rangé dans un flux d'objets n'en porte jamais. */
  readonly stream: PdfStream | null;
};

export type PdfDocument = {
  readonly objects: ReadonlyMap<number, PdfObject>;
  /** Le catalogue que désigne le dernier `/Root` du fichier, ou `null`. */
  readonly root: number | null;
};

export async function readPdfDocument(bytes: Uint8Array): Promise<PdfDocument> {
  const text = pdfText(bytes);
  const objects = new Map<number, PdfObject>();
  const streams = listPdfStreams(bytes, text);
  for (const header of text.matchAll(/(\d+)\s+\d+\s+obj\b/g)) {
    const start = header.index + header[0].length;
    const close = text.indexOf('endobj', start);
    const end = close < 0 ? text.length : close;
    const stream = streamWithin(streams, start, end);
    objects.set(Number(header[1]), { body: text.slice(start, end), stream });
    if (stream !== null && /\/Type\s*\/ObjStm\b/.test(stream.dict)) await readObjectStream(stream, objects);
  }
  const roots = [...text.matchAll(/\/Root\s+(\d+)\s+\d+\s+R/g)];
  const root = roots[roots.length - 1]?.[1];
  return { objects, root: root === undefined ? null : Number(root) };
}

/** Le premier flux compris entre deux positions ; les flux sont rangés par position. */
function streamWithin(streams: readonly PdfStream[], start: number, end: number): PdfStream | null {
  let low = 0;
  let high = streams.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if ((streams[mid]?.at ?? Infinity) < start) low = mid + 1; else high = mid;
  }
  const found = streams[low];
  return found !== undefined && found.at < end ? found : null;
}

/** Un flux d'objets : un en-tête de paires `numéro décalage`, puis les objets. */
async function readObjectStream(stream: PdfStream, objects: Map<number, PdfObject>): Promise<void> {
  const count = Number(/\/N\s+(\d+)/.exec(stream.dict)?.[1] ?? NaN);
  const first = Number(/\/First\s+(\d+)/.exec(stream.dict)?.[1] ?? NaN);
  if (!Number.isInteger(count) || !Number.isInteger(first)) return;
  const decoded = await decodePdfStream(stream);
  if (decoded === null) return;
  const header = decoded.slice(0, first).trim().split(/\s+/).map(Number);
  for (let i = 0; i < count; i += 1) {
    const number = header[2 * i];
    const offset = header[2 * i + 1];
    if (number === undefined || offset === undefined) return;
    const next = header[2 * i + 3];
    objects.set(number, { body: decoded.slice(first + offset, next === undefined ? decoded.length : first + next), stream: null });
  }
}

/** Le dictionnaire d'un objet, ou `null` s'il manque ou n'en est pas un. */
export function dictionaryOfObject(doc: PdfDocument, number: number): ReadonlyMap<string, string> | null {
  const object = doc.objects.get(number);
  return object === undefined ? null : parseDictionary(object.body, 0);
}

/**
 * Le dictionnaire que désigne une valeur : écrit en ligne, ou par référence.
 * `null` quand il ne se lit pas.
 */
export function resolveDictionary(doc: PdfDocument, value: string): ReadonlyMap<string, string> | null {
  const ref = referenceOf(value);
  return ref === null ? parseDictionary(value, 0) : dictionaryOfObject(doc, ref);
}
