import { describe, it, expect } from 'vitest';
import { createExportQuantitiesHandler } from '../export-quantities.js';
import type { ExportQuantitiesContext } from '../export-quantities.js';
import type { Job } from '../job.js';
import { refMinimal, refMultilevel } from '@azimut/testkit';

const context: ExportQuantitiesContext = {
  site: refMinimal,
};

function makeJob(payload: Record<string, unknown>): Job {
  return {
    id: 'job-qty-001',
    org_id: 'org-test-001',
    kind: 'export_quantities',
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

describe('createExportQuantitiesHandler', () => {
  it('returns CSV and summary for valid supports', async () => {
    const handler = createExportQuantitiesHandler(context);
    const job = makeJob({
      supports: [
        { id: 'sup-1', node_id: 'n-entrance', support_type_key: 'directional' },
      ],
      lang: 'fr',
    });

    const result = await handler(job);
    expect(result['total_supports']).toBe(1);
    expect(result['total_faces']).toBeGreaterThan(0);
    expect(result['cross_check_ok']).toBe(true);
    expect(typeof result['csv']).toBe('string');
    expect((result['csv'] as string).length).toBeGreaterThan(0);
    expect(result['csv_length']).toBe((result['csv'] as string).length);
    expect(result['lang']).toBe('fr');
  });

  it('defaults to French CSV when lang is omitted', async () => {
    const handler = createExportQuantitiesHandler(context);
    const job = makeJob({
      supports: [
        { id: 'sup-1', node_id: 'n-entrance', support_type_key: 'directional' },
      ],
    });

    const result = await handler(job);
    expect(result['lang']).toBe('fr');
    expect((result['csv'] as string)).toContain('Type;Nom type;Nombre;Faces');
  });

  it('produces English CSV when requested', async () => {
    const handler = createExportQuantitiesHandler(context);
    const job = makeJob({
      supports: [
        { id: 'sup-1', node_id: 'n-entrance', support_type_key: 'directional' },
      ],
      lang: 'en',
    });

    const result = await handler(job);
    expect(result['lang']).toBe('en');
    expect((result['csv'] as string)).toContain('Type;Type name;Count;Faces');
  });

  it('handles empty supports list', async () => {
    const handler = createExportQuantitiesHandler(context);
    const job = makeJob({ supports: [] });

    const result = await handler(job);
    expect(result['total_supports']).toBe(0);
    expect(result['total_faces']).toBe(0);
    expect(result['cross_check_ok']).toBe(true);
  });

  it('handles missing supports in payload', async () => {
    const handler = createExportQuantitiesHandler(context);
    const job = makeJob({});

    const result = await handler(job);
    expect(result['total_supports']).toBe(0);
  });

  it('filters invalid support entries', async () => {
    const handler = createExportQuantitiesHandler(context);
    const job = makeJob({
      supports: [
        { id: 'sup-1', node_id: 'n-entrance', support_type_key: 'directional' },
        { bad: 'entry' },
        42,
        null,
      ],
    });

    const result = await handler(job);
    expect(result['total_supports']).toBe(1);
  });

  it('works with multilevel site', async () => {
    const mlContext: ExportQuantitiesContext = { site: refMultilevel };
    const handler = createExportQuantitiesHandler(mlContext);
    const job = makeJob({
      supports: [
        { id: 'sup-1', node_id: 'n-ml-hall', support_type_key: 'directional' },
        { id: 'sup-2', node_id: 'n-ml-hall-r1', support_type_key: 'directional' },
      ],
      lang: 'en',
    });

    const result = await handler(job);
    expect(result['total_supports']).toBe(2);
    expect(result['cross_check_ok']).toBe(true);
  });

  it('is deterministic (INV-4)', async () => {
    const handler = createExportQuantitiesHandler(context);
    const job = makeJob({
      supports: [
        { id: 'sup-1', node_id: 'n-entrance', support_type_key: 'directional' },
      ],
      lang: 'fr',
    });

    const r1 = await handler(job);
    const r2 = await handler(job);
    expect(r1).toStrictEqual(r2);
  });
});
