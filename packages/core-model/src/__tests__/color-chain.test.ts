import { describe, it, expect } from 'vitest';
import { colorDelta, auditColorReferences } from '../color-chain.js';
import type { CharterColor } from '../color-chain.js';

const color = (
  id: string,
  over: Partial<CharterColor> = {},
): CharterColor => ({
  id,
  reference_system: 'none',
  reference_code: null,
  lab: null,
  ...over,
});

describe('G6.2 — colorDelta (COLOR.DELTA_NOT_COMPUTABLE)', () => {
  it('computes a CIE76 delta when both colours have measured values', () => {
    const a = color('c-1', { lab: { l: 50, a: 0, b: 0 } });
    const b = color('c-2', { lab: { l: 53, a: 4, b: 0 } });
    const r = colorDelta(a, b);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBe(5); // sqrt(3^2 + 4^2) = 5
    expect(r.warnings).toEqual([]);
  });

  it('rounds the delta deterministically to two decimals', () => {
    const a = color('c-1', { lab: { l: 0, a: 0, b: 0 } });
    const b = color('c-2', { lab: { l: 1, a: 1, b: 1 } });
    const r = colorDelta(a, b);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBe(1.73); // sqrt(3) = 1.7320508...
  });

  it('returns null with an info when either colour lacks measured values', () => {
    const a = color('c-1', { lab: { l: 50, a: 0, b: 0 } });
    const b = color('c-2'); // no lab
    const r = colorDelta(a, b);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBeNull();
    expect(r.warnings[0]?.code).toBe('COLOR.DELTA_NOT_COMPUTABLE');
    expect(r.warnings[0]?.severity).toBe('info');
    expect(r.warnings[0]?.ruleRef).toBe('G6.2');
    expect(r.warnings[0]?.params['left']).toBe('c-1');
    expect(r.warnings[0]?.params['right']).toBe('c-2');
  });
});

describe('G6.3 — auditColorReferences (COLOR.REFERENCE_UNVERIFIABLE)', () => {
  it('reports nothing for a colour whose measured values are provided', () => {
    const r = auditColorReferences([
      color('c-1', {
        reference_system: 'pantone',
        reference_code: '186 C',
        lab: { l: 48, a: 70, b: 40 },
      }),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });

  it('warns for a swatch reference held without measured values', () => {
    const r = auditColorReferences([
      color('c-1', { reference_system: 'pantone', reference_code: '186 C' }),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings[0]?.code).toBe('COLOR.REFERENCE_UNVERIFIABLE');
    expect(r.warnings[0]?.severity).toBe('info');
    expect(r.warnings[0]?.ruleRef).toBe('G6.3');
    expect(r.warnings[0]?.params['reference_code']).toBe('186 C');
  });

  it('does not warn when there is no swatch reference', () => {
    const r = auditColorReferences([color('c-1', { reference_system: 'none' })]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([]);
  });

  it('reports unverifiable references sorted by colour id', () => {
    const r = auditColorReferences([
      color('c-c', { reference_system: 'ral', reference_code: '5015' }),
      color('c-a', { reference_system: 'ncs', reference_code: 'S 2050', lab: { l: 1, a: 2, b: 3 } }),
      color('c-b', { reference_system: 'ncs', reference_code: 'S 0500' }),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings.map((w) => w.entity?.id)).toEqual(['c-b', 'c-c']);
  });
});
