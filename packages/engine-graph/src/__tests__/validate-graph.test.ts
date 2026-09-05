import { describe, it, expect } from 'vitest';
import { validateGraph } from '../validate-graph.js';
import {
  refMinimal,
  refBroken,
  refAdversarial,
} from '@azimut/testkit';
import type { SiteData, Finding, NodeKind } from '@azimut/core-model';

function findingsWithCode(
  findings: readonly Finding[],
  code: string,
): Finding[] {
  return findings.filter((f) => f.code === code);
}

function makeSite(patch: Partial<SiteData>): SiteData {
  return { ...refMinimal, ...patch };
}

function mkNode(id: string, kind: NodeKind) {
  return { id, org_id: 'org-test-001', level_id: 'lvl-001', kind, position: { x_m: 0, y_m: 0 }, label: id };
}

function mkEdge(id: string, from: string, to: string, len = 5) {
  return { id, org_id: 'org-test-001', from_node_id: from, to_node_id: to, width_m: 1.5, slope_pct: 0, accessible: true, direction: 'both' as const, evacuation_route: false, length_m: len };
}

describe('validateGraph', () => {
  describe('refMinimal passes validation', () => {
    it('returns ok with no blocking findings', () => {
      const result = validateGraph(refMinimal);
      expect(result.ok).toBe(true);
    });
  });

  describe('refAdversarial passes validation', () => {
    it('returns ok (equal-cost paths, degenerate geometry)', () => {
      const result = validateGraph(refAdversarial);
      expect(result.ok).toBe(true);
    });
  });

  describe('refBroken finding codes', () => {
    const brokenResult = validateGraph(refBroken);

    it.each([
      ['GRAPH.EDGE_SELF_LOOP', 'e-brk-zero-length'],
      ['GRAPH.NODE_ORPHAN', 'n-brk-orphan'],
      ['GRAPH.DESTINATION_UNREACHABLE', 'dest-brk-unreachable'],
      ['GRAPH.VERTICAL_LINK_MISSING', 'e-brk-cross-level'],
      ['GRAPH.DEAD_END_UNJUSTIFIED', 'n-brk-deadend'],
      ['GRAPH.LEVEL_NO_ACCESSIBLE_LINK', 'bldg-brk-001'],
    ] as const)('detects %s on entity %s', (code, entityId) => {
      expect(brokenResult.ok).toBe(false);
      if (brokenResult.ok) return;
      const hits = findingsWithCode(brokenResult.findings, code);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0]?.entity?.id).toBe(entityId);
    });

    it('detects GRAPH.DISCONNECTED', () => {
      expect(brokenResult.ok).toBe(false);
      if (brokenResult.ok) return;
      expect(findingsWithCode(brokenResult.findings, 'GRAPH.DISCONNECTED').length).toBeGreaterThan(0);
    });

    it('detects GRAPH.ZONE_UNREACHABLE for island nodes', () => {
      expect(brokenResult.ok).toBe(false);
      if (brokenResult.ok) return;
      const ids = findingsWithCode(brokenResult.findings, 'GRAPH.ZONE_UNREACHABLE').map((f) => f.entity?.id);
      expect(ids).toContain('n-brk-island-a');
      expect(ids).toContain('n-brk-island-b');
    });
  });

  describe('refMinimal negative checks', () => {
    it.each([
      'GRAPH.EDGE_SELF_LOOP',
      'GRAPH.NODE_ORPHAN',
      'GRAPH.DISCONNECTED',
      'GRAPH.ZONE_UNREACHABLE',
      'GRAPH.DESTINATION_UNREACHABLE',
      'GRAPH.VERTICAL_LINK_MISSING',
      'GRAPH.DEAD_END_UNJUSTIFIED',
      'GRAPH.LEVEL_NO_ACCESSIBLE_LINK',
    ] as const)('%s not triggered on refMinimal', (code) => {
      const result = validateGraph(refMinimal);
      if (result.ok) {
        expect(findingsWithCode(result.warnings, code)).toHaveLength(0);
      }
    });
  });

  describe('GRAPH.NO_ENTRANCE', () => {
    it('detects site with no entrance', () => {
      const noEntrance = makeSite({
        graph: {
          nodes: [mkNode('n-1', 'junction'), mkNode('n-2', 'junction')],
          edges: [mkEdge('e-1', 'n-1', 'n-2', 10)],
          vertical_links: [],
        },
        destinations: [], destination_names: [],
      });
      const result = validateGraph(noEntrance);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(findingsWithCode(result.findings, 'GRAPH.NO_ENTRANCE')).toHaveLength(1);
      }
    });
  });

  describe('GRAPH.DESTINATION_NAME_MISSING', () => {
    it('detects destination missing a language', () => {
      const missingLang = makeSite({
        destination_names: refMinimal.destination_names.filter(
          (dn: { destination_id: string; lang: string }) =>
            !(
              dn.destination_id === 'dest-a' && dn.lang === 'en'
            ),
        ),
      });
      const result = validateGraph(missingLang);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const missing = findingsWithCode(
          result.warnings,
          'GRAPH.DESTINATION_NAME_MISSING',
        );
        expect(missing.length).toBeGreaterThan(0);
        expect(missing[0]?.entity?.id).toBe('dest-a');
        expect(missing[0]?.params['lang']).toBe('en');
      }
    });

    it('not triggered when all names present', () => {
      const result = validateGraph(refMinimal);
      if (result.ok) {
        expect(
          findingsWithCode(
            result.warnings,
            'GRAPH.DESTINATION_NAME_MISSING',
          ),
        ).toHaveLength(0);
      }
    });

    it('destination with zero names gets flagged for all active languages', () => {
      const noNames = makeSite({
        destination_names: refMinimal.destination_names.filter(
          (dn: { destination_id: string }) => dn.destination_id !== 'dest-a',
        ),
      });
      const result = validateGraph(noNames);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const missing = findingsWithCode(result.warnings, 'GRAPH.DESTINATION_NAME_MISSING')
        .filter((f) => f.entity?.id === 'dest-a');
      expect(missing.length).toBe(2); // one for 'fr', one for 'en'
    });
  });

  describe('GRAPH.EDGE_ZERO_LENGTH', () => {
    it('detects zero-length non-self-loop edge', () => {
      const zeroLength = makeSite({
        graph: {
          ...refMinimal.graph,
          edges: [
            ...refMinimal.graph.edges,
            {
              id: 'e-zero',
              org_id: 'org-test-001',
              from_node_id: 'n-entrance',
              to_node_id: 'n-junction',
              width_m: 1.5,
              slope_pct: 0,
              accessible: true,
              direction: 'both',
              evacuation_route: false,
              length_m: 0,
            },
          ],
        },
      });
      const result = validateGraph(zeroLength);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const zero = findingsWithCode(
          result.findings,
          'GRAPH.EDGE_ZERO_LENGTH',
        );
        expect(zero.length).toBeGreaterThan(0);
        expect(zero[0]?.entity?.id).toBe('e-zero');
      }
    });

    it('detects negative-length edge', () => {
      const negativeLength = makeSite({
        graph: {
          ...refMinimal.graph,
          edges: [
            ...refMinimal.graph.edges,
            {
              id: 'e-negative',
              org_id: 'org-test-001',
              from_node_id: 'n-entrance',
              to_node_id: 'n-junction',
              width_m: 1.5,
              slope_pct: 0,
              accessible: true,
              direction: 'both',
              evacuation_route: false,
              length_m: -3.5,
            },
          ],
        },
      });
      const result = validateGraph(negativeLength);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const neg = findingsWithCode(
          result.findings,
          'GRAPH.EDGE_ZERO_LENGTH',
        );
        expect(neg.length).toBeGreaterThan(0);
        expect(neg[0]?.entity?.id).toBe('e-negative');
      }
    });
  });

  it('emergency_exit at dead end is justified', () => {
    const site = makeSite({
      graph: {
        nodes: [mkNode('n-entrance', 'entrance'), mkNode('n-j', 'junction'), mkNode('n-exit', 'emergency_exit')],
        edges: [mkEdge('e-1', 'n-entrance', 'n-j'), mkEdge('e-2', 'n-j', 'n-exit')],
        vertical_links: [],
      },
      destinations: [], destination_names: [],
    });
    const result = validateGraph(site);
    if (result.ok) {
      expect(findingsWithCode(result.warnings, 'GRAPH.DEAD_END_UNJUSTIFIED')).toHaveLength(0);
    } else {
      expect(findingsWithCode(result.findings, 'GRAPH.DEAD_END_UNJUSTIFIED')).toHaveLength(0);
    }
  });

  it('self-loop edge excluded from EDGE_ZERO_LENGTH', () => {
    // refBroken has e-brk-zero-length which is a self-loop with length 0
    const result = validateGraph(refBroken);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const zeroLen = findingsWithCode(result.findings, 'GRAPH.EDGE_ZERO_LENGTH');
      const selfLoopZero = zeroLen.filter((f) => f.entity?.id === 'e-brk-zero-length');
      expect(selfLoopZero).toHaveLength(0);
    }
  });

  it('self-loop does not inflate degree for dead-end check', () => {
    const site = makeSite({
      graph: {
        nodes: [mkNode('n-entrance', 'entrance'), mkNode('n-j', 'junction')],
        edges: [mkEdge('e-real', 'n-entrance', 'n-j'), mkEdge('e-self', 'n-j', 'n-j', 0)],
        vertical_links: [],
      },
      destinations: [], destination_names: [],
    });
    const result = validateGraph(site);
    // n-j has 1 real edge + 1 self-loop → degree should be 1, flagged as dead end
    const findings = result.ok ? result.warnings : result.findings;
    const deadEnds = findingsWithCode(findings, 'GRAPH.DEAD_END_UNJUSTIFIED');
    expect(deadEnds.some((f) => f.entity?.id === 'n-j')).toBe(true);
  });

  it('destination_access at dead end is justified', () => {
    const site = makeSite({
      graph: {
        nodes: [mkNode('n-entrance', 'entrance'), mkNode('n-j', 'junction'), mkNode('n-da', 'destination_access')],
        edges: [mkEdge('e-1', 'n-entrance', 'n-j'), mkEdge('e-2', 'n-j', 'n-da')],
        vertical_links: [],
      },
      destinations: [], destination_names: [],
    });
    const result = validateGraph(site);
    const findings = result.ok ? result.warnings : result.findings;
    expect(findingsWithCode(findings, 'GRAPH.DEAD_END_UNJUSTIFIED').some((f) => f.entity?.id === 'n-da')).toBe(false);
  });

  describe('determinism (INV-4)', () => {
    it('produces identical findings on two runs', () => {
      const r1 = validateGraph(refBroken);
      const r2 = validateGraph(refBroken);
      expect(r1).toStrictEqual(r2);
    });
  });

  describe('empty graph', () => {
    it('handles site with no nodes and no edges', () => {
      const empty = makeSite({
        graph: { nodes: [], edges: [], vertical_links: [] },
        destinations: [],
        destination_names: [],
      });
      const result = validateGraph(empty);
      expect(result.ok).toBe(true);
    });
  });
});
