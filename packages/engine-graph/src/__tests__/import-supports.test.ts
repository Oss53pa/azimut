import { describe, it, expect } from 'vitest';
import { importSupports } from '../import-supports.js';
import { refMultilevel } from '@azimut/testkit';

const HEADER = 'reference;typology;building;level;node_ref';

function csv(lines: string[]): string {
  return [HEADER, ...lines].join('\n');
}

describe('D4.1 importSupports', () => {
  describe('valid import', () => {
    it('imports valid rows attached to a known node', () => {
      const result = importSupports(refMultilevel, csv([
        'S-1;DIR;A;RDC;n-ml-hall',
        'S-2;DIR;A;RDC;n-ml-entrance',
      ]));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.imported).toBe(2);
      expect(result.value.rejected).toBe(0);
      expect(result.value.pending).toBe(0);
    });

    it('optional fields default to null when absent', () => {
      const result = importSupports(refMultilevel, csv(['S-1;DIR;A;RDC;n-ml-hall']));
      if (!result.ok) return;
      const s = result.value.supports[0];
      expect(s?.substrate).toBeNull();
      expect(s?.condition).toBeNull();
      expect(s?.content_fr).toBeNull();
      expect(s?.dimensions_source).toBe('default');
    });
  });

  describe('obligatory columns', () => {
    it('rejects a file missing an obligatory column', () => {
      const result = importSupports(refMultilevel, 'reference;typology;building\nS-1;DIR;A');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.findings[0]?.code).toBe('IMPORT.COLUMN_MISSING');
    });

    it('rejects a row with an empty obligatory field', () => {
      const result = importSupports(refMultilevel, csv([';DIR;A;RDC;n-ml-hall']));
      if (!result.ok) return;
      expect(result.value.rejected).toBe(1);
      expect(result.value.lines[0]?.findings[0]?.code).toBe('IMPORT.ROW_INVALID');
    });
  });

  describe('position rule (node_ref or x_m/y_m)', () => {
    it('rejects a row with neither node_ref nor coordinates (IMPORT.ROW_INVALID)', () => {
      const result = importSupports(
        refMultilevel,
        'reference;typology;building;level\nS-1;DIR;A;RDC',
      );
      if (!result.ok) return;
      expect(result.value.rejected).toBe(1);
      const f = result.value.lines[0]?.findings[0];
      expect(f?.code).toBe('IMPORT.ROW_INVALID');
      expect(String(f?.params['reason'])).toContain('node_ref');
    });

    it('imports a row positioned by x_m/y_m alone', () => {
      const result = importSupports(
        refMultilevel,
        'reference;typology;building;level;x_m;y_m\nS-1;DIR;A;RDC;12.5;4.0',
      );
      if (!result.ok) return;
      expect(result.value.imported).toBe(1);
      const s = result.value.supports[0];
      expect(s?.x_m).toBe(12.5);
      expect(s?.y_m).toBe(4);
      expect(s?.node_ref).toBeNull();
    });

    it('puts an unknown node_ref in pending with IMPORT.NODE_NOT_FOUND', () => {
      const result = importSupports(refMultilevel, csv(['S-1;DIR;A;RDC;n-nope']));
      if (!result.ok) return;
      expect(result.value.pending).toBe(1);
      expect(result.value.rejected).toBe(0);
      const line = result.value.lines[0];
      expect(line?.status).toBe('pending');
      expect(line?.findings[0]?.code).toBe('IMPORT.NODE_NOT_FOUND');
      expect(line?.findings[0]?.params['node_ref']).toBe('n-nope');
    });
  });

  describe('dimensions override (D4.1)', () => {
    it('flips dimensions_source to overridden when width_mm/height_mm are given', () => {
      const result = importSupports(
        refMultilevel,
        'reference;typology;building;level;node_ref;width_mm;height_mm\n'
        + 'S-1;DIR;A;RDC;n-ml-hall;600;1200',
      );
      if (!result.ok) return;
      const s = result.value.supports[0];
      expect(s?.dimensions_source).toBe('overridden');
      expect(s?.width_mm).toBe(600);
      expect(s?.height_mm).toBe(1200);
    });
  });

  describe('condition enum and installed_at', () => {
    it('accepts a valid condition value', () => {
      const result = importSupports(
        refMultilevel,
        'reference;typology;building;level;node_ref;condition\n'
        + 'S-1;DIR;A;RDC;n-ml-hall;worn',
      );
      if (!result.ok) return;
      expect(result.value.supports[0]?.condition).toBe('worn');
    });

    it('rejects an invalid condition value', () => {
      const result = importSupports(
        refMultilevel,
        'reference;typology;building;level;node_ref;condition\n'
        + 'S-1;DIR;A;RDC;n-ml-hall;broken',
      );
      if (!result.ok) return;
      expect(result.value.rejected).toBe(1);
      expect(result.value.lines[0]?.findings[0]?.code).toBe('IMPORT.ROW_INVALID');
    });

    it('rejects a non-ISO installed_at', () => {
      const result = importSupports(
        refMultilevel,
        'reference;typology;building;level;node_ref;installed_at\n'
        + 'S-1;DIR;A;RDC;n-ml-hall;01/02/2026',
      );
      if (!result.ok) return;
      expect(result.value.rejected).toBe(1);
    });

    it('accepts an ISO installed_at', () => {
      const result = importSupports(
        refMultilevel,
        'reference;typology;building;level;node_ref;installed_at\n'
        + 'S-1;DIR;A;RDC;n-ml-hall;2026-02-01',
      );
      if (!result.ok) return;
      expect(result.value.supports[0]?.installed_at).toBe('2026-02-01');
    });
  });

  describe('declared decimal separator (D4.1)', () => {
    it('reads comma decimals when declared comma', () => {
      const result = importSupports(
        refMultilevel,
        'reference;typology;building;level;node_ref;reading_distance_m\n'
        + 'S-1;DIR;A;RDC;n-ml-hall;3,5',
        { decimalSeparator: 'comma' },
      );
      if (!result.ok) return;
      expect(result.value.supports[0]?.reading_distance_m).toBe(3.5);
    });

    it('rejects a comma value when declared point', () => {
      const result = importSupports(
        refMultilevel,
        'reference;typology;building;level;node_ref;reading_distance_m\n'
        + 'S-1;DIR;A;RDC;n-ml-hall;3,5',
        { decimalSeparator: 'point' },
      );
      if (!result.ok) return;
      expect(result.value.rejected).toBe(1);
    });
  });

  describe('CSV mechanics', () => {
    it('detects tab, semicolon and comma separators', () => {
      const tab = importSupports(
        refMultilevel,
        'reference\ttypology\tbuilding\tlevel\tnode_ref\nS-1\tDIR\tA\tRDC\tn-ml-hall',
      );
      const comma = importSupports(
        refMultilevel,
        'reference,typology,building,level,node_ref\nS-1,DIR,A,RDC,n-ml-hall',
      );
      expect(tab.ok && comma.ok).toBe(true);
      if (tab.ok) expect(tab.value.imported).toBe(1);
      if (comma.ok) expect(comma.value.imported).toBe(1);
    });

    it('handles columns in a different order and French aliases', () => {
      const result = importSupports(
        refMultilevel,
        'typologie;batiment;niveau;reference;noeud\nDIR;A;RDC;S-1;n-ml-hall',
      );
      if (!result.ok) return;
      expect(result.value.imported).toBe(1);
      expect(result.value.supports[0]?.reference).toBe('S-1');
    });

    it('strips a UTF-8 BOM', () => {
      const result = importSupports(refMultilevel, '﻿' + csv(['S-1;DIR;A;RDC;n-ml-hall']));
      if (!result.ok) return;
      expect(result.value.imported).toBe(1);
    });

    it('rejects an empty file', () => {
      const result = importSupports(refMultilevel, '');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.findings[0]?.code).toBe('IMPORT.EMPTY_FILE');
    });
  });

  describe('report and determinism', () => {
    it('produces one line per data row and never truncates', () => {
      const result = importSupports(refMultilevel, csv([
        'S-1;DIR;A;RDC;n-ml-hall',
        ';DIR;A;RDC;n-ml-hall',
        'S-3;DIR;A;RDC;n-nope',
      ]));
      if (!result.ok) return;
      expect(result.value.total_rows).toBe(3);
      expect(result.value.lines).toHaveLength(3);
      expect(result.value.imported).toBe(1);
      expect(result.value.rejected).toBe(1);
      expect(result.value.pending).toBe(1);
    });

    it('rejects a duplicate reference with IMPORT.DUPLICATE_KEY', () => {
      const result = importSupports(refMultilevel, csv([
        'S-1;DIR;A;RDC;n-ml-hall',
        'S-1;DIR;A;RDC;n-ml-entrance',
      ]));
      if (!result.ok) return;
      expect(result.value.imported).toBe(1);
      expect(result.value.rejected).toBe(1);
      const rej = result.value.lines.find((l) => l.status === 'rejected');
      expect(rej?.findings[0]?.code).toBe('IMPORT.DUPLICATE_KEY');
    });

    it('is deterministic across two calls', () => {
      const content = csv(['S-1;DIR;A;RDC;n-ml-hall', 'S-2;DIR;A;RDC;n-nope']);
      expect(importSupports(refMultilevel, content))
        .toStrictEqual(importSupports(refMultilevel, content));
    });
  });
});
