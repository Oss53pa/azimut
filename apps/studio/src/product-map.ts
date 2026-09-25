/**
 * Partie H — la carte du produit.
 *
 * Quatorze modules, rangés comme la maquette « logiciel autonome v2 » les
 * range : conception, réalisation, exploitation, livrables, et le pilotage
 * (portefeuille et fonctions transverses), qu'on atteint par l'en-tête plutôt
 * que par la barre latérale. Chaque module déclare l'état réel de sa
 * construction : un écran qui existe, un moteur qui existe, ou l'absence de
 * l'un des deux. Cet état n'est pas décoratif — l'écran « Carte du produit »
 * le rend tel quel, et le tableau de bord s'en sert pour dire ce qui manque.
 *
 * La règle d'or de ce fichier : il ne contient aucun texte d'interface, que
 * des clés (D12.1).
 */
import type { ViewId } from './views.js';
import type { UiMessageKey } from './i18n/messages.js';

export const MODULE_FAMILIES = [
  'conception', 'realisation', 'exploitation', 'deliverables', 'steering',
] as const;
export type ModuleFamily = (typeof MODULE_FAMILIES)[number];

/**
 * Les familles que la barre latérale déroule. Le pilotage n'y est pas : le
 * portefeuille s'ouvre depuis le sélecteur de projet, les fonctions
 * transverses depuis la recherche.
 */
export const SIDEBAR_FAMILIES: readonly ModuleFamily[] = [
  'conception', 'realisation', 'exploitation', 'deliverables',
];

/** L'ordre de lecture des modules dans leur famille, celui de la maquette. */
const MODULE_ORDER: readonly string[] = [
  '01', '02', '03', '04', '12', '07', '09', '08', '06', '05', '13', '14', '10', '11',
];

/** Ce qui existe derrière l'écran : un moteur complet, partiel, ou rien. */
export const ENGINE_STATES = ['complete', 'partial', 'absent'] as const;
export type EngineState = (typeof ENGINE_STATES)[number];

export type ProductModule = {
  /** Numéro de partie H, deux chiffres, tel qu'il est cité partout. */
  readonly number: string;
  readonly family: ModuleFamily;
  readonly nameKey: UiMessageKey;
  readonly summaryKey: UiMessageKey;
  /** Où pointe le module dans l'application. */
  readonly entry: ViewId;
  /** Libellé de l'écran d'entrée dans la liste dépliée ; « Vue d'ensemble » à défaut. */
  readonly entryLabelKey?: UiMessageKey;
  /** Écrans supplémentaires du module, dépliés quand il est actif. */
  readonly screens: readonly { readonly view: ViewId; readonly labelKey: UiMessageKey }[];
  readonly engine: EngineState;
  /** Paquet ou répertoire qui porte le moteur, cité tel quel. */
  readonly source: string;
};

