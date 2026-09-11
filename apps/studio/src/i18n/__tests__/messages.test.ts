import { describe, it, expect } from 'vitest';
import {
  MESSAGES_FR,
  MESSAGES_EN,
  makeTranslate,
  interpolate,
  type UiMessageKey,
} from '../index.js';

describe('D12.1 — UI message catalogue', () => {
  const keys = Object.keys(MESSAGES_FR) as UiMessageKey[];

  it('has at least one key', () => {
    expect(keys.length).toBeGreaterThan(0);
  });

  it('FR and EN cover exactly the same keys', () => {
    expect(Object.keys(MESSAGES_EN).sort()).toEqual([...keys].sort());
  });

  it('no message is empty in either language', () => {
    for (const key of keys) {
      expect(MESSAGES_FR[key].length).toBeGreaterThan(0);
      expect(MESSAGES_EN[key].length).toBeGreaterThan(0);
    }
  });

  it('keys follow the domain.screen.element convention (lowercase dotted)', () => {
    // Lowercase, dot-separated segments; underscores and digits allowed inside
    // a segment so keys can mirror action/tool identifiers (e.g. select_all).
    const pattern = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
    for (const key of keys) {
      expect(pattern.test(key)).toBe(true);
    }
  });
});

describe('D12.1 — translator', () => {
  it('translates by language', () => {
    expect(makeTranslate('fr')('nav.item.checks')).toBe('Contrôles');
    expect(makeTranslate('en')('nav.item.checks')).toBe('Checks');
  });

  it('falls back to French for an unknown language', () => {
    expect(makeTranslate('de')('nav.item.checks')).toBe('Contrôles');
  });

  it('interpolates named placeholders', () => {
    expect(interpolate('a {x} b {y}', { x: 1, y: 'z' })).toBe('a 1 b z');
  });

  it('leaves unmatched placeholders untouched', () => {
    expect(interpolate('a {x}', {})).toBe('a {x}');
  });

  it('interpolates through the translator', () => {
    const t = makeTranslate('en');
    expect(t('checks.skipped', { list: 'A, B' })).toBe('Skipped: A, B');
  });
});
