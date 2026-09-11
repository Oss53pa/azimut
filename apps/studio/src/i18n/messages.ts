/**
 * D12.1 — Studio UI message catalogue.
 *
 * No interface text is written inside a component: components reference keys
 * only. Key convention: `domain.screen.element`, lowercase segments separated
 * by dots. The active-language list is site data (D12.1); the two active
 * languages are `fr` and `en`.
 *
 * MESSAGES_FR is the source of truth for the key set; MESSAGES_EN is typed
 * against it so a missing translation fails to compile, and a runtime parity
 * test guards against empty strings.
 */
export const MESSAGES_FR = {
  // Navigation chrome
  'nav.title': 'Navigation',
  'nav.aria.main': 'Navigation principale',
  'nav.section.general': 'Général',
  'nav.section.data': 'Données',
  'nav.section.renders': 'Rendus',
  'nav.section.quality': 'Qualité',
  'nav.item.dashboard': 'Tableau de bord',
  'nav.item.editor': 'Tracé',
  'nav.item.graph': 'Graphe',
  'nav.item.destinations': 'Destinations',
  'nav.item.supports': 'Supports',
  'nav.item.templates': 'Gabarits',
  'nav.item.floorplans': 'Plans de niveaux',
  'nav.item.faces': 'Faces',
  'nav.item.checks': 'Contrôles',
  'nav.item.proofs': 'BAT',

  // Header bar
  'header.building.fallback': 'Site',
  'header.action.save': 'Enregistrer',
  'header.action.openaudit': "Ouvrir l'audit",
  'header.action.publish': 'Publier',

  // Dashboard
  'dashboard.title': 'Tableau de bord',
  'dashboard.stat.levels': 'Niveaux',
  'dashboard.stat.nodes': 'Nœuds',
  'dashboard.stat.edges': 'Arêtes',
  'dashboard.stat.destinations': 'Destinations',
  'dashboard.stat.supporttypes': 'Types support',
  'dashboard.stat.templates': 'Gabarits',
  'dashboard.stat.findings': 'Alertes',

  // Checks
  'checks.title': 'Contrôles qualité',
  'checks.summary': 'Contrôles exécutés : {run} · ignorés : {skipped} (valeurs normatives manquantes)',
  'checks.skipped': 'Ignorés : {list}',
  'checks.empty': 'Aucune alerte détectée.',
  'checks.col.severity': 'Sévérité',
  'checks.col.code': 'Code',
  'checks.col.entity': 'Entité',
  'checks.col.message': 'Message',
  'checks.col.details': 'Détails',

  // Severity labels (shared)
  'severity.blocking': 'Bloquant',
  'severity.warning': 'Avertissement',
  'severity.info': 'Information',
} as const;

export type UiMessageKey = keyof typeof MESSAGES_FR;

export const MESSAGES_EN: Readonly<Record<UiMessageKey, string>> = {
  'nav.title': 'Navigation',
  'nav.aria.main': 'Main navigation',
  'nav.section.general': 'General',
  'nav.section.data': 'Data',
  'nav.section.renders': 'Renders',
  'nav.section.quality': 'Quality',
  'nav.item.dashboard': 'Dashboard',
  'nav.item.editor': 'Drawing',
  'nav.item.graph': 'Graph',
  'nav.item.destinations': 'Destinations',
  'nav.item.supports': 'Supports',
  'nav.item.templates': 'Templates',
  'nav.item.floorplans': 'Floor plans',
  'nav.item.faces': 'Faces',
  'nav.item.checks': 'Checks',
  'nav.item.proofs': 'Proofs',

  'header.building.fallback': 'Site',
  'header.action.save': 'Save',
  'header.action.openaudit': 'Open audit',
  'header.action.publish': 'Publish',

  'dashboard.title': 'Dashboard',
  'dashboard.stat.levels': 'Levels',
  'dashboard.stat.nodes': 'Nodes',
  'dashboard.stat.edges': 'Edges',
  'dashboard.stat.destinations': 'Destinations',
  'dashboard.stat.supporttypes': 'Support types',
  'dashboard.stat.templates': 'Templates',
  'dashboard.stat.findings': 'Alerts',

  'checks.title': 'Quality checks',
  'checks.summary': 'Checks run: {run} · skipped: {skipped} (missing normative values)',
  'checks.skipped': 'Skipped: {list}',
  'checks.empty': 'No alert detected.',
  'checks.col.severity': 'Severity',
  'checks.col.code': 'Code',
  'checks.col.entity': 'Entity',
  'checks.col.message': 'Message',
  'checks.col.details': 'Details',

  'severity.blocking': 'Blocking',
  'severity.warning': 'Warning',
  'severity.info': 'Info',
};

export const UI_MESSAGES: Readonly<Record<string, Readonly<Record<UiMessageKey, string>>>> = {
  fr: MESSAGES_FR,
  en: MESSAGES_EN,
};
