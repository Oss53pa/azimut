import { describe, it, expect } from 'vitest';
import { importSupports } from '../import-supports.js';
import { refMultilevel } from '@azimut/testkit';

const HEADER = 'id;node_id;azimuth_deg;width_m;height_m';

function csv(lines: string[]): string {
  return [HEADER, ...lines].join('\n');
}

describe('T-1.13 importSupports', () => {
  describe('valid import', () => {
    it('imports valid rows', () => {
      const content = csv([
        'sup-1;n-ml-hall;90;0.6;1.2',
        'sup-2;n-ml-entrance;0;0.4;0.8',
      ]);
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.imported).toBe(2);
      expect(result.value.rejected).toBe(0);
      expect(result.value.supports.length).toBe(2);
    });
  });

  describe('partial import', () => {
    it('imports valid lines and rejects invalid ones', () => {
      const content = csv([
        'sup-1;n-ml-hall;90;0.6;1.2',
        'sup-2;n-nonexistent;0;0.4;0.8',
        'sup-3;n-ml-entrance;45;0.5;1.0',
      ]);
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.imported).toBe(2);
      expect(result.value.rejected).toBe(1);
      const rejected = result.value.lines.find(
        (l) => l.status === 'rejected',
      );
      expect(rejected?.row).toBe(3);
      expect(rejected?.errors.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('rejects duplicate IDs', () => {
      const content = csv([
        'sup-1;n-ml-hall;90;0.6;1.2',
        'sup-1;n-ml-entrance;0;0.4;0.8',
      ]);
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.imported).toBe(1);
      expect(result.value.rejected).toBe(1);
      const rej = result.value.lines.find(
        (l) => l.status === 'rejected',
      );
      expect(rej?.errors.some((e) => e.includes('doublon'))).toBe(
        true,
      );
    });

    it('rejects non-existent node_id', () => {
      const content = csv(['sup-1;n-does-not-exist;90;0.6;1.2']);
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.rejected).toBe(1);
      const rej = result.value.lines[0];
      expect(
        rej?.errors.some((e) => e.includes('inexistant')),
      ).toBe(true);
    });

    it('rejects missing azimuth', () => {
      const content = csv(['sup-1;n-ml-hall;;0.6;1.2']);
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.rejected).toBe(1);
      expect(
        result.value.lines[0]?.errors.some((e) =>
          e.includes('azimut'),
        ),
      ).toBe(true);
    });

    it('handles decimal comma (virgule)', () => {
      const content = csv(['sup-1;n-ml-hall;90,5;0,6;1,2']);
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.imported).toBe(1);
      const sup = result.value.supports[0];
      expect(sup?.azimuth_deg).toBe(90.5);
      expect(sup?.width_m).toBe(0.6);
      expect(sup?.height_m).toBe(1.2);
    });

    it('handles columns in different order', () => {
      const header =
        'width_m;id;hauteur;node_id;azimut';
      const content = [
        header,
        '0.6;sup-1;1.2;n-ml-hall;90',
      ].join('\n');
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.imported).toBe(1);
      expect(result.value.supports[0]?.id).toBe('sup-1');
      expect(result.value.supports[0]?.azimuth_deg).toBe(90);
    });

    it('handles French column aliases', () => {
      const header =
        'identifiant;noeud;orientation;largeur;hauteur';
      const content = [
        header,
        'sup-1;n-ml-hall;90;0.6;1.2',
      ].join('\n');
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.imported).toBe(1);
    });

    it('strips BOM from UTF-8 content', () => {
      const bom = '﻿';
      const content = bom + csv(['sup-1;n-ml-hall;90;0.6;1.2']);
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.imported).toBe(1);
    });

    it('handles tab-separated values', () => {
      const content =
        'id\tnode_id\tazimuth_deg\twidth_m\theight_m\n' +
        'sup-1\tn-ml-hall\t90\t0.6\t1.2';
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.imported).toBe(1);
    });

    it('handles comma-separated values', () => {
      const content =
        'id,node_id,azimuth_deg,width_m,height_m\n' +
        'sup-1,n-ml-hall,90,0.6,1.2';
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.imported).toBe(1);
    });
  });

  describe('error cases', () => {
    it('rejects empty file', () => {
      const result = importSupports(refMultilevel, '');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.findings[0]?.code).toBe('IMPORT.EMPTY_FILE');
    });

    it('rejects file with missing required columns', () => {
      const content = 'id;node_id;notes\nsup-1;n-ml-hall;hello';
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.findings[0]?.code).toBe(
        'IMPORT.COLUMN_MISSING',
      );
    });
  });

  describe('optional columns', () => {
    it('imports photo_url and notes when present', () => {
      const header =
        'id;node_id;azimuth_deg;width_m;height_m;photo;notes';
      const content = [
        header,
        'sup-1;n-ml-hall;90;0.6;1.2;http://example.com/p.jpg;RAS',
      ].join('\n');
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.supports[0]?.photo_url).toBe(
        'http://example.com/p.jpg',
      );
      expect(result.value.supports[0]?.notes).toBe('RAS');
    });
  });

  describe('determinism (INV-4)', () => {
    it('same report on two calls', () => {
      const content = csv([
        'sup-1;n-ml-hall;90;0.6;1.2',
        'sup-2;n-nonexistent;0;0.4;0.8',
      ]);
      const r1 = importSupports(refMultilevel, content);
      const r2 = importSupports(refMultilevel, content);
      expect(r1).toStrictEqual(r2);
    });
  });
});
