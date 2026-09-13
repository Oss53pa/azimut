import { describe, it, expect } from 'vitest';
import {
  guardPlacementBookings,
  auditOptionExpiry,
  type PlacementBooking,
  type PlacementOption,
} from '../ad-planning.js';

const bk = (
  id: string,
  state: PlacementBooking['state'],
  from_date: string,
  to_date: string,
  placement_id = 'e-1',
): PlacementBooking => ({ id, placement_id, state, from_date, to_date });

describe('H4.3 — guardPlacementBookings (AD.PLACEMENT_DOUBLE_BOOKED)', () => {
  it('passes when committed bookings do not overlap', () => {
    const r = guardPlacementBookings([
      bk('b-1', 'reserved', '2026-01-01', '2026-01-31'),
      bk('b-2', 'occupied', '2026-02-01', '2026-02-28'),
    ]);
    expect(r.ok).toBe(true);
  });

  it('blocks two committed bookings overlapping on the same placement', () => {
    const r = guardPlacementBookings([
      bk('b-1', 'reserved', '2026-01-01', '2026-01-31'),
      bk('b-2', 'occupied', '2026-01-15', '2026-02-15'),
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings).toHaveLength(2);
    expect(r.findings[0]?.code).toBe('AD.PLACEMENT_DOUBLE_BOOKED');
    expect(r.findings[0]?.severity).toBe('blocking');
    expect(r.findings[0]?.ruleRef).toBe('H4.3');
    expect(r.findings[0]?.params['conflicting_ids']).toBe('b-2');
    expect(r.findings.map((f) => f.entity?.id)).toEqual(['b-1', 'b-2']);
  });

  it('does not conflict across different placements', () => {
    const r = guardPlacementBookings([
      bk('b-1', 'reserved', '2026-01-01', '2026-01-31', 'e-1'),
      bk('b-2', 'reserved', '2026-01-01', '2026-01-31', 'e-2'),
    ]);
    expect(r.ok).toBe(true);
  });

  it('ignores non-committed states (option, free, maintenance)', () => {
    const r = guardPlacementBookings([
      bk('b-1', 'option', '2026-01-01', '2026-01-31'),
      bk('b-2', 'option', '2026-01-15', '2026-02-15'),
      bk('b-3', 'maintenance', '2026-01-10', '2026-01-20'),
    ]);
    expect(r.ok).toBe(true);
  });
});

const opt = (
  id: string,
  expires_at: string,
  placement_id = 'e-1',
): PlacementOption => ({ id, placement_id, expires_at });

describe('H4.4 — auditOptionExpiry (AD.OPTION_EXPIRED)', () => {
  it('reports nothing for options not yet expired', () => {
    const r = auditOptionExpiry([opt('o-1', '2026-12-31')], '2026-06-01');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });

  it('reports an info for an option at or past its expiry', () => {
    const r = auditOptionExpiry([opt('o-1', '2026-05-01')], '2026-06-01');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings[0]?.code).toBe('AD.OPTION_EXPIRED');
    expect(r.warnings[0]?.severity).toBe('info');
    expect(r.warnings[0]?.ruleRef).toBe('H4.4');
    expect(r.warnings[0]?.entity).toEqual({ kind: 'placement_option', id: 'o-1' });
  });

  it('treats the expiry date itself as expired (inclusive)', () => {
    const r = auditOptionExpiry([opt('o-1', '2026-06-01')], '2026-06-01');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toHaveLength(1);
  });

  it('reports expired options sorted by id', () => {
    const r = auditOptionExpiry(
      [opt('o-c', '2026-01-01'), opt('o-a', '2030-01-01'), opt('o-b', '2026-01-01')],
      '2026-06-01',
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings.map((w) => w.entity?.id)).toEqual(['o-b', 'o-c']);
  });
});
