import type { SiteData, Outcome, Finding } from '@azimut/core-model';
import {
  parseCsvLine,
  parseNumberDecl,
  detectSeparator,
  stripBom,
  detectColumns,
  isIsoDate,
  type DecimalSeparator,
} from './csv-utils.js';

/**
 * D4.1 — Existing support inventory import.
 *
 * Column contract (obligatory: reference, typology, building, level).
 * Optional columns carry position (node_ref, or x_m/y_m), orientation
 * (azimuth_deg, compass convention D1.3), overridden dimensions (width_mm,
 * height_mm — their presence flips dimensions_source to 'overridden'),
 * reading_distance_m, substrate, condition (enumerated), installed_at (ISO
 * 8601) and observed content (content_fr, content_en).
 *
 * Valid rows are imported, others rejected, and a row-by-row report is always
 * produced — never a silent truncation. A row with neither a node_ref nor an
 * x_m/y_m pair is rejected with IMPORT.ROW_INVALID.
 */

export type SupportCondition = 'good' | 'worn' | 'damaged' | 'missing';
const CONDITION_VALUES: readonly SupportCondition[] = [
  'good', 'worn', 'damaged', 'missing',
];

export type DimensionsSource = 'default' | 'overridden';

export type ImportedSupport = {
  readonly reference: string;
  readonly typology: string;
  readonly building: string;
  readonly level: string;
  readonly node_ref: string | null;
  readonly x_m: number | null;
  readonly y_m: number | null;
  readonly azimuth_deg: number | null;
  readonly width_mm: number | null;
  readonly height_mm: number | null;
  readonly dimensions_source: DimensionsSource;
  readonly reading_distance_m: number | null;
  readonly substrate: string | null;
  readonly condition: SupportCondition | null;
  readonly installed_at: string | null;
  readonly content_fr: string | null;
  readonly content_en: string | null;
};

export type ImportLineResult = {
  readonly row: number;
  readonly status: 'imported' | 'pending' | 'rejected';
  readonly support: ImportedSupport | null;
  readonly findings: readonly Finding[];
};

export type ImportReport = {
  readonly total_rows: number;
  readonly imported: number;
  readonly pending: number;
  readonly rejected: number;
  readonly lines: readonly ImportLineResult[];
  readonly supports: readonly ImportedSupport[];
};

export type ImportSupportsOptions = {
  /** D4.1 — decimal separator declared in the import header. Default 'point'. */
  readonly decimalSeparator?: DecimalSeparator;
};

const SUPPORT_ALIASES: Record<string, readonly string[]> = {
  reference: ['reference', 'ref', 'identifiant', 'id'],
  typology: ['typology', 'typologie', 'type'],
  building: ['building', 'batiment', 'bat'],
  level: ['level', 'niveau', 'etage'],
  node_ref: ['node_ref', 'noeud', 'node', 'point'],
  x_m: ['x_m', 'x'],
  y_m: ['y_m', 'y'],
  azimuth_deg: ['azimuth_deg', 'azimut', 'azimuth', 'orientation'],
  width_mm: ['width_mm', 'largeur_mm', 'largeur'],
  height_mm: ['height_mm', 'hauteur_mm', 'hauteur'],
  reading_distance_m: ['reading_distance_m', 'distance_lecture', 'distance'],
  substrate: ['substrate', 'substrat', 'support_materiau'],
  condition: ['condition', 'etat'],
  installed_at: ['installed_at', 'pose_le', 'date_pose'],
  content_fr: ['content_fr', 'contenu_fr'],
  content_en: ['content_en', 'contenu_en'],
};

const REQUIRED_FIELDS: readonly string[] = [
  'reference', 'typology', 'building', 'level',
];

function rowInvalid(row: number, reason: string): ImportLineResult {
  return {
    row,
    status: 'rejected',
    support: null,
    findings: [{
      code: 'IMPORT.ROW_INVALID',
      severity: 'warning',
      entity: null,
      params: { row, reason },
      ruleRef: null,
    }],
  };
}

type RowContext = {
  readonly get: (field: string) => string;
  readonly row: number;
  readonly decimal: DecimalSeparator;
};

/** Parse an optional number; returns { ok, value } and flags a bad value. */
function optionalNumber(
  raw: string,
  decimal: DecimalSeparator,
): { ok: boolean; value: number | null } {
  if (raw === '') return { ok: true, value: null };
  const n = parseNumberDecl(raw, decimal);
  return n === null ? { ok: false, value: null } : { ok: true, value: n };
}

