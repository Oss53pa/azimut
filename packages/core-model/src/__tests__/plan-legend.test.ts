import { describe, it, expect } from 'vitest';
import {
  deriveLegend, compassRoseAngleDeg, mapRotationForAzimuthDeg,
} from '../plan-legend.js';
import type { Category, Destination, Footprint } from '../site.js';

const ORG = 'aaaaaaaa-0000-0000-0000-000000000001';
const LEVEL = 'llllllll-0000-0000-0000-000000000001';
const OTHER_LEVEL = 'llllllll-0000-0000-0000-000000000002';

function category(id: string, code: string, sector_key = 'retail'): Category {
  return { id, org_id: ORG, sector_key, code, parent_id: null };
}

function footprint(id: string, level_id = LEVEL): Footprint {
  return {
    id, org_id: ORG, level_id, kind: 'cell',
    geometry: { vertices: [{ x_m: 0, y_m: 0 }, { x_m: 1, y_m: 0 }, { x_m: 1, y_m: 1 }] },
  };
}

function destination(id: string, footprint_id: string, category_id: string): Destination {
  return {
    id, org_id: ORG, footprint_id, category_id,
    node_id: 'nnnnnnnn-0000-0000-0000-000000000001',
    occupant_name: '', occupancy_status: 'occupied', display_priority: 5,
  };
}

const CATEGORIES = [
  category('cat-mode', 'MODE'),
  category('cat-resto', 'RESTAURATION'),
  category('cat-service', 'SERVICE'),
  category('cat-absente', 'ABSENTE'),
];

const FOOTPRINTS = [
  footprint('f-1'), footprint('f-2'), footprint('f-3'),
  footprint('f-9', OTHER_LEVEL),
];

const DESTINATIONS = [
  destination('d-1', 'f-1', 'cat-resto'),
  destination('d-2', 'f-2', 'cat-mode'),
  destination('d-3', 'f-3', 'cat-mode'),
  destination('d-9', 'f-9', 'cat-service'),
];

const SITE = { categories: CATEGORIES, destinations: DESTINATIONS, footprints: FOOTPRINTS };

describe('M01.S8 (partie N) — la légende est générée, jamais dessinée', () => {
  it('ne retient que les catégories réellement présentes sur le niveau', () => {
    expect(deriveLegend(SITE, LEVEL).map(e => e.code)).toEqual(['MODE', 'RESTAURATION']);
  });

  it('exclut une catégorie déclarée au catalogue mais employée nulle part', () => {
    expect(deriveLegend(SITE, LEVEL).some(e => e.code === 'ABSENTE')).toBe(false);
  });

  it('exclut une catégorie qui n’est présente qu’à un autre niveau', () => {
    expect(deriveLegend(SITE, LEVEL).some(e => e.code === 'SERVICE')).toBe(false);
    expect(deriveLegend(SITE, OTHER_LEVEL).map(e => e.code)).toEqual(['SERVICE']);
  });

  it('compte les destinations de chaque catégorie', () => {
    const entries = deriveLegend(SITE, LEVEL);
    expect(entries.find(e => e.code === 'MODE')?.count).toBe(2);
    expect(entries.find(e => e.code === 'RESTAURATION')?.count).toBe(1);
  });

  it('cesse de porter une catégorie dès que sa dernière destination s’en va', () => {
    // C'est la raison d'être de la dérivation : une légende dessinée
    // survivrait à ce qu'elle légende.
    const withoutResto = { ...SITE, destinations: DESTINATIONS.filter(d => d.id !== 'd-1') };
    expect(deriveLegend(withoutResto, LEVEL).map(e => e.code)).toEqual(['MODE']);
  });

  it('rend le même ordre quel que soit l’ordre d’entrée (A9)', () => {
    const shuffled = {
      ...SITE,
      categories: [...CATEGORIES].reverse(),
      destinations: [...DESTINATIONS].reverse(),
    };
    expect(deriveLegend(shuffled, LEVEL)).toEqual(deriveLegend(SITE, LEVEL));
  });

  it('départage deux catégories de même code par leur identifiant', () => {
    const twins = {
      categories: [category('cat-b', 'MODE'), category('cat-a', 'MODE')],
      footprints: [footprint('f-1'), footprint('f-2')],
      destinations: [destination('d-1', 'f-1', 'cat-b'), destination('d-2', 'f-2', 'cat-a')],
    };
    expect(deriveLegend(twins, LEVEL).map(e => e.category_id)).toEqual(['cat-a', 'cat-b']);
  });

  it('rend une légende vide sur un niveau sans destination, et non une erreur', () => {
    expect(deriveLegend({ ...SITE, destinations: [] }, LEVEL)).toEqual([]);
  });
});

describe('M01.S8 et D6.3 — la rose des vents est orientée depuis les données', () => {
  it('suit la rotation de la carte, pour que son nord tombe où le nord tombe', () => {
    expect(compassRoseAngleDeg(0)).toBe(0);
    expect(compassRoseAngleDeg(90)).toBe(90);
  });

  it('reste dans le domaine [0, 360[ de D1.3', () => {
    expect(compassRoseAngleDeg(-90)).toBe(270);
    expect(compassRoseAngleDeg(360)).toBe(0);
    expect(compassRoseAngleDeg(450)).toBe(90);
  });

  it('un plan mural tourne de l’opposé de l’azimut du support (D6.2)', () => {
    expect(mapRotationForAzimuthDeg(0)).toBe(0);
    expect(mapRotationForAzimuthDeg(90)).toBe(270);
    expect(mapRotationForAzimuthDeg(142)).toBe(218);
  });

  it('la rose d’un plan mural indique le nord malgré la rotation du plan', () => {
    // Support regardant l'est : le plan tourne de -90, donc l'est passe en
    // haut. La rose doit tourner d'autant, sans quoi elle désignerait l'est.
    const azimuth = 90;
    const rotation = mapRotationForAzimuthDeg(azimuth);
    expect(compassRoseAngleDeg(rotation)).toBe(270);
  });
});
