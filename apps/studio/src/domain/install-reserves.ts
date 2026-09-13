import type { Finding, Outcome } from '@azimut/core-model';

/**
 * H6.2 — Between an approved proof and an installed support lies the worksite
 * phase: factory or on-site reception with reserves, and the tracked lifting of
 * those reserves. A support only flips to "installed" once its reserves are
 * lifted. This audit surfaces every installation reserve still open as a
 * warning INSTALL.RESERVATION_OPEN. Application-layer guard for module 7.
 */
export type InstallReserve = {
  readonly id: string;
  readonly support_id: string;
  readonly lifted: boolean;
};

/**
 * Audit installation reserves. Returns one warning INSTALL.RESERVATION_OPEN per
 * reserve not yet lifted, sorted by reserve id; the finding names the support.
 * Always ok — an open reserve is a warning that blocks the flip to installed at
 * the caller, not a catalog-level block on its own.
 */
export function auditInstallReserves(
  reserves: readonly InstallReserve[],
): Outcome<null> {
  const warnings: Finding[] = [];
  const sorted = [...reserves].sort((a, b) => a.id.localeCompare(b.id));

  for (const reserve of sorted) {
    if (!reserve.lifted) {
      warnings.push({
        code: 'INSTALL.RESERVATION_OPEN',
        severity: 'warning',
        entity: { kind: 'install_reserve', id: reserve.id },
        params: { support_id: reserve.support_id },
        ruleRef: 'H6.2',
      });
    }
  }

  return { ok: true, value: null, warnings };
}
