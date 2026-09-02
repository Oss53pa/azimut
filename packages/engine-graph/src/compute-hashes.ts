import type {
  SiteData,
  TravelProfile,
  FaceTemplate,
} from '@azimut/core-model';
import { contentHash } from '@azimut/core-model';
import type { ResolvedFace } from './resolve-face.js';

function pickNodeFields(
  node: SiteData['graph']['nodes'][number],
): Record<string, unknown> {
  return {
    id: node.id,
    level_id: node.level_id,
    kind: node.kind,
    position: node.position,
    label: node.label,
  };
}

function pickEdgeFields(
  edge: SiteData['graph']['edges'][number],
): Record<string, unknown> {
  return {
    id: edge.id,
    from_node_id: edge.from_node_id,
    to_node_id: edge.to_node_id,
    width_m: edge.width_m,
    slope_pct: edge.slope_pct,
    accessible: edge.accessible,
    direction: edge.direction,
    evacuation_route: edge.evacuation_route,
    length_m: edge.length_m,
  };
}

function pickVerticalLinkFields(
  vl: SiteData['graph']['vertical_links'][number],
): Record<string, unknown> {
  return {
    id: vl.id,
    edge_id: vl.edge_id,
    kind: vl.kind,
    capacity: vl.capacity,
    accessible: vl.accessible,
  };
}

function pickProfileFields(
  profile: TravelProfile,
): Record<string, unknown> {
  return {
    key: profile.key,
    excluded_edge_kinds: [...profile.excluded_edge_kinds].sort(),
    require_accessible: profile.require_accessible,
    honor_hours: profile.honor_hours,
  };
}

export function computeInputsHash(
  site: SiteData,
  profile: TravelProfile,
): string {
  const nodes = [...site.graph.nodes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(pickNodeFields);
  const edges = [...site.graph.edges]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(pickEdgeFields);
  const verticalLinks = [...site.graph.vertical_links]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(pickVerticalLinkFields);

  return contentHash({
    nodes,
    edges,
    vertical_links: verticalLinks,
    profile: pickProfileFields(profile),
  });
}

export type ContentHashInput = {
  readonly resolved: ResolvedFace;
  readonly template: FaceTemplate;
  readonly charter_version: string | null;
  readonly rules_pack_version: string | null;
  readonly active_langs: readonly string[];
  readonly dimensions: {
    readonly width_mm: number;
    readonly height_mm: number;
  };
};

export function computeContentHash(
  input: ContentHashInput,
): string {
  return contentHash({
    resolved: input.resolved,
    template_id: input.template.id,
    template_blocks: input.template.blocks,
    charter_version: input.charter_version,
    rules_pack_version: input.rules_pack_version,
    active_langs: [...input.active_langs].sort(),
    dimensions: input.dimensions,
  });
}
