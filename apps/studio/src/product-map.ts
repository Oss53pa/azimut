/**
 * Partie H — la carte du produit.
 *
 * Douze modules, quatre familles. Chaque module déclare l'état réel de sa
 * construction : un écran qui existe, un moteur qui existe, ou l'absence de
 * l'un des deux. Cet état n'est pas décoratif — l'écran « Carte du produit »
 * le rend tel quel, et le tableau de bord s'en sert pour dire ce qui manque.
 *
 * La règle d'or de ce fichier : il ne contient aucun texte d'interface, que
 * des clés (D12.1).
 */
import type { ViewId } from './views.js';
import type { UiMessageKey } from './i18n/messages.js';

export const MODULE_FAMILIES = ['design', 'commerce', 'production', 'direction'] as const;
export type ModuleFamily = (typeof MODULE_FAMILIES)[number];

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
  /** Écrans supplémentaires du module, dépliés quand il est actif. */
  readonly screens: readonly { readonly view: ViewId; readonly labelKey: UiMessageKey }[];
  readonly engine: EngineState;
  /** Paquet ou répertoire qui porte le moteur, cité tel quel. */
  readonly source: string;
};

export const PRODUCT_MODULES: readonly ProductModule[] = [
  {
    number: '01',
    family: 'design',
    nameKey: 'module.01.name',
    summaryKey: 'module.01.summary',
    entry: 'foundation',
    screens: [
      { view: 'sites', labelKey: 'nav.item.sites' },
      { view: 'plan-calibration', labelKey: 'nav.item.calibration' },
      { view: 'footprints', labelKey: 'nav.item.footprints' },
      { view: 'graph', labelKey: 'nav.item.graph' },
      { view: 'destinations', labelKey: 'nav.item.destinations' },
      { view: 'supports', labelKey: 'nav.item.supports' },
      { view: 'floor-plans', labelKey: 'nav.item.floorplans' },
      { view: 'checks', labelKey: 'nav.item.checks' },
    ],
    engine: 'complete',
    source: 'engine-graph',
  },
  {
    number: '02',
    family: 'design',
    nameKey: 'module.02.name',
    summaryKey: 'module.02.summary',
    entry: 'message-schedule',
    screens: [],
    engine: 'complete',
    source: 'engine-graph/message-schedule',
  },
  {
    number: '03',
    family: 'commerce',
    nameKey: 'module.03.name',
    summaryKey: 'module.03.summary',
    entry: 'customer-flows',
    screens: [],
    engine: 'partial',
    source: 'engine-graph/exposure',
  },
  {
    number: '04',
    family: 'design',
    nameKey: 'module.04.name',
    summaryKey: 'module.04.summary',
    entry: 'signage',
    screens: [
      { view: 'templates', labelKey: 'nav.item.templates' },
      { view: 'faces', labelKey: 'nav.item.faces' },
      { view: 'proofs', labelKey: 'nav.item.proofs' },
    ],
    // Partiel : G1, G2, G4, G5, G6, G8 et G10 tiennent. G3 et G7 ont leur
    // moteur — le format se calcule, une version approuvée n'admet que son
    // remplacement — mais aucune écriture ne les emprunte, faute de chemin
    // d'écriture : rien n'écrit `dimensions_source: 'computed'`, rien n'appelle
    // `transitionSupportVersion`. G9 vaut pour le SVG ; N4.8 laisse le
    // déterminisme du PDF ouvert, et c'est la tâche T-0.9 qui le tranche.
    engine: 'partial',
    source: 'engine-layout · engine-package · engine-graph/face-format',
  },
  {
    number: '05',
    family: 'commerce',
    nameKey: 'module.05.name',
    summaryKey: 'module.05.summary',
    entry: 'advertising',
    screens: [],
    // Partiel, et non complet : R3 (partie N), R4, R5, R6 côté technique et R7 tiennent,
    // mais R2 (partie N) (indexation de la grille sur l'exposition du module 03), R8
    // (rendu en situation) et R9 (facture née d'une décision humaine) n'ont
    // aucun moteur. Un module qui ne facture pas n'a pas un moteur complet.
    engine: 'partial',
    source: 'studio/domain/ad-planning · ad-creative-intake · rules/ad-rules',
  },
  {
    number: '06',
    family: 'commerce',
    nameKey: 'module.06.name',
    summaryKey: 'module.06.summary',
    entry: 'tenant-signs',
    screens: [],
    // Partiel : T1 ne couvre pas les plages horaires, faute de modèle
    // temporel, et T2 n'a aucun objet « avis humain » à opposer au contrôle
    // automatique. T3 (refus motivé, réserves qui se lèvent), T4 (historique
    // par cellule) et T5 (constat de conformité avec photographie) n'ont aucun
    // moteur, et les pièces déposées ne passent par aucun assainissement.
    engine: 'partial',
    source: 'studio/domain/tenant-regulation',
  },
  {
    number: '07',
    family: 'production',
    nameKey: 'module.07.name',
    summaryKey: 'module.07.summary',
    entry: 'worksite',
    screens: [],
    engine: 'partial',
    source: 'studio/domain/install-reserves',
  },
  {
    number: '08',
    family: 'production',
    nameKey: 'module.08.name',
    summaryKey: 'module.08.summary',
    entry: 'operations',
    screens: [],
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
    family: 'production',
    nameKey: 'module.09.name',
    summaryKey: 'module.09.summary',
    entry: 'budget',
    screens: [],
    engine: 'partial',
    source: 'studio/domain/cost-reference',
  },
  {
    number: '10',
    family: 'direction',
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
    family: 'direction',
    nameKey: 'module.11.name',
    summaryKey: 'module.11.summary',
    entry: 'cross-cutting',
    screens: [],
    engine: 'partial',
    source: 'studio/i18n · studio/domain/module-entitlement',
  },
  {
    number: '12',
    family: 'design',
    nameKey: 'module.12.name',
    summaryKey: 'module.12.summary',
    entry: 'editor',
    screens: [],
    engine: 'complete',
    source: 'studio/editor',
  },
];

/** Le module qui porte cet écran, ou `undefined` pour le chrome. */
export function moduleOfView(view: ViewId): ProductModule | undefined {
  return PRODUCT_MODULES.find(
    m => m.entry === view || m.screens.some(s => s.view === view),
  );
}

export function modulesOfFamily(family: ModuleFamily): readonly ProductModule[] {
  return PRODUCT_MODULES.filter(m => m.family === family);
}

export const FAMILY_LABEL_KEYS: Readonly<Record<ModuleFamily, UiMessageKey>> = {
  design: 'family.design',
  commerce: 'family.commerce',
  production: 'family.production',
  direction: 'family.direction',
};

export const ENGINE_LABEL_KEYS: Readonly<Record<EngineState, UiMessageKey>> = {
  complete: 'module.engine.complete',
  partial: 'module.engine.partial',
  absent: 'module.engine.absent',
};
