import { describe, it, expect } from 'vitest';
import {
  DECLARED_FACT_KEYS, PARKING_CAPACITY_KEY, PARKING_FREE_KEY,
  PARKING_UNDIGITIZED_SPACES_KEY, PARKING_UNDIGITIZED_REASON_KEY,
  isFactKeyShape, factKeyDeclaration,
  factValueMatchesType, factValueFault, declaredInteger, declaredText,
} from '../fact-keys.js';
import { buildCommand } from '../site-commands.js';
import type { CommandDraft } from '../site-commands.js';
import type { SiteFact } from '../site-facts.js';

/**
 * A5.11, convention de clé. « Une clé de fait est composée d'un espace de noms
 * et d'un nom, séparés par un point, et chaque clé déclare le type attendu de
 * sa valeur. Sans ce type, un jour quelqu'un écrira "oui" là où un autre
 * attend un booléen. »
 */

function fait(partiel: Partial<SiteFact>): SiteFact {
  return {
    key: PARKING_CAPACITY_KEY,
    value: 120,
    status: 'existing',
    source_ref: 'Relevé 2026',
    declared_at: '2026-01-01',
    target: { kind: 'zone', id: 'zone-p1' },
    forbidden: [],
    ...partiel,
  };
}

function commandeDeFait(after: Record<string, string | number | boolean>): CommandDraft {
  return {
    operation: 'create',
    module: '01-socle',
    table: 'site_fact',
    id: 'fait-1',
    org_id: 'org-1',
    timestamp: '2026-01-01T00:00:00.000Z',
    after,
  };
}

