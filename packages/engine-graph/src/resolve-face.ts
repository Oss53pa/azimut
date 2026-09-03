import type {
  SiteData,
  GraphNode,
  FaceTemplate,
  ContentBlockDef,
  TravelProfile,
  Finding,
  Outcome,
} from '@azimut/core-model';
import { normalizeAzimuth } from '@azimut/core-model';
import { computeRoute } from './compute-route.js';

export type ResolvedBlock = {
  readonly kind: ContentBlockDef['kind'];
  readonly ordinal: number;
  readonly region: ContentBlockDef['region'];
  readonly content: ResolvedContent;
};

export type ResolvedDestinationEntry = {
  readonly destination_id: string;
  readonly names: Readonly<Record<string, string>>;
  readonly direction: string | null;
  readonly distance_m: number | null;
};

export type ResolvedContent =
  | { readonly type: 'header'; readonly site_name: string }
  | {
      readonly type: 'destination_list';
      readonly entries: readonly ResolvedDestinationEntry[];
    }
  | {
      readonly type: 'pictogram';
      readonly pictogram_id: string | null;
      readonly svg_path: string | null;
    }
  | { readonly type: 'arrow'; readonly direction: string }
  | { readonly type: 'map' }
  | { readonly type: 'free_text'; readonly text: string }
  | { readonly type: 'logo' }
  | { readonly type: 'emergency_info' };

export type ResolvedFace = {
  readonly template_id: string;
  readonly support_type_key: string;
  readonly side: string;
  readonly blocks: readonly ResolvedBlock[];
};

const CARDINAL_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

export function bearingToCardinal(fromNode: GraphNode, toNode: GraphNode): string {
  const dx = toNode.position.x_m - fromNode.position.x_m;
  const dy = toNode.position.y_m - fromNode.position.y_m;
  if (dx === 0 && dy === 0) return 'N';
  // atan2 gives angle from +x axis; convert to compass bearing (N=+y)
  const radians = Math.atan2(dx, dy);
  const degrees = normalizeAzimuth(radians * (180 / Math.PI));
  const index = Math.round(degrees / 45) % 8;
  return CARDINAL_LABELS[index] as string;
}

type DestinationListResult = {
  readonly entries: ResolvedDestinationEntry[];
  readonly warnings: Finding[];
};

function resolveDestinationList(
  site: SiteData,
  nodeId: string,
  profile: TravelProfile,
): DestinationListResult {
  const namesByDest = new Map<string, Record<string, string>>();
  for (const dn of site.destination_names) {
    const existing = namesByDest.get(dn.destination_id);
    if (existing) {
      existing[dn.lang] = dn.value;
    } else {
      namesByDest.set(dn.destination_id, { [dn.lang]: dn.value });
    }
  }

  const nodeMap = new Map<string, GraphNode>();
  for (const n of site.graph.nodes) {
    nodeMap.set(n.id, n);
  }

  const viewNode = nodeMap.get(nodeId);

  const entries: ResolvedDestinationEntry[] = [];
  const warnings: Finding[] = [];
  const sortedDests = [...site.destinations].sort((a, b) =>
    a.display_priority - b.display_priority ||
    a.id.localeCompare(b.id),
  );

  for (const dest of sortedDests) {
    const names = namesByDest.get(dest.id) ?? {};

    // Check destination node exists in graph
    if (!nodeMap.has(dest.node_id)) {
      warnings.push({
        code: 'LAYOUT.DESTINATION_NOT_FOUND',
        severity: 'blocking',
        entity: { kind: 'destination', id: dest.id },
        params: { node_id: dest.node_id },
        ruleRef: null,
      });
      entries.push({
        destination_id: dest.id,
        names,
        direction: null,
        distance_m: null,
      });
      continue;
    }

    const routeResult = computeRoute(
      site,
      profile,
      nodeId,
      dest.node_id,
    );

    if (!routeResult.ok) {
      warnings.push({
        code: 'LAYOUT.DESTINATION_UNREACHABLE',
        severity: 'blocking',
        entity: { kind: 'destination', id: dest.id },
        params: { from_node: nodeId, to_node: dest.node_id },
        ruleRef: null,
      });
      entries.push({
        destination_id: dest.id,
        names,
        direction: null,
        distance_m: null,
      });
      continue;
    }

    const distance = routeResult.value.cost;

    let direction: string | null = null;
    if (viewNode && routeResult.value.path.length >= 2) {
      const nextNodeId = routeResult.value.path[1] as string;
      const nextNode = nodeMap.get(nextNodeId);
      if (nextNode) {
        direction = bearingToCardinal(viewNode, nextNode);
      }
    }

    entries.push({
      destination_id: dest.id,
      names,
      direction,
      distance_m: distance,
    });
  }

  return { entries, warnings };
}

