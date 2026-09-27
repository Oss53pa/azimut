/**
 * H5.2 — le dossier d'enseigne tel que les écrans le lisent : ce que la base
 * porte, complété par l'annuaire du site et par la version du règlement en
 * vigueur au dépôt.
 *
 * Le locataire et le code de cellule ne sont pas stockés sur le dossier : ils
 * se lisent sur sa destination. Une destination introuvable se dit, elle ne
 * s'invente pas.
 */
import {
  regulationInForce,
  type SiteData, type TenantDossierState, type TenantRegistry, type TenantSignRegulation,
} from '@azimut/core-model';
import type { SignProject } from '../../domain/tenant-regulation.js';

export type SignDossier = {
  readonly id: string;
  readonly destination_id: string;
  /** Code de la cellule, ou `null` si la destination ou son code manque. */
  readonly cell_code: string | null;
  /** Le locataire, ou `null` si la destination manque. */
  readonly tenant: string | null;
  readonly state: TenantDossierState;
  readonly submitted_on: string;
  readonly project: SignProject;
  readonly parts: readonly { readonly key: string; readonly provided: boolean }[];
  /** La version du règlement en vigueur au dépôt, ou `null` s'il n'y en avait pas. */
  readonly regulation: TenantSignRegulation | null;
};

export function signDossiers(site: SiteData, registry: TenantRegistry): readonly SignDossier[] {
  const destinations = new Map(site.destinations.map(d => [d.id, d]));
  const footprints = new Map(site.footprints.map(f => [f.id, f]));
  return registry.dossiers.map((d): SignDossier => {
    const destination = destinations.get(d.destination_id);
    const footprint = destination === undefined ? undefined : footprints.get(destination.footprint_id);
    return {
      id: d.id,
      destination_id: d.destination_id,
      cell_code: footprint?.unit_code ?? null,
      tenant: destination?.occupant_name ?? null,
      state: d.state,
      submitted_on: d.submitted_on,
      project: {
        id: d.id, height_mm: d.height_mm, overhang_mm: d.overhang_mm,
        material: d.material, lighting: d.lighting, features: d.features,
      },
      parts: d.parts.map(p => ({ key: p.key, provided: p.provided })),
      regulation: regulationInForce(registry.regulations, d.submitted_on),
    };
  });
}
