import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit';
import type { FaceTheme } from '@azimut/engine-graph';
import { createBuildDeliveryArchiveHandler } from '../build-delivery-archive.js';
import type { BuildDeliveryArchiveContext } from '../build-delivery-archive.js';
import { memoryAssetStore } from '../asset-store.js';
import type { MutableAssetStore } from '../asset-store.js';
import type { Job } from '../job.js';

const theme: FaceTheme = {
  background: 'tok-bg',
  text_primary: 'tok-txt',
  text_secondary: 'tok-sec',
  accent: 'tok-acc',
  border: 'tok-brd',
};

function context(sink: MutableAssetStore): BuildDeliveryArchiveContext {
  return {
    site: refMultilevel,
    theme,
    fontFamily: 'Helvetica',
    pdfTarget: 'pdf-x4',
    creationDate: new Date('2024-06-15T12:00:00Z'),
    archiveSink: sink,
    storagePathFor: (name) => `deliveries/${name}`,
  };
}

function makeJob(payload: Record<string, unknown>): Job {
  return {
    id: 'job-delivery-001',
    org_id: 'org-test-001',
    kind: 'build_delivery_archive',
    state: 'running',
    payload,
    result: null,
    attempts: 1,
    max_attempts: 3,
    created_at: new Date('2024-06-15T12:00:00Z'),
    started_at: new Date('2024-06-15T12:00:01Z'),
    finished_at: null,
    error: null,
  };
}

const basePayload = {
  site_code: 'CPL',
  building: 'A',
  level: 'R1',
  version: 3,
  items: [
    { node_id: 'n-ml-hall', template_id: 'ftpl-dir-front', profile_key: 'standard', type_code: 'DIR', reference: 'D-042' },
    { node_id: 'n-ml-hall', template_id: 'ftpl-dir-front', profile_key: 'standard', type_code: 'DIR', reference: 'D-043' },
  ],
};

describe('D11 — createBuildDeliveryArchiveHandler', () => {
  it('renders items, assembles the archive and writes it to storage', async () => {
    const sink = memoryAssetStore();
    const result = await createBuildDeliveryArchiveHandler(context(sink))(makeJob(basePayload));

    expect(result['archive_name']).toBe('CPL_A_R1_V3.ZIP');
    expect(result['index_name']).toBe('CPL_A_R1_V3_INDEX.json');
    expect(result['file_count']).toBe(2);
    expect(result['total_bytes']).toBeGreaterThan(0);
    expect(result['storage_path']).toBe('deliveries/CPL_A_R1_V3.ZIP');

    // The named PDFs and the index landed under the storage prefix.
    const prefix = 'deliveries/CPL_A_R1_V3.ZIP';
    await expect(sink.read(`${prefix}/CPL_A_R1_DIR_D-042_V3_FRONT.PDF`)).resolves.toBeDefined();
    await expect(sink.read(`${prefix}/CPL_A_R1_DIR_D-043_V3_FRONT.PDF`)).resolves.toBeDefined();
    await expect(sink.read(`${prefix}/CPL_A_R1_V3_INDEX.json`)).resolves.toBeDefined();
  });

  it('the index quantitative descends from the quantity engine (INV-1)', async () => {
    const sink = memoryAssetStore();
    const result = await createBuildDeliveryArchiveHandler(context(sink))(makeJob(basePayload));
    const index = JSON.parse(
      new TextDecoder().decode(await sink.read('deliveries/CPL_A_R1_V3.ZIP/CPL_A_R1_V3_INDEX.json')),
    );
    // Two distinct supports (references D-042, D-043), each a directional face.
    expect(index.entries).toHaveLength(2);
    expect(index.quantities.total_supports).toBe(2);
    expect(index.quantities.by_type).toEqual([
      { support_type_key: 'directional', support_type_name: expect.any(String), count: 2, face_count: 2 },
    ]);
    // The engine's counts are surfaced on the job result.
    expect(result['total_supports']).toBe(2);
    expect(result['total_faces']).toBe(index.quantities.total_faces);
    expect(result['cross_check_ok']).toBe(true);
  });

  it('dedups faces of one physical support (same node + reference)', async () => {
    // Two items sharing (node, reference) are one support for the quantitative,
    // even though they are two archive files — here distinguished by type_code
    // so the D11 names do not collide.
    const sink = memoryAssetStore();
    const payload = {
      ...basePayload,
      items: [
        { node_id: 'n-ml-hall', template_id: 'ftpl-dir-front', profile_key: 'standard', type_code: 'DIR', reference: 'D-042' },
        { node_id: 'n-ml-hall', template_id: 'ftpl-dir-front', profile_key: 'standard', type_code: 'EVAC', reference: 'D-042' },
      ],
    };
    const result = await createBuildDeliveryArchiveHandler(context(sink))(makeJob(payload));
    expect(result['file_count']).toBe(2);
    expect(result['total_supports']).toBe(1);
  });

  it('rejects an empty delivery', async () => {
    const sink = memoryAssetStore();
    await expect(
      createBuildDeliveryArchiveHandler(context(sink))(makeJob({ ...basePayload, items: [] })),
    ).rejects.toThrow('no items');
  });

  it('rejects a payload missing the version', async () => {
    const sink = memoryAssetStore();
    const noVersion: Record<string, unknown> = { ...basePayload };
    delete noVersion['version'];
    await expect(
      createBuildDeliveryArchiveHandler(context(sink))(makeJob(noVersion)),
    ).rejects.toThrow('version');
  });

  it('records the delivery_package row with the job org after storing', async () => {
    const sink = memoryAssetStore();
    const calls: Array<{ record: Record<string, unknown>; orgId: string }> = [];
    const ctx: BuildDeliveryArchiveContext = {
      ...context(sink),
      recordDelivery: async (record, orgId) => {
        calls.push({ record: record as unknown as Record<string, unknown>, orgId });
      },
    };
    const result = await createBuildDeliveryArchiveHandler(ctx)(makeJob(basePayload));

    expect(calls).toHaveLength(1);
    expect(calls[0]?.orgId).toBe('org-test-001');
    expect(calls[0]?.record).toMatchObject({
      site_id: refMultilevel.site.id,
      site_code: 'CPL',
      building: 'A',
      level: 'R1',
      version: 3,
      archive_name: 'CPL_A_R1_V3.ZIP',
      storage_path: 'deliveries/CPL_A_R1_V3.ZIP',
      checksum: result['checksum'],
      total_supports: 2,
      cross_check_ok: true,
    });
  });

  it('does not record a row when no recorder is configured', async () => {
    const sink = memoryAssetStore();
    const result = await createBuildDeliveryArchiveHandler(context(sink))(makeJob(basePayload));
    expect(typeof result['checksum']).toBe('string');
    expect(result['storage_path']).toBe('deliveries/CPL_A_R1_V3.ZIP');
  });

  it('surfaces a name collision as an assembly failure', async () => {
    const sink = memoryAssetStore();
    const collide = {
      ...basePayload,
      items: [basePayload.items[0], basePayload.items[0]],
    };
    await expect(
      createBuildDeliveryArchiveHandler(context(sink))(makeJob(collide)),
    ).rejects.toThrow('Delivery archive assembly failed');
  });
});
