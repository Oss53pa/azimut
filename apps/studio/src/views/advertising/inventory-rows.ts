/**
 * H4.1 / H4.3 — l'inventaire des emplacements publicitaires, ligne par ligne.
 *
 * Tout est dérivé des réservations : l'état du mois, le taux d'occupation sur
 * une fenêtre de mois, le premier mois libre, et les conflits que le garde
 * `guardPlacementBookings` relève sur l'emplacement. Rien ne se saisit ici.
 */
import type { Finding } from '@azimut/core-model';
import { guardPlacementBookings, type BookingState, type PlacementBooking } from '../../domain/ad-planning.js';
import type { Placement } from '../../domain/demo/commerce.js';
import { monthsFrom, stateAt, type MonthKey } from './occupancy.js';

export type InventoryRow = {
  readonly placement: Placement;
  readonly state: BookingState;
  /** Mois tenus fermement (réservé ou occupé) sur la fenêtre. */
  readonly heldMonths: number;
  readonly windowMonths: number;
  /** Premier mois de la fenêtre où l'emplacement est libre, ou `null`. */
  readonly firstFree: MonthKey | null;
  readonly bookings: readonly PlacementBooking[];
  readonly conflicts: readonly Finding[];
};

const HELD: ReadonlySet<BookingState> = new Set<BookingState>(['occupied', 'reserved']);

export function inventoryRows(
  placements: readonly Placement[],
  bookings: readonly PlacementBooking[],
  todayIso: string,
  windowMonths: number,
): readonly InventoryRow[] {
  const months = monthsFrom(todayIso, windowMonths);
  const guarded = guardPlacementBookings(bookings);
  const findings = guarded.ok ? guarded.warnings : guarded.findings;

  return [...placements]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((placement): InventoryRow => {
      const states = months.map(m => stateAt(bookings, placement.id, m));
      const freeIndex = states.findIndex(s => s === 'free');
      return {
        placement,
        state: states[0] ?? 'free',
        heldMonths: states.filter(s => HELD.has(s)).length,
        windowMonths: months.length,
        firstFree: freeIndex === -1 ? null : (months[freeIndex] ?? null),
        bookings: bookings
          .filter(b => b.placement_id === placement.id)
          .sort((a, b) => a.from_date.localeCompare(b.from_date) || a.id.localeCompare(b.id)),
        conflicts: findings.filter(f => f.params['placement_id'] === placement.id),
      };
    });
}
