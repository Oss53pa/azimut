import { normalizeText, characterFault, charLength } from '@azimut/core-model';

export function normalizeDecimalSeparator(value: string): string {
  return value.replace(',', '.');
}

export function parseNumber(raw: string): number | null {
  const cleaned = normalizeDecimalSeparator(raw.trim());
  if (cleaned === '') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** D4.1: the decimal separator is declared in the import header. */
export type DecimalSeparator = 'point' | 'comma';

/**
 * Parse a number using the declared decimal separator. With 'comma', a comma is
 * the decimal mark; with 'point', the value is read as-is (a stray comma then
 * makes it invalid rather than silently reinterpreted).
 */
export function parseNumberDecl(
  raw: string,
  decimal: DecimalSeparator,
): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const cleaned = decimal === 'comma' ? trimmed.replace(',', '.') : trimmed;
  if (cleaned.includes(',')) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** D4.1: installed_at must be an ISO 8601 date (YYYY-MM-DD). */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime())
    && value === d.toISOString().slice(0, 10);
}

/** Un enregistrement du fichier, et la ligne physique où il commence. */
export type CsvRecord = { readonly line: number; readonly fields: readonly string[] };

/**
 * Lot 4 de l'audit (A6.3) : les bornes d'un import de tableur. Ce sont des
 * seuils de configuration (`import.csv.max_bytes`, `import.csv.max_rows`,
 * `input.text.max_chars`), que l'appelant lit et transmet.
 */
export type CsvLimits = {
  readonly maxBytes: number;
  readonly maxRows: number;
  readonly maxChars: number;
};

/**
 * Découpe un texte en enregistrements, à la manière de la RFC 4180 : un champ
 * entre guillemets peut porter le séparateur, un guillemet doublé et des fins
 * de ligne. Chaque enregistrement garde la ligne physique où il commence, pour
 * que le rapport désigne la bonne ligne. Un guillemet jamais refermé marque le
 * dernier enregistrement (`unterminated`).
 */
export function parseCsvRecords(
  text: string,
  separator: string,
): { readonly records: readonly CsvRecord[]; readonly unterminated: boolean } {
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let line = 1;
  let start = 1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else { if (ch === '\n') line++; current += ch; }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === separator) {
      fields.push(current); current = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      fields.push(current);
      records.push({ line: start, fields });
      fields = []; current = ''; line++; start = line;
    } else {
      current += ch;
    }
  }
  if (current !== '' || fields.length > 0 || inQuotes) {
    fields.push(current);
    records.push({ line: start, fields });
  }
  return { records, unterminated: inQuotes };
}

export type CsvRead =
  | {
    readonly ok: true;
    readonly header: readonly string[];
    readonly rows: readonly CsvRecord[];
    /** La ligne du dernier enregistrement, si son guillemet n'est jamais refermé. */
    readonly unterminatedLine: number | null;
  }
  | { readonly ok: false; readonly code: 'IMPORT.EMPTY_FILE' | 'IMPORT.FILE_TOO_LARGE';
    readonly params: Readonly<Record<string, number>> };

/**
 * Lit un import de tableur dans ses bornes : taille, puis nombre de lignes.
 * Un fichier au-delà est refusé en entier, sans lecture partielle. Les
 * enregistrements entièrement vides sont ignorés.
 */
export function readCsv(content: string, limits: CsvLimits): CsvRead {
  const bytes = new TextEncoder().encode(content).length;
  if (bytes > limits.maxBytes) {
    return { ok: false, code: 'IMPORT.FILE_TOO_LARGE', params: { bytes, max_bytes: limits.maxBytes } };
  }
  const cleaned = stripBom(content);
  const firstLine = cleaned.split(/\r?\n/, 1)[0] ?? '';
  const { records, unterminated } = parseCsvRecords(cleaned, detectSeparator(firstLine));
  const kept = records.filter(r => r.fields.some(f => f.trim() !== ''));
  const [header, ...rows] = kept;
  if (header === undefined) return { ok: false, code: 'IMPORT.EMPTY_FILE', params: {} };
  if (rows.length > limits.maxRows) {
    return { ok: false, code: 'IMPORT.FILE_TOO_LARGE', params: { rows: rows.length, max_rows: limits.maxRows } };
  }
  const last = kept[kept.length - 1];
  return {
    ok: true,
    header: header.fields,
    rows,
    unterminatedLine: unterminated && last !== undefined ? last.line : null,
  };
}

/**
 * Le motif de refus d'une cellule normalisée, ou null : le même contrôle de
 * texte que la saisie et que la base (caractères, forme NFC, plafond).
 */
export function cellFault(value: string, maxChars: number, multiline = false): string | null {
  const fault = characterFault(value, multiline);
  if (fault !== null) return fault;
  return charLength(value) > maxChars ? 'too_long' : null;
}

/** La cellule d'un enregistrement, normalisée (espaces de bord, NFC). */
export function cellOf(fields: readonly string[], index: number | undefined): string {
  return normalizeText(fields[index ?? -1] ?? '');
}

export function parseCsvLine(line: string, separator: string): string[] {
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

export function detectSeparator(headerLine: string): string {
  const tabCount = (headerLine.match(/\t/g) ?? []).length;
  const semiCount = (headerLine.match(/;/g) ?? []).length;
  const commaCount = (headerLine.match(/,/g) ?? []).length;

  if (tabCount >= semiCount && tabCount >= commaCount) return '\t';
  if (semiCount >= commaCount) return ';';
  return ',';
}

export function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}

export function detectColumns(
  headers: readonly string[],
  aliases: Record<string, readonly string[]>,
  required: readonly string[],
): Record<string, string> | null {
  const normalized = headers.map((h) =>
    h
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, ''),
  );

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

  for (const req of required) {
    if (!(req in found)) return null;
  }

  return found;
}
