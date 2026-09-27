/**
 * H4.1 / H4.3 — l'inventaire des emplacements publicitaires, ligne par ligne.
 *
 * Tout est dérivé des réservations : l'état du mois, le taux d'occupation sur
 * une fenêtre de mois, le premier mois libre, et les conflits que le garde
 * `guardPlacementBookings` relève sur l'emplacement. Rien ne se saisit ici.
 */
import type { AdBooking, AdPlacement, Finding } from '@azimut/core-model';
import { guardPlacementBookings, type BookingState } from '../../domain/ad-planning.js';
import { monthsFrom, stateAt, type MonthKey } from './occupancy.js';

export type InventoryRow = {
  readonly placement: AdPlacement;
  /** L'annonceur de la réservation ferme en cours, ou de la prochaine ; `null` sinon. */
  readonly advertiser: string | null;
  readonly state: BookingState;
  /** Mois tenus fermement (réservé ou occupé) sur la fenêtre. */
  readonly heldMonths: number;
  readonly windowMonths: number;
  /** Premier mois de la fenêtre où l'emplacement est libre, ou `null`. */
  readonly firstFree: MonthKey | null;
  readonly bookings: readonly AdBooking[];
  readonly conflicts: readonly Finding[];
};

const HELD: ReadonlySet<BookingState> = new Set<BookingState>(['occupied', 'reserved']);

/**
 * L'annonceur d'un emplacement : celui de la réservation ferme qui le tient
 * aujourd'hui, ou à défaut de la prochaine. Il se lit dans les réservations,
 * il ne se saisit pas sur l'emplacement.
 */
export function currentAdvertiser(bookings: readonly AdBooking[], placementId: string, todayIso: string): string | null {
  const next = bookings
    .filter(b => b.placement_id === placementId && HELD.has(b.state) && b.to_date >= todayIso)
    .sort((a, b) => a.from_date.localeCompare(b.from_date) || a.id.localeCompare(b.id))[0];
  return next?.advertiser_name ?? null;
}

export function inventoryRows(
  placements: readonly AdPlacement[],
  bookings: readonly AdBooking[],
  todayIso: string,
  windowMonths: number,
): readonly InventoryRow[] {
  const months = monthsFrom(todayIso, windowMonths);
  const guarded = guardPlacementBookings(bookings);
  const findings = guarded.ok ? guarded.warnings : guarded.findings;

  return [...placements]
    .sort((a, b) => a.code.localeCompare(b.code) || a.id.localeCompare(b.id))
    .map((placement): InventoryRow => {
      const states = months.map(m => stateAt(bookings, placement.id, m));
      const freeIndex = states.findIndex(s => s === 'free');
      return {
        placement,
        advertiser: currentAdvertiser(bookings, placement.id, todayIso),
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
