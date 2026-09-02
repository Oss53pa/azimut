import type { SiteData, Outcome } from '@azimut/core-model';

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
  readonly status: 'ok' | 'rejected';
  readonly support: ImportedSupport | null;
  readonly errors: readonly string[];
};

export type ImportReport = {
  readonly total_rows: number;
  readonly imported: number;
  readonly rejected: number;
  readonly lines: readonly ImportLineResult[];
  readonly supports: readonly ImportedSupport[];
};

const REQUIRED_FIELDS: readonly (keyof ImportColumnMap)[] = [
  'id',
  'node_id',
  'azimuth_deg',
  'width_m',
  'height_m',
];

function normalizeDecimalSeparator(value: string): string {
  return value.replace(',', '.');
}

function parseNumber(raw: string): number | null {
  const cleaned = normalizeDecimalSeparator(raw.trim());
  if (cleaned === '') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}

function detectColumns(
  headers: readonly string[],
): ImportColumnMap | null {
  const normalized = headers.map((h) =>
    h
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, ''),
  );

  const aliases: Record<keyof ImportColumnMap, readonly string[]> = {
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

  const found: Record<string, string> = {};
  for (const [field, candidates] of Object.entries(aliases)) {
    for (const candidate of candidates) {
      const idx = normalized.indexOf(candidate);
      if (idx !== -1) {
        found[field] = headers[idx] as string;
        break;
      }
    }
  }

  for (const req of REQUIRED_FIELDS) {
    if (!(req in found)) return null;
  }

  return found as unknown as ImportColumnMap;
}

function parseCsvLine(line: string, separator: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i] as string;
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === separator) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function detectSeparator(headerLine: string): string {
  const tabCount = (headerLine.match(/\t/g) ?? []).length;
  const semiCount = (headerLine.match(/;/g) ?? []).length;
  const commaCount = (headerLine.match(/,/g) ?? []).length;

  if (tabCount >= semiCount && tabCount >= commaCount) return '\t';
  if (semiCount >= commaCount) return ';';
  return ',';
}

function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}

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
  const columnMap = detectColumns(headers);

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
    const errors: string[] = [];

    const getId = (f: string): string =>
      (fields[colIndex.get(f) ?? -1] ?? '').trim();

    const id = getId('id');
    const nodeId = getId('node_id');

    if (id === '') errors.push('id manquant');
    if (nodeId === '') errors.push('node_id manquant');

    if (id !== '' && seenIds.has(id)) {
      errors.push(`doublon id=${id}`);
    }

    if (nodeId !== '' && !nodeIds.has(nodeId)) {
      errors.push(`nœud inexistant node_id=${nodeId}`);
    }

    const azRaw = getId('azimuth_deg');
    const azimuth = parseNumber(azRaw);
    if (azRaw === '') {
      errors.push('azimut absent');
    } else if (azimuth === null) {
      errors.push(`azimut invalide: ${azRaw}`);
    }

    const wRaw = getId('width_m');
    const width = parseNumber(wRaw);
    if (wRaw === '') {
      errors.push('largeur absente');
    } else if (width === null) {
      errors.push(`largeur invalide: ${wRaw}`);
    }

    const hRaw = getId('height_m');
    const height = parseNumber(hRaw);
    if (hRaw === '') {
      errors.push('hauteur absente');
    } else if (height === null) {
      errors.push(`hauteur invalide: ${hRaw}`);
    }

    if (errors.length > 0) {
      lines.push({ row, status: 'rejected', support: null, errors });
    } else {
      const support: ImportedSupport = {
        id,
        node_id: nodeId,
        azimuth_deg: azimuth as number,
        width_m: width as number,
        height_m: height as number,
        photo_url: getId('photo_url'),
        notes: getId('notes'),
      };
      seenIds.add(id);
      supports.push(support);
      lines.push({ row, status: 'ok', support, errors: [] });
    }
  }

  return {
    ok: true,
    value: {
      total_rows: rawLines.length - 1,
      imported: supports.length,
      rejected: lines.filter((l) => l.status === 'rejected').length,
      lines,
      supports,
    },
    warnings: [],
  };
}
