import type { IsoPoint, IsoTransform } from './projection.js';
import { projectTopFace } from './projection.js';
import type { VolumeEntry } from './painter-sort.js';

export type HitZone = {
  readonly volume_id: string;
  readonly footprint_id: string;
  readonly polygon: readonly IsoPoint[];
};

export function extractHitZones(
  sortedEntries: readonly VolumeEntry[],
  t: IsoTransform,
): readonly HitZone[] {
  const zones: HitZone[] = [];
  for (const entry of sortedEntries) {
    const topZ = entry.volume.base_elevation_m + entry.volume.height_m;
    const polygon = projectTopFace(
      entry.footprint.geometry.vertices,
      topZ,
      t,
    );
    zones.push({
      volume_id: entry.volume.id,
      footprint_id: entry.footprint.id,
      polygon,
    });
  }
  zones.reverse();
  return zones;
}
