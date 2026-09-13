import type { Finding, Outcome } from '@azimut/core-model';

/**
 * H4.3 / H4.4 — Advertising placement planning. A placement carries a calendar
 * with states free / option / reserved / occupied / maintenance / retired, and
 * options carry an automatic expiry date. Two automatic controls surface here:
 *  - AD.PLACEMENT_DOUBLE_BOOKED (blocking): two committed bookings overlap in
 *    time on the same placement.
 *  - AD.OPTION_EXPIRED (info): an option has reached its expiry date.
 *
 * Module 5 (régie) has no dedicated engine yet; these are application-layer
 * guards. Dates are ISO 'YYYY-MM-DD', compared lexically.
 */
export const BOOKING_STATES = [
  'free',
  'option',
  'reserved',
  'occupied',
  'maintenance',
  'retired',
] as const;
export type BookingState = (typeof BOOKING_STATES)[number];

/** States that firmly hold a placement and therefore conflict with each other. */
const COMMITTED: ReadonlySet<BookingState> = new Set<BookingState>([
  'reserved',
  'occupied',
]);

export type PlacementBooking = {
  readonly id: string;
  readonly placement_id: string;
  readonly state: BookingState;
  readonly from_date: string;
  readonly to_date: string;
};

function overlaps(a: PlacementBooking, b: PlacementBooking): boolean {
  // Inclusive date intervals overlap when each starts no later than the other ends.
  return a.from_date <= b.to_date && b.from_date <= a.to_date;
}

/**
 * Detect booking conflicts. Returns one blocking AD.PLACEMENT_DOUBLE_BOOKED per
 * committed booking that overlaps another committed booking on the same
 * placement, sorted by booking id; the finding names the placement and the
 * conflicting booking ids.
 */
export function guardPlacementBookings(
  bookings: readonly PlacementBooking[],
): Outcome<null> {
  const committed = bookings.filter((b) => COMMITTED.has(b.state));
  const findings: Finding[] = [];

  const sorted = [...committed].sort((a, b) => a.id.localeCompare(b.id));
  for (const booking of sorted) {
    const conflicting = sorted
      .filter(
        (other) =>
          other.id !== booking.id &&
          other.placement_id === booking.placement_id &&
          overlaps(booking, other),
      )
      .map((other) => other.id);
    if (conflicting.length > 0) {
      findings.push({
        code: 'AD.PLACEMENT_DOUBLE_BOOKED',
        severity: 'blocking',
        entity: { kind: 'placement_booking', id: booking.id },
        params: {
          placement_id: booking.placement_id,
          conflicting_ids: conflicting.join(','),
        },
        ruleRef: 'H4.3',
      });
    }
  }

  if (findings.length > 0) {
    return { ok: false, findings };
  }
  return { ok: true, value: null, warnings: [] };
}

export type PlacementOption = {
  readonly id: string;
  readonly placement_id: string;
  readonly expires_at: string;
};

/**
 * Audit options for expiry. Returns one info AD.OPTION_EXPIRED per option whose
 * expiry date is on or before the supplied date, sorted by option id. Always
 * ok — expiry is informational, the option simply lapses.
 */
export function auditOptionExpiry(
  options: readonly PlacementOption[],
  at: string,
): Outcome<null> {
  const warnings: Finding[] = [];
  const sorted = [...options].sort((a, b) => a.id.localeCompare(b.id));

  for (const option of sorted) {
    if (option.expires_at <= at) {
      warnings.push({
        code: 'AD.OPTION_EXPIRED',
        severity: 'info',
        entity: { kind: 'placement_option', id: option.id },
        params: { placement_id: option.placement_id, expires_at: option.expires_at },
        ruleRef: 'H4.4',
      });
    }
  }

  return { ok: true, value: null, warnings };
}
