import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit/sites';
import type { MaintenanceRegistry } from '@azimut/core-model';
import { fleetRows, lastPose, recordedDivergenceRows, jsonText } from '../fleet-rows.js';

const [first] = refMultilevel.supports;
if (first === undefined) throw new Error('fixture without supports');

const registry: MaintenanceRegistry = {
  installed: [
    { id: 'i2', support_id: first.id, installed_at: '2026-05-01T00:00:00Z', photo_path: null, installer_notes: null },
    { id: 'i1', support_id: first.id, installed_at: '2026-02-01T00:00:00Z', photo_path: null, installer_notes: null },
    { id: 'ix', support_id: 'absent', installed_at: '2026-02-01T00:00:00Z', photo_path: null, installer_notes: null },
  ],
  divergences: [
    { id: 'd1', support_id: first.id, node_id: null, installed_support_id: 'i1', kind: 'damaged', detected_at: '2026-03-01T00:00:00Z', resolved_at: null, detail: { notes: 'Rayure' } },
    { id: 'd2', support_id: first.id, node_id: null, installed_support_id: null, kind: 'missing', detected_at: '2026-06-01T00:00:00Z', resolved_at: '2026-06-02T00:00:00Z', detail: null },
    { id: 'd3', support_id: null, node_id: first.node_id, installed_support_id: null, kind: 'missing', detected_at: '2026-06-01T00:00:00Z', resolved_at: null, detail: null },
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

  it('rattache les divergences au support qu’elles désignent, et ne compte que les ouvertes', () => {
    const row = fleetRows(refMultilevel, registry).find(r => r.support.id === first.id);
    expect(row?.divergences.map(d => d.id)).toEqual(['d1', 'd2']);
    expect(row?.openDivergences).toBe(1);
  });

  it('garde un point non couvert par son nœud, sans le rattacher à un support', () => {
    const rows = recordedDivergenceRows(registry);
    const point = rows.find(r => r.divergence.id === 'd3');
    expect(point?.supportId).toBeNull();
    expect(point?.nodeId).toBe(first.node_id);
    expect(rows.find(r => r.divergence.id === 'd1')?.supportId).toBe(first.id);
    expect(fleetRows(refMultilevel, registry).some(r => r.divergences.some(d => d.id === 'd3'))).toBe(false);
  });

  it('cite la portée d’un ordre, clés triées', () => {
    expect(jsonText({ supports: ['a'], lot: 'L1' })).toBe('lot : L1 · supports : ["a"]');
    expect(jsonText(null)).toBe('');
  });
});
