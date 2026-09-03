import type { SiteData, Outcome, Finding } from '@azimut/core-model';
import {
  parseNumber,
  parseCsvLine,
  detectSeparator,
  stripBom,
  detectColumns,
} from './csv-utils.js';

export type ImportColumnMap = {
  readonly id: string;
  readonly node_id: string;
  readonly azimuth_deg: string;
  readonly width_m: string;
  readonly height_m: string;
  readonly photo_url?: string;
  readonly notes?: string;
};

export type ImportedSupport = {
  readonly id: string;
  readonly node_id: string;
  readonly azimuth_deg: number;
  readonly width_m: number;
  readonly height_m: number;
  readonly photo_url: string;
  readonly notes: string;
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

const SUPPORT_ALIASES: Record<string, readonly string[]> = {
  id: ['id', 'identifiant', 'support_id', 'ref', 'reference'],
  node_id: ['node_id', 'noeud', 'noeud_id', 'node', 'point'],
  azimuth_deg: [
    'azimuth_deg',
    'azimut',
    'azimuth',
    'orientation',
    'angle',
  ],
  width_m: [
    'width_m',
    'largeur',
    'largeur_m',
    'width',
    'larg',
  ],
  height_m: [
    'height_m',
    'hauteur',
    'hauteur_m',
    'height',
    'haut',
  ],
  photo_url: ['photo_url', 'photo', 'image', 'url_photo'],
  notes: ['notes', 'remarques', 'commentaires', 'observation'],
};

const REQUIRED_FIELDS: readonly string[] = [
  'id',
  'node_id',
  'azimuth_deg',
  'width_m',
  'height_m',
];

export function importSupports(
  site: SiteData,
  csvContent: string,
): Outcome<ImportReport> {
  const cleaned = stripBom(csvContent);
  const rawLines = cleaned.split(/\r?\n/).filter((l) => l.trim() !== '');

  if (rawLines.length === 0) {
    return {
      ok: false,
      findings: [
        {
          code: 'IMPORT.EMPTY_FILE',
          severity: 'blocking',
          entity: null,
          params: {},
          ruleRef: null,
        },
      ],
    };
  }

  const headerLine = rawLines[0] as string;
  const separator = detectSeparator(headerLine);
  const headers = parseCsvLine(headerLine, separator);
  const columnMap = detectColumns(headers, SUPPORT_ALIASES, REQUIRED_FIELDS);

  if (!columnMap) {
    return {
      ok: false,
      findings: [
        {
          code: 'IMPORT.COLUMN_MISSING',
          severity: 'blocking',
          entity: null,
          params: { required: REQUIRED_FIELDS.join(', ') },
          ruleRef: null,
        },
      ],
    };
  }

  const colIndex = new Map<string, number>();
  for (const [field, headerName] of Object.entries(columnMap)) {
    const idx = headers.indexOf(headerName);
    if (idx !== -1) colIndex.set(field, idx);
  }

  const nodeIds = new Set(site.graph.nodes.map((n) => n.id));
  const seenIds = new Set<string>();
  const lines: ImportLineResult[] = [];
  const supports: ImportedSupport[] = [];

  for (let i = 1; i < rawLines.length; i++) {
    const line = rawLines[i] as string;
    const fields = parseCsvLine(line, separator);
    const row = i + 1;
    const rowFindings: Finding[] = [];

    const get = (f: string): string =>
      (fields[colIndex.get(f) ?? -1] ?? '').trim();

    const id = get('id');
    const nodeId = get('node_id');

    if (id === '' || nodeId === '') {
      rowFindings.push({
        code: 'IMPORT.ROW_INVALID',
        severity: 'warning',
        entity: null,
        params: { row, reason: 'champ obligatoire vide' },
        ruleRef: null,
      });
      lines.push({ row, status: 'rejected', support: null, findings: rowFindings });
      continue;
    }

    if (seenIds.has(id)) {
      rowFindings.push({
        code: 'IMPORT.DUPLICATE_KEY',
        severity: 'warning',
        entity: null,
        params: { row, key: id },
        ruleRef: null,
      });
      lines.push({ row, status: 'rejected', support: null, findings: rowFindings });
      continue;
    }

    const azRaw = get('azimuth_deg');
    const azimuth = parseNumber(azRaw);
    if (azRaw === '' || azimuth === null) {
      rowFindings.push({
        code: 'IMPORT.ROW_INVALID',
        severity: 'warning',
        entity: null,
        params: { row, reason: azRaw === '' ? 'azimut absent' : `azimut invalide: ${azRaw}` },
        ruleRef: null,
      });
      lines.push({ row, status: 'rejected', support: null, findings: rowFindings });
      continue;
    }

    const wRaw = get('width_m');
    const width = parseNumber(wRaw);
    if (wRaw === '' || width === null) {
      rowFindings.push({
        code: 'IMPORT.ROW_INVALID',
        severity: 'warning',
        entity: null,
        params: { row, reason: wRaw === '' ? 'largeur absente' : `largeur invalide: ${wRaw}` },
        ruleRef: null,
      });
      lines.push({ row, status: 'rejected', support: null, findings: rowFindings });
      continue;
    }

    const hRaw = get('height_m');
    const height = parseNumber(hRaw);
    if (hRaw === '' || height === null) {
      rowFindings.push({
        code: 'IMPORT.ROW_INVALID',
        severity: 'warning',
        entity: null,
        params: { row, reason: hRaw === '' ? 'hauteur absente' : `hauteur invalide: ${hRaw}` },
        ruleRef: null,
      });
      lines.push({ row, status: 'rejected', support: null, findings: rowFindings });
      continue;
    }

    seenIds.add(id);
    const support: ImportedSupport = {
      id,
      node_id: nodeId,
      azimuth_deg: azimuth,
      width_m: width,
      height_m: height,
      photo_url: get('photo_url'),
      notes: get('notes'),
    };

    if (!nodeIds.has(nodeId)) {
      rowFindings.push({
        code: 'IMPORT.NODE_NOT_FOUND',
        severity: 'warning',
        entity: null,
        params: { row, id, node_id: nodeId },
        ruleRef: null,
      });
      lines.push({ row, status: 'pending', support, findings: rowFindings });
    } else {
      supports.push(support);
      lines.push({ row, status: 'imported', support, findings: [] });
    }
  }

  const warnings: Finding[] = [];
  for (const line of lines) {
    for (const f of line.findings) warnings.push(f);
  }

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
