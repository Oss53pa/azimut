import type {
  SiteData,
  Finding,
  Outcome,
} from '@azimut/core-model';
import { isCellFootprint } from '@azimut/core-model';
import { guardNamingCollisions, type NamedEntity } from './guard-naming.js';

export type CheckReport = {
  readonly checks_run: readonly string[];
  readonly checks_skipped: readonly string[];
  readonly findings: readonly Finding[];
};

/**
 * H2.2 — Orientation nomenclature uniqueness. Building names must be unique
 * within the site, and level names unique within their building (two levels
 * named alike in one building is a naming collision). Node/zone labels are left
 * out here to avoid flagging legitimately blank technical labels.
 */
function checkNamingCollisions(site: SiteData): Finding[] {
  const entities: NamedEntity[] = [];
  for (const building of site.buildings) {
    entities.push({
      id: building.id,
      kind: 'building',
      name: building.name,
      scope: site.site.id,
    });
  }
  for (const level of site.levels) {
    entities.push({
      id: level.id,
      kind: 'level',
      name: level.name,
      scope: level.building_id,
    });
  }

  const outcome = guardNamingCollisions(entities);
  return outcome.ok ? [] : [...outcome.findings];
}

function checkDuplicateDisplayName(site: SiteData): Finding[] {
  const nameMap = new Map<string, string[]>();
  const sorted = [...site.destination_names].sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  for (const dn of sorted) {
    const key = `${dn.lang}::${dn.value.trim().toLowerCase()}`;
    const existing = nameMap.get(key);
    if (existing) {
      existing.push(dn.destination_id);
    } else {
      nameMap.set(key, [dn.destination_id]);
    }
  }

  const findings: Finding[] = [];
  const sortedKeys = [...nameMap.keys()].sort();
  for (const key of sortedKeys) {
    const destIds = nameMap.get(key);
    if (!destIds || destIds.length <= 1) continue;
    const uniqueDestIds = [...new Set(destIds)].sort();
    if (uniqueDestIds.length <= 1) continue;
    const [lang, name] = key.split('::') as [string, string];
    for (const destId of uniqueDestIds) {
      findings.push({
        code: 'GRAPH.DESTINATION_NAME_DUPLICATE',
        severity: 'warning',
        entity: { kind: 'destination', id: destId },
        params: { lang, name, other_count: uniqueDestIds.length - 1 },
        ruleRef: null,
      });
    }
  }
  return findings;
}

function checkIncompleteLangCoverage(site: SiteData): Finding[] {
  const allLangs = new Set<string>();
  for (const dn of site.destination_names) {
    allLangs.add(dn.lang);
  }
  if (allLangs.size <= 1) return [];

  const langsByDest = new Map<string, Set<string>>();
  for (const dn of site.destination_names) {
    const existing = langsByDest.get(dn.destination_id);
    if (existing) {
      existing.add(dn.lang);
    } else {
      langsByDest.set(dn.destination_id, new Set([dn.lang]));
    }
  }

  const findings: Finding[] = [];
  const sortedLangs = [...allLangs].sort();
  const sortedDests = [...site.destinations].sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  for (const dest of sortedDests) {
    const destLangs = langsByDest.get(dest.id);
    if (!destLangs) continue;
    const missing = sortedLangs.filter((l) => !destLangs.has(l));
    if (missing.length > 0) {
      findings.push({
        code: 'GRAPH.DESTINATION_LANG_INCOMPLETE',
        severity: 'warning',
        entity: { kind: 'destination', id: dest.id },
        params: {
          present: [...destLangs].sort().join(','),
          missing: missing.join(','),
        },
        ruleRef: null,
      });
    }
  }
  return findings;
}

function checkAllVacantCategory(site: SiteData): Finding[] {
  const catDestMap = new Map<string, { total: number; vacant: number }>();
  const sortedDests = [...site.destinations].sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  for (const dest of sortedDests) {
    const entry = catDestMap.get(dest.category_id);
    if (entry) {
      entry.total++;
      if (dest.occupancy_status === 'vacant') entry.vacant++;
    } else {
      catDestMap.set(dest.category_id, {
        total: 1,
        vacant: dest.occupancy_status === 'vacant' ? 1 : 0,
      });
    }
  }

  const findings: Finding[] = [];
  const sortedCats = [...catDestMap.keys()].sort();
  for (const catId of sortedCats) {
    const entry = catDestMap.get(catId);
    if (!entry || entry.total === 0) continue;
    if (entry.vacant === entry.total) {
      findings.push({
        code: 'GRAPH.CATEGORY_ALL_VACANT',
        severity: 'warning',
        entity: { kind: 'category', id: catId },
        params: { count: entry.total },
        ruleRef: null,
      });
    }
  }
  return findings;
}

/**
 * N1.4 — règle S3. Une empreinte de nature cellule porte obligatoirement un
 * code d'unité ; les autres natures ne l'exigent pas.
 *
 * Un code vide ou fait d'espaces vaut un code absent : sur un panneau, il ne
 * désigne rien.
 */
function checkUnitCodeRequired(site: SiteData): Finding[] {
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
function checkUnitCodeDuplicate(site: SiteData): Finding[] {
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

export function runChecks(site: SiteData): Outcome<CheckReport> {
  const findings: Finding[] = [];

  findings.push(...checkDuplicateDisplayName(site));
  findings.push(...checkIncompleteLangCoverage(site));
  findings.push(...checkAllVacantCategory(site));
  findings.push(...checkNamingCollisions(site));
  findings.push(...checkUnitCodeRequired(site));
  findings.push(...checkUnitCodeDuplicate(site));

  return {
    ok: true,
    value: {
      checks_run: [
        'all_vacant_category',
        'duplicate_display_name',
        'incomplete_lang_coverage',
        'naming_collision',
        'unit_code_duplicate',
        'unit_code_required',
      ],
      checks_skipped: [
        'adjacence_chromatique',
        'contraste',
        'lisibilite',
      ],
      findings,
    },
    warnings: [],
  };
}
