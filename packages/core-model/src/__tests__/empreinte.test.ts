import { describe, it, expect } from 'vitest';
import { canonicalContentJson, empreinte } from '../empreinte.js';

describe('canonicalContentJson (T-2.14a §4)', () => {
  it('sorts object keys by code point and emits no whitespace', () => {
    expect(canonicalContentJson({ b: 1, a: 2, A: 3 }))
      .toBe('{"A":3,"a":2,"b":1}');
  });

  it('omits absent/null keys, never emitting null (§4.3)', () => {
    expect(canonicalContentJson({ a: 1, b: null, c: undefined })).toBe('{"a":1}');
  });

  it('treats an absent field and a null field identically (§5)', () => {
    expect(canonicalContentJson({ a: 1 }))
      .toBe(canonicalContentJson({ a: 1, b: null }));
    expect(canonicalContentJson({ a: 1 }))
      .toBe(canonicalContentJson({ a: 1, b: undefined }));
  });

  it('normalizes strings to NFC before serializing (§4.7)', () => {
    const composed = 'é';           // U+00E9
    const decomposed = 'é';   // e + combining acute
    expect(composed).not.toBe(decomposed);
    expect(canonicalContentJson({ n: composed }))
      .toBe(canonicalContentJson({ n: decomposed }));
  });

  it('formats integers plainly and other decimals to three places (§4.5)', () => {
    expect(canonicalContentJson({ w: 600 })).toBe('{"w":600}');
    expect(canonicalContentJson({ d: 1.2345 })).toBe('{"d":1.235}');
    expect(canonicalContentJson({ d: 1.5 })).toBe('{"d":1.5}');
  });

  it('emits negative zero as zero (§4.6)', () => {
    expect(canonicalContentJson({ z: -0 })).toBe('{"z":0}');
    expect(canonicalContentJson({ z: -0.0001 })).toBe('{"z":0}');
  });

  it('emits booleans as true/false, never 0/1 (§4.8)', () => {
    expect(canonicalContentJson({ a: true, b: false })).toBe('{"a":true,"b":false}');
  });

  it('keeps business-ordered arrays in order', () => {
    expect(canonicalContentJson(['b', 'a', 'c'])).toBe('["b","a","c"]');
  });

  it('is independent of object key insertion order', () => {
    expect(canonicalContentJson({ a: 1, b: { y: 2, x: 3 } }))
      .toBe(canonicalContentJson({ b: { x: 3, y: 2 }, a: 1 }));
  });

  it('rejects a null inside an array (§4.3, builder error)', () => {
    expect(() => canonicalContentJson([1, null, 2])).toThrow();
  });
});

describe('empreinte (T-2.14a §4.9)', () => {
  it('is a lowercase sha256: hex string', () => {
    const h = empreinte({ a: 1 });
    expect(h).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('is deterministic byte-for-byte for the same value', () => {
    expect(empreinte({ a: 1, b: 'é' })).toBe(empreinte({ a: 1, b: 'é' }));
  });

  it('differs when content differs', () => {
    expect(empreinte({ a: 1 })).not.toBe(empreinte({ a: 2 }));
  });
});
