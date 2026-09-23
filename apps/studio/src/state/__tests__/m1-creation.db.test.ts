import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createConnection, createDb, applyCommands, deleteOrgFixture } from '@azimut/db';
import { createSiteCommands } from '../site-creation.js';
import { commandPayload } from '../postgrest-sink.js';
import type { CreationContext, SiteDraft } from '../site-creation.js';

/**
 * M1 (partie M) — le formulaire de création, contre une base réelle.
 *
 * Les essais unitaires prouvent que les commandes de création ont la forme
 * voulue. Ils ne prouvaient pas qu'elles s'écrivent, et elles ne s'écrivaient
 * pas : `site.active_langs` est une colonne de tableau, la commande y mettait
 * du JSON, et la base refusait chaque création avec « malformed array
 * literal ». Rien ne le voyait, parce qu'aucun essai n'appliquait les
 * commandes du formulaire.
 *
 * Il demande donc `pnpm test:db`. Mise en place dans
 * `packages/db/migrations/ORDRE.md`. Sans base, la suite s'arrête avec le mode
 * d'emploi plutôt que de passer en silence.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
const ALICE = '11111111-1111-1111-1111-111111111111';
const ORG = 'c1000000-0000-0000-0000-000000000001';
const SITE = 'c1000000-0000-0000-0000-000000000101';
const BUILDING = 'c1000000-0000-0000-0000-000000000102';
const LEVEL = 'c1000000-0000-0000-0000-000000000103';
// Le second jeu sert le chemin du poste, qui écrit son propre site : deux
// chemins sur une même ligne se masqueraient l'un l'autre.
const SITE_2 = 'c1000000-0000-0000-0000-000000000201';
const BUILDING_2 = 'c1000000-0000-0000-0000-000000000202';
const LEVEL_2 = 'c1000000-0000-0000-0000-000000000203';
const T = '2026-09-23T10:00:00.000Z';

/** La chaîne validée en `beforeAll`, pour les connexions ouvertes ensuite. */
let dsn = '';
let client: ReturnType<typeof createConnection>;
let db: ReturnType<typeof createDb>;
let alice: Awaited<ReturnType<typeof client.reserve>>;

const DRAFT: SiteDraft = {
  name: 'Gare de Lille Flandres',
  countryCode: 'FR',
  timezone: 'Europe/Paris',
  rulesPackId: null,
  activeLangs: ['fr', 'en'],
  legalEntityId: null,
};

const CONTEXT: CreationContext = {
  orgId: ORG,
  siteId: SITE,
  buildingId: BUILDING,
  levelId: LEVEL,
  existingNames: [],
  // Q9 — l'extrait du référentiel contre lequel pays et fuseau se jugent.
  countries: [{ code: 'FR', timezones: ['Europe/Paris'] }],
  defaultBuildingName: 'Bâtiment 1',
  defaultLevelName: 'Niveau 0',
  timestamp: T,
};

async function cleanup(): Promise<void> {
  const fresh = createConnection(dsn);
  await deleteOrgFixture(
    text => fresh.unsafe(text), text => fresh.unsafe(text), [ORG]);
  await fresh.end();
}

beforeAll(async () => {
  if (URL === undefined || URL === '') {
    throw new Error(
      'AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.',
    );
  }
  dsn = URL;
  client = createConnection(dsn);
  db = createDb(dsn);

  await cleanup();

  // L'organisation et l'adhésion s'amorcent hors politique, comme le ferait un
  // import d'administration : sans adhésion, personne n'a d'identité à poser.
  for (const table of ['membership', 'organization']) {
    await client`alter table azimut.${client(table)} no force row level security`;
  }
  await client`insert into azimut.organization(id,name,slug)
    values (${ORG},'Création','creation-m1')`;
  await client`insert into azimut.membership(org_id,user_id,role)
    values (${ORG},${ALICE},'admin')`;
  for (const table of ['membership', 'organization']) {
    await client`alter table azimut.${client(table)} force row level security`;
  }

  alice = await reserveAs(ALICE);
});

afterAll(async () => {
  await alice.release();
  await cleanup();
  await client.end();
  await db.$client.end();
});

/**
 * Une connexion réservée, tenue sous l'identité d'Alice pour toute la suite.
 *
 * Les lectures de contrôle doivent voir ce que verrait la personne, politiques
 * comprises : sous `FORCE ROW LEVEL SECURITY`, une lecture sans identité ne
 * rend rien et l'essai passerait en ne prouvant rien.
 */
async function reserveAs(userId: string) {
  const held = await client.reserve();
  await held`set role authenticated`;
  await held`select set_config('azimut.current_user_id', ${userId}, false)`;
  return held;
}

