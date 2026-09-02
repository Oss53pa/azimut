import type { SiteData, Outcome, Finding, OccupancyStatus } from '@azimut/core-model';
import {
  parseCsvLine,
  detectSeparator,
  stripBom,
  detectColumns,
} from './csv-utils.js';

const OCCUPANCY_ALIASES: Record<string, readonly string[]> = {
  unit_code: ['unit_code', 'code_unite', 'code', 'unite', 'local'],
  building: ['building', 'batiment', 'bat', 'immeuble'],
  level: ['level', 'niveau', 'etage', 'floor'],
  occupant_name: ['occupant_name', 'occupant', 'nom_occupant', 'locataire'],
  category_key: ['category_key', 'categorie', 'category', 'type'],
  occupancy_status: ['occupancy_status', 'statut', 'status', 'occupation'],
  name_fr: ['name_fr', 'nom_fr', 'denomination_fr', 'libelle_fr'],
  name_en: ['name_en', 'nom_en', 'denomination_en', 'libelle_en'],
  effective_from: ['effective_from', 'date_effet', 'debut', 'from'],
};

const REQUIRED_FIELDS: readonly string[] = [
  'unit_code',
  'building',
  'level',
  'occupancy_status',
];

const VALID_STATUSES = new Set<string>([
  'occupied',
  'vacant',
  'reserved',
  'under_fit_out',
]);

export type OccupancyLineResult = {
  readonly row: number;
  readonly status: 'imported' | 'pending' | 'rejected';
  readonly entry: ImportedOccupancy | null;
  readonly findings: readonly Finding[];
};

export type ImportedOccupancy = {
  readonly unit_code: string;
  readonly building: string;
  readonly level: string;
  readonly occupant_name: string;
  readonly category_key: string;
  readonly occupancy_status: OccupancyStatus;
  readonly name_fr: string;
  readonly name_en: string;
  readonly effective_from: string;
  readonly node_id: string | null;
};

export type OccupancyImportReport = {
  readonly total_rows: number;
  readonly imported: number;
  readonly pending: number;
  readonly rejected: number;
  readonly lines: readonly OccupancyLineResult[];
};

function findNodeForUnit(
  site: SiteData,
  unitCode: string,
  buildingName: string,
  levelName: string,
): string | null {
  const building = site.buildings.find(
    (b) => b.name.toLowerCase() === buildingName.toLowerCase(),
  );
  if (!building) return null;

  const level = site.levels.find(
    (l) =>
      l.building_id === building.id
      && l.name.toLowerCase() === levelName.toLowerCase(),
  );
  if (!level) return null;

  const nodesOnLevel = site.graph.nodes.filter(
    (n) => n.level_id === level.id,
  );

  const match = nodesOnLevel.find(
    (n) => n.label.toLowerCase() === unitCode.toLowerCase(),
  );
  return match?.id ?? null;
}

function isValidDate(s: string): boolean {
  if (s === '') return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

export function importOccupancy(
  site: SiteData,
  csvContent: string,
): Outcome<OccupancyImportReport> {
  const cleaned = stripBom(csvContent);
  const rawLines = cleaned.split(/\r?\n/).filter((l) => l.trim() !== '');

  if (rawLines.length === 0) {
    return {
      ok: false,
      findings: [{
        code: 'IMPORT.EMPTY_FILE',
        severity: 'blocking',
        entity: null,
        params: {},
        ruleRef: null,
      }],
    };
  }

  const headerLine = rawLines[0] as string;
  const separator = detectSeparator(headerLine);
  const headers = parseCsvLine(headerLine, separator);
  const columnMap = detectColumns(headers, OCCUPANCY_ALIASES, REQUIRED_FIELDS);

  if (!columnMap) {
    return {
      ok: false,
      findings: [{
        code: 'IMPORT.COLUMN_MISSING',
        severity: 'blocking',
        entity: null,
        params: { required: REQUIRED_FIELDS.join(', ') },
        ruleRef: null,
      }],
    };
  }

  const colIndex = new Map<string, number>();
  for (const [field, headerName] of Object.entries(columnMap)) {
    const idx = headers.indexOf(headerName);
    if (idx !== -1) colIndex.set(field, idx);
  }

  const warnings: Finding[] = [];
  const lines: OccupancyLineResult[] = [];
  const seenCodes = new Set<string>();

  for (let i = 1; i < rawLines.length; i++) {
    const line = rawLines[i] as string;
    const fields = parseCsvLine(line, separator);
    const row = i + 1;
    const rowFindings: Finding[] = [];

    const get = (f: string): string =>
      (fields[colIndex.get(f) ?? -1] ?? '').trim();

    const unitCode = get('unit_code');
    const building = get('building');
    const level = get('level');
    const occupancyStatus = get('occupancy_status');

    if (unitCode === '' || building === '' || level === '' || occupancyStatus === '') {
      rowFindings.push({
        code: 'IMPORT.ROW_INVALID',
        severity: 'warning',
        entity: null,
        params: { row, reason: 'champ obligatoire vide' },
        ruleRef: null,
      });
      lines.push({ row, status: 'rejected', entry: null, findings: rowFindings });
      continue;
    }

    if (!VALID_STATUSES.has(occupancyStatus)) {
      rowFindings.push({
        code: 'IMPORT.ROW_INVALID',
        severity: 'warning',
        entity: null,
        params: { row, reason: `statut invalide: ${occupancyStatus}` },
        ruleRef: null,
      });
      lines.push({ row, status: 'rejected', entry: null, findings: rowFindings });
      continue;
    }

    if (seenCodes.has(unitCode)) {
      rowFindings.push({
        code: 'IMPORT.DUPLICATE_KEY',
        severity: 'warning',
        entity: null,
        params: { row, key: unitCode },
        ruleRef: null,
      });
      lines.push({ row, status: 'rejected', entry: null, findings: rowFindings });
      continue;
    }

    const effectiveFrom = get('effective_from');
    if (!isValidDate(effectiveFrom)) {
      rowFindings.push({
        code: 'IMPORT.ROW_INVALID',
        severity: 'warning',
        entity: null,
        params: { row, reason: `date invalide: ${effectiveFrom}` },
        ruleRef: null,
      });
      lines.push({ row, status: 'rejected', entry: null, findings: rowFindings });
      continue;
    }

    seenCodes.add(unitCode);
    const nodeId = findNodeForUnit(site, unitCode, building, level);

    const entry: ImportedOccupancy = {
      unit_code: unitCode,
      building,
      level,
      occupant_name: get('occupant_name'),
      category_key: get('category_key'),
      occupancy_status: occupancyStatus as OccupancyStatus,
      name_fr: get('name_fr'),
      name_en: get('name_en'),
      effective_from: effectiveFrom,
      node_id: nodeId,
    };

    if (nodeId === null) {
      rowFindings.push({
        code: 'IMPORT.NODE_NOT_FOUND',
        severity: 'warning',
        entity: null,
        params: { row, unit_code: unitCode, building, level },
        ruleRef: null,
      });
      lines.push({ row, status: 'pending', entry, findings: rowFindings });
    } else {
      lines.push({ row, status: 'imported', entry, findings: [] });
    }
  }

  for (const line of lines) {
    for (const f of line.findings) warnings.push(f);
  }

  return {
    ok: true,
    value: {
      total_rows: rawLines.length - 1,
      imported: lines.filter((l) => l.status === 'imported').length,
      pending: lines.filter((l) => l.status === 'pending').length,
      rejected: lines.filter((l) => l.status === 'rejected').length,
      lines,
    },
    warnings,
  };
}
