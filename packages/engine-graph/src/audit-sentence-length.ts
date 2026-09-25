import type { CharterRule, Finding, SiteData } from '@azimut/core-model';
import { resolveMaxSentenceWords } from '@azimut/core-model';
import { templateFreeTexts } from './audit-typography.js';

/**
 * Phrase plus longue que la limite portée par la charte — A5.8.
 *
 * `charter_rule` porte la nature `max_sentence_words`, et D2.2 nomme
 * l'anomalie « Phrase plus longue que la limite portée par la charte ». La
 * limite appartient donc à la charte d'un client.
 *
 * **La limite vient désormais de la charte**, qui entre dans la signature de
 * ce contrôle. Aucun nombre n'est écrit ici. Quand la charte ne porte pas la
 * règle, le contrôle ne s'exécute pas et le dit, et il n'applique aucune
 * valeur par défaut : « une règle absente n'est pas une règle permissive ».
 * Une limite par défaut serait la pire des trois issues possibles — elle
 * signalerait au nom d'une charte qui n'a rien demandé.
 *
 * **Le corpus est plus étroit** que celui du contrôle des caractères
 * interdits, qui juge toutes les dénominations du site : celui-ci ne juge que
 * le texte libre d'un gabarit de face. Le modèle ne porte
 * ni cartouche ni note, et le texte libre est ce qui s'en approche le plus :
 * c'est le seul endroit où l'on écrit des phrases. Une dénomination de
 * destination n'est pas une phrase, et lui opposer une règle de phrase
 * signalerait une longueur là où il n'y a pas de rédaction.
 */

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
  /** Faux quand la charte ne porte pas la limite. Même motif qu'en typographie. */
  readonly applied: boolean;
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
export function auditSentenceLength(
  site: SiteData,
  charterRules: readonly CharterRule[],
): SentenceLengthReport {
  const texts = templateFreeTexts(site);
  const maximum = resolveMaxSentenceWords(charterRules);
  if (maximum === null) {
    return { checked_texts: texts.length, applied: false, findings: [] };
  }

  const findings: Finding[] = [];
  for (const text of texts) {
    const sentences = splitSentences(text.value);
    sentences.forEach((sentence, index) => {
      const words = countWords(sentence);
      if (words <= maximum) return;
      findings.push({
        code: 'LAYOUT.SENTENCE_TOO_LONG',
        severity: 'warning',
        entity: { kind: 'face_template_block', id: text.id },
        params: {
          sentence_index: index,
          words,
          maximum,
        },
        ruleRef: 'A5.8',
      });
    });
  }

  return { checked_texts: texts.length, applied: true, findings };
}
