import { dictionaryOfObject, readPdfDocument, resolveDictionary } from './pdf-objects.js';
import type { PdfDocument } from './pdf-objects.js';
import { referenceOf, referencesOf } from './pdf-syntax.js';

/**
 * M2 (partie M) — « Page | sélecteur | si PDF multipage, requis |
 * `IMPORT.PAGE_REQUIRED` ». Version 28 : le nombre de pages d'un PDF n'était
 * jamais lu, et le code de page requise ne se levait donc jamais.
 *
 * Version 29 : la nature d'un document de plusieurs pages se juge sur la page
 * retenue. Les pages se lisent donc une à une, dans l'ordre de l'arbre des
 * pages : le catalogue, son nœud `/Pages`, et les `/Kids` de chaque nœud.
 */

/**
 * Les objets page du document, dans l'ordre de lecture. `null` quand l'arbre
 * ne se suit pas jusqu'au bout : un nœud introuvable, d'un type inconnu, ou
 * visité deux fois. Un arbre suivi à moitié ne dit pas quelle page est la
 * deuxième.
 */
export function listPdfPages(doc: PdfDocument): number[] | null {
  if (doc.root === null) return null;
  const top = referenceOf(dictionaryOfObject(doc, doc.root)?.get('Pages'));
  if (top === null) return null;
  const pages: number[] = [];
  const seen = new Set<number>();
  const walk = (node: number): boolean => {
    if (seen.has(node)) return false;
    seen.add(node);
    const dict = dictionaryOfObject(doc, node);
    const type = dict?.get('Type')?.trim();
    if (type === '/Page') { pages.push(node); return true; }
    if (type !== '/Pages') return false;
    const kids = kidsOf(doc, dict?.get('Kids'));
    return kids !== null && kids.every(walk);
  };
  return walk(top) ? pages : null;
}

/** Les enfants d'un nœud : un tableau de références, en ligne ou par référence. */
function kidsOf(doc: PdfDocument, value: string | undefined): number[] | null {
  if (value === undefined) return null;
  const ref = referenceOf(value);
  if (ref === null) return referencesOf(value);
  const body = doc.objects.get(ref)?.body;
  return body === undefined ? null : referencesOf(body);
}

/**
 * Le nombre de pages. L'arbre suivi jusqu'au bout fait foi ; à défaut, le
 * `/Count` du nœud des pages ; à défaut, les objets de type `/Page` de la
 * dernière révision. Quand rien ne se lit, il rend `null` : un nombre de
 * pages inconnu n'est pas un nombre de pages.
 */
export function countPdfPagesOf(doc: PdfDocument): number | null {
  const walked = listPdfPages(doc);
  if (walked !== null && walked.length > 0) return walked.length;
  const fromCount = declaredCount(doc);
  if (fromCount !== null) return fromCount;
  const pages = [...doc.objects.values()].filter(o => /\/Type\s*\/Page(?![A-Za-z])/.test(o.body)).length;
  return pages > 0 ? pages : null;
}

export async function countPdfPages(bytes: Uint8Array): Promise<number | null> {
  return countPdfPagesOf(await readPdfDocument(bytes));
}

function declaredCount(doc: PdfDocument): number | null {
  if (doc.root === null) return null;
  const pages = dictionaryOfObject(doc, doc.root)?.get('Pages');
  const count = /^\s*(\d+)\s*$/.exec((pages === undefined ? undefined : resolveDictionary(doc, pages))?.get('Count') ?? '')?.[1];
  return count === undefined || Number(count) === 0 ? null : Number(count);
}
