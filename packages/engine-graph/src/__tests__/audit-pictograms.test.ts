import { describe, it, expect } from 'vitest';
import {
  auditPictogramComprehension,
  type PictogramComprehension,
} from '../audit-pictograms.js';

const p = (
  id: string,
  registry: PictogramComprehension['registry'],
  comprehension_state: PictogramComprehension['comprehension_state'],
): PictogramComprehension => ({ id, registry, comprehension_state });

describe('J5.3 — auditPictogramComprehension', () => {
  it('is always ok, reporting untested orientation pictograms as info warnings', () => {
    const r = auditPictogramComprehension([p('w-1', 'wayfinding', 'untested')]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]?.code).toBe('PICTO.UNTESTED');
    expect(r.warnings[0]?.severity).toBe('info');
    expect(r.warnings[0]?.ruleRef).toBe('J5.3');
    expect(r.warnings[0]?.entity).toEqual({ kind: 'pictogram', id: 'w-1' });
  });

  it('does not report tested or failed orientation pictograms', () => {
    const r = auditPictogramComprehension([
      p('w-1', 'wayfinding', 'tested'),
      p('w-2', 'wayfinding', 'failed'),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });

  it('never reports safety pictograms, whatever their state', () => {
    const r = auditPictogramComprehension([p('s-1', 'safety', 'untested')]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });

  it('reports one info per untested orientation pictogram, sorted by id', () => {
    const r = auditPictogramComprehension([
      p('w-c', 'wayfinding', 'untested'),
      p('w-a', 'wayfinding', 'tested'),
      p('w-b', 'wayfinding', 'untested'),
      p('s-x', 'safety', 'untested'),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings.map((f) => f.entity?.id)).toEqual(['w-b', 'w-c']);
  });

  it('is a no-op for an empty list', () => {
    const r = auditPictogramComprehension([]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });
});
