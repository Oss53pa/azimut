import { describe, it, expect } from 'vitest';
import {
  computeQuantities,
  quantityReportToCsv,
} from '../compute-quantities.js';
import type {
  PlacedSupport,
  CsvLang,
  QuantityReport,
} from '../compute-quantities.js';
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
      (w) => w.code === 'GRAPH.QUANTITY_NODE_NOT_FOUND',
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
  const csvSupports: PlacedSupport[] = [
    { id: 'sup-1', node_id: 'n-entrance', support_type_key: 'directional' },
    { id: 'sup-2', node_id: 'n-junction', support_type_key: 'totemic' },
  ];

  it('produces French CSV by default', () => {
    const result = computeQuantities(refMinimal, csvSupports);
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

  it('produces French CSV with explicit lang', () => {
    const result = computeQuantities(refMinimal, csvSupports);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const csv = quantityReportToCsv(result.value, 'fr');
    expect(csv).toContain('Bâtiment;Nombre');
    expect(csv).toContain('Niveau;Nombre');
  });

  it('produces English CSV', () => {
    const result = computeQuantities(refMinimal, csvSupports);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const csv = quantityReportToCsv(result.value, 'en');
    expect(csv).toContain('Type;Type name;Count;Faces');
    expect(csv).toContain('Building;Count');
    expect(csv).toContain('Level;Count');
    expect(csv).toContain('Total supports;2');
    expect(csv).toContain('Total faces;3');
    expect(csv).toContain('Cross-check OK;YES');
  });

  it('English CSV uses NO for failed cross-check', () => {
    const report = {
      total_supports: 5,
      total_faces: 10,
      by_type: [],
      by_building: [],
      by_level: [],
      cross_check_ok: false,
    };
    const csv = quantityReportToCsv(report, 'en');
    expect(csv).toContain('Cross-check OK;NO');
  });

  it('French CSV uses NON for failed cross-check', () => {
    const report = {
      total_supports: 5,
      total_faces: 10,
      by_type: [],
      by_building: [],
      by_level: [],
      cross_check_ok: false,
    };
    const csv = quantityReportToCsv(report, 'fr');
    expect(csv).toContain('Recoupement OK;NON');
  });

  it('determinism: same lang produces identical output (INV-4)', () => {
    const result = computeQuantities(refMinimal, csvSupports);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const langs: CsvLang[] = ['fr', 'en'];
    for (const lang of langs) {
      const a = quantityReportToCsv(result.value, lang);
      const b = quantityReportToCsv(result.value, lang);
      expect(a).toBe(b);
    }
  });

  it('escapes fields containing semicolons', () => {
    const result = computeQuantities(refMinimal, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const csv = quantityReportToCsv(result.value);
    expect(csv).toContain('Recoupement OK;OUI');
  });

  it('wraps field with semicolon in double quotes', () => {
    const report: QuantityReport = {
      total_supports: 1,
      total_faces: 1,
      by_type: [
        {
          support_type_key: 'dir',
          support_type_name: 'Type; special',
          count: 1,
          face_count: 1,
        },
      ],
      by_building: [],
      by_level: [],
      cross_check_ok: true,
    };
    const csv = quantityReportToCsv(report);
    expect(csv).toContain('"Type; special"');
  });

  it('doubles internal double quotes in field values', () => {
    const report: QuantityReport = {
      total_supports: 1,
      total_faces: 1,
      by_type: [],
      by_building: [
        { building_id: 'b1', building_name: 'Bât "A"', count: 1 },
      ],
      by_level: [],
      cross_check_ok: true,
    };
    const csv = quantityReportToCsv(report);
    expect(csv).toContain('"Bât ""A"""');
  });

  it('wraps field with newline in double quotes', () => {
    const report: QuantityReport = {
      total_supports: 1,
      total_faces: 1,
      by_type: [],
      by_building: [],
      by_level: [
        {
          level_id: 'l1',
          level_name: 'Rez\nChaussée',
          building_id: 'b1',
          count: 1,
        },
      ],
      cross_check_ok: true,
    };
    const csv = quantityReportToCsv(report);
    expect(csv).toContain('"Rez\nChaussée"');
  });
});
