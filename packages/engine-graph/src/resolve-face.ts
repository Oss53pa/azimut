import type {
  SiteData,
  FaceTemplate,
  ContentBlockDef,
  TravelProfile,
  Outcome,
} from '@azimut/core-model';
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

function resolveDestinationList(
  site: SiteData,
  nodeId: string,
  profile: TravelProfile,
): ResolvedDestinationEntry[] {
  const namesByDest = new Map<string, Record<string, string>>();
  for (const dn of site.destination_names) {
    const existing = namesByDest.get(dn.destination_id);
    if (existing) {
      existing[dn.lang] = dn.value;
    } else {
      namesByDest.set(dn.destination_id, { [dn.lang]: dn.value });
    }
  }

  const entries: ResolvedDestinationEntry[] = [];
  const sortedDests = [...site.destinations].sort((a, b) =>
    a.display_priority - b.display_priority ||
    a.id.localeCompare(b.id),
  );

  for (const dest of sortedDests) {
    const routeResult = computeRoute(
      site,
      profile,
      nodeId,
      dest.node_id,
    );
    const distance =
      routeResult.ok ? routeResult.value.cost : null;
    const names = namesByDest.get(dest.id) ?? {};
    entries.push({
      destination_id: dest.id,
      names,
      direction: null,
      distance_m: distance,
    });
  }

  return entries;
}

function resolveBlock(
  site: SiteData,
  nodeId: string,
  profile: TravelProfile,
  block: ContentBlockDef,
): ResolvedBlock {
  let content: ResolvedContent;

  switch (block.kind) {
    case 'header':
      content = { type: 'header', site_name: site.site.name };
      break;
    case 'destination_list':
      content = {
        type: 'destination_list',
        entries: resolveDestinationList(site, nodeId, profile),
      };
      break;
    case 'pictogram': {
      const catId =
        typeof block.config['category_id'] === 'string'
          ? block.config['category_id']
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
          typeof block.config['direction'] === 'string'
            ? block.config['direction']
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
          typeof block.config['text'] === 'string'
            ? block.config['text']
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
    kind: block.kind,
    ordinal: block.ordinal,
    region: block.region,
    content,
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
          code: 'RESOLVE.NODE_NOT_FOUND',
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

  const resolved: ResolvedBlock[] = sortedBlocks.map((block) =>
    resolveBlock(site, nodeId, profile, block),
  );

  return {
    ok: true,
    value: {
      template_id: template.id,
      support_type_key: template.support_type_key,
      side: template.side,
      blocks: resolved,
    },
    warnings: [],
  };
}
