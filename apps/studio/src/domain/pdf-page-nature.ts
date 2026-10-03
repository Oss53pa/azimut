/**
 * M2 (partie M), version 29 — « Pour un document de plusieurs pages, la
 * nature se juge sur la page retenue, en suivant les objets qu'elle
 * référence, et non sur le fichier entier : les tracés d'une autre page
 * masqueraient l'absence de tracés sur celle qui est importée. Quand le suivi
 * ne permet pas de conclure, la nature est indéterminée, jamais vectorielle. »
 *
 * Le suivi part de l'objet page. Il lit ses flux de contenu (`/Contents`),
 * puis chaque objet externe que ce contenu invoque réellement par `Do`,
 * résolu dans les ressources de la page, les siennes ou celles héritées de
 * l'arbre. Un formulaire (`/Subtype /Form`) se lit comme du contenu, avec ses
 * propres ressources ; une image ne porte aucun tracé.
 *
 * Il ne suit pas tout ce que la page référence :
 * - une ressource déclarée et jamais invoquée n'est pas lue. Des ressources
 *   partagées au niveau de l'arbre porteraient sinon les formulaires des
 *   autres pages : c'est l'optimisme que la version 29 écarte ;
 * - les annotations ne sont pas lues. Elles se superposent à la page sans en
 *   être le contenu ; les ignorer ne peut que faire manquer un tracé, jamais
 *   en prêter un.
 *
 * Chaque objet qui ne se lit pas — flux introuvable ou non décodable, nom
 * invoqué absent des ressources, objet externe d'un type inconnu,
 * formulaire qui s'invoque lui-même — est compté. Un tracé lu suffit à
 * conclure ; sans tracé, un seul objet non lu rend la page indéterminée.
 */
import { decodePdfStream } from './pdf-streams.js';
import { dictionaryOfObject, readPdfDocument, resolveDictionary } from './pdf-objects.js';
import type { PdfDocument } from './pdf-objects.js';
import { countPdfPagesOf, listPdfPages } from './pdf-pages.js';
import { scanContent } from './pdf-painted-paths.js';
import { parseDictionary, referenceOf, referencesOf } from './pdf-syntax.js';

export type PdfPageNature = {
  /** Chemins peints dans le contenu suivi. */
  readonly painted: number;
  /** Objets que le suivi n'a pas pu lire. */
  readonly unresolved: number;
};

export type PdfReading = {
  readonly pageCount: number | null;
  /** La nature de chaque page, dans l'ordre de l'arbre ; `null` si l'arbre ne se suit pas. */
  readonly pages: readonly PdfPageNature[] | null;
};

type Resources = ReadonlyMap<string, string> | null;

/** Ce que le suivi d'une page a lu. Un formulaire invoqué deux fois ne se lit qu'une. */
type Tally = { painted: number; unresolved: number; readonly forms: Set<number> };

export async function readPdfPages(bytes: Uint8Array): Promise<PdfReading> {
  const doc = await readPdfDocument(bytes);
  const pageCount = countPdfPagesOf(doc);
  const pages = listPdfPages(doc);
  if (pages === null) return { pageCount, pages: null };
  const reader = new PageReader(doc);
  const natures: PdfPageNature[] = [];
  for (const page of pages) natures.push(await reader.judge(page));
  return { pageCount, pages: natures };
}

class PageReader {
  private readonly decoded = new Map<number, Promise<string | null>>();

  constructor(private readonly doc: PdfDocument) {}

  async judge(page: number): Promise<PdfPageNature> {
    const tally: Tally = { painted: 0, unresolved: 0, forms: new Set() };
    const contents = dictionaryOfObject(this.doc, page)?.get('Contents');
    if (contents === undefined) return { painted: 0, unresolved: 0 };
    const streams = this.contentStreams(contents);
    if (streams === null) return { painted: 0, unresolved: 1 };
    await this.readContent(streams, this.resourcesOf(page), tally, new Set([page]));
    return { painted: tally.painted, unresolved: tally.unresolved };
  }

  /** Les flux de contenu : une référence à un flux, ou un tableau de références, en ligne ou non. */
  private contentStreams(value: string): number[] | null {
    const ref = referenceOf(value);
    if (ref === null) return referencesOf(value);
    const object = this.doc.objects.get(ref);
    if (object === undefined) return null;
    return object.stream !== null ? [ref] : referencesOf(object.body);
  }

  /**
   * Des flux de contenu lus comme un seul : un chemin peut commencer dans un
   * flux et se peindre dans le suivant. Quand l'un ne se lit pas, les autres
   * se lisent chacun à part, pour ne pas joindre deux morceaux qui n'étaient
   * pas contigus.
   */
  private async readContent(streams: readonly number[], resources: Resources, tally: Tally, path: Set<number>): Promise<void> {
    const texts = await Promise.all(streams.map(n => this.decode(n)));
    const read = texts.filter((t): t is string => t !== null);
    tally.unresolved += texts.length - read.length;
    const pieces = read.length === texts.length ? [read.join('\n')] : read;
    for (const piece of pieces) {
      const scan = scanContent(piece);
      tally.painted += scan.painted;
      for (const name of scan.invoked) await this.readExternal(name, resources, tally, path);
    }
  }

  private async readExternal(name: string, resources: Resources, tally: Tally, path: Set<number>): Promise<void> {
    const table = resources?.get('XObject');
    const ref = referenceOf(table === undefined ? undefined : resolveDictionary(this.doc, table)?.get(name));
    const stream = ref === null ? undefined : this.doc.objects.get(ref)?.stream ?? undefined;
    if (ref === null || stream === undefined || path.has(ref)) { tally.unresolved += 1; return; }
    const subtype = parseDictionary(stream.dict, 0)?.get('Subtype')?.trim();
    if (subtype === '/Image') return;
    if (subtype !== '/Form') { tally.unresolved += 1; return; }
    if (tally.forms.has(ref)) return;
    tally.forms.add(ref);
    const own = parseDictionary(stream.dict, 0)?.get('Resources');
    const formResources = own === undefined ? resources : resolveDictionary(this.doc, own);
    await this.readContent([ref], formResources, tally, new Set([...path, ref]));
  }

  /** Les ressources de la page, ou celles de son plus proche ancêtre qui en porte. */
  private resourcesOf(page: number): Resources {
    const seen = new Set<number>();
    for (let node: number | null = page; node !== null && !seen.has(node);) {
      seen.add(node);
      const dict = dictionaryOfObject(this.doc, node);
      const own = dict?.get('Resources');
      if (own !== undefined) return resolveDictionary(this.doc, own);
      node = referenceOf(dict?.get('Parent'));
    }
    return null;
  }

  private decode(number: number): Promise<string | null> {
    let pending = this.decoded.get(number);
    if (pending === undefined) {
      const stream = this.doc.objects.get(number)?.stream ?? null;
      pending = stream === null ? Promise.resolve(null) : decodePdfStream(stream);
      this.decoded.set(number, pending);
    }
    return pending;
  }
}
