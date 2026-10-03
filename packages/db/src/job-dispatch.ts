import { sql } from 'drizzle-orm';
import { setSessionIdentity } from './write-path.js';
import type { Executor, TransactionalDb } from './write-path.js';

/**
 * T-0.11 et D9.2 — les requêtes de la file des travaux (migration 0071).
 *
 * Deux identités seulement. Sous `azimut_compiler`, le service n'exécute que
 * les trois fonctions de prise et n'apprend d'un travail que son identifiant,
 * son organisation, son type, son demandeur et sa tentative. Sous l'identité
 * du demandeur (A6.1, migration 0070), il lit le contenu et clôt le travail
 * par les politiques ordinaires.
 */
export const COMPILER_ROLE = 'azimut_compiler';

/** Ce que la prise apprend d'un travail. */
export type ClaimedJob = {
  readonly id: string;
  readonly org_id: string;
  readonly kind: string;
  readonly requested_by: string | null;
  readonly attempts: number;
  readonly created_at: Date;
};

export type StalledJob = {
  readonly id: string;
  readonly requested_by: string | null;
};

/** Ce qu'une clôture a trouvé. */
export type JobClosing = 'closed' | 'unreadable' | 'unwritable' | 'stale';

export type JobOutcome =
  | { readonly kind: 'succeeded'; readonly result: Record<string, unknown> }
  | { readonly kind: 'failed'; readonly error: string; readonly maxAttempts: number };

type Row = Readonly<Record<string, unknown>>;

function rowsOf(result: unknown): readonly Row[] {
  if (!Array.isArray(result)) return [];
  return result.filter(
    (row: unknown): row is Row => typeof row === 'object' && row !== null,
  );
}

function text(row: Row, column: string): string {
  const value = row[column];
  if (typeof value !== 'string' || value === '') {
    throw new Error(`job.${column}: text expected`);
  }
  return value;
}

function optionalText(row: Row, column: string): string | null {
  const value = row[column];
  return typeof value === 'string' && value !== '' ? value : null;
}

function integer(row: Row, column: string): number {
  const value = row[column];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`job.${column}: integer expected`);
  }
  return value;
}

function instant(row: Row, column: string): Date {
  const value = row[column];
  const date = value instanceof Date ? value
    : typeof value === 'string' ? new Date(value) : null;
  if (date === null || Number.isNaN(date.getTime())) {
    throw new Error(`job.${column}: timestamp expected`);
  }
  return date;
}

function asCompiler<T>(db: TransactionalDb, run: (tx: Executor) => Promise<T>): Promise<T> {
  return db.transaction(async tx => {
    await tx.execute(sql`set local role ${sql.raw(COMPILER_ROLE)}`);
    return run(tx);
  });
}

function asUser<T>(
  db: TransactionalDb, userId: string, run: (tx: Executor) => Promise<T>,
): Promise<T> {
  return db.transaction(async tx => {
    await setSessionIdentity(tx, { userId });
    return run(tx);
  });
}

/**
 * Prend le plus ancien travail en file dont la temporisation est écoulée. La
 * temporisation vient du service, de sa seule définition (D9.2).
 */
export async function claimJob(
  db: TransactionalDb, now: Date, backoffSeconds: readonly number[],
): Promise<ClaimedJob | null> {
  if (!backoffSeconds.every(s => Number.isInteger(s) && s >= 0)) {
    throw new Error('backoff must be whole, non-negative seconds');
  }
  const claimed = await asCompiler(db, tx => tx.execute(sql`
    select * from azimut.job_claim(
      ${now.toISOString()}::timestamptz,
      ${`{${backoffSeconds.join(',')}}`}::integer[])`));
  const row = rowsOf(claimed)[0];
  if (row === undefined) return null;
  return {
    id: text(row, 'id'),
    org_id: text(row, 'org_id'),
    kind: text(row, 'kind'),
    requested_by: optionalText(row, 'requested_by'),
    attempts: integer(row, 'attempts'),
    created_at: instant(row, 'created_at'),
  };
}

/** D9.2 — les travaux en cours depuis plus que le délai. */
export async function stalledJobs(
  db: TransactionalDb, now: Date, timeoutMs: number,
): Promise<readonly StalledJob[]> {
  const stalled = await asCompiler(db, tx => tx.execute(sql`
    select * from azimut.job_stalled(
      ${now.toISOString()}::timestamptz, ${timeoutMs / 1000})`));
  return rowsOf(stalled).map(row => ({
    id: text(row, 'id'),
    requested_by: optionalText(row, 'requested_by'),
  }));
}

/** Clôt en échec un travail en cours que nul ne peut plus porter. */
export async function abandonJob(
  db: TransactionalDb, jobId: string, now: Date, reason: string,
): Promise<boolean> {
  const done = await asCompiler(db, tx => tx.execute(sql`
    select azimut.job_abandon(${jobId}, ${now.toISOString()}::timestamptz, ${reason})
      as abandoned`));
  return rowsOf(done)[0]?.['abandoned'] === true;
}

/** Le contenu d'un travail, lu sous l'identité du demandeur ; nul s'il ne le voit pas. */
export async function readJobPayloadAs(
  db: TransactionalDb, userId: string, jobId: string,
): Promise<Record<string, unknown> | null> {
  return asUser(db, userId, async tx => {
    const found = rowsOf(await tx.execute(sql`
      select payload from azimut.job where id = ${jobId}`))[0];
    if (found === undefined) return null;
    const payload = found['payload'];
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      throw new Error('job.payload: object expected');
    }
    return { ...(payload as Record<string, unknown>) };
  });
}

/**
 * Clôt un travail sous l'identité de son demandeur. Un succès le termine ; un
 * échec le remet en file tant que des tentatives restent (D9.2), l'heure de
 * fin restant posée pour la temporisation. Un travail qui n'est plus en cours
 * à la tentative donnée — relevé comme stagnant, puis repris ailleurs — n'est
 * pas touché : une clôture tardive écraserait l'essai suivant.
 */
export async function closeJobAs(
  db: TransactionalDb,
  userId: string,
  close: {
    readonly jobId: string;
    readonly attempt: number | null;
    readonly now: Date;
    readonly outcome: JobOutcome;
  },
): Promise<JobClosing> {
  const { jobId, attempt, now, outcome } = close;
  const at = now.toISOString();
  const update = outcome.kind === 'succeeded'
    ? sql`
      update azimut.job
      set state = 'succeeded', result = ${JSON.stringify(outcome.result)}::jsonb,
          finished_at = ${at}::timestamptz, error = null
      where id = ${jobId} and state = 'running'
      returning id`
    : sql`
      update azimut.job
      set state = case when attempts < ${outcome.maxAttempts}
                       then 'queued' else 'failed' end,
          finished_at = ${at}::timestamptz, error = ${outcome.error}
      where id = ${jobId} and state = 'running'
      returning id`;

  return asUser(db, userId, async (tx): Promise<JobClosing> => {
    const seen = rowsOf(await tx.execute(sql`
      select state, attempts from azimut.job where id = ${jobId} for update`))[0];
    if (seen === undefined) return 'unreadable';
    if (seen['state'] !== 'running') return 'stale';
    if (attempt !== null && integer(seen, 'attempts') !== attempt) return 'stale';
    return rowsOf(await tx.execute(update)).length === 0 ? 'unwritable' : 'closed';
  });
}
