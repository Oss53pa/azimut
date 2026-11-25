/**
 * M02.W11 tenue par la base (0085, décisions QB0 à QB4) — ce que le service
 * lit et écrit pour un passage de validation.
 *
 * Le service charge le site et la révision de son graphe dans un même
 * instantané (REPEATABLE READ, lecture seule) : une écriture tombée pendant le
 * chargement ne peut pas mêler deux états du graphe, et la révision lue est
 * exactement celle du graphe validé. Il écrit ensuite le passage sous
 * l'identité du demandeur (A6.1), puis l'enregistre par
 * `record_service_validation`, que seule une session du service peut appeler.
 * Si le graphe a bougé entre la lecture et l'écriture, la révision enregistrée
 * est en retard, et la garde de soumission le voit.
 */
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Finding, SiteData } from '@azimut/core-model';
import { loadSiteData } from './load-site-data.js';
import { setSessionIdentity } from './write-path.js';

export type ValidatedSnapshot = {
  readonly site: SiteData;
  /** Révision du graphe dans le même instantané ; 0 si le graphe n'a jamais été écrit. */
  readonly revision: number;
};

export async function loadSiteSnapshotAs<TSchema extends Record<string, unknown> = Record<string, never>>(
  db: PostgresJsDatabase<TSchema>,
  userId: string,
  orgId: string,
  siteId: string,
): Promise<ValidatedSnapshot> {
  return db.transaction(async tx => {
    await setSessionIdentity(tx, { userId });
    const rows = await tx.execute(sql`
      select revision::text as revision from azimut.graph_revision where site_id = ${siteId}`);
    const raw = (rows as unknown as readonly { revision?: unknown }[])[0]?.revision;
    const revision = typeof raw === 'string' ? Number(raw) : 0;
    if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('graph_revision illisible');
    const site = await loadSiteData(tx, orgId, siteId);
    return { site, revision };
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
}

export type ServicePassage = {
  readonly orgId: string;
  readonly siteId: string;
  readonly revision: number;
  readonly graphHash: string;
  readonly ranAt: string;
  readonly findings: readonly Finding[];
};

/** Écrit le passage sous l'identité du demandeur, puis l'enregistre comme validé par le service. */
export async function recordServicePassage<TSchema extends Record<string, unknown> = Record<string, never>>(
  db: PostgresJsDatabase<TSchema>,
  userId: string,
  passage: ServicePassage,
): Promise<string> {
  const blocking = passage.findings.filter(f => f.severity === 'blocking').length;
  const warning = passage.findings.filter(f => f.severity === 'warning').length;
  return db.transaction(async tx => {
    await setSessionIdentity(tx, { userId });
    const rows = await tx.execute(sql`
      insert into azimut.graph_validation
        (org_id, site_id, graph_hash, ran_at, passed, blocking_count, warning_count, findings)
      values (${passage.orgId}, ${passage.siteId}, ${passage.graphHash}, ${passage.ranAt},
              ${blocking === 0}, ${blocking}, ${warning}, ${JSON.stringify(passage.findings)}::text::jsonb)
      returning id`);
    const id = (rows as unknown as readonly { id?: unknown }[])[0]?.id;
    if (typeof id !== 'string') throw new Error('graph_validation sans identifiant');
    await tx.execute(sql`
      select azimut.record_service_validation(${passage.siteId}, ${passage.revision}::bigint, ${id})`);
    return id;
  });
}
