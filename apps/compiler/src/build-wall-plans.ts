import type { SiteData, Outcome, Finding } from '@azimut/core-model';
import { buildFileName } from '@azimut/core-model';
import { renderOrientedPlan, orientationDegForAzimuth } from '@azimut/engine-layout';
import type { OrientedPlanTheme } from '@azimut/engine-layout';
import type { AssetWriter } from './asset-store.js';
import type { Job } from './job.js';

/**
 * D6.1 — a wall plan is not a file but a family of files, one per implantation.
 *
 * For each plan-support placement (its node position and compass azimuth), the
 * plan is oriented so what the viewer faces is up (D6.2, via
 * orientationDegForAzimuth) and named by the D11 scheme. The result is the
 * family, keyed by file name. The handler writes it to storage.
 *
 * Placements are payload-driven (node, azimuth, reference, type), like the
 * other compiler handlers — no stored "plan support" model is assumed here.
 */
export type WallPlanPlacement = {
  readonly node_id: string;
  readonly level_id: string;
  readonly azimuth_deg: number;
  readonly reference: string;
  readonly type_code: string;
  /** D11 face segment; defaults to PLAN. */
  readonly face?: string;
};

export type WallPlanFamilyOptions = {
  readonly theme: OrientedPlanTheme;
  readonly fontFamily: string;
  readonly width_px: number;
  readonly height_px: number;
  readonly padding_px: number;
  readonly site_code: string;
  readonly building: string;
  readonly level: string;
  readonly version: number;
};

function duplicate(name: string): Finding {
  return {
    code: 'PACKAGE.DUPLICATE_PATH',
    severity: 'blocking',
    entity: null,
    params: { path: name },
    ruleRef: null,
  };
}

/** Build the family of oriented wall-plan SVGs, keyed by D11 file name. */
export function buildWallPlanFamily(
  site: SiteData,
  placements: readonly WallPlanPlacement[],
  opts: WallPlanFamilyOptions,
): Outcome<ReadonlyMap<string, string>> {
  const nodeById = new Map(site.graph.nodes.map((n) => [n.id, n]));
  const files = new Map<string, string>();
  const findings: Finding[] = [];

  for (const p of placements) {
    const node = nodeById.get(p.node_id);
    if (!node) {
      throw new Error(`Wall plan node not found: ${p.node_id}`);
    }

    const rendered = renderOrientedPlan(site, p.level_id, {
      width_px: opts.width_px,
      height_px: opts.height_px,
      theme: opts.theme,
      font_family: opts.fontFamily,
      show_destinations: true,
      show_edges: true,
      padding_px: opts.padding_px,
      orientation_deg: orientationDegForAzimuth(p.azimuth_deg),
      viewer_position: node.position,
      show_north_arrow: true,
    });
    if (!rendered.ok) {
      findings.push(...rendered.findings);
      continue;
    }

    const name = buildFileName({
      site_code: opts.site_code,
      building: opts.building,
      level: opts.level,
      type_code: p.type_code,
      reference: p.reference,
      version: opts.version,
      face: p.face ?? 'PLAN',
      extension: 'svg',
    });
    if (files.has(name)) {
      findings.push(duplicate(name));
      continue;
    }
    files.set(name, rendered.value);
  }

  if (findings.length > 0) {
    return { ok: false, findings };
  }
  return { ok: true, value: files, warnings: [] };
}

export type BuildWallPlansContext = {
  readonly site: SiteData;
  readonly theme: OrientedPlanTheme;
  readonly fontFamily: string;
  readonly width_px: number;
  readonly height_px: number;
  readonly padding_px: number;
  /** Storage the plan family is written to. */
  readonly planSink: AssetWriter;
  /** Storage path prefix for a plan family (site/building/level/version). */
  readonly storagePathFor: (
    siteCode: string,
    building: string,
    level: string,
    version: number,
  ) => string;
};

export type BuildWallPlansResult = {
  readonly file_count: number;
  readonly total_bytes: number;
  readonly storage_path: string;
};

function parsePlacements(raw: unknown): WallPlanPlacement[] {
  if (!Array.isArray(raw)) return [];
  const out: WallPlanPlacement[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (
      typeof e['node_id'] === 'string' &&
      typeof e['level_id'] === 'string' &&
      typeof e['azimuth_deg'] === 'number' &&
      typeof e['reference'] === 'string' &&
      typeof e['type_code'] === 'string'
    ) {
      out.push({
        node_id: e['node_id'],
        level_id: e['level_id'],
        azimuth_deg: e['azimuth_deg'],
        reference: e['reference'],
        type_code: e['type_code'],
        ...(typeof e['face'] === 'string' ? { face: e['face'] } : {}),
      });
    }
  }
  return out;
}

function requireString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`build_wall_plans payload missing "${key}"`);
  }
  return value;
}

function requireVersion(payload: Record<string, unknown>): number {
  const value = payload['version'];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error('build_wall_plans payload missing integer "version"');
  }
  return value;
}

export function createBuildWallPlansHandler(
  context: BuildWallPlansContext,
): (job: Job) => Promise<Record<string, unknown>> {
  const { site, planSink, storagePathFor } = context;
  const encoder = new TextEncoder();

  return async (job: Job): Promise<Record<string, unknown>> => {
    const payload = job.payload;
    const siteCode = requireString(payload, 'site_code');
    const building = requireString(payload, 'building');
    const level = requireString(payload, 'level');
    const version = requireVersion(payload);
    const placements = parsePlacements(payload['placements']);
    if (placements.length === 0) {
      throw new Error('build_wall_plans payload has no placements');
    }

    const family = buildWallPlanFamily(site, placements, {
      theme: context.theme,
      fontFamily: context.fontFamily,
      width_px: context.width_px,
      height_px: context.height_px,
      padding_px: context.padding_px,
      site_code: siteCode,
      building,
      level,
      version,
    });
    if (!family.ok) {
      const codes = family.findings.map((f) => f.code).join(', ');
      throw new Error(`Wall plan family failed: ${codes}`);
    }

    const storagePath = storagePathFor(siteCode, building, level, version);
    const base = storagePath.replace(/\/+$/, '');
    let totalBytes = 0;
    for (const [name, svg] of family.value) {
      const bytes = encoder.encode(svg);
      totalBytes += bytes.length;
      await planSink.write(base.length === 0 ? name : `${base}/${name}`, bytes);
    }

    return {
      file_count: family.value.size,
      total_bytes: totalBytes,
      storage_path: storagePath,
    };
  };
}
