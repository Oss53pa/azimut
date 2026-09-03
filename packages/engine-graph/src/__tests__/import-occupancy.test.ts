import { describe, it, expect } from 'vitest';
import { importOccupancy } from '../import-occupancy.js';
import { refMultilevel } from '@azimut/testkit';

function csv(lines: string[]): string {
  return lines.join('\n');
}

const header = 'unit_code;building;level;occupancy_status;occupant_name;category_key;name_fr;name_en;effective_from';

describe('D4.2 — importOccupancy', () => {
  it('imports a valid row matching a known node', () => {
    const content = csv([
      header,
      'Bureau RDC;Bâtiment ML;RDC;occupied;Acme Corp;office;Bureau principal;Main office;2026-01-15',
    ]);
    const result = importOccupancy(refMultilevel, content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.imported).toBe(1);
    expect(result.value.pending).toBe(0);
    expect(result.value.rejected).toBe(0);
    const entry = result.value.lines[0]?.entry;
    expect(entry?.node_id).toBe('n-ml-dest-rdc');
    expect(entry?.occupancy_status).toBe('occupied');
    expect(entry?.name_fr).toBe('Bureau principal');
  });

  it('puts unknown unit_code in pending with IMPORT.NODE_NOT_FOUND', () => {
    const content = csv([
      header,
      'Salle X;Bâtiment ML;RDC;vacant;;;Salle X;Room X;',
    ]);
    const result = importOccupancy(refMultilevel, content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.imported).toBe(0);
    expect(result.value.pending).toBe(1);
    const line = result.value.lines[0];
    expect(line?.status).toBe('pending');
    expect(line?.entry).not.toBeNull();
    expect(line?.findings[0]?.code).toBe('IMPORT.NODE_NOT_FOUND');
  });

  it('rejects empty required fields', () => {
    const content = csv([
      header,
      ';Bâtiment ML;RDC;occupied;;;;;',
    ]);
    const result = importOccupancy(refMultilevel, content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rejected).toBe(1);
    expect(result.value.lines[0]?.findings[0]?.code).toBe('IMPORT.ROW_INVALID');
  });

  it('rejects invalid occupancy_status', () => {
    const content = csv([
      header,
      'Bureau RDC;Bâtiment ML;RDC;unknown;;;;;',
    ]);
    const result = importOccupancy(refMultilevel, content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rejected).toBe(1);
    const finding = result.value.lines[0]?.findings[0];
    expect(finding?.code).toBe('IMPORT.ROW_INVALID');
  });

  it('rejects duplicate unit_code', () => {
    const content = csv([
      header,
      'Bureau RDC;Bâtiment ML;RDC;occupied;;;;;',
      'Bureau RDC;Bâtiment ML;RDC;vacant;;;;;',
    ]);
    const result = importOccupancy(refMultilevel, content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lines[1]?.findings[0]?.code).toBe('IMPORT.DUPLICATE_KEY');
  });

  it('rejects invalid date format', () => {
    const content = csv([
      header,
      'Bureau RDC;Bâtiment ML;RDC;occupied;;;;; 15/01/2026',
    ]);
    const result = importOccupancy(refMultilevel, content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rejected).toBe(1);
  });

  it('accepts all valid occupancy statuses', () => {
    const statuses = ['occupied', 'vacant', 'reserved', 'under_fit_out'];
    for (const status of statuses) {
      const content = csv([
        header,
        `Unit-${status};Bâtiment ML;RDC;${status};;;;;`,
      ]);
      const result = importOccupancy(refMultilevel, content);
      expect(result.ok).toBe(true);
    }
  });

  it('returns IMPORT.EMPTY_FILE for empty input', () => {
    const result = importOccupancy(refMultilevel, '');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('IMPORT.EMPTY_FILE');
  });

  it('returns IMPORT.COLUMN_MISSING for bad headers', () => {
    const content = csv(['foo;bar;baz', 'a;b;c']);
    const result = importOccupancy(refMultilevel, content);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('IMPORT.COLUMN_MISSING');
  });

  it('detects comma separator', () => {
    const content = csv([
      'unit_code,building,level,occupancy_status',
      'Bureau RDC,Bâtiment ML,RDC,occupied',
    ]);
    const result = importOccupancy(refMultilevel, content);
    expect(result.ok).toBe(true);
  });

  it('produces a line-by-line report (never silently truncated)', () => {
    const content = csv([
      header,
      'Bureau RDC;Bâtiment ML;RDC;occupied;;;;;',
      ';Bâtiment ML;RDC;occupied;;;;;',
      'Unknown;Bâtiment ML;RDC;vacant;;;;;',
    ]);
    const result = importOccupancy(refMultilevel, content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total_rows).toBe(3);
    expect(result.value.lines).toHaveLength(3);
    expect(result.value.imported).toBe(1);
    expect(result.value.rejected).toBe(1);
    expect(result.value.pending).toBe(1);
  });

  it('is deterministic (INV-4)', () => {
    const content = csv([
      header,
      'Bureau RDC;Bâtiment ML;RDC;occupied;Acme;office;Bureau;Office;2026-01-15',
      'Unknown;Bâtiment ML;RDC;vacant;;;;;',
    ]);
    const r1 = importOccupancy(refMultilevel, content);
    const r2 = importOccupancy(refMultilevel, content);
    expect(r1).toStrictEqual(r2);
  });
});
