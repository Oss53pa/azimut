import { describe, it, expect } from 'vitest';
import { assembleDeliveryArchive } from '../assemble-delivery-archive.js';
import type { DeliveryItem } from '../assemble-delivery-archive.js';

const enc = new TextEncoder();
const dec = new TextDecoder();

function item(reference: string, face: string, type_code = 'DIR'): DeliveryItem {
  return {
    parts: {
      site_code: 'CPL', building: 'A', level: 'R1',
      type_code, reference, version: 3, face, extension: 'pdf',
    },
    bytes: enc.encode(`PDF:${reference}:${face}`),
  };
}

function input(items: DeliveryItem[]) {
  return {
    site_code: 'CPL', building: 'A', level: 'R1', version: 3,
    extension: 'zip', items,
  };
}

describe('D11 — assembleDeliveryArchive', () => {
  it('names files by the D11 scheme and the archive without support segments', () => {
    const result = assembleDeliveryArchive(input([item('D-042', 'F1')]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.files.has('CPL_A_R1_DIR_D-042_V3_F1.PDF')).toBe(true);
    expect(result.value.archive_name).toBe('CPL_A_R1_V3.ZIP');
    expect(result.value.index_name).toBe('CPL_A_R1_V3_INDEX.json');
    expect(result.value.files.has(result.value.index_name)).toBe(true);
  });

  it('index echoes the quantitative: counts, totals and per-type', () => {
    const result = assembleDeliveryArchive(input([
      item('D-042', 'F1'),
      item('D-042', 'F2'),
      item('E-007', 'F1', 'EVAC'),
    ]));
    if (!result.ok) throw new Error('expected ok');
    const { index } = result.value;

    expect(index.file_count).toBe(3);
    expect(index.by_type).toEqual({ DIR: 2, EVAC: 1 });
    expect(index.total_bytes).toBe(
      [...result.value.files]
        .filter(([name]) => name !== result.value.index_name)
        .reduce((s, [, b]) => s + b.length, 0),
    );
    // Entries are sorted by file name.
    const names = index.entries.map((e) => e.file_name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('is deterministic regardless of input order (INV-4)', () => {
    const a = assembleDeliveryArchive(input([item('D-042', 'F1'), item('E-007', 'F1')]));
    const b = assembleDeliveryArchive(input([item('E-007', 'F1'), item('D-042', 'F1')]));
    if (!a.ok || !b.ok) throw new Error('expected ok');
    expect(dec.decode(a.value.files.get(a.value.index_name)))
      .toBe(dec.decode(b.value.files.get(b.value.index_name)));
    expect([...a.value.files.keys()].sort()).toEqual([...b.value.files.keys()].sort());
  });

  it('rejects a name collision with PACKAGE.DUPLICATE_PATH', () => {
    const result = assembleDeliveryArchive(input([item('D-042', 'F1'), item('D-042', 'F1')]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings.some((f) => f.code === 'PACKAGE.DUPLICATE_PATH')).toBe(true);
  });
});
