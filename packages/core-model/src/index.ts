export type { Finding, Outcome } from './outcome.js';
export type { Point, Polygon } from './geometry.js';
export {
  FOOTPRINT_KINDS, CELL_FOOTPRINT_KIND, isCellFootprint, isFootprintKind,
  PARKING_SPACE_FOOTPRINT_KIND, isParkingSpaceFootprint,
  PARKING_ZONE_KIND, isParkingZone,
  ZONE_KINDS, isSiteZoneKind, OPENING_KINDS, isOpeningKind,
} from './site.js';
export type { SiteZoneKind, OpeningKind } from './site.js';
export { signedArea, polygonArea } from './geometry.js';
export {
  fitMeasuredCalibration,
  auditCalibrationResiduals,
  applyAffine,
  MIN_CALIBRATION_POINTS,
  MEASURING_CALIBRATION_POINTS,
} from './affine-calibration.js';
export type {
  PlanPixelPoint,
  CalibrationPointPair,
  AffineTransform,
  CalibrationPointResidual,
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
export type {
  CharterRule, CharterRuleKind, CharterRuleResolution, ForbiddenCharacterRange,
} from './charter-rules.js';
export {
  CHARTER_RULE_KINDS, resolveForbiddenCharacters, resolveMaxSentenceWords,
} from './charter-rules.js';
export type { SiteFact, ForbiddenWord, FactStatus, FactValue, FactTarget } from './site-facts.js';
export {
  DECLARED_FACT_KEYS, PARKING_CAPACITY_KEY, PARKING_FREE_KEY,
  PARKING_UNDIGITIZED_SPACES_KEY, PARKING_UNDIGITIZED_REASON_KEY,
  isFactKeyShape, factKeyDeclaration,
  factValueMatchesType, factValueFault, declaredInteger, declaredText,
} from './fact-keys.js';
export type { FactValueType, FactKeyDeclaration, FactValueFault } from './fact-keys.js';
export {
  parkingSpacesOfLevel, accessibleSpaceMark, footprintCentre,
  ACCESSIBLE_SPACE_KIND, NO_PARKING_SPACES, PICTOGRAM_GRID_UNITS,
} from './parking-view.js';
export type { ParkingSpaceView, PlanContext, AccessibleMark } from './parking-view.js';
export {
  RULES_PACK_ROLES, boundPackId, packsByPrecedence, isBound, rulesPacksInRoleOrder,
} from './rules-bindings.js';
export type {
  RulesPackIdentity, BoundRulesPacks, RoleTaggedRulesPack,
} from './rules-bindings.js';
export {
  ACCESSIBLE_FUNCTION_KEY, DECLARED_PICTOGRAM_FUNCTIONS, isFunctionKeyShape,
  pictogramFunctionDeclaration, resolvePictogramFunction, pictogramFunctionFinding,
  siteScope,
} from './pictogram-functions.js';
export type {
  PictogramFunctionDeclaration, PictogramFunctionResolution, PictogramScope,
} from './pictogram-functions.js';
export {
  FACT_STATUSES, PUBLISHABLE_FACT_STATUSES, factValueText,
  PARKING_FACT_TARGET_KIND, factsFor,
} from './site-facts.js';
export { detectDiscrepancies, markIfOpen } from './source-claims.js';
export { EMPTY_VOCABULARY } from './site-vocabulary.js';
export { PARKING_SPACE_KINDS, isParkingSpaceKind } from './parking.js';
export type { ParkingSpace, ParkingSpaceKind } from './parking.js';
export { resolveBoundParagraph, literalNumbers } from './bound-text.js';
export type {
  TextSegment, BoundParagraph, BindingValues, ResolvedParagraph,
  BindingCatalogue, MissingBinding,
} from './bound-text.js';
export type { SiteVocabulary } from './site-vocabulary.js';
export type { SourceClaim, Discrepancy, DiscrepancyDecision } from './source-claims.js';
export type { LexiconTerm, LexiconMatch, LexiconSeverity } from './lexicon.js';
export { canonicalSerialize, sha256Hex, sha256Binary, contentHash } from './hash.js';
export { canonicalContentJson, codePointCompare, empreinte, empreinteOutcome } from './empreinte.js';
export { computeFaceContentHash } from './face-content-hash.js';
export type { FaceContentHashInput } from './face-content-hash.js';
export {
  transliterate,
  sanitizeSegment,
  buildFileName,
  buildArchiveName,
} from './file-naming.js';
export type { FileNameParts, ArchiveNameParts } from './file-naming.js';
export { ERROR_CATALOG, ANOMALY_DOMAINS } from './error-catalog.js';
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
  BuildingLink,
  Category,
  PictogramRegistry,
  Pictogram,
  RulesPackRole,
  SiteRulesBinding,
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
  SiteZone,
  SiteData,
} from './site.js';
export { longestVariant, textExpansionFindings } from './text-expansion.js';
export type { LongestVariantResult } from './text-expansion.js';
export {
  guardSafetyRegistry, guardSafetyCreation, guardSafetyDeletion,
} from './safety-registry.js';
export type {
  PictogramRegistryEntry, PictogramMutation, PictogramCreation,
} from './safety-registry.js';
export {
  guardExportExcludesSketch,
  isSketchCollection,
  SKETCH_COLLECTIONS,
} from './sketch-export.js';
export {
  VIEW_LAYER_KEYS, SKETCH_LAYER_KEY, isViewLayerKey,
  stackedLayers, screenLayerKeys, printLayerKeys, auditViewLayers,
  WORK_COLOUR_TARGET_KINDS, isWorkColourTargetKind, isWorkColourHex,
  workColoursOf, activeWorkColourCount,
} from './view-layers.js';
export type {
  ViewLayer, ViewLayerKey, WorkColour, WorkColourTargetKind,
} from './view-layers.js';
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
  listValue,
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
export { segmentsProperlyIntersect, isSelfIntersecting, pointInPolygon } from './geometry.js';
export {
  occupancyHistory, occupantsOn, isInForceOn, previousOccupancy,
} from './occupancy.js';
export type { IsoDate } from './occupancy.js';
export {
  deriveLegend, compassRoseAngleDeg, mapRotationForAzimuthDeg,
} from './plan-legend.js';
export type { LegendEntry } from './plan-legend.js';
