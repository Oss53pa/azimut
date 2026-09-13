import { describe, it, expect } from 'vitest';
import { guardTextFit, type TextFitBox } from '../typography-fit.js';

const box = (over: Partial<TextFitBox> = {}): TextFitBox => ({
  block_id: 'b-1',
  measured_width_mm: 80,
  measured_height_mm: 20,
  available_width_mm: 100,
  available_height_mm: 30,
  ...over,
});

describe('E12 — guardTextFit (TYPO.TEXT_OVERFLOW)', () => {
  it('passes when the text fits both axes', () => {
    expect(guardTextFit(box()).ok).toBe(true);
  });

  it('passes when the text exactly fills the box', () => {
    expect(
      guardTextFit(box({ measured_width_mm: 100, measured_height_mm: 30 })).ok,
    ).toBe(true);
  });

  it('blocks a width overflow', () => {
    const r = guardTextFit(box({ measured_width_mm: 120 }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.code).toBe('TYPO.TEXT_OVERFLOW');
    expect(r.findings[0]?.severity).toBe('blocking');
    expect(r.findings[0]?.ruleRef).toBe('E12');
    expect(r.findings[0]?.params['axis']).toBe('width');
    expect(r.findings[0]?.params['measured_mm']).toBe(120);
    expect(r.findings[0]?.entity).toEqual({ kind: 'face_block', id: 'b-1' });
  });

  it('blocks a height overflow', () => {
    const r = guardTextFit(box({ measured_height_mm: 40 }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.params['axis']).toBe('height');
  });

  it('reports both axes in fixed order width then height', () => {
    const r = guardTextFit(box({ measured_width_mm: 120, measured_height_mm: 40 }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.map((f) => f.params['axis'])).toEqual(['width', 'height']);
  });
});
