import { describe, it, expect } from 'vitest';
import {
  createOrientationZone, createNamingRule,
  createInformationLevel, createSequenceStep, setSupportCode,
} from '../wayfinding-commands.js';
import type { WayfindingWrite } from '../wayfinding-commands.js';

const WRITE: WayfindingWrite = {
  orgId: 'aaaaaaaa-0000-0000-0000-000000000001',
  siteId: 'ssssssss-0000-0000-0000-000000000001',
  timestamp: '2026-09-22T10:00:00.000Z',
};

const ZONE = {
  id: 'zzzzzzzz-0000-0000-0000-000000000001',
  code: 'GAL-N',
  nameFr: 'Galerie nord',
  nameEn: 'North mall',
  kind: 'mall' as const,
  footprintIds: ['fp-1', 'fp-2'],
};

describe('module 02 — zone d’orientation', () => {
  it('écrit une zone, sous le module qui la possède', () => {
    const out = createOrientationZone(ZONE, WRITE);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const [command] = out.value;
    expect(command?.table).toBe('orientation_zone');
    expect(command?.module).toBe('02-wayfinding');
    expect(command?.after?.['name_en']).toBe('North mall');
  });

  it('refuse un code vide ou trop long (N2.2, un à huit caractères)', () => {
    for (const code of ['', '   ', 'GALERIE-NORD']) {
      const out = createOrientationZone({ ...ZONE, code }, WRITE);
      expect(out.ok, code).toBe(false);
      if (!out.ok) expect(out.findings[0]?.code).toBe('EDIT.COMMAND_SHAPE_INVALID');
    }
  });

  it('refuse une zone sans nom dans une langue active', () => {
    const out = createOrientationZone({ ...ZONE, nameEn: '  ' }, WRITE);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.findings.map(f => f.code)).toContain('DATA.NAME_REQUIRED');
  });

  it('rend les deux refus ensemble plutôt qu’un seul', () => {
    // Corriger un défaut pour en découvrir un second au coup suivant est ce
    // que F10 appelle un message qui n'aide pas.
    const out = createOrientationZone({ ...ZONE, code: '', nameFr: '' }, WRITE);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.findings).toHaveLength(2);
  });

  it('range les empreintes couvertes sans les interpréter', () => {
    const out = createOrientationZone(ZONE, WRITE);
    if (!out.ok) throw new Error('refus inattendu');
    expect(out.value[0]?.after?.['footprint_ids']).toBe('["fp-1","fp-2"]');
  });
});

describe('module 02 — règle de nommage', () => {
  const RULE = {
    id: 'rrrrrrrr-0000-0000-0000-000000000001',
    target: 'door' as const,
    pattern: 'P-{n}',
    maxLength: 12,
    uniquenessScope: 'building' as const,
  };

  it('écrit une règle', () => {
    const out = createNamingRule(RULE, WRITE);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value[0]?.table).toBe('naming_rule');
    expect(out.value[0]?.after?.['uniqueness_scope']).toBe('building');
  });

  it('refuse une longueur maximale nulle ou négative', () => {
    for (const maxLength of [0, -3]) {
      const out = createNamingRule({ ...RULE, maxLength }, WRITE);
      expect(out.ok, String(maxLength)).toBe(false);
    }
  });

  it('refuse un modèle vide : une règle sans modèle ne vérifie rien', () => {
    const out = createNamingRule({ ...RULE, pattern: '   ' }, WRITE);
    expect(out.ok).toBe(false);
  });
});

