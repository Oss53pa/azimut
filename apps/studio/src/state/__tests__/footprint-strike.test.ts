import { describe, it, expect } from 'vitest';
import { footprintDependents, strikeFootprints } from '../footprint-strike.js';
import type { StoredRow } from '../session-store.js';

const write = { orgId: 'org', timestamp: '2026-10-05T09:00:00.000Z' };
const rows: readonly StoredRow[] = [
  { table: 'footprint', id: 'libre', values: { org_id: 'org', level_id: 'n', kind: 'cell', unit_code: 'A1', geometry: { vertices: [] } } },
  { table: 'footprint', id: 'occupee', values: { org_id: 'org', level_id: 'n', kind: 'cell', unit_code: 'B2', geometry: '{"vertices":[]}' } },
  { table: 'destination', id: 'd1', values: { footprint_id: 'occupee' } },
];

describe('J1.2 — le trait barrant une empreinte', () => {
  it('supprime d’un geste, avec la ligne entière pour l’annulation', () => {
    const out = strikeFootprints(rows, ['libre'], write);
    expect(out.kind).toBe('deleted');
    if (out.kind !== 'deleted') return;
    const [command] = out.commands;
    expect(command?.operation).toBe('delete');
    expect(command?.before).toMatchObject({ id: 'libre', unit_code: 'A1', geometry: '{"vertices":[]}', level_id: 'n' });
  });

  it('refuse une empreinte qu’une autre ligne cite, et nomme laquelle', () => {
    expect(footprintDependents(rows, 'occupee')).toBe(1);
    expect(strikeFootprints(rows, ['libre', 'occupee'], write))
      .toEqual({ kind: 'referenced', footprintId: 'occupee', unitCode: 'B2', dependents: 1 });
  });

  it('plusieurs empreintes barrées d’un trait s’annulent d’une frappe', () => {
    const two: readonly StoredRow[] = [...rows.slice(0, 1), { ...rows[0], id: 'autre' } as StoredRow];
    const out = strikeFootprints(two, ['libre', 'autre'], write);
    expect(out.kind === 'deleted' && new Set(out.commands.map(c => c.groupKey)).size).toBe(1);
  });
});
