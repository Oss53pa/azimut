/**
 * La coquille de l'application — en-tête, barre latérale, recherche, accueil —
 * dessinée sur la maquette « logiciel autonome v2 », et les écrans des
 * modules 13 et 14.
 *
 * Fragment du catalogue. La table française porte le jeu de clés ;
 * la table anglaise est typée contre elle, une traduction manquante
 * ne compile pas.
 */
export const SHELL_FR = {
  'shell.brand.home': "Azimut, retour à l'accueil",
  'shell.nav.home': 'Accueil',
  'shell.nav.overview': "Vue d'ensemble",
  'shell.nav.screens': 'Écrans du module {module}',
  'shell.nav.collapse': 'Réduire le menu',
  'shell.nav.expand': 'Déplier le menu',

  'shell.project.meta': '{building} · {organization}',
  'shell.project.menu': "Sites de l'organisation",
  'shell.project.portfolio': 'Vue portefeuille, tous les sites',
  'shell.project.all': 'Gérer les sites',

  'shell.search.placeholder': 'Rechercher, aller à…',
  'shell.search.shortcut': 'Ctrl K',
  'shell.search.aria': "Rechercher un module ou un écran",
  'shell.search.empty': 'Aucun module ni écran ne correspond.',
  'shell.search.hint.move': '↑ ↓ pour choisir',
  'shell.search.hint.open': 'Entrée pour ouvrir',
  'shell.search.hint.close': 'Échap',
  'shell.search.kind.module': 'Module',
  'shell.search.kind.screen': 'Écran',
  'shell.search.module': '{number} · {module}',

  'home.greeting': 'Bonjour · {date}',
  'home.subtitle': '{building} · {organization}',
  'home.action.plan': 'Atelier plan et parcours',
  'home.action.signage': 'Atelier signalétique',
  'home.action.deliverables': 'Rédiger le dossier',

  'outline.eyebrow': 'Module {number}',
  'outline.available': 'Ce qui existe déjà',
  'outline.available.none': "Rien, pour l'instant.",
  'outline.planned': 'Écrans à construire',
  'outline.planned.state': 'non construit',
  'outline.open': 'Ouvrir',

  'kioskapp.available.destinations': "L'annuaire que la borne interroge.",
  'kioskapp.available.floorplans': 'Les plans de niveaux que la borne affiche.',
  'kioskapp.planned.portrait': 'Borne, format portrait',
  'kioskapp.planned.landscape': 'Borne, format paysage',
  'kioskapp.planned.phone': 'Application téléphone',
  'kioskapp.planned.fleet': 'Gestion du parc de bornes',
  'kioskapp.note': "Le paquet de borne se compile et se vérifie (engine-package), et l'exécutable de borne le joue. Le studio n'a pas encore d'écran pour les prévisualiser ni pour gérer le parc.",

  'deliverables.available.proofs': 'Épreuves des faces, à valider avant fabrication.',
  'deliverables.available.messages': 'Tableau des messages, en tableur et en document.',
  'deliverables.available.checks': 'Relevé des contrôles du site, exportable.',
  'deliverables.planned.client': 'Dossier client',
  'deliverables.planned.manufacturer': 'Dossier fabricant',
  'deliverables.planned.report': 'Rapport client',
  'deliverables.planned.compose': 'Composer un dossier',
  'deliverables.planned.pieces': 'Pièces jointes',
  'deliverables.note': "Aucun moteur n'assemble encore les pièces en dossier. Chacune reste exportable depuis son module.",
} as const;

export const SHELL_EN: Readonly<Record<keyof typeof SHELL_FR, string>> = {
  'shell.brand.home': 'Azimut, back to home',
  'shell.nav.home': 'Home',
  'shell.nav.overview': 'Overview',
  'shell.nav.screens': 'Screens of module {module}',
  'shell.nav.collapse': 'Collapse menu',
  'shell.nav.expand': 'Expand menu',

  'shell.project.meta': '{building} · {organization}',
  'shell.project.menu': 'Organisation sites',
  'shell.project.portfolio': 'Portfolio view, all sites',
  'shell.project.all': 'Manage sites',

  'shell.search.placeholder': 'Search, go to…',
  'shell.search.shortcut': 'Ctrl K',
  'shell.search.aria': 'Search for a module or a screen',
  'shell.search.empty': 'No module or screen matches.',
  'shell.search.hint.move': '↑ ↓ to choose',
  'shell.search.hint.open': 'Enter to open',
  'shell.search.hint.close': 'Esc',
  'shell.search.kind.module': 'Module',
  'shell.search.kind.screen': 'Screen',
  'shell.search.module': '{number} · {module}',

  'home.greeting': 'Hello · {date}',
  'home.subtitle': '{building} · {organization}',
  'home.action.plan': 'Plan and flows workshop',
  'home.action.signage': 'Signage workshop',
  'home.action.deliverables': 'Write the file',

  'outline.eyebrow': 'Module {number}',
  'outline.available': 'What already exists',
  'outline.available.none': 'Nothing yet.',
  'outline.planned': 'Screens to build',
  'outline.planned.state': 'not built',
  'outline.open': 'Open',

  'kioskapp.available.destinations': 'The directory the kiosk queries.',
  'kioskapp.available.floorplans': 'The floor plans the kiosk displays.',
  'kioskapp.planned.portrait': 'Kiosk, portrait format',
  'kioskapp.planned.landscape': 'Kiosk, landscape format',
  'kioskapp.planned.phone': 'Phone app',
  'kioskapp.planned.fleet': 'Kiosk fleet management',
  'kioskapp.note': 'The kiosk package compiles and verifies (engine-package), and the kiosk runtime plays it. The studio has no screen yet to preview it or manage the fleet.',

  'deliverables.available.proofs': 'Face proofs, to approve before manufacturing.',
  'deliverables.available.messages': 'Message schedule, as spreadsheet and document.',
  'deliverables.available.checks': 'Site checks report, exportable.',
  'deliverables.planned.client': 'Client file',
  'deliverables.planned.manufacturer': 'Manufacturer file',
  'deliverables.planned.report': 'Client report',
  'deliverables.planned.compose': 'Compose a file',
  'deliverables.planned.pieces': 'Attachments',
  'deliverables.note': 'No engine assembles the pieces into a file yet. Each remains exportable from its module.',
} as const;
