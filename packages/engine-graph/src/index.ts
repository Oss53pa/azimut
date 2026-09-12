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
export { validateGeometry } from './validate-geometry.js';
export type { GeometryValidationResult } from './validate-geometry.js';
export {
  validateLibrary,
  guardSafetyRegistry,
  guardSafetyDeletion,
  guardSafetyCreation,
} from './validate-library.js';
export { importSupports } from './import-supports.js';
export { qualifyCad } from './qualify-cad.js';
export type {
  CadEntity,
  CadLayer,
  CadEntitySet,
  CadUnit,
  CadQualificationOptions,
  CadQualificationReport,
} from './qualify-cad.js';
export { validateSupports } from './validate-supports.js';
export type { SupportValidationResult } from './validate-supports.js';
export { resolveFaceContent } from './resolve-face.js';
export { guardCharterOnSafety } from './guard-safety.js';
export type { CharterApplication } from './guard-safety.js';
export type {
  ResolvedBlock,
  ResolvedContent,
  ResolvedDestinationEntry,
  ResolvedFace,
} from './resolve-face.js';
export type {
  ImportedSupport,
  ImportLineResult,
  ImportReport,
  ImportSupportsOptions,
  SupportCondition,
  DimensionsSource,
} from './import-supports.js';
export type {
  LibraryValidationResult,
  PictogramMutation,
  PictogramCreation,
} from './validate-library.js';
export { computeQuantities, quantityReportToCsv } from './compute-quantities.js';
export { runChecks } from './run-checks.js';
export type { CheckReport } from './run-checks.js';
export { renderFace } from './render-face.js';
export { compileTemplate } from './compile-template.js';
export type { FaceDimensions } from './compile-template.js';
export type { FaceTheme, RenderFaceOptions } from './render-face.js';
export { validateProofs } from './validate-proofs.js';
export type { ProofValidationResult } from './validate-proofs.js';
export { computeInputsHash, computeContentHash } from './compute-hashes.js';
export type { ContentHashInput } from './compute-hashes.js';
export { computeStaleFaces } from './compute-staleness.js';
export type {
  FaceHashDescriptor,
  FaceStaleness,
  StalenessReport,
} from './compute-staleness.js';
export type {
  CsvLang,
  PlacedSupport,
  TypeQuantity,
  BuildingQuantity,
  LevelQuantity,
  QuantityReport,
} from './compute-quantities.js';
export { importOccupancy } from './import-occupancy.js';
export type {
  ImportedOccupancy,
  OccupancyLineResult,
  OccupancyImportReport,
} from './import-occupancy.js';

// H2.5 — Tableau des messages
export {
  INFORMATION_LEVELS,
  NO_WAYFINDING_RULES,
  computeScheduleInputsHash,
  isInformationLevel,
  messageLineId,
  reduceInformationLevel,
} from './message-schedule.js';
export type {
  InformationLevel,
  MessageEntry,
  MessageLine,
  MessageSchedule,
  ScheduleInputs,
  TypologyInformationLevels,
  WayfindingRules,
} from './message-schedule.js';
export { generateMessageSchedule } from './message-schedule-generate.js';
export type { GenerateScheduleOptions } from './message-schedule-generate.js';
export { checkMessageSchedule, refreshStaleFlags } from './message-schedule-checks.js';
export type { StaleDiff } from './message-schedule-checks.js';
export { messageScheduleToCsv, messageScheduleToMarkdown } from './message-schedule-export.js';
export type { ScheduleLang } from './message-schedule-export.js';
export {
  composeFace,
  faceIndexForSide,
  resolveFaceFromSchedule,
} from './compose-face.js';
export type {
  ComposeFaceOptions,
  ResolveFromScheduleOptions,
} from './compose-face.js';
