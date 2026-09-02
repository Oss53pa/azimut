import { describe, it, expect } from 'vitest';
import { compileBatch } from '../batch.js';
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
      support_id: `sup-${String(i).padStart(3, '0')}`,
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
    queue,
    handler,
    now: fixedClock(new Date('2024-01-01T00:00:00Z')),
    max_attempts: 3,
    ...overrides,
  };
}

describe('T-2.16 compileBatch', () => {
  it('compiles all items successfully', async () => {
    const queue = new MemoryQueue();
    const handler: JobHandler = async () => ({ svg: '<svg/>' });
    const items = makeItems(5);

    const report = await compileBatch(
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
      id: 'compile-sup-000',
      org_id: 'org-001',
      kind: 'compile_artworks',
      state: 'succeeded',
      payload: { support_id: 'sup-000' },
      result: { svg: '<svg/>' },
      attempts: 1,
      max_attempts: 3,
      created_at: new Date('2024-01-01T00:00:00Z'),
      started_at: new Date('2024-01-01T00:00:01Z'),
      finished_at: new Date('2024-01-01T00:00:02Z'),
      error: null,
    };
    await queue.enqueue(preExisting);

    const report = await compileBatch(
      items,
      makeOptions(queue, handler),
    );

    expect(report.total).toBe(3);
    expect(report.skipped).toBe(1);
    expect(report.created).toBe(2);
    expect(report.succeeded).toBe(2);
    expect(report.results.find((r) => r.support_id === 'sup-000')?.status).toBe(
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
      id: 'compile-sup-000',
      org_id: 'org-001',
      kind: 'compile_artworks',
      state: 'failed',
      payload: { support_id: 'sup-000' },
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
      { support_id: 'sup-000', payload: {} },
    ];
    const report = await compileBatch(
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
      { support_id: 'sup-fail', payload: {} },
    ];
    const report = await compileBatch(
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

    const report = await compileBatch(
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
    const report = await compileBatch(
      items,
      makeOptions(queue, handler),
    );
    const elapsed = Date.now() - start;

    expect(report.total).toBe(300);
    expect(report.succeeded).toBe(300);
    expect(report.failed).toBe(0);
    expect(elapsed).toBeLessThan(10_000);
  });

  it('results are sorted by support_id', async () => {
    const queue = new MemoryQueue();
    const handler: JobHandler = async () => ({});
    const items: BatchItem[] = [
      { support_id: 'sup-c', payload: {} },
      { support_id: 'sup-a', payload: {} },
      { support_id: 'sup-b', payload: {} },
    ];

    const report = await compileBatch(
      items,
      makeOptions(queue, handler),
    );

    expect(report.results.map((r) => r.support_id)).toEqual([
      'sup-a',
      'sup-b',
      'sup-c',
    ]);
  });
});
