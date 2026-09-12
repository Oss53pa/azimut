import type { Job } from './job.js';
import { STALL_TIMEOUT_MS, type JobQueue } from './queue.js';

export type JobHandler = (
  job: Job,
) => Promise<Record<string, unknown>>;

export type WorkerOptions = {
  queue: JobQueue;
  handlers: ReadonlyMap<string, JobHandler>;
  now: () => Date;
};

/**
 * D9.2 — reap jobs whose progress has stalled past the 30-minute timeout,
 * failing them (and re-queuing with backoff while attempts remain). Returns the
 * ids reaped. A worker loop calls this before dequeuing.
 */
export async function reapStalledJobs(
  options: WorkerOptions,
  timeoutMs: number = STALL_TIMEOUT_MS,
): Promise<readonly string[]> {
  return options.queue.reapStalled(options.now(), timeoutMs);
}

export async function processNextJob(
  options: WorkerOptions,
): Promise<boolean> {
  const { queue, handlers, now } = options;

  const job = await queue.dequeue(now());
  if (job === null) return false;

  await queue.markRunning(job.id, now());

  const handler = handlers.get(job.kind);
  if (handler === undefined) {
    await queue.markFailed(
      job.id,
      `No handler registered for job kind: ${job.kind}`,
      now(),
    );
    return true;
  }

  try {
    const result = await handler(job);
    await queue.markSucceeded(job.id, result, now());
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err);
    await queue.markFailed(job.id, message, now());
  }

  return true;
}

export type WorkerLoopOptions = WorkerOptions & {
  /** Idle poll interval (ms) when no job is ready. */
  readonly sleepMs: number;
  /** How often (ms) to reap stalled jobs. */
  readonly reapEveryMs: number;
  /** Stall timeout passed to the reaper. Defaults to {@link STALL_TIMEOUT_MS}. */
  readonly stallTimeoutMs?: number;
  /** Sleep for `ms`. Injected so the loop is deterministic under test. */
  readonly sleep: (ms: number) => Promise<void>;
  /** The loop exits once this returns true (checked each iteration). */
  readonly shouldStop: () => boolean;
};

export type WorkerLoopSummary = {
  readonly processed: number;
  readonly reaped: number;
};

/**
 * D9.2 — run the worker until {@link WorkerLoopOptions.shouldStop} is true.
 *
 * Each iteration reaps stalled jobs on the configured cadence, then processes
 * one ready job. When a job runs, the loop continues immediately (draining a
 * backlog without idling); when the queue is empty it sleeps `sleepMs` before
 * polling again. The loop owns no timers of its own — `now`, `sleep` and
 * `shouldStop` are injected, so it is fully deterministic in tests and free of
 * hidden non-determinism (INV-4).
 */
export async function runWorkerLoop(
  options: WorkerLoopOptions,
): Promise<WorkerLoopSummary> {
  const { sleepMs, reapEveryMs, stallTimeoutMs, sleep, shouldStop, now } =
    options;

  let processed = 0;
  let reaped = 0;
  let lastReapMs = Number.NEGATIVE_INFINITY;

  while (!shouldStop()) {
    const nowMs = now().getTime();
    if (nowMs - lastReapMs >= reapEveryMs) {
      reaped += (await reapStalledJobs(options, stallTimeoutMs)).length;
      lastReapMs = nowMs;
    }

    const didWork = await processNextJob(options);
    if (didWork) {
      processed += 1;
      continue;
    }
    await sleep(sleepMs);
  }

  return { processed, reaped };
}
