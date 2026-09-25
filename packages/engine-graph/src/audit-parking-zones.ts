import type { Finding, SiteData, SiteZone } from '@azimut/core-model';
import { isParkingSpaceFootprint, isParkingZone } from '@azimut/core-model';

/**
 * Places de stationnement et zones qui les portent — section S8.
 *
 * « Une place de stationnement est une empreinte de nature `parking_space`. Un
 * parking est une zone de nature `parking`. Aucune table nouvelle : ce sont les
 * objets du socle, module 01. » Règle S-35.
 *
 * Le contrôle que la section ouvre est `DATA.PARKING_SPACE_WITHOUT_ZONE`,
 * « Place de stationnement hors de toute zone de nature `parking` », en
 * avertissement. Il n'était pas calculable avant la version 17 : A5.2 ne
 * donnait à `zone` ni géométrie ni liste d'empreintes, et rien ne permettait de
 * dire qu'une empreinte appartenait à une zone. La colonne `footprint_ids`,
 * posée par la migration 0048, le permet.
 *
 * **Pourquoi un avertissement et non un refus.** Une place orpheline n'est pas
 * une faute de géométrie : elle est tracée, elle existe, et elle compte au
 * relevé. Ce qu'elle dit, c'est qu'aucun parking ne la revendique, donc
 * qu'aucune capacité annoncée ne la couvre et qu'elle échappe à la
 * comparaison de S-36. C'est un trou dans la déclaration, pas dans le plan, et
 * c'est la gravité que S10 lui donne.
 *
 * **L'appartenance est déclarée, non calculée**, et A5.2 le dit deux fois. Ce
 * module ne regarde donc aucune géométrie : il ne teste pas si le tracé d'une
 * place tombe dans celui d'un parking. Le faire inventerait un seuil de
 * recouvrement qu'aucune section ne donne, et contredirait la section qui a
 * justement choisi de le déclarer.
 */
export type ParkingZoneReport = {
  readonly space_count: number;
  readonly parking_zone_count: number;
  readonly findings: readonly Finding[];
};

/** Les zones de nature `parking` du site, dans l'ordre de leur identifiant. */
function parkingZones(zones: readonly SiteZone[]): readonly SiteZone[] {
  return [...zones]
    .filter(zone => isParkingZone(zone.kind))
    .sort((l, r) => l.id.localeCompare(r.id));
}

/**
 * Audite le rattachement des places de stationnement aux parkings.
 *
 * Les anomalies sortent dans l'ordre des identifiants d'empreinte, jamais dans
 * celui des lignes : deux lectures d'un même état rendent le même rapport (A9).
 */
export function auditParkingZones(site: SiteData): ParkingZoneReport {
  const zones = parkingZones(site.zones ?? []);

  // Une seule table d'appartenance, bâtie une fois. La construire par place
  // coûterait le produit des deux listes, et un site à mille places dans dix
  // parkings est un cas ordinaire, pas un cas limite.
  const claimed = new Set<string>();
  for (const zone of zones) {
    for (const id of zone.footprint_ids) claimed.add(id);
  }

  const spaces = site.footprints
    .filter(footprint => isParkingSpaceFootprint(footprint.kind))
    .sort((l, r) => l.id.localeCompare(r.id));

  const findings: Finding[] = [];
  for (const space of spaces) {
    if (claimed.has(space.id)) continue;
    findings.push({
      code: 'DATA.PARKING_SPACE_WITHOUT_ZONE',
      severity: 'warning',
      entity: { kind: 'footprint', id: space.id },
      params: { level_id: space.level_id, parking_zones: zones.length },
      ruleRef: 'S-35',
    });
  }

  return {
    space_count: spaces.length,
    parking_zone_count: zones.length,
    findings,
  };
}
