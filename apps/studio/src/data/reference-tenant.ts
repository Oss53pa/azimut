/**
 * Jeu de démonstration du module 06, servi par le dépôt de référence.
 *
 * Données synthétiques : aucun locataire ni projet réel. Il tient la place des
 * tables de 0046 quand aucune base n'est configurée, et l'écran le dit. Les
 * dossiers se rattachent aux destinations du site de référence ouvert, comme
 * un dossier réel à sa cellule : le locataire et le code de cellule se lisent
 * dans son annuaire. Un site sans destination n'a donc pas de dossier.
 */
import type { SiteData, TenantRegistry, TenantSignDossier } from '@azimut/core-model';

type DemoProject = Omit<TenantSignDossier, 'destination_id'>;

const PROJECTS: readonly DemoProject[] = [
  {
    id: 'ts-0118', state: 'instructing', submitted_on: '2026-09-11',
    height_mm: 1120, overhang_mm: 95, material: 'plexiglas', lighting: 'retro_eclaire', features: ['neon_nu'],
    parts: [
      { key: 'elevation', provided: true, storage_path: null },
      { key: 'material_samples', provided: false, storage_path: null },
      { key: 'section', provided: true, storage_path: null },
    ],
  },
  {
    id: 'ts-0031', state: 'approved', submitted_on: '2026-09-08',
    height_mm: 740, overhang_mm: 80, material: 'laiton', lighting: 'indirect', features: [],
    parts: [
      { key: 'elevation', provided: true, storage_path: null },
      { key: 'material_samples', provided: true, storage_path: null },
      { key: 'section', provided: true, storage_path: null },
    ],
  },
  {
    id: 'ts-0009', state: 'submitted', submitted_on: '2026-09-14',
    height_mm: 880, overhang_mm: 140, material: 'bois', lighting: 'retro_eclaire', features: [],
    parts: [
      { key: 'elevation', provided: true, storage_path: null },
      { key: 'material_samples', provided: true, storage_path: null },
      { key: 'section', provided: false, storage_path: null },
    ],
  },
];

export function referenceTenant(site: SiteData): TenantRegistry {
  const destinations = [...site.destinations].sort((a, b) => a.id.localeCompare(b.id));
  const dossiers = PROJECTS.flatMap((project, i): TenantSignDossier[] => {
    const destination = destinations[i];
    return destination === undefined ? [] : [{ ...project, destination_id: destination.id }];
  });
  return {
    regulations: [{
      id: 'reg-2026',
      effective_from: '2026-01-01',
      max_height_mm: 900,
      max_overhang_mm: 120,
      allowed_materials: ['acier', 'bois', 'laiton'],
      allowed_lighting: ['indirect', 'retro_eclaire'],
      forbidden_features: ['clignotement', 'neon_nu'],
    }],
    dossiers,
  };
}
