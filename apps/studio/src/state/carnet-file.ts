/**
 * T-1.13 et D4.1 — la lecture du fichier de carnet, avant tout calcul.
 *
 * Le fichier ne quitte pas le poste : il est lu ici, puis transformé en
 * commandes que la base valide. Il est tout de même vérifié sur ses octets,
 * comme tout fichier reçu : taille bornée, texte UTF-8 strict (D4.1), aucun
 * octet nul, qu'un tableur binaire renommé en `.csv` porterait.
 */
import type { Finding, Outcome } from '@azimut/core-model';

/** Taille maximale d'un carnet lu au poste. Garde-fou d'outil, non normatif. */
export const MAX_CARNET_BYTES = 2 * 1024 * 1024;

const refusal = (code: string, params: Record<string, string | number> = {}): Outcome<string> => ({
  ok: false,
  findings: [{ code, severity: 'blocking', entity: null, params, ruleRef: 'D4.1' } satisfies Finding],
});

export function readCarnetText(bytes: Uint8Array, maxBytes: number = MAX_CARNET_BYTES): Outcome<string> {
  if (bytes.byteLength > maxBytes) return refusal('IMPORT.FILE_TOO_LARGE', { bytes: bytes.byteLength, max: maxBytes });
  if (bytes.includes(0)) return refusal('IMPORT.FORMAT_UNSUPPORTED', { reason: 'binary' });
  try {
    return { ok: true, value: new TextDecoder('utf-8', { fatal: true }).decode(bytes), warnings: [] };
  } catch {
    return refusal('IMPORT.ENCODING_UNSUPPORTED', { expected: 'utf-8' });
  }
}
