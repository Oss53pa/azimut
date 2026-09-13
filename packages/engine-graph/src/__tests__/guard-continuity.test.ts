import { describe, it, expect } from 'vitest';
import {
  guardWayfindingContinuity,
  type JalonnementSequence,
} from '../guard-continuity.js';

const step = (
  point_id: string,
  announced: string[],
  reached: string[] = [],
): JalonnementSequence['steps'][number] => ({ point_id, announced, reached });

const seq = (
  id: string,
  steps: JalonnementSequence['steps'],
): JalonnementSequence => ({ id, steps });

describe('H2.4 — guardWayfindingContinuity', () => {
  it('passes when a destination is carried through to arrival', () => {
    const r = guardWayfindingContinuity([
      seq('r-1', [
        step('p1', ['cafe']),
        step('p2', ['cafe']),
        step('p3', ['cafe'], ['cafe']),
      ]),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBeNull();
  });

  it('passes when announced and confirmed at the same point', () => {
    const r = guardWayfindingContinuity([
      seq('r-1', [step('p1', ['cafe'], ['cafe'])]),
    ]);
    expect(r.ok).toBe(true);
  });

  it('breaks on a gap before arrival', () => {
    const r = guardWayfindingContinuity([
      seq('r-1', [
        step('p1', ['cafe']),
        step('p2', []), // dropped here
        step('p3', ['cafe'], ['cafe']),
      ]),
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.code).toBe('WAYFIND.CONTINUITY_BROKEN');
    expect(r.findings[0]?.severity).toBe('blocking');
    expect(r.findings[0]?.ruleRef).toBe('H2.4');
    expect(r.findings[0]?.entity).toEqual({ kind: 'destination', id: 'cafe' });
    expect(r.findings[0]?.params['reason']).toBe('gap');
    expect(r.findings[0]?.params['break_point']).toBe('p2');
    expect(r.findings[0]?.params['sequence_id']).toBe('r-1');
  });

  it('breaks when announced but never reached', () => {
    const r = guardWayfindingContinuity([
      seq('r-1', [step('p1', ['cafe']), step('p2', ['cafe'])]),
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.params['reason']).toBe('never_reached');
    expect(r.findings[0]?.params['break_point']).toBe('p1');
  });

  it('does not break a destination reached without being announced first', () => {
    const r = guardWayfindingContinuity([seq('r-1', [step('p1', [], ['cafe'])])]);
    expect(r.ok).toBe(true);
  });

  it('reports one finding per broken (destination, sequence), sorted', () => {
    const r = guardWayfindingContinuity([
      seq('r-2', [step('p1', ['gym']), step('p2', [])]),
      seq('r-1', [step('p1', ['spa']), step('p2', [])]),
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.map((f) => f.entity?.id)).toEqual(['gym', 'spa']);
  });

  it('is a no-op for empty sequences', () => {
    expect(guardWayfindingContinuity([]).ok).toBe(true);
    expect(guardWayfindingContinuity([seq('r-1', [])]).ok).toBe(true);
  });
});
