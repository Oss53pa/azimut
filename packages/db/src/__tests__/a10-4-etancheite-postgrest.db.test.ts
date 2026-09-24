import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import type { Sql } from 'postgres';
import { existsSync } from 'node:fs';
import {
  installPlatformStubs, startPostgrest, signToken,
} from '../postgrest-harness.js';
import type { Harness } from '../postgrest-harness.js';
import { deleteOrgFixture } from '../fixture-cleanup.js';

/** La première valeur d'un décompte, ou l'échec plutôt qu'un zéro supposé. */
function only<T>(rows: readonly T[]): T {
  const first = rows[0];
  if (first === undefined) throw new Error('aucune ligne rendue par le décompte');
  return first;
}

/**
 * A10.4 nº 2 — « Étanchéité entre deux organisations, y compris par canal
 * indirect. »
 *
 * A6.1 dit ce que « canal indirect » recouvre : « un utilisateur de
 * l'organisation A ne peut lire, écrire, ni détecter l'existence d'aucune
 * ligne de l'organisation B, y compris par message d'erreur, par compteur, ou
 * par différence de temps de réponse sur une clé étrangère. »
 *
 * Les essais existants éprouvent cela par connexion SQL directe, en posant le
 * rôle et l'identité à la main. C'est éprouver la politique, pas le chemin :
 * l'application ne parle jamais à PostgreSQL. Elle parle à PostgREST, qui
 * décide du rôle depuis un jeton, expose un schéma, rend des compteurs en
 * en-tête et formule ses propres messages d'erreur. Aucun de ces quatre
 * éléments n'est traversé par une connexion directe, et trois d'entre eux sont
 * nommément des canaux indirects.
 *
 * Cette suite passe donc par le même chemin que l'application.
 */
const dsn = process.env['AZIMUT_TEST_DATABASE_URL'];
const binary = process.env['AZIMUT_TEST_POSTGREST'] ?? '';

/**
 * La chaîne de connexion que PostgREST emploie, celle du rôle
 * `authenticator`.
 *
 * Elle était dérivée de celle des essais par une substitution qui injectait un
 * mot de passe écrit dans le fichier. A2.4 interdit de committer une chaîne de
 * connexion, et le mot de passe en était une : la variable le remplace, sans
 * valeur de repli.
 */
const postgrestDbUri = process.env['AZIMUT_TEST_POSTGREST_DB_URI'] ?? '';
const jwtSecret = process.env['AZIMUT_TEST_JWT_SECRET'] ?? '';

const runnable = dsn !== undefined && binary !== '' && existsSync(binary)
  && postgrestDbUri !== '' && jwtSecret !== '';

/**
 * La chaîne déclare qu'elle doit exécuter cette suite.
 *
 * Sans cette déclaration, la suite se saute quand PostgREST manque, et un
 * essai qu'aucune chaîne n'exécute n'existe pas : la chaîne d'A13.2 rendait
 * zéro, la suite comptait huit essais sautés, et le cloisonnement réel n'était
 * éprouvé nulle part. Un saut est légitime sur un poste qui n'a pas le
 * binaire ; il ne l'est pas dans une chaîne dont c'est le travail.
 *
 * La variable dit l'intention plutôt que de la deviner d'une variable
 * d'environnement de l'hébergeur : `CI` est posée par des outils qui n'ont pas
 * monté de base, et en faire le critère ferait échouer des chaînes qui n'ont
 * jamais prétendu exécuter celle-ci.
 */
const required = (process.env['AZIMUT_REQUIRE_POSTGREST'] ?? '') !== '';

const ORG_A = '0a000000-0000-4000-8000-000000000001';
const ORG_B = '0b000000-0000-4000-8000-000000000001';
const ALICE = '0a000000-0000-4000-8000-0000000000a1';
const BOB = '0b000000-0000-4000-8000-0000000000b1';
const SITE_A = '0a000000-0000-4000-8000-00000000513a';
const SITE_B = '0b000000-0000-4000-8000-00000000513b';

let client: Sql;
let harness: Harness;

