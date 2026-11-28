import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import type { SiteData } from '@azimut/core-model';
import { codePointCompare } from '@azimut/core-model';
import { allReferenceSites, siteChecksum } from '@azimut/testkit';
import { FIXTURE_ROLE } from '../fixture-role.js';
import { referenceUuid, writeReferenceSite } from '../fixture-site.js';
import { loadSiteData } from '../load-site-data.js';

/**
 * T-0.10 — « chaque site de référence se charge en base et en mémoire, avec
 * empreinte stable ».
 *
 * Chaque site est écrit en base, relu par le chargeur du compilateur
 * (`loadSiteData`), ses identifiants rendus à leurs noms, et son empreinte
 * comparée à celle du site en mémoire. Égalité stricte : un champ que la base
 * ne garde pas, ou qu'elle rend autrement, fait échouer l'essai.
 *
 * Quatre écarts de forme sont admis, et seulement eux, parce que le modèle les
 * déclare équivalents :
 *  · l'ordre des listes : la base n'en garantit aucun, les deux côtés sont
 *    triés par identifiant avant l'empreinte, et les faces d'une typologie,
 *    sans identifiant, par leur côté, comme les moteurs les lisent ;
 *  · une liste ou un ordre de tracé absents valent vide ou nul (`zones`,
 *    `temporary_closures`, `render_order` sont facultatifs au type) ;
 *  · les gabarits de face, que la base ne stocke pas et que l'appelant fournit
 *    (contrat de `assembleSiteData`).
 *
 * `ref-broken` porte des fautes voulues que les moteurs doivent trouver ; la
 * base en refuse certaines dès l'insertion. Décision d'Oss53pa du 28 novembre
 * 2026 : l'essai exige ce refus, et la contrainte qui le donne. Le site reste
 * un site en mémoire.
 *
 * Chaque site s'écrit dans une transaction annulée, sous le rôle de décor du
 * banc : rien n'en reste.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
let client: postgres.Sql;
let db: ReturnType<typeof drizzle>;

beforeAll(() => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  client = postgres(URL, { onnotice: () => undefined });
  db = drizzle(client);
});

afterAll(async () => { await client.end(); });

/** Toutes les chaînes du site, pour rendre à chaque uuid son nom d'origine. */
function strings(value: unknown, into: Set<string>): Set<string> {
  if (typeof value === 'string') into.add(value);
  else if (Array.isArray(value)) for (const v of value) strings(v, into);
  else if (typeof value === 'object' && value !== null) for (const v of Object.values(value)) strings(v, into);
  return into;
}

function rename(value: unknown, names: ReadonlyMap<string, string>): unknown {
  if (typeof value === 'string') return names.get(value) ?? value;
  if (Array.isArray(value)) return value.map(v => rename(v, names));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rename(v, names)]));
  }
  return value;
}

/** Les listes d'objets identifiés, triées par identifiant ; les autres gardent leur ordre. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(canonical);
    const ids = items.map(v => (typeof v === 'object' && v !== null && 'id' in v ? (v as { id: unknown }).id : null));
    if (ids.length > 0 && ids.every(i => typeof i === 'string')) {
      return items.map((v, i) => [ids[i] as string, v] as const)
        .sort((a, b) => codePointCompare(a[0], b[0])).map(([, v]) => v);
    }
    return items;
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, canonical(v)]));
  }
  return value;
}

const bySide = (types: SiteData['support_types']): SiteData['support_types'] =>
  types.map(t => ({ ...t, faces: [...t.faces].sort((a, b) => codePointCompare(a.side, b.side)) }));

/** Les listes d'objets identifiés du site, graphe compris. */
function listsOf(site: SiteData): [string, readonly { readonly id: string }[]][] {
  const entries: [string, unknown][] = [
    ...Object.entries(site),
    ...Object.entries(site.graph).map(([k, v]): [string, unknown] => [`graph.${k}`, v]),
  ];
  const out: [string, readonly { readonly id: string }[]][] = [];
  for (const [name, value] of entries) {
    if (!Array.isArray(value)) continue;
    const items: { readonly id: string }[] = [];
    for (const item of value as unknown[]) {
      const id: unknown = typeof item === 'object' && item !== null ? (item as { id?: unknown }).id : undefined;
      if (typeof id === 'string') items.push({ id });
    }
    if (items.length === value.length) out.push([name, items]);
  }
  return out;
}

function expectedOf(site: SiteData): unknown {
  return canonical({
    ...site,
    support_types: bySide(site.support_types),
    zones: site.zones ?? [],
    temporary_closures: site.temporary_closures ?? [],
    volumes: site.volumes.map(v => ({ ...v, render_order: v.render_order ?? null })),
  });
}

async function roundTrip(key: string, site: SiteData): Promise<SiteData> {
  const rolledBack = new Error('annulation voulue');
  let read: SiteData | null = null;
  await db.transaction(async tx => {
    await tx.execute(sql.raw(`set local role ${FIXTURE_ROLE}`));
    await writeReferenceSite(tx, key, site);
    read = await loadSiteData(tx, referenceUuid(key, site.organization.id), referenceUuid(key, site.site.id));
    throw rolledBack;
  }).catch((e: unknown) => { if (e !== rolledBack) throw e; });
  if (read === null) throw new Error(`${key} : rien relu`);
  return read;
}

describe('T-0.10 — chaque site de référence se charge en base, avec empreinte stable', () => {
  for (const [key, site] of allReferenceSites) {
    if (key === 'ref-broken') continue;
    it(key, async () => {
      const names = new Map([...strings(site, new Set())].map(s => [referenceUuid(key, s), s]));
      const read = await roundTrip(key, site);
      // A9 — le chargeur rend chaque liste triée par identifiant : l'ordre ne
      // dépend plus de celui, non garanti, de la base.
      for (const [name, list] of listsOf(read)) {
        const ids = list.map(item => item.id);
        expect(ids, name).toEqual([...ids].sort(codePointCompare));
      }
      const restored = rename({ ...read, face_templates: site.face_templates }, names);
      expect(canonical(restored)).toEqual(expectedOf(site));
      expect(siteChecksum(canonical(restored))).toBe(siteChecksum(expectedOf(site)));
    });
  }

  it('ref-broken est refusé par la base, au nom de la contrainte qui le refuse', async () => {
    const site = allReferenceSites.get('ref-broken');
    if (site === undefined) throw new Error('ref-broken absent');
    const motif = await roundTrip('ref-broken', site).then(
      () => 'chargé',
      (e: unknown) => {
        const cause = e instanceof Error ? e.cause : undefined;
        return cause instanceof Error ? cause.message : String(e);
      },
    );
    expect(motif).toMatch(/footprint_unit_code_required_for_cell/);
  });

  it('deux chargements du même site rendent la même empreinte', async () => {
    const site = allReferenceSites.get('ref-multilevel');
    if (site === undefined) throw new Error('ref-multilevel absent');
    const [a, b] = [await roundTrip('ref-multilevel', site), await roundTrip('ref-multilevel', site)];
    expect(siteChecksum(a)).toBe(siteChecksum(b));
  });
});
