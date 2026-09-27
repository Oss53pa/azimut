/**
 * N2.2 — les lignes de l'écran « Zonage » : une zone d'orientation par ligne,
 * et ce que ses empreintes portent. La zone n'a pas de géométrie propre ;
 * sa surface est celle de ses empreintes (INV-1).
 */
import { polygonArea, type OrientationZone, type SiteData } from '@azimut/core-model';

export type ZoneRow = {
  readonly zone: OrientationZone;
  readonly areaM2: number;
  readonly destinations: number;
  /** Empreintes citées par la zone et absentes du site. */
  readonly missingFootprints: readonly string[];
  /** Empreintes que la zone partage avec une autre zone. */
  readonly sharedFootprints: readonly string[];
};

export function zoneRows(site: SiteData, zones: readonly OrientationZone[]): readonly ZoneRow[] {
  const footprints = new Map(site.footprints.map(f => [f.id, f]));
  const owners = new Map<string, number>();
  for (const z of zones) for (const id of new Set(z.footprint_ids)) owners.set(id, (owners.get(id) ?? 0) + 1);

  return [...zones]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((zone): ZoneRow => {
      const ids = [...new Set(zone.footprint_ids)];
      const present = ids.filter(id => footprints.has(id));
      const presentSet = new Set(present);
      return {
        zone,
        areaM2: present.reduce((sum, id) => {
          const fp = footprints.get(id);
          return fp === undefined ? sum : sum + polygonArea(fp.geometry);
        }, 0),
        destinations: site.destinations.filter(d => presentSet.has(d.footprint_id)).length,
        missingFootprints: ids.filter(id => !footprints.has(id)),
        sharedFootprints: ids.filter(id => (owners.get(id) ?? 0) > 1),
      };
    });
}