/** La requête telle que l'application la forme : jeton en en-tête. */
async function asUser(user: string | null, path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept-Profile': 'azimut',
    'Content-Profile': 'azimut',
    ...(init.headers as Record<string, string> | undefined ?? {}),
  };
  if (user !== null) headers['Authorization'] = `Bearer ${signToken(user)}`;
  return fetch(`${harness.url}${path}`, { ...init, headers });
}

/**
 * Un constat hors politique, pour vérifier ce que la base porte réellement.
 *
 * `FORCE ROW LEVEL SECURITY` s'applique au propriétaire des tables comme à
 * tout le monde, et la connexion de l'essai ne porte aucune identité : elle ne
 * voit donc rien, pas même ce qu'elle vient d'écrire. C'est exactement ce
 * qu'on veut du cloisonnement, et c'est ce qui rend un constat direct
 * impossible sans lever la contrainte le temps de le prendre.
 *
 * La lever ici ne relâche rien : la requête sous PostgREST a déjà eu lieu, et
 * c'est elle qu'on juge. Ce qui suit ne fait que regarder le résultat.
 */
async function observed<T>(query: string): Promise<readonly T[]> {
  await client.unsafe('alter table azimut.site no force row level security');
  try {
    return await client.unsafe<T[]>(query);
  } finally {
    await client.unsafe('alter table azimut.site force row level security');
  }
}

