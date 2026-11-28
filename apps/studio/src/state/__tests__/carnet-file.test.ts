import { describe, it, expect } from 'vitest';
import { readCarnetText } from '../carnet-file.js';

/** T-1.13 — le fichier de carnet vérifié sur ses octets. */
const codeOf = (bytes: Uint8Array, max?: number) => {
  const out = readCarnetText(bytes, max);
  return out.ok ? 'lu' : out.findings.map(f => f.code).join(',');
};

describe('T-1.13 — la lecture du carnet', () => {
  it('un texte UTF-8 se lit, accents compris', () => {
    const out = readCarnetText(new TextEncoder().encode('reference;niveau\nD-1;Rez-de-chaussée'));
    expect(out.ok && out.value).toBe('reference;niveau\nD-1;Rez-de-chaussée');
  });

  it('un encodage non UTF-8 est refusé, pas deviné', () => {
    // « é » en Latin-1 : un octet 0xE9 seul, invalide en UTF-8.
    expect(codeOf(new Uint8Array([0x72, 0xe9, 0x66]))).toBe('IMPORT.ENCODING_UNSUPPORTED');
  });

  it('un fichier binaire est refusé', () => {
    expect(codeOf(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]))).toBe('IMPORT.FORMAT_UNSUPPORTED');
  });

  it('un fichier trop gros est refusé avant d’être lu', () => {
    expect(codeOf(new Uint8Array(11), 10)).toBe('IMPORT.FILE_TOO_LARGE');
  });
});
