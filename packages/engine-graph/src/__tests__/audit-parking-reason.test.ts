import { describe, it, expect } from 'vitest';
import type { Footprint, SiteFact, SiteZone } from '@azimut/core-model';
import {
  PARKING_CAPACITY_KEY, PARKING_UNDIGITIZED_SPACES_KEY, PARKING_UNDIGITIZED_REASON_KEY,
} from '@azimut/core-model';
import { auditParking } from '../audit-parking.js';

/**
 * S-37 — le motif d'une surface non numérisée.
 *
 * « Une empreinte de nature `parking_space` peut être marquée non numérisée,
 * avec le nombre de places qu'elle est censée porter, le motif pour lequel
 * elle ne l'est pas, et sa source. » `PARK.UNDIGITIZED_REASON_MISSING`,
 * avertissement : « surface non numérisée dont le motif manque ou est vide ».
 *
 * Un motif vide est valide au regard du type ; il est signalé quand même.
 */

function surface(id: string): Footprint {
  return {
    id,
    org_id: 'org-test-001',
    level_id: 'lvl-1',
    geometry: {
      vertices: [{ x_m: 0, y_m: 0 }, { x_m: 2, y_m: 0 }, { x_m: 2, y_m: 5 }, { x_m: 0, y_m: 5 }],
    },
    kind: 'parking_space',
  };
}

function parking(id: string, footprintIds: readonly string[]): SiteZone {
  return {
    id, org_id: 'org-test-001', level_id: 'lvl-1', name: `Parking ${id}`,
    kind: 'parking', footprint_ids: [...footprintIds],
  };
}

function fait(key: string, value: number | string, kind: string, id: string): SiteFact {
  return {
    key, value, status: 'existing', source_ref: 'Plan RDJ indice 20',
    declared_at: '2026-01-05', target: { kind, id }, forbidden: [],
  };
}

const marque = (id: string, n: number): SiteFact =>
  fait(PARKING_UNDIGITIZED_SPACES_KEY, n, 'footprint', id);
const motif = (id: string, texte: string): SiteFact =>
  fait(PARKING_UNDIGITIZED_REASON_KEY, texte, 'footprint', id);

function avertissements(facts: readonly SiteFact[], forDeliverable = false) {
  return auditParking({
    zones: [parking('ouest', ['fp-a', 'fp-b'])],
    footprints: [surface('fp-a'), surface('fp-b')],
    facts,
  }, forDeliverable).findings.filter(f => f.code === 'PARK.UNDIGITIZED_REASON_MISSING');
}

describe('S-37 — PARK.UNDIGITIZED_REASON_MISSING', () => {
  it('signale une surface marquée sans motif, en avertissement', () => {
    const [finding, ...reste] = avertissements([marque('fp-a', 20)]);
    expect(reste).toEqual([]);
    expect(finding).toEqual({
      code: 'PARK.UNDIGITIZED_REASON_MISSING',
      severity: 'warning',
      entity: { kind: 'footprint', id: 'fp-a' },
      params: { declared: 20, reason: 'missing' },
      ruleRef: 'S-37',
    });
  });

  it('signale un motif vide, valide au regard du type', () => {
    const [finding] = avertissements([marque('fp-a', 20), motif('fp-a', '')]);
    expect(finding?.params).toEqual({ declared: 20, reason: 'empty' });
  });

  it('tient pour vide un motif fait de seuls blancs', () => {
    const [finding] = avertissements([marque('fp-a', 20), motif('fp-a', '  \t ')]);
    expect(finding?.params['reason']).toBe('empty');
  });

  it('se tait quand le motif est déclaré', () => {
    expect(avertissements([marque('fp-a', 20), motif('fp-a', 'Bord de page')])).toEqual([]);
  });

  it('ne demande aucun motif à une surface qui n’est pas marquée', () => {
    // Le motif accompagne la marque ; seul, il ne déclare rien à justifier.
    expect(avertissements([])).toEqual([]);
    expect(avertissements([motif('fp-a', '')])).toEqual([]);
  });

  it('ne prend pas le motif d’une autre empreinte', () => {
    const found = avertissements([marque('fp-a', 20), motif('fp-b', 'Bord de page')]);
    expect(found.map(f => f.entity?.id)).toEqual(['fp-a']);
  });

  it('juge aussi une marque à zéro : elle déclare une surface relevée', () => {
    const [finding] = avertissements([marque('fp-a', 0)]);
    expect(finding?.params).toEqual({ declared: 0, reason: 'missing' });
  });

  it('examine une surface qu’aucune zone ne déclare', () => {
    // Le fait vise l'empreinte, pas la zone.
    const findings = auditParking({
      zones: [],
      footprints: [surface('fp-seule')],
      facts: [marque('fp-seule', 5)],
    }).findings;
    expect(findings.map(f => [f.code, f.entity?.id]))
      .toEqual([['PARK.UNDIGITIZED_REASON_MISSING', 'fp-seule']]);
  });

  it('ne bloque pas : l’écart reste expliqué à concurrence de la marque', () => {
    const findings = auditParking({
      zones: [parking('ouest', ['fp-a'])],
      footprints: [surface('fp-a')],
      facts: [fait(PARKING_CAPACITY_KEY, 20, 'zone', 'ouest'), marque('fp-a', 20)],
    }).findings;
    expect(findings.map(f => f.code)).toEqual(['PARK.UNDIGITIZED_REASON_MISSING']);
    expect(findings.every(f => f.severity === 'warning')).toBe(true);
  });

  it('signale à l’atelier comme au livrable', () => {
    expect(avertissements([marque('fp-a', 3)], true)).toHaveLength(1);
  });

  it('rend les surfaces dans l’ordre de leur identifiant, quel que soit l’ordre reçu', () => {
    const facts = [marque('fp-b', 1), marque('fp-a', 1)];
    const ids = avertissements(facts).map(f => f.entity?.id);
    expect(ids).toEqual(['fp-a', 'fp-b']);
    expect(avertissements([...facts].reverse()).map(f => f.entity?.id)).toEqual(ids);
  });
});
