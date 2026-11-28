import { describe, it, expect } from 'vitest';
import { importSupports } from '@azimut/engine-graph';
import { refMultilevel } from '@azimut/testkit';
import { carnetCommands, resolveCarnet } from '../carnet-import.js';

/**
 * T-1.13, D4.1, décisions QI1 à QI5 — le carnet confronté au site, puis
 * traduit en commandes. Un import partiellement erroné importe les lignes
 * valides, rejette les autres, et le rapport le dit ligne à ligne.
 */
const HEADER = 'reference;typology;building;level;node_ref;x_m;y_m;azimuth_deg;width_mm;height_mm;condition;installed_at;content_fr';
const B = 'Bâtiment ML';

function carnet(rows: readonly string[]) {
  const out = importSupports(refMultilevel, [HEADER, ...rows].join('\n'));
  if (!out.ok) throw new Error(out.findings.map(f => f.code).join(','));
  return resolveCarnet(out.value, refMultilevel);
}

const reasonOf = (line: { findings: readonly { code: string; params: Readonly<Record<string, unknown>> }[] }) =>
  line.findings.map(f => `${f.code}:${String(f.params['reason'] ?? f.params['existing'] ?? '')}`);

describe('T-1.13 — chaque ligne confrontée au site', () => {
  const lines = carnet([
    `D-100;directional;${B};RDC;n-ml-hall;;;90;;;good;2024-05-02;Accueil`,
    `D-101;totem;${B};RDC;n-ml-hall;;;90;;;;;`,
    `D-102;directional;Annexe;RDC;n-ml-hall;;;90;;;;;`,
    `D-103;directional;${B};R+5;n-ml-hall;;;90;;;;;`,
    `D-104;directional;${B};R+1;n-ml-hall;;;90;;;;;`,
    `D-105;directional;${B};RDC;;12.5;4;90;;;;;`,
    `D-106;directional;${B};RDC;n-ml-hall;;;;;;;;`,
    `D-107;directional;${B};RDC;n-inconnu;;;90;;;;;`,
    `D-100;directional;${B};RDC;n-ml-hall;;;90;;;;;`,
    `D-108;directional;${B};RDC;n-ml-hall;;;180;600;900;;;`,
  ]);

  it('le rapport tient chaque ligne, dans l’ordre du fichier, sans troncature', () => {
    expect(lines.map(l => [l.row, l.reference, l.status])).toEqual([
      [2, 'D-100', 'ready'],
      [3, 'D-101', 'rejected'],
      [4, 'D-102', 'rejected'],
      [5, 'D-103', 'rejected'],
      [6, 'D-104', 'rejected'],
      [7, 'D-105', 'pending'],
      [8, 'D-106', 'pending'],
      [9, 'D-107', 'pending'],
      [10, '', 'rejected'],
      [11, 'D-108', 'ready'],
    ]);
  });

  it('chaque refus et chaque attente dit sa raison', () => {
    expect(lines.slice(1, 8).map(reasonOf)).toEqual([
      ['IMPORT.ROW_INVALID:typology_unknown'],
      ['IMPORT.ROW_INVALID:building_unknown'],
      ['IMPORT.ROW_INVALID:level_unknown'],
      ['IMPORT.ROW_INVALID:node_level_mismatch'],
      ['IMPORT.NODE_NOT_FOUND:node_missing'],
      ['IMPORT.NODE_NOT_FOUND:azimuth_missing'],
      // Le moteur la met lui-même en attente, et nomme le nœud.
      ['IMPORT.NODE_NOT_FOUND:'],
    ]);
    expect(lines[8]?.findings.map(f => f.code)).toEqual(['IMPORT.DUPLICATE_KEY']);
  });

  it('un code déjà porté par un support du site est refusé', () => {
    const first = refMultilevel.supports[0];
    if (first === undefined) throw new Error('ref-multilevel sans support');
    const site = { ...refMultilevel, supports: [{ ...first, code: 'D-900' }] };
    const out = importSupports(site, [HEADER, `D-900;directional;${B};RDC;n-ml-hall;;;90;;;;;`].join('\n'));
    if (!out.ok) throw new Error('import');
    const line = resolveCarnet(out.value, site)[0];
    if (line === undefined) throw new Error('ligne absente');
    expect(reasonOf(line)).toEqual(['IMPORT.DUPLICATE_KEY:site']);
  });
});

describe('T-1.13 — une typologie ambiguë', () => {
  it('une clé portée par deux typologies de l’organisation est refusée', () => {
    const first = refMultilevel.support_types[0];
    if (first === undefined) throw new Error('ref-multilevel sans typologie');
    const site = { ...refMultilevel, support_types: [first, { ...first, id: 'stype-bis' }] };
    const out = importSupports(site, [HEADER, `D-100;directional;${B};RDC;n-ml-hall;;;90;;;;;`].join('\n'));
    if (!out.ok) throw new Error('import');
    const line = resolveCarnet(out.value, site)[0];
    if (line === undefined) throw new Error('ligne absente');
    expect(reasonOf(line)).toEqual(['IMPORT.ROW_INVALID:typology_ambiguous']);
  });
});

describe('T-1.13 — les commandes des lignes prêtes', () => {
  const lines = carnet([
    `D-100;directional;${B};RDC;n-ml-hall;;;90;;;good;2024-05-02;Accueil`,
    `D-105;directional;${B};RDC;;12.5;4;90;;;;;`,
    `D-108;directional;${B};RDC;n-ml-hall;;;180;600;900;worn;;`,
  ]);
  let n = 0;
  const out = carnetCommands(lines, refMultilevel, {
    orgId: 'org-test-001', siteId: refMultilevel.site.id, timestamp: '2026-11-28T10:00:00.000Z',
    groupKey: 'carnet', newId: () => `id-${String(++n)}`,
  });
  if (!out.ok) throw new Error(out.findings.map(f => f.code).join(','));
  const commands = out.value;

  it('création par le wayfinding, cotes par la signalétique, pose par l’exploitation', () => {
    expect(commands.map(c => [c.operation, c.module, c.table, c.id])).toEqual([
      ['create', '02-wayfinding', 'support', 'id-1'],
      ['create', '08-exploitation', 'installed_support', 'id-2'],
      ['create', '02-wayfinding', 'support', 'id-3'],
      ['update', '04-signaletique', 'support', 'id-3'],
    ]);
  });

  it('rien n’est inventé : ni registre, ni nature, ni contenu constaté, ni date de pose absente', () => {
    const created = commands[0]?.after ?? {};
    expect(created).toEqual({
      id: 'id-1', org_id: 'org-test-001', site_id: refMultilevel.site.id, code: 'D-100',
      node_id: 'n-ml-hall', typology_id: 'stype-directional', azimuth_deg: '90',
    });
    expect(commands[1]?.after).toEqual({
      id: 'id-2', org_id: 'org-test-001', support_id: 'id-1',
      installed_at: '2024-05-02', condition: 'good',
    });
    // D-108 porte un état mais pas de date de pose : aucune ligne de pose.
    expect(commands.filter(c => c.table === 'installed_support')).toHaveLength(1);
    expect(commands[3]?.after).toEqual({ width_mm: 600, height_mm: 900, dimensions_source: 'overridden' });
  });
});
