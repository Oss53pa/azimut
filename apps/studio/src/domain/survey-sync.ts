import type { Finding, Outcome } from '@azimut/core-model';

/**
 * I5.6 — Tour surveys are captured offline (an installable web app, reusing the
 * kiosk-package offline mechanism) and synchronised later. Until a survey has
 * been synced, its observations are not yet reconciled; this audit surfaces that
 * as an informational SURVEY.SYNC_PENDING so an unsynced tour is visible rather
 * than silently missing. Application layer, not an engine.
 */
export const SURVEY_SYNC_STATES = ['pending', 'synced'] as const;
export type SurveySyncState = (typeof SURVEY_SYNC_STATES)[number];

export type SurveyRecord = {
  readonly id: string;
  readonly sync_state: SurveySyncState;
};

/**
 * Audit tour surveys for sync state. Returns one info SURVEY.SYNC_PENDING per
 * survey still pending synchronisation, sorted by id. Always ok — a pending
 * sync is informational, not blocking.
 */
export function auditSurveySync(
  surveys: readonly SurveyRecord[],
): Outcome<null> {
  const sorted = [...surveys].sort((a, b) => a.id.localeCompare(b.id));
  const warnings: Finding[] = [];

  for (const survey of sorted) {
    if (survey.sync_state === 'pending') {
      warnings.push({
        code: 'SURVEY.SYNC_PENDING',
        severity: 'info',
        entity: { kind: 'survey', id: survey.id },
        params: {},
        ruleRef: 'I5.6',
      });
    }
  }

  return { ok: true, value: null, warnings };
}
