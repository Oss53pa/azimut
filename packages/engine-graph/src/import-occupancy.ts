import type { SiteData, Outcome, Finding, OccupancyStatus } from '@azimut/core-model';
import { FIELD_BOUNDS, parseColumnSpec, tableColumns, textFault } from '@azimut/core-model';
import { readCsv, detectColumns, cellOf, cellFault } from './csv-utils.js';
import type { CsvLimits } from './csv-utils.js';

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

/** Les statuts que la base admet : l'énumération de `destination.occupancy_status`. */
const VALID_STATUSES = new Set<string>(
  parseColumnSpec(tableColumns('destination')?.['occupancy_status'] ?? '=').values,
);

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

/** Le premier défaut d'une ligne : guillemet non refermé, puis cellule par cellule. */
function rowFault(
  unterminated: boolean,
  colIndex: ReadonlyMap<string, number>,
  get: (f: string) => string,
  maxChars: number,
): string | null {
  if (unterminated) return 'unterminated_quote';
  for (const field of colIndex.keys()) {
    const fault = cellFault(get(field), maxChars);
    if (fault !== null) return `${field} ${fault}`;
  }
  const unitCode = get('unit_code');
  const bound = unitCode === '' ? null : textFault(unitCode, FIELD_BOUNDS['footprint.unit_code']);
  return bound === null ? null : `unit_code ${bound}`;
}

function isValidDate(s: string): boolean {
  if (s === '') return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

export function importOccupancy(
  site: SiteData,
  csvContent: string,
  limits: CsvLimits,
): Outcome<OccupancyImportReport> {
  const read = readCsv(csvContent, limits);
  if (!read.ok) {
    return {
      ok: false,
      findings: [{ code: read.code, severity: 'blocking', entity: null, params: read.params, ruleRef: null }],
    };
  }

  const headers = read.header;
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

  for (const record of read.rows) {
    const row = record.line;
    const rowFindings: Finding[] = [];

    const get = (f: string): string => cellOf(record.fields, colIndex.get(f));

    // Lot 4 de l'audit (A6.3) : chaque cellule passe le contrôle de texte de
    // la saisie, et le code d'unité la borne que le cahier lui fixe (M3, partie M).
    const fault = rowFault(record.line === read.unterminatedLine, colIndex, get, limits.maxChars);
    if (fault !== null) {
      rowFindings.push({
        code: 'IMPORT.ROW_INVALID',
        severity: 'warning',
        entity: null,
        params: { row, reason: fault },
        ruleRef: null,
      });
      lines.push({ row, status: 'rejected', entry: null, findings: rowFindings });
      continue;
    }

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
      total_rows: read.rows.length,
      imported: lines.filter((l) => l.status === 'imported').length,
      pending: lines.filter((l) => l.status === 'pending').length,
      rejected: lines.filter((l) => l.status === 'rejected').length,
      lines,
    },
    warnings,
  };
}