export const PRODUCT_MODULES: readonly ProductModule[] = [
  {
    number: '01',
    family: 'conception',
    nameKey: 'module.01.name',
    summaryKey: 'module.01.summary',
    entry: 'foundation',
    screens: [
      { view: 'sites', labelKey: 'nav.item.sites' },
      { view: 'plan-calibration', labelKey: 'nav.item.calibration' },
      { view: 'footprints', labelKey: 'nav.item.footprints' },
      { view: 'graph', labelKey: 'nav.item.graph' },
      { view: 'checks', labelKey: 'nav.item.checks' },
      { view: 'site-sheet', labelKey: 'nav.item.sitesheet' },
      { view: 'destinations', labelKey: 'nav.item.destinations' },
      { view: 'supports', labelKey: 'nav.item.supports' },
      { view: 'floor-plans', labelKey: 'nav.item.floorplans' },
    ],
    // Partiel : M01.S1 à M01.S4 et M01.S6 à M01.S8 tiennent, M01.S6 depuis qu'une longueur d'arête
    // se calcule au lieu d'être crue. M01.S5 ne l'est qu'à moitié — les champs de
    // période existent, aucune lecture ne les filtre et aucun jeu d'essai ne
    // porte deux occupants successifs. M01.S9 n'a aucun moteur : un fond de plan
    // remplacé sans recalage n'est ni détecté ni signalé. Et
    // `LAYOUT.LANG_VARIANT_MISSING`, l'un des cinq contrôles de N1.4, n'est
    // levé nulle part, bien que `site.active_langs` le rende calculable.
    engine: 'partial',
    source: 'engine-graph',
  },
  {
    number: '02',
    family: 'conception',
    nameKey: 'module.02.name',
    summaryKey: 'module.02.summary',
    entry: 'message-schedule',
    entryLabelKey: 'nav.item.messages',
    screens: [
      { view: 'staggering', labelKey: 'nav.item.staggering' },
      { view: 'placement', labelKey: 'nav.item.placement' },
      { view: 'coverage-audit', labelKey: 'nav.item.coverage' },
    ],
    // Partiel : M02.W1, M02.W3 à M02.W6, M02.W8 et M02.W10 tiennent. M02.W2 ne détecte que les
    // collisions — l'entité `naming_rule` n'existe pas, donc « une règle de
    // nommage déclarée est vérifiée à toute création » n'a aucune règle à
    // vérifier. M02.W7 tient sur la forme, le tableau portant version, état et
    // empreinte, mais aucun circuit ne les fait transiter. M02.W9 a son contrôle et
    // pas ses valeurs plafonds, ce que N2.8 pose. Enfin `orientation_zone`, une
    // entité de N2.2, n'existe pas, alors que le zonage d'orientation est dans
    // le périmètre du module et son premier écran.
    engine: 'partial',
    source: 'engine-graph/message-schedule',
  },
  {
    number: '03',
    family: 'conception',
    nameKey: 'module.03.name',
    summaryKey: 'module.03.summary',
    entry: 'customer-flows',
    entryLabelKey: 'nav.item.hypotheses',
    screens: [
      { view: 'travel-profiles', labelKey: 'nav.item.profiles' },
    ],
    engine: 'partial',
    source: 'engine-graph/exposure',
  },
  {
    number: '04',
    family: 'conception',
    nameKey: 'module.04.name',
    summaryKey: 'module.04.summary',
    entry: 'signage',
    screens: [
      { view: 'templates', labelKey: 'nav.item.templates' },
      { view: 'faces', labelKey: 'nav.item.faces' },
      { view: 'wall-plans', labelKey: 'nav.item.wallplans' },
      { view: 'evacuation', labelKey: 'nav.item.evacuation' },
      { view: 'proofs', labelKey: 'nav.item.proofs' },
    ],
    // Partiel : M04.G1, M04.G2, M04.G4, M04.G5, M04.G6, M04.G8 et M04.G10 tiennent. M04.G3 et M04.G7 ont leur
    // moteur — le format se calcule, une version approuvée n'admet que son
    // remplacement — mais aucune écriture ne les emprunte, faute de chemin
    // d'écriture : rien n'écrit `dimensions_source: 'computed'`, rien n'appelle
    // `transitionSupportVersion`. M04.G9 vaut pour le SVG ; N4.8 laisse le
    // déterminisme du PDF ouvert, et c'est la tâche T-0.9 qui le tranche.
    engine: 'partial',
    source: 'engine-layout · engine-package · engine-graph/face-format',
  },
  {
    number: '05',
    family: 'exploitation',
    nameKey: 'module.05.name',
    summaryKey: 'module.05.summary',
    entry: 'advertising',
    entryLabelKey: 'nav.item.adplanning',
    screens: [
      { view: 'ad-inventory', labelKey: 'nav.item.adinventory' },
      { view: 'ad-creatives', labelKey: 'nav.item.adcreatives' },
    ],
    // Partiel, et non complet : M05.R3 (partie N), M05.R4, M05.R5, M05.R6 côté technique et M05.R7 tiennent,
    // mais M05.R2 (partie N) (indexation de la grille sur l'exposition du module 03), M05.R8
    // (rendu en situation) et M05.R9 (facture née d'une décision humaine) n'ont
    // aucun moteur. Un module qui ne facture pas n'a pas un moteur complet.
    engine: 'partial',
    source: 'studio/domain/ad-planning · ad-creative-intake · rules/ad-rules',
  },
  {
    number: '06',
    family: 'exploitation',
    nameKey: 'module.06.name',
    summaryKey: 'module.06.summary',
    entry: 'tenant-signs',
    entryLabelKey: 'nav.item.tenantdossiers',
    screens: [
      { view: 'tenant-rules', labelKey: 'nav.item.tenantrules' },
      { view: 'tenant-instruction', labelKey: 'nav.item.tenantinstruction' },
    ],
    // Partiel : M06.T1 ne couvre pas les plages horaires, faute de modèle
    // temporel, et M06.T2 n'a aucun objet « avis humain » à opposer au contrôle
    // automatique. M06.T3 (refus motivé, réserves qui se lèvent), M06.T4 (historique
    // par cellule) et M06.T5 (constat de conformité avec photographie) n'ont aucun
    // moteur, et les pièces déposées ne passent par aucun assainissement.
    engine: 'partial',
    source: 'studio/domain/tenant-regulation',
  },
  {
    number: '07',
    family: 'realisation',
    nameKey: 'module.07.name',
    summaryKey: 'module.07.summary',
    entry: 'worksite',
    screens: [
      { view: 'worksite-lots', labelKey: 'nav.item.worksitelots' },
      { view: 'worksite-slots', labelKey: 'nav.item.worksiteslots' },
      { view: 'worksite-reserves', labelKey: 'nav.item.worksitereserves' },
    ],
    engine: 'partial',
    source: 'studio/domain/install-reserves',
  },
  {
    number: '08',
    family: 'exploitation',
    nameKey: 'module.08.name',
    summaryKey: 'module.08.summary',
    entry: 'operations',
    screens: [
      { view: 'ops-rounds', labelKey: 'nav.item.opsrounds' },
      { view: 'ops-incidents', labelKey: 'nav.item.opsincidents' },
      { view: 'ops-divergences', labelKey: 'nav.item.opsdivergences' },
    ],
    // Partiel, comme le tableau de la partie H le dit déjà. `reconcile` produit
    // trois des six types de divergence de A5.7 et un quatrième sous un autre
    // nom ; `outdated_content` et `damaged` manquent. Une ligne de
    // rapprochement n'est ni datée ni résoluble, alors que E2 l'exige, et la
    // machine à états qui porte cette règle n'est appelée par personne. E3
    // (ordre de travaux né d'une décision humaine), E4 (tournée hors ligne) et
    // E5 (relevé avec photographie et position) n'ont aucun moteur.
    engine: 'partial',
    source: 'studio/domain/survey-sync · engine-graph/reconciliation',
  },
  {
    number: '09',
    family: 'realisation',
    nameKey: 'module.09.name',
    summaryKey: 'module.09.summary',
    entry: 'budget',
    screens: [
      { view: 'budget-references', labelKey: 'nav.item.budgetrefs' },
      { view: 'budget-tracking', labelKey: 'nav.item.budgettrack' },
    ],
    engine: 'partial',
    source: 'studio/domain/cost-reference',
  },
  {
    number: '10',
    family: 'steering',
    nameKey: 'module.10.name',
    summaryKey: 'module.10.summary',
    entry: 'portfolio',
    screens: [],
    engine: 'absent',
    // Aucun fichier ne porte ce module : la case reste vide plutôt que de
    // nommer un chemin qui n'existe pas.
    source: '\u2014',
  },
  {
    number: '11',
    family: 'steering',
    nameKey: 'module.11.name',
    summaryKey: 'module.11.summary',
    entry: 'cross-cutting',
    screens: [],
    engine: 'partial',
    source: 'studio/i18n · studio/domain/module-entitlement',
  },
  {
    number: '12',
    family: 'conception',
    nameKey: 'module.12.name',
    summaryKey: 'module.12.summary',
    entry: 'editor',
    screens: [],
    engine: 'complete',
    source: 'studio/editor',
  },
  {
    number: '13',
    family: 'exploitation',
    nameKey: 'module.13.name',
    summaryKey: 'module.13.summary',
    entry: 'kiosk-app',
    screens: [],
    // Partiel : le paquet de borne se compile et se relit (engine-package),
    // et l'exécutable de borne le joue (apps/kiosk-runtime). L'application
    // mobile et l'écran de gestion du parc de bornes n'existent pas.
    engine: 'partial',
    source: 'engine-package · apps/kiosk-runtime',
  },
  {
    number: '14',
    family: 'deliverables',
    nameKey: 'module.14.name',
    summaryKey: 'module.14.summary',
    entry: 'deliverables',
    screens: [],
    // Absent : aucun moteur ne compose un dossier client ou fabricant. Les
    // exports existent module par module (épreuves, tableau des messages,
    // relevé de contrôles), rien ne les assemble en une restitution.
    engine: 'absent',
    source: '\u2014',
  },
];

/** Le module qui porte cet écran, ou `undefined` pour le chrome. */
export function moduleOfView(view: ViewId): ProductModule | undefined {
  return PRODUCT_MODULES.find(
    m => m.entry === view || m.screens.some(s => s.view === view),
  );
}

export function modulesOfFamily(family: ModuleFamily): readonly ProductModule[] {
  return PRODUCT_MODULES
    .filter(m => m.family === family)
    .sort((a, b) => MODULE_ORDER.indexOf(a.number) - MODULE_ORDER.indexOf(b.number));
}

export const FAMILY_LABEL_KEYS: Readonly<Record<ModuleFamily, UiMessageKey>> = {
  conception: 'family.conception',
  realisation: 'family.realisation',
  exploitation: 'family.exploitation',
  deliverables: 'family.deliverables',
  steering: 'family.steering',
};

export const ENGINE_LABEL_KEYS: Readonly<Record<EngineState, UiMessageKey>> = {
  complete: 'module.engine.complete',
  partial: 'module.engine.partial',
  absent: 'module.engine.absent',
};
