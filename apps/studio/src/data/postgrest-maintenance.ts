/**
 * A5.7 — lecture du parc posé par l'API REST : supports posés, divergences
 * enregistrées, ordres de travaux (migrations 0006 et 0041).
 *
 * Une divergence désigne un support du site, ou le nœud d'un point non
 * couvert : elle se lit par l'un et par l'autre. Le coût estimé est lu tel que
 * la base le porte, sans conversion. Une valeur hors liste ne peut
 * venir que d'un schéma qui a dérivé ; la lecture échoue alors, plutôt que
 * d'écarter la ligne en silence.
 */
import {
  isDivergenceKind, isWorkOrderState,
  type MaintenanceRegistry, type InstalledSupport, type RecordedDivergence, type WorkOrder,
} from '@azimut/core-model';
import { RepositoryError } from './site-repository.js';
import { query, queryIn, type PostgrestConfig } from './postgrest-http.js';

type InstalledRow = {
  readonly id: string;
  readonly support_id: string;
  readonly installed_at: string;
  readonly photo_path: string | null;
  readonly installer_notes: string | null;
};
type DivergenceRow = {
  readonly id: string;
  readonly support_id: string | null;
  readonly node_id: string | null;
  readonly installed_support_id: string | null;
  readonly kind: string;
  readonly detected_at: string;
  readonly resolved_at: string | null;
  readonly detail: unknown;
};
type WorkOrderRow = {
  readonly id: string;
  readonly scope: unknown;
  readonly estimated_cost: number | string | null;
  readonly currency: string;
  readonly state: string;
  readonly created_at: string;
  readonly closed_at: string | null;
};

function drift(table: string, detail: string): RepositoryError {
  return new RepositoryError('request_failed', `${table}: ${detail}`);
}

/**
 * Le coût tel que la base le rend, en texte décimal. PostgREST rend un
 * `numeric` en nombre JSON : sa forme décimale est gardée telle quelle, sans
 * arrondi ni conversion d'unité.
 */
function detailOf(value: unknown): Readonly<Record<string, unknown>> | null {
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw drift('divergence', 'detail n’est pas un objet JSON');
  return value as Readonly<Record<string, unknown>>;
}

function decimalText(value: number | string | null): string | null {
  if (value === null) return null;
  const text = String(value);
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw drift('work_order', `estimated_cost « ${text} »`);
  return text;
}

export async function loadMaintenanceRegistry(
  config: PostgrestConfig,
  siteId: string,
): Promise<MaintenanceRegistry> {
  // Le site d'abord : un site masqué par le cloisonnement doit se lire
  // « inaccessible », pas « rien n'est posé ».
  const sites = await query<{ readonly id: string }>(config, 'site', `select=id&id=eq.${siteId}`);
  if (sites.length === 0) throw new RepositoryError('not_found', `site: ${siteId}`);

  const [supports, orderRows] = await Promise.all([
    query<{ readonly id: string }>(config, 'support', `select=id&site_id=eq.${siteId}`),
    query<WorkOrderRow>(
      config, 'work_order',
      `select=id,scope,estimated_cost,currency,state,created_at,closed_at&site_id=eq.${siteId}`,
    ),
  ]);
  const buildings = await query<{ readonly id: string }>(config, 'building', `select=id&site_id=eq.${siteId}`);
  const levels = await queryIn<{ readonly id: string }>(config, 'level', 'building_id', buildings.map(b => b.id));
  const supportIds = supports.map(s => s.id);
  const [installedRows, nodes, bySupport] = await Promise.all([
    queryIn<InstalledRow>(config, 'installed_support', 'support_id', supportIds),
    queryIn<{ readonly id: string }>(config, 'node', 'level_id', levels.map(l => l.id)),
    queryIn<DivergenceRow>(config, 'divergence', 'support_id', supportIds),
  ]);
  // Un point non couvert n'a que son nœud : il se lit par là. Une ligne qui
  // porte support et nœud revient par les deux lectures ; elle n'est gardée
  // qu'une fois.
  const byNode = await queryIn<DivergenceRow>(config, 'divergence', 'node_id', nodes.map(n => n.id));
  const divergenceRows = [...new Map([...bySupport, ...byNode].map(r => [r.id, r])).values()];

  const installed = installedRows
    .map((r): InstalledSupport => ({
      id: r.id,
      support_id: r.support_id,
      installed_at: r.installed_at,
      photo_path: r.photo_path,
      installer_notes: r.installer_notes,
    }))
    .sort((a, b) => a.support_id.localeCompare(b.support_id) || a.installed_at.localeCompare(b.installed_at) || a.id.localeCompare(b.id));

  const divergences = divergenceRows
    .map((r): RecordedDivergence => {
      if (!isDivergenceKind(r.kind)) throw drift('divergence', `kind « ${r.kind} »`);
      return {
        id: r.id,
        support_id: r.support_id,
        node_id: r.node_id,
        installed_support_id: r.installed_support_id,
        kind: r.kind,
        detected_at: r.detected_at,
        resolved_at: r.resolved_at,
        detail: detailOf(r.detail),
      };
    })
    .sort((a, b) => b.detected_at.localeCompare(a.detected_at) || a.id.localeCompare(b.id));

  const work_orders = orderRows
    .map((r): WorkOrder => {
      if (!isWorkOrderState(r.state)) throw drift('work_order', `state « ${r.state} »`);
      return {
        id: r.id,
        scope: r.scope,
        estimated_cost: decimalText(r.estimated_cost),
        currency: r.currency,
        state: r.state,
        created_at: r.created_at,
        closed_at: r.closed_at,
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));

  return { installed, divergences, work_orders };
}