describe('A5.11 — la table des clés déclarées', () => {
  it('porte les quatre clés du document, avec leur type et leur cible', () => {
    expect(DECLARED_FACT_KEYS.map(d => [d.key, d.value_type, d.target_kind, d.target_object_kind]))
      .toEqual([
        ['parking.capacity', 'integer', 'zone', 'parking'],
        ['parking.free', 'boolean', 'zone', 'parking'],
        ['parking.undigitized_spaces', 'integer', 'footprint', 'parking_space'],
        ['parking.undigitized_reason', 'text', 'footprint', 'parking_space'],
      ]);
  });

  it('ne déclare aucune clé deux fois', () => {
    const keys = DECLARED_FACT_KEYS.map(d => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('donne à chaque clé déclarée la forme espace de noms, point, nom', () => {
    for (const declaration of DECLARED_FACT_KEYS) {
      expect(isFactKeyShape(declaration.key), declaration.key).toBe(true);
    }
  });

  it('refuse les formes de clé qu’A5.11 n’admet pas', () => {
    for (const mauvaise of [
      'capacity',            // pas d'espace de noms
      'parking.capacity.max', // deux points, coupure ambiguë
      '.capacity',            // espace de noms vide
      'parking.',             // nom vide
      'parking. capacity',    // blanc de bordure
    ]) {
      expect(isFactKeyShape(mauvaise), mauvaise).toBe(false);
    }
  });

  it('retrouve une déclaration par sa clé, et rend null pour une clé absente', () => {
    expect(factKeyDeclaration(PARKING_FREE_KEY)?.value_type).toBe('boolean');
    expect(factKeyDeclaration('parking_gratuit')).toBe(null);
  });
});

describe('A5.11 — « une valeur qui ne correspond pas au type déclaré est refusée »', () => {
  it('accepte un entier pour un entier, un booléen pour un booléen', () => {
    expect(factValueMatchesType(120, 'integer')).toBe(true);
    expect(factValueMatchesType(0, 'integer')).toBe(true);
    expect(factValueMatchesType(false, 'boolean')).toBe(true);
  });

  it('refuse « oui » là où la table déclare un booléen', () => {
    // Le cas que le document nomme, mot pour mot.
    const fault = factValueFault(PARKING_FREE_KEY, 'oui');
    expect(fault).toEqual({ key: PARKING_FREE_KEY, expected: 'boolean', received: 'string' });
  });

  it('refuse un nombre non entier, et un booléen, pour un compte', () => {
    expect(factValueFault(PARKING_CAPACITY_KEY, 120.5)?.expected).toBe('integer');
    expect(factValueFault(PARKING_UNDIGITIZED_SPACES_KEY, true)?.expected).toBe('integer');
    expect(factValueFault(PARKING_CAPACITY_KEY, Number.NaN)?.expected).toBe('integer');
  });

  it('ne juge pas une clé que la table ne porte pas', () => {
    // Les faits déclarés avant la convention — `parking_gratuit`,
    // `niveaux_parking` — ne sont pas retirés par le document. Refuser faute
    // de déclaration les bannirait tous.
    expect(factValueFault('parking_gratuit', 'oui')).toBe(null);
  });
});

describe('A5.11 — le refus s’applique au passage obligé de l’écriture', () => {
  it('refuse une commande de fait dont la valeur contredit le type déclaré', () => {
    const outcome = buildCommand(commandeDeFait({ key: PARKING_FREE_KEY, value: 'oui' }));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    const f = outcome.findings.find(x => x.params['fault'] === 'fact_value_type');
    expect(f?.code).toBe('EDIT.COMMAND_SHAPE_INVALID');
    expect(f?.params['key']).toBe(PARKING_FREE_KEY);
    expect(f?.params['expected']).toBe('boolean');
    expect(f?.params['received']).toBe('string');
  });

  it('laisse passer la même commande avec la valeur du bon type', () => {
    expect(buildCommand(commandeDeFait({ key: PARKING_FREE_KEY, value: true })).ok).toBe(true);
    expect(buildCommand(commandeDeFait({ key: PARKING_CAPACITY_KEY, value: 120 })).ok).toBe(true);
  });

  it('ne juge pas les autres tables, ni une suppression sans état postérieur', () => {
    const suppression = buildCommand({
      operation: 'delete',
      module: '01-socle',
      table: 'site_fact',
      id: 'fait-1',
      org_id: 'org-1',
      timestamp: '2026-01-01T00:00:00.000Z',
      before: { key: PARKING_FREE_KEY, value: 'oui' },
    });
    expect(suppression.ok).toBe(true);
  });
});

describe('S-37 — le motif d’une surface non numérisée', () => {
  // « Le nombre et le motif sont deux faits ciblant cette empreinte, clés
  // parking.undigitized_spaces et parking.undigitized_reason. »
  const motif = (value: string | number | boolean): CommandDraft => commandeDeFait({
    key: PARKING_UNDIGITIZED_REASON_KEY, value,
    target_kind: 'footprint', target_id: 'fp-surface',
  });

  it('cible la même empreinte que le nombre de places', () => {
    const nombre = factKeyDeclaration(PARKING_UNDIGITIZED_SPACES_KEY);
    const raison = factKeyDeclaration(PARKING_UNDIGITIZED_REASON_KEY);
    expect([raison?.target_kind, raison?.target_object_kind])
      .toEqual([nombre?.target_kind, nombre?.target_object_kind]);
  });

  it('accepte un texte au passage obligé de l’écriture', () => {
    expect(buildCommand(motif('Bord de page du plan source')).ok).toBe(true);
  });

  it('refuse un nombre ou un booléen là où un motif est attendu', () => {
    // Le cas symétrique de « oui » écrit pour un booléen : un compte écrit à
    // la place de son motif.
    for (const valeur of [12, true]) {
      const outcome = buildCommand(motif(valeur));
      expect(outcome.ok, `valeur ${String(valeur)} acceptée`).toBe(false);
      if (!outcome.ok) {
        expect(outcome.findings[0]?.params['expected']).toBe('text');
      }
    }
  });

  it('ne confond pas les deux faits : un texte reste refusé pour le nombre', () => {
    expect(factValueFault(PARKING_UNDIGITIZED_SPACES_KEY, 'douze')?.expected).toBe('integer');
    expect(factValueFault(PARKING_UNDIGITIZED_REASON_KEY, 'douze')).toBeNull();
  });
});

describe('A5.11 — lire une valeur entière déclarée sur une cible', () => {
  const zoneP1 = { kind: 'zone', id: 'zone-p1' };

  it('rend la valeur du fait qui porte sur cette cible, et non celle d’une autre', () => {
    const facts = [
      fait({ value: 120 }),
      fait({ value: 80, target: { kind: 'zone', id: 'zone-p2' } }),
    ];
    expect(declaredInteger(facts, PARKING_CAPACITY_KEY, zoneP1)).toBe(120);
    expect(declaredInteger(facts, PARKING_CAPACITY_KEY, { kind: 'zone', id: 'zone-p2' })).toBe(80);
  });

  it('ignore le fait du site entier, qui ne désigne aucune zone', () => {
    const avecCible = fait({ value: 500 });
    const sansCible: SiteFact = {
      key: avecCible.key, value: avecCible.value, status: avecCible.status,
      source_ref: avecCible.source_ref, declared_at: avecCible.declared_at,
      forbidden: avecCible.forbidden,
    };
    expect(declaredInteger([sansCible], PARKING_CAPACITY_KEY, zoneP1)).toBe(null);
  });

  it('rend null quand deux faits concurrents portent sur la même cible', () => {
    expect(declaredInteger([fait({ value: 120 }), fait({ value: 130 })],
      PARKING_CAPACITY_KEY, zoneP1)).toBe(null);
  });

  it('rend null quand la valeur trouvée n’est pas un entier', () => {
    expect(declaredInteger([fait({ value: 'cent vingt' })], PARKING_CAPACITY_KEY, zoneP1))
      .toBe(null);
  });
});

describe('S-37 — lire un motif déclaré sur une empreinte', () => {
  const surface = { kind: 'footprint', id: 'fp-surface' };
  const motif = (value: string | number, id = 'fp-surface'): SiteFact => fait({
    key: PARKING_UNDIGITIZED_REASON_KEY, value, target: { kind: 'footprint', id },
  });

  it('rend le texte du fait qui porte sur cette empreinte', () => {
    expect(declaredText([motif('Bord de page'), motif('Autre', 'fp-b')],
      PARKING_UNDIGITIZED_REASON_KEY, surface)).toBe('Bord de page');
  });

  it('rend une chaîne vide telle quelle : juger qu’elle ne dit rien revient à l’appelant', () => {
    expect(declaredText([motif('')], PARKING_UNDIGITIZED_REASON_KEY, surface)).toBe('');
  });

  it('rend null sans fait, avec deux faits concurrents, ou pour une valeur qui n’est pas un texte', () => {
    expect(declaredText([], PARKING_UNDIGITIZED_REASON_KEY, surface)).toBe(null);
    expect(declaredText([motif('a'), motif('b')], PARKING_UNDIGITIZED_REASON_KEY, surface))
      .toBe(null);
    expect(declaredText([motif(3)], PARKING_UNDIGITIZED_REASON_KEY, surface)).toBe(null);
  });
});
