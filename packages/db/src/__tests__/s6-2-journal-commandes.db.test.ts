import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { buildCommand, serializeCommand } from '@azimut/core-model';
import type { CommandDraft } from '@azimut/core-model';
import { enrolFixtureMembers } from '../fixture-membership.js';

/**
 * S6.2 — le journal des commandes validées, sur une base réelle (0078).
 *
 * Ce qui s'éprouve : une commande appliquée est journalisée avec le numéro
 * suivant du site ; une commande périmée est refusée en `PT409` et ne laisse
 * aucune trace ; `before` se compare dans le type de la colonne ; le journal
 * ne s'écrit que par la fonction et ne se modifie pas ; une autre organisation
 * n'y écrit ni n'y lit rien.
 *
 * Tout se passe dans des transactions annulées : une ligne de journal ne se
 * supprime pas, une ligne d'essai qui survivrait resterait pour toujours.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
const ORG = 'a6200000-0000-0000-0000-0000000000a1';
const OTHER_ORG = 'a6200000-0000-0000-0000-0000000000a2';
const SITE = 'a6200000-0000-0000-0000-0000000000b1';
const BUILDING = 'a6200000-0000-0000-0000-0000000000b2';
const LEVEL = 'a6200000-0000-0000-0000-0000000000b3';
const DESIGNER = 'a6200000-0000-0000-0000-0000000000d1';
const STRANGER = 'a6200000-0000-0000-0000-0000000000d2';
const T = '2026-11-21T10:00:00.000Z';

let sql: postgres.Sql;

beforeAll(() => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  sql = postgres(URL, { onnotice: () => undefined });
});

afterAll(async () => { await sql.end(); });

/** Le décor, puis l'essai sous le rôle applicatif, puis l'annulation de tout. */
async function inRolledBack(check: (tx: postgres.TransactionSql) => Promise<void>): Promise<void> {
  const done = new Error('annulation voulue');
  await sql.begin(async tx => {
    await tx`select set_config('azimut.current_user_id', ${DESIGNER}, true)`;
    await tx`insert into azimut.organization(id,name,slug)
             values (${ORG},'S6','s6-journal'),(${OTHER_ORG},'S6 bis','s6-journal-bis')`;
    await enrolFixtureMembers(text => tx.unsafe(text), [
      { orgId: ORG, userId: DESIGNER, role: 'admin' },
      { orgId: OTHER_ORG, userId: STRANGER, role: 'admin' },
    ]);
    await tx`insert into azimut.site(id,org_id,name,country_code,timezone)
             values (${SITE},${ORG},'Site','FR','Europe/Paris')`;
    await tx`insert into azimut.building(id,org_id,site_id,name)
             values (${BUILDING},${ORG},${SITE},'Bâtiment')`;
    await tx`insert into azimut.level(id,org_id,building_id,name,ordinal,elevation_m)
             values (${LEVEL},${ORG},${BUILDING},'RDC',0,0)`;
    await tx`set local role authenticated`;
    await check(tx);
    throw done;
  }).catch((e: unknown) => { if (e !== done) throw e; });
}

/** Une commande telle qu'un poste l'envoie : construite, puis écrite. */
function wire(over: Partial<CommandDraft>): unknown {
  const built = buildCommand({
    operation: 'update', module: '01-socle', table: 'site', id: SITE, org_id: ORG,
    before: { name: 'Site' }, after: { name: 'Site Nord' }, timestamp: T, ...over,
  });
  if (!built.ok) throw new Error(built.findings.map(f => f.code).join(','));
  const text = serializeCommand(built.value);
  if (!text.ok) throw new Error('écriture');
  return JSON.parse(text.value) as unknown;
}

function apply(tx: postgres.TransactionSql, commands: readonly unknown[], level: string | null = null) {
  return tx<{ seq: string }[]>`
    select azimut.apply_journaled_commands(${SITE}, ${level}, ${JSON.stringify(commands)}::text::jsonb)::text as seq`;
}

/** Le refus levé, avec son état, ou « accepté ». */
async function refusal(tx: postgres.TransactionSql, run: () => Promise<unknown>): Promise<string> {
  try {
    await tx.savepoint(async () => { await run(); });
  } catch (e: unknown) {
    const code = (e as { code?: unknown }).code;
    const message = e instanceof Error ? e.message : String(e);
    return `${typeof code === 'string' ? code : '?'} ${message}`;
  }
  return 'accepté';
}

async function journal(tx: postgres.TransactionSql) {
  return tx<{ seq: string; author_id: string; level_id: string | null; operation: string }[]>`
    select seq::text, author_id, level_id, command->>'operation' as operation
    from azimut.command_journal where site_id = ${SITE} order by seq`;
}

