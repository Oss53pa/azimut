import { describe, it, expect } from 'vitest';
import {
  canonicalSerialize,
  sha256Hex,
  sha256Binary,
  contentHash,
} from '../index.js';

describe('D7.2 — canonical serialization', () => {
  it('sorts object keys alphabetically', () => {
    const result = canonicalSerialize({ b: 1, a: 2 });
    expect(result).toBe('{"a":2,"b":1}');
  });

  it('produces no whitespace', () => {
    const result = canonicalSerialize({ x: [1, 2, 3], y: { z: true } });
    expect(result).not.toMatch(/\s/);
  });

  it('rounds floats to 3 decimals (D1.4)', () => {
    const result = canonicalSerialize({ v: 1.23456 });
    expect(result).toBe('{"v":1.235}');
  });

  it('keeps integers as integers', () => {
    const result = canonicalSerialize({ count: 42 });
    expect(result).toBe('{"count":42}');
  });

  it('handles negative zero as 0', () => {
    const result = canonicalSerialize({ v: -0 });
    expect(result).toBe('{"v":0}');
  });

  it('treats null and undefined as null', () => {
    const result = canonicalSerialize({ a: null, b: undefined });
    expect(result).toBe('{"a":null,"b":null}');
  });

  it('handles nested objects and arrays', () => {
    const result = canonicalSerialize({
      items: [{ z: 1, a: 2 }],
      name: 'test',
    });
    expect(result).toBe('{"items":[{"a":2,"z":1}],"name":"test"}');
  });

  it('is deterministic — same input always same output', () => {
    const obj = { position: { x_m: 1.5, y_m: 2.333 }, id: 'abc' };
    const a = canonicalSerialize(obj);
    const b = canonicalSerialize(obj);
    expect(a).toBe(b);
  });

  it('handles Infinity and NaN as null', () => {
    const result = canonicalSerialize({ a: Infinity, b: NaN });
    expect(result).toBe('{"a":null,"b":null}');
  });
});

describe('D7.2 — SHA-256', () => {
  it('produces 64-char lowercase hex', () => {
    const hash = sha256Hex('test');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic', () => {
    expect(sha256Hex('hello')).toBe(sha256Hex('hello'));
  });

  it('differs for different inputs', () => {
    expect(sha256Hex('a')).not.toBe(sha256Hex('b'));
  });

  it('matches known SHA-256 vector', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});

describe('sha256Binary', () => {
  it('produces 64-char lowercase hex', () => {
    const hash = sha256Binary(new Uint8Array([0x41, 0x42, 0x43]));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('matches sha256Hex for same ASCII content', () => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode('hello');
    expect(sha256Binary(bytes)).toBe(sha256Hex('hello'));
  });

  it('produces known hash for empty input', () => {
    expect(sha256Binary(new Uint8Array(0))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});

describe('contentHash convenience', () => {
  it('serializes then hashes', () => {
    const hash = contentHash({ a: 1 });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(sha256Hex(canonicalSerialize({ a: 1 })));
  });
});

describe('canonicalSerialize — additional edge cases', () => {
  it('serializes booleans correctly', () => {
    expect(canonicalSerialize({ f: false, t: true })).toBe('{"f":false,"t":true}');
  });

  it('serializes empty object', () => {
    expect(canonicalSerialize({})).toBe('{}');
  });

  it('serializes empty array', () => {
    expect(canonicalSerialize([])).toBe('[]');
  });

  it('serializes strings with special characters', () => {
    expect(canonicalSerialize({ s: 'a"b\\c' })).toBe('{"s":"a\\"b\\\\c"}');
  });

  it('serializes deeply nested structures deterministically', () => {
    const deep = { a: { b: { c: [1, { d: 2 }] } } };
    const s1 = canonicalSerialize(deep);
    const s2 = canonicalSerialize(deep);
    expect(s1).toBe(s2);
    expect(s1).toBe('{"a":{"b":{"c":[1,{"d":2}]}}}');
  });
});

describe('sha256Hex — additional edge cases', () => {
  it('handles multi-byte UTF-8 (accented French)', () => {
    const hash = sha256Hex('Façade entrée');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    // Deterministic
    expect(sha256Hex('Façade entrée')).toBe(hash);
  });

  it('distinguishes similar strings', () => {
    expect(sha256Hex('abc')).not.toBe(sha256Hex('abd'));
  });
});

describe('canonicalSerialize — non-primitive fallbacks', () => {
  it('serializes function values as null', () => {
    const fn = () => 0;
    expect(canonicalSerialize({ fn })).toBe('{"fn":null}');
  });

  it('serializes symbol values as null', () => {
    const s = Symbol('x');
    expect(canonicalSerialize({ s })).toBe('{"s":null}');
  });

  it('serializes bigint values as null', () => {
    const b = BigInt(42);
    expect(canonicalSerialize({ b })).toBe('{"b":null}');
  });
});

describe('canonicalSerialize — top-level primitives', () => {
  it('serializes top-level null', () => {
    expect(canonicalSerialize(null)).toBe('null');
  });

  it('serializes top-level undefined', () => {
    expect(canonicalSerialize(undefined)).toBe('null');
  });

  it('serializes top-level number', () => {
    expect(canonicalSerialize(42)).toBe('42');
  });

  it('serializes top-level float (rounded)', () => {
    expect(canonicalSerialize(1.23456)).toBe('1.235');
  });

  it('serializes top-level string', () => {
    expect(canonicalSerialize('hello')).toBe('"hello"');
  });

  it('serializes top-level boolean true', () => {
    expect(canonicalSerialize(true)).toBe('true');
  });

  it('serializes top-level boolean false', () => {
    expect(canonicalSerialize(false)).toBe('false');
  });

  it('contentHash of a bare string is deterministic', () => {
    const h1 = contentHash('test');
    const h2 = contentHash('test');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('contentHash of a bare number differs from its string', () => {
    expect(contentHash(42)).not.toBe(contentHash('42'));
  });
});
