/**
 * H8 — lecture du budget par l'API REST : coûts de référence de
 * l'organisation, lignes budgétaires du site (migration 0043).
 *
 * Un montant se lit en entier d'unité mineure avec sa devise. Un entier que
 * JavaScript ne représente pas exactement, ou une devise mal formée, fait
 * échouer la lecture : un montant approché ne s'affiche pas comme exact.
 */
import type { BudgetRegistry, BudgetLine, CostReference, Money } from '@azimut/core-model';
import { RepositoryError } from './site-repository.js';
import { query, type PostgrestConfig } from './postgrest-http.js';

type CostRow = {
  readonly id: string;
  readonly typology_key: string;
  readonly substrate_key: string;
  readonly manufacturer_name: string | null;
  readonly unit_cost_minor: number | string | null;
  readonly currency: string | null;
  readonly since: string | null;
};
type LineRow = {
  readonly id: string;
  readonly phase_key: string;
  readonly lot_id: string | null;
  readonly estimated_minor: number | string | null;
  readonly quoted_minor: number | string | null;
  readonly actual_minor: number | string | null;
  readonly currency: string;
};

function drift(table: string, detail: string): RepositoryError {
  return new RepositoryError('request_failed', `${table}: ${detail}`);
}

function money(table: string, minor: number | string | null, currency: string | null): Money | null {
  if (minor === null) return null;
  const value = Number(minor);
  if (!Number.isSafeInteger(value)) throw drift(table, `montant « ${String(minor)} » non représentable exactement`);
  if (currency === null || !/^[A-Z]{3}$/.test(currency)) throw drift(table, `devise « ${String(currency)} »`);
  return { minor: value, currency };
}

export async function loadBudgetRegistry(config: PostgrestConfig, siteId: string): Promise<BudgetRegistry> {
  // Le site d'abord ; son organisation porte les coûts de référence.
  const sites = await query<{ readonly id: string; readonly org_id: string }>(
    config, 'site', `select=id,org_id&id=eq.${siteId}`,
  );
  const site = sites[0];
  if (site === undefined) throw new RepositoryError('not_found', `site: ${siteId}`);

  const [costRows, lineRows] = await Promise.all([
    query<CostRow>(
      config, 'cost_reference',
      `select=id,typology_key,substrate_key,manufacturer_name,unit_cost_minor,currency,since&org_id=eq.${site.org_id}`,
    ),
    query<LineRow>(
      config, 'budget_line',
      `select=id,phase_key,lot_id,estimated_minor,quoted_minor,actual_minor,currency&site_id=eq.${siteId}`,
    ),
  ]);

  const cost_references = costRows
    .map((r): CostReference => ({
      id: r.id,
      typology_key: r.typology_key,
      substrate_key: r.substrate_key,
      manufacturer_name: r.manufacturer_name,
      unit_cost: money('cost_reference', r.unit_cost_minor, r.currency),
      since: r.since,
    }))
    .sort((a, b) => a.typology_key.localeCompare(b.typology_key) || a.substrate_key.localeCompare(b.substrate_key) || a.id.localeCompare(b.id));

  const budget_lines = lineRows
    .map((r): BudgetLine => ({
      id: r.id,
      phase_key: r.phase_key,
      lot_id: r.lot_id,
      estimated: money('budget_line', r.estimated_minor, r.currency),
      quoted: money('budget_line', r.quoted_minor, r.currency),
      actual: money('budget_line', r.actual_minor, r.currency),
    }))
    .sort((a, b) => a.phase_key.localeCompare(b.phase_key) || a.id.localeCompare(b.id));

  return { cost_references, budget_lines };
}
