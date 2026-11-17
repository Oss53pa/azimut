import { describe, it, expect } from 'vitest';
import {
  MAX_WIRE_COMMAND_LENGTH, parseCommand, serializeCommand,
} from '../command-wire.js';
import { buildCommand, inverseCommand } from '../site-commands.js';
import type { CommandDraft, EntityCommand } from '../site-commands.js';

const T = '2026-11-17T10:00:00.000Z';
const ORG = 'aaaaaaaa-0000-0000-0000-000000000001';

function built(over: Partial<CommandDraft> = {}): EntityCommand {
  const out = buildCommand({
    operation: 'create',
    module: '01-socle',
    table: 'site',
    id: 'site-1',
    org_id: ORG,
    after: { id: 'site-1', org_id: ORG, name: 'Site « Nord »', country_code: 'FR' },
    timestamp: T,
    ...over,
  });
  if (!out.ok) throw new Error(out.findings.map(f => f.code).join(','));
  return out.value;
}

function written(command: EntityCommand): string {
  const out = serializeCommand(command);
  if (!out.ok) throw new Error(out.findings.map(f => f.code).join(','));
  return out.value;
}

function faultOf(text: string): string | number | undefined {
  const out = parseCommand(text);
  if (out.ok) throw new Error('commande acceptée');
  return out.findings[0]?.params['fault'];
}

/** Une commande valide, écrite à la main, à altérer champ par champ. */
function wire(over: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...JSON.parse(written(built())) as object, ...over });
}

/**
 * S-19 — « Ce qui se propage, ce sont les commandes validées de la section
 * E5.1. » Une commande ne circule que sous une forme qui se relit à
 * l'identique, et elle n'entre que par les contrôles de sa construction.
 */
describe('S-19 — une commande voyage sans perte', () => {
  it('relit à l’identique une création, une modification et une suppression', () => {
    const created = built();
    const updated = built({
      operation: 'update',
      before: { name: 'Site', floor_count: 2, active: true },
      after: { name: 'Site 2', floor_count: 2.125, active: false },
      groupKey: 'geste-1',
    });
    const deleted = inverseCommand(created, T);

    for (const command of [created, updated, deleted]) {
      const out = parseCommand(written(command));
      expect(out.ok && out.value).toEqual(command);
    }
  });

  it('relit l’inverse de la commande relue comme l’inverse de l’originale', () => {
    const command = built();
    const out = parseCommand(written(command));
    if (!out.ok) throw new Error('refus');
    expect(inverseCommand(out.value, T)).toEqual(inverseCommand(command, T));
  });

  it('écrit la même chaîne quel que soit l’ordre des colonnes (A9)', () => {
    const a = built({ after: { id: 'site-1', org_id: ORG, name: 'S', country_code: 'FR' } });
    const b = built({ after: { country_code: 'FR', name: 'S', org_id: ORG, id: 'site-1' } });
    expect(written(a)).toBe(written(b));
  });

  it('conserve un nombre non entier sans arrondi', () => {
    const command = built({
      operation: 'update',
      before: { name: 'a' },
      after: { name: 'a', area_m2: 0.1 + 0.2 },
    });
    const out = parseCommand(written(command));
    expect(out.ok && out.value.after?.['area_m2']).toBe(0.1 + 0.2);
  });

  it('refuse d’écrire un nombre non fini', () => {
    const out = serializeCommand(built({
      operation: 'update', before: { name: 'a' }, after: { name: 'a', area_m2: Number.NaN },
    }));
    expect(out.ok).toBe(false);
    expect(!out.ok && out.findings[0]?.params).toEqual({
      fault: 'non_finite_number', state: 'after', column: 'area_m2',
    });
  });
});

describe('S-19 — une commande reçue est une entrée non fiable', () => {
  it('refuse une entrée plus longue que la borne, avant de la décoder', () => {
    expect(faultOf(' '.repeat(MAX_WIRE_COMMAND_LENGTH + 1))).toBe('too_long');
  });

  it('refuse ce qui n’est pas du JSON', () => {
    expect(faultOf('{"operation":')).toBe('not_json');
  });

  it('refuse une clé inconnue', () => {
    expect(faultOf(wire({ author: 'quelqu’un' }))).toBe('schema');
  });

  it('refuse un champ manquant', () => {
    const partial = JSON.parse(wire()) as Record<string, unknown>;
    delete partial['before'];
    expect(faultOf(JSON.stringify(partial))).toBe('schema');
  });

  it('refuse une opération, un module ou une table hors vocabulaire', () => {
    expect(faultOf(wire({ operation: 'drop' }))).toBe('schema');
    expect(faultOf(wire({ module: '99-inconnu' }))).toBe('schema');
    expect(faultOf(wire({ table: 'site; drop table site' }))).toBe('schema');
  });

  it('refuse un horodatage qui n’est pas un instant UTC', () => {
    expect(faultOf(wire({ timestamp: '17/11/2026' }))).toBe('schema');
    expect(faultOf(wire({ timestamp: '' }))).toBe('schema');
  });

  it('refuse une valeur de colonne structurée', () => {
    expect(faultOf(wire({ after: { id: 'site-1', name: { fr: 'x' } } }))).toBe('schema');
  });

  it('refuse une colonne nommée __proto__ sans toucher au prototype', () => {
    const text = wire().replace('"after":{', '"after":{"__proto__":{"polluted":true},');
    expect(faultOf(text)).toBe('schema');
    expect(faultOf(`{"__proto__":{"polluted":true},${wire().slice(1)}`)).toBe('schema');
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('refuse une imbrication profonde sans épuiser la pile', () => {
    expect(faultOf(`${'['.repeat(100_000)}${']'.repeat(100_000)}`)).toBe('schema');
  });

  it('ne recopie aucune valeur reçue dans le refus', () => {
    const out = parseCommand(wire({ timestamp: 'secret-reçu' }));
    expect(JSON.stringify(out)).not.toContain('secret-reçu');
  });

  it('rejoue la propriété unique à la réception (INT-1)', () => {
    const out = parseCommand(wire({ module: '02-wayfinding' }));
    expect(!out.ok && out.findings.map(f => f.code)).toEqual(['EDIT.TABLE_NOT_OWNED']);
  });

  it('rejoue le cloisonnement du registre de sécurité à la réception (INV-3)', () => {
    const text = JSON.stringify({
      operation: 'update',
      module: '04-signaletique',
      table: 'pictogram',
      id: 'picto-1',
      org_id: ORG,
      before: { registry: 'safety', geometry: 'a' },
      after: { registry: 'safety', geometry: 'b' },
      timestamp: T,
      groupKey: null,
    });
    const out = parseCommand(text);
    expect(!out.ok && out.findings.map(f => f.code)).toContain('SECURITY.REGISTRY_WRITE_DENIED');
  });

  it('rejoue la cohérence entre opération et états (E5.1)', () => {
    expect(faultOf(wire({ before: { id: 'site-1' } }))).toBe('before_must_be_null');
  });
});
