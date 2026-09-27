/**
 * Module 01 — les lignes de la fiche de site : un niveau par ligne, et ce que
 * le site en sait. Tout est dérivé des données du site (INV-1) ; rien ne
 * s'enregistre ici.
 */
import { calibratedLevelIds, isUsableScale, polygonArea, type SiteData } from '@azimut/core-model';

export type PlanState = 'calibrated' | 'uncalibrated' | 'absent';

export type LevelRow = {
  readonly id: string;
  readonly name: string;
  readonly ordinal: number;
  readonly buildingId: string;
  readonly buildingName: string;
  readonly elevationM: number;
  /** Nom du dernier fond importé pour ce niveau, sans son chemin. */
  readonly planFile: string | null;
  readonly planState: PlanState;
  /** Somme des surfaces des empreintes du niveau, en m². */
  readonly footprintAreaM2: number;
  readonly footprints: number;
  readonly nodes: number;
  readonly supports: number;
  readonly destinations: number;
  /** Dernier import ou calage d'un fond de ce niveau, ISO 8601. */
  readonly updatedAt: string | undefined;
};

function latest(a: string | undefined, b: string | undefined): string | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return a >= b ? a : b;
}

function countBy<T>(items: readonly T[], key: (item: T) => string | undefined): Map<string, number> {
  const out = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k !== undefined) out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

export function levelRows(site: SiteData): readonly LevelRow[] {
  const buildings = new Map(site.buildings.map(b => [b.id, b.name]));
  const calibrated = calibratedLevelIds(site.plan_sources, site.plan_calibrations);
  const nodeLevel = new Map(site.graph.nodes.map(n => [n.id, n.level_id]));
  const footprintLevel = new Map(site.footprints.map(f => [f.id, f.level_id]));

  const nodes = countBy(site.graph.nodes, n => n.level_id);
  const supports = countBy(site.supports, s => nodeLevel.get(s.node_id));
  const destinations = countBy(site.destinations, d => footprintLevel.get(d.footprint_id));
  const footprints = countBy(site.footprints, f => f.level_id);

  const area = new Map<string, number>();
  for (const f of site.footprints) {
    area.set(f.level_id, (area.get(f.level_id) ?? 0) + polygonArea(f.geometry));
  }

  const calibrationOf = new Map<string, string | undefined>();
  for (const c of site.plan_calibrations) {
    if (!isUsableScale(c.scale_m_per_px)) continue;
    calibrationOf.set(c.plan_source_id, latest(calibrationOf.get(c.plan_source_id), c.calibrated_at));
  }

  return [...site.levels]
    .map((level): LevelRow => {
      // Le dernier fond importé fait foi ; à date égale, l'identifiant tranche (INV-4).
      const sources = site.plan_sources
        .filter(s => s.level_id === level.id)
        .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at) || a.id.localeCompare(b.id));
      const source = sources[0];
      let updatedAt: string | undefined;
      for (const s of sources) updatedAt = latest(updatedAt, latest(s.uploaded_at, calibrationOf.get(s.id)));
      return {
        id: level.id,
        name: level.name,
        ordinal: level.ordinal,
        buildingId: level.building_id,
        buildingName: buildings.get(level.building_id) ?? level.building_id,
        elevationM: level.elevation_m,
        planFile: source === undefined ? null : (source.storage_path.split('/').pop() ?? source.storage_path),
        planState: source === undefined ? 'absent' : calibrated.has(level.id) ? 'calibrated' : 'uncalibrated',
        footprintAreaM2: area.get(level.id) ?? 0,
        footprints: footprints.get(level.id) ?? 0,
        nodes: nodes.get(level.id) ?? 0,
        supports: supports.get(level.id) ?? 0,
        destinations: destinations.get(level.id) ?? 0,
        updatedAt,
      };
    })
    .sort((a, b) => a.buildingName.localeCompare(b.buildingName)
      || a.ordinal - b.ordinal || a.id.localeCompare(b.id));
}
