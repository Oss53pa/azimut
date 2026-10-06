import { describe, it, expect, vi, afterEach } from 'vitest';
import { createReferenceRepository, createPostgrestRepository, isRepositoryError } from '../index.js';

/**
 * R12 — le circuit du tableau des messages, relu du dépôt : versions, lignes,
 * décisions, passages de validation.
 */
afterEach(() => { vi.unstubAllGlobals(); });

const config = { url: 'https://exemple.test/rest/v1', apiKey: 'clef', schema: 'azimut' };

function stubTables(bodies: Readonly<Record<string, unknown[]>>): string[] {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    calls.push(url);
    const table = /\/rest\/v1\/([a-z_]+)\?/.exec(url)?.[1] ?? '';
    return Promise.resolve(new Response(JSON.stringify(bodies[table] ?? []), { status: 200 }));
  }));
  return calls;
}

describe('R12 — circuit du tableau, sites de référence', () => {
  const repository = createReferenceRepository();

  it('rend des listes vides : aucun site de référence ne porte de tableau enregistré', async () => {
    expect(await repository.loadScheduleRecords('ref-multilevel'))
      .toEqual({ schedules: [], lines: [], approvals: [], validations: [] });
  });

  it('refuse un site inconnu', async () => {
    const error: unknown = await repository.loadScheduleRecords('inconnu').catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'not_found').toBe(true);
  });
});

describe('R12 — circuit du tableau, API REST', () => {
  it('lit les versions et les passages du site, puis les lignes et décisions de ces versions', async () => {
    const calls = stubTables({
      message_schedule: [{ id: 'm1', site_id: 'site-1', version: 1, state: 'draft' }],
      graph_validation: [{ id: 'g1', site_id: 'site-1', passed: true }],
      message_line: [{ id: 'l1', schedule_id: 'm1', content: { block_kind: 'arrow', entries: [] } }],
      message_schedule_approval: [{ id: 'd1', schedule_id: 'm1', decision: 'rejected' }],
    });
    const records = await createPostgrestRepository(config).loadScheduleRecords('site-1');
    expect(records.schedules.map(r => r.id)).toEqual(['m1']);
    expect(records.validations.map(r => r.id)).toEqual(['g1']);
    expect(records.lines.map(r => r.id)).toEqual(['l1']);
    expect(records.approvals.map(r => r.id)).toEqual(['d1']);
    expect(calls.some(u => u.includes('/message_schedule?') && u.includes('site_id=eq.site-1'))).toBe(true);
    expect(calls.some(u => u.includes('/graph_validation?') && u.includes('site_id=eq.site-1'))).toBe(true);
    expect(calls.some(u => u.includes('/message_line?') && u.includes('schedule_id=in.(m1)'))).toBe(true);
    expect(calls.some(u => u.includes('/message_schedule_approval?') && u.includes('schedule_id=in.(m1)'))).toBe(true);
  });

  it('sans version enregistrée, ni lignes ni décisions ne sont demandées', async () => {
    const calls = stubTables({});
    const records = await createPostgrestRepository(config).loadScheduleRecords('site-1');
    expect(records).toEqual({ schedules: [], lines: [], approvals: [], validations: [] });
    expect(calls.some(u => u.includes('/message_line?') || u.includes('/message_schedule_approval?'))).toBe(false);
  });
});
