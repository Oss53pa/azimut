export type { Finding, Outcome } from './outcome.js';
export type { Point, Polygon } from './geometry.js';
export {
  FOOTPRINT_KINDS, CELL_FOOTPRINT_KIND, isCellFootprint, isFootprintKind,
} from './site.js';
export { signedArea, polygonArea } from './geometry.js';
export {
  fitMeasuredCalibration,
  auditCalibrationResiduals,
  applyAffine,
  MIN_CONTROL_POINTS,
  MEASURING_CONTROL_POINTS,
} from './affine-calibration.js';
export type {
  PlanPixelPoint,
  ControlPointPair,
  AffineTransform,
  ControlPointResidual,
  MeasuredCalibration,
  ResidualTolerance,
} from './affine-calibration.js';
export { edgeLengthBetween, computeEdgeLengths } from './edge-length.js';
export type { EdgeEnd, EdgeLengthInput } from './edge-length.js';
export {
  isUsableScale, calibratedLevelIds, siteOrigin, guardSiteOrigin,
  firstCalibration,
} from './plan.js';
export type { PlanSource, PlanCalibration, SiteOriginBearer } from './plan.js';
export { ACTIVE_LANGS, isActiveLang, readActiveLangs } from './lang.js';
export type { ActiveLang } from './lang.js';
export {
  WEEKDAYS, isWeekday, isOpeningRange, minutesOfDay, readOpeningHours,
  rangesForDay,
} from './opening-hours.js';
export type { Weekday, OpeningRange, OpeningHours } from './opening-hours.js';
export { guardFontEmbedding } from './font-embedding.js';
export type {
  FontAsset,
  FontLicenceKind,
  EmbeddingTarget,
} from './font-embedding.js';
export { guardFontMetrics, auditFontLicences } from './font-registry.js';
export type { FontMetricsRecord } from './font-registry.js';
export { colorDelta, auditColorReferences } from './color-chain.js';
export type { CharterColor, LabValue, ReferenceSystem } from './color-chain.js';
export { relativeLuminance, contrastRatio } from './color-contrast.js';
export { guardFontGlyphCoverage, REQUIRED_LATIN_COVERAGE } from './font-glyphs.js';
export { guardTextFit } from './typography-fit.js';
export type { TextFitBox } from './typography-fit.js';
export {
  roundHalfAwayFromZero,
  roundMetres,
  roundSvg,
  formatSvg,
  roundMm,
  ceilMm,
} from './round.js';
export {
  POINT_COINCIDENCE_M,
  ANGLE_EQUALITY_DEG,
  EDGE_MIN_LENGTH_M,
  POLYGON_MIN_AREA_M2,
  WEIGHT_SUM_TOLERANCE,
} from './tolerance.js';
export { normalizeAzimuth } from './angle.js';
export { findLexiconMatches } from './lexicon.js';
export type { SiteFact, ForbiddenWord } from './site-facts.js';
export { detectDiscrepancies, markIfOpen } from './source-claims.js';
export { EMPTY_VOCABULARY } from './site-vocabulary.js';
export { PUBLISHABLE_STATUSES, countsAsDigitised } from './parking.js';
export type {
  ObjectStatus, Provenance, Parking, ParkingSpace, ParkingSpaceKind, UncoveredArea,
} from './parking.js';
export type { VehicleGate } from './site.js';
export { resolveBoundParagraph, literalNumbers } from './bound-text.js';
export type {
  TextSegment, BoundParagraph, BindingValues, ResolvedParagraph,
  BindingCatalogue, MissingBinding,
} from './bound-text.js';
export type { SiteVocabulary } from './site-vocabulary.js';
export type { SourceClaim, Discrepancy, DiscrepancyDecision } from './source-claims.js';
export type { LexiconTerm, LexiconMatch, LexiconSeverity } from './lexicon.js';
export { canonicalSerialize, sha256Hex, sha256Binary, contentHash } from './hash.js';
export { canonicalContentJson, empreinte } from './empreinte.js';
export {
  transliterate,
  sanitizeSegment,
  buildFileName,
  buildArchiveName,
} from './file-naming.js';
export type { FileNameParts, ArchiveNameParts } from './file-naming.js';
export { ERROR_CATALOG } from './error-catalog.js';
export type { ErrorCode } from './error-catalog.js';
export {
  ERROR_MESSAGES_FR,
  ERROR_MESSAGES_EN,
  getErrorMessage,
  getSupportedErrorLangs,
} from './i18n-errors.js';
export type { ErrorMessages } from './i18n-errors.js';
export {
  templateSchema,
  TEMPLATE_BLOCK_KINDS,
  validateTemplate,
} from './template-schema.js';
export type {
  Binding,
  Template,
  TemplateBlock,
  TemplateBlockKind,
  TemplateGrid,
  TemplateSizing,
  TemplateValidationError,
} from './template-schema.js';
export { transitionSupportVersion, admittedEvents } from './support-version-state.js';
export type {
  SupportVersionEvent, SupportVersionEffect, SupportVersionTransition,
} from './support-version-state.js';
export { SUPPORT_VERSION_STATES } from './site.js';
export {
  assertProofTransition,
  assertJobTransition,
  assertDivergenceTransition,
  assertWorkOrderTransition,
} from './state-machines.js';
export type {
  Organization,
  Site,
  Building,
  Level,
  Footprint,
  FootprintKind,
  Volume,
  NodeKind,
  GraphNode,
  EdgeDirection,
  Edge,
  VerticalLinkKind,
  VerticalLink,
  Category,
  PictogramRegistry,
  Pictogram,
  OccupancyStatus,
  Destination,
  DestinationName,
  SupportTypeFace,
  SupportType,
  Support,
  SupportContext,
  DimensionsSource,
  SupportFace,
  ContentBlockInstance,
  SupportVersionState,
  SupportVersion,
  ProofStatus,
  Proof,
  ApprovalDecision,
  Approval,
  ContentBlockKind,
  ContentBlockDef,
  FaceTemplate,
  TravelProfile,
  SiteGraph,
  SiteData,
} from './site.js';
export { longestVariant, textExpansionFindings } from './text-expansion.js';
export type { LongestVariantResult } from './text-expansion.js';
export {
  guardExportExcludesSketch,
  isSketchCollection,
  SKETCH_COLLECTIONS,
} from './sketch-export.js';
export {
  meterToPixel,
  pixelToMeter,
  clampScale,
  applyZoomStep,
  quantizePosition,
  quantizePoint,
  quantizeAngle,
  viewTransformSvg,
  MIN_SCALE_PX_PER_M,
  MAX_SCALE_PX_PER_M,
  ZOOM_STEP_FACTOR,
  POSITION_STEP_M,
  ANGLE_STEP_DEG,
} from './view-transform.js';
export type { ViewState, ViewportSize } from './view-transform.js';
export {
  MODULE_KEYS,
  MODULE_LAYER,
  NON_OPTIONAL_MODULES,
  OWNED_TABLES,
  SUPPORT_COLUMN_OWNER,
  SUPPORT_IDENTITY_COLUMNS,
  MODULE_READS,
  DECLARED_UPWARD_READS,
  DEGRADATION_WHEN_ABSENT,
  TABLES_WITHOUT_DECLARED_OWNER,
  COLUMNS_SPECIFIED_NOT_YET_IN_SCHEMA,
  SUPPORT_CONTEXT_MANDATE,
} from './module-ownership.js';
export type { ModuleKey } from './module-ownership.js';
export {
  COMMAND_OPERATIONS,
  buildCommand,
  ownsTable,
  inverseCommand,
  changedColumns,
} from './site-commands.js';
export type {
  CommandOperation,
  ColumnValue,
  RowValues,
  EntityCommand,
  CommandDraft,
} from './site-commands.js';
export { RETIRED_CODES } from './error-catalog.js';
export { segmentsProperlyIntersect, isSelfIntersecting } from './geometry.js';
export {
  occupancyHistory, occupantsOn, isInForceOn, previousOccupancy,
} from './occupancy.js';
export type { IsoDate } from './occupancy.js';
export {
  deriveLegend, compassRoseAngleDeg, mapRotationForAzimuthDeg,
} from './plan-legend.js';
export type { LegendEntry } from './plan-legend.js';
