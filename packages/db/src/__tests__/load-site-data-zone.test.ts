/**
 * Zones du socle lues depuis la base — A5.2, section S8.
 *
 * Séparé des essais de `loadSiteData` sur le reste du socle : les deux réunis
 * franchissaient les quatre cents lignes (A2.4). Le `stubDb` qu'ils partagent
 * a suivi, dans son propre module, plutôt que d'être recopié.
 *
 * Ce fichier éprouvait la lecture de quatre tables de stationnement que la
 * section S8 a retirées. Il éprouve désormais ce qui les remplace du côté de
 * la base : les zones, qui n'étaient pas chargées du tout — une zone ne portait
 * qu'un nom et une nature, et aucun moteur ne les lisait. `footprint_ids` et
 * S-35 changent cela, et un parking non chargé est un parking non contrôlé.
 */
import { describe, it, expect } from 'vitest';
import { loadSiteData } from '../load-site-data.js';
import { stubDb } from './stub-db.js';
import { organization } from '../schema/org.js';
import { site, building, level, zone } from '../schema/site.js';

describe('zones du socle', () => {
  const baseTables = (): Map<object, unknown[]> => new Map<object, unknown[]>([
    [organization, [{ id: 'org-1', name: 'Org', slug: 'org' }]],
    [site, [{
      id: 'site-1', org_id: 'org-1', name: 'Site', country_code: 'FR',
      rules_pack_id: null,
    }]],
    [building, [{
      id: 'b-1', org_id: 'org-1', site_id: 'site-1', name: 'B', independent_access: true,
    }]],
    [level, [{
      id: 'l-1', org_id: 'org-1', building_id: 'b-1', name: 'RDC', ordinal: 0,
      elevation_m: '0',
    }]],
  ]);

  function zoneRow(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: 'z-1', org_id: 'org-1', level_id: 'l-1', name: 'Parking Ouest',
      kind: 'parking', footprint_ids: ['fp-1', 'fp-2'],
      ...over,
    };
  }

  it('rend une liste vide quand le site ne déclare aucune zone', async () => {
    const result = await loadSiteData(stubDb(baseTables()), 'org-1', 'site-1');
    expect(result.zones).toEqual([]);
  });

  it('charge une zone de parking et les empreintes qu’elle déclare', async () => {
    const byTable = baseTables();
    byTable.set(zone, [zoneRow()]);
    const result = await loadSiteData(stubDb(byTable), 'org-1', 'site-1');
    expect(result.zones).toEqual([{
      id: 'z-1',
      org_id: 'org-1',
      level_id: 'l-1',
      name: 'Parking Ouest',
      kind: 'parking',
      footprint_ids: ['fp-1', 'fp-2'],
    }]);
  });

  it('ne lit jamais une nature inconnue comme un parking', async () => {
    // La nature commande les contrôles du domaine `PARK`. Retomber sur
    // `parking` inventerait un parking là où la base dit autre chose.
    const byTable = baseTables();
    byTable.set(zone, [zoneRow({ kind: 'stationnement' })]);
    const result = await loadSiteData(stubDb(byTable), 'org-1', 'site-1');
    expect(result.zones?.[0]?.kind).toBe('technical');
  });

  it('rend une liste vide plutôt qu’une liste tordue pour un contenu mal formé', async () => {
    // La base ne garantit que le type du contenant, `jsonb_typeof = 'array'`.
    // Sa forme se valide ici, comme pour `footprint.geometry`.
    const byTable = baseTables();
    byTable.set(zone, [zoneRow({ footprint_ids: { fp: 'fp-1' } })]);
    const result = await loadSiteData(stubDb(byTable), 'org-1', 'site-1');
    expect(result.zones?.[0]?.footprint_ids).toEqual([]);
  });

  it('charge les zones de toutes natures, non les seuls parkings', async () => {
    const byTable = baseTables();
    byTable.set(zone, [
      zoneRow(),
      zoneRow({ id: 'z-2', kind: 'commercial', name: 'Galerie', footprint_ids: [] }),
    ]);
    const result = await loadSiteData(stubDb(byTable), 'org-1', 'site-1');
    expect(result.zones?.map(z => z.kind)).toEqual(['parking', 'commercial']);
  });
});
