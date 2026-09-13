import { describe, it, expect } from 'vitest';
import {
  guardCreativeAgainstSpec,
  type Creative,
  type CreativeSpec,
} from '../ad-creative-control.js';

const SPEC: CreativeSpec = {
  format: 'pdf',
  min_resolution_dpi: 150,
  safe_zone_mm: 10,
  color_profile: 'FOGRA39',
  max_weight_bytes: 5_000_000,
};

const conforming: Creative = {
  id: 'c-1',
  format: 'pdf',
  resolution_dpi: 300,
  safe_zone_mm: 12,
  color_profile: 'FOGRA39',
  weight_bytes: 2_000_000,
};

describe('H4.6 — guardCreativeAgainstSpec (AD.CREATIVE_SPEC_MISMATCH)', () => {
  it('passes a conforming creative', () => {
    expect(guardCreativeAgainstSpec(conforming, SPEC).ok).toBe(true);
  });

  it('blocks a wrong format', () => {
    const r = guardCreativeAgainstSpec({ ...conforming, format: 'jpg' }, SPEC);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.code).toBe('AD.CREATIVE_SPEC_MISMATCH');
    expect(r.findings[0]?.severity).toBe('blocking');
    expect(r.findings[0]?.ruleRef).toBe('H4.6');
    expect(r.findings[0]?.params['axis']).toBe('format');
  });

  it('blocks resolution below the minimum', () => {
    const r = guardCreativeAgainstSpec({ ...conforming, resolution_dpi: 72 }, SPEC);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.params['axis']).toBe('resolution');
  });

  it('blocks a safe zone below the required minimum', () => {
    const r = guardCreativeAgainstSpec({ ...conforming, safe_zone_mm: 5 }, SPEC);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.params['axis']).toBe('safe_zone');
  });

  it('blocks a mismatched colour profile', () => {
    const r = guardCreativeAgainstSpec({ ...conforming, color_profile: 'sRGB' }, SPEC);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.params['axis']).toBe('color_profile');
  });

  it('blocks a creative over the weight limit', () => {
    const r = guardCreativeAgainstSpec({ ...conforming, weight_bytes: 9_000_000 }, SPEC);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.params['axis']).toBe('weight');
  });

  it('reports every failing axis in fixed order', () => {
    const r = guardCreativeAgainstSpec(
      {
        id: 'c-bad',
        format: 'png',
        resolution_dpi: 50,
        safe_zone_mm: 1,
        color_profile: 'sRGB',
        weight_bytes: 99_000_000,
      },
      SPEC,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.map((f) => f.params['axis'])).toEqual([
      'format',
      'resolution',
      'safe_zone',
      'color_profile',
      'weight',
    ]);
  });
});