type ResolvedBlockResult = {
  readonly block: ResolvedBlock;
  readonly warnings: Finding[];
};

function resolveBlock(
  site: SiteData,
  nodeId: string,
  profile: TravelProfile,
  blockDef: ContentBlockDef,
): ResolvedBlockResult {
  let content: ResolvedContent;
  let blockWarnings: Finding[] = [];

  switch (blockDef.kind) {
    case 'header':
      content = { type: 'header', site_name: site.site.name };
      break;
    case 'destination_list': {
      const listResult = resolveDestinationList(site, nodeId, profile);
      content = {
        type: 'destination_list',
        entries: listResult.entries,
      };
      blockWarnings = listResult.warnings;
      break;
    }
    case 'pictogram': {
      const catId =
        typeof blockDef.config['category_id'] === 'string'
          ? blockDef.config['category_id']
          : null;
      const picto = catId
        ? site.pictograms.find((p) => p.category_id === catId)
        : null;
      content = {
        type: 'pictogram',
        pictogram_id: picto?.id ?? null,
        svg_path: picto?.svg_path ?? null,
      };
      break;
    }
    case 'arrow':
      content = {
        type: 'arrow',
        direction:
          typeof blockDef.config['direction'] === 'string'
            ? blockDef.config['direction']
            : 'forward',
      };
      break;
    case 'map':
      content = { type: 'map' };
      break;
    case 'free_text':
      content = {
        type: 'free_text',
        text:
          typeof blockDef.config['text'] === 'string'
            ? blockDef.config['text']
            : '',
      };
      break;
    case 'logo':
      content = { type: 'logo' };
      break;
    case 'emergency_info':
      content = { type: 'emergency_info' };
      break;
  }

  return {
    block: {
      kind: blockDef.kind,
      ordinal: blockDef.ordinal,
      region: blockDef.region,
      content,
    },
    warnings: blockWarnings,
  };
}

export function resolveFaceContent(
  site: SiteData,
  template: FaceTemplate,
  nodeId: string,
  profile: TravelProfile,
): Outcome<ResolvedFace> {
  const nodeExists = site.graph.nodes.some((n) => n.id === nodeId);
  if (!nodeExists) {
    return {
      ok: false,
      findings: [
        {
          code: 'GRAPH.RESOLVE_NODE_NOT_FOUND',
          severity: 'blocking',
          entity: { kind: 'node', id: nodeId },
          params: {},
          ruleRef: null,
        },
      ],
    };
  }

  const sortedBlocks = [...template.blocks].sort(
    (a, b) => a.ordinal - b.ordinal || a.kind.localeCompare(b.kind),
  );

  const resolved: ResolvedBlock[] = [];
  const allWarnings: Finding[] = [];

  for (const blockDef of sortedBlocks) {
    const result = resolveBlock(site, nodeId, profile, blockDef);
    resolved.push(result.block);
    allWarnings.push(...result.warnings);
  }

  return {
    ok: true,
    value: {
      template_id: template.id,
      support_type_key: template.support_type_key,
      side: template.side,
      blocks: resolved,
    },
    warnings: allWarnings,
  };
}
