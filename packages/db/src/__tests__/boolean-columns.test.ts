import { describe, it, expect } from 'vitest';
import type { SQL } from 'drizzle-orm';
import { buildCommand } from '@azimut/core-model';
import type { EntityCommand } from '@azimut/core-model';
import { booleanColumnsOf } from '../column-types.js';
import { applyCommands } from '../write-path.js';
import type { Executor, TransactionalDb } from '../write-path.js';

/**
 * Le client `postgres` écrit « faux » toute valeur non booléenne destinée à
 * une colonne booléenne, la chaîne `'true'` comprise (sonde du 2026-10-04 :
 * `'true'` et `'false'` stockés tous deux à faux). Le chemin d'écriture refuse
 * donc une telle valeur au lieu de la laisser changer la donnée en silence.
 */
function recordingDb(): TransactionalDb & { readonly queries: SQL[] } {
  const queries: SQL[] = [];
  const executor: Executor = { execute: (query: SQL) => { queries.push(query); return Promise.resolve([]); } };
  return { ...executor, queries, transaction: fn => fn(executor) };
}

function edgeUpdate(accessible: string | boolean): EntityCommand {
  const out = buildCommand({
    operation: 'update', module: '01-socle', table: 'edge', id: 'arete', org_id: 'org',
    timestamp: '2026-10-05T10:00:00.000Z',
    before: { accessible: true }, after: { accessible },
  });
  if (!out.ok) throw new Error(JSON.stringify(out.findings));
  return out.value;
}

describe('les colonnes booléennes du schéma', () => {
  it('sont lues dans le schéma déclaré, table par table', () => {
    expect([...booleanColumnsOf('edge')].sort()).toEqual(['accessible', 'evacuation_route']);
    expect([...booleanColumnsOf('sketch_layer')].sort()).toEqual(['locked', 'visible']);
    expect(booleanColumnsOf('site').size).toBe(0);
    expect(booleanColumnsOf('table_inconnue').size).toBe(0);
  });

  it('une chaîne pour une colonne booléenne est refusée, et rien ne s’écrit', async () => {
    const db = recordingDb();
    const out = await applyCommands(db, { userId: 'u' }, [edgeUpdate('false')]);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.findings[0]?.code).toBe('EDIT.WRITE_REFUSED');
    // L'identité est posée, puis plus rien : aucune mise à jour n'est partie.
    expect(db.queries).toHaveLength(2);
  });

  it('un vrai booléen passe', async () => {
    const db = recordingDb();
    const out = await applyCommands(db, { userId: 'u' }, [edgeUpdate(false)]);
    expect(out.ok).toBe(true);
    expect(db.queries).toHaveLength(3);
  });
});