describe('module 02 — niveau d’information et jalonnement', () => {
  const LEVEL = {
    id: 'iiiiiiii-0000-0000-0000-000000000001',
    typologyId: 'tttttttt-0000-0000-0000-000000000001',
    level: 3,
  };

  it('rattache une typologie à un niveau', () => {
    const out = createInformationLevel(LEVEL, WRITE);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value[0]?.after?.['level']).toBe(3);
  });

  it('refuse un niveau hors des quatre de H2.3', () => {
    for (const level of [0, 5, 2.5]) {
      const out = createInformationLevel({ ...LEVEL, level }, WRITE);
      expect(out.ok, String(level)).toBe(false);
    }
  });

  const STEP = {
    id: 'qqqqqqqq-0000-0000-0000-000000000001',
    profileId: 'pppppppp-0000-0000-0000-000000000001',
    ordinal: 0,
    nodeId: 'nnnnnnnn-0000-0000-0000-000000000001',
    expectedLevel: 2,
  };

  it('écrit une étape de jalonnement', () => {
    const out = createSequenceStep(STEP, WRITE);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value[0]?.table).toBe('wayfinding_sequence');
    expect(out.value[0]?.after?.['ordinal']).toBe(0);
  });

  it('accepte le rang zéro, qui est le premier point rencontré', () => {
    expect(createSequenceStep({ ...STEP, ordinal: 0 }, WRITE).ok).toBe(true);
  });

  it('refuse un rang négatif et un niveau hors bornes, ensemble', () => {
    const out = createSequenceStep({ ...STEP, ordinal: -1, expectedLevel: 9 }, WRITE);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.findings).toHaveLength(2);
  });
});

describe('module 02 — ce que la propriété unique interdit', () => {
  it('n’écrit jamais hors des tables du module', () => {
    // R1 (partie L) : la garantie ne vient pas de la discipline de l'appelant mais du
    // refus de `buildCommand`. Les quatre constructeurs nomment leur table en
    // dur, donc aucun n'a de voie vers une table voisine.
    const tables = [
      createOrientationZone(ZONE, WRITE),
      createNamingRule({
        id: 'r', target: 'zone', pattern: 'Z-{n}', maxLength: 8, uniquenessScope: 'site',
      }, WRITE),
      createInformationLevel({ id: 'i', typologyId: 't', level: 1 }, WRITE),
      createSequenceStep({
        id: 'q', profileId: 'p', ordinal: 1, nodeId: 'n', expectedLevel: 4,
      }, WRITE),
    ].flatMap(out => (out.ok ? out.value.map(c => c.table) : []));

    expect(tables).toEqual([
      'orientation_zone', 'naming_rule', 'information_level', 'wayfinding_sequence',
    ]);
  });

  it('horodate depuis l’appelant, jamais depuis l’horloge', () => {
    const out = createOrientationZone(ZONE, WRITE);
    if (!out.ok) throw new Error('refus inattendu');
    expect(out.value[0]?.timestamp).toBe(WRITE.timestamp);
  });

  it('refuse un horodatage vide (E5.1)', () => {
    const out = createOrientationZone(ZONE, { ...WRITE, timestamp: '' });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.findings.map(f => f.code)).toContain('EDIT.TIMESTAMP_REQUIRED');
  });
});

describe('module 02 — le code d’un support, colonne de la table scindée', () => {
  const DRAFT = {
    supportId: 'uuuuuuuu-0000-0000-0000-000000000001',
    previousCode: null,
    code: 'D-042',
  };

  it('écrit la seule colonne `code`, et rien d’autre de la ligne', () => {
    const out = setSupportCode(DRAFT, WRITE);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value[0]?.table).toBe('support');
    expect(out.value[0]?.operation).toBe('update');
    expect(Object.keys(out.value[0]?.after ?? {})).toEqual(['code']);
  });

  it('porte l’ancien code, sans quoi la commande ne serait pas réversible', () => {
    const out = setSupportCode({ ...DRAFT, previousCode: 'D-041' }, WRITE);
    if (!out.ok) throw new Error('refus inattendu');
    expect(out.value[0]?.before?.['code']).toBe('D-041');
  });

  it('refuse un code vide : A5.6 le veut requis', () => {
    const out = setSupportCode({ ...DRAFT, code: '  ' }, WRITE);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.findings[0]?.code).toBe('EDIT.COMMAND_SHAPE_INVALID');
  });
});
