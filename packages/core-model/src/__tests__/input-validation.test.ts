import { describe, it, expect } from 'vitest';
import {
  normalizeText, characterFault, textFault, textInput, charLength,
  readRowSchema, writeRowSchema, parseColumnSpec, INPUT_COLUMNS, tableColumns,
  FIELD_BOUNDS, buildCommand,
} from '../index.js';
import type { CommandDraft } from '../index.js';

const RLO = String.fromCodePoint(0x202e);
const LRI = String.fromCodePoint(0x2066);
const RLM = String.fromCodePoint(0x200f);
const NUL = String.fromCodePoint(0);
const BEL = String.fromCodePoint(7);
const C1 = String.fromCodePoint(0x85);
const E_ACUTE_NFD = 'é';

describe('lot 4 : normaliser, puis accepter ou refuser', () => {
  it('normalise les espaces de bord et la forme NFC, rien d’autre', () => {
    expect(normalizeText(`  Caf${E_ACUTE_NFD}  `)).toBe('Café');
    expect(normalizeText('Hall  Nord')).toBe('Hall  Nord');
  });

  it('compte en caractères, comme char_length', () => {
    expect(charLength('😀a')).toBe(2);
  });

  it.each([
    ['un caractère nul', `a${NUL}b`, 'control'],
    ['une sonnerie', `a${BEL}b`, 'control'],
    ['un caractère C1', `a${C1}b`, 'control'],
    ['un forçage de direction', `facture${RLO}fdp.exe`, 'bidi'],
    ['un isolement de direction', `${LRI}abc`, 'bidi'],
    ['une forme non NFC', `Caf${E_ACUTE_NFD}`, 'not_nfc'],
  ])('refuse %s', (_label, value, fault) => {
    expect(characterFault(value, true)).toBe(fault);
  });

  it('admet les marques de direction qui ne réordonnent rien, et les fins de ligne d’un texte long', () => {
    expect(characterFault(`مرحبا${RLM}`, false)).toBeNull();
    expect(characterFault('ligne 1\nligne 2', true)).toBeNull();
    expect(characterFault('ligne 1\nligne 2', false)).toBe('line_break');
  });

  it('applique les bornes que le cahier fixe', () => {
    expect(textFault('A', FIELD_BOUNDS['site.name'])).toBe('too_short');
    expect(textFault('x'.repeat(121), FIELD_BOUNDS['site.name'])).toBe('too_long');
    expect(textFault('x'.repeat(120), FIELD_BOUNDS['site.name'])).toBeNull();
    expect(textFault('ABCDEFGHI', FIELD_BOUNDS['orientation_zone.code'])).toBe('too_long');
  });

  it('le schéma de saisie rend la valeur normalisée, ou un refus motivé', () => {
    const schema = textInput(FIELD_BOUNDS['building.name']);
    expect(schema.parse('  Tour A ')).toBe('Tour A');
    const refused = schema.safeParse(`Tour${RLO}A`);
    expect(refused.success).toBe(false);
    if (!refused.success) expect(refused.error.issues[0]?.message).toBe('bidi');
  });
});

