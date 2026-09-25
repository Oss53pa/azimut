/**
 * D12.1 / partie H — la carte du produit : familles, modules, états.
 *
 * Fragment du catalogue. La table française porte le jeu de clés ;
 * la table anglaise est typée contre elle, une traduction manquante
 * ne compile pas.
 */
export const MODULES_FR = {
  // Familles de modules
  'family.conception': 'Conception',
  'family.realisation': 'Réalisation',
  'family.exploitation': 'Exploitation',
  'family.deliverables': 'Livrables',
  'family.steering': 'Pilotage',

  // Navigation — entrées ajoutées par la carte du produit
  'nav.item.productmap': 'Carte du produit',
  'nav.item.sites': 'Sites',
  'nav.item.calibration': 'Calage du plan',
  'nav.item.footprints': 'Empreintes',

  // Modules — noms
  'module.01.name': 'Socle du site',
  'module.02.name': 'Wayfinding',
  'module.03.name': 'Parcours',
  'module.04.name': 'Signalétique',
  'module.05.name': 'Régie publicitaire',
  'module.06.name': 'Enseignes',
  'module.07.name': 'Chantier',
  'module.08.name': 'Maintenance',
  'module.09.name': 'Budget',
  'module.10.name': 'Portefeuille',
  'module.11.name': 'Fonctions transverses',
  'module.12.name': 'Atelier de dessin',
  'module.13.name': 'Bornes et appli',
  'module.14.name': 'Restitutions',

  // Modules — résumés
  'module.01.summary': 'Graphe, destinations, supports, plans de niveaux, contrôles de complétude.',
  'module.02.summary': 'Tableau des messages : génération, péremption ligne à ligne, exports tableur et document.',
  'module.03.summary': "Garde-fous sur les hypothèses de flux et l'export. Calcul d'exposition non construit.",
  'module.04.summary': 'Gabarits, composition de face, rendu SVG, export PDF, épreuves, compilation en lot.',
  'module.05.summary': "Planning d'occupation et contrôle des visuels.",
  'module.06.summary': "Règlement d'enseigne contrôlé par axe : hauteur, débord, matériau, éclairage.",
  'module.07.summary': 'Réserves de pose, allotissement, bascule en support posé.',
  'module.08.summary': 'Couche de divergence, tournées, réconciliation des relevés.',
  'module.09.summary': "Coûts de référence historisés, estimation d'un carnet, multi-devises.",
  'module.10.summary': 'Vue de groupe, comparaison, héritage de chartes.',
  'module.11.summary': 'Droits par module, journal, internationalisation.',
  'module.12.summary': "Édition vectorielle : outils, magnétisme, commandes annulables, habillage.",
  'module.13.summary': 'Paquet de borne compilé et vérifié, exécutable de borne. Application mobile et gestion du parc non construites.',
  'module.14.summary': 'Dossiers client et fabricant, rapport client. Aucun moteur ne les compose encore.',

  // Modules — état du moteur
  'module.engine.complete': 'Moteur complet',
  'module.engine.partial': 'Moteur partiel',
  'module.engine.absent': 'Moteur absent',
  'module.engine.label': 'Moteur',
  'module.source.label': 'Source',

  // Écran « Carte du produit »
  'productmap.title': 'Carte du produit',
  'productmap.subtitle': 'Product map',
  'productmap.eyebrow': 'Partie H · carte complète',
  'productmap.stat.modules': 'Modules',
  'productmap.stat.screens': 'Écrans',
  'productmap.stat.engines.complete': 'Moteurs complets',
  'productmap.stat.engines.partial': 'Moteurs partiels',
  'productmap.stat.engines.absent': 'Moteurs absents',
  'productmap.screens.count': '{count} écran(s)',
  'productmap.open': 'Ouvrir',
  'productmap.note': "L'état affiché est celui du dépôt, pas une intention : un module au moteur absent le reste tant qu'aucun code ne le porte.",
} as const;

export const MODULES_EN: Readonly<Record<keyof typeof MODULES_FR, string>> = {
  'family.conception': 'Design',
  'family.realisation': 'Delivery',
  'family.exploitation': 'Operations',
  'family.deliverables': 'Deliverables',
  'family.steering': 'Steering',

  'nav.item.productmap': 'Product map',
  'nav.item.sites': 'Sites',
  'nav.item.calibration': 'Plan calibration',
  'nav.item.footprints': 'Footprints',

  'module.01.name': 'Site foundation',
  'module.02.name': 'Wayfinding',
  'module.03.name': 'Customer flows',
  'module.04.name': 'Signage production',
  'module.05.name': 'Advertising',
  'module.06.name': 'Tenant signs',
  'module.07.name': 'Worksite',
  'module.08.name': 'Maintenance',
  'module.09.name': 'Budget',
  'module.10.name': 'Portfolio',
  'module.11.name': 'Cross-cutting',
  'module.12.name': 'Drawing workshop',
  'module.13.name': 'Kiosks and app',
  'module.14.name': 'Deliverables',

  'module.01.summary': 'Graph, destinations, supports, floor plans, completeness checks.',
  'module.02.summary': 'Message schedule: generation, line-by-line staleness, spreadsheet and document exports.',
  'module.03.summary': 'Guards on flow hypotheses and export. Exposure computation not built.',
  'module.04.summary': 'Templates, face composition, SVG render, PDF export, proofs, batch compilation.',
  'module.05.summary': 'Placement booking schedule and creative control.',
  'module.06.summary': 'Sign regulation checked axis by axis: height, overhang, material, lighting.',
  'module.07.summary': 'Installation reserves, lots, switch to installed.',
  'module.08.summary': 'Divergence layer, inspection rounds, survey reconciliation.',
  'module.09.summary': 'Historised reference costs, schedule estimation, multi-currency.',
  'module.10.summary': 'Group view, comparison, charter inheritance.',
  'module.11.summary': 'Per-module rights, activity log, internationalisation.',
  'module.12.summary': 'Vector editing: tools, snapping, reversible commands, habillage.',
  'module.13.summary': 'Compiled and verified kiosk package, kiosk runtime. Mobile app and fleet management not built.',
  'module.14.summary': 'Client and manufacturer files, client report. No engine composes them yet.',

  'module.engine.complete': 'Engine complete',
  'module.engine.partial': 'Engine partial',
  'module.engine.absent': 'Engine absent',
  'module.engine.label': 'Engine',
  'module.source.label': 'Source',

  'productmap.title': 'Product map',
  'productmap.subtitle': 'Carte du produit',
  'productmap.eyebrow': 'Part H · full map',
  'productmap.stat.modules': 'Modules',
  'productmap.stat.screens': 'Screens',
  'productmap.stat.engines.complete': 'Complete engines',
  'productmap.stat.engines.partial': 'Partial engines',
  'productmap.stat.engines.absent': 'Absent engines',
  'productmap.screens.count': '{count} screen(s)',
  'productmap.open': 'Open',
  'productmap.note': 'The state shown is the repository’s, not an intention: a module with no engine keeps that label until code carries one.',
};
