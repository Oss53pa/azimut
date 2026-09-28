import { describe, it, expect } from 'vitest';
import {
  auditCoverage,
} from '../audit.js';
import type { Support } from '../audit.js';
import {
  refMinimal,
  refBroken,
  refMultilevel,
} from '@azimut/testkit';
import type { SiteData } from '@azimut/core-model';
import { getProfile, stdProfile } from './audit-fixtures.js';

describe('auditCoverage', () => {
  it('refuses when validateGraph fails', () => {
    const result = auditCoverage(
      refBroken,
      getProfile(refBroken.travel_profiles, 0),
      [],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.findings[0]?.code).toBe(
        'GRAPH.NOT_VALIDATED',
      );
    }
  });

  it('computes coverage on valid site', () => {
    const supports: Support[] = [
      { id: 'sup-1', node_id: 'n-junction' },
    ];
    const result = auditCoverage(refMinimal, stdProfile, supports);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.total_decision_points).toBe(1);
      expect(result.value.covered_decision_points).toBe(1);
      expect(result.value.coverage_ratio).toBe(1);
      expect(result.value.uncovered_points).toHaveLength(0);
      expect(result.value.unused_supports).toHaveLength(0);
      expect(Array.isArray(result.warnings)).toBe(true);
    }
  });

  it('reports uncovered decision points', () => {
    const result = auditCoverage(refMinimal, stdProfile, []);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.uncovered_points).toContain('n-junction');
      expect(result.value.coverage_ratio).toBe(0);
    }
  });

  it('reports unused supports', () => {
    const supports: Support[] = [
      { id: 'sup-1', node_id: 'n-junction' },
      { id: 'sup-orphan', node_id: 'n-entrance' },
    ];
    const result = auditCoverage(refMinimal, stdProfile, supports);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.unused_supports).toContain('sup-orphan');
    }
  });

  it('fractional coverage_ratio when only some DPs are covered', () => {
    const p = refMultilevel.travel_profiles[0];
    if (!p) throw new Error('No profile in refMultilevel');
    const mlProfile = p;
    // Cover only n-ml-hall, leave n-ml-hall-r1 uncovered.
    const supports: Support[] = [
      { id: 'sup-hall', node_id: 'n-ml-hall' },
    ];
    const result = auditCoverage(refMultilevel, mlProfile, supports);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total_decision_points).toBeGreaterThanOrEqual(2);
    expect(result.value.covered_decision_points).toBe(1);
    expect(result.value.coverage_ratio).toBeGreaterThan(0);
    expect(result.value.coverage_ratio).toBeLessThan(1);
    expect(result.value.uncovered_points).toContain('n-ml-hall-r1');
  });

  it('deterministic results (INV-4)', () => {
    const supports: Support[] = [
      { id: 'sup-1', node_id: 'n-junction' },
    ];
    const r1 = auditCoverage(refMinimal, stdProfile, supports);
    const r2 = auditCoverage(refMinimal, stdProfile, supports);
    expect(r1).toStrictEqual(r2);
  });

});

