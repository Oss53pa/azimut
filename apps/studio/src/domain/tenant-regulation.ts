import type { Finding, Outcome } from '@azimut/core-model';

/**
 * H5.2 / H5.3 — A tenant sign is instructed and followed against the site's
 * sign regulation, never designed by Azimut, so it is a distinct entity, not a
 * support. The regulation is expressed as controllable rules; the measurable
 * ones are checked automatically here (heights, overhangs, materials, lighting,
 * forbidden features), the rest are a human opinion. Each measurable breach
 * raises a blocking TENANT.RULE_VIOLATION.
 *
 * Time-range rules (plages horaires) need a temporal model and are left to the
 * human instruction step; they are not checked here.
 */
export type SignRegulation = {
  /** Null when the axis is unrestricted. */
  readonly max_height_mm: number | null;
  readonly max_overhang_mm: number | null;
  /** Empty means no material restriction. */
  readonly allowed_materials: readonly string[];
  /** Empty means no lighting restriction. */
  readonly allowed_lighting: readonly string[];
  /** Feature tags the regulation forbids outright. */
  readonly forbidden_features: readonly string[];
};

export type SignProject = {
  readonly id: string;
  readonly height_mm: number;
  readonly overhang_mm: number;
  readonly material: string;
  readonly lighting: string;
  readonly features: readonly string[];
};

/**
 * Control a tenant sign project against the site regulation. Returns one
 * blocking TENANT.RULE_VIOLATION per breached measurable rule, in a fixed axis
 * order (height, overhang, material, lighting, then each forbidden feature by
 * name); ok when every measurable rule is satisfied.
 */
export function guardSignProject(
  project: SignProject,
  regulation: SignRegulation,
): Outcome<null> {
  const findings: Finding[] = [];
  const violate = (axis: string, detail: string): void => {
    findings.push({
      code: 'TENANT.RULE_VIOLATION',
      severity: 'blocking',
      entity: { kind: 'sign_project', id: project.id },
      params: { axis, detail },
      ruleRef: 'H5.2',
    });
  };

  if (regulation.max_height_mm !== null && project.height_mm > regulation.max_height_mm) {
    violate('height', String(project.height_mm));
  }
  if (regulation.max_overhang_mm !== null && project.overhang_mm > regulation.max_overhang_mm) {
    violate('overhang', String(project.overhang_mm));
  }
  if (
    regulation.allowed_materials.length > 0 &&
    !regulation.allowed_materials.includes(project.material)
  ) {
    violate('material', project.material);
  }
  if (
    regulation.allowed_lighting.length > 0 &&
    !regulation.allowed_lighting.includes(project.lighting)
  ) {
    violate('lighting', project.lighting);
  }
  const forbidden = new Set(regulation.forbidden_features);
  for (const feature of [...project.features].sort((a, b) => a.localeCompare(b))) {
    if (forbidden.has(feature)) {
      violate('forbidden_feature', feature);
    }
  }

  if (findings.length > 0) {
    return { ok: false, findings };
  }
  return { ok: true, value: null, warnings: [] };
}
