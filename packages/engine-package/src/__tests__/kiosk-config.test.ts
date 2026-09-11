import { describe, it, expect } from 'vitest';
import { parseKioskConfig } from '../kiosk-config.js';

const valid = {
  kioskId: 'kiosk-hall',
  nodeId: 'n-ml-hall',
  azimuthDeg: 142,
  defaultLang: 'fr',
  buildingId: 'bldg-001',
};

describe('D10.3 — parseKioskConfig', () => {
  it('parses a valid config', () => {
    const r = parseKioskConfig(valid);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.azimuthDeg).toBe(142);
    expect(r.value.defaultLang).toBe('fr');
  });

  it('accepts azimuth at the lower bound 0', () => {
    expect(parseKioskConfig({ ...valid, azimuthDeg: 0 }).ok).toBe(true);
  });

  it('rejects azimuth 360 (domain is [0, 360))', () => {
    const r = parseKioskConfig({ ...valid, azimuthDeg: 360 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings[0]?.code).toBe('DATA.KIOSK_CONFIG_INVALID');
    expect(r.findings[0]?.params['field']).toBe('azimuthDeg');
  });

  it('rejects a negative azimuth', () => {
    expect(parseKioskConfig({ ...valid, azimuthDeg: -1 }).ok).toBe(false);
  });

  it('rejects a missing kioskId', () => {
    const rest: Record<string, unknown> = { ...valid };
    delete rest['kioskId'];
    const r = parseKioskConfig(rest);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.findings.some((f) => f.params['field'] === 'kioskId')).toBe(true);
  });

  it('rejects a non-object', () => {
    expect(parseKioskConfig(null).ok).toBe(false);
    expect(parseKioskConfig([]).ok).toBe(false);
    expect(parseKioskConfig('x').ok).toBe(false);
  });

  it('never falls back to a default identifier', () => {
    const r = parseKioskConfig({ ...valid, nodeId: '' });
    expect(r.ok).toBe(false);
  });
});
