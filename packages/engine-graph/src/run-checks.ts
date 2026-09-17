import type {
  SiteData,
  Finding,
  Outcome,
  SiteVocabulary,
} from '@azimut/core-model';
import { guardNamingCollisions, type NamedEntity } from './guard-naming.js';
import { auditLexicon } from './audit-lexicon.js';
import { auditSiteFacts } from './audit-site-facts.js';
import { auditSourceClaims } from './audit-source-claims.js';
import { auditParking } from './audit-parking.js';

export type CheckReport = {
  readonly checks_run: readonly string[];
  /**
   * Contrôles que le paquet de règles rendrait possibles et qui n'ont pas
   * tourné faute de ce paquet. Remède : lier un paquet au site.
   */
  readonly checks_skipped: readonly string[];
  /**
   * Contrôles qui n'ont pas tourné parce que le site ne déclare rien à leur
   * opposer : pas de lexique de charte, pas de fait, pas d'affirmation de
   * source.
   *
   * Liste distincte de `checks_skipped`, parce que la cause et le remède
   * diffèrent : ici il faut saisir une donnée du site, là il faut lier un
   * paquet de règles. Les confondre enverrait l'utilisateur au mauvais écran.
   *
   * Et surtout, un contrôle non exercé ne doit jamais se lire comme un contrôle
   * passé : sans cette liste, une charte sans lexique produirait « aucune
   * anomalie » et l'absence de règle passerait pour un satisfecit.
   */
  readonly checks_undeclared: readonly string[];
  readonly findings: readonly Finding[];
};

/**
 * Réexport : le vocabulaire est un registre du modèle, pas une notion de
 * moteur. Il vit en `core-model` pour que le dépôt de données puisse le rendre
 * sans dépendre d'un moteur.
 */
export type { SiteVocabulary } from '@azimut/core-model';

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

export function runChecks(
  site: SiteData,
  vocabulary: SiteVocabulary = {},
): Outcome<CheckReport> {
  const findings: Finding[] = [];

  findings.push(...checkDuplicateDisplayName(site));
  findings.push(...checkIncompleteLangCoverage(site));
  findings.push(...checkAllVacantCategory(site));
  findings.push(...checkNamingCollisions(site));

  const run = [
    'all_vacant_category',
    'duplicate_display_name',
    'incomplete_lang_coverage',
    'naming_collision',
  ];
  const undeclared: string[] = [];

  const lexicon = vocabulary.lexicon ?? [];
  if (lexicon.length === 0) {
    undeclared.push('charter_lexicon');
  } else {
    findings.push(...auditLexicon(site, lexicon).findings);
    run.push('charter_lexicon');
  }

  const facts = vocabulary.facts ?? [];
  if (facts.length === 0) {
    undeclared.push('site_facts');
  } else {
    findings.push(...auditSiteFacts(site, facts).findings);
    run.push('site_facts');
  }

  // Le stationnement est de la géométrie du site : il vient de `SiteData`, pas
  // du vocabulaire, et un site sans parking n'a rien à contrôler — ce n'est pas
  // un contrôle non exercé, c'est un site sans parking.
  if (site.parkings.length > 0) {
    findings.push(...auditParking({
      parkings: site.parkings,
      spaces: site.parking_spaces,
      uncovered: site.parking_uncovered,
    }).findings);
    run.push('parking_coverage');
  }

  const claims = vocabulary.claims ?? [];
  if (claims.length === 0) {
    undeclared.push('source_discrepancies');
  } else {
    findings.push(...auditSourceClaims(claims, vocabulary.decisions).findings);
    run.push('source_discrepancies');
  }

  return {
    ok: true,
    value: {
      checks_run: run.sort((a, b) => a.localeCompare(b)),
      checks_skipped: [
        'adjacence_chromatique',
        'contraste',
        'lisibilite',
      ],
      checks_undeclared: undeclared,
      findings,
    },
    warnings: [],
  };
}
