import type {
  SiteData,
  Category,
  Pictogram,
  Finding,
  Outcome,
} from '@azimut/core-model';

/**
 * INV-3 — les trois gardes du registre de sécurité vivaient ici et n'étaient
 * appelés par rien. Ils sont descendus dans `core-model`, où `buildCommand`
 * peut les appeler : c'est le passage obligé de toute écriture, et A4.1
 * interdit à `core-model` de lire un moteur. Réexportés pour que les appelants
 * de ce module ne changent pas.
 */
export {
  guardSafetyRegistry, guardSafetyCreation, guardSafetyDeletion,
} from '@azimut/core-model';
export type {
  PictogramMutation, PictogramCreation, PictogramRegistryEntry,
} from '@azimut/core-model';

export type LibraryValidationResult = {
  readonly total_categories: number;
  readonly total_pictograms: number;
  readonly safety_pictograms: number;
  readonly wayfinding_pictograms: number;
  readonly sectors: readonly string[];
};

function categoryParentNotFoundFindings(
  categories: readonly Category[],
): Finding[] {
  const ids = new Set(categories.map((c) => c.id));
  const findings: Finding[] = [];
  const sorted = [...categories].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const cat of sorted) {
    if (cat.parent_id !== null && !ids.has(cat.parent_id)) {
      findings.push({
        code: 'DATA.CATEGORY_PARENT_NOT_FOUND',
        severity: 'blocking',
        entity: { kind: 'category', id: cat.id },
        params: { parent_id: cat.parent_id },
        ruleRef: null,
      });
    }
  }
  return findings;
}

function categoryCycleFindings(
  categories: readonly Category[],
): Finding[] {
  const parentMap = new Map<string, string | null>();
  for (const c of categories) {
    parentMap.set(c.id, c.parent_id);
  }

  const findings: Finding[] = [];
  const visited = new Set<string>();
  const sorted = [...categories].sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  for (const cat of sorted) {
    if (visited.has(cat.id)) continue;
    const path = new Set<string>();
    let current: string | null = cat.id;
    while (current !== null && !visited.has(current)) {
      if (path.has(current)) {
        findings.push({
          code: 'DATA.CATEGORY_CYCLE',
          severity: 'blocking',
          entity: { kind: 'category', id: current },
          params: {},
          ruleRef: null,
        });
        break;
      }
      path.add(current);
      current = parentMap.get(current) ?? null;
    }
    for (const id of path) {
      visited.add(id);
    }
  }
  return findings;
}

function pictogramCategoryNotFoundFindings(
  site: SiteData,
): Finding[] {
  const catIds = new Set(site.categories.map((c) => c.id));
  const findings: Finding[] = [];
  const sorted = [...site.pictograms].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const p of sorted) {
    if (!catIds.has(p.category_id)) {
      findings.push({
        code: 'DATA.PICTOGRAM_CATEGORY_NOT_FOUND',
        severity: 'blocking',
        entity: { kind: 'pictogram', id: p.id },
        params: { category_id: p.category_id },
        ruleRef: null,
      });
    }
  }
  return findings;
}

function destCategoryNotFoundFindings(
  site: SiteData,
): Finding[] {
  const catIds = new Set(site.categories.map((c) => c.id));
  const findings: Finding[] = [];
  const sorted = [...site.destinations].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const dest of sorted) {
    if (!catIds.has(dest.category_id)) {
      findings.push({
        code: 'DATA.DEST_CATEGORY_NOT_FOUND',
        severity: 'warning',
        entity: { kind: 'destination', id: dest.id },
        params: { category_id: dest.category_id },
        ruleRef: null,
      });
    }
  }
  return findings;
}

function emptySvgPathFindings(
  pictograms: readonly Pictogram[],
): Finding[] {
  const findings: Finding[] = [];
  const sorted = [...pictograms].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const p of sorted) {
    if (p.svg_path.trim() === '') {
      findings.push({
        code: 'DATA.EMPTY_SVG_PATH',
        severity: 'blocking',
        entity: { kind: 'pictogram', id: p.id },
        params: {},
        ruleRef: null,
      });
    }
  }
  return findings;
}

export function validateLibrary(
  site: SiteData,
): Outcome<LibraryValidationResult> {
  const allFindings: Finding[] = [
    ...categoryParentNotFoundFindings(site.categories),
    ...categoryCycleFindings(site.categories),
    ...pictogramCategoryNotFoundFindings(site),
    ...destCategoryNotFoundFindings(site),
    ...emptySvgPathFindings(site.pictograms),
  ];

  const blockings = allFindings.filter((f) => f.severity === 'blocking');
  const warnings = allFindings.filter(
    (f) => f.severity === 'warning' || f.severity === 'info',
  );

  const safetyCount = site.pictograms.filter(
    (p) => p.registry === 'safety',
  ).length;
  const sectors = [
    ...new Set(site.categories.map((c) => c.sector_key)),
  ].sort();

  if (blockings.length > 0) {
    return { ok: false, findings: [...blockings, ...warnings] };
  }

  return {
    ok: true,
    value: {
      total_categories: site.categories.length,
      total_pictograms: site.pictograms.length,
      safety_pictograms: safetyCount,
      wayfinding_pictograms: site.pictograms.length - safetyCount,
      sectors,
    },
    warnings,
  };
}
