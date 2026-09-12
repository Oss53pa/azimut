import { describe, it, expect } from 'vitest';
import { auditSurveySync, type SurveyRecord } from '../survey-sync.js';

const s = (id: string, sync_state: SurveyRecord['sync_state']): SurveyRecord => ({
  id,
  sync_state,
});

describe('I5.6 — auditSurveySync (SURVEY.SYNC_PENDING)', () => {
  it('reports nothing when every survey is synced', () => {
    const r = auditSurveySync([s('t-1', 'synced'), s('t-2', 'synced')]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });

  it('reports an info per pending survey', () => {
    const r = auditSurveySync([s('t-1', 'pending')]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings[0]?.code).toBe('SURVEY.SYNC_PENDING');
    expect(r.warnings[0]?.severity).toBe('info');
    expect(r.warnings[0]?.ruleRef).toBe('I5.6');
    expect(r.warnings[0]?.entity).toEqual({ kind: 'survey', id: 't-1' });
  });

  it('reports pending surveys sorted by id, ignoring synced ones', () => {
    const r = auditSurveySync([
      s('t-c', 'pending'),
      s('t-a', 'synced'),
      s('t-b', 'pending'),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings.map((w) => w.entity?.id)).toEqual(['t-b', 't-c']);
  });

  it('is a no-op for an empty list', () => {
    const r = auditSurveySync([]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });
});
