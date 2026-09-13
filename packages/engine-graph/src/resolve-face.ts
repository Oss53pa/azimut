import type {
  SiteData,
  GraphNode,
  FaceTemplate,
  ContentBlockDef,
  TravelProfile,
  Pictogram,
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

/** K-Tier-A / E9.4 — one row of a legend block: a symbol and its meaning. */
export type LegendEntry = {
  /** Pictogram path (`d`) drawn at 30-unit grid, or null for a plain swatch. */
  readonly symbol_path: string | null;
  readonly label: string;
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
  // K-Tier-A contracts (documented decision; parties A–D absent). Assets are
  // sanitized inline SVG injected by the composition layer, so engine-graph
  // never renders a plan itself and never depends on another engine (A4.1).
  | { readonly type: 'map'; readonly plan_svg: string | null; readonly caption: string }
  | { readonly type: 'legend'; readonly entries: readonly LegendEntry[] }
  | { readonly type: 'free_text'; readonly text: string }
  | { readonly type: 'logo'; readonly svg_markup: string | null; readonly label: string }
  | {
      readonly type: 'emergency_info';
      readonly text: string;
      readonly svg_path: string | null;
    };

// --- K-Tier-A block resolvers, shared by resolve-face and compose-face -------

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * A `map` block shows a pre-rendered plan. engine-graph does not render plans
 * (that is engine-layout's job, one layer up); the plan SVG is provided as a
 * sanitized `plan_svg` string in the block config, or null when none is
 * supplied yet. `caption` labels the frame.
 */
export function resolveMapContent(config: Record<string, unknown>): ResolvedContent {
  return {
    type: 'map',
    plan_svg: asStringOrNull(config['plan_svg']),
    caption: asString(config['caption'], ''),
  };
}

/**
 * A `legend` block lists symbol → meaning rows, declared in the template config
 * (E9.4). Each entry may carry a pictogram path and always a label.
 */
export function resolveLegendContent(config: Record<string, unknown>): ResolvedContent {
  const raw = config['entries'];
  const entries: LegendEntry[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item !== null && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        entries.push({
          symbol_path: asStringOrNull(rec['symbol_path']),
          label: asString(rec['label'], ''),
        });
      }
    }
  }
  return { type: 'legend', entries };
}

/**
 * A `logo` block embeds a sanitized inline SVG (`svg_markup`, per E14) provided
 * in the config; when none is supplied the `label` (defaulting to the org name)
 * is drawn instead. Never free-drawn — resolved from data (INV-2).
 */
export function resolveLogoContent(
  config: Record<string, unknown>,
  defaultLabel: string,
): ResolvedContent {
  return {
    type: 'logo',
    svg_markup: asStringOrNull(config['svg_markup']),
    label: asString(config['label'], defaultLabel),
  };
}

/**
 * An `emergency_info` block carries regulatory instruction text (held in data,
 * never in code — INV-5) and a safety-registry pictogram resolved read-only by
 * category (INV-3). The pictogram must belong to the `safety` registry.
 */
export function resolveEmergencyContent(
  config: Record<string, unknown>,
  pictograms: readonly Pictogram[],
): ResolvedContent {
  const catId = asStringOrNull(config['pictogram_category_id']);
  const picto =
    catId !== null
      ? pictograms.find((p) => p.registry === 'safety' && p.category_id === catId)
      : undefined;
  return {
    type: 'emergency_info',
    text: asString(config['text'], ''),
    svg_path: picto?.svg_path ?? null,
  };
}

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
  limit: number | null,
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

  const limited = limit !== null && limit >= 0 ? entries.slice(0, limit) : entries;
  return { entries: limited, warnings };
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
      const limit = typeof blockDef.config['limit'] === 'number'
        ? blockDef.config['limit']
        : null;
      const listResult = resolveDestinationList(site, nodeId, profile, limit);
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
      content = resolveMapContent(blockDef.config);
      break;
    case 'legend':
      content = resolveLegendContent(blockDef.config);
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
      content = resolveLogoContent(blockDef.config, site.organization.name);
      break;
    case 'emergency_info':
      content = resolveEmergencyContent(blockDef.config, site.pictograms);
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
