import { describe, it, expect } from 'vitest';
import type { Level } from '@azimut/core-model';
import { VOLUME_MATERIALS } from '@azimut/db/reference';
import { acceptVolume, volumeCommand, volumeDefaults } from '../volume-input.js';

/**
 * T-1.3 — « un volume sans hauteur est refusé ; les valeurs par défaut
 * proviennent du niveau, jamais d'une constante ».
 */
const level = (id: string, building: string, ordinal: number, elevation: number): Level =>
  ({ id, org_id: 'org', building_id: building, name: id, ordinal, elevation_m: elevation });

const LEVELS = [
  level('b1-r0', 'b1', 0, 0), level('b1-r1', 'b1', 1, 4.5), level('b1-r2', 'b1', 2, 8.2),
  level('b2-r0', 'b2', 0, 1.2), level('b2-r1', 'b2', 1, 1.2),
];
const KEYS = VOLUME_MATERIALS.map(m => m.key);

describe('T-1.3 — valeurs par défaut tirées du niveau', () => {
  it('l’altitude de base est celle du niveau, la hauteur l’écart au niveau suivant', () => {
    expect(volumeDefaults(LEVELS, 'b1-r0')).toEqual({ base_elevation_m: 0, height_m: 4.5 });
    expect(volumeDefaults(LEVELS, 'b1-r1')).toEqual({ base_elevation_m: 4.5, height_m: 3.7 });
  });

  it('un niveau d’un autre bâtiment n’entre pas dans l’écart', () => {
    expect(volumeDefaults(LEVELS, 'b2-r0')?.base_elevation_m).toBe(1.2);
    expect(volumeDefaults([level('b2-r0', 'b2', 0, 1.2), level('b1-r1', 'b1', 1, 4.5)], 'b2-r0'))
      .toEqual({ base_elevation_m: 1.2, height_m: null });
  });

  it('le dernier niveau n’a pas de hauteur par défaut : elle se saisit', () => {
    expect(volumeDefaults(LEVELS, 'b1-r2')).toEqual({ base_elevation_m: 8.2, height_m: null });
  });

  it('un niveau suivant à la même altitude ne donne pas une hauteur nulle', () => {
    expect(volumeDefaults(LEVELS, 'b2-r0')?.height_m).toBeNull();
  });

  it('un niveau inconnu ne donne rien, plutôt qu’une valeur supposée', () => {
    expect(volumeDefaults(LEVELS, 'absent')).toBeNull();
  });
});

describe('T-1.3 — acceptation d’un volume', () => {
  const draft = { footprintId: 'fp-1', base_elevation_m: 0, height_m: 3, material_key: 'concrete' };

  it('un volume complet est accepté, au millimètre', () => {
    const out = acceptVolume({ ...draft, height_m: 3.00049 }, KEYS);
    expect(out.ok && out.value.height_m).toBe(3);
  });

  it('un volume sans hauteur, ou de hauteur nulle, est refusé par GEOM.VOLUME_NO_HEIGHT', () => {
    for (const height of [null, 0, -1]) {
      const out = acceptVolume({ ...draft, height_m: height }, KEYS);
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.findings.map(f => f.code)).toEqual(['GEOM.VOLUME_NO_HEIGHT']);
    }
  });

  it('une matière non choisie, ou hors de la liste, est refusée', () => {
    for (const material of ['', 'marbre']) {
      const out = acceptVolume({ ...draft, material_key: material }, KEYS);
      expect(!out.ok && out.notices.map(n => n.key)).toEqual(['form.volume.material.required']);
    }
  });

  it('les refus sont réunis', () => {
    const out = acceptVolume({ footprintId: 'fp-1', base_elevation_m: null, height_m: null, material_key: '' }, KEYS);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.findings.map(f => f.code)).toEqual(['GEOM.VOLUME_NO_HEIGHT']);
    expect(out.notices.map(n => n.key)).toEqual(['form.volume.base.required', 'form.volume.material.required']);
  });

  it('« non précisée » est une matière de la liste', () => {
    expect(acceptVolume({ ...draft, material_key: 'unspecified' }, KEYS).ok).toBe(true);
  });
});

describe('T-1.3 — la commande du volume', () => {
  const accepted = { footprintId: 'fp-1', base_elevation_m: 0, height_m: 3, material_key: 'glass' };
  const write = { orgId: 'org', timestamp: '2026-11-28T10:00:00.000Z', newId: 'vol-1' };

  it('crée le volume quand l’empreinte n’en porte pas', () => {
    const out = volumeCommand(accepted, null, write);
    expect(out.ok && { op: out.value.operation, module: out.value.module, after: out.value.after }).toEqual({
      op: 'create', module: '01-socle',
      after: { id: 'vol-1', org_id: 'org', footprint_id: 'fp-1', base_elevation_m: 0, height_m: 3, material_key: 'glass' },
    });
  });

  it('modifie le volume existant, avant compris, sans en créer un second', () => {
    const out = volumeCommand(accepted, {
      id: 'vol-0', values: { base_elevation_m: 0, height_m: 4, material_key: 'concrete', footprint_id: 'fp-1' },
    }, write);
    expect(out.ok && { op: out.value.operation, id: out.value.id, before: out.value.before }).toEqual({
      op: 'update', id: 'vol-0', before: { base_elevation_m: 0, height_m: 4, material_key: 'concrete' },
    });
  });
});
