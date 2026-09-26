import { empreinteOutcome } from '@azimut/core-model';

/**
 * T-0.10 et D7.2 — l'empreinte stable d'une valeur du banc d'essai, site de
 * référence compris. Elle suit la forme canonique commune à toutes les
 * empreintes du produit, et n'en est pas une seconde : c'est la même
 * fonction. Une valeur non hachable fait échouer l'essai qui la demande, en
 * nommant le code du refus.
 */
export function stableChecksum(value: unknown): string {
  const hash = empreinteOutcome(value);
  if (!hash.ok) throw new Error(hash.findings.map(f => f.code).join(', '));
  return hash.value;
}

/**
 * L'empreinte d'un site de référence. Elle écrivait le JSON brut, sensible à
 * l'ordre des clés : une seconde forme canonique, que D7.2 interdit. Elle est
 * désormais `stableChecksum`, sous le nom que le banc emploie.
 */
export function siteChecksum(site: unknown): string {
  return stableChecksum(site);
}
