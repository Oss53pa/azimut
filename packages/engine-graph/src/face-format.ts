import type { Finding, Outcome } from '@azimut/core-model';
import { destinationListBlockHeightMm, type TextMeasure } from './render-face.js';

/**
 * N4.3 — règle M04.G3. « Le format est calculé depuis le contenu, la distance de
 * lecture et la variante linguistique la plus longue. »
 *
 * Les trois entrées sont là, et chacune joue son rôle :
 *
 *  - le **contenu** donne le nombre de lignes, donc la hauteur qu'il faut pour
 *    les dessiner ;
 *  - la **distance de lecture** donne, par le paquet de règles, la hauteur de
 *    caractère exigée — jamais une constante de ce fichier (M04.G4) ;
 *  - la **variante linguistique la plus longue** donne la largeur : une face
 *    dimensionnée sur le français déborderait en anglais, et l'inverse.
 *
 * La hauteur se calcule exactement : elle inverse la formule que le rendu
 * emploie déjà, en passant par la grille du gabarit. La largeur demande de
 * mesurer un texte, donc une table de métriques de police, qui n'est pas encore
 * versée. Sans mesure, la largeur vaut `null` : « non calculable » et non
 * « nulle ». Inventer une largeur donnerait une face fausse, et le savoir trop
 * tard, à la pose.
 */

export type FaceFormatInput = {
  /** Nombre d'entrées de la liste de destinations, c'est à dire de lignes. */
  readonly entry_count: number;
  /** Hauteur de caractère exigée à cette distance, venue du paquet de règles. */
  readonly required_char_height_mm: number;
  /**
   * Part de la face qu'occupe le bloc des destinations, en pour-cent de sa
   * hauteur et de sa largeur.
   *
   * Lue dans le gabarit compilé, là où le rendu la lit : la grille — marges,
   * gouttières, rangées — a déjà été résolue en région, et la recalculer ici
   * la recopierait (invariant 1).
   */
  readonly block_height_pct: number;
  readonly block_width_pct: number;
  /**
   * Variante la plus longue parmi les langues actives, et de quoi la mesurer.
   * Les deux ensemble, ou aucune des deux : mesurer sans texte n'a pas de sens,
   * et un texte sans mesure ne donne pas de largeur.
   */
  readonly longest_variant?: string;
  readonly measure?: TextMeasure;
};

export type FaceFormat = {
  readonly height_mm: number;
  /** `null` quand aucune mesure de texte n'est disponible. */
  readonly width_mm: number | null;
  /** La hauteur de caractère que ce format permet d'atteindre. */
  readonly char_height_mm: number;
};

/**
 * Calcule le format d'une face.
 *
 * Refuse plutôt que de deviner quand une entrée manque : une face sans ligne
 * n'a pas de format à calculer, et une hauteur de caractère nulle ou négative
 * ne vient d'aucun paquet de règles valide.
 */
export function computeFaceFormat(
  input: FaceFormatInput,
): Outcome<FaceFormat> {
  const findings: Finding[] = [];
  const invalid = (param: string, value: number): void => {
    findings.push({
      code: 'DATA.FACE_DIMENSIONS_INVALID',
      severity: 'blocking',
      entity: null,
      params: { param, value },
      ruleRef: 'N4.3',
    });
  };

  if (input.entry_count <= 0) invalid('entry_count', input.entry_count);
  if (input.required_char_height_mm <= 0) {
    invalid('required_char_height_mm', input.required_char_height_mm);
  }
  if (input.block_height_pct <= 0) invalid('block_height_pct', input.block_height_pct);
  if (input.block_width_pct <= 0) invalid('block_width_pct', input.block_width_pct);
  if (findings.length > 0) return { ok: false, findings };

  // Hauteur du bloc qui porte les lignes, puis hauteur de la face : le bloc
  // occupe une part connue de celle-ci.
  const blockHeight = destinationListBlockHeightMm(
    input.required_char_height_mm,
    input.entry_count,
  );
  const height = blockHeight / (input.block_height_pct / 100);
  const blockWidth = measuredWidth(input);

  return {
    ok: true,
    value: {
      height_mm: height,
      width_mm: blockWidth === null ? null : blockWidth / (input.block_width_pct / 100),
      char_height_mm: input.required_char_height_mm,
    },
    warnings: [],
  };
}

/**
 * Largeur que le bloc doit avoir, ou `null` faute de mesure.
 *
 * Le texte est mesuré à la taille exacte à laquelle il sera dessiné, celle que
 * la règle exige — la même que `checkFaceContentFit` emploie pour constater le
 * débordement. L'un dit qu'il déborde, l'autre dit de combien il faut élargir.
 */
function measuredWidth(input: FaceFormatInput): number | null {
  const { longest_variant: text, measure } = input;
  if (text === undefined || measure === undefined) return null;
  if (text.length === 0) return null;
  return measure(text, input.required_char_height_mm);
}
