/**
 * A5.7 — les lignes du parc posé : un support du site par ligne, ses poses
 * et les divergences enregistrées sur elles. Rien n'est déduit de plus que
 * ce que les tables portent.
 */
import type {
  InstalledSupport, MaintenanceRegistry, RecordedDivergence, SiteData, Support,
} from '@azimut/core-model';

export type FleetRow = {
  readonly support: Support;
  /** Poses du support, de la plus ancienne à la plus récente. */
  readonly poses: readonly InstalledSupport[];
  readonly divergences: readonly RecordedDivergence[];
  readonly openDivergences: number;
};

export type RecordedDivergenceRow = {
  readonly divergence: RecordedDivergence;
  /** Support de la pose, ou `null` si la pose n'est pas lue. */
  readonly supportId: string | null;
};

export function isOpen(d: RecordedDivergence): boolean {
  return d.resolved_at === null;
}

export function lastPose(row: FleetRow): InstalledSupport | null {
  return row.poses[row.poses.length - 1] ?? null;
}

export function fleetRows(site: SiteData, registry: MaintenanceRegistry): readonly FleetRow[] {
  const posesBySupport = new Map<string, InstalledSupport[]>();
  for (const pose of registry.installed) {
    const bucket = posesBySupport.get(pose.support_id);
    if (bucket === undefined) posesBySupport.set(pose.support_id, [pose]);
    else bucket.push(pose);
  }
  const supportOfPose = new Map(registry.installed.map(p => [p.id, p.support_id]));

  return [...site.supports]
    .sort((a, b) => (a.code ?? a.id).localeCompare(b.code ?? b.id))
    .map((support): FleetRow => {
      const poses = [...(posesBySupport.get(support.id) ?? [])]
        .sort((a, b) => a.installed_at.localeCompare(b.installed_at) || a.id.localeCompare(b.id));
      const divergences = registry.divergences.filter(d => supportOfPose.get(d.installed_support_id) === support.id);
      return { support, poses, divergences, openDivergences: divergences.filter(isOpen).length };
    });
}

export function recordedDivergenceRows(registry: MaintenanceRegistry): readonly RecordedDivergenceRow[] {
  const supportOfPose = new Map(registry.installed.map(p => [p.id, p.support_id]));
  return registry.divergences.map(divergence => ({
    divergence,
    supportId: supportOfPose.get(divergence.installed_support_id) ?? null,
  }));
}

/** Portée d'un ordre de travaux, citée en texte stable. */
export function scopeText(scope: unknown): string {
  if (scope === null || scope === undefined) return '';
  if (typeof scope === 'string') return scope;
  if (typeof scope === 'object' && !Array.isArray(scope)) {
    const record = scope as Readonly<Record<string, unknown>>;
    return Object.keys(record)
      .sort()
      .map(key => {
        const v = record[key];
        return `${key} : ${typeof v === 'string' ? v : JSON.stringify(v)}`;
      })
      .join(' · ');
  }
  return JSON.stringify(scope);
}
