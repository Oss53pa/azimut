import type { SiteData, Finding, Outcome } from '@azimut/core-model';
import { codePointCompare } from '@azimut/core-model';

export type CharterApplication = {
  readonly target_id: string;
  readonly target_registry: 'safety' | 'wayfinding';
  readonly change_kind:
    | 'color'
    | 'geometry'
    | 'pictogram'
    | 'proportion';
  readonly field: string;
  readonly value: string;
};

export function guardCharterOnSafety(
  _site: SiteData,
  applications: readonly CharterApplication[],
): Outcome<null> {
  const findings: Finding[] = [];
  const sorted = [...applications].sort((a, b) =>
    codePointCompare(a.target_id, b.target_id) ||
    codePointCompare(a.change_kind, b.change_kind),
  );

  for (const app of sorted) {
    if (app.target_registry !== 'safety') continue;
    findings.push({
      code: 'SECURITY.CHARTER_OVERRIDE_DENIED',
      severity: 'blocking',
      entity: { kind: 'pictogram', id: app.target_id },
      params: {
        change_kind: app.change_kind,
        field: app.field,
        attempted_value: app.value,
      },
      ruleRef: 'INV-3',
    });
  }

  if (findings.length > 0) {
    return { ok: false, findings };
  }
  return { ok: true, value: null, warnings: [] };
}
