import type { SiteData, Outcome, Finding } from '@azimut/core-model';

export type PlacedSupport = {
  readonly id: string;
  readonly node_id: string;
  readonly support_type_key: string;
};

export type TypeQuantity = {
  readonly support_type_key: string;
  readonly support_type_name: string;
  readonly count: number;
  readonly face_count: number;
};

export type BuildingQuantity = {
  readonly building_id: string;
  readonly building_name: string;
  readonly count: number;
};

export type LevelQuantity = {
  readonly level_id: string;
  readonly level_name: string;
  readonly building_id: string;
  readonly count: number;
};

export type QuantityReport = {
  readonly total_supports: number;
  readonly total_faces: number;
  readonly by_type: readonly TypeQuantity[];
  readonly by_building: readonly BuildingQuantity[];
  readonly by_level: readonly LevelQuantity[];
  readonly cross_check_ok: boolean;
};

function sumCounts(items: readonly { count: number }[]): number {
  let s = 0;
  for (const item of items) s += item.count;
  return s;
}

export function computeQuantities(
  site: SiteData,
  supports: readonly PlacedSupport[],
): Outcome<QuantityReport> {
  const warnings: Finding[] = [];

  const nodeToLevel = new Map<string, string>();
  for (const n of site.graph.nodes) {
    nodeToLevel.set(n.id, n.level_id);
  }

  const levelToBuilding = new Map<string, string>();
  for (const lvl of site.levels) {
    levelToBuilding.set(lvl.id, lvl.building_id);
  }

  const typeMap = new Map<string, { name: string; faceCount: number }>();
  for (const st of site.support_types) {
    typeMap.set(st.key, { name: st.name, faceCount: st.face_count });
  }

  const buildingNames = new Map<string, string>();
  for (const b of site.buildings) {
    buildingNames.set(b.id, b.name);
  }

  const levelNames = new Map<string, string>();
  for (const l of site.levels) {
    levelNames.set(l.id, l.name);
  }

  const byTypeCount = new Map<string, number>();
  const byBuildingCount = new Map<string, number>();
  const byLevelCount = new Map<string, number>();
  let orphanCount = 0;

  const sorted = [...supports].sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  for (const sup of sorted) {
    byTypeCount.set(
      sup.support_type_key,
      (byTypeCount.get(sup.support_type_key) ?? 0) + 1,
    );

    const levelId = nodeToLevel.get(sup.node_id);
    if (levelId === undefined) {
      orphanCount++;
      warnings.push({
        code: 'GRAPH.QUANTITY_NODE_NOT_FOUND',
        severity: 'warning',
        entity: { kind: 'support', id: sup.id },
        params: { node_id: sup.node_id },
        ruleRef: null,
      });
      continue;
    }

    byLevelCount.set(levelId, (byLevelCount.get(levelId) ?? 0) + 1);

    const buildingId = levelToBuilding.get(levelId);
    if (buildingId !== undefined) {
      byBuildingCount.set(
        buildingId,
        (byBuildingCount.get(buildingId) ?? 0) + 1,
      );
    }
  }

  const byType: TypeQuantity[] = [...byTypeCount.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => {
      const info = typeMap.get(key);
      return {
        support_type_key: key,
        support_type_name: info?.name ?? key,
        count,
        face_count: count * (info?.faceCount ?? 1),
      };
    });

  const byBuilding: BuildingQuantity[] = [...byBuildingCount.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, count]) => ({
      building_id: id,
      building_name: buildingNames.get(id) ?? id,
      count,
    }));

  const byLevel: LevelQuantity[] = [...byLevelCount.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, count]) => ({
      level_id: id,
      level_name: levelNames.get(id) ?? id,
      building_id: levelToBuilding.get(id) ?? '',
      count,
    }));

  const totalSupports = supports.length;
  let totalFaces = 0;
  for (const t of byType) totalFaces += t.face_count;

  const sumType = sumCounts(byType);
  const sumBuilding = sumCounts(byBuilding);
  const sumLevel = sumCounts(byLevel);

  const locatedCount = totalSupports - orphanCount;
  const crossCheckOk =
    sumType === totalSupports &&
    sumBuilding === locatedCount &&
    sumLevel === locatedCount;

  if (!crossCheckOk) {
    warnings.push({
      code: 'GRAPH.QUANTITY_CROSS_CHECK_FAILED',
      severity: 'blocking',
      entity: null,
      params: {
        total: totalSupports,
        sum_by_type: sumType,
        sum_by_building: sumBuilding,
        sum_by_level: sumLevel,
      },
      ruleRef: null,
    });
  }

  return {
    ok: true,
    value: {
      total_supports: totalSupports,
      total_faces: totalFaces,
      by_type: byType,
      by_building: byBuilding,
      by_level: byLevel,
      cross_check_ok: crossCheckOk,
    },
    warnings,
  };
}

function escapeCsvField(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function quantityReportToCsv(report: QuantityReport): string {
  const lines: string[] = [];

  lines.push(
    ['Type', 'Nom type', 'Nombre', 'Faces'].map(escapeCsvField).join(';'),
  );
  const sortedTypes = [...report.by_type].sort((a, b) =>
    a.support_type_key.localeCompare(b.support_type_key),
  );
  for (const t of sortedTypes) {
    lines.push(
      [
        t.support_type_key,
        t.support_type_name,
        String(t.count),
        String(t.face_count),
      ]
        .map(escapeCsvField)
        .join(';'),
    );
  }

  lines.push('');
  lines.push(
    ['Bâtiment', 'Nombre'].map(escapeCsvField).join(';'),
  );
  const sortedBuildings = [...report.by_building].sort((a, b) =>
    a.building_id.localeCompare(b.building_id),
  );
  for (const b of sortedBuildings) {
    lines.push(
      [b.building_name, String(b.count)]
        .map(escapeCsvField)
        .join(';'),
    );
  }

  lines.push('');
  lines.push(
    ['Niveau', 'Nombre'].map(escapeCsvField).join(';'),
  );
  const sortedLevels = [...report.by_level].sort((a, b) =>
    a.level_id.localeCompare(b.level_id),
  );
  for (const l of sortedLevels) {
    lines.push(
      [l.level_name, String(l.count)]
        .map(escapeCsvField)
        .join(';'),
    );
  }

  lines.push('');
  lines.push(
    ['Total supports', String(report.total_supports)].join(';'),
  );
  lines.push(
    ['Total faces', String(report.total_faces)].join(';'),
  );
  lines.push(
    ['Recoupement OK', report.cross_check_ok ? 'OUI' : 'NON'].join(';'),
  );

  return lines.join('\n');
}
