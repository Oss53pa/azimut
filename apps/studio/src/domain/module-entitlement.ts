import type { Finding, Outcome } from '@azimut/core-model';

/**
 * I5.2 — Rights are held per module (module_entitlement). This is the
 * application layer: engines never consult rights, so this guard lives in the
 * app so that commercial partitioning does not contaminate any computation.
 *
 * Rules enforced here:
 *  - a module not subscribed is ABSENT from navigation, never greyed out;
 *  - a suspended module's data stays readable in export, never deleted;
 *  - an operation targeting a non-entitled module raises MODULE.NOT_ENTITLED.
 */
export const ENTITLEMENT_STATES = [
  'active',
  'trial',
  'suspended',
  'expired',
] as const;
export type EntitlementState = (typeof ENTITLEMENT_STATES)[number];

/** One row of module_entitlement (I5.2). Dates are ISO 'YYYY-MM-DD'. */
export type ModuleEntitlement = {
  readonly module_key: string;
  readonly state: EntitlementState;
  readonly from_date: string;
  /** Open-ended when null. */
  readonly to_date: string | null;
};

function coversDate(e: ModuleEntitlement, at: string): boolean {
  // ISO-8601 dates compare correctly as strings.
  if (at < e.from_date) return false;
  if (e.to_date !== null && at > e.to_date) return false;
  return true;
}

function effectiveState(
  entitlements: readonly ModuleEntitlement[],
  moduleKey: string,
  at: string,
): EntitlementState | null {
  let best: EntitlementState | null = null;
  // Rank so the most permissive covering row wins deterministically.
  const rank: Record<EntitlementState, number> = {
    active: 3,
    trial: 2,
    suspended: 1,
    expired: 0,
  };
  for (const e of entitlements) {
    if (e.module_key !== moduleKey) continue;
    if (!coversDate(e, at)) continue;
    if (best === null || rank[e.state] > rank[best]) best = e.state;
  }
  return best;
}

/**
 * A module is navigable when a subscription (active or trial) currently covers
 * the date. Suspended, expired, or absent modules are not navigable — and the
 * navigation must drop them, never grey them (I5.2).
 */
export function isModuleNavigable(
  entitlements: readonly ModuleEntitlement[],
  moduleKey: string,
  at: string,
): boolean {
  const state = effectiveState(entitlements, moduleKey, at);
  return state === 'active' || state === 'trial';
}

/**
 * Suspended data stays readable in export; only a fully absent (never granted,
 * covering the date) or expired module is unreadable (I5.2).
 */
export function isModuleExportReadable(
  entitlements: readonly ModuleEntitlement[],
  moduleKey: string,
  at: string,
): boolean {
  const state = effectiveState(entitlements, moduleKey, at);
  return state === 'active' || state === 'trial' || state === 'suspended';
}

/**
 * Guard an operation targeting a module: blocking MODULE.NOT_ENTITLED when the
 * module is not currently entitled (no active or trial subscription covering
 * the date). ok otherwise.
 */
export function guardModuleOperation(
  entitlements: readonly ModuleEntitlement[],
  moduleKey: string,
  at: string,
): Outcome<null> {
  if (isModuleNavigable(entitlements, moduleKey, at)) {
    return { ok: true, value: null, warnings: [] };
  }
  const finding: Finding = {
    code: 'MODULE.NOT_ENTITLED',
    severity: 'blocking',
    entity: { kind: 'module', id: moduleKey },
    params: {
      module_key: moduleKey,
      state: effectiveState(entitlements, moduleKey, at) ?? 'absent',
    },
    ruleRef: 'I5.2',
  };
  return { ok: false, findings: [finding] };
}
