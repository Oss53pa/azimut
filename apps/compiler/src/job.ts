export type JobKind =
  | 'import_plan'
  | 'import_roster'
  | 'compile_artworks'
  | 'build_kiosk_package'
  | 'export_quantities'
  | 'audit_site';

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
};

export type JobTrace = {
  job_id: string;
  attempt: number;
  started_at: Date;
  finished_at: Date;
  outcome: 'succeeded' | 'failed';
  error: string | null;
};
