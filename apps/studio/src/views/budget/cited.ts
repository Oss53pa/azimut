/**
 * H8 — ce que le garde des coûts de référence contrôle : les typologies que
 * les supports du site portent réellement (A5.6, `support.typology_id`).
 *
 * Un support sans typologie n'en cite aucune : il ne se chiffre pas, et rien
 * ne lui en suppose une ici.
 */
import { supportTypologyOf, type CostReference, type Finding, type SiteData } from '@azimut/core-model';
import { auditCostReferences } from '../../domain/cost-reference.js';

export function citedTypologies(site: SiteData): readonly string[] {
  const keys = new Set<string>();
  for (const support of site.supports) {
    const type = supportTypologyOf(site.support_types, support);
    if (type !== null) keys.add(type.key);
  }
  return [...keys].sort();
}

/** Une anomalie par typologie citée sans coût de référence chiffré. */
export function missingCostFindings(site: SiteData, references: readonly CostReference[]): readonly Finding[] {
  const priced = new Set(references.filter(r => r.unit_cost !== null).map(r => r.typology_key));
  const result = auditCostReferences(citedTypologies(site), priced);
  return result.ok ? result.warnings : result.findings;
}
