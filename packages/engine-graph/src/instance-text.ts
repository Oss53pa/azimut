/**
 * D8.3 — le texte libre saisi sur une face, tel que la résolution et la
 * lecture du tableau des messages le portent.
 */
import type { ContentBlockInstance, FaceTemplate } from '@azimut/core-model';
import { fitsSlot, freeTextsOf } from '@azimut/core-model';
import type { ResolvedContent } from './resolve-face.js';

/**
 * Forme canonique d'un texte libre : les variantes ne sont portées que si
 * elles diffèrent. Identiques, le texte seul suffit et se rend pareil dans
 * toutes les langues. La résolution directe et la lecture du tableau passent
 * toutes deux par ici, sans quoi elles ne produiraient plus la même face.
 */
export function freeTextContent(texts: Readonly<Record<string, string>>, fallback: string): ResolvedContent {
  const values = Object.values(texts);
  const first = values[0];
  if (first === undefined) return { type: 'free_text', text: fallback };
  return values.every(v => v === first)
    ? { type: 'free_text', text: first }
    : { type: 'free_text', text: first, texts };
}

/**
 * D8.3 — le texte qu'un bloc libre de la face apporte à l'emplacement libre du
 * gabarit de même indice. Un bloc sans emplacement de même nature n'apporte
 * rien : le contrôle `instance_blocks` le signale.
 */
export function withInstanceText(
  template: FaceTemplate,
  content: ResolvedContent,
  slotIndex: number,
  instanceBlocks: readonly ContentBlockInstance[],
): ResolvedContent {
  if (content.type !== 'free_text') return content;
  const block = instanceBlocks.find(b => b.block_index === slotIndex && b.kind === 'free');
  if (block === undefined || !fitsSlot(template, block)) return content;
  return freeTextContent(freeTextsOf(block), content.text);
}
