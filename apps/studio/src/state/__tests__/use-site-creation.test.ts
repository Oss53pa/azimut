import { describe, it, expect } from 'vitest';
import type { EntityCommand, Outcome } from '@azimut/core-model';
import { EMPTY_STORE, dispatch } from '../command-store.js';
import type { CommandSink } from '../command-store.js';
import { createSiteCommands } from '../site-creation.js';

const ENV = {
  orgId: 'aaaaaaaa-0000-0000-0000-000000000001',
  existingNames: ['Déjà pris'],
  // Q9 — l'extrait du référentiel contre lequel pays et fuseau se jugent.
  countries: [{ code: 'FR', timezones: ['Europe/Paris'] }],
  defaultBuildingName: 'Bâtiment 1',
  defaultLevelName: 'Niveau 0',
};

const DRAFT = {
  name: 'Gare de Lille Flandres',
  countryCode: 'FR',
  timezone: 'Europe/Paris',
  rulesPackId: null,
  activeLangs: ['fr'],
  legalEntityId: null,
};

function ids(): () => string {
  let n = 0;
  return () => { n += 1; return `id-${n}`; };
}

function sinkThat(ok: boolean): { sink: CommandSink; seen: EntityCommand[][] } {
  const seen: EntityCommand[][] = [];
  const sink: CommandSink = async (commands) => {
    seen.push([...commands]);
    return ok
      ? { ok: true, value: null, warnings: [] } satisfies Outcome<unknown>
      : {
          ok: false,
          findings: [{
            code: 'EDIT.WRITE_REFUSED', severity: 'blocking', entity: null,
            params: {}, ruleRef: 'A6.1',
          }],
        } satisfies Outcome<unknown>;
  };
  return { sink, seen };
}

/**
 * La chaîne complète de M1 (partie M), sans interface : saisie, contrôle,
 * commandes, écriture. C'est ce que le magasin enchaîne.
 */
describe('M1 (partie M) — de la saisie à l’écriture', () => {
  function build(draft = DRAFT, timestamp = '2026-09-21T10:00:00.000Z') {
    return createSiteCommands(draft, {
      ...ENV,
      siteId: 'site-1', buildingId: 'building-1', levelId: 'level-1',
      timestamp,
    });
  }

  it('une saisie valide produit trois commandes et les écrit en un geste', async () => {
    const outcome = build();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const { sink, seen } = sinkThat(true);
    const written = await dispatch(EMPTY_STORE, sink, outcome.value);
    expect(written.outcome.ok).toBe(true);
    // Un seul appel : le geste part entier, ou pas du tout.
    expect(seen.length).toBe(1);
    expect(seen[0]?.length).toBe(3);
    expect(written.state.undoStack.length).toBe(1);
  });

  /**
   * M7.5 (partie M) — « Un refus de saisie n'efface jamais le travail en
   * cours. » Une écriture refusée ne laisse rien dans la pile : sans cela on
   * pourrait annuler un geste qui n'a pas eu lieu.
   */
  it('une écriture refusée n’empile rien', async () => {
    const outcome = build();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const { sink } = sinkThat(false);
    const written = await dispatch(EMPTY_STORE, sink, outcome.value);
    expect(written.outcome.ok).toBe(false);
    expect(written.state).toEqual(EMPTY_STORE);
  });

  it('une saisie refusée n’atteint jamais l’émetteur', async () => {
    const outcome = build({ ...DRAFT, name: '' });
    expect(outcome.ok).toBe(false);
    const { seen } = sinkThat(true);
    expect(seen.length).toBe(0);
  });

  /** Le geste écrit est annulable, et son annulation repasse par l'émetteur. */
  it('le geste écrit reste annulable', async () => {
    const outcome = build();
    if (!outcome.ok) return;
    const { sink, seen } = sinkThat(true);
    const written = await dispatch(EMPTY_STORE, sink, outcome.value);
    const { undo } = await import('../command-store.js');
    const undone = await undo(written.state, sink, '2026-09-21T10:00:05.000Z');
    expect(undone.outcome.ok).toBe(true);
    // Les trois inverses, en ordre inverse : le niveau d'abord, le site en
    // dernier, seule façon de ne pas heurter les clés étrangères.
    expect(seen[1]?.map(c => c.table)).toEqual(['level', 'building', 'site']);
    expect(seen[1]?.every(c => c.operation === 'delete')).toBe(true);
  });

  it('les identifiants viennent de l’appelant, jamais du calcul', () => {
    const next = ids();
    const a = createSiteCommands(DRAFT, {
      ...ENV, siteId: next(), buildingId: next(), levelId: next(),
      timestamp: '2026-09-21T10:00:00.000Z',
    });
    expect(a.ok).toBe(true);
    if (a.ok) expect(a.value.map(c => c.id)).toEqual(['id-1', 'id-2', 'id-3']);
  });
});
