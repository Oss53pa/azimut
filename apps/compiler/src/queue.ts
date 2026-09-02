import type { Job, JobTrace } from './job.js';

export type JobQueue = {
  enqueue(job: Job): Promise<void>;
  dequeue(): Promise<Job | null>;
  markRunning(jobId: string, now: Date): Promise<void>;
  markSucceeded(
    jobId: string,
    result: Record<string, unknown>,
    now: Date,
  ): Promise<void>;
  markFailed(jobId: string, error: string, now: Date): Promise<void>;
  getJob(jobId: string): Promise<Job | null>;
  getTraces(jobId: string): Promise<readonly JobTrace[]>;
};

export class MemoryQueue implements JobQueue {
  private readonly jobs = new Map<string, Job>();
  private readonly traces = new Map<string, JobTrace[]>();

  async enqueue(job: Job): Promise<void> {
    this.jobs.set(job.id, { ...job });
  }

  async dequeue(): Promise<Job | null> {
    for (const job of this.jobs.values()) {
      if (job.state === 'queued') {
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
    } else {
      job.state = 'failed';
    }
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
