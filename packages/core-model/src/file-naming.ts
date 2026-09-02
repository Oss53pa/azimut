const TRANSLITERATION: Record<string, string> = {
  À: 'A', Á: 'A', Â: 'A', Ã: 'A', Ä: 'A', Å: 'A',
  Æ: 'AE', Ç: 'C', È: 'E', É: 'E', Ê: 'E', Ë: 'E',
  Ì: 'I', Í: 'I', Î: 'I', Ï: 'I', Ð: 'D', Ñ: 'N',
  Ò: 'O', Ó: 'O', Ô: 'O', Õ: 'O', Ö: 'O', Ø: 'O',
  Ù: 'U', Ú: 'U', Û: 'U', Ü: 'U', Ý: 'Y',
  ß: 'SS', Œ: 'OE',
  à: 'a', á: 'a', â: 'a', ã: 'a', ä: 'a', å: 'a',
  æ: 'ae', ç: 'c', è: 'e', é: 'e', ê: 'e', ë: 'e',
  ì: 'i', í: 'i', î: 'i', ï: 'i', ð: 'd', ñ: 'n',
  ò: 'o', ó: 'o', ô: 'o', õ: 'o', ö: 'o', ø: 'o',
  ù: 'u', ú: 'u', û: 'u', ü: 'u', ý: 'y', ÿ: 'y',
  œ: 'oe',
};

const MAX_FILENAME_LENGTH = 120;
const TRUNCATION_MARKER = '~';

export function transliterate(input: string): string {
  let result = '';
  for (const ch of input) {
    const mapped = TRANSLITERATION[ch];
    if (mapped !== undefined) {
      result += mapped;
    } else {
      result += ch;
    }
  }
  return result;
}

export function sanitizeSegment(raw: string): string {
  const upper = transliterate(raw).toUpperCase();
  return upper.replace(/[^A-Z0-9-]/g, '');
}

function truncateMiddle(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  const keep = maxLen - 1;
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  return value.slice(0, head) + TRUNCATION_MARKER + value.slice(-tail);
}

export type FileNameParts = {
  readonly site_code: string;
  readonly building: string;
  readonly level: string;
  readonly type_code: string;
  readonly reference: string;
  readonly version: number;
  readonly face: string;
  readonly extension: string;
};

export function buildFileName(parts: FileNameParts): string {
  const segments = [
    sanitizeSegment(parts.site_code),
    sanitizeSegment(parts.building),
    sanitizeSegment(parts.level),
    sanitizeSegment(parts.type_code),
    sanitizeSegment(parts.reference),
    `V${parts.version}`,
    sanitizeSegment(parts.face),
  ];
  const base = segments.join('_');
  const ext = parts.extension.replace(/^\./, '').toUpperCase();
  const full = `${base}.${ext}`;
  return truncateMiddle(full, MAX_FILENAME_LENGTH);
}

export type ArchiveNameParts = {
  readonly site_code: string;
  readonly building: string;
  readonly level: string;
  readonly version: number;
  readonly extension: string;
};

export function buildArchiveName(parts: ArchiveNameParts): string {
  const segments = [
    sanitizeSegment(parts.site_code),
    sanitizeSegment(parts.building),
    sanitizeSegment(parts.level),
    `V${parts.version}`,
  ];
  const base = segments.join('_');
  const ext = parts.extension.replace(/^\./, '').toUpperCase();
  const full = `${base}.${ext}`;
  return truncateMiddle(full, MAX_FILENAME_LENGTH);
}
