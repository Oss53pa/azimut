import { describe, it, expect } from 'vitest';
import {
  normalizeDecimalSeparator,
  parseNumber,
  parseCsvLine,
  detectSeparator,
  stripBom,
  detectColumns,
} from '../csv-utils.js';

describe('normalizeDecimalSeparator', () => {
  it('replaces comma with dot', () => {
    expect(normalizeDecimalSeparator('3,14')).toBe('3.14');
  });

  it('leaves dots untouched', () => {
    expect(normalizeDecimalSeparator('3.14')).toBe('3.14');
  });

  it('handles no decimal', () => {
    expect(normalizeDecimalSeparator('42')).toBe('42');
  });

  it('replaces only the first comma', () => {
    // String.replace without /g replaces only the first occurrence.
    expect(normalizeDecimalSeparator('1,000,50')).toBe('1.000,50');
  });
});

describe('parseNumber', () => {
  it('parses integer', () => {
    expect(parseNumber('42')).toBe(42);
  });

  it('parses float with dot', () => {
    expect(parseNumber('3.14')).toBe(3.14);
  });

  it('parses float with comma', () => {
    expect(parseNumber('3,14')).toBe(3.14);
  });

  it('returns null for empty string', () => {
    expect(parseNumber('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parseNumber('   ')).toBeNull();
  });

  it('returns null for non-numeric', () => {
    expect(parseNumber('abc')).toBeNull();
  });

  it('trims whitespace', () => {
    expect(parseNumber('  7  ')).toBe(7);
  });

  it('returns null for Infinity', () => {
    expect(parseNumber('Infinity')).toBeNull();
  });

  it('returns null for NaN', () => {
    expect(parseNumber('NaN')).toBeNull();
  });

  it('parses negative integers', () => {
    expect(parseNumber('-42')).toBe(-42);
  });

  it('parses negative float with comma', () => {
    expect(parseNumber('-3,14')).toBe(-3.14);
  });

  it('parses leading dot', () => {
    expect(parseNumber('.5')).toBe(0.5);
  });

  it('parses trailing dot', () => {
    expect(parseNumber('5.')).toBe(5);
  });

  it('returns null for thousand-separator commas', () => {
    // normalizeDecimalSeparator only replaces first comma
    // "1,000,000" → "1.000,000" → NaN → null
    expect(parseNumber('1,000,000')).toBeNull();
  });
});

describe('parseCsvLine', () => {
  it('splits by semicolon', () => {
    expect(parseCsvLine('a;b;c', ';')).toEqual(['a', 'b', 'c']);
  });

  it('splits by comma', () => {
    expect(parseCsvLine('a,b,c', ',')).toEqual(['a', 'b', 'c']);
  });

  it('splits by tab', () => {
    expect(parseCsvLine('a\tb\tc', '\t')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted fields', () => {
    expect(parseCsvLine('"hello";world', ';')).toEqual(['hello', 'world']);
  });

  it('handles escaped quotes inside quoted fields', () => {
    expect(parseCsvLine('"say ""hi""";ok', ';')).toEqual(['say "hi"', 'ok']);
  });

  it('handles separator inside quoted field', () => {
    expect(parseCsvLine('"a;b";c', ';')).toEqual(['a;b', 'c']);
  });

  it('handles empty fields', () => {
    expect(parseCsvLine(';;', ';')).toEqual(['', '', '']);
  });

  it('handles single field', () => {
    expect(parseCsvLine('only', ';')).toEqual(['only']);
  });

  it('handles empty quoted fields', () => {
    expect(parseCsvLine('"";""', ';')).toEqual(['', '']);
  });

  it('handles newline inside quoted field', () => {
    expect(parseCsvLine('"line1\nline2";ok', ';')).toEqual([
      'line1\nline2',
      'ok',
    ]);
  });

  it('handles empty string input', () => {
    expect(parseCsvLine('', ';')).toEqual(['']);
  });

  it('treats unclosed quote as consuming rest of line', () => {
    expect(parseCsvLine('"unclosed;field', ';')).toEqual([
      'unclosed;field',
    ]);
  });
});

describe('detectSeparator', () => {
  it('detects semicolons', () => {
    expect(detectSeparator('a;b;c')).toBe(';');
  });

  it('detects commas', () => {
    expect(detectSeparator('a,b,c')).toBe(',');
  });

  it('detects tabs', () => {
    expect(detectSeparator('a\tb\tc')).toBe('\t');
  });

  it('prefers tab over semicolon at equal count', () => {
    expect(detectSeparator('a\tb;c')).toBe('\t');
  });

  it('prefers semicolon over comma at equal count', () => {
    expect(detectSeparator('a;b,c')).toBe(';');
  });

  it('returns tab for empty string (all counts zero, tab wins ties)', () => {
    expect(detectSeparator('')).toBe('\t');
  });

  it('returns tab for single character with no separators', () => {
    expect(detectSeparator('a')).toBe('\t');
  });
});

describe('stripBom', () => {
  it('removes UTF-8 BOM', () => {
    expect(stripBom('﻿hello')).toBe('hello');
  });

  it('leaves clean text unchanged', () => {
    expect(stripBom('hello')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(stripBom('')).toBe('');
  });
});

describe('detectColumns', () => {
  it('matches columns by alias', () => {
    const aliases = {
      name: ['name', 'nom'],
      code: ['code', 'ref'],
    };
    const result = detectColumns(['Nom', 'Code'], aliases, ['name', 'code']);
    expect(result).toEqual({ name: 'Nom', code: 'Code' });
  });

  it('returns null when required column is missing', () => {
    const aliases = {
      name: ['name', 'nom'],
      code: ['code', 'ref'],
    };
    const result = detectColumns(['Nom'], aliases, ['name', 'code']);
    expect(result).toBeNull();
  });

  it('matches case-insensitively', () => {
    const aliases = { name: ['name'] };
    const result = detectColumns(['NAME'], aliases, ['name']);
    expect(result).toEqual({ name: 'NAME' });
  });

  it('matches accent-insensitively', () => {
    const aliases = { level: ['etage'] };
    const result = detectColumns(['Étage'], aliases, ['level']);
    expect(result).toEqual({ level: 'Étage' });
  });

  it('finds optional columns too', () => {
    const aliases = {
      name: ['name'],
      notes: ['notes', 'remarques'],
    };
    const result = detectColumns(
      ['Name', 'Remarques'],
      aliases,
      ['name'],
    );
    expect(result).toEqual({ name: 'Name', notes: 'Remarques' });
  });

  it('handles empty headers', () => {
    const aliases = { name: ['name'] };
    const result = detectColumns([], aliases, ['name']);
    expect(result).toBeNull();
  });

  it('matches first occurrence for duplicate column headers', () => {
    const aliases = { name: ['name'] };
    const result = detectColumns(['Name', 'Name'], aliases, ['name']);
    expect(result).toEqual({ name: 'Name' });
  });

  it('succeeds with empty required array', () => {
    const aliases = { name: ['name'] };
    const result = detectColumns(['Name'], aliases, []);
    expect(result).not.toBeNull();
    expect(result).toEqual({ name: 'Name' });
  });

  it('returns empty object when no aliases match and required is empty', () => {
    const aliases = { name: ['xyz'] };
    const result = detectColumns(['Name'], aliases, []);
    expect(result).not.toBeNull();
    expect(result).toEqual({});
  });
});
