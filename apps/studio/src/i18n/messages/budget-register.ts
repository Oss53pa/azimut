/**
 * Module 09 aux écrans de la maquette : coûts de référence et suivi
 * budgétaire.
 *
 * Fragment du catalogue. La table française porte le jeu de clés ;
 * la table anglaise est typée contre elle, une traduction manquante
 * ne compile pas.
 */
export const BUDGET_REGISTER_FR = {
  'nav.item.budgetrefs': 'Coûts',
  'nav.item.budgettrack': 'Suivi',

  'budgetrefs.summary': '{count} coût(s) de référence · {missing} typologie(s) citée(s) sans coût',
  'budgetrefs.filter.all': 'Tous',
  'budgetrefs.filter.priced': 'Chiffrés',
  'budgetrefs.filter.unpriced': 'À confirmer',
  'budgetrefs.shown': '{count} coût(s)',
  'budgetrefs.col.state': 'État',
  'budgetrefs.state.priced': 'chiffré',
  'budgetrefs.state.unpriced': 'à confirmer',
  'budgetrefs.inspector.empty': 'Choisissez un coût pour voir sa source.',
  'budgetrefs.inspector.subtitle': '{substrate} · {state}',
  'budgetrefs.section.reference': 'Référence',
  'budgetrefs.field.currency': 'Devise',
  'budgetrefs.field.cited': 'Cité par le carnet',

  'budgettrack.title': 'Suivi budgétaire',
  'budgettrack.summary': '{count} ligne(s) · {unpriced} sans estimation',
  'budgettrack.filter.all': 'Toutes',
  'budgettrack.shown': '{count} ligne(s)',
  'budgettrack.col.state': 'Avancement',
  'budgettrack.state.unpriced': 'non chiffrée',
  'budgettrack.state.estimated': 'estimée',
  'budgettrack.state.quoted': 'devis reçu',
  'budgettrack.state.realized': 'réalisée',
  'budgettrack.inspector.empty': 'Choisissez une ligne pour voir ses montants.',
  'budgettrack.inspector.subtitle': '{lot} · {state}',
  'budgettrack.section.amounts': 'Montants',
  'budgettrack.section.computed.note': "Calculé en unité mineure, dans une seule devise. Deux devises ne se comparent pas : l'écran le dit « sans objet ».",
  'budgettrack.field.consumed': 'Réalisé sur devis',
  'budgettrack.field.quotevsestimate': "Devis face à l'estimation",
} as const;

export const BUDGET_REGISTER_EN: Readonly<Record<keyof typeof BUDGET_REGISTER_FR, string>> = {
  'nav.item.budgetrefs': 'Costs',
  'nav.item.budgettrack': 'Tracking',

  'budgetrefs.summary': '{count} reference cost(s) · {missing} cited typology(ies) without cost',
  'budgetrefs.filter.all': 'All',
  'budgetrefs.filter.priced': 'Priced',
  'budgetrefs.filter.unpriced': 'To confirm',
  'budgetrefs.shown': '{count} cost(s)',
  'budgetrefs.col.state': 'State',
  'budgetrefs.state.priced': 'priced',
  'budgetrefs.state.unpriced': 'to confirm',
  'budgetrefs.inspector.empty': 'Choose a cost to see its source.',
  'budgetrefs.inspector.subtitle': '{substrate} · {state}',
  'budgetrefs.section.reference': 'Reference',
  'budgetrefs.field.currency': 'Currency',
  'budgetrefs.field.cited': 'Cited by the schedule',

  'budgettrack.title': 'Budget tracking',
  'budgettrack.summary': '{count} line(s) · {unpriced} without estimate',
  'budgettrack.filter.all': 'All',
  'budgettrack.shown': '{count} line(s)',
  'budgettrack.col.state': 'Progress',
  'budgettrack.state.unpriced': 'unpriced',
  'budgettrack.state.estimated': 'estimated',
  'budgettrack.state.quoted': 'quote received',
  'budgettrack.state.realized': 'realized',
  'budgettrack.inspector.empty': 'Choose a line to see its amounts.',
  'budgettrack.inspector.subtitle': '{lot} · {state}',
  'budgettrack.section.amounts': 'Amounts',
  'budgettrack.section.computed.note': 'Computed in minor units, in a single currency. Two currencies are not compared: the screen says "not applicable".',
  'budgettrack.field.consumed': 'Actual against quote',
  'budgettrack.field.quotevsestimate': 'Quote against estimate',
} as const;
