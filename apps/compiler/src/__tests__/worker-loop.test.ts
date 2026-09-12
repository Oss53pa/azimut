import { describe, it, expect } from 'vitest';
import type { Job } from '../job.js';
import { MemoryQueue } from '../queue.js';
import { runWorkerLoop } from '../worker.js';
import type { JobHandler } from '../worker.js';

function makeJob(overrides?: Partial<Job>): Job {
  return {
    id: 'job-001',
    org_id: 'org-001',
    kind: 'audit_site',
    state: 'queued',
    payload: {},
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

const noopHandler: JobHandler = async () => ({ ok: true });

describe('runWorkerLoop (D9.2)', () => {
  it('drains a backlog without idling, then sleeps once and stops', async () => {
    const queue = new MemoryQueue();
    for (let i = 0; i < 3; i++) {
      await queue.enqueue(makeJob({ id: `job-${i}` }));
    }
    let idled = false;
    const sleeps: number[] = [];

    const summary = await runWorkerLoop({
      queue,
      handlers: new Map([['audit_site', noopHandler]]),
      now: () => new Date('2024-01-01T00:10:00Z'),
      sleepMs: 500,
      reapEveryMs: 60_000,
      sleep: async (ms) => { sleeps.push(ms); idled = true; },
      shouldStop: () => idled, // stop as soon as the queue drained and we idled
    });

    expect(summary.processed).toBe(3);
    // Processing 3 ready jobs never slept; only the empty poll slept once.
    expect(sleeps).toEqual([500]);
    expect((await queue.getJob('job-0'))?.state).toBe('succeeded');
  });

  it('exits immediately when shouldStop is already true', async () => {
    const summary = await runWorkerLoop({
      queue: new MemoryQueue(),
      handlers: new Map(),
      now: () => new Date(),
      sleepMs: 1,
      reapEveryMs: 1,
      sleep: async () => {},
      shouldStop: () => true,
    });
    expect(summary).toEqual({ processed: 0, reaped: 0 });
  });

  it('reaps a stalled running job on the reap cadence', async () => {
    const queue = new MemoryQueue();
    // A job stuck in 'running' since well before the stall timeout.
    await queue.enqueue(makeJob({
      id: 'stuck',
      state: 'running',
      started_at: new Date('2024-01-01T00:00:00Z'),
      attempts: 3,
      max_attempts: 3,
    }));
    let idled = false;

    const summary = await runWorkerLoop({
      queue,
      handlers: new Map([['audit_site', noopHandler]]),
      now: () => new Date('2024-01-01T01:00:00Z'), // one hour later
      sleepMs: 10,
      reapEveryMs: 0, // reap every iteration
      sleep: async () => { idled = true; },
      shouldStop: () => idled,
    });

    expect(summary.reaped).toBe(1);
    expect((await queue.getJob('stuck'))?.state).toBe('failed');
  });
});
