import { describe, it, expect } from 'vitest';
import { zoneOfView } from '../presence-zone.js';

const VIEWPORT = { width_px: 640, height_px: 420 };

describe('S6.7c — la zone de travail d’une vue', () => {
  it('le rectangle montré, en mètres, centré sur la vue', () => {
    expect(zoneOfView({ centerX_m: 10, centerY_m: 5, scale_px_per_m: 20, rotationDeg: 0 }, VIEWPORT))
      .toEqual({ x: -6, y: -5.5, w: 32, h: 21 });
  });

  it('arrondie au centimètre : un glissement imperceptible ne change rien', () => {
    const a = zoneOfView({ centerX_m: 10, centerY_m: 5, scale_px_per_m: 20, rotationDeg: 0 }, VIEWPORT);
    const b = zoneOfView({ centerX_m: 10.001, centerY_m: 5.002, scale_px_per_m: 20, rotationDeg: 0 }, VIEWPORT);
    expect(b).toEqual(a);
  });

  it('une échelle dégénérée ou une zone hors bornes ne se publie pas', () => {
    expect(zoneOfView({ centerX_m: 0, centerY_m: 0, scale_px_per_m: 0, rotationDeg: 0 }, VIEWPORT)).toBeNull();
    expect(zoneOfView({ centerX_m: 0, centerY_m: 0, scale_px_per_m: 0.0001, rotationDeg: 0 }, VIEWPORT)).toBeNull();
    expect(zoneOfView({ centerX_m: 2e6, centerY_m: 0, scale_px_per_m: 20, rotationDeg: 0 }, VIEWPORT)).toBeNull();
  });
});
