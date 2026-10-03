export const JOB_KINDS = [
  'import_plan',
  'import_roster',
  'compile_artworks',
  'build_delivery_archive',
  'build_wall_plans',
  'build_kiosk_package',
  'export_quantities',
  'audit_site',
] as const;

export type JobKind = (typeof JOB_KINDS)[number];

export function isJobKind(value: unknown): value is JobKind {
  return (JOB_KINDS as readonly unknown[]).includes(value);
}

export type JobState =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type Job = {
  id: string;
  org_id: string;
  kind: JobKind;
  state: JobState;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  attempts: number;
  max_attempts: number;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  error: string | null;
  /**
   * A6.1 — l'utilisateur qui a demandé le travail, posé par la base
   * (migration 0070). Le service lit sous son identité ; un travail sans
   * demandeur, antérieur à la migration, est refusé.
   */
  requested_by: string | null;
  /**
   * D9.2 — earliest time a re-queued job may be dequeued again (exponential
   * backoff). Null/absent means immediately eligible.
   */
  next_attempt_at?: Date | null;
};

export type JobTrace = {
  job_id: string;
  attempt: number;
  started_at: Date;
  finished_at: Date;
  outcome: 'succeeded' | 'failed';
  error: string | null;
};
