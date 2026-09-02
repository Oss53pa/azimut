export { validateGraph } from './validate-graph.js';
export type { ValidationResult } from './validate-graph.js';
export { buildAdjacency, bfs } from './graph-traversal.js';
export { computeRoute } from './compute-route.js';
export type { Route } from './compute-route.js';
export { RouteCache } from './route-cache.js';
export { deriveDecisionPoints } from './decision-points.js';
export type { DecisionPoint } from './decision-points.js';
export {
  auditCoverage,
  auditAccessibility,
  auditEvacuation,
} from './audit.js';
export type {
  Support,
  CoverageReport,
  AccessibilityReport,
  EvacuationReport,
} from './audit.js';
export { reconcile } from './reconciliation.js';
export type {
  SurveyedSupport,
  ExpectedSupport,
  ReconciliationLine,
  ReconciliationReport,
} from './reconciliation.js';
export { validateDirectory } from './validate-directory.js';
export type { DirectoryValidationResult } from './validate-directory.js';
export {
  validateLibrary,
  guardSafetyRegistry,
  guardSafetyDeletion,
} from './validate-library.js';
export type {
  LibraryValidationResult,
  PictogramMutation,
} from './validate-library.js';
