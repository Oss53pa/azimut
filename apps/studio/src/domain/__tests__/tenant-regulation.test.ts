import { describe, it, expect } from 'vitest';
import {
  guardSignProject,
  type SignProject,
  type SignRegulation,
} from '../tenant-regulation.js';

const REG: SignRegulation = {
  max_height_mm: 800,
  max_overhang_mm: 150,
  allowed_materials: ['aluminium', 'acrylic'],
  allowed_lighting: ['backlit', 'none'],
  forbidden_features: ['flashing', 'audio'],
};

const conforming: SignProject = {
  id: 'sp-1',
  height_mm: 600,
  overhang_mm: 100,
  material: 'aluminium',
  lighting: 'backlit',
  features: ['static'],
};

describe('H5.2 — guardSignProject (TENANT.RULE_VIOLATION)', () => {
  it('passes a conforming sign project', () => {
    expect(guardSignProject(conforming, REG).ok).toBe(true);
  });

  it('blocks an over-height sign', () => {
    const r = guardSignProject({ ...conforming, height_mm: 1200 }, REG);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.code).toBe('TENANT.RULE_VIOLATION');
    expect(r.findings[0]?.severity).toBe('blocking');
    expect(r.findings[0]?.ruleRef).toBe('H5.2');
    expect(r.findings[0]?.params['axis']).toBe('height');
  });

  it('blocks a disallowed material and lighting', () => {
    const r = guardSignProject(
      { ...conforming, material: 'neon-glass', lighting: 'strobe' },
      REG,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.map((f) => f.params['axis'])).toEqual(['material', 'lighting']);
  });

  it('blocks each forbidden feature by name', () => {
    const r = guardSignProject(
      { ...conforming, features: ['audio', 'flashing'] },
      REG,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.map((f) => f.params['detail'])).toEqual(['audio', 'flashing']);
  });

  it('treats null regulation bounds as unrestricted', () => {
    const open: SignRegulation = {
      max_height_mm: null,
      max_overhang_mm: null,
      allowed_materials: [],
      allowed_lighting: [],
      forbidden_features: [],
    };
    const r = guardSignProject({ ...conforming, height_mm: 99_999 }, open);
    expect(r.ok).toBe(true);
  });

  it('reports breaches in fixed axis order', () => {
    const r = guardSignProject(
      {
        id: 'sp-bad',
        height_mm: 2000,
        overhang_mm: 999,
        material: 'x',
        lighting: 'y',
        features: ['audio'],
      },
      REG,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.map((f) => f.params['axis'])).toEqual([
      'height',
      'overhang',
      'material',
      'lighting',
      'forbidden_feature',
    ]);
  });
});
