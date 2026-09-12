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

  it('the index echoes the quantitative', async () => {
    const sink = memoryAssetStore();
    await createBuildDeliveryArchiveHandler(context(sink))(makeJob(basePayload));
    const index = JSON.parse(
      new TextDecoder().decode(await sink.read('deliveries/CPL_A_R1_V3.ZIP/CPL_A_R1_V3_INDEX.json')),
    );
    expect(index.file_count).toBe(2);
    expect(index.by_type).toEqual({ DIR: 2 });
    expect(index.entries).toHaveLength(2);
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
