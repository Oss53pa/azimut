/**
 * Le travail `audit_site` du service, branché sur la base (décision QB2 :
 * aucune nature nouvelle ; A5.10 la porte déjà).
 *
 * En plus du rapport d'audit, le travail inscrit le passage de validation du
 * graphe et l'enregistre comme validé par le service (0085, M02.W11) : c'est
 * ce passage, et lui seul, qui ouvre la soumission du tableau des messages.
 *
 * Le site est lu sous l'identité du demandeur, avec la révision de son graphe,
 * dans un même instantané ; le passage est écrit sous la même identité.
 */
import { validateGraph, computeGraphHash } from '@azimut/engine-graph';
import type { SiteData } from '@azimut/core-model';
import type { ServicePassage, ValidatedSnapshot } from '@azimut/db';
import { createAuditSiteHandler } from './audit-site.js';
import type { Job } from './job.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AuditSiteJobDeps = {
  readonly loadSnapshot: (orgId: string, siteId: string, requestedBy: string) => Promise<ValidatedSnapshot>;
  readonly recordPassage: (requestedBy: string, passage: ServicePassage) => Promise<string>;
  readonly now: () => Date;
};

function siteIdOf(job: Job): string {
  const value = job.payload['site_id'];
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new Error('audit_site job payload missing "site_id"');
  }
  return value;
}

export function createAuditSiteJobHandler(
  deps: AuditSiteJobDeps,
): (job: Job) => Promise<Record<string, unknown>> {
  return async (job: Job): Promise<Record<string, unknown>> => {
    const requester = job.requested_by;
    if (requester === null) throw new Error('audit_site job has no requester');
    const siteId = siteIdOf(job);
    const { site, revision }: { site: SiteData; revision: number } =
      await deps.loadSnapshot(job.org_id, siteId, requester);

    const report = await createAuditSiteHandler({ site })(job);

    const graph = validateGraph(site);
    const findings = graph.ok ? graph.warnings : graph.findings;
    const hash = computeGraphHash(site.graph);
    if (!hash.ok) throw new Error('graph hash refused');
    const validationId = await deps.recordPassage(requester, {
      orgId: job.org_id,
      siteId,
      revision,
      graphHash: hash.value,
      ranAt: deps.now().toISOString(),
      findings,
    });

    return {
      ...report,
      graph_validation: {
        id: validationId,
        passed: graph.ok,
        revision,
        graph_hash: hash.value,
      },
    };
  };
}
