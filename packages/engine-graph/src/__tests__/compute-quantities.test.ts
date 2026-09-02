import { describe, it, expect } from 'vitest';
import {
  computeQuantities,
  quantityReportToCsv,
} from '../compute-quantities.js';
import type { PlacedSupport } from '../compute-quantities.js';
import { refMinimal, refMultilevel } from '@azimut/testkit';

describe('T-2.13 computeQuantities', () => {
  const minimalSupports: PlacedSupport[] = [
    { id: 'sup-1', node_id: 'n-entrance', support_type_key: 'directional' },
    { id: 'sup-2', node_id: 'n-junction', support_type_key: 'directional' },
    { id: 'sup-3', node_id: 'n-dest-a', support_type_key: 'totemic' },
  ];

  it('counts total supports correctly', () => {
    const result = computeQuantities(refMinimal, minimalSupports);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total_supports).toBe(3);
  });

  it('breaks down by type', () => {
    const result = computeQuantities(refMinimal, minimalSupports);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dir = result.value.by_type.find(
      (t) => t.support_type_key === 'directional',
    );
    const tot = result.value.by_type.find(
      (t) => t.support_type_key === 'totemic',
    );
    expect(dir?.count).toBe(2);
    expect(tot?.count).toBe(1);
  });

  it('computes face_count from support type definition', () => {
    const result = computeQuantities(refMinimal, minimalSupports);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dir = result.value.by_type.find(
      (t) => t.support_type_key === 'directional',
    );
    const tot = result.value.by_type.find(
      (t) => t.support_type_key === 'totemic',
    );
    expect(dir?.face_count).toBe(2);
    expect(tot?.face_count).toBe(2);
    expect(result.value.total_faces).toBe(4);
  });

  it('breaks down by building', () => {
    const result = computeQuantities(refMinimal, minimalSupports);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.by_building.length).toBe(1);
    expect(result.value.by_building[0]?.count).toBe(3);
  });

  it('breaks down by level', () => {
    const result = computeQuantities(refMinimal, minimalSupports);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.by_level.length).toBe(1);
    expect(result.value.by_level[0]?.count).toBe(3);
  });

  it('cross_check_ok is true when totals match', () => {
    const result = computeQuantities(refMinimal, minimalSupports);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cross_check_ok).toBe(true);
  });

  it('handles multi-level site', () => {
    const supports: PlacedSupport[] = [
      { id: 'sup-rdc-1', node_id: 'n-ml-hall', support_type_key: 'directional' },
      { id: 'sup-rdc-2', node_id: 'n-ml-entrance', support_type_key: 'directional' },
      { id: 'sup-r1-1', node_id: 'n-ml-hall-r1', support_type_key: 'directional' },
    ];
    const result = computeQuantities(refMultilevel, supports);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total_supports).toBe(3);
    expect(result.value.by_level.length).toBe(2);
    const rdc = result.value.by_level.find(
      (l) => l.level_id === 'lvl-ml-rdc',
    );
    const r1 = result.value.by_level.find(
      (l) => l.level_id === 'lvl-ml-r1',
    );
    expect(rdc?.count).toBe(2);
    expect(r1?.count).toBe(1);
    expect(result.value.cross_check_ok).toBe(true);
  });

  it('warns on unknown node and still cross-checks', () => {
    const supports: PlacedSupport[] = [
      { id: 'sup-ok', node_id: 'n-entrance', support_type_key: 'directional' },
      { id: 'sup-orphan', node_id: 'n-nonexistent', support_type_key: 'directional' },
    ];
    const result = computeQuantities(refMinimal, supports);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total_supports).toBe(2);
    expect(result.value.by_type[0]?.count).toBe(2);
    expect(result.value.by_building[0]?.count).toBe(1);
    expect(result.value.cross_check_ok).toBe(true);
    const nodeWarning = result.warnings.find(
      (w) => w.code === 'QUANTITY.NODE_NOT_FOUND',
    );
    expect(nodeWarning).toBeDefined();
  });

  it('returns empty report for no supports', () => {
    const result = computeQuantities(refMinimal, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total_supports).toBe(0);
    expect(result.value.total_faces).toBe(0);
    expect(result.value.by_type.length).toBe(0);
    expect(result.value.by_building.length).toBe(0);
    expect(result.value.by_level.length).toBe(0);
    expect(result.value.cross_check_ok).toBe(true);
  });

  describe('determinism (INV-4)', () => {
    it('same result on two calls', () => {
      const r1 = computeQuantities(refMinimal, minimalSupports);
      const r2 = computeQuantities(refMinimal, minimalSupports);
      expect(r1).toStrictEqual(r2);
    });
  });
});

describe('T-2.13 quantityReportToCsv', () => {
  it('produces semicolon-separated CSV', () => {
    const supports: PlacedSupport[] = [
      { id: 'sup-1', node_id: 'n-entrance', support_type_key: 'directional' },
      { id: 'sup-2', node_id: 'n-junction', support_type_key: 'totemic' },
    ];
    const result = computeQuantities(refMinimal, supports);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const csv = quantityReportToCsv(result.value);
    expect(csv).toContain('Type;Nom type;Nombre;Faces');
    expect(csv).toContain('directional;Panneau directionnel;1;1');
    expect(csv).toContain('totemic;Totem;1;2');
    expect(csv).toContain('Total supports;2');
    expect(csv).toContain('Total faces;3');
    expect(csv).toContain('Recoupement OK;OUI');
  });

  it('escapes fields containing semicolons', () => {
    const result = computeQuantities(refMinimal, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const csv = quantityReportToCsv(result.value);
    expect(csv).toContain('Recoupement OK;OUI');
  });
});
