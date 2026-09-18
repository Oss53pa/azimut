/**
 * Texte lié — complément atelier, M15.
 *
 * Le document de stratégie pose une exigence que la prose ne satisfait jamais
 * d'elle-même : « Les chiffres, noms et faits du document sont des champs liés :
 * un renommage ou un nouveau total se répercute dans le texte. »
 *
 * C'est l'invariant 1 appliqué aux phrases. Un document qui écrit « 89 places »
 * duplique une donnée pour les besoins d'un rendu ; il sera faux le jour où le
 * relevé en trouve 93, et rien ne le dira.
 *
 * Un paragraphe est donc une suite de segments, littéraux ou liés, et non une
 * chaîne portant une syntaxe à interpréter. C'est le choix de D8.1 — « un
 * gabarit est une donnée, pas un composant » — et il évite d'inventer un
 * mini-langage de plus, avec ses échappements et ses cas limites.
 *
 * La liaison est celle de D8, réexportée : deux notations pour la même idée
 * finiraient par diverger.
 */
import type { Binding } from './template-schema.js';

export type TextSegment =
  | { readonly kind: 'literal'; readonly text: string }
  | { readonly kind: 'bound'; readonly binding: Binding };

export type BoundParagraph = {
  readonly id: string;
  readonly segments: readonly TextSegment[];
};

/** Les valeurs disponibles au rendu, par source puis par champ. */
export type BindingValues = Readonly<Record<string, Readonly<Record<string, string>>>>;

export type ResolvedParagraph =
  | { readonly ok: true; readonly id: string; readonly text: string }
  | { readonly ok: false; readonly id: string; readonly missing: readonly Binding[] };

function lookup(values: BindingValues, binding: Binding): string | undefined {
  return values[binding.source]?.[binding.field];
}

/**
 * Rend un paragraphe, ou refuse de le rendre.
 *
 * **Une liaison sans valeur ne produit pas de texte.** Ni marque de réservation,
 * ni segment vide : le paragraphe entier est refusé, et les liaisons manquantes
 * sont nommées.
 *
 * C'est délibérément brutal. Un document de stratégie qui perdrait sa capacité
 * de parking en chemin se lirait normalement — « le parking compte  places » —
 * et personne ne verrait le trou avant la réunion. Mieux vaut un document qui
 * ne se compile pas qu'un document qui ment poliment.
 */
export function resolveBoundParagraph(
  paragraph: BoundParagraph,
  values: BindingValues,
): ResolvedParagraph {
  const missing: Binding[] = [];
  let text = '';

  for (const segment of paragraph.segments) {
    if (segment.kind === 'literal') {
      text += segment.text;
      continue;
    }
    const value = lookup(values, segment.binding);
    if (value === undefined) missing.push(segment.binding);
    else text += value;
  }

  return missing.length > 0
    ? { ok: false, id: paragraph.id, missing }
    : { ok: true, id: paragraph.id, text };
}

/**
 * Les nombres écrits en toutes lettres dans un littéral.
 *
 * Un chiffre dans un littéral est le symptôme d'une valeur recopiée plutôt que
 * liée. Le signalement est un avertissement et non un blocage, parce que tous
 * les chiffres ne sont pas des données du site : « les douze modules », « phase
 * 2 », « ISO 7001 ». Trancher à la place du rédacteur produirait des refus
 * qu'il ne pourrait pas lever.
 *
 * Rend les nombres trouvés, pour que l'anomalie montre ce qu'elle a vu.
 */
export function literalNumbers(paragraph: BoundParagraph): readonly string[] {
  const found: string[] = [];
  for (const segment of paragraph.segments) {
    if (segment.kind !== 'literal') continue;
    for (const match of segment.text.matchAll(/\d+(?:[.,]\d+)?/g)) {
      found.push(match[0]);
    }
  }
  return found;
}
