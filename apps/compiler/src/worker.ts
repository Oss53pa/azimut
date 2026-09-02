import type { Job } from './job.js';
import type { JobQueue } from './queue.js';

export type JobHandler = (
  job: Job,
) => Promise<Record<string, unknown>>;

export type WorkerOptions = {
  queue: JobQueue;
  handlers: ReadonlyMap<string, JobHandler>;
  now: () => Date;
};

export async function processNextJob(
  options: WorkerOptions,
): Promise<boolean> {
  const { queue, handlers, now } = options;

  const job = await queue.dequeue();
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