describe('S6.2 — une commande appliquée est journalisée', () => {
  it('applique, journalise, et numérote la suite du site', async () => {
    await inRolledBack(async tx => {
      expect(await apply(tx, [wire({})], LEVEL)).toEqual([{ seq: '1' }]);
      expect(await apply(tx, [
        wire({ before: { name: 'Site Nord' }, after: { name: 'Site Est' } }),
        wire({ before: { name: 'Site Est' }, after: { name: 'Site Sud' } }),
      ])).toEqual([{ seq: '3' }]);

      const [site] = await tx<{ name: string }[]>`select name from azimut.site where id = ${SITE}`;
      expect(site?.name).toBe('Site Sud');
      expect(await journal(tx)).toEqual([
        { seq: '1', author_id: DESIGNER, level_id: LEVEL, operation: 'update' },
        { seq: '2', author_id: DESIGNER, level_id: null, operation: 'update' },
        { seq: '3', author_id: DESIGNER, level_id: null, operation: 'update' },
      ]);
    });
  });

  it('journalise la commande telle qu’elle a été envoyée', async () => {
    await inRolledBack(async tx => {
      const sent = wire({});
      await apply(tx, [sent]);
      const [row] = await tx<{ command: unknown }[]>`
        select command from azimut.command_journal where site_id = ${SITE}`;
      expect(row?.command).toEqual(sent);
    });
  });

  it('compare before dans le type de la colonne, pas en texte', async () => {
    await inRolledBack(async tx => {
      const [row] = await tx<{ created: string }[]>`
        select to_char(created_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD"T"HH24:MI:SS.US"+09:00"') as created
        from azimut.site where id = ${SITE}`;
      // Le même instant, écrit dans un autre fuseau que celui de la base.
      const before = { name: 'Site', created_at: row?.created ?? '' };
      expect(await refusal(tx, () => apply(tx, [wire({ before })]))).toBe('accepté');
      // Un autre instant, lui, ne correspond pas.
      const shifted = { name: 'Site Nord', created_at: '2000-01-01T00:00:00.000Z' };
      expect(await refusal(tx, () => apply(tx, [wire({ before: shifted })]))).toMatch(/^PT409/);
    });
  });
});

describe('S6.2 — une commande périmée est refusée sans trace', () => {
  it('refuse une modification dont before ne correspond plus', async () => {
    await inRolledBack(async tx => {
      await apply(tx, [wire({})]);
      const stale = wire({ before: { name: 'Site' }, after: { name: 'Site Ouest' } });
      expect(await refusal(tx, () => apply(tx, [stale]))).toMatch(/^PT409 commande périmée/);
      const [site] = await tx<{ name: string }[]>`select name from azimut.site where id = ${SITE}`;
      expect(site?.name).toBe('Site Nord');
      expect((await journal(tx)).length).toBe(1);
    });
  });

  it('refuse tout l’appel si une seule commande est périmée', async () => {
    await inRolledBack(async tx => {
      const ok = wire({});
      const stale = wire({ before: { name: 'Autre' }, after: { name: 'X' } });
      expect(await refusal(tx, () => apply(tx, [ok, stale]))).toMatch(/^PT409/);
      const [site] = await tx<{ name: string }[]>`select name from azimut.site where id = ${SITE}`;
      expect(site?.name).toBe('Site');
      expect(await journal(tx)).toEqual([]);
    });
  });

  it('refuse la création d’une ligne qui existe, et la suppression d’une ligne changée', async () => {
    await inRolledBack(async tx => {
      const again = wire({
        operation: 'create', table: 'level', id: LEVEL, before: null,
        after: { id: LEVEL, org_id: ORG, building_id: BUILDING, name: 'RDC', ordinal: 0, elevation_m: 0 },
      });
      expect(await refusal(tx, () => apply(tx, [again]))).toMatch(/^PT409/);
      const gone = wire({
        operation: 'delete', table: 'level', id: LEVEL, before: { name: 'R+1' }, after: null,
      });
      expect(await refusal(tx, () => apply(tx, [gone]))).toMatch(/^PT409/);
    });
  });
});

describe('S6.2 — le journal est gardé', () => {
  it('ne s’écrit que par la fonction', async () => {
    await inRolledBack(async tx => {
      expect(await refusal(tx, () => tx`
        insert into azimut.command_journal(org_id, site_id, seq, command)
        values (${ORG}, ${SITE}, 1, ${JSON.stringify(wire({}))}::text::jsonb)`))
        .toMatch(/written by apply_journaled_commands only/);
    });
  });

  it('ne se modifie ni ne se supprime', async () => {
    await inRolledBack(async tx => {
      await apply(tx, [wire({})]);
      const update = await refusal(tx, () => tx`update azimut.command_journal set seq = 9`);
      const remove = await refusal(tx, () => tx`delete from azimut.command_journal`);
      expect(update).toMatch(/permission denied|insert-only/);
      expect(remove).toMatch(/permission denied|insert-only/);
      expect((await journal(tx)).length).toBe(1);
    });
  });

  it('refuse une commande mal formée ou d’une autre organisation', async () => {
    await inRolledBack(async tx => {
      const extra = { ...(wire({}) as object), author: 'x' };
      expect(await refusal(tx, () => apply(tx, [extra]))).toMatch(/commande mal formée/);
      expect(await refusal(tx, () => apply(tx, [wire({ org_id: OTHER_ORG })])))
        .toMatch(/^42501 commande d'une autre organisation/);
      const journalItself = { ...(wire({}) as object), table: 'command_journal' };
      expect(await refusal(tx, () => apply(tx, [journalItself]))).toMatch(/table inconnue/);
    });
  });

  it('un membre d’une autre organisation n’écrit ni ne lit rien', async () => {
    await inRolledBack(async tx => {
      await apply(tx, [wire({})]);
      await tx`select set_config('azimut.current_user_id', ${STRANGER}, true)`;
      expect(await refusal(tx, () => apply(tx, [wire({ before: { name: 'Site Nord' } })])))
        .toMatch(/^42501 site inaccessible/);
      const seen = await tx`select 1 from azimut.command_journal where site_id = ${SITE}`;
      expect(seen.length).toBe(0);
    });
  });

  it('refuse un niveau qui n’est pas celui du site', async () => {
    await inRolledBack(async tx => {
      expect(await refusal(tx, () => apply(tx, [wire({})], OTHER_ORG)))
        .toMatch(/^42501 niveau inaccessible/);
    });
  });
});
