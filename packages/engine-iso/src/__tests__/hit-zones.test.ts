import { describe, it, expect } from 'vitest';
import { extractHitZones } from '../hit-zones.js';
import type { IsoTransform } from '../projection.js';
import type { VolumeEntry } from '../painter-sort.js';
import type { Footprint, Volume } from '@azimut/core-model';

const identityTransform: IsoTransform = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

function makeEntry(
  volumeId: string,
  footprintId: string,
  baseElevation: number,
  height: number,
  vertices: readonly { x_m: number; y_m: number }[],
): VolumeEntry {
  const footprint: Footprint = {
    id: footprintId,
    org_id: 'org1',
    level_id: 'l1',
    geometry: { vertices },
    kind: 'room',
  };
  const volume: Volume = {
    id: volumeId,
    org_id: 'org1',
    footprint_id: footprintId,
    base_elevation_m: baseElevation,
    height_m: height,
    material_key: 'concrete',
  };
  return { volume, footprint };
}

const squareVertices = [
  { x_m: 0, y_m: 0 },
  { x_m: 1, y_m: 0 },
  { x_m: 1, y_m: 1 },
  { x_m: 0, y_m: 1 },
];

describe('extractHitZones', () => {
  it('returns empty array for empty input', () => {
    const zones = extractHitZones([], identityTransform);
    expect(zones).toEqual([]);
  });

  it('creates one zone per entry', () => {
    const entries = [
      makeEntry('v1', 'f1', 0, 3, squareVertices),
      makeEntry('v2', 'f2', 0, 5, squareVertices),
    ];
    const zones = extractHitZones(entries, identityTransform);
    expect(zones).toHaveLength(2);
  });

  it('preserves volume_id and footprint_id', () => {
    const entries = [makeEntry('vol-a', 'fp-a', 0, 3, squareVertices)];
    const zones = extractHitZones(entries, identityTransform);
    expect(zones[0]?.volume_id).toBe('vol-a');
    expect(zones[0]?.footprint_id).toBe('fp-a');
  });

  it('polygon has same vertex count as footprint', () => {
    const triangle = [
      { x_m: 0, y_m: 0 },
      { x_m: 2, y_m: 0 },
      { x_m: 1, y_m: 2 },
    ];
    const entries = [makeEntry('v1', 'f1', 0, 3, triangle)];
    const zones = extractHitZones(entries, identityTransform);
    expect(zones[0]?.polygon).toHaveLength(3);
  });

  it('reverses order (last painted = first clickable)', () => {
    const entries = [
      makeEntry('v-back', 'f1', 0, 3, squareVertices),
      makeEntry('v-front', 'f2', 0, 3, squareVertices),
    ];
    const zones = extractHitZones(entries, identityTransform);
    expect(zones[0]?.volume_id).toBe('v-front');
    expect(zones[1]?.volume_id).toBe('v-back');
  });

  it('projects with transform scale', () => {
    const t: IsoTransform = { scale: 10, offsetX: 100, offsetY: 200 };
    const entries = [makeEntry('v1', 'f1', 0, 2, squareVertices)];
    const zones = extractHitZones(entries, t);
    // With scale=10 and offsets, polygons should differ from identity
    const zonesId = extractHitZones(entries, identityTransform);
    expect(zones[0]?.polygon).not.toEqual(zonesId[0]?.polygon);
  });

  it('top z uses base_elevation + height', () => {
    const low = [makeEntry('v-low', 'f1', 0, 1, squareVertices)];
    const high = [makeEntry('v-high', 'f1', 5, 3, squareVertices)];
    const zonesLow = extractHitZones(low, identityTransform);
    const zonesHigh = extractHitZones(high, identityTransform);
    // Higher topZ shifts y values down in iso projection
    expect(zonesLow[0]?.polygon).not.toEqual(zonesHigh[0]?.polygon);
  });

  it('single entry reversal is identity', () => {
    const entries = [makeEntry('v1', 'f1', 0, 3, squareVertices)];
    const zones = extractHitZones(entries, identityTransform);
    expect(zones).toHaveLength(1);
    expect(zones[0]?.volume_id).toBe('v1');
  });

  it('is deterministic (INV-4)', () => {
    const entries = [
      makeEntry('v1', 'f1', 0, 3, squareVertices),
      makeEntry('v2', 'f2', 3, 2, squareVertices),
    ];
    const z1 = extractHitZones(entries, identityTransform);
    const z2 = extractHitZones(entries, identityTransform);
    expect(z1).toStrictEqual(z2);
  });
});
