/**
 * Module 03 aux écrans de la maquette : profils de déplacement.
 *
 * Fragment du catalogue. La table française porte le jeu de clés ;
 * la table anglaise est typée contre elle, une traduction manquante
 * ne compile pas.
 */
export const FLOWS_REGISTER_FR = {
  'nav.item.hypotheses': 'Hypothèses',
  'nav.item.profiles': 'Profils',

  'profiles.title': 'Profils de parcours',
  'profiles.summary': '{count} profil(s) · {site}',
  'profiles.filter.all': 'Tous les profils',
  'profiles.filter.accessible': 'Accessibles',
  'profiles.shown': '{count} profil(s)',
  'profiles.empty': 'Aucun profil ne correspond au filtre.',
  'profiles.col.key': 'Code',
  'profiles.col.name': 'Profil',
  'profiles.col.constraints': 'Contraintes',
  'profiles.col.routes': 'Itinéraires calculés',
  'profiles.col.unsolved': 'Sans solution',
  'profiles.col.detour': 'Allongement moyen',
  'profiles.constraint.none': 'Aucune',
  'profiles.constraint.accessible': 'Passages accessibles seulement',
  'profiles.constraint.without': 'Sans {kind}',
  'profiles.constraint.hours': 'Horaires respectés',
  'profiles.inspector.empty': 'Choisissez un profil pour voir ses contraintes.',
  'profiles.inspector.reference': '{name} · profil de référence',
  'profiles.section.constraints': 'Contraintes',
  'profiles.field.accessible': 'Accessibilité exigée',
  'profiles.field.hours': 'Horaires respectés',
  'profiles.field.excluded': 'Exclu',
  'profiles.field.solved': 'Itinéraires calculés',
  'profiles.section.computed.note': "Un itinéraire relie une entrée à une destination. L'allongement se mesure face au premier profil, sur les itinéraires que les deux résolvent.",
  'profiles.note': "Le modèle ne porte ni vitesse ni pente maximale par profil : aucun temps de parcours n'est affiché. Une vitesse de marche serait une valeur normative, qui viendrait d'un paquet de règles.",
} as const;

export const FLOWS_REGISTER_EN: Readonly<Record<keyof typeof FLOWS_REGISTER_FR, string>> = {
  'nav.item.hypotheses': 'Hypotheses',
  'nav.item.profiles': 'Profiles',

  'profiles.title': 'Travel profiles',
  'profiles.summary': '{count} profile(s) · {site}',
  'profiles.filter.all': 'All profiles',
  'profiles.filter.accessible': 'Accessible',
  'profiles.shown': '{count} profile(s)',
  'profiles.empty': 'No profile matches the filter.',
  'profiles.col.key': 'Code',
  'profiles.col.name': 'Profile',
  'profiles.col.constraints': 'Constraints',
  'profiles.col.routes': 'Computed routes',
  'profiles.col.unsolved': 'No solution',
  'profiles.col.detour': 'Mean detour',
  'profiles.constraint.none': 'None',
  'profiles.constraint.accessible': 'Accessible passages only',
  'profiles.constraint.without': 'No {kind}',
  'profiles.constraint.hours': 'Opening hours honoured',
  'profiles.inspector.empty': 'Choose a profile to see its constraints.',
  'profiles.inspector.reference': '{name} · reference profile',
  'profiles.section.constraints': 'Constraints',
  'profiles.field.accessible': 'Accessibility required',
  'profiles.field.hours': 'Opening hours honoured',
  'profiles.field.excluded': 'Excluded',
  'profiles.field.solved': 'Computed routes',
  'profiles.section.computed.note': 'A route links an entrance to a destination. The detour is measured against the first profile, on the routes both resolve.',
  'profiles.note': 'The model carries no speed or maximum slope per profile: no travel time is shown. A walking speed would be a normative value, to come from a rules pack.',
} as const;
