import type { Finding, SiteData } from '@azimut/core-model';
import { templateFreeTexts } from './audit-typography.js';

/**
 * QC-20 — « Rédaction trop longue : phrase de plus de 25 mots dans un cartouche
 * ou une note », signalant (complément atelier).
 *
 * Voisin de QC-06 et de la même moitié de P7 (complément atelier), la rédaction
 * propre. Il s'en distingue sur deux points, et les deux sont délibérés.
 *
 * **Le corpus est plus étroit.** QC-06 juge toutes les dénominations du site ;
 * celui-ci ne juge que le texte libre d'un gabarit de face. Le modèle ne porte
 * ni cartouche ni note, et le texte libre est ce qui s'en approche le plus :
 * c'est le seul endroit où l'on écrit des phrases. Une dénomination de
 * destination n'est pas une phrase, et lui opposer une règle de phrase
 * signalerait une longueur là où il n'y a pas de rédaction.
 *
 * **Le seuil est un nombre, et il est écrit ici.** Ce n'est pas une valeur
 * d'origine normative : aucune norme ne décide qu'une phrase s'arrête à
 * vingt-cinq mots, c'est une règle de rédaction du produit, énoncée par le
 * document. Elle ne relève donc pas d'un paquet de règles (INV-5). Si la
 * maîtrise d'ouvrage la range un jour parmi les seuils à déclarer — le point
 * ouvert n° 2 du registre pose la question pour quatre autres —, cette
 * constante est le seul endroit à déplacer.
 */

/** QC-20 (complément atelier) — au-delà, la phrase est signalée. */
export const MAX_WORDS_PER_SENTENCE = 25;

/**
 * Découpe un texte en phrases.
 *
 * Sur le point final, le point d'exclamation, le point d'interrogation et les
 * points de suspension, suivis d'une espace ou de la fin du texte.
 *
 * **Une abréviation coupe la phrase à tort** — « M. Dupont » compte pour deux.
 * La conséquence est du bon côté : une phrase coupée trop tôt est plus courte,
 * donc moins signalée. Le contrôle sous-estime, il ne sur-signale pas, et c'est
 * ce qu'on veut d'un contrôle signalant dont on ne veut pas qu'il soit ignoré à
 * force de crier.
 *
 * Un texte sans ponctuation finale compte pour une seule phrase : une note de
 * trente mots sans point reste une note de trente mots.
 */
export function splitSentences(text: string): readonly string[] {
  return text
    .split(/[.!?…]+(?=\s|$)/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

/** Les mots d'une phrase : ce que les espaces séparent, et rien d'autre. */
export function countWords(sentence: string): number {
  return sentence.split(/\s+/).filter((word) => word !== '').length;
}

export type SentenceLengthReport = {
  /** Nombre de textes parcourus, pour qu'un rapport vide se distingue d'un rapport sans matière. */
  readonly checked_texts: number;
  readonly findings: readonly Finding[];
};

/**
 * Rend une anomalie par phrase trop longue, et non une par texte : deux phrases
 * à réécrire sont deux réécritures, et un compte agrégé obligerait à relire
 * pour savoir lesquelles.
 *
 * L'ordre suit celui de `templateFreeTexts` — par gabarit puis par rang de
 * bloc — puis le rang de la phrase dans le texte.
 */
export function auditSentenceLength(site: SiteData): SentenceLengthReport {
  const texts = templateFreeTexts(site);
  const findings: Finding[] = [];

  for (const text of texts) {
    const sentences = splitSentences(text.value);
    sentences.forEach((sentence, index) => {
      const words = countWords(sentence);
      if (words <= MAX_WORDS_PER_SENTENCE) return;
      findings.push({
        code: 'LAYOUT.SENTENCE_TOO_LONG',
        severity: 'warning',
        entity: { kind: 'face_template_block', id: text.id },
        params: {
          sentence_index: index,
          words,
          maximum: MAX_WORDS_PER_SENTENCE,
        },
        ruleRef: 'atelier-QC-20',
      });
    });
  }

  return { checked_texts: texts.length, findings };
}
