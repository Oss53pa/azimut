import type { SiteData } from '@azimut/core-model';
import { codePointCompare, empreinteOutcome, sha256Binary } from '@azimut/core-model';
import { computeQuantities } from '@azimut/engine-graph';
import type {
  FaceTheme, PlacedSupport, LoadedRulesPack, RulesPackIndex, TextMeasure,
} from '@azimut/engine-graph';
import type { PdfTarget } from '@azimut/engine-artwork';
import { assembleDeliveryArchive } from '@azimut/engine-package';
import type { DeliveryItem } from '@azimut/engine-package';
import { renderArtwork } from './artwork.js';
import { resolveEffectivePack, supportRenderParams } from './rules-binding.js';
import type { AssetWriter } from './asset-store.js';
import type { DeliveryRecorder } from './db-delivery-recorder.js';
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
  /**
   * Optional recorder for the `delivery_package` DB row, called after the
   * archive is written to storage. Use {@link dbDeliveryRecorder} to back it
   * with a live database; omit it to leave DB persistence to the caller.
   */
  readonly recordDelivery?: DeliveryRecorder;
  /** Explicit rules pack; when set, every face's quality is checked against it. */
  readonly rules_pack?: LoadedRulesPack;
  /**
   * Pack corpus. When no explicit `rules_pack` is given, the pack the site is
   * bound to (A5.8) is resolved from this index and applied to every face, so
   * the batch archive is quality-checked exactly as a single-face compile.
   */
  readonly rules_pack_index?: RulesPackIndex;
  /** Deterministic text measure (G5.1); enables the content-fit check. */
  readonly measure_text?: TextMeasure;
};

export type BuildDeliveryArchiveResult = {
  readonly archive_name: string;
  readonly index_name: string;
  readonly file_count: number;
  readonly total_bytes: number;
  readonly total_supports: number;
  readonly total_faces: number;
  readonly cross_check_ok: boolean;
  readonly checksum: string;
  readonly storage_path: string;
  /** Aggregate quality anomalies over every face; zero when no pack is bound. */
  readonly contrast_finding_count: number;
  readonly legibility_finding_count: number;
  readonly dimensions_finding_count: number;
  readonly content_overflow_finding_count: number;
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
  const { pack: effectivePack } = resolveEffectivePack(
    site, context.rules_pack, context.rules_pack_index,
  );

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
    // Distinct physical supports for the quantity engine: faces of one support
    // share (node_id, reference). Same items feed the archive and the count.
    const placedByKey = new Map<string, PlacedSupport>();
    let contrastFindingCount = 0;
    let legibilityFindingCount = 0;
    let dimensionsFindingCount = 0;
    let contentOverflowFindingCount = 0;
    for (const spec of specs) {
      const render = await renderArtwork({
        site,
        theme: context.theme,
        fontFamily: context.fontFamily,
        pdfTarget: context.pdfTarget,
        creationDate: context.creationDate,
        nodeId: spec.node_id,
        supportId: spec.reference,
        templateId: spec.template_id,
        profileKey: spec.profile_key,
        title: `${spec.reference} — ${spec.type_code}`,
        ...(effectivePack !== undefined ? { rulesPack: effectivePack } : {}),
        ...(context.measure_text !== undefined ? { measureText: context.measure_text } : {}),
        ...supportRenderParams(site.supports.find((s) => s.id === spec.reference)),
      });
      contrastFindingCount += render.contrastFindings.length;
      legibilityFindingCount += render.legibilityFindings.length;
      dimensionsFindingCount += render.dimensionsFindings.length;
      contentOverflowFindingCount += render.contentOverflowFindings.length;
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
      const key = `${spec.node_id}\u0000${spec.reference}`;
      if (!placedByKey.has(key)) {
        placedByKey.set(key, {
          id: spec.reference,
          node_id: spec.node_id,
          support_type_key: render.supportTypeKey,
        });
      }
    }

    // INV-1: the delivery quantitative descends from the single quantity engine,
    // over the very supports the archive is built from.
    const quantities = computeQuantities(site, [...placedByKey.values()]);
    if (!quantities.ok) {
      const codes = quantities.findings.map((f) => f.code).join(', ');
      throw new Error(`Quantity computation failed: ${codes}`);
    }

    const assembled = assembleDeliveryArchive({
      site_code: siteCode,
      building,
      level,
      version,
      extension: 'zip',
      items,
      quantities: quantities.value,
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

    // Archive integrity: the D7.2 empreinte of the per-file digests, in the
    // one canonical form, files ordered by code point (A9). A digest that
    // cannot be hashed is refused rather than recorded (D2.2).
    const digest = [...files.keys()].sort(codePointCompare).map(
      (name) => ({ name, sha256: sha256Binary(files.get(name) as Uint8Array) }),
    );
    const archiveHash = empreinteOutcome({ files: digest }, { kind: 'delivery_package', id: archive_name });
    if (!archiveHash.ok) {
      const codes = archiveHash.findings.map((f) => f.code).join(', ');
      throw new Error(`Delivery archive empreinte refused: ${codes}`);
    }
    const checksum = archiveHash.value;

    if (context.recordDelivery) {
      await context.recordDelivery(
        {
          site_id: site.site.id,
          site_code: siteCode,
          building,
          level,
          version,
          archive_name,
          storage_path: storagePath,
          checksum,
          file_count: index.file_count,
          total_bytes: index.total_bytes,
          total_supports: index.quantities.total_supports,
          total_faces: index.quantities.total_faces,
          cross_check_ok: index.quantities.cross_check_ok,
          built_at: context.creationDate.toISOString(),
        },
        job.org_id,
      );
    }

    return {
      archive_name,
      index_name,
      file_count: index.file_count,
      total_bytes: index.total_bytes,
      total_supports: index.quantities.total_supports,
      total_faces: index.quantities.total_faces,
      cross_check_ok: index.quantities.cross_check_ok,
      checksum,
      storage_path: storagePath,
      contrast_finding_count: contrastFindingCount,
      legibility_finding_count: legibilityFindingCount,
      dimensions_finding_count: dimensionsFindingCount,
      content_overflow_finding_count: contentOverflowFindingCount,
    };
  };
}
