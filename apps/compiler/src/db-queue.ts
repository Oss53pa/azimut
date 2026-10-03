import {
  abandonJob,
  claimJob,
  closeJobAs,
  readJobPayloadAs,
  stalledJobs,
} from '@azimut/db';
import type { JobOutcome, TransactionalDb } from '@azimut/db';
import { isJobKind, type Job } from './job.js';
import {
  RETRY_BACKOFF_SECONDS,
  STALL_TIMEOUT_MS,
  type WorkerQueue,
} from './queue.js';

/**
 * T-0.11 et D9.2 — la file des travaux en base, côté service (migration 0071).
 *
 * Le service ne lit aucune table sous son propre nom. Il prend un travail par
 * la fonction de prise, puis en lit le contenu et le clôt sous l'identité de
 * son demandeur (A6.1, migration 0070).
 *
 * Un travail que nul ne peut porter — sans demandeur, ou dont le demandeur ne
 * le voit plus — est abandonné, en échec, avec la raison : un nouvel essai n'y
 * changerait rien.
 *
 * La trace de A12.2 est la ligne elle-même : état, heures de début et de fin,
 * tentatives, dernière erreur, résultat.
 */
export const NO_REQUESTER = 'job has no requester (requested_by)';
export const REQUESTER_CANNOT_READ =
  'requester can no longer read the job (not a member of its organization)';
export const REQUESTER_CANNOT_WRITE =
  'requester can no longer write the job (not a member of its organization)';

export type DbWorkerQueueOptions = {
  /** D9.2 — tentatives avant l'échec définitif. */
  readonly maxAttempts: number;
};

/** Un travail porté par ce service : son demandeur, et la tentative prise. */
type Held = { readonly requester: string | null; readonly attempt: number | null };

export class DbWorkerQueue implements WorkerQueue {
  private readonly held = new Map<string, Held>();

  constructor(
    private readonly db: TransactionalDb,
    private readonly options: DbWorkerQueueOptions,
  ) {}

  async dequeue(now: Date = new Date()): Promise<Job | null> {
    for (;;) {
      const claimed = await claimJob(this.db, now, RETRY_BACKOFF_SECONDS);
      if (claimed === null) return null;

      const { id, requested_by: requester, attempts, kind } = claimed;
      this.held.set(id, { requester, attempt: attempts });
      if (requester === null) {
        await this.abandon(id, now, NO_REQUESTER);
        continue;
      }
      if (!isJobKind(kind)) {
        await this.abandon(id, now, `unknown job kind: ${kind}`);
        continue;
      }
      const payload = await readJobPayloadAs(this.db, requester, id);
      if (payload === null) {
        await this.abandon(id, now, REQUESTER_CANNOT_READ);
        continue;
      }

      return {
        id,
        org_id: claimed.org_id,
        kind,
        state: 'running',
        payload,
        result: null,
        attempts,
        max_attempts: this.options.maxAttempts,
        created_at: claimed.created_at,
        started_at: now,
        finished_at: null,
        error: null,
        requested_by: requester,
      };
    }
  }

  /** La prise a déjà passé le travail en cours et compté la tentative. */
  async markRunning(): Promise<void> {
    return Promise.resolve();
  }

  async markSucceeded(
    jobId: string,
    result: Record<string, unknown>,
    now: Date,
  ): Promise<void> {
    await this.close(jobId, now, { kind: 'succeeded', result });
  }

  async markFailed(jobId: string, error: string, now: Date): Promise<void> {
    await this.close(jobId, now, {
      kind: 'failed', error, maxAttempts: this.options.maxAttempts,
    });
  }

  async reapStalled(
    now: Date,
    timeoutMs: number = STALL_TIMEOUT_MS,
  ): Promise<readonly string[]> {
    const minutes = Math.round(timeoutMs / 60000);
    const reaped: string[] = [];
    for (const job of await stalledJobs(this.db, now, timeoutMs)) {
      this.held.set(job.id, { requester: job.requested_by, attempt: null });
      await this.markFailed(job.id, `stalled: no progress for ${minutes} minutes`, now);
      reaped.push(job.id);
    }
    return reaped;
  }

  private async close(jobId: string, now: Date, outcome: JobOutcome): Promise<void> {
    const { requester, attempt } = this.held.get(jobId) ?? { requester: null, attempt: null };
    if (requester === null) {
      await this.abandon(jobId, now, NO_REQUESTER);
      return;
    }
    const closing = await closeJobAs(this.db, requester, { jobId, attempt, now, outcome });
    if (closing === 'unreadable') await this.abandon(jobId, now, REQUESTER_CANNOT_READ);
    if (closing === 'unwritable') await this.abandon(jobId, now, REQUESTER_CANNOT_WRITE);
    this.held.delete(jobId);
  }

  private async abandon(jobId: string, now: Date, reason: string): Promise<void> {
    await abandonJob(this.db, jobId, now, reason);
    this.held.delete(jobId);
  }
}
