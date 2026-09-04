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
      expect(result.value.pending).toBe(0);
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
      expect(result.value.pending).toBe(1);
      const pending = result.value.lines.find(
        (l) => l.status === 'pending',
      );
      expect(pending?.row).toBe(3);
      expect(pending?.findings[0]?.code).toBe('IMPORT.NODE_NOT_FOUND');
    });
  });

  describe('edge cases', () => {
    it('rejects duplicate IDs with IMPORT.DUPLICATE_KEY', () => {
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
      expect(rej?.findings[0]?.code).toBe('IMPORT.DUPLICATE_KEY');
      expect(rej?.findings[0]?.params['key']).toBe('sup-1');
    });

    it('puts non-existent node_id in pending with IMPORT.NODE_NOT_FOUND', () => {
      const content = csv(['sup-1;n-does-not-exist;90;0.6;1.2']);
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.pending).toBe(1);
      expect(result.value.rejected).toBe(0);
      const line = result.value.lines[0];
      expect(line?.status).toBe('pending');
      expect(line?.support).not.toBeNull();
      expect(line?.findings[0]?.code).toBe('IMPORT.NODE_NOT_FOUND');
      expect(line?.findings[0]?.params['node_id']).toBe('n-does-not-exist');
    });

    it('rejects missing azimuth with IMPORT.ROW_INVALID', () => {
      const content = csv(['sup-1;n-ml-hall;;0.6;1.2']);
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.rejected).toBe(1);
      expect(result.value.lines[0]?.findings[0]?.code).toBe(
        'IMPORT.ROW_INVALID',
      );
    });

    it('rejects missing id or node_id with IMPORT.ROW_INVALID', () => {
      const content = csv([';n-ml-hall;90;0.6;1.2']);
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.rejected).toBe(1);
      expect(result.value.lines[0]?.findings[0]?.code).toBe(
        'IMPORT.ROW_INVALID',
      );
    });

    it('rejects invalid numeric fields with IMPORT.ROW_INVALID', () => {
      const content = csv(['sup-1;n-ml-hall;abc;0.6;1.2']);
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.rejected).toBe(1);
      expect(result.value.lines[0]?.findings[0]?.code).toBe(
        'IMPORT.ROW_INVALID',
      );
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

  describe('warnings propagation', () => {
    it('propagates row findings as Outcome warnings', () => {
      const content = csv([
        'sup-1;n-ml-hall;90;0.6;1.2',
        'sup-2;n-nonexistent;0;0.4;0.8',
      ]);
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]?.code).toBe('IMPORT.NODE_NOT_FOUND');
    });
  });

  describe('line-by-line report', () => {
    it('produces a line for every data row', () => {
      const content = csv([
        'sup-1;n-ml-hall;90;0.6;1.2',
        ';n-ml-hall;90;0.6;1.2',
        'sup-3;n-nonexistent;0;0.4;0.8',
      ]);
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.total_rows).toBe(3);
      expect(result.value.lines).toHaveLength(3);
      expect(result.value.imported).toBe(1);
      expect(result.value.rejected).toBe(1);
      expect(result.value.pending).toBe(1);
    });
  });

  describe('missing/invalid width_m rejection', () => {
    it('rejects missing width with largeur absente', () => {
      const content = csv(['sup-1;n-ml-hall;90;;1.2']);
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.rejected).toBe(1);
      const line = result.value.lines[0];
      expect(line?.findings[0]?.code).toBe('IMPORT.ROW_INVALID');
      expect(line?.findings[0]?.params['reason']).toBe('largeur absente');
    });

    it('rejects invalid width with largeur invalide', () => {
      const content = csv(['sup-1;n-ml-hall;90;abc;1.2']);
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.rejected).toBe(1);
      const line = result.value.lines[0];
      expect(line?.findings[0]?.code).toBe('IMPORT.ROW_INVALID');
      expect(line?.findings[0]?.params['reason']).toBe(
        'largeur invalide: abc',
      );
    });
  });

  describe('missing/invalid height_m rejection', () => {
    it('rejects missing height with hauteur absente', () => {
      const content = csv(['sup-1;n-ml-hall;90;0.6;']);
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.rejected).toBe(1);
      const line = result.value.lines[0];
      expect(line?.findings[0]?.code).toBe('IMPORT.ROW_INVALID');
      expect(line?.findings[0]?.params['reason']).toBe('hauteur absente');
    });

    it('rejects invalid height with hauteur invalide', () => {
      const content = csv(['sup-1;n-ml-hall;90;0.6;xyz']);
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.rejected).toBe(1);
      const line = result.value.lines[0];
      expect(line?.findings[0]?.code).toBe('IMPORT.ROW_INVALID');
      expect(line?.findings[0]?.params['reason']).toBe(
        'hauteur invalide: xyz',
      );
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

  describe('edge-case inputs', () => {
    it('rejects row with non-empty id but empty node_id', () => {
      const content = csv(['sup-1;;90;0.6;1.2']);
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.rejected).toBe(1);
      const f = result.value.lines[0]?.findings[0];
      expect(f?.code).toBe('IMPORT.ROW_INVALID');
    });

    it('header-only CSV produces zero rows', () => {
      const result = importSupports(refMultilevel, HEADER);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.total_rows).toBe(0);
      expect(result.value.imported).toBe(0);
      expect(result.value.rejected).toBe(0);
    });

    it('empty azimuth reports "azimut absent" reason', () => {
      const content = csv(['sup-az1;n-ml-hall;;0.6;1.2']);
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.rejected).toBe(1);
      const reason = result.value.lines[0]?.findings[0]?.params['reason'];
      expect(reason).toBe('azimut absent');
    });

    it('invalid azimuth reports "azimut invalide" reason with value', () => {
      const content = csv(['sup-az2;n-ml-hall;abc;0.6;1.2']);
      const result = importSupports(refMultilevel, content);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.rejected).toBe(1);
      const reason = result.value.lines[0]?.findings[0]?.params['reason'];
      expect(reason).toBe('azimut invalide: abc');
    });
  });
});
