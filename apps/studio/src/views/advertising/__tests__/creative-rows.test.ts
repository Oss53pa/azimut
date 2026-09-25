import { describe, it, expect } from 'vitest';
import type { AdCreative } from '@azimut/core-model';
import { receiveCreatives } from '../../../domain/ad-creative-intake.js';
import { REFERENCE_ADVERTISING } from '../../../data/reference-advertising.js';
import { creativeRows } from '../creative-rows.js';

const spec = REFERENCE_ADVERTISING.creative_spec;
if (spec === null) throw new Error('le jeu d’essai porte une fiche technique');
const { reception } = REFERENCE_ADVERTISING;

const storedCreative: AdCreative = {
  id: 'cr-9000', placement_id: 'AP-N0-01', format: 'png', resolution_dpi: 72, safe_zone_mm: 0,
  color_profile: 'RGB', weight_bytes: 10, storage_path: null, sanitation: 'clean', verdict: 'refused',
  received_at: '2026-09-01T00:00:00Z',
};

describe('H4.6 — visuels enregistrés et visuels en réception', () => {
  it('garde l’assainissement enregistré sans le recalculer, et ne rend pas un fichier non chargé', () => {
    const [row] = creativeRows([storedCreative], [], [], spec);
    expect(row?.origin).toBe('stored');
    expect(row?.sanitation).toBe('clean');
    expect(row?.renderable).toBe(false);
  });

  it('contrôle un visuel enregistré contre la fiche quand elle existe', () => {
    const [row] = creativeRows([storedCreative], [], [], spec);
    expect(row?.mismatches).toBeGreaterThan(0);
  });

  it('ne contrôle rien sans fiche technique, et le dit', () => {
    const [row] = creativeRows([storedCreative], [], [], null);
    expect(row?.mismatches).toBeNull();
    expect(row?.findings).toEqual([]);
  });

  it('range le constat de réception sous chaque visuel reçu', () => {
    const rows = creativeRows([], reception, receiveCreatives(reception, spec), spec);
    expect(rows.every(r => r.origin === 'received')).toBe(true);
    expect(rows.find(r => r.creative.id === 'cr-0261')?.clean_svg).not.toContain('<script');
  });

  it('ne tient pas pour assaini un visuel reçu sans constat', () => {
    const rows = creativeRows([], reception, [], spec);
    expect(rows.every(r => r.sanitation === 'deferred' && !r.renderable)).toBe(true);
  });
});
