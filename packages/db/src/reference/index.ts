/**
 * Q9 — le référentiel des pays, lu depuis son fichier.
 *
 * Deux lecteurs, un seul fichier (INV-1) :
 *  · `pnpm seed:reference` le verse dans `azimut.country`, que l'application
 *    interroge quand un dépôt est configuré ;
 *  · le dépôt de référence du studio le sert tel quel, sur un poste sans base.
 *
 * Une seconde copie dans un autre paquet serait exactement la duplication que
 * INV-1 refuse : les deux divergeraient, et le formulaire proposerait des pays
 * que la base ne connaît pas.
 *
 * Le fichier se régénère par `node scripts/build-country-reference.js`, qui le
 * tire de la base de données des fuseaux du système et de CLDR. Rien ici n'est
 * écrit à la main : Q9.2 l'interdit.
 */
import file from './country.json';

export type CountryReference = {
  readonly code: string;
  readonly name_fr: string;
  readonly name_en: string;
  /** Les fuseaux du pays. M1 (partie M) pré-remplit quand la liste n'en compte qu'un. */
  readonly timezones: readonly string[];
  /** Q4. Nulle tant que le fichier ne porte pas la correspondance. */
  readonly default_currency_code: string | null;
  readonly source_ref: string;
};

/** La référence documentaire du fichier, citée telle quelle dans l'interface. */
export const COUNTRY_SOURCE_REF: string = file.source_ref;

/** Les pays, triés par code. L'ordre vient du fichier et ne se recalcule pas. */
export const COUNTRIES: readonly CountryReference[] = file.countries;

/** Les fuseaux d'un pays. Liste vide si le pays n'en déclare aucun. */
export function timezonesOf(code: string): readonly string[] {
  return COUNTRIES.find(country => country.code === code)?.timezones ?? [];
}
