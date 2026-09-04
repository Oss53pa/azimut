import { describe, it, expect } from 'vitest';
import {
  transliterate,
  sanitizeSegment,
  buildFileName,
  buildArchiveName,
} from '../file-naming.js';

describe('D11 — transliterate', () => {
  it('replaces accented characters', () => {
    expect(transliterate('Réception')).toBe('Reception');
    expect(transliterate('Étage')).toBe('Etage');
    expect(transliterate('Bâtiment')).toBe('Batiment');
  });

  it('handles ligatures', () => {
    expect(transliterate('Œuvre')).toBe('OEuvre');
    expect(transliterate('Über')).toBe('Uber');
  });

  it('handles German ß ligature', () => {
    expect(transliterate('Straße')).toBe('StraSSe');
  });

  it('preserves ASCII', () => {
    expect(transliterate('ABC-123')).toBe('ABC-123');
  });

  it('is deterministic', () => {
    const input = 'Héliport café';
    expect(transliterate(input)).toBe(transliterate(input));
  });
});

describe('D11 — sanitizeSegment', () => {
  it('uppercases and removes spaces', () => {
    expect(sanitizeSegment('Bureau A')).toBe('BUREAUA');
  });

  it('transliterates then sanitizes', () => {
    expect(sanitizeSegment('Réception')).toBe('RECEPTION');
  });

  it('keeps hyphens and digits', () => {
    expect(sanitizeSegment('D-042')).toBe('D-042');
  });

  it('strips special characters', () => {
    expect(sanitizeSegment('Hall #1 (bis)')).toBe('HALL1BIS');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeSegment('')).toBe('');
  });

  it('returns empty for all-special-characters input', () => {
    expect(sanitizeSegment('!@#$%^&*()')).toBe('');
  });
});

describe('D11 — buildFileName', () => {
  it('produces the example from the spec', () => {
    const result = buildFileName({
      site_code: 'CPL',
      building: 'A',
      level: 'R1',
      type_code: 'DIR',
      reference: 'D-042',
      version: 3,
      face: 'F1',
      extension: 'pdf',
    });
    expect(result).toBe('CPL_A_R1_DIR_D-042_V3_F1.PDF');
  });

  it('transliterates accented segments', () => {
    const result = buildFileName({
      site_code: 'Hôpital',
      building: 'Bât-B',
      level: 'RDC',
      type_code: 'DIR',
      reference: 'P-001',
      version: 1,
      face: 'F1',
      extension: 'svg',
    });
    expect(result).toBe('HOPITAL_BAT-B_RDC_DIR_P-001_V1_F1.SVG');
  });

  it('is deterministic', () => {
    const parts = {
      site_code: 'Étoile',
      building: 'C',
      level: 'SS1',
      type_code: 'MUR',
      reference: 'M-007',
      version: 2,
      face: 'F2',
      extension: 'pdf',
    } as const;
    expect(buildFileName(parts)).toBe(buildFileName(parts));
  });

  it('stays under 120 characters', () => {
    const result = buildFileName({
      site_code: 'A'.repeat(30),
      building: 'B'.repeat(30),
      level: 'C'.repeat(30),
      type_code: 'D'.repeat(30),
      reference: 'E'.repeat(30),
      version: 999,
      face: 'F'.repeat(30),
      extension: 'pdf',
    });
    expect(result.length).toBeLessThanOrEqual(120);
  });

  it('truncates from the middle with marker', () => {
    const result = buildFileName({
      site_code: 'A'.repeat(30),
      building: 'B'.repeat(30),
      level: 'C'.repeat(20),
      type_code: 'D'.repeat(20),
      reference: 'E'.repeat(20),
      version: 1,
      face: 'F1',
      extension: 'pdf',
    });
    expect(result).toContain('~');
    expect(result.length).toBe(120);
  });

  it('handles dot-prefixed extension', () => {
    const result = buildFileName({
      site_code: 'X',
      building: 'Y',
      level: 'Z',
      type_code: 'DIR',
      reference: 'R-01',
      version: 1,
      face: 'F1',
      extension: '.pdf',
    });
    expect(result).toBe('X_Y_Z_DIR_R-01_V1_F1.PDF');
  });

  it('handles version 0', () => {
    const result = buildFileName({
      site_code: 'X',
      building: 'Y',
      level: 'Z',
      type_code: 'DIR',
      reference: 'R-01',
      version: 0,
      face: 'F1',
      extension: 'svg',
    });
    expect(result).toContain('V0');
    expect(result).toBe('X_Y_Z_DIR_R-01_V0_F1.SVG');
  });

  it('produces empty segments for all-special inputs', () => {
    const result = buildFileName({
      site_code: '!!!',
      building: '@@@',
      level: '###',
      type_code: 'DIR',
      reference: 'R-01',
      version: 1,
      face: 'F1',
      extension: 'pdf',
    });
    expect(result).toBe('___DIR_R-01_V1_F1.PDF');
  });
});

describe('D11 — buildArchiveName', () => {
  it('omits support-specific segments', () => {
    const result = buildArchiveName({
      site_code: 'CPL',
      building: 'A',
      level: 'R1',
      version: 3,
      extension: 'zip',
    });
    expect(result).toBe('CPL_A_R1_V3.ZIP');
  });

  it('stays under 120 characters', () => {
    const result = buildArchiveName({
      site_code: 'LONG'.repeat(20),
      building: 'NAME'.repeat(20),
      level: 'LVL'.repeat(20),
      version: 99,
      extension: 'zip',
    });
    expect(result.length).toBeLessThanOrEqual(120);
  });

  it('is deterministic (INV-4)', () => {
    const parts = {
      site_code: 'Hôpital',
      building: 'Bât-C',
      level: 'R1',
      version: 2,
      extension: 'zip',
    } as const;
    expect(buildArchiveName(parts)).toBe(buildArchiveName(parts));
  });

  it('truncation inserts ~ marker when over limit', () => {
    const result = buildArchiveName({
      site_code: 'LONG'.repeat(20),
      building: 'NAME'.repeat(20),
      level: 'LVL'.repeat(20),
      version: 99,
      extension: 'zip',
    });
    expect(result).toContain('~');
    expect(result.length).toBe(120);
  });
});

describe('D11 — buildFileName truncation symmetry', () => {
  it('head is at least as long as tail after truncation', () => {
    const result = buildFileName({
      site_code: 'A'.repeat(30),
      building: 'B'.repeat(30),
      level: 'C'.repeat(20),
      type_code: 'D'.repeat(10),
      reference: 'E'.repeat(10),
      version: 1,
      face: 'F1',
      extension: 'pdf',
    });
    expect(result.length).toBeLessThanOrEqual(120);
    if (result.includes('~')) {
      const tildeIdx = result.indexOf('~');
      const head = result.slice(0, tildeIdx);
      const tail = result.slice(tildeIdx + 1);
      expect(head.length).toBeGreaterThanOrEqual(tail.length);
    }
  });
});
