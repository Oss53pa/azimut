import type { SiteData, Finding } from '@azimut/core-model';
import { guardNamingCollisions, type NamedEntity } from '../guard-naming.js';

/**
 * H2.2 — Orientation nomenclature uniqueness. Building names must be unique
 * within the site, and level names unique within their building (two levels
 * named alike in one building is a naming collision). Node/zone labels are left
 * out here to avoid flagging legitimately blank technical labels.
 */
export function checkNamingCollisions(site: SiteData): Finding[] {
  const entities: NamedEntity[] = [];
  for (const building of site.buildings) {
    entities.push({
      id: building.id,
      kind: 'building',
      name: building.name,
      scope: site.site.id,
    });
  }
  for (const level of site.levels) {
    entities.push({
      id: level.id,
      kind: 'level',
      name: level.name,
      scope: level.building_id,
    });
  }

  const outcome = guardNamingCollisions(entities);
  return outcome.ok ? [] : [...outcome.findings];
}
