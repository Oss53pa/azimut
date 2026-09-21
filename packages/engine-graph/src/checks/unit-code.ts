import type { SiteData, Finding } from '@azimut/core-model';
import { isCellFootprint } from '@azimut/core-model';

/**
 * N1.4 — règle S3. Une empreinte de nature cellule porte obligatoirement un
 * code d'unité ; les autres natures ne l'exigent pas.
 *
 * Un code vide ou fait d'espaces vaut un code absent : sur un panneau, il ne
 * désigne rien.
 */
export function checkUnitCodeRequired(site: SiteData): Finding[] {
  const findings: Finding[] = [];
  const sorted = [...site.footprints].sort((a, b) => a.id.localeCompare(b.id));

  for (const footprint of sorted) {
    if (!isCellFootprint(footprint.kind)) continue;
    if ((footprint.unit_code ?? '').trim().length > 0) continue;
    findings.push({
      code: 'DATA.UNIT_CODE_REQUIRED',
      severity: 'blocking',
      entity: { kind: 'footprint', id: footprint.id },
      params: { level_id: footprint.level_id },
      ruleRef: 'N1.4',
    });
  }
  return findings;
}

/**
 * N1.4 — unicité du code d'unité par niveau.
 *
 * La portée est le niveau, pas le site : deux cellules « 104 » sur deux
 * niveaux différents ne se confondent pas, deux sur le même niveau si. Les
 * codes sont comparés sans casse ni espaces de bord, comme les noms
 * d'orientation — un lecteur ne distingue pas « C-104 » de « c-104 ».
 */
export function checkUnitCodeDuplicate(site: SiteData): Finding[] {
  // Deux niveaux de Map plutôt qu'une clé composée : aucun séparateur à
  // choisir, donc aucun code d'unité ne peut en contenir un et brouiller le
  // regroupement.
  const byLevel = new Map<string, Map<string, string[]>>();

  for (const footprint of site.footprints) {
    if (!isCellFootprint(footprint.kind)) continue;
    const code = (footprint.unit_code ?? '').trim().toLowerCase();
    if (code.length === 0) continue; // déjà signalé par S3
    const byCode = byLevel.get(footprint.level_id) ?? new Map<string, string[]>();
    byCode.set(code, [...(byCode.get(code) ?? []), footprint.id]);
    byLevel.set(footprint.level_id, byCode);
  }

  const findings: Finding[] = [];
  const levelIds = [...byLevel.keys()].sort((a, b) => a.localeCompare(b));
  for (const levelId of levelIds) {
    const byCode = byLevel.get(levelId);
    if (byCode === undefined) continue;
    const codes = [...byCode.keys()].sort((a, b) => a.localeCompare(b));
    for (const code of codes) {
      const ids = [...(byCode.get(code) ?? [])].sort((a, b) => a.localeCompare(b));
      if (ids.length < 2) continue;
      for (const id of ids) {
        findings.push({
          code: 'DATA.CODE_DUPLICATE',
          severity: 'blocking',
          entity: { kind: 'footprint', id },
          params: { level_id: levelId, unit_code: code, count: ids.length },
          ruleRef: 'N1.4',
        });
      }
    }
  }
  return findings;
}
