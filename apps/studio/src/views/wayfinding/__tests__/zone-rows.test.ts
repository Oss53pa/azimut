import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit';
import { polygonArea, type OrientationZone } from '@azimut/core-model';
import { zoneRows } from '../zone-rows.js';

function zone(code: string, footprint_ids: readonly string[]): OrientationZone {
  return { id: `z-${code}`, code, name_fr: code, name_en: code, kind: 'mall', footprint_ids };
}

describe('N2.2 — zones d’orientation', () => {
  const [fp1, fp2] = refMultilevel.footprints;

  it('additionne la surface des empreintes de la zone', () => {
    if (fp1 === undefined || fp2 === undefined) throw new Error('empreintes manquantes');
    const [row] = zoneRows(refMultilevel, [zone('A', [fp1.id, fp2.id])]);
    expect(row?.areaM2).toBeCloseTo(polygonArea(fp1.geometry) + polygonArea(fp2.geometry), 9);
  });

  it('relève une empreinte absente du site et une empreinte partagée entre zones', () => {
    if (fp1 === undefined) throw new Error('empreinte manquante');
    const rows = zoneRows(refMultilevel, [zone('A', [fp1.id, 'fp-fantome']), zone('B', [fp1.id])]);
    expect(rows[0]?.missingFootprints).toEqual(['fp-fantome']);
    expect(rows[0]?.sharedFootprints).toEqual([fp1.id]);
    expect(rows[1]?.sharedFootprints).toEqual([fp1.id]);
  });

  it('compte les destinations posées sur les empreintes de la zone', () => {
    const ids = refMultilevel.footprints.map(f => f.id);
    const [row] = zoneRows(refMultilevel, [zone('TOUT', ids)]);
    expect(row?.destinations).toBe(refMultilevel.destinations.length);
  });
});
