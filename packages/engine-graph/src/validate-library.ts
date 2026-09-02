import type {
  SiteData,
  Category,
  Pictogram,
  Finding,
  Outcome,
} from '@azimut/core-model';

export type LibraryValidationResult = {
  readonly total_categories: number;
  readonly total_pictograms: number;
  readonly safety_pictograms: number;
  readonly wayfinding_pictograms: number;
  readonly sectors: readonly string[];
};

export type PictogramMutation = {
  readonly pictogram_id: string;
  readonly field: string;
  readonly old_value: string;
  readonly new_value: string;
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
        code: 'LIBRARY.CATEGORY_PARENT_NOT_FOUND',
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
          code: 'LIBRARY.CATEGORY_CYCLE',
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
        code: 'LIBRARY.PICTOGRAM_CATEGORY_NOT_FOUND',
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
        code: 'LIBRARY.DEST_CATEGORY_NOT_FOUND',
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
        code: 'LIBRARY.EMPTY_SVG_PATH',
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

export function guardSafetyRegistry(
  site: SiteData,
  mutations: readonly PictogramMutation[],
): Outcome<null> {
  const pictoMap = new Map(site.pictograms.map((p) => [p.id, p]));
  const findings: Finding[] = [];
  const sorted = [...mutations].sort((a, b) =>
    a.pictogram_id.localeCompare(b.pictogram_id),
  );

  for (const mut of sorted) {
    const picto = pictoMap.get(mut.pictogram_id);
    if (!picto) continue;
    if (picto.registry === 'safety') {
      findings.push({
        code: 'LIBRARY.SAFETY_REGISTRY_IMMUTABLE',
        severity: 'blocking',
        entity: { kind: 'pictogram', id: mut.pictogram_id },
        params: {
          field: mut.field,
          attempted_value: mut.new_value,
        },
        ruleRef: 'INV-3',
      });
    }
  }

  if (findings.length > 0) {
    return { ok: false, findings };
  }
  return { ok: true, value: null, warnings: [] };
}

export function guardSafetyDeletion(
  site: SiteData,
  pictogramIds: readonly string[],
): Outcome<null> {
  const pictoMap = new Map(site.pictograms.map((p) => [p.id, p]));
  const findings: Finding[] = [];
  const sorted = [...pictogramIds].sort();

  for (const id of sorted) {
    const picto = pictoMap.get(id);
    if (!picto) continue;
    if (picto.registry === 'safety') {
      findings.push({
        code: 'LIBRARY.SAFETY_REGISTRY_IMMUTABLE',
        severity: 'blocking',
        entity: { kind: 'pictogram', id },
        params: { operation: 'delete' },
        ruleRef: 'INV-3',
      });
    }
  }

  if (findings.length > 0) {
    return { ok: false, findings };
  }
  return { ok: true, value: null, warnings: [] };
}