describe('M1 (partie M) — la création s’écrit réellement', () => {
  it('applique les trois commandes du formulaire en une transaction', async () => {
    const built = createSiteCommands(DRAFT, CONTEXT);
    expect(built.ok, built.ok ? '' : built.findings.map(f => f.code).join(', ')).toBe(true);
    if (!built.ok) return;

    const written = await applyCommands(db, { userId: ALICE }, built.value);
    expect(
      written.ok,
      written.ok ? '' : written.findings.map(f => f.code).join(', '),
    ).toBe(true);
    if (written.ok) expect(written.value).toHaveLength(3);
  });

  /**
   * Le défaut trouvé : la colonne est un tableau, la commande y écrivait du
   * JSON. L'essai lit la valeur telle que la base la rend, et non telle que
   * l'application l'a envoyée.
   */
  it('écrit les langues actives comme un tableau, relu à l’identique', async () => {
    const rows = await alice`
      select active_langs from azimut.site where id = ${SITE}`;
    expect(rows[0]?.['active_langs']).toEqual(['en', 'fr']);
  });

  it('écrit le fuseau et le pays', async () => {
    const rows = await alice`
      select name, country_code, timezone, legal_entity_id, rules_pack_id
      from azimut.site where id = ${SITE}`;
    expect(rows[0]?.['name']).toBe('Gare de Lille Flandres');
    expect(rows[0]?.['country_code']).toBe('FR');
    expect(rows[0]?.['timezone']).toBe('Europe/Paris');
    expect(rows[0]?.['legal_entity_id']).toBeNull();
    expect(rows[0]?.['rules_pack_id']).toBeNull();
  });

  /**
   * M1 (partie M) : « Créer un site crée aussi un premier bâtiment et un
   * premier niveau. Un site sans niveau est un état inutile. »
   */
  it('crée le premier bâtiment et le premier niveau', async () => {
    const buildings = await alice`
      select id, name from azimut.building where site_id = ${SITE}`;
    expect(buildings.map(r => r['name'])).toEqual(['Bâtiment 1']);

    const levels = await alice`
      select name, ordinal, elevation_m from azimut.level
      where building_id = ${BUILDING}`;
    expect(levels.map(r => r['name'])).toEqual(['Niveau 0']);
    expect(levels[0]?.['ordinal']).toBe(0);
  });

  /**
   * A6.1 — la ligne écrite appartient bien à l'organisation de la session, et
   * la base la rend sous son identité. Une écriture qui aurait échappé au
   * cloisonnement ne se verrait pas autrement.
   */
  it('rend le site sous l’identité de son organisation, et sous elle seule', async () => {
    const mine = await alice`select org_id from azimut.site where id = ${SITE}`;
    expect(mine).toHaveLength(1);
    expect(mine[0]?.['org_id']).toBe(ORG);
  });
});

/**
 * Le poste n'emprunte pas ce chemin. Il parle à PostgREST, qui appelle
 * `azimut.apply_commands` — une seconde implantation du même contrat, avec ses
 * propres conversions : elle aplatit chaque valeur en texte par
 * `jsonb_each_text`, là où le service passe des paramètres typés.
 *
 * C'est précisément sur cette conversion que l'encodage d'une liste se joue.
 * Éprouver un seul des deux chemins laisserait l'autre faux.
 */
describe('M1 (partie M) — la même création par le chemin du poste', () => {
  it('applique les commandes telles que l’émetteur les envoie', async () => {
    const built = createSiteCommands(DRAFT, {
      ...CONTEXT, siteId: SITE_2, buildingId: BUILDING_2, levelId: LEVEL_2,
      // Le nom du premier site est déjà pris : M1 (partie M) exige l'unicité.
      existingNames: ['Gare de Lille Flandres'],
    });
    expect(built.ok).toBe(false);
  });

  it('écrit un site complet, langues comprises', async () => {
    const built = createSiteCommands(
      { ...DRAFT, name: 'Gare de Lille Europe' },
      { ...CONTEXT, siteId: SITE_2, buildingId: BUILDING_2, levelId: LEVEL_2 },
    );
    expect(built.ok, built.ok ? '' : built.findings.map(f => f.code).join(', ')).toBe(true);
    if (!built.ok) return;

    // `client.json` marque le paramètre comme `jsonb`. Une chaîne castée
    // arriverait comme une chaîne JSON, et la fonction la refuserait — ce que
    // PostgREST ne fait pas, puisqu'il transmet le corps déjà analysé.
    const payload = client.json(built.value.map(commandPayload));
    const applied = await alice`select azimut.apply_commands(${payload}) as n`;
    expect(applied[0]?.['n']).toBe(3);

    const rows = await alice`
      select name, timezone, active_langs from azimut.site where id = ${SITE_2}`;
    expect(rows[0]?.['name']).toBe('Gare de Lille Europe');
    expect(rows[0]?.['timezone']).toBe('Europe/Paris');
    expect(rows[0]?.['active_langs']).toEqual(['en', 'fr']);

    const levels = await alice`
      select name from azimut.level where building_id = ${BUILDING_2}`;
    expect(levels.map(r => r['name'])).toEqual(['Niveau 0']);
  });
});
