import { describe, it, expect, vi, afterEach } from 'vitest';
import { createReferenceRepository, createPostgrestRepository, isRepositoryError } from '../index.js';

/**
 * R12, le circuit du tableau des messages, relu du dépôt : versions, lignes,
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

describe('R12 : circuit du tableau, sites de référence', () => {
  const repository = createReferenceRepository();

  it('rend des listes vides : aucun site de référence ne porte de tableau enregistré', async () => {
    expect(await repository.loadScheduleRecords('ref-multilevel'))
      .toEqual({ schedules: [], lines: [], approvals: [], validations: [], annotations: [], annotationReplies: [] });
  });

  it('refuse un site inconnu', async () => {
    const error: unknown = await repository.loadScheduleRecords('inconnu').catch((e: unknown) => e);
    expect(isRepositoryError(error) && error.failure === 'not_found').toBe(true);
  });
});

describe('R12 : circuit du tableau, API REST', () => {
  it('lit les versions et les passages du site, puis les lignes et décisions de ces versions', async () => {
    const calls = stubTables({
      message_schedule: [{ id: 'aaaa0007-0000-4000-8000-000000000006', site_id: 'aaaa0007-0000-4000-8000-000000000001', version: 1, state: 'draft' }],
      graph_validation: [{ id: 'aaaa0007-0000-4000-8000-000000000004', site_id: 'aaaa0007-0000-4000-8000-000000000001', passed: true }],
      message_line: [{ id: 'aaaa0007-0000-4000-8000-000000000005', schedule_id: 'aaaa0007-0000-4000-8000-000000000006', content: { block_kind: 'arrow', entries: [] } }],
      message_schedule_approval: [{ id: 'aaaa0007-0000-4000-8000-000000000003', schedule_id: 'aaaa0007-0000-4000-8000-000000000006', decision: 'rejected' }],
      review_annotation: [{ id: 'aaaa0007-0000-4000-8000-000000000002', site_id: 'aaaa0007-0000-4000-8000-000000000001', state: 'open' }],
      review_annotation_reply: [
        { id: 'aaaa0007-0000-4000-8000-000000000007', annotation_id: 'aaaa0007-0000-4000-8000-000000000002', deleted_at: null },
        { id: 'aaaa0007-0000-4000-8000-000000000008', annotation_id: 'aaaa0007-0000-4000-8000-000000000002', deleted_at: '2026-10-05T10:00:00+00:00' },
      ],
    });
    const records = await createPostgrestRepository(config).loadScheduleRecords('aaaa0007-0000-4000-8000-000000000001');
    expect(records.schedules.map(r => r.id)).toEqual(['aaaa0007-0000-4000-8000-000000000006']);
    expect(records.validations.map(r => r.id)).toEqual(['aaaa0007-0000-4000-8000-000000000004']);
    expect(records.lines.map(r => r.id)).toEqual(['aaaa0007-0000-4000-8000-000000000005']);
    expect(records.approvals.map(r => r.id)).toEqual(['aaaa0007-0000-4000-8000-000000000003']);
    expect(records.annotations.map(r => r.id)).toEqual(['aaaa0007-0000-4000-8000-000000000002']);
    // Une réponse supprimée ne se relit pas : la suppression est logique.
    expect(records.annotationReplies.map(r => r.id)).toEqual(['aaaa0007-0000-4000-8000-000000000007']);
    expect(calls.some(u => u.includes('/review_annotation?') && u.includes('site_id=eq.aaaa0007-0000-4000-8000-000000000001')
      && u.includes('deleted_at=is.null'))).toBe(true);
    expect(calls.some(u => u.includes('/review_annotation_reply?') && u.includes('annotation_id=in.(aaaa0007-0000-4000-8000-000000000002)'))).toBe(true);
    expect(calls.some(u => u.includes('/message_schedule?') && u.includes('site_id=eq.aaaa0007-0000-4000-8000-000000000001'))).toBe(true);
    expect(calls.some(u => u.includes('/graph_validation?') && u.includes('site_id=eq.aaaa0007-0000-4000-8000-000000000001'))).toBe(true);
    expect(calls.some(u => u.includes('/message_line?') && u.includes('schedule_id=in.(aaaa0007-0000-4000-8000-000000000006)'))).toBe(true);
    expect(calls.some(u => u.includes('/message_schedule_approval?') && u.includes('schedule_id=in.(aaaa0007-0000-4000-8000-000000000006)'))).toBe(true);
  });

  it('sans version enregistrée, ni lignes ni décisions ne sont demandées', async () => {
    const calls = stubTables({});
    const records = await createPostgrestRepository(config).loadScheduleRecords('aaaa0007-0000-4000-8000-000000000001');
    expect(records).toEqual({ schedules: [], lines: [], approvals: [], validations: [], annotations: [], annotationReplies: [] });
    expect(calls.some(u => u.includes('/message_line?') || u.includes('/message_schedule_approval?'))).toBe(false);
    expect(calls.some(u => u.includes('/review_annotation_reply?'))).toBe(false);
  });
});
