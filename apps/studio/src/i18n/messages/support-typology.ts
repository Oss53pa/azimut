/**
 * A5.6 — le lien d'un support à sa typologie, et ce qu'un écran suppose quand
 * il manque.
 *
 * Fragment du catalogue. La table française porte le jeu de clés ;
 * la table anglaise est typée contre elle, une traduction manquante
 * ne compile pas.
 */
export const SUPPORT_TYPOLOGY_FR = {
  'typology.untyped': '{count} support(s) sur {total} sans typologie : la typologie « {type} » leur est supposée.',
  'typology.untyped.notype': '{count} support(s) sur {total} sans typologie, et le site n’en déclare aucune.',
  'typology.untyped.hint': 'Rattacher chaque support à sa typologie (A5.6) lève la supposition ; les supports rattachés ne sont pas concernés.',
  'placement.col.typology': 'Typologie',
  'placement.typology.none': 'Non rattachée',
} as const;

export const SUPPORT_TYPOLOGY_EN: Readonly<Record<keyof typeof SUPPORT_TYPOLOGY_FR, string>> = {
  'typology.untyped': '{count} of {total} support(s) have no typology: “{type}” is assumed for them.',
  'typology.untyped.notype': '{count} of {total} support(s) have no typology, and the site declares none.',
  'typology.untyped.hint': 'Linking each support to its typology (A5.6) lifts the assumption; linked supports are not affected.',
  'placement.col.typology': 'Typology',
  'placement.typology.none': 'Not linked',
};
