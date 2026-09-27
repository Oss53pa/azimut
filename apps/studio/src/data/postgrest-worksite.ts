/**
 * H6 — lecture du chantier par l'API REST : lots de fabrication, créneaux de
 * pose, réserves de pose (migration 0042).
 *
 * Les tables de liaison se replient sur leur lot ou leur créneau : l'écran lit
 * des `support_ids`, jamais un compte stocké. Une valeur hors liste ne peut
 * venir que d'un schéma qui a dérivé ; la lecture échoue alors, plutôt que
 * d'écarter la ligne en silence.
 */
import {
  isFabricationLotState,
  type WorksiteRegistry, type FabricationLot, type InstallSlot, type RecordedReserve,
} from '@azimut/core-model';
import { RepositoryError } from './site-repository.js';
import { query, queryIn, type PostgrestConfig } from './postgrest-http.js';

type LotRow = { readonly id: string; readonly code: string; readonly manufacturer_name: string; readonly state: string };
type SlotRow = { readonly id: string; readonly zone_label: string; readonly planned_on: string | null; readonly night_work: boolean };
type LotSupportRow = { readonly lot_id: string; readonly support_id: string };
type SlotSupportRow = { readonly slot_id: string; readonly support_id: string };
type ReserveRow = {
  readonly id: string;
  readonly support_id: string;
  readonly lot_id: string;
  readonly observation_key: string;
  readonly observed_by: string;
  readonly observed_at: string;
  readonly lifted_at: string | null;
  readonly photo_path: string | null;
};

function drift(table: string, detail: string): RepositoryError {
  return new RepositoryError('request_failed', `${table}: ${detail}`);
}

function supportsBy<K extends string>(rows: readonly (Readonly<Record<K, string>> & { readonly support_id: string })[], key: K): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const row of rows) {
    const owner = row[key];
    const bucket = out.get(owner);
    if (bucket === undefined) out.set(owner, [row.support_id]);
    else bucket.push(row.support_id);
  }
  for (const ids of out.values()) ids.sort();
  return out;
}

export async function loadWorksiteRegistry(
  config: PostgrestConfig,
  siteId: string,
): Promise<WorksiteRegistry> {
  // Le site d'abord : un site masqué par le cloisonnement doit se lire
  // « inaccessible », pas « aucun chantier ».
  const sites = await query<{ readonly id: string }>(config, 'site', `select=id&id=eq.${siteId}`);
  if (sites.length === 0) throw new RepositoryError('not_found', `site: ${siteId}`);

  const [lotRows, slotRows] = await Promise.all([
    query<LotRow>(config, 'fabrication_lot', `select=id,code,manufacturer_name,state&site_id=eq.${siteId}`),
    query<SlotRow>(config, 'install_slot', `select=id,zone_label,planned_on,night_work&site_id=eq.${siteId}`),
  ]);
  const lotIds = lotRows.map(l => l.id);
  const [lotSupports, slotSupports, reserveRows] = await Promise.all([
    queryIn<LotSupportRow>(config, 'lot_support', 'lot_id', lotIds),
    queryIn<SlotSupportRow>(config, 'slot_support', 'slot_id', slotRows.map(s => s.id)),
    queryIn<ReserveRow>(config, 'install_reserve', 'lot_id', lotIds),
  ]);

  const byLot = supportsBy(lotSupports, 'lot_id');
  const bySlot = supportsBy(slotSupports, 'slot_id');

  const lots = lotRows
    .map((r): FabricationLot => {
      if (!isFabricationLotState(r.state)) throw drift('fabrication_lot', `state « ${r.state} »`);
      return {
        id: r.id, code: r.code, manufacturer_name: r.manufacturer_name, state: r.state,
        support_ids: byLot.get(r.id) ?? [],
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code) || a.id.localeCompare(b.id));

  const slots = slotRows
    .map((r): InstallSlot => ({
      id: r.id, zone_label: r.zone_label, planned_on: r.planned_on, night_work: r.night_work,
      support_ids: bySlot.get(r.id) ?? [],
    }))
    .sort((a, b) => (a.planned_on ?? '9999').localeCompare(b.planned_on ?? '9999') || a.id.localeCompare(b.id));

  const reserves = reserveRows
    .map((r): RecordedReserve => ({
      id: r.id, support_id: r.support_id, lot_id: r.lot_id, observation_key: r.observation_key,
      observed_by: r.observed_by, observed_at: r.observed_at, lifted_at: r.lifted_at, photo_path: r.photo_path,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return { lots, slots, reserves };
}
