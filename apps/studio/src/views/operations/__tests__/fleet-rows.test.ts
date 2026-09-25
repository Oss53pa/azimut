import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit/sites';
import type { MaintenanceRegistry } from '@azimut/core-model';
import { fleetRows, lastPose, recordedDivergenceRows, scopeText } from '../fleet-rows.js';

const [first] = refMultilevel.supports;
if (first === undefined) throw new Error('fixture without supports');

const registry: MaintenanceRegistry = {
  installed: [
    { id: 'i2', support_id: first.id, installed_at: '2026-05-01T00:00:00Z', photo_path: null, installer_notes: null },
    { id: 'i1', support_id: first.id, installed_at: '2026-02-01T00:00:00Z', photo_path: null, installer_notes: null },
    { id: 'ix', support_id: 'absent', installed_at: '2026-02-01T00:00:00Z', photo_path: null, installer_notes: null },
  ],
  divergences: [
    { id: 'd1', installed_support_id: 'i1', kind: 'damaged', detected_at: '2026-03-01T00:00:00Z', resolved_at: null, notes: null },
    { id: 'd2', installed_support_id: 'i2', kind: 'missing', detected_at: '2026-06-01T00:00:00Z', resolved_at: '2026-06-02T00:00:00Z', notes: null },
    { id: 'd3', installed_support_id: 'inconnue', kind: 'missing', detected_at: '2026-06-01T00:00:00Z', resolved_at: null, notes: null },
  ],
  work_orders: [],
};

describe('A5.7 — parc posé', () => {
  it('rend une ligne par support du site, poses triées, dernière pose en tête de lecture', () => {
    const rows = fleetRows(refMultilevel, registry);
    expect(rows).toHaveLength(refMultilevel.supports.length);
    const row = rows.find(r => r.support.id === first.id);
    expect(row?.poses.map(p => p.id)).toEqual(['i1', 'i2']);
    expect(row === undefined ? null : lastPose(row)?.id).toBe('i2');
  });

  it('rattache les divergences au support par leur pose, et ne compte que les ouvertes', () => {
    const row = fleetRows(refMultilevel, registry).find(r => r.support.id === first.id);
    expect(row?.divergences.map(d => d.id)).toEqual(['d1', 'd2']);
    expect(row?.openDivergences).toBe(1);
  });

  it('garde une divergence dont la pose n’est pas lue, sans support', () => {
    const rows = recordedDivergenceRows(registry);
    expect(rows.find(r => r.divergence.id === 'd3')?.supportId).toBeNull();
    expect(rows.find(r => r.divergence.id === 'd1')?.supportId).toBe(first.id);
  });

  it('cite la portée d’un ordre, clés triées', () => {
    expect(scopeText({ supports: ['a'], lot: 'L1' })).toBe('lot : L1 · supports : ["a"]');
    expect(scopeText(null)).toBe('');
  });
});
