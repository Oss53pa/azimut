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

  // Graph
  'graph.title': 'Graphe de circulation',
  'graph.summary': '{nodes} nœuds · {edges} arêtes · {vlinks} liens verticaux',
  'graph.section.nodesbykind': 'Nœuds par type',
  'graph.section.nodesbylevel': 'Nœuds par niveau',
  'graph.section.edges': 'Arêtes',
  'graph.section.verticallinks': 'Liens verticaux',
  'graph.row.total': 'Total',
  'graph.row.accessible': 'Accessibles',
  'graph.row.evacuation': 'Évacuation',
  'graph.vlink.capacity': 'capacité {capacity}',

  // Supports
  'supports.title': 'Carnet de supports',
  'supports.count': 'Types de support : {count}',
  'supports.col.key': 'Clé',
  'supports.col.name': 'Nom',
  'supports.col.faces': 'Faces',
  'supports.col.defaultdims': 'Dimensions par défaut',

  // Templates
  'templates.title': 'Gabarits de face',
  'templates.count': 'Gabarits : {count}',
  'templates.blocks': 'Blocs ({count}) : {kinds}',

  // Destinations
  'destinations.title': 'Destinations',
  'destinations.subtitle': "Points d'intérêt et occupants du site",
  'destinations.col.namefr': 'Nom (fr)',
  'destinations.col.nameen': 'Nom (en)',
  'destinations.col.level': 'Niveau',
  'destinations.col.node': 'Nœud',
  'destinations.col.status': 'Statut',
  'destinations.col.priority': 'Priorité',
  'status.occupied': 'Occupé',
  'status.vacant': 'Vacant',
  'status.reserved': 'Réservé',
  'status.underfitout': 'En aménagement',

  // Faces
  'faces.title': 'Rendus de faces',
  'faces.subtitle': 'Aperçu SVG des faces résolues pour chaque gabarit.',
  'faces.empty.notemplate': 'Aucun gabarit de face configuré.',
  'faces.meta': 'Type : {type} · Face : {side} · blocs : {blocks}',
  'faces.previewnode': 'Nœud : {label} ({kind})',
  'faces.noprofile': 'Aucun profil de parcours disponible.',
  'faces.nopreview': 'Aperçu indisponible pour ce gabarit.',

  // Proofs
  'proofs.title': 'Bons à tirer',
  'proofs.summary': 'Gabarits : {templates} · résolus : {resolved} · avertissements : {warnings}',
  'proofs.col.template': 'Gabarit',
  'proofs.col.typeface': 'Type / Face',
  'proofs.col.testnode': 'Nœud test',
  'proofs.col.status': 'Statut',
  'proofs.col.warnings': 'Avertissements',
  'proofs.empty': 'Aucun gabarit configuré.',
  'proofs.status.resolved': 'Résolu',
  'proofs.status.failed': 'Échec',

  // Floor plans
  'floorplans.title': 'Plans de niveaux',
  'floorplans.viewport.aria': 'Plan du niveau {level}',
  'floorplans.empty': 'Sélectionnez un niveau.',
  'floorplans.selection': 'Sélection : {ids}',
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

  'graph.title': 'Circulation graph',
  'graph.summary': '{nodes} nodes · {edges} edges · {vlinks} vertical links',
  'graph.section.nodesbykind': 'Nodes by type',
  'graph.section.nodesbylevel': 'Nodes by level',
  'graph.section.edges': 'Edges',
  'graph.section.verticallinks': 'Vertical links',
  'graph.row.total': 'Total',
  'graph.row.accessible': 'Accessible',
  'graph.row.evacuation': 'Evacuation',
  'graph.vlink.capacity': 'capacity {capacity}',

  'supports.title': 'Support inventory',
  'supports.count': 'Support types: {count}',
  'supports.col.key': 'Key',
  'supports.col.name': 'Name',
  'supports.col.faces': 'Faces',
  'supports.col.defaultdims': 'Default dimensions',

  'templates.title': 'Face templates',
  'templates.count': 'Templates: {count}',
  'templates.blocks': 'Blocks ({count}): {kinds}',

  'destinations.title': 'Destinations',
  'destinations.subtitle': 'Points of interest and site occupants',
  'destinations.col.namefr': 'Name (fr)',
  'destinations.col.nameen': 'Name (en)',
  'destinations.col.level': 'Level',
  'destinations.col.node': 'Node',
  'destinations.col.status': 'Status',
  'destinations.col.priority': 'Priority',
  'status.occupied': 'Occupied',
  'status.vacant': 'Vacant',
  'status.reserved': 'Reserved',
  'status.underfitout': 'Under fit-out',

  'faces.title': 'Face renders',
  'faces.subtitle': 'SVG preview of resolved faces for each template.',
  'faces.empty.notemplate': 'No face template configured.',
  'faces.meta': 'Type: {type} · Face: {side} · blocks: {blocks}',
  'faces.previewnode': 'Node: {label} ({kind})',
  'faces.noprofile': 'No travel profile available.',
  'faces.nopreview': 'Preview unavailable for this template.',

  'proofs.title': 'Proofs',
  'proofs.summary': 'Templates: {templates} · resolved: {resolved} · warnings: {warnings}',
  'proofs.col.template': 'Template',
  'proofs.col.typeface': 'Type / Face',
  'proofs.col.testnode': 'Test node',
  'proofs.col.status': 'Status',
  'proofs.col.warnings': 'Warnings',
  'proofs.empty': 'No template configured.',
  'proofs.status.resolved': 'Resolved',
  'proofs.status.failed': 'Failed',

  'floorplans.title': 'Floor plans',
  'floorplans.viewport.aria': 'Plan of level {level}',
  'floorplans.empty': 'Select a level.',
  'floorplans.selection': 'Selection: {ids}',
};

export const UI_MESSAGES: Readonly<Record<string, Readonly<Record<UiMessageKey, string>>>> = {
  fr: MESSAGES_FR,
  en: MESSAGES_EN,
};
