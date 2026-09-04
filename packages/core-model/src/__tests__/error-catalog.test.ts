import { describe, it, expect } from 'vitest';
import { ERROR_CATALOG } from '../error-catalog.js';

describe('ERROR_CATALOG', () => {
  const entries = Object.entries(ERROR_CATALOG);
  const codes = Object.keys(ERROR_CATALOG);

  it('is not empty', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('every entry has a valid severity', () => {
    const validSeverities = new Set(['blocking', 'warning', 'info']);
    for (const [code, entry] of entries) {
      expect(validSeverities.has(entry.severity)).toBe(true);
      // attach code for readable failure message
      if (!validSeverities.has(entry.severity)) {
        throw new Error(`${code} has invalid severity: ${entry.severity}`);
      }
    }
  });

  it('every entry has a non-empty description', () => {
    for (const [code, entry] of entries) {
      expect(entry.description.length).toBeGreaterThan(0);
      if (entry.description.length === 0) {
        throw new Error(`${code} has empty description`);
      }
    }
  });

  it('all codes follow DOMAIN.SPECIFIC_CODE format', () => {
    const pattern = /^[A-Z]+\.[A-Z][A-Z0-9_]*$/;
    for (const code of codes) {
      expect(pattern.test(code)).toBe(true);
    }
  });

  it('codes are grouped by domain prefix', () => {
    const domains = new Set(codes.map((c) => c.split('.')[0]));
    expect(domains.size).toBeGreaterThan(1);
    // Known domains
    const expected = ['GRAPH', 'GEOM', 'LAYOUT', 'RULES', 'SECURITY', 'IMPORT', 'PACKAGE', 'DATA'];
    for (const d of expected) {
      expect(domains.has(d)).toBe(true);
    }
  });

  it('no duplicate codes (type-level guarantee, runtime check)', () => {
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  it('blocking severity dominates', () => {
    const blocking = entries.filter(([, e]) => e.severity === 'blocking');
    const warning = entries.filter(([, e]) => e.severity === 'warning');
    const info = entries.filter(([, e]) => e.severity === 'info');
    expect(blocking.length).toBeGreaterThan(warning.length);
    expect(blocking.length).toBeGreaterThan(info.length);
  });

  it('contains at least one info-severity entry', () => {
    const infoEntries = entries.filter(([, e]) => e.severity === 'info');
    expect(infoEntries.length).toBeGreaterThan(0);
  });

  it('every domain prefix has at least one entry', () => {
    const expected = ['GRAPH', 'GEOM', 'LAYOUT', 'RULES', 'SECURITY', 'IMPORT', 'PACKAGE', 'DATA'];
    for (const prefix of expected) {
      const matching = codes.filter((c) => c.startsWith(`${prefix}.`));
      expect(matching.length).toBeGreaterThan(0);
    }
  });

  it('no description contains a hardcoded hex color', () => {
    for (const [, entry] of entries) {
      expect(entry.description).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });
});
