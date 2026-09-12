import { contentHash, type Finding, type Outcome } from '@azimut/core-model';

/**
 * J5.2 / J5.4 — Pictograms of one family must be optically coherent: a single
 * stroke width per family (or a flat fill, never the two mixed) and a shared
 * construction grid. The family (pictogram_family) declares grid, stroke_width
 * and style; each member must match them. This guard compares every member
 * against its declared family and warns PICTO.FAMILY_INCONSISTENT on the first
 * divergent axis, in the fixed order style → stroke_width → grid (J8: warning).
 */
export type FamilyStyle = 'stroke' | 'flat';

export type PictogramFamily = {
  readonly id: string;
  readonly style: FamilyStyle;
  /** Declared line thickness; null for a flat-fill family. */
  readonly stroke_width: number | null;
  /** Construction grid (jsonb) — compared by canonical content. */
  readonly grid: unknown;
};

export type FamilyMember = {
  readonly id: string;
  readonly family_id: string;
  readonly style: FamilyStyle;
  readonly stroke_width: number | null;
  readonly grid: unknown;
};

function divergentAxis(
  member: FamilyMember,
  family: PictogramFamily,
): string | null {
  if (member.style !== family.style) return 'style';
  if (family.style === 'stroke' && member.stroke_width !== family.stroke_width) {
    return 'stroke_width';
  }
  if (contentHash(member.grid) !== contentHash(family.grid)) return 'grid';
  return null;
}

/**
 * Guard that each pictogram is consistent with its family. Members whose
 * family_id is unknown are left to the referential checks and skipped here.
 * Returns one warning PICTO.FAMILY_INCONSISTENT per divergent member, sorted by
 * member id, naming the divergent axis and the family.
 */
export function guardFamilyConsistency(
  members: readonly FamilyMember[],
  families: readonly PictogramFamily[],
): Outcome<null> {
  const byId = new Map<string, PictogramFamily>();
  for (const family of families) byId.set(family.id, family);

  const warnings: Finding[] = [];
  const sorted = [...members].sort((a, b) => a.id.localeCompare(b.id));

  for (const member of sorted) {
    const family = byId.get(member.family_id);
    if (family === undefined) continue;
    const axis = divergentAxis(member, family);
    if (axis !== null) {
      warnings.push({
        code: 'PICTO.FAMILY_INCONSISTENT',
        severity: 'warning',
        entity: { kind: 'pictogram', id: member.id },
        params: { axis, family_id: family.id },
        ruleRef: 'J5.2',
      });
    }
  }

  return { ok: true, value: null, warnings };
}