describe('auditCoverage — anomalies nommées (N2.4)', () => {
  it('lève GRAPH.DECISION_POINT_UNCOVERED, bloquant, par point non couvert', () => {
    const result = auditCoverage(refMinimal, stdProfile, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const uncovered = result.value.findings.filter(
      f => f.code === 'GRAPH.DECISION_POINT_UNCOVERED',
    );
    expect(uncovered).toHaveLength(result.value.uncovered_points.length);
    expect(uncovered.map(f => f.entity?.id)).toEqual([...result.value.uncovered_points]);
    for (const finding of uncovered) {
      expect(finding.severity).toBe('blocking');
      expect(finding.entity?.kind).toBe('node');
      expect(finding.ruleRef).toBe('N2.4');
      expect(finding.params['profile_id']).toBe(stdProfile.id);
    }
  });

  it('lève GRAPH.SUPPORT_UNUSED, avertissement, par support hors parcours', () => {
    const supports: Support[] = [
      { id: 'sup-1', node_id: 'n-junction' },
      { id: 'sup-orphan', node_id: 'n-entrance' },
    ];
    const result = auditCoverage(refMinimal, stdProfile, supports);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const unused = result.value.findings.filter(f => f.code === 'GRAPH.SUPPORT_UNUSED');
    expect(unused).toHaveLength(1);
    expect(unused[0]?.severity).toBe('warning');
    expect(unused[0]?.entity).toEqual({ kind: 'support', id: 'sup-orphan' });
    expect(unused[0]?.ruleRef).toBe('N2.4');
  });

  it('ne lève rien quand chaque point est couvert et chaque support sert', () => {
    const supports: Support[] = [{ id: 'sup-1', node_id: 'n-junction' }];
    const result = auditCoverage(refMinimal, stdProfile, supports);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.findings).toEqual([]);
  });

  it('compte exactement, ni plus ni moins, sur un site partiellement couvert', () => {
    const profile = refMultilevel.travel_profiles[0];
    if (profile === undefined) throw new Error('No profile in refMultilevel');
    const supports: Support[] = [
      { id: 'sup-hall', node_id: 'n-ml-hall' },
      { id: 'sup-ailleurs', node_id: 'n-ml-entrance' },
    ];
    const result = auditCoverage(refMultilevel, profile, supports);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const byCode = (code: string): number =>
      result.value.findings.filter(f => f.code === code).length;

    expect(byCode('GRAPH.DECISION_POINT_UNCOVERED'))
      .toBe(result.value.uncovered_points.length);
    expect(byCode('GRAPH.SUPPORT_UNUSED'))
      .toBe(result.value.unused_supports.length);
    expect(result.value.findings).toHaveLength(
      result.value.uncovered_points.length + result.value.unused_supports.length,
    );

    // Comptes figés : sans eux, deux zéros feraient passer le test à vide.
    expect(byCode('GRAPH.DECISION_POINT_UNCOVERED')).toBe(5);
    expect(byCode('GRAPH.SUPPORT_UNUSED')).toBe(1);

    // Les points non couverts précèdent les supports inutilisés.
    expect(result.value.findings.map(f => f.code)).toEqual([
      'GRAPH.DECISION_POINT_UNCOVERED',
      'GRAPH.DECISION_POINT_UNCOVERED',
      'GRAPH.DECISION_POINT_UNCOVERED',
      'GRAPH.DECISION_POINT_UNCOVERED',
      'GRAPH.DECISION_POINT_UNCOVERED',
      'GRAPH.SUPPORT_UNUSED',
    ]);
  });

  it('rend les anomalies dans un ordre stable (INV-4)', () => {
    const supports: Support[] = [
      { id: 'sup-z', node_id: 'n-entrance' },
      { id: 'sup-a', node_id: 'n-entrance' },
    ];
    const first = auditCoverage(refMinimal, stdProfile, supports);
    const second = auditCoverage(refMinimal, stdProfile, supports);
    expect(first).toStrictEqual(second);
    if (!first.ok) return;
    const ids = first.value.findings
      .filter(f => f.code === 'GRAPH.SUPPORT_UNUSED')
      .map(f => f.entity?.id);
    expect(ids).toEqual(['sup-a', 'sup-z']);
  });

  it('M02.W10 — aucun rapport, donc aucun taux, tant que le graphe ne valide pas', () => {
    const profile = refBroken.travel_profiles[0];
    if (profile === undefined) throw new Error('No profile in refBroken');
    const result = auditCoverage(refBroken, profile, [
      { id: 'sup-1', node_id: 'n-broken-a' },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('GRAPH.NOT_VALIDATED');
    // Le refus ne laisse passer ni taux ni anomalie de couverture : le rapport
    // n'existe pas, il n'est pas rendu partiellement.
    expect(result.findings.map(f => f.code)).not.toContain('GRAPH.DECISION_POINT_UNCOVERED');
  });
});

describe('auditCoverage — zero decision points', () => {
  it('coverage_ratio is 1 when total is 0', () => {
    // Build a linear graph: two nodes with one edge → max out-degree 1 → no DPs.
    const linearSite: SiteData = {
      ...refMinimal,
      destinations: [],
      graph: {
        ...refMinimal.graph,
        nodes: [
          {
            id: 'n-a',
            org_id: 'org-test-001',
            level_id: 'lvl-gf',
            kind: 'entrance' as const,
            position: { x_m: 0, y_m: 0 },
            label: 'A',
          },
          {
            id: 'n-b',
            org_id: 'org-test-001',
            level_id: 'lvl-gf',
            kind: 'junction' as const,
            position: { x_m: 5, y_m: 0 },
            label: 'B',
          },
        ],
        edges: [
          {
            id: 'e-ab',
            org_id: 'org-test-001',
            from_node_id: 'n-a',
            to_node_id: 'n-b',
            direction: 'both' as const,
            accessible: true,
            evacuation_route: true,
            length_m: 5,
            width_m: 1.5,
            slope_pct: 0,
          },
        ],
        vertical_links: [],
        building_links: [],
      },
    };
    const result = auditCoverage(linearSite, stdProfile, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total_decision_points).toBe(0);
    expect(result.value.coverage_ratio).toBe(1);
    expect(result.value.uncovered_points).toHaveLength(0);
  });
});
