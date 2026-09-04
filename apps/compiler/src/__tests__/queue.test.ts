import { describe, it, expect } from 'vitest';
import { MemoryQueue } from '../queue.js';
import type { Job } from '../job.js';

function makeJob(overrides?: Partial<Job>): Job {
  return {
    id: 'j1',
    org_id: 'org1',
    kind: 'compile_artworks',
    state: 'queued',
    payload: {},
    result: null,
    attempts: 0,
    max_attempts: 3,
    created_at: new Date('2025-01-01T00:00:00Z'),
    started_at: null,
    finished_at: null,
    error: null,
    ...overrides,
  };
}

describe('MemoryQueue', () => {
  it('enqueue and getJob round-trip', async () => {
    const q = new MemoryQueue();
    const job = makeJob();
    await q.enqueue(job);
    const retrieved = await q.getJob('j1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('j1');
    expect(retrieved?.state).toBe('queued');
  });

  it('getJob returns null for unknown id', async () => {
    const q = new MemoryQueue();
    expect(await q.getJob('unknown')).toBeNull();
  });

  it('dequeue returns first queued job', async () => {
    const q = new MemoryQueue();
    await q.enqueue(makeJob({ id: 'j1' }));
    await q.enqueue(makeJob({ id: 'j2' }));
    const first = await q.dequeue();
    expect(first?.id).toBe('j1');
  });

  it('dequeue returns null when empty', async () => {
    const q = new MemoryQueue();
    expect(await q.dequeue()).toBeNull();
  });

  it('dequeue skips non-queued jobs', async () => {
    const q = new MemoryQueue();
    await q.enqueue(makeJob({ id: 'j1' }));
    await q.markRunning('j1', new Date('2025-01-01T00:01:00Z'));
    expect(await q.dequeue()).toBeNull();
  });

  it('markRunning sets state and increments attempts', async () => {
    const q = new MemoryQueue();
    await q.enqueue(makeJob());
    const now = new Date('2025-01-01T00:01:00Z');
    await q.markRunning('j1', now);
    const job = await q.getJob('j1');
    expect(job?.state).toBe('running');
    expect(job?.attempts).toBe(1);
    expect(job?.started_at).toEqual(now);
  });

  it('markRunning on unknown id is a no-op', async () => {
    const q = new MemoryQueue();
    await q.markRunning('unknown', new Date());
    // No error thrown
  });

  it('markSucceeded sets result and trace', async () => {
    const q = new MemoryQueue();
    await q.enqueue(makeJob());
    const t1 = new Date('2025-01-01T00:01:00Z');
    const t2 = new Date('2025-01-01T00:02:00Z');
    await q.markRunning('j1', t1);
    await q.markSucceeded('j1', { count: 5 }, t2);
    const job = await q.getJob('j1');
    expect(job?.state).toBe('succeeded');
    expect(job?.result).toEqual({ count: 5 });
    expect(job?.finished_at).toEqual(t2);
    expect(job?.error).toBeNull();

    const traces = await q.getTraces('j1');
    expect(traces).toHaveLength(1);
    expect(traces[0]?.outcome).toBe('succeeded');
    expect(traces[0]?.error).toBeNull();
  });

  it('markFailed re-queues if attempts < max_attempts', async () => {
    const q = new MemoryQueue();
    await q.enqueue(makeJob({ max_attempts: 3 }));
    const t1 = new Date('2025-01-01T00:01:00Z');
    const t2 = new Date('2025-01-01T00:02:00Z');
    await q.markRunning('j1', t1);
    await q.markFailed('j1', 'timeout', t2);
    const job = await q.getJob('j1');
    expect(job?.state).toBe('queued');
    expect(job?.started_at).toBeNull();
    expect(job?.finished_at).toBeNull();
  });

  it('markFailed sets failed when attempts exhausted', async () => {
    const q = new MemoryQueue();
    await q.enqueue(makeJob({ max_attempts: 1 }));
    const t1 = new Date('2025-01-01T00:01:00Z');
    const t2 = new Date('2025-01-01T00:02:00Z');
    await q.markRunning('j1', t1);
    await q.markFailed('j1', 'crash', t2);
    const job = await q.getJob('j1');
    expect(job?.state).toBe('failed');
    expect(job?.error).toBe('crash');
  });

  it('getTraces returns copies', async () => {
    const q = new MemoryQueue();
    await q.enqueue(makeJob());
    const t1 = new Date('2025-01-01T00:01:00Z');
    const t2 = new Date('2025-01-01T00:02:00Z');
    await q.markRunning('j1', t1);
    await q.markFailed('j1', 'err', t2);
    const traces1 = await q.getTraces('j1');
    const traces2 = await q.getTraces('j1');
    expect(traces1).toEqual(traces2);
    expect(traces1).not.toBe(traces2);
  });

  it('getTraces returns empty for unknown job', async () => {
    const q = new MemoryQueue();
    const traces = await q.getTraces('unknown');
    expect(traces).toEqual([]);
  });

  it('markSucceeded on unknown id is a no-op', async () => {
    const q = new MemoryQueue();
    await q.markSucceeded('unknown', { x: 1 }, new Date());
    // No error thrown, no job created
    expect(await q.getJob('unknown')).toBeNull();
  });

  it('markFailed on unknown id is a no-op', async () => {
    const q = new MemoryQueue();
    await q.markFailed('unknown', 'err', new Date());
    expect(await q.getJob('unknown')).toBeNull();
  });

  it('dequeue order is FIFO among queued jobs', async () => {
    const q = new MemoryQueue();
    await q.enqueue(makeJob({ id: 'j1' }));
    await q.enqueue(makeJob({ id: 'j2' }));
    await q.enqueue(makeJob({ id: 'j3' }));
    const first = await q.dequeue();
    expect(first?.id).toBe('j1');
    await q.markRunning('j1', new Date());
    const second = await q.dequeue();
    expect(second?.id).toBe('j2');
  });

  it('multiple retry cycles produce correct traces', async () => {
    const q = new MemoryQueue();
    await q.enqueue(makeJob({ max_attempts: 3 }));

    // Attempt 1: fail
    await q.markRunning('j1', new Date('2025-01-01T00:01:00Z'));
    await q.markFailed('j1', 'err1', new Date('2025-01-01T00:02:00Z'));

    // Attempt 2: fail
    await q.markRunning('j1', new Date('2025-01-01T00:03:00Z'));
    await q.markFailed('j1', 'err2', new Date('2025-01-01T00:04:00Z'));

    // Attempt 3: succeed
    await q.markRunning('j1', new Date('2025-01-01T00:05:00Z'));
    await q.markSucceeded('j1', { ok: true }, new Date('2025-01-01T00:06:00Z'));

    const traces = await q.getTraces('j1');
    expect(traces).toHaveLength(3);
    expect(traces[0]?.outcome).toBe('failed');
    expect(traces[1]?.outcome).toBe('failed');
    expect(traces[2]?.outcome).toBe('succeeded');

    const job = await q.getJob('j1');
    expect(job?.state).toBe('succeeded');
    expect(job?.attempts).toBe(3);
  });

  it('retains error string after re-queue for retry', async () => {
    const q = new MemoryQueue();
    await q.enqueue(makeJob({ max_attempts: 3 }));
    await q.markRunning('j1', new Date());
    await q.markFailed('j1', 'transient-error', new Date());
    const job = await q.getJob('j1');
    expect(job?.state).toBe('queued');
    expect(job?.error).toBe('transient-error');
    expect(job?.started_at).toBeNull();
  });

  it('re-queued job maintains original FIFO position', async () => {
    const q = new MemoryQueue();
    await q.enqueue(makeJob({ id: 'j1' }));
    await q.markRunning('j1', new Date());
    await q.enqueue(makeJob({ id: 'j2' }));
    await q.markFailed('j1', 'err', new Date());
    // j1 was inserted before j2, so it should dequeue first
    const next = await q.dequeue();
    expect(next?.id).toBe('j1');
  });

  it('markSucceeded without markRunning uses now as started_at fallback', async () => {
    const q = new MemoryQueue();
    await q.enqueue(makeJob());
    const now = new Date('2025-06-01T12:00:00Z');
    await q.markSucceeded('j1', { direct: true }, now);
    const traces = await q.getTraces('j1');
    expect(traces).toHaveLength(1);
    // started_at should equal now (the ?? now fallback)
    expect(traces[0]?.started_at).toEqual(now);
    expect(traces[0]?.finished_at).toEqual(now);
    expect(traces[0]?.outcome).toBe('succeeded');
  });

  it('markFailed without markRunning uses now as started_at fallback', async () => {
    const q = new MemoryQueue();
    await q.enqueue(makeJob({ max_attempts: 1 }));
    const now = new Date('2025-06-01T13:00:00Z');
    await q.markFailed('j1', 'direct-fail', now);
    const traces = await q.getTraces('j1');
    expect(traces).toHaveLength(1);
    expect(traces[0]?.started_at).toEqual(now);
    expect(traces[0]?.error).toBe('direct-fail');
  });

  it('markRunning on already-running job increments attempts again', async () => {
    const q = new MemoryQueue();
    await q.enqueue(makeJob());
    await q.markRunning('j1', new Date('2025-01-01T00:01:00Z'));
    await q.markRunning('j1', new Date('2025-01-01T00:02:00Z'));
    const job = await q.getJob('j1');
    expect(job?.attempts).toBe(2);
    expect(job?.state).toBe('running');
  });
});
