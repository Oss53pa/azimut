import type {
  SiteData,
  Finding,
  Outcome,
} from '@azimut/core-model';

export type SupportValidationResult = {
  readonly total_support_types: number;
  readonly total_face_templates: number;
  readonly type_keys: readonly string[];
};

function duplicateTypeKeyFindings(site: SiteData): Finding[] {
  const seen = new Map<string, string>();
  const findings: Finding[] = [];
  const sorted = [...site.support_types].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const st of sorted) {
    const existing = seen.get(st.key);
    if (existing) {
      findings.push({
        code: 'SUPPORT.DUPLICATE_TYPE_KEY',
        severity: 'blocking',
        entity: { kind: 'support_type', id: st.id },
        params: { key: st.key, first_id: existing },
        ruleRef: null,
      });
    } else {
      seen.set(st.key, st.id);
    }
  }
  return findings;
}

function faceCountMismatchFindings(site: SiteData): Finding[] {
  const findings: Finding[] = [];
  const sorted = [...site.support_types].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const st of sorted) {
    if (st.faces.length !== st.face_count) {
      findings.push({
        code: 'SUPPORT.FACE_COUNT_MISMATCH',
        severity: 'blocking',
        entity: { kind: 'support_type', id: st.id },
        params: {
          declared: st.face_count,
          actual: st.faces.length,
        },
        ruleRef: null,
      });
    }
  }
  return findings;
}

function templateTypeNotFoundFindings(site: SiteData): Finding[] {
  const typeKeys = new Set(site.support_types.map((st) => st.key));
  const findings: Finding[] = [];
  const sorted = [...site.face_templates].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const tpl of sorted) {
    if (!typeKeys.has(tpl.support_type_key)) {
      findings.push({
        code: 'SUPPORT.TEMPLATE_TYPE_NOT_FOUND',
        severity: 'blocking',
        entity: { kind: 'face_template', id: tpl.id },
        params: { support_type_key: tpl.support_type_key },
        ruleRef: null,
      });
    }
  }
  return findings;
}

function templateSideNotFoundFindings(site: SiteData): Finding[] {
  const typeSides = new Map<string, Set<string>>();
  for (const st of site.support_types) {
    typeSides.set(
      st.key,
      new Set(st.faces.map((f) => f.side)),
    );
  }
  const findings: Finding[] = [];
  const sorted = [...site.face_templates].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const tpl of sorted) {
    const sides = typeSides.get(tpl.support_type_key);
    if (sides && !sides.has(tpl.side)) {
      findings.push({
        code: 'SUPPORT.TEMPLATE_SIDE_NOT_FOUND',
        severity: 'warning',
        entity: { kind: 'face_template', id: tpl.id },
        params: {
          side: tpl.side,
          support_type_key: tpl.support_type_key,
          available_sides: [...sides].sort().join(', '),
        },
        ruleRef: null,
      });
    }
  }
  return findings;
}

function blockRegionFindings(site: SiteData): Finding[] {
  const findings: Finding[] = [];
  const sorted = [...site.face_templates].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const tpl of sorted) {
    for (const block of tpl.blocks) {
      const { x_pct, y_pct, w_pct, h_pct } = block.region;
      if (
        x_pct < 0 ||
        y_pct < 0 ||
        w_pct <= 0 ||
        h_pct <= 0 ||
        x_pct + w_pct > 100 ||
        y_pct + h_pct > 100
      ) {
        findings.push({
          code: 'SUPPORT.BLOCK_REGION_INVALID',
          severity: 'blocking',
          entity: { kind: 'face_template', id: tpl.id },
          params: {
            block_kind: block.kind,
            ordinal: block.ordinal,
            x_pct,
            y_pct,
            w_pct,
            h_pct,
          },
          ruleRef: null,
        });
      }
    }
  }
  return findings;
}

export function validateSupports(
  site: SiteData,
): Outcome<SupportValidationResult> {
  const allFindings: Finding[] = [
    ...duplicateTypeKeyFindings(site),
    ...faceCountMismatchFindings(site),
    ...templateTypeNotFoundFindings(site),
    ...templateSideNotFoundFindings(site),
    ...blockRegionFindings(site),
  ];

  const blockings = allFindings.filter((f) => f.severity === 'blocking');
  const warnings = allFindings.filter(
    (f) => f.severity === 'warning' || f.severity === 'info',
  );

  const typeKeys = [
    ...new Set(site.support_types.map((st) => st.key)),
  ].sort();

  if (blockings.length > 0) {
    return { ok: false, findings: [...blockings, ...warnings] };
  }

  return {
    ok: true,
    value: {
      total_support_types: site.support_types.length,
      total_face_templates: site.face_templates.length,
      type_keys: typeKeys,
    },
    warnings,
  };
}
