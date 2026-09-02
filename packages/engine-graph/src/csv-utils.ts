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
