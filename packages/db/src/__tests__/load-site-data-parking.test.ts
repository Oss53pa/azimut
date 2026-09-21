/**
 * Stationnement lu depuis la base — complément atelier, M2.
 *
 * Séparé des essais de `loadSiteData` sur le socle : les deux réunis
 * franchissaient les quatre cents lignes (A2.4). Le `stubDb` qu'ils partagent
 * a suivi, dans son propre module, plutôt que d'être recopié.
 */
import { describe, it, expect } from 'vitest';
import { loadSiteData } from '../load-site-data.js';
import { stubDb } from './stub-db.js';
import { organization } from '../schema/org.js';
import {
  site, building, level,
  parking, parkingSpace, parkingUncoveredArea, vehicleGate,
} from '../schema/site.js';

describe('stationnement (complément atelier M2)', () => {
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

  it('rend des listes vides quand le site n’a pas de stationnement', async () => {
    const result = await loadSiteData(stubDb(baseTables()), 'org-1', 'site-1');
    expect(result.parkings).toEqual([]);
    expect(result.parking_spaces).toEqual([]);
    expect(result.vehicle_gates).toEqual([]);
  });

  it('charge un parking, ses places, sa zone non couverte et un portail', async () => {
    const byTable = baseTables();
    byTable.set(parking, [{
      id: 'park-1', org_id: 'org-1', level_id: 'l-1',
      geometry: { vertices: [{ x_m: 0, y_m: 0 }] },
      name: 'Ouest', free: true, declared_capacity: 4,
      status: 'existant', source: 'Plan RDC',
    }]);
    byTable.set(parkingSpace, [{
      id: 'sp-1', org_id: 'org-1', parking_id: 'park-1', kind: 'pmr',
      row_label: 'A', status: 'existant', source: 'Plan RDC',
    }]);
    byTable.set(parkingUncoveredArea, [{
      id: 'unc-1', org_id: 'org-1', parking_id: 'park-1', reason: 'Plan coupé',
    }]);
    byTable.set(vehicleGate, [{
      id: 'gate-1', org_id: 'org-1', level_id: 'l-1', code: 'V1',
      role: 'Entrée', width_m: '6', position: { x_m: 0, y_m: 0 },
      status: 'existant', source: 'Plan RDC',
    }]);

    const result = await loadSiteData(stubDb(byTable), 'org-1', 'site-1');
    expect(result.parkings[0]?.name).toBe('Ouest');
    expect(result.parkings[0]?.declared_capacity).toBe(4);
    expect(result.parking_spaces[0]?.kind).toBe('pmr');
    // `row_label` en base, `row` au modèle : la transposition est ici.
    expect(result.parking_spaces[0]?.row).toBe('A');
    expect(result.parking_uncovered[0]?.reason).toBe('Plan coupé');
    expect(result.vehicle_gates[0]?.width_m).toBe(6);
  });

  it('ne lit jamais un statut inconnu comme existant', async () => {
    // `existant` est le seul statut qui publie (P1, complément atelier). Une valeur mal
    // orthographiée doit retenir l'objet, pas le laisser passer.
    const byTable = baseTables();
    byTable.set(parking, [{
      id: 'park-1', org_id: 'org-1', level_id: 'l-1',
      geometry: { vertices: [] }, name: 'Ouest', free: true, declared_capacity: 0,
      status: 'Existant', source: 'Plan RDC',
    }]);

    const result = await loadSiteData(stubDb(byTable), 'org-1', 'site-1');
    expect(result.parkings[0]?.provenance.status).toBe('a_verifier');
  });

  it('retombe sur une place standard pour une nature inconnue', async () => {
    const byTable = baseTables();
    byTable.set(parking, [{
      id: 'park-1', org_id: 'org-1', level_id: 'l-1',
      geometry: { vertices: [] }, name: 'Ouest', free: true, declared_capacity: 1,
      status: 'existant', source: 'Plan RDC',
    }]);
    byTable.set(parkingSpace, [{
      id: 'sp-1', org_id: 'org-1', parking_id: 'park-1', kind: 'inconnue',
      row_label: 'A', status: 'existant', source: 'Plan RDC',
    }]);

    const result = await loadSiteData(stubDb(byTable), 'org-1', 'site-1');
    expect(result.parking_spaces[0]?.kind).toBe('standard');
  });
});

describe('zone non couverte : tracé facultatif (M2)', () => {
  const tables = (): Map<object, unknown[]> => new Map<object, unknown[]>([
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
    [parking, [{
      id: 'park-1', org_id: 'org-1', level_id: 'l-1',
      geometry: { vertices: [] }, name: 'Ouest', free: true, declared_capacity: 0,
      status: 'existant', source: 'Plan',
    }]],
  ]);

  it('charge une zone sans tracé : on sait que le relevé s’arrête, pas où', async () => {
    const byTable = tables();
    byTable.set(parkingUncoveredArea, [{
      id: 'unc-1', org_id: 'org-1', parking_id: 'park-1',
      geometry: null, reason: 'Relevé incomplet',
    }]);
    const result = await loadSiteData(stubDb(byTable), 'org-1', 'site-1');
    expect(result.parking_uncovered[0]?.reason).toBe('Relevé incomplet');
    expect(result.parking_uncovered[0]?.geometry).toBeUndefined();
  });

  it('charge le tracé quand il existe', async () => {
    const byTable = tables();
    byTable.set(parkingUncoveredArea, [{
      id: 'unc-1', org_id: 'org-1', parking_id: 'park-1',
      geometry: { vertices: [{ x_m: 0, y_m: 0 }] }, reason: 'Bord de page',
    }]);
    const result = await loadSiteData(stubDb(byTable), 'org-1', 'site-1');
    expect(result.parking_uncovered[0]?.geometry?.vertices).toHaveLength(1);
  });
});
