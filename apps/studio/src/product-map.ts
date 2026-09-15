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
    entry: 'faces',
    screens: [
      { view: 'templates', labelKey: 'nav.item.templates' },
      { view: 'proofs', labelKey: 'nav.item.proofs' },
    ],
    engine: 'complete',
    source: 'engine-layout · engine-package',
  },
  {
    number: '05',
    family: 'commerce',
    nameKey: 'module.05.name',
    summaryKey: 'module.05.summary',
    entry: 'advertising',
    screens: [],
    engine: 'complete',
    source: 'studio/domain/ad-planning',
  },
  {
    number: '06',
    family: 'commerce',
    nameKey: 'module.06.name',
    summaryKey: 'module.06.summary',
    entry: 'tenant-signs',
    screens: [],
    engine: 'complete',
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
    engine: 'complete',
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
    source: 'studio/domain/portfolio',
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
