import type { SiteData } from '@azimut/core-model';
import type { FaceTheme } from '@azimut/engine-graph';
import type { PdfTarget } from '@azimut/engine-artwork';
import { assembleDeliveryArchive } from '@azimut/engine-package';
import type { DeliveryItem } from '@azimut/engine-package';
import { renderArtwork } from './artwork.js';
import type { AssetWriter } from './asset-store.js';
import type { Job } from './job.js';

/**
 * D11 — `build_delivery_archive` job handler.
 *
 * Renders the artworks for one delivery scope (site/building/level/version),
 * names each by the D11 scheme, assembles the delivery archive with its index,
 * and writes it to storage. The set of faces to render is payload-driven — each
 * item names a node, a face template and a travel profile — mirroring the
 * compile_artworks contract.
 *
 * Payload:
 *   site_code, building, level (D11 archive segments), version (integer)
 *   items: [{ node_id, template_id, profile_key, type_code, reference }]
 * The face segment is the template's side (single source), never free text.
 */
export type BuildDeliveryArchiveContext = {
  readonly site: SiteData;
  readonly theme: FaceTheme;
  readonly fontFamily: string;
  readonly pdfTarget: PdfTarget;
  readonly creationDate: Date;
  /** Storage the assembled archive is written to. */
  readonly archiveSink: AssetWriter;
  /** Storage path prefix for a named archive. */
  readonly storagePathFor: (archiveName: string) => string;
};

export type BuildDeliveryArchiveResult = {
  readonly archive_name: string;
  readonly index_name: string;
  readonly file_count: number;
  readonly total_bytes: number;
  readonly storage_path: string;
};

type DeliveryItemSpec = {
  readonly node_id: string;
  readonly template_id: string;
  readonly profile_key: string;
  readonly type_code: string;
  readonly reference: string;
};

function parseItems(raw: unknown): DeliveryItemSpec[] {
  if (!Array.isArray(raw)) return [];
  const out: DeliveryItemSpec[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (
      typeof e['node_id'] === 'string' &&
      typeof e['template_id'] === 'string' &&
      typeof e['type_code'] === 'string' &&
      typeof e['reference'] === 'string'
    ) {
      out.push({
        node_id: e['node_id'],
        template_id: e['template_id'],
        profile_key: typeof e['profile_key'] === 'string' ? e['profile_key'] : 'standard',
        type_code: e['type_code'],
        reference: e['reference'],
      });
    }
  }
  return out;
}

function requireString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`build_delivery_archive payload missing "${key}"`);
  }
  return value;
}

function requireVersion(payload: Record<string, unknown>): number {
  const value = payload['version'];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error('build_delivery_archive payload missing integer "version"');
  }
  return value;
}

export function createBuildDeliveryArchiveHandler(
  context: BuildDeliveryArchiveContext,
): (job: Job) => Promise<Record<string, unknown>> {
  const { site, archiveSink, storagePathFor } = context;

  return async (job: Job): Promise<Record<string, unknown>> => {
    const payload = job.payload;
    const siteCode = requireString(payload, 'site_code');
    const building = requireString(payload, 'building');
    const level = requireString(payload, 'level');
    const version = requireVersion(payload);
    const specs = parseItems(payload['items']);
    if (specs.length === 0) {
      throw new Error('build_delivery_archive payload has no items');
    }

    const items: DeliveryItem[] = [];
    for (const spec of specs) {
      const render = await renderArtwork({
        site,
        theme: context.theme,
        fontFamily: context.fontFamily,
        pdfTarget: context.pdfTarget,
        creationDate: context.creationDate,
        nodeId: spec.node_id,
        templateId: spec.template_id,
        profileKey: spec.profile_key,
        title: `${spec.reference} — ${spec.type_code}`,
      });
      items.push({
        parts: {
          site_code: siteCode,
          building,
          level,
          type_code: spec.type_code,
          reference: spec.reference,
          version,
          face: render.side,
          extension: 'pdf',
        },
        bytes: render.pdf,
      });
    }

    const assembled = assembleDeliveryArchive({
      site_code: siteCode,
      building,
      level,
      version,
      extension: 'zip',
      items,
    });
    if (!assembled.ok) {
      const codes = assembled.findings.map((f) => f.code).join(', ');
      throw new Error(`Delivery archive assembly failed: ${codes}`);
    }

    const { archive_name, index_name, index, files } = assembled.value;
    const storagePath = storagePathFor(archive_name);
    const base = storagePath.replace(/\/+$/, '');
    for (const [name, bytes] of files) {
      await archiveSink.write(base.length === 0 ? name : `${base}/${name}`, bytes);
    }

    return {
      archive_name,
      index_name,
      file_count: index.file_count,
      total_bytes: index.total_bytes,
      storage_path: storagePath,
    };
  };
}
