/**
 * H4.3 — lecture du planning d'occupation.
 *
 * Les états proviennent des contrats ; cette fonction ne fait que les projeter
 * sur une grille de mois. Un emplacement sans contrat sur un mois est libre,
 * ce qui n'est pas la même chose qu'inconnu.
 */
import type { BookingState, PlacementBooking } from '../../domain/ad-planning.js';

export type MonthKey = string;

/** `count` mois consécutifs à partir de `startIso` (« AAAA-MM-JJ »). */
export function monthsFrom(startIso: string, count: number): readonly MonthKey[] {
  const year = Number(startIso.slice(0, 4));
  const month = Number(startIso.slice(5, 7));
  const out: MonthKey[] = [];
  for (let i = 0; i < count; i++) {
    const total = month - 1 + i;
    const y = year + Math.floor(total / 12);
    const m = (total % 12) + 1;
    out.push(`${String(y)}-${m < 10 ? '0' : ''}${String(m)}`);
  }
  return out;
}

/** Ordre de priorité d'affichage quand plusieurs contrats couvrent un mois. */
const PRIORITY: readonly BookingState[] = [
  'occupied', 'reserved', 'maintenance', 'option', 'retired', 'free',
];

/** État d'un emplacement sur un mois donné. */
export function stateAt(
  bookings: readonly PlacementBooking[],
  placementId: string,
  month: MonthKey,
): BookingState {
  const covering = bookings.filter(
    b => b.placement_id === placementId
      && b.from_date.slice(0, 7) <= month
      && b.to_date.slice(0, 7) >= month,
  );
  for (const state of PRIORITY) {
    if (covering.some(b => b.state === state)) return state;
  }
  return 'free';
}

/** Part des emplacements tenus fermement sur le mois, en pour-cent entier. */
export function occupancyRate(
  bookings: readonly PlacementBooking[],
  placementIds: readonly string[],
  month: MonthKey,
): number {
  if (placementIds.length === 0) return 0;
  const held = placementIds.filter(id => {
    const state = stateAt(bookings, id, month);
    return state === 'occupied' || state === 'reserved';
  }).length;
  return Math.round((held / placementIds.length) * 100);
}
