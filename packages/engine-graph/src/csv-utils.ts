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

/** D4.1 — the decimal separator is declared in the import header. */
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

/** D4.1 — installed_at must be an ISO 8601 date (YYYY-MM-DD). */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime())
    && value === d.toISOString().slice(0, 10);
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
