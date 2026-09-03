import { describe, it, expect } from 'vitest';
import type { Job } from '../job.js';
import { MemoryQueue } from '../queue.js';
import { processNextJob } from '../worker.js';
import type { JobHandler } from '../worker.js';

function makeJob(overrides?: Partial<Job>): Job {
  return {
    id: 'job-001',
    org_id: 'org-001',
    kind: 'compile_artworks',
    state: 'queued',
    payload: { site_id: 'site-001' },
    result: null,
    attempts: 0,
    max_attempts: 3,
    created_at: new Date('2024-01-01T00:00:00Z'),
    started_at: null,
    finished_at: null,
    error: null,
    ...overrides,
  };
}

function fixedClock(start: Date): () => Date {
  let tick = start.getTime();
  return () => new Date(tick++);
}

describe('processNextJob', () => {
  it('returns false when queue is empty', async () => {
    const queue = new MemoryQueue();
    const result = await processNextJob({
      queue,
      handlers: new Map(),
      now: () => new Date(),
    });
    expect(result).toBe(false);
  });

  it('executes a job successfully', async () => {
    const queue = new MemoryQueue();
    queue.enqueue(makeJob());

    const handler: JobHandler = async () => ({ output: 'done' });
    const handlers = new Map([['compile_artworks', handler]]);

    const processed = await processNextJob({
      queue,
      handlers,
      now: fixedClock(new Date('2024-01-01T01:00:00Z')),
    });

    expect(processed).toBe(true);

    const job = await queue.getJob('job-001');
    expect(job?.state).toBe('succeeded');
    expect(job?.result).toEqual({ output: 'done' });
    expect(job?.attempts).toBe(1);
    expect(job?.error).toBeNull();

    const traces = await queue.getTraces('job-001');
    expect(traces).toHaveLength(1);
    expect(traces[0]?.outcome).toBe('succeeded');
  });

  it('handles failure and re-queues for retry', async () => {
    const queue = new MemoryQueue();
    queue.enqueue(makeJob());

    let callCount = 0;
    const handler: JobHandler = async () => {
      callCount++;
      throw new Error('boom');
    };
    const handlers = new Map([['compile_artworks', handler]]);
    const clock = fixedClock(new Date('2024-01-01T01:00:00Z'));

    await processNextJob({ queue, handlers, now: clock });

    const afterFirst = await queue.getJob('job-001');
    expect(afterFirst?.state).toBe('queued');
    expect(afterFirst?.attempts).toBe(1);

    await processNextJob({ queue, handlers, now: clock });

    const afterSecond = await queue.getJob('job-001');
    expect(afterSecond?.state).toBe('queued');
    expect(afterSecond?.attempts).toBe(2);

    await processNextJob({ queue, handlers, now: clock });

    const afterThird = await queue.getJob('job-001');
    expect(afterThird?.state).toBe('failed');
    expect(afterThird?.attempts).toBe(3);
    expect(afterThird?.error).toBe('boom');

    expect(callCount).toBe(3);

    const traces = await queue.getTraces('job-001');
    expect(traces).toHaveLength(3);
    expect(traces.every((t) => t.outcome === 'failed')).toBe(true);
  });

  it('replays a failed job without side effects', async () => {
    const queue = new MemoryQueue();
    queue.enqueue(makeJob());

    const sideEffects: string[] = [];
    let attempt = 0;
    const handler: JobHandler = async (job) => {
      attempt++;
      if (attempt === 1) {
        sideEffects.push('first-attempt');
        throw new Error('transient');
      }
      sideEffects.push('second-attempt');
      return { processed: job.payload };
    };

    const handlers = new Map([['compile_artworks', handler]]);
    const clock = fixedClock(new Date('2024-01-01T01:00:00Z'));

    await processNextJob({ queue, handlers, now: clock });
    await processNextJob({ queue, handlers, now: clock });

    const job = await queue.getJob('job-001');
    expect(job?.state).toBe('succeeded');
    expect(sideEffects).toEqual(['first-attempt', 'second-attempt']);

    const traces = await queue.getTraces('job-001');
    expect(traces).toHaveLength(2);
    expect(traces[0]?.outcome).toBe('failed');
    expect(traces[1]?.outcome).toBe('succeeded');
  });

  it('leaves a complete trace after failure', async () => {
    const queue = new MemoryQueue();
    queue.enqueue(makeJob({ max_attempts: 1 }));

    const handler: JobHandler = async () => {
      throw new Error('fatal');
    };
    const handlers = new Map([['compile_artworks', handler]]);
    const clock = fixedClock(new Date('2024-01-01T01:00:00Z'));

    await processNextJob({ queue, handlers, now: clock });

    const job = await queue.getJob('job-001');
    expect(job?.state).toBe('failed');
    expect(job?.error).toBe('fatal');

    const traces = await queue.getTraces('job-001');
    expect(traces).toHaveLength(1);
    expect(traces[0]?.error).toBe('fatal');
    expect(traces[0]?.started_at).toBeInstanceOf(Date);
    expect(traces[0]?.finished_at).toBeInstanceOf(Date);
  });

  it('captures non-Error thrown values as string', async () => {
    const queue = new MemoryQueue();
    queue.enqueue(makeJob({ max_attempts: 1 }));

    const handler: JobHandler = async () => {
      throw 'raw string error';
    };
    const handlers = new Map([['compile_artworks', handler]]);
    const clock = fixedClock(new Date('2024-01-01T01:00:00Z'));

    await processNextJob({ queue, handlers, now: clock });

    const job = await queue.getJob('job-001');
    expect(job?.state).toBe('failed');
    expect(job?.error).toBe('raw string error');
  });

  it('handles handler returning empty object', async () => {
    const queue = new MemoryQueue();
    queue.enqueue(makeJob());

    const handler: JobHandler = async () => ({});
    const handlers = new Map([['compile_artworks', handler]]);
    const clock = fixedClock(new Date('2024-01-01T01:00:00Z'));

    await processNextJob({ queue, handlers, now: clock });

    const job = await queue.getJob('job-001');
    expect(job?.state).toBe('succeeded');
    expect(job?.result).toEqual({});
  });

  it('fails gracefully when no handler is registered', async () => {
    const queue = new MemoryQueue();
    queue.enqueue(makeJob({ kind: 'audit_site', max_attempts: 1 }));

    const processed = await processNextJob({
      queue,
      handlers: new Map(),
      now: fixedClock(new Date('2024-01-01T01:00:00Z')),
    });

    expect(processed).toBe(true);
    const job = await queue.getJob('job-001');
    expect(job?.state).toBe('failed');
    expect(job?.error).toContain('No handler');
  });
});
