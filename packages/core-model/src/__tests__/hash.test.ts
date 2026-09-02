import { describe, it, expect } from 'vitest';
import {
  canonicalSerialize,
  sha256Hex,
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

describe('contentHash convenience', () => {
  it('serializes then hashes', () => {
    const hash = contentHash({ a: 1 });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(sha256Hex(canonicalSerialize({ a: 1 })));
  });
});
