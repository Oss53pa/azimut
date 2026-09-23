/**
 * M3 (partie M) — la duplication en série, en un seul geste.
 *
 * Critère d'acceptation 4 : « La duplication en série de 20 cellules se fait
 * en une commande annulable d'un seul geste. » Les deux moitiés comptent. Un
 * geste, parce que poser vingt fois la même cellule à la main est exactement
 * le travail que cet écran existe pour épargner ; une commande, parce que
 * vingt annulations successives pour défaire une seule action seraient une
 * punition (E5.2).
 *
 * Ce module fait la première moitié : il juge la série entière avant qu'une
 * seule copie soit écrite. Le regroupement en une entrée de pile est l'affaire
 * du magasin de commandes, qui empile un geste et non une commande.
 *
 * Aucune copie n'est écrite si une seule est refusée. Une série à moitié
 * écrite laisserait l'opérateur avec une trame trouée, et la seule façon de
 * s'en sortir serait de supprimer les copies une à une — soit exactement ce
 * que le critère veut éviter.
 */
import type { Outcome, Finding } from '@azimut/core-model';
import { acceptFootprint } from './footprint-input.js';
import type {
  AcceptedFootprint, FootprintContext, FootprintDraft,
} from './footprint-input.js';
import { seriesVertices, seriesCodes } from './footprint-commands.js';
import type { SeriesStep } from './footprint-commands.js';

/**
 * Juge les `count` copies d'un contour de référence.
 *
 * Les codes déjà pris grandissent au fil de la série : sans cela, deux copies
 * pourraient porter le même code sans que rien le dise, et l'unicité par
 * niveau que M3 (partie M) demande ne tiendrait que jusqu'à l'écriture.
 */
export function acceptSeries(
  reference: FootprintDraft,
  step: SeriesStep,
  context: FootprintContext,
): Outcome<readonly AcceptedFootprint[]> {
  const contours = seriesVertices(reference.vertices, step);
  const codes = seriesCodes(reference.unitCode.trim(), step.count);

  const accepted: AcceptedFootprint[] = [];
  const findings: Finding[] = [];
  const warnings: Finding[] = [];
  const codesOnLevel = [...context.codesOnLevel];
  const existing = [...context.existing];

  for (let n = 0; n < contours.length; n += 1) {
    const vertices = contours[n];
    const unitCode = codes[n];
    if (vertices === undefined || unitCode === undefined) continue;

    const outcome = acceptFootprint(
      { ...reference, vertices, unitCode },
      { codesOnLevel, existing },
    );
    if (!outcome.ok) {
      findings.push(...outcome.findings);
      continue;
    }
    accepted.push(outcome.value);
    // M3 (partie M) fait du recouvrement un avertissement et non un refus.
    // Les perdre ici rendrait une série silencieuse là où une copie isolée
    // aurait prévenu.
    warnings.push(...outcome.warnings);
    codesOnLevel.push(outcome.value.unitCode);
    existing.push(outcome.value.vertices);
  }

  // Le premier refus suffit à arrêter la série, mais tous sont rendus : dire
  // « la copie 3 est refusée » quand les copies 3 à 20 le sont ferait corriger
  // dix-huit fois de suite.
  if (findings.length > 0) return { ok: false, findings };
  return { ok: true, value: accepted, warnings };
}