describe('lot 4 : les schémas stricts tirés du catalogue', () => {
  it('chaque forme déclarée se lit', () => {
    for (const columns of Object.values(INPUT_COLUMNS)) {
      for (const spec of Object.values(columns)) expect(() => parseColumnSpec(spec)).not.toThrow();
    }
    expect(parseColumnSpec('?=a|b')).toEqual({ kind: 'enum', nullable: true, values: ['a', 'b'] });
  });

  it('une table inconnue n’a pas de colonnes', () => {
    expect(tableColumns('toString')).toBeUndefined();
    expect(tableColumns('table_inconnue')).toBeUndefined();
  });

  const site = tableColumns('site') ?? {};
  const read = readRowSchema(site, ['id', 'name', 'active_langs']);
  const ID = 'aaaaaaaa-0000-4000-8000-000000000001';

  it('relit une ligne bien formée', () => {
    expect(read.safeParse({ id: ID, name: 'Centre', active_langs: ['fr'] }).success).toBe(true);
  });

  it.each([
    ['une colonne non demandée', { id: ID, name: 'Centre', active_langs: ['fr'], extra: 1 }],
    ['un identifiant qui n’est pas un UUID', { id: 'site-1', name: 'Centre', active_langs: ['fr'] }],
    ['un texte stocké avec un forçage de direction', { id: ID, name: `Centre${RLO}`, active_langs: ['fr'] }],
    ['un null dans une colonne obligatoire', { id: ID, name: null, active_langs: ['fr'] }],
  ])('refuse à la relecture %s', (_label, row) => {
    expect(read.safeParse(row).success).toBe(false);
  });

  it('refuse à la relecture un état hors de l’énumération, au lieu de le changer en brouillon', () => {
    const version = readRowSchema(tableColumns('support_version') ?? {}, ['state']);
    expect(version.safeParse({ state: 'draft' }).success).toBe(true);
    expect(version.safeParse({ state: 'publie' }).success).toBe(false);
  });

  it('les valeurs d’une commande suivent leur colonne', () => {
    const write = writeRowSchema(site);
    expect(write.safeParse({ name: 'Centre', active_langs: '{fr,en}' }).success).toBe(true);
    expect(write.safeParse({ nom: 'Centre' }).success).toBe(false);
    expect(write.safeParse({ active_langs: '["fr"]' }).success).toBe(false);
  });
});

describe('lot 4 : essai d’abus au passage obligé de l’écriture', () => {
  const ORG = 'aaaaaaaa-0000-4000-8000-000000000001';
  const draft = (after: Record<string, string | number | boolean | null>, table = 'site'): CommandDraft => ({
    operation: 'create', module: '01-socle', table, id: 'x-1', org_id: ORG,
    timestamp: '2026-10-23T10:00:00.000Z', after: { id: 'x-1', org_id: ORG, ...after },
  });
  const faults = (d: CommandDraft): readonly string[] => {
    const out = buildCommand(d);
    return out.ok ? [] : out.findings
      .filter(f => f.code === 'EDIT.COMMAND_SHAPE_INVALID')
      .map(f => `${String(f.params['column'])} ${String(f.params['fault'])}`);
  };

  it.each([
    ['un nom trop long', { name: 'x'.repeat(121) }, 'name too_long'],
    ['un nom à forçage de direction', { name: `Centre${RLO}lacoV` }, 'name bidi'],
    ['un caractère de contrôle', { name: `Centre${BEL}` }, 'name control'],
    ['une colonne inconnue', { name: 'Centre', is_admin: true }, 'is_admin unknown_column'],
  ])('refuse %s', (_label, after, expected) => {
    expect(faults(draft(after))).toContain(expected);
  });

  it('refuse un booléen écrit en chaîne', () => {
    expect(faults(draft({ name: 'Tour A', independent_access: 'true' }, 'building')))
      .toContain('independent_access invalid_type');
  });

  it('refuse une valeur hors énumération, et un JSON illisible', () => {
    expect(faults(draft({ label: 'Accueil', kind: 'trappe' }, 'node'))).toContain('kind invalid_value');
    expect(faults(draft({ label: 'Accueil', position: '{x:1}' }, 'node'))).toContain('position json');
  });

  it('refuse un forçage de direction caché dans une structure JSON', () => {
    const position = JSON.stringify({ x_m: 1, y_m: 2, note: `a${RLO}b` });
    expect(faults(draft({ label: 'Accueil', position }, 'node'))).toContain('position bidi');
  });

  it('laisse passer une commande bien formée', () => {
    expect(buildCommand(draft({ name: 'Centre Plateau', country_code: 'CI' })).ok).toBe(true);
  });
});
