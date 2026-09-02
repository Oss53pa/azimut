export type { Finding, Outcome } from './outcome.js';
export type { Point, Polygon } from './geometry.js';
export {
  roundHalfAwayFromZero,
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
} from './tolerance.js';
export { normalizeAzimuth } from './angle.js';
export { canonicalSerialize, sha256Hex, contentHash } from './hash.js';
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
