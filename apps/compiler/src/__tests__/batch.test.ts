import { describe, it, expect } from 'vitest';
import { runBatch } from '../batch.js';
import type { BatchItem, BatchOptions } from '../batch.js';
import { MemoryQueue } from '../queue.js';
import type { JobHandler } from '../worker.js';
import type { Job } from '../job.js';

function fixedClock(start: Date): () => Date {
  let tick = start.getTime();
  return () => new Date(tick++);
}

function makeItems(count: number): BatchItem[] {
  const items: BatchItem[] = [];
  for (let i = 0; i < count; i++) {
    items.push({
      item_id: `sup-${String(i).padStart(3, '0')}`,
      payload: { index: i },
    });
  }
  return items;
}

function makeOptions(
  queue: MemoryQueue,
  handler: JobHandler,
  overrides?: Partial<BatchOptions>,
): BatchOptions {
  return {
    org_id: 'org-001',
    kind: 'compile_artworks',
    queue,
    handler,
    now: fixedClock(new Date('2024-01-01T00:00:00Z')),
    max_attempts: 3,
    ...overrides,
  };
}

describe('T-2.16 runBatch', () => {
  it('processes all items successfully', async () => {
    const queue = new MemoryQueue();
    const handler: JobHandler = async () => ({ svg: '<svg/>' });
    const items = makeItems(5);

    const report = await runBatch(
      items,
      makeOptions(queue, handler),
    );

    expect(report.total).toBe(5);
    expect(report.created).toBe(5);
    expect(report.succeeded).toBe(5);
    expect(report.failed).toBe(0);
    expect(report.skipped).toBe(0);
    expect(report.results.length).toBe(5);
    expect(report.results.every((r) => r.status === 'succeeded')).toBe(
      true,
    );
  });

  it('resumes without duplicates after interruption', async () => {
    const queue = new MemoryQueue();
    const handler: JobHandler = async () => ({ svg: '<svg/>' });
    const items = makeItems(3);

    const preExisting: Job = {
      id: 'compile_artworks-sup-000',
      org_id: 'org-001',
      kind: 'compile_artworks',
      state: 'succeeded',
      payload: { item_id: 'sup-000' },
      result: { svg: '<svg/>' },
      attempts: 1,
      max_attempts: 3,
      created_at: new Date('2024-01-01T00:00:00Z'),
      started_at: new Date('2024-01-01T00:00:01Z'),
      finished_at: new Date('2024-01-01T00:00:02Z'),
      error: null,
    };
    await queue.enqueue(preExisting);

    const report = await runBatch(
      items,
      makeOptions(queue, handler),
    );

    expect(report.total).toBe(3);
    expect(report.skipped).toBe(1);
    expect(report.created).toBe(2);
    expect(report.succeeded).toBe(2);
    expect(report.results.find((r) => r.item_id === 'sup-000')?.status).toBe(
      'skipped',
    );
  });

  it('retries failed jobs from previous batch', async () => {
    const queue = new MemoryQueue();
    let callCount = 0;
    const handler: JobHandler = async () => {
      callCount++;
      return { ok: true };
    };

    const failedJob: Job = {
      id: 'compile_artworks-sup-000',
      org_id: 'org-001',
      kind: 'compile_artworks',
      state: 'failed',
      payload: { item_id: 'sup-000' },
      result: null,
      attempts: 1,
      max_attempts: 3,
      created_at: new Date('2024-01-01T00:00:00Z'),
      started_at: null,
      finished_at: null,
      error: 'previous failure',
    };
    await queue.enqueue(failedJob);

    const items: BatchItem[] = [
      { item_id: 'sup-000', payload: {} },
    ];
    const report = await runBatch(
      items,
      makeOptions(queue, handler),
    );

    expect(report.succeeded).toBe(1);
    expect(report.skipped).toBe(0);
    expect(callCount).toBe(1);
  });

  it('reports failures with error messages', async () => {
    const queue = new MemoryQueue();
    const handler: JobHandler = async () => {
      throw new Error('render error');
    };

    const items: BatchItem[] = [
      { item_id: 'sup-fail', payload: {} },
    ];
    const report = await runBatch(
      items,
      makeOptions(queue, handler, { max_attempts: 1 }),
    );

    expect(report.failed).toBe(1);
    expect(report.results[0]?.status).toBe('failed');
    expect(report.results[0]?.error).toBe('render error');
  });

  it('handles empty batch', async () => {
    const queue = new MemoryQueue();
    const handler: JobHandler = async () => ({});

    const report = await runBatch(
      [],
      makeOptions(queue, handler),
    );

    expect(report.total).toBe(0);
    expect(report.created).toBe(0);
    expect(report.succeeded).toBe(0);
  });

  it('processes large batch (300 items)', async () => {
    const queue = new MemoryQueue();
    const handler: JobHandler = async () => ({ svg: '<svg/>' });
    const items = makeItems(300);

    const start = Date.now();
    const report = await runBatch(
      items,
      makeOptions(queue, handler),
    );
    const elapsed = Date.now() - start;

    expect(report.total).toBe(300);
    expect(report.succeeded).toBe(300);
    expect(report.failed).toBe(0);
    expect(elapsed).toBeLessThan(10_000);
  });

  it('results are sorted by item_id', async () => {
    const queue = new MemoryQueue();
    const handler: JobHandler = async () => ({});
    const items: BatchItem[] = [
      { item_id: 'sup-c', payload: {} },
      { item_id: 'sup-a', payload: {} },
      { item_id: 'sup-b', payload: {} },
    ];

    const report = await runBatch(
      items,
      makeOptions(queue, handler),
    );

    expect(report.results.map((r) => r.item_id)).toEqual([
      'sup-a',
      'sup-b',
      'sup-c',
    ]);
  });

  it('uses the specified kind for jobs', async () => {
    const queue = new MemoryQueue();
    const handler: JobHandler = async () => ({ csv: 'data' });
    const items: BatchItem[] = [
      { item_id: 'qty-001', payload: {} },
    ];

    const report = await runBatch(
      items,
      makeOptions(queue, handler, { kind: 'export_quantities' }),
    );

    expect(report.succeeded).toBe(1);
    const job = await queue.getJob('export_quantities-qty-001');
    expect(job).not.toBeNull();
    expect(job?.kind).toBe('export_quantities');
  });

  it('is deterministic (INV-4)', async () => {
    const handler: JobHandler = async (job) => ({
      id: job.id,
      result: 'done',
    });
    const items = makeItems(3);

    const queue1 = new MemoryQueue();
    const r1 = await runBatch(items, makeOptions(queue1, handler));

    const queue2 = new MemoryQueue();
    const r2 = await runBatch(items, makeOptions(queue2, handler));

    expect(r1).toStrictEqual(r2);
  });

  it('job IDs include the kind to prevent cross-kind collisions', async () => {
    const queue = new MemoryQueue();
    const handler: JobHandler = async () => ({ ok: true });
    const items: BatchItem[] = [
      { item_id: 'item-001', payload: {} },
    ];

    await runBatch(
      items,
      makeOptions(queue, handler, { kind: 'compile_artworks' }),
    );
    await runBatch(
      items,
      makeOptions(queue, handler, { kind: 'audit_site' }),
    );

    const compileJob = await queue.getJob('compile_artworks-item-001');
    const auditJob = await queue.getJob('audit_site-item-001');
    expect(compileJob).not.toBeNull();
    expect(auditJob).not.toBeNull();
    expect(compileJob?.kind).toBe('compile_artworks');
    expect(auditJob?.kind).toBe('audit_site');
  });
});
