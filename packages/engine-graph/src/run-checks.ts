import type {
  SiteData,
  Finding,
  Outcome,
} from '@azimut/core-model';

export type CheckReport = {
  readonly checks_run: readonly string[];
  readonly checks_skipped: readonly string[];
  readonly findings: readonly Finding[];
};

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

export function runChecks(site: SiteData): Outcome<CheckReport> {
  const findings: Finding[] = [];

  findings.push(...checkDuplicateDisplayName(site));
  findings.push(...checkIncompleteLangCoverage(site));
  findings.push(...checkAllVacantCategory(site));

  return {
    ok: true,
    value: {
      checks_run: [
        'all_vacant_category',
        'duplicate_display_name',
        'incomplete_lang_coverage',
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
