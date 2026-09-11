import type { Job, JobTrace } from './job.js';

/**
 * D9.2 — retry policy: 3 attempts with exponential backoff of 5, 30 then 120
 * seconds before each successive retry.
 */
export const RETRY_BACKOFF_SECONDS: readonly number[] = [5, 30, 120];

/** Backoff in milliseconds before retrying after the given (1-based) attempt. */
export function retryBackoffMs(attempt: number): number {
  const idx = Math.max(1, attempt) - 1;
  const clamped = Math.min(idx, RETRY_BACKOFF_SECONDS.length - 1);
  return (RETRY_BACKOFF_SECONDS[clamped] as number) * 1000;
}

/** D9.2 — a job with no progress for 30 minutes is considered failed. */
export const STALL_TIMEOUT_MS = 30 * 60 * 1000;

export type JobQueue = {
  enqueue(job: Job): Promise<void>;
  dequeue(now?: Date): Promise<Job | null>;
  markRunning(jobId: string, now: Date): Promise<void>;
  markSucceeded(
    jobId: string,
    result: Record<string, unknown>,
    now: Date,
  ): Promise<void>;
  markFailed(jobId: string, error: string, now: Date): Promise<void>;
  /** Fail every running job whose progress has stalled past `timeoutMs`. */
  reapStalled(now: Date, timeoutMs?: number): Promise<readonly string[]>;
  getJob(jobId: string): Promise<Job | null>;
  getTraces(jobId: string): Promise<readonly JobTrace[]>;
};

export class MemoryQueue implements JobQueue {
  private readonly jobs = new Map<string, Job>();
  private readonly traces = new Map<string, JobTrace[]>();

  async enqueue(job: Job): Promise<void> {
    this.jobs.set(job.id, { ...job });
  }

  async dequeue(now: Date = new Date()): Promise<Job | null> {
    for (const job of this.jobs.values()) {
      if (job.state !== 'queued') continue;
      const due = job.next_attempt_at ?? null;
      if (due === null || due.getTime() <= now.getTime()) {
        return { ...job };
      }
    }
    return null;
  }

  async markRunning(jobId: string, now: Date): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job === undefined) return;
    job.state = 'running';
    job.started_at = now;
    job.attempts += 1;
    job.next_attempt_at = null;
  }

  async markSucceeded(
    jobId: string,
    result: Record<string, unknown>,
    now: Date,
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job === undefined) return;
    job.state = 'succeeded';
    job.result = result;
    job.finished_at = now;
    job.error = null;

    this.pushTrace(jobId, job.attempts, job.started_at ?? now, now, 'succeeded', null);
  }

  async markFailed(
    jobId: string,
    error: string,
    now: Date,
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job === undefined) return;
    job.finished_at = now;
    job.error = error;

    this.pushTrace(jobId, job.attempts, job.started_at ?? now, now, 'failed', error);

    if (job.attempts < job.max_attempts) {
      job.state = 'queued';
      job.started_at = null;
      job.finished_at = null;
      // D9.2 — exponential backoff before the next attempt.
      job.next_attempt_at = new Date(now.getTime() + retryBackoffMs(job.attempts));
    } else {
      job.state = 'failed';
      job.next_attempt_at = null;
    }
  }

  async reapStalled(
    now: Date,
    timeoutMs: number = STALL_TIMEOUT_MS,
  ): Promise<readonly string[]> {
    const reaped: string[] = [];
    for (const job of [...this.jobs.values()]) {
      if (job.state !== 'running' || job.started_at === null) continue;
      if (now.getTime() - job.started_at.getTime() >= timeoutMs) {
        const minutes = Math.round(timeoutMs / 60000);
        await this.markFailed(
          job.id,
          `stalled: no progress for ${minutes} minutes`,
          now,
        );
        reaped.push(job.id);
      }
    }
    return reaped;
  }

  async getJob(jobId: string): Promise<Job | null> {
    const job = this.jobs.get(jobId);
    return job === undefined ? null : { ...job };
  }

  async getTraces(jobId: string): Promise<readonly JobTrace[]> {
    return [...(this.traces.get(jobId) ?? [])];
  }

  private pushTrace(
    jobId: string,
    attempt: number,
    startedAt: Date,
    finishedAt: Date,
    outcome: 'succeeded' | 'failed',
    error: string | null,
  ): void {
    const list = this.traces.get(jobId) ?? [];
    list.push({
      job_id: jobId,
      attempt,
      started_at: startedAt,
      finished_at: finishedAt,
      outcome,
      error,
    });
    this.traces.set(jobId, list);
  }
}
