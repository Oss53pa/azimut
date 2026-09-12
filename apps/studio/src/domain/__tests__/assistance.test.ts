import { describe, it, expect } from 'vitest';
import {
  filterAssistProposals,
  auditExtractionRate,
  type AssistProposal,
  type ExtractionRun,
} from '../assistance.js';

const prop = (id: string, signature: string): AssistProposal => ({ id, signature });
const run = (id: string, extraction_rate: number): ExtractionRun => ({
  id,
  extraction_rate,
});

describe('I3 — filterAssistProposals (ASSIST.PROPOSAL_REJECTED)', () => {
  it('keeps proposals the user has not rejected', () => {
    const r = filterAssistProposals(
      [prop('p-1', 'sig-a'), prop('p-2', 'sig-b')],
      new Set(),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.map((p) => p.id)).toEqual(['p-1', 'p-2']);
    expect(r.warnings).toEqual([]);
  });

  it('suppresses a previously-rejected proposal and reports it as info', () => {
    const r = filterAssistProposals(
      [prop('p-1', 'sig-a'), prop('p-2', 'sig-b')],
      new Set(['sig-a']),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.map((p) => p.id)).toEqual(['p-2']);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]?.code).toBe('ASSIST.PROPOSAL_REJECTED');
    expect(r.warnings[0]?.severity).toBe('info');
    expect(r.warnings[0]?.ruleRef).toBe('I3');
    expect(r.warnings[0]?.entity).toEqual({ kind: 'assist_proposal', id: 'p-1' });
  });

  it('reports suppressions sorted by id, independent of input order', () => {
    const r = filterAssistProposals(
      [prop('p-c', 'x'), prop('p-a', 'x'), prop('p-b', 'x')],
      new Set(['x']),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toEqual([]);
    expect(r.warnings.map((w) => w.entity?.id)).toEqual(['p-a', 'p-b', 'p-c']);
  });
});

describe('I3 — auditExtractionRate (ASSIST.EXTRACTION_BELOW_THRESHOLD)', () => {
  it('passes runs at or above the threshold', () => {
    const r = auditExtractionRate([run('r-1', 0.9), run('r-2', 0.8)], 0.8);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });

  it('warns on a run below the threshold, carrying rate and threshold', () => {
    const r = auditExtractionRate([run('r-1', 0.5)], 0.8);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings[0]?.code).toBe('ASSIST.EXTRACTION_BELOW_THRESHOLD');
    expect(r.warnings[0]?.severity).toBe('warning');
    expect(r.warnings[0]?.ruleRef).toBe('I3');
    expect(r.warnings[0]?.params['extraction_rate']).toBe(0.5);
    expect(r.warnings[0]?.params['threshold']).toBe(0.8);
  });

  it('reports one warning per low run, sorted by id', () => {
    const r = auditExtractionRate(
      [run('r-c', 0.1), run('r-a', 0.95), run('r-b', 0.2)],
      0.8,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings.map((w) => w.entity?.id)).toEqual(['r-b', 'r-c']);
  });

  it('is a no-op for an empty list', () => {
    const r = auditExtractionRate([], 0.8);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });
});
