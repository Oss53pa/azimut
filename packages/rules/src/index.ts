/**
 * Entrée du paquet, utilisable dans un navigateur.
 *
 * Rien ici ne doit, même transitivement, importer `node:` : le studio
 * embarque ce paquet par l'intermédiaire d'engine-graph. Le chargement
 * d'un paquet de règles, qui lit le disque, est exposé séparément sous
 * `@azimut/rules/loader`. Un test garde-fou vérifie cette séparation.
 */

export {
  rulesPackSchema,
  rulesPackRuleSchema,
  ruleScopeSchema,
  ruleConstraintSchema,
  manifestSchema,
  ruleFileSchema,
} from './schema.js';
export type {
  RulesPackFile,
  RulesPackRule,
  RuleScope,
  RuleConstraint,
  Manifest,
  RuleFileContent,
} from './schema.js';
export {
  resolveRule,
  groupAndCheckAmbiguity,
  scopeSpecificity,
} from './rule-resolution.js';
export type { LoadedRulesPack, RuleScopeContext } from './rule-resolution.js';
export { resolveSiteRulesPack } from './resolve-site-pack.js';
export type { RulesPackIndex, RulesPackSource } from './resolve-site-pack.js';
export { loadPackDirectory } from './pack-directory.js';
export { mergeCountryOverlay } from './overlay.js';
export { guardAdRulesPack } from './ad-rules.js';
export type { AdRulesPack } from './ad-rules.js';
export {
  checkCharHeight,
  requiredCharHeightMm,
  checkContrast,
  checkStrokeToHeight,
  checkMountingHeight,
} from './rule-checks.js';
export type {
  CharHeightInput,
  ContrastInput,
  StrokeToHeightInput,
  MountingHeightInput,
} from './rule-checks.js';
