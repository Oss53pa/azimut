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

/**
 * Ce que chaque source sait offrir, qu'elle ait une valeur ou non.
 *
 * Sans ce catalogue, une liaison vers `parking.capacite` — orthographiée à la
 * française alors que le champ est `capacity` — et une liaison vers
 * `parking.capacity` d'un site qui n'a pas de parking se ressemblent
 * exactement : dans les deux cas la recherche ne rend rien.
 *
 * Elles n'appellent pourtant pas le même geste. La première se corrige dans le
 * document, la seconde se comble dans la donnée. Les confondre enverrait le
 * rédacteur relire sa phrase alors qu'il faut numériser un parking, ou
 * l'inverse.
 */
export type BindingCatalogue = Readonly<Record<string, readonly string[]>>;

/** Pourquoi une liaison n'a pas rendu de valeur. */
export type MissingBinding = {
  readonly binding: Binding;
  /**
   * `unknown` : ni la source ni le champ ne figurent au catalogue — le document
   * désigne quelque chose qui n'existe pas. `empty` : le champ existe et le site
   * n'a rien à y mettre.
   */
  readonly cause: 'unknown' | 'empty';
};

export type ResolvedParagraph =
  | { readonly ok: true; readonly id: string; readonly text: string }
  | { readonly ok: false; readonly id: string; readonly missing: readonly MissingBinding[] };

function lookup(values: BindingValues, binding: Binding): string | undefined {
  return values[binding.source]?.[binding.field];
}

function isDeclared(catalogue: BindingCatalogue | undefined, binding: Binding): boolean {
  // Sans catalogue, on ne sait pas : tout manque est alors réputé une absence de
  // valeur, ce qui est le diagnostic le moins accusateur pour le document.
  if (catalogue === undefined) return true;
  return catalogue[binding.source]?.includes(binding.field) ?? false;
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
  catalogue?: BindingCatalogue,
): ResolvedParagraph {
  const missing: MissingBinding[] = [];
  let text = '';

  for (const segment of paragraph.segments) {
    if (segment.kind === 'literal') {
      text += segment.text;
      continue;
    }
    const value = lookup(values, segment.binding);
    if (value === undefined) {
      missing.push({
        binding: segment.binding,
        cause: isDeclared(catalogue, segment.binding) ? 'empty' : 'unknown',
      });
    } else {
      text += value;
    }
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
