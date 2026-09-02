import { describe, it, expect } from 'vitest';
import { ERROR_CATALOG } from '../error-catalog.js';
import {
  ERROR_MESSAGES_FR,
  ERROR_MESSAGES_EN,
  getErrorMessage,
  getSupportedErrorLangs,
} from '../i18n-errors.js';
import type { ErrorCode } from '../error-catalog.js';

const allCodes = Object.keys(ERROR_CATALOG) as ErrorCode[];

describe('D12.1 — error code dictionaries', () => {
  it('FR dictionary covers every catalog code', () => {
    const frKeys = new Set(Object.keys(ERROR_MESSAGES_FR));
    const missing = allCodes.filter((c) => !frKeys.has(c));
    expect(missing).toEqual([]);
  });

  it('EN dictionary covers every catalog code', () => {
    const enKeys = new Set(Object.keys(ERROR_MESSAGES_EN));
    const missing = allCodes.filter((c) => !enKeys.has(c));
    expect(missing).toEqual([]);
  });

  it('FR dictionary has no extra codes beyond the catalog', () => {
    const catalogKeys = new Set(allCodes as string[]);
    const extra = Object.keys(ERROR_MESSAGES_FR).filter(
      (k) => !catalogKeys.has(k),
    );
    expect(extra).toEqual([]);
  });

  it('EN dictionary has no extra codes beyond the catalog', () => {
    const catalogKeys = new Set(allCodes as string[]);
    const extra = Object.keys(ERROR_MESSAGES_EN).filter(
      (k) => !catalogKeys.has(k),
    );
    expect(extra).toEqual([]);
  });

  it('no message is empty', () => {
    for (const code of allCodes) {
      expect(ERROR_MESSAGES_FR[code].length).toBeGreaterThan(0);
      expect(ERROR_MESSAGES_EN[code].length).toBeGreaterThan(0);
    }
  });

  it('FR and EN messages differ for every code', () => {
    for (const code of allCodes) {
      expect(ERROR_MESSAGES_FR[code]).not.toBe(ERROR_MESSAGES_EN[code]);
    }
  });
});

describe('D12.1 — getErrorMessage', () => {
  it('returns the French message', () => {
    const msg = getErrorMessage('GRAPH.NODE_ORPHAN', 'fr');
    expect(msg).toContain('arête');
  });

  it('returns the English message', () => {
    const msg = getErrorMessage('GRAPH.NODE_ORPHAN', 'en');
    expect(msg).toContain('edge');
  });

  it('returns undefined for unknown language', () => {
    expect(getErrorMessage('GRAPH.NODE_ORPHAN', 'de')).toBeUndefined();
  });
});

describe('D12.1 — getSupportedErrorLangs', () => {
  it('returns fr and en', () => {
    const langs = getSupportedErrorLangs();
    expect(langs).toContain('fr');
    expect(langs).toContain('en');
    expect(langs.length).toBe(2);
  });
});
