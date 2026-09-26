import { decodePdfStream, listPdfStreams, pdfText } from './pdf-streams.js';
import type { PdfStream } from './pdf-streams.js';

/**
 * M2 (partie M) — « Page | sélecteur | si PDF multipage, requis |
 * `IMPORT.PAGE_REQUIRED` ». Version 28 : le nombre de pages d'un PDF n'était
 * jamais lu, et le code de page requise ne se levait donc jamais.
 *
 * Le nombre de pages se lit dans l'arbre des pages : le catalogue que désigne
 * le dernier `/Root` du fichier, son nœud `/Pages`, et le `/Count` de ce nœud.
 * Les objets se lisent dans l'ordre du fichier, la dernière révision d'un
 * objet l'emportant, qu'elle soit écrite en clair ou rangée dans un flux
 * d'objets (`/Type /ObjStm`) : c'est ce qu'une mise à jour incrémentale
 * produit.
 *
 * Quand l'arbre ne se lit pas, le compte retombe sur les objets de type
 * `/Page` de la dernière révision. Quand rien ne se lit, il rend `null` : un
 * nombre de pages inconnu n'est pas un nombre de pages.
 */
export async function countPdfPages(bytes: Uint8Array): Promise<number | null> {
  const text = pdfText(bytes);
  const objects = await readObjects(bytes, text);
  const fromTree = pageTreeCount(text, objects);
  if (fromTree !== null) return fromTree;
  const pages = [...objects.values()].filter(body => /\/Type\s*\/Page(?![A-Za-z])/.test(body)).length;
  return pages > 0 ? pages : null;
}

function pageTreeCount(text: string, objects: ReadonlyMap<number, string>): number | null {
  const roots = [...text.matchAll(/\/Root\s+(\d+)\s+\d+\s+R/g)];
  const root = roots[roots.length - 1]?.[1];
  if (root === undefined) return null;
  const pagesRef = /\/Pages\s+(\d+)\s+\d+\s+R/.exec(objects.get(Number(root)) ?? '')?.[1];
  if (pagesRef === undefined) return null;
  const count = /\/Count\s+(\d+)/.exec(objects.get(Number(pagesRef)) ?? '')?.[1];
  return count === undefined || Number(count) === 0 ? null : Number(count);
}

/** Numéro d'objet → corps de sa dernière révision, flux d'objets compris. */
async function readObjects(bytes: Uint8Array, text: string): Promise<Map<number, string>> {
  const objects = new Map<number, string>();
  const streams = listPdfStreams(bytes, text);
  for (const header of text.matchAll(/(\d+)\s+\d+\s+obj\b/g)) {
    const start = header.index + header[0].length;
    const close = text.indexOf('endobj', start);
    const end = close < 0 ? text.length : close;
    const body = text.slice(start, end);
    objects.set(Number(header[1]), body);
    if (/\/Type\s*\/ObjStm\b/.test(body)) {
      const stream = streams.find(s => s.at >= start && s.at < end);
      if (stream !== undefined) await readObjectStream(stream, objects);
    }
  }
  return objects;
}

/** Un flux d'objets : un en-tête de paires `numéro décalage`, puis les objets. */
async function readObjectStream(stream: PdfStream, objects: Map<number, string>): Promise<void> {
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
    objects.set(number, decoded.slice(first + offset, next === undefined ? decoded.length : first + next));
  }
}
