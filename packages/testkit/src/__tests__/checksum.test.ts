import { describe, it, expect } from 'vitest';
import { stableChecksum, siteChecksum } from '../checksum.js';

describe('stableChecksum', () => {
  it('returns a 64-char hex string (SHA-256)', () => {
    const hash = stableChecksum({ a: 1 });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    const obj = { name: 'test', value: 42 };
    expect(stableChecksum(obj)).toBe(stableChecksum(obj));
  });

  it('is order-independent for top-level keys', () => {
    const a = { x: 1, y: 2 };
    const b = { y: 2, x: 1 };
    expect(stableChecksum(a)).toBe(stableChecksum(b));
  });

  it('different values produce different hashes', () => {
    expect(stableChecksum({ a: 1 })).not.toBe(stableChecksum({ a: 2 }));
  });
});

describe('siteChecksum', () => {
  it('returns a 64-char hex string (SHA-256)', () => {
    const hash = siteChecksum({ site: 'test' });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    const site = { id: 's1', name: 'Site' };
    expect(siteChecksum(site)).toBe(siteChecksum(site));
  });

  it('is order-dependent (raw JSON)', () => {
    const a = { x: 1, y: 2 };
    const b = { y: 2, x: 1 };
    // siteChecksum uses raw JSON.stringify, so order matters
    expect(siteChecksum(a)).not.toBe(siteChecksum(b));
  });

  it('differs from stableChecksum for same input', () => {
    const obj = { b: 2, a: 1 };
    // stableChecksum sorts keys; siteChecksum does not
    expect(stableChecksum(obj)).not.toBe(siteChecksum(obj));
  });
});
