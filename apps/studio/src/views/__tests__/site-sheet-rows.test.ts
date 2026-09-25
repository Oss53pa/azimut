import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit';
import { polygonArea, type SiteData } from '@azimut/core-model';
import { levelRows } from '../register/site-sheet-rows.js';

describe('Module 01 — lignes de la fiche de site', () => {
  const site: SiteData = refMultilevel;
  const rows = levelRows(site);

  it('rend un niveau par ligne, rangés par bâtiment puis par rang', () => {
    expect(rows).toHaveLength(site.levels.length);
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1];
      const b = rows[i];
      if (a === undefined || b === undefined) continue;
      if (a.buildingName === b.buildingName) expect(a.ordinal).toBeLessThanOrEqual(b.ordinal);
    }
  });

  it('additionne les surfaces des empreintes du niveau', () => {
    for (const row of rows) {
      const expected = site.footprints
        .filter(f => f.level_id === row.id)
        .reduce((sum, f) => sum + polygonArea(f.geometry), 0);
      expect(row.footprintAreaM2).toBeCloseTo(expected, 9);
    }
  });

  it('compte les supports par le niveau de leur nœud', () => {
    const total = rows.reduce((n, r) => n + r.supports, 0);
    const placed = site.supports.filter(s => site.graph.nodes.some(n => n.id === s.node_id)).length;
    expect(total).toBe(placed);
  });

  it('dit « plan absent » sans fond, « non calé » sans calage exploitable', () => {
    const bare: SiteData = { ...site, plan_sources: [], plan_calibrations: [] };
    expect(levelRows(bare).every(r => r.planState === 'absent' && r.planFile === null)).toBe(true);

    const level = site.levels[0];
    if (level === undefined) return;
    const withSource: SiteData = {
      ...bare,
      plan_sources: [{
        id: 'ps-1', org_id: level.org_id, level_id: level.id,
        storage_path: 'org/site/plans/rdc.pdf', media_type: 'application/pdf',
        uploaded_at: '2026-09-01T10:00:00Z',
      }],
    };
    const row = levelRows(withSource).find(r => r.id === level.id);
    expect(row?.planState).toBe('uncalibrated');
    expect(row?.planFile).toBe('rdc.pdf');
    expect(row?.updatedAt).toBe('2026-09-01T10:00:00Z');
  });

  it('rend deux fois la même chose pour les mêmes données (INV-4)', () => {
    expect(levelRows(site)).toEqual(rows);
  });
});
