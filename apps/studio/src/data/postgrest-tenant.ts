/**
 * H5 — lecture des enseignes locataires par l'API REST : versions du
 * règlement d'enseigne, dossiers du site et leurs pièces (migration 0046).
 *
 * Une valeur hors liste, ou une liste JSON qui n'est pas une liste de
 * chaînes, ne peut venir que d'un schéma qui a dérivé : la lecture échoue
 * alors, plutôt que d'écarter la ligne en silence.
 */
import {
  isTenantDossierState,
  type TenantRegistry, type TenantSignRegulation, type TenantSignDossier, type TenantSignPart,
} from '@azimut/core-model';
import { RepositoryError } from './site-repository.js';
import { query, queryIn, type PostgrestConfig } from './postgrest-http.js';

type RegulationRow = {
  readonly id: string; readonly effective_from: string;
  readonly max_height_mm: number | null; readonly max_overhang_mm: number | null;
  readonly allowed_materials: unknown; readonly allowed_lighting: unknown; readonly forbidden_features: unknown;
};
type DossierRow = {
  readonly id: string; readonly destination_id: string; readonly state: string; readonly submitted_on: string;
  readonly height_mm: number; readonly overhang_mm: number; readonly material: string; readonly lighting: string;
  readonly features: unknown;
};
type PartRow = { readonly dossier_id: string; readonly key: string; readonly provided: boolean; readonly storage_path: string | null };

function drift(table: string, detail: string): RepositoryError {
  return new RepositoryError('request_failed', `${table}: ${detail}`);
}

function strings(table: string, column: string, value: unknown): readonly string[] {
  if (!Array.isArray(value) || !value.every((v): v is string => typeof v === 'string')) {
    throw drift(table, `${column} n’est pas une liste de chaînes`);
  }
  return [...value];
}

export async function loadTenantRegistry(config: PostgrestConfig, siteId: string): Promise<TenantRegistry> {
  // Le site d'abord : un site masqué par le cloisonnement doit se lire
  // « inaccessible », pas « aucun dossier ».
  const sites = await query<{ readonly id: string }>(config, 'site', `select=id&id=eq.${siteId}`);
  if (sites.length === 0) throw new RepositoryError('not_found', `site: ${siteId}`);

  const [regulationRows, dossierRows] = await Promise.all([
    query<RegulationRow>(
      config, 'tenant_sign_regulation',
      `select=id,effective_from,max_height_mm,max_overhang_mm,allowed_materials,allowed_lighting,forbidden_features&site_id=eq.${siteId}`,
    ),
    query<DossierRow>(
      config, 'tenant_sign_dossier',
      `select=id,destination_id,state,submitted_on,height_mm,overhang_mm,material,lighting,features&site_id=eq.${siteId}`,
    ),
  ]);
  const partRows = await queryIn<PartRow>(config, 'tenant_sign_part', 'dossier_id', dossierRows.map(d => d.id));

  const partsBy = new Map<string, TenantSignPart[]>();
  for (const p of partRows) {
    const part: TenantSignPart = { key: p.key, provided: p.provided, storage_path: p.storage_path };
    const bucket = partsBy.get(p.dossier_id);
    if (bucket === undefined) partsBy.set(p.dossier_id, [part]);
    else bucket.push(part);
  }

  const T = 'tenant_sign_regulation';
  const regulations = regulationRows
    .map((r): TenantSignRegulation => ({
      id: r.id,
      effective_from: r.effective_from,
      max_height_mm: r.max_height_mm,
      max_overhang_mm: r.max_overhang_mm,
      allowed_materials: strings(T, 'allowed_materials', r.allowed_materials),
      allowed_lighting: strings(T, 'allowed_lighting', r.allowed_lighting),
      forbidden_features: strings(T, 'forbidden_features', r.forbidden_features),
    }))
    .sort((a, b) => a.effective_from.localeCompare(b.effective_from) || a.id.localeCompare(b.id));

  const dossiers = dossierRows
    .map((r): TenantSignDossier => {
      if (!isTenantDossierState(r.state)) throw drift('tenant_sign_dossier', `state « ${r.state} »`);
      return {
        id: r.id, destination_id: r.destination_id, state: r.state, submitted_on: r.submitted_on,
        height_mm: r.height_mm, overhang_mm: r.overhang_mm, material: r.material, lighting: r.lighting,
        features: strings('tenant_sign_dossier', 'features', r.features),
        parts: [...(partsBy.get(r.id) ?? [])].sort((a, b) => a.key.localeCompare(b.key)),
      };
    })
    .sort((a, b) => a.submitted_on.localeCompare(b.submitted_on) || a.id.localeCompare(b.id));

  return { regulations, dossiers };
}
