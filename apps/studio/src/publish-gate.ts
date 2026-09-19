import {
  runChecks, validateGraph, validateGeometry, validateDirectory,
} from '@azimut/engine-graph';
import type { Finding, SiteData } from '@azimut/core-model';
import type { VocabularyState } from './context/site-vocabulary.js';

/**
 * Ce qui autorise, ou non, à publier.
 *
 * Extrait des écrans parce que deux d'entre eux posent la même question — le
 * bouton « Publier » de l'en-tête et la case « Publiable aujourd'hui » du
 * tableau de bord — et qu'une réponse écrite deux fois finit par diverger. Le
 * dépôt tient déjà ce parti pour l'export de validation : la logique sort de la
 * vue, et devient vérifiable sans rien monter à l'écran.
 */

/** Pourquoi le vocabulaire empêche de conclure, s'il l'empêche. */
export type VocabularyRefusal = 'none' | 'loading' | 'failed';

export type PublishGate = {
  /** Toutes les anomalies du site, quelle que soit leur sévérité. */
  readonly findings: readonly Finding[];
  /** Les seules bloquantes, extraites une fois pour toutes. */
  readonly blocking: readonly Finding[];
  /**
   * Contrôles qu'aucun paquet de règles ne permet d'exercer.
   *
   * Ils ne ferment pas la publication : décider qu'un paquet manquant
   * l'interdit relève de A2.2, et personne n'a tranché. Ils sont rendus pour
   * que l'écran cesse de les taire — « aucune anomalie bloquante » et « tout a
   * été contrôlé » ne sont pas la même phrase.
   */
  readonly unchecked: readonly string[];
  readonly vocabularyRefusal: VocabularyRefusal;
  /** Faux dès qu'une bloquante est ouverte ou que le vocabulaire manque. */
  readonly publishable: boolean;
};

function findingsOf(
  result: { ok: boolean; warnings?: Finding[]; findings?: Finding[] },
): readonly Finding[] {
  return result.ok ? (result.warnings ?? []) : (result.findings ?? []);
}

function refusalOf(status: VocabularyState['status']): VocabularyRefusal {
  if (status === 'failed') return 'failed';
  if (status === 'loading') return 'loading';
  return 'none';
}

/**
 * Les contrôles tournent en mode `livrable`, et c'est tout l'objet de la
 * fonction.
 *
 * En mode atelier, une proposition est un état de travail légitime et P1 (complément atelier) ne
 * s'exerce pas. Poser la question de la publication dans ce mode allumerait le
 * bouton sur un site dont chaque objet n'est encore qu'une suggestion — soit
 * exactement ce que `PARK.PROPOSAL_AS_EXISTING` existe pour refuser.
 *
 * Un vocabulaire non lu ne vaut pas un vocabulaire vide. Tant que la lecture
 * n'a pas abouti, la valeur inconnue tombe du côté qui ne publie pas.
 */
export function evaluatePublishGate(
  site: SiteData,
  vocabulary: VocabularyState,
): PublishGate {
  const checks = runChecks(site, vocabulary.vocabulary, { mode: 'livrable' });
  const findings: readonly Finding[] = [
    ...(checks.ok ? checks.value.findings : checks.findings),
    ...findingsOf(validateGraph(site)),
    ...findingsOf(validateGeometry(site)),
    ...findingsOf(validateDirectory(site)),
  ];
  const blocking = findings.filter(f => f.severity === 'blocking');
  const vocabularyRefusal = refusalOf(vocabulary.status);

  return {
    findings,
    blocking,
    unchecked: checks.ok ? checks.value.checks_skipped : [],
    vocabularyRefusal,
    publishable: blocking.length === 0 && vocabularyRefusal === 'none',
  };
}
