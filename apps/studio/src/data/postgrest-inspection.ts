/**
 * I5.6 — lecture des tournées d'inspection par l'API REST : tournées du site
 * et constats faits pendant elles (migration 0044).
 *
 * Une valeur hors liste ne peut venir que d'un schéma qui a dérivé ; la
 * lecture échoue alors, plutôt que d'écarter la ligne en silence.
 */
import {
  isInspectionSyncState, isInspectionSeverity,
  type InspectionRegistry, type InspectionRound, type InspectionFinding,
} from '@azimut/core-model';
import { RepositoryError } from './site-repository.js';
import { query, queryIn, type PostgrestConfig } from './postgrest-http.js';

type RoundRow = {
  readonly id: string;
  readonly zone_label: string;
  readonly surveyor_id: string | null;
  readonly surveyed_on: string | null;
  readonly sync_state: string;
};
type FindingRow = {
  readonly id: string;
  readonly round_id: string;
  readonly support_id: string;
  readonly nature_key: string;
  readonly severity: string;
  readonly photo_path: string | null;
};

function drift(table: string, detail: string): RepositoryError {
  return new RepositoryError('request_failed', `${table}: ${detail}`);
}

export async function loadInspectionRegistry(config: PostgrestConfig, siteId: string): Promise<InspectionRegistry> {
  // Le site d'abord : un site masqué par le cloisonnement doit se lire
  // « inaccessible », pas « aucune tournée ».
  const sites = await query<{ readonly id: string }>(config, 'site', `select=id&id=eq.${siteId}`);
  if (sites.length === 0) throw new RepositoryError('not_found', `site: ${siteId}`);

  const roundRows = await query<RoundRow>(
    config, 'inspection_round', `select=id,zone_label,surveyor_id,surveyed_on,sync_state&site_id=eq.${siteId}`,
  );
  const findingRows = await queryIn<FindingRow>(config, 'inspection_finding', 'round_id', roundRows.map(r => r.id));

  const rounds = roundRows
    .map((r): InspectionRound => {
      if (!isInspectionSyncState(r.sync_state)) throw drift('inspection_round', `sync_state « ${r.sync_state} »`);
      return { id: r.id, zone_label: r.zone_label, surveyor_id: r.surveyor_id, surveyed_on: r.surveyed_on, sync_state: r.sync_state };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const findings = findingRows
    .map((r): InspectionFinding => {
      if (!isInspectionSeverity(r.severity)) throw drift('inspection_finding', `severity « ${r.severity} »`);
      return {
        id: r.id, round_id: r.round_id, support_id: r.support_id, nature_key: r.nature_key,
        severity: r.severity, photo_path: r.photo_path,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  return { rounds, findings };
}
