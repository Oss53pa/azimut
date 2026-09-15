/**
 * Entrée serveur du paquet — `@azimut/rules/loader`.
 *
 * Tout ce qui lit le disque ou calcule une empreinte passe par ici. Un
 * navigateur n'importe jamais ce module ; il n'en a pas besoin, puisque
 * la résolution des règles est pure et reste sur l'entrée principale.
 */

export { loadRulesPack } from './loader.js';
export type { LoadRulesPackOptions } from './loader.js';
export { buildRulesPackIndex } from './pack-index.js';
