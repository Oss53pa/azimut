import type { JobKind } from './job.js';
import type { Job } from './job.js';
import type { JobQueue } from './queue.js';
import type { JobHandler } from './worker.js';
import { processNextJob } from './worker.js';

export type BatchItem = {
  readonly item_id: string;
  readonly payload: Record<string, unknown>;
};

export type BatchResult = {
  readonly item_id: string;
  readonly status: 'succeeded' | 'failed' | 'skipped';
  readonly error: string | null;
};

export type BatchReport = {
  readonly total: number;
  readonly created: number;
  readonly skipped: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly results: readonly BatchResult[];
};

export type BatchOptions = {
  readonly org_id: string;
  readonly kind: JobKind;
  readonly queue: JobQueue;
  readonly handler: JobHandler;
  readonly now: () => Date;
  readonly max_attempts: number;
};

function jobIdForItem(kind: JobKind, itemId: string): string {
  return `${kind}-${itemId}`;
}

export async function runBatch(
  items: readonly BatchItem[],
  options: BatchOptions,
): Promise<BatchReport> {
  const { org_id, kind, queue, handler, now, max_attempts } = options;
  const results: BatchResult[] = [];
  const sortedItems = [...items].sort((a, b) =>
    a.item_id.localeCompare(b.item_id),
  );

  let created = 0;
  let skipped = 0;

  for (const item of sortedItems) {
    const jobId = jobIdForItem(kind, item.item_id);
    const existing = await queue.getJob(jobId);

    if (existing !== null && existing.state === 'succeeded') {
      results.push({
        item_id: item.item_id,
        status: 'skipped',
        error: null,
      });
      skipped++;
      continue;
    }

    if (existing !== null && (existing.state === 'queued' || existing.state === 'running')) {
      continue;
    }

    const job: Job = {
      id: jobId,
      org_id,
      kind,
      state: 'queued',
      payload: { item_id: item.item_id, ...item.payload },
      result: null,
      attempts: 0,
      max_attempts,
      created_at: now(),
      started_at: null,
      finished_at: null,
      error: null,
    };
    await queue.enqueue(job);
    created++;
  }

  const handlers = new Map<string, JobHandler>([
    [kind, handler],
  ]);
  const workerOpts = { queue, handlers, now };

  while (await processNextJob(workerOpts)) {
    // drain queue
  }

  let succeeded = 0;
  let failed = 0;

  for (const item of sortedItems) {
    const existing = results.find((r) => r.item_id === item.item_id);
    if (existing) continue;

    const jobId = jobIdForItem(kind, item.item_id);
    const job = await queue.getJob(jobId);
    if (job === null) {
      results.push({
        item_id: item.item_id,
        status: 'failed',
        error: 'job not found',
      });
      failed++;
    } else if (job.state === 'succeeded') {
      results.push({
        item_id: item.item_id,
        status: 'succeeded',
        error: null,
      });
      succeeded++;
    } else {
      results.push({
        item_id: item.item_id,
        status: 'failed',
        error: job.error,
      });
      failed++;
    }
  }

  return {
    total: items.length,
    created,
    skipped,
    succeeded,
    failed,
    results: results.sort((a, b) =>
      a.item_id.localeCompare(b.item_id),
    ),
  };
}
