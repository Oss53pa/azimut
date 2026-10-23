import { describe, it, expect } from 'vitest';
import type { Job } from '../job.js';
import { MemoryQueue } from '../queue.js';
import { processNextJob, HANDLER_FAILED } from '../worker.js';
import type { JobHandler } from '../worker.js';

/**
 * Lot 9 de l'audit : le détail d'un échec va au journal technique, que les
 * essais recueillent ici au lieu de l'écrire sur la sortie d'erreur.
 */
const reported: unknown[] = [];
const report = (_jobId: string, failure: unknown): void => { reported.push(failure); };

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
    requested_by: 'user-essai',
    ...overrides,
  };
}

type AdvanceableClock = (() => Date) & { advance: (ms: number) => void };

function fixedClock(start: Date): AdvanceableClock {
  let tick = start.getTime();
  const fn = (): Date => new Date(tick++);
  (fn as AdvanceableClock).advance = (ms: number): void => { tick += ms; };
  return fn as AdvanceableClock;
}

/** Past the longest D9.2 backoff (120s), so the next retry is eligible. */
const PAST_BACKOFF_MS = 130_000;

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

    await processNextJob({ queue, handlers, now: clock, report });

    const afterFirst = await queue.getJob('job-001');
    expect(afterFirst?.state).toBe('queued');
    expect(afterFirst?.attempts).toBe(1);

    clock.advance(PAST_BACKOFF_MS);
    await processNextJob({ queue, handlers, now: clock, report });

    const afterSecond = await queue.getJob('job-001');
    expect(afterSecond?.state).toBe('queued');
    expect(afterSecond?.attempts).toBe(2);

    clock.advance(PAST_BACKOFF_MS);
    await processNextJob({ queue, handlers, now: clock, report });

    const afterThird = await queue.getJob('job-001');
    expect(afterThird?.state).toBe('failed');
    expect(afterThird?.attempts).toBe(3);
    expect(afterThird?.error).toBe(HANDLER_FAILED);

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

    await processNextJob({ queue, handlers, now: clock, report });
    clock.advance(PAST_BACKOFF_MS);
    await processNextJob({ queue, handlers, now: clock, report });

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

    await processNextJob({ queue, handlers, now: clock, report });

    const job = await queue.getJob('job-001');
    expect(job?.state).toBe('failed');
    expect(job?.error).toBe(HANDLER_FAILED);

    const traces = await queue.getTraces('job-001');
    expect(traces).toHaveLength(1);
    expect(traces[0]?.error).toBe(HANDLER_FAILED);
    expect(traces[0]?.started_at).toBeInstanceOf(Date);
    expect(traces[0]?.finished_at).toBeInstanceOf(Date);
  });

  it('keeps a stable code for a thrown string, and reports the value', async () => {
    const queue = new MemoryQueue();
    queue.enqueue(makeJob({ max_attempts: 1 }));

    const handler: JobHandler = async () => {
      throw 'raw string error';
    };
    const handlers = new Map([['compile_artworks', handler]]);
    const clock = fixedClock(new Date('2024-01-01T01:00:00Z'));

    await processNextJob({ queue, handlers, now: clock, report });

    const job = await queue.getJob('job-001');
    expect(job?.state).toBe('failed');
    expect(job?.error).toBe(HANDLER_FAILED);
    expect(reported.length).toBeGreaterThan(0);
  });

  it('handles handler returning empty object', async () => {
    const queue = new MemoryQueue();
    queue.enqueue(makeJob());

    const handler: JobHandler = async () => ({});
    const handlers = new Map([['compile_artworks', handler]]);
    const clock = fixedClock(new Date('2024-01-01T01:00:00Z'));

    await processNextJob({ queue, handlers, now: clock, report });

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

  it('keeps a stable code for a thrown null', async () => {
    const queue = new MemoryQueue();
    queue.enqueue(makeJob({ max_attempts: 1 }));
    const handler: JobHandler = async () => {
      throw null;
    };
    const handlers = new Map([['compile_artworks', handler]]);
    await processNextJob({ queue, handlers, now: fixedClock(new Date()), report });
    const job = await queue.getJob('job-001');
    expect(job?.state).toBe('failed');
    expect(job?.error).toBe(HANDLER_FAILED);
    expect(reported.length).toBeGreaterThan(0);
  });

  it('no-handler exhausts max_attempts through retry loop', async () => {
    const queue = new MemoryQueue();
    queue.enqueue(makeJob({ kind: 'audit_site', max_attempts: 3 }));
    const clock = fixedClock(new Date('2024-01-01T01:00:00Z'));
    const opts = { queue, handlers: new Map<string, JobHandler>(), now: clock };

    expect(await processNextJob(opts)).toBe(true);
    const after1 = await queue.getJob('job-001');
    expect(after1?.state).toBe('queued');
    expect(after1?.attempts).toBe(1);

    clock.advance(PAST_BACKOFF_MS);
    expect(await processNextJob(opts)).toBe(true);
    clock.advance(PAST_BACKOFF_MS);
    expect(await processNextJob(opts)).toBe(true);

    const final = await queue.getJob('job-001');
    expect(final?.state).toBe('failed');
    expect(final?.attempts).toBe(3);
    expect(final?.error).toContain('No handler');

    // Queue is now empty (job is terminal)
    expect(await processNextJob(opts)).toBe(false);
  });

  it('keeps a stable code for a thrown object', async () => {
    const queue = new MemoryQueue();
    queue.enqueue(makeJob({ max_attempts: 1 }));
    const handler: JobHandler = async () => {
      throw { code: 42 };
    };
    const handlers = new Map([['compile_artworks', handler]]);
    await processNextJob({ queue, handlers, now: fixedClock(new Date()), report });
    const job = await queue.getJob('job-001');
    expect(job?.state).toBe('failed');
    expect(job?.error).toBe(HANDLER_FAILED);
    expect(reported.length).toBeGreaterThan(0);
  });

  it('keeps a stable code for a thrown undefined', async () => {
    const queue = new MemoryQueue();
    queue.enqueue(makeJob({ max_attempts: 1 }));
    const handler: JobHandler = async () => {
      throw undefined;
    };
    const handlers = new Map([['compile_artworks', handler]]);
    await processNextJob({ queue, handlers, now: fixedClock(new Date()), report });
    const job = await queue.getJob('job-001');
    expect(job?.state).toBe('failed');
    expect(job?.error).toBe(HANDLER_FAILED);
    expect(reported.length).toBeGreaterThan(0);
  });
});

describe('lot 9 : job.error ne porte jamais le message d’une exception', () => {
  it('le message va au journal technique, le travail garde le code stable', async () => {
    const queue = new MemoryQueue();
    queue.enqueue(makeJob({ max_attempts: 1 }));
    const secret = new Error('connexion postgres://azimut:motdepasse@hote/azimut refusée');
    const handlers = new Map<string, JobHandler>([['compile_artworks', async () => { throw secret; }]]);
    const seen: unknown[] = [];
    await processNextJob({
      queue, handlers, now: fixedClock(new Date('2024-01-01T01:00:00Z')),
      report: (_id, failure) => { seen.push(failure); },
    });
    const job = await queue.getJob('job-001');
    expect(job?.error).toBe(HANDLER_FAILED);
    expect(JSON.stringify(await queue.getTraces('job-001'))).not.toContain('motdepasse');
    expect(seen).toEqual([secret]);
  });
});
