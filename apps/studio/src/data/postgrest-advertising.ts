/**
 * H4 — lecture de la régie par l'API REST : emplacements du site, leurs
 * réservations, options et visuels enregistrés (migration 0045).
 *
 * Une valeur hors liste ne peut venir que d'un schéma qui a dérivé ; la
 * lecture échoue alors, plutôt que d'écarter la ligne en silence. Un
 * emplacement retiré (`deleted_at`) n'est pas lu.
 */
import {
  EMPTY_AD_REGISTRY, isAdBookingState, isAdSanitationState, isAdCreativeVerdict,
  type AdPlacement, type AdBooking, type AdOption, type AdCreative,
} from '@azimut/core-model';
import { RepositoryError } from './site-repository.js';
import { query, queryIn, type PostgrestConfig } from './postgrest-http.js';
import type { AdvertisingData } from './advertising-data.js';

type PlacementRow = {
  readonly id: string; readonly code: string; readonly level_id: string; readonly node_id: string | null;
  readonly typology_key: string; readonly area_m2: number | string;
};
type BookingRow = {
  readonly id: string; readonly placement_id: string; readonly state: string;
  readonly from_date: string; readonly to_date: string; readonly advertiser_name: string | null;
};
type OptionRow = { readonly id: string; readonly placement_id: string; readonly expires_at: string };
type CreativeRow = {
  readonly id: string; readonly placement_id: string; readonly format: string;
  readonly resolution_dpi: number; readonly safe_zone_mm: number; readonly color_profile: string;
  readonly weight_bytes: number | string; readonly storage_path: string | null;
  readonly sanitation: string; readonly verdict: string; readonly received_at: string;
};

function drift(table: string, detail: string): RepositoryError {
  return new RepositoryError('request_failed', `${table}: ${detail}`);
}

function finite(table: string, column: string, value: number | string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw drift(table, `${column} « ${String(value)} »`);
  return n;
}

export async function loadAdvertisingData(config: PostgrestConfig, siteId: string): Promise<AdvertisingData> {
  // Le site d'abord : un site masqué par le cloisonnement doit se lire
  // « inaccessible », pas « aucun emplacement ».
  const sites = await query<{ readonly id: string }>(config, 'site', `select=id&id=eq.${siteId}`);
  if (sites.length === 0) throw new RepositoryError('not_found', `site: ${siteId}`);

  const placementRows = await query<PlacementRow>(
    config, 'ad_placement',
    `select=id,code,level_id,node_id,typology_key,area_m2&site_id=eq.${siteId}&deleted_at=is.null`,
  );
  const ids = placementRows.map(p => p.id);
  const [bookingRows, optionRows, creativeRows] = await Promise.all([
    queryIn<BookingRow>(config, 'ad_booking', 'placement_id', ids),
    queryIn<OptionRow>(config, 'ad_option', 'placement_id', ids),
    queryIn<CreativeRow>(config, 'ad_creative', 'placement_id', ids),
  ]);

  const placements = placementRows
    .map((r): AdPlacement => ({
      id: r.id, code: r.code, level_id: r.level_id, node_id: r.node_id, typology_key: r.typology_key,
      area_m2: finite('ad_placement', 'area_m2', r.area_m2),
    }))
    .sort((a, b) => a.code.localeCompare(b.code) || a.id.localeCompare(b.id));

  const bookings = bookingRows
    .map((r): AdBooking => {
      if (!isAdBookingState(r.state)) throw drift('ad_booking', `state « ${r.state} »`);
      return {
        id: r.id, placement_id: r.placement_id, state: r.state, from_date: r.from_date, to_date: r.to_date,
        advertiser_name: r.advertiser_name,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const options = optionRows
    .map((r): AdOption => ({ id: r.id, placement_id: r.placement_id, expires_at: r.expires_at }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const creatives = creativeRows
    .map((r): AdCreative => {
      if (!isAdSanitationState(r.sanitation)) throw drift('ad_creative', `sanitation « ${r.sanitation} »`);
      if (!isAdCreativeVerdict(r.verdict)) throw drift('ad_creative', `verdict « ${r.verdict} »`);
      return {
        id: r.id, placement_id: r.placement_id, format: r.format, resolution_dpi: r.resolution_dpi,
        safe_zone_mm: r.safe_zone_mm, color_profile: r.color_profile,
        weight_bytes: finite('ad_creative', 'weight_bytes', r.weight_bytes),
        storage_path: r.storage_path, sanitation: r.sanitation, verdict: r.verdict, received_at: r.received_at,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    registry: { ...EMPTY_AD_REGISTRY, placements, bookings, options, creatives },
    // Aucun canal de dépôt côté base : rien n'attend en réception.
    reception: [],
    // Aucun générateur de fiche technique (H4.2) : la conformité n'est pas contrôlée.
    creative_spec: null,
  };
}