describe.runIf(runnable)('A10.4 — étanchéité par le chemin de l’application', () => {
  beforeAll(async () => {
    client = postgres(dsn ?? '');
    await installPlatformStubs(client);

    await deleteOrgFixture(
      text => client.unsafe(text), text => client.unsafe(text), [ORG_A, ORG_B],
    );

    const seeded = ['membership', 'organization', 'site'];
    for (const table of seeded) {
      await client.unsafe(`alter table azimut.${table} no force row level security`);
    }
    await client.unsafe(`
      insert into azimut.organization(id,name,slug)
        values ('${ORG_A}','A','a-${Date.now().toString(36)}'),
               ('${ORG_B}','B','b-${Date.now().toString(36)}');
      insert into azimut.membership(org_id,user_id,role)
        values ('${ORG_A}','${ALICE}','admin'),('${ORG_B}','${BOB}','admin');
      insert into azimut.site(id,org_id,name,country_code,timezone,active_langs)
        values ('${SITE_A}','${ORG_A}','Site A','CI','Africa/Abidjan','{fr}'),
               ('${SITE_B}','${ORG_B}','Site B','CI','Africa/Abidjan','{fr}');
    `);
    for (const table of seeded) {
      await client.unsafe(`alter table azimut.${table} force row level security`);
    }

    harness = await startPostgrest({
      binary,
      dbUri: postgrestDbUri,
      port: 3999,
    });
  }, 60_000);

  afterAll(async () => {
    await harness.stop();
    await deleteOrgFixture(
      text => client.unsafe(text), text => client.unsafe(text), [ORG_A, ORG_B],
    );
    await client.end();
  });

  it('le banc identifie l’utilisateur depuis son jeton', async () => {
    const response = await asUser(ALICE, `/site?id=eq.${SITE_A}&select=id`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: SITE_A }]);
  });

  it('ne rend aucune ligne de l’autre organisation', async () => {
    const response = await asUser(ALICE, '/site?select=id,org_id');
    const rows = await response.json() as { org_id: string }[];
    expect(rows.map(r => r.org_id)).not.toContain(ORG_B);
  });

  /**
   * Canal indirect nº 1, le message d'erreur. Demander une ligne de B doit
   * répondre comme pour une ligne qui n'existe pas. Une réponse distincte
   * dirait qu'elle existe.
   */
  it('ne distingue pas une ligne de l’autre organisation d’une ligne absente', async () => {
    const other = await asUser(ALICE, `/site?id=eq.${SITE_B}&select=id`);
    const absent = await asUser(ALICE, '/site?id=eq.00000000-0000-4000-8000-000000000000&select=id');
    expect(other.status).toBe(absent.status);
    expect(await other.text()).toBe(await absent.text());
  });

  /**
   * Canal indirect nº 2, le compteur. PostgREST rend le nombre de lignes en
   * en-tête quand on le lui demande. Il doit compter ce que l'utilisateur
   * voit, jamais ce que la table porte.
   */
  it('ne compte pas les lignes de l’autre organisation', async () => {
    const response = await asUser(ALICE, '/site?select=id', {
      headers: { Prefer: 'count=exact' },
    });
    const range = response.headers.get('content-range') ?? '';
    const total = Number(range.split('/')[1] ?? '0');
    const { count } = only(await observed<{ count: string }>(
      `select count(*)::text as count from azimut.site where org_id in ('${ORG_A}','${ORG_B}')`,
    ));
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(Number(count));
  });

  it('refuse une écriture dans l’autre organisation', async () => {
    const response = await asUser(ALICE, '/site', {
      method: 'POST',
      body: JSON.stringify({
        id: '0b000000-0000-4000-8000-0000000051ff',
        org_id: ORG_B, name: 'Intrusion', country_code: 'CI',
        timezone: 'Africa/Abidjan', active_langs: ['fr'],
      }),
    });
    expect(response.status).toBeGreaterThanOrEqual(400);

    const { count } = only(await observed<{ count: string }>(
      `select count(*)::text as count from azimut.site where name = 'Intrusion'`,
    ));
    expect(count).toBe('0');
  });

  it('ne modifie aucune ligne de l’autre organisation', async () => {
    const response = await asUser(ALICE, `/site?id=eq.${SITE_B}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Renommé par A' }),
    });
    expect(response.status).toBeLessThan(500);

    const { name } = only(await observed<{ name: string }>(
      `select name from azimut.site where id = '${SITE_B}'`,
    ));
    expect(name).toBe('Site B');
  });

  it('ne supprime aucune ligne de l’autre organisation', async () => {
    await asUser(ALICE, `/site?id=eq.${SITE_B}`, { method: 'DELETE' });
    const { count } = only(await observed<{ count: string }>(
      `select count(*)::text as count from azimut.site where id = '${SITE_B}'`,
    ));
    expect(count).toBe('1');
  });

  /**
   * Sans jeton, PostgREST bascule sur le rôle anonyme. Il ne doit rien voir :
   * `azimut.current_user_id()` rend alors `NULL`, et aucune organisation ne
   * lui répond.
   */
  it('ne rend rien à une requête sans jeton', async () => {
    const response = await asUser(null, '/site?select=id');
    if (response.status === 200) {
      expect(await response.json()).toEqual([]);
    } else {
      expect(response.status).toBeGreaterThanOrEqual(400);
    }
  });
});

/**
 * Le garde de la chaîne. Il ne prouve rien du cloisonnement : il prouve que ce
 * qui le prouve a bien été exécuté.
 */
describe.runIf(required)('A10.4 — la chaîne exécute bien cette suite', () => {
  it('PostgREST est disponible là où la chaîne le déclare requis', () => {
    expect(
      runnable,
      'AZIMUT_REQUIRE_POSTGREST est posée, mais la suite d’étanchéité ne peut '
      + 'pas s’exécuter.\n'
      + `AZIMUT_TEST_DATABASE_URL : ${dsn === undefined ? 'absente' : 'posée'}\n`
      + `AZIMUT_TEST_POSTGREST : ${binary === '' ? 'absente' : binary}\n`
      + `Binaire présent : ${binary !== '' && existsSync(binary) ? 'oui' : 'non'}\n`
      + `AZIMUT_TEST_POSTGREST_DB_URI : ${postgrestDbUri === '' ? 'absente' : 'posée'}\n`
      + `AZIMUT_TEST_JWT_SECRET : ${jwtSecret === '' ? 'absente' : 'posée'}\n`
      + 'Sans elle, la chaîne rendrait vert sans avoir éprouvé le cloisonnement '
      + 'par le chemin de l’application.',
    ).toBe(true);
  });
});