function buildSupport(
  ctx: RowContext,
): ImportedSupport | { readonly error: string } {
  const { get, decimal } = ctx;
  const reference = get('reference');
  const typology = get('typology');
  const building = get('building');
  const level = get('level');

  if (reference === '' || typology === '' || building === '' || level === '') {
    return { error: 'champ obligatoire vide (reference/typology/building/level)' };
  }

  const nodeRef = get('node_ref');
  const xRaw = get('x_m');
  const yRaw = get('y_m');
  const x = optionalNumber(xRaw, decimal);
  const y = optionalNumber(yRaw, decimal);
  if (!x.ok) return { error: `x_m invalide: ${xRaw}` };
  if (!y.ok) return { error: `y_m invalide: ${yRaw}` };

  const hasCoords = x.value !== null && y.value !== null;
  if (nodeRef === '' && !hasCoords) {
    return { error: 'ni node_ref ni couple de coordonnées x_m/y_m' };
  }

  const az = optionalNumber(get('azimuth_deg'), decimal);
  if (!az.ok) return { error: 'azimuth_deg invalide' };
  const width = optionalNumber(get('width_mm'), decimal);
  if (!width.ok) return { error: 'width_mm invalide' };
  const height = optionalNumber(get('height_mm'), decimal);
  if (!height.ok) return { error: 'height_mm invalide' };
  const reading = optionalNumber(get('reading_distance_m'), decimal);
  if (!reading.ok) return { error: 'reading_distance_m invalide' };

  const conditionRaw = get('condition');
  let condition: SupportCondition | null = null;
  if (conditionRaw !== '') {
    if (!CONDITION_VALUES.includes(conditionRaw as SupportCondition)) {
      return { error: `condition invalide: ${conditionRaw}` };
    }
    condition = conditionRaw as SupportCondition;
  }

  const installedAt = get('installed_at');
  if (installedAt !== '' && !isIsoDate(installedAt)) {
    return { error: `installed_at non ISO 8601: ${installedAt}` };
  }

  const substrate = get('substrate');
  const contentFr = get('content_fr');
  const contentEn = get('content_en');

  // D4.1 — declaring width_mm/height_mm overrides the typology default.
  const dimensionsSource: DimensionsSource =
    width.value !== null || height.value !== null ? 'overridden' : 'default';

  return {
    reference,
    typology,
    building,
    level,
    node_ref: nodeRef === '' ? null : nodeRef,
    x_m: x.value,
    y_m: y.value,
    azimuth_deg: az.value,
    width_mm: width.value,
    height_mm: height.value,
    dimensions_source: dimensionsSource,
    reading_distance_m: reading.value,
    substrate: substrate === '' ? null : substrate,
    condition,
    installed_at: installedAt === '' ? null : installedAt,
    content_fr: contentFr === '' ? null : contentFr,
    content_en: contentEn === '' ? null : contentEn,
  };
}

export function importSupports(
  site: SiteData,
  csvContent: string,
  options: ImportSupportsOptions = {},
): Outcome<ImportReport> {
  const decimal: DecimalSeparator = options.decimalSeparator ?? 'point';
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
  const columnMap = detectColumns(headers, SUPPORT_ALIASES, REQUIRED_FIELDS);

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

  const nodeIds = new Set(site.graph.nodes.map((n) => n.id));
  const seenRefs = new Set<string>();
  const lines: ImportLineResult[] = [];
  const supports: ImportedSupport[] = [];

  for (let i = 1; i < rawLines.length; i++) {
    const fields = parseCsvLine(rawLines[i] as string, separator);
    const row = i + 1;
    const get = (f: string): string =>
      (fields[colIndex.get(f) ?? -1] ?? '').trim();

    const built = buildSupport({ get, row, decimal });
    if ('error' in built) {
      lines.push(rowInvalid(row, built.error));
      continue;
    }

    if (seenRefs.has(built.reference)) {
      lines.push({
        row,
        status: 'rejected',
        support: null,
        findings: [{
          code: 'IMPORT.DUPLICATE_KEY',
          severity: 'warning',
          entity: null,
          params: { row, key: built.reference },
          ruleRef: null,
        }],
      });
      continue;
    }
    seenRefs.add(built.reference);

    // A node_ref that does not resolve leaves the row pending a manual link.
    if (built.node_ref !== null && !nodeIds.has(built.node_ref)) {
      lines.push({
        row,
        status: 'pending',
        support: built,
        findings: [{
          code: 'IMPORT.NODE_NOT_FOUND',
          severity: 'warning',
          entity: null,
          params: { row, reference: built.reference, node_ref: built.node_ref },
          ruleRef: null,
        }],
      });
      continue;
    }

    supports.push(built);
    lines.push({ row, status: 'imported', support: built, findings: [] });
  }

  const warnings: Finding[] = [];
  for (const line of lines) warnings.push(...line.findings);

  return {
    ok: true,
    value: {
      total_rows: rawLines.length - 1,
      imported: supports.length,
      pending: lines.filter((l) => l.status === 'pending').length,
      rejected: lines.filter((l) => l.status === 'rejected').length,
      lines,
      supports,
    },
    warnings,
  };
}
