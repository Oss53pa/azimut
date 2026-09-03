import { describe, it, expect } from 'vitest';
import { createAuditSiteHandler } from '../audit-site.js';
import type { AuditSiteContext } from '../audit-site.js';
import type { Job } from '../job.js';
import { refMinimal, refBroken, refMultilevel } from '@azimut/testkit';

function makeJob(payload?: Record<string, unknown>): Job {
  return {
    id: 'job-audit-001',
    org_id: 'org-test-001',
    kind: 'audit_site',
    state: 'running',
    payload: payload ?? {},
    result: null,
    attempts: 1,
    max_attempts: 3,
    created_at: new Date('2024-06-15T12:00:00Z'),
    started_at: new Date('2024-06-15T12:00:01Z'),
    finished_at: null,
    error: null,
  };
}

describe('createAuditSiteHandler', () => {
  it('returns a clean report for a valid minimal site', async () => {
    const context: AuditSiteContext = { site: refMinimal };
    const handler = createAuditSiteHandler(context);
    const result = await handler(makeJob());

    expect(result['checks_run']).toBeDefined();
    const checksRun = result['checks_run'] as string[];
    expect(checksRun).toContain('validate_graph');
    expect(checksRun).toContain('validate_directory');
    expect(checksRun).toContain('validate_geometry');
    expect(typeof result['total_findings']).toBe('number');
    expect(typeof result['blocking_count']).toBe('number');
    expect(typeof result['warning_count']).toBe('number');
    expect(typeof result['info_count']).toBe('number');
    expect(Array.isArray(result['findings'])).toBe(true);
  });

  it('reports skipped checks from runChecks', async () => {
    const context: AuditSiteContext = { site: refMinimal };
    const handler = createAuditSiteHandler(context);
    const result = await handler(makeJob());

    const skipped = result['checks_skipped'] as string[];
    expect(skipped.length).toBeGreaterThan(0);
    // These checks require normative values, so they're skipped
    expect(skipped).toContain('contraste');
  });

  it('detects issues in a broken site', async () => {
    const context: AuditSiteContext = { site: refBroken };
    const handler = createAuditSiteHandler(context);
    const result = await handler(makeJob());

    const blockingCount = result['blocking_count'] as number;
    expect(blockingCount).toBeGreaterThan(0);

    const findings = result['findings'] as Array<{ code: string }>;
    const codes = findings.map((f) => f.code);
    // refBroken has multi-level building with no vertical links
    expect(codes).toContain('GRAPH.LEVEL_NO_VERTICAL_LINK');
  });

  it('works with multilevel site', async () => {
    const context: AuditSiteContext = { site: refMultilevel };
    const handler = createAuditSiteHandler(context);
    const result = await handler(makeJob());

    expect(result['checks_run']).toBeDefined();
    expect(typeof result['total_findings']).toBe('number');
  });

  it('findings are sorted deterministically by code then entity id', async () => {
    const context: AuditSiteContext = { site: refBroken };
    const handler = createAuditSiteHandler(context);
    const result = await handler(makeJob());

    const findings = result['findings'] as Array<{
      code: string;
      entity: { id: string } | null;
    }>;
    if (findings.length < 2) return;

    for (let i = 1; i < findings.length; i++) {
      const prev = findings[i - 1];
      const curr = findings[i];
      if (!prev || !curr) continue;
      const codeCmp = prev.code.localeCompare(curr.code);
      if (codeCmp > 0) {
        expect.fail(`findings not sorted by code: ${prev.code} > ${curr.code}`);
      }
      if (codeCmp === 0) {
        const prevId = prev.entity?.id ?? '';
        const currId = curr.entity?.id ?? '';
        expect(prevId.localeCompare(currId)).toBeLessThanOrEqual(0);
      }
    }
  });

  it('counts match total', async () => {
    const context: AuditSiteContext = { site: refBroken };
    const handler = createAuditSiteHandler(context);
    const result = await handler(makeJob());

    const total = result['total_findings'] as number;
    const blocking = result['blocking_count'] as number;
    const warning = result['warning_count'] as number;
    const info = result['info_count'] as number;
    expect(blocking + warning + info).toBe(total);
  });

  it('is deterministic (INV-4)', async () => {
    const context: AuditSiteContext = { site: refBroken };
    const handler = createAuditSiteHandler(context);
    const job = makeJob();

    const r1 = await handler(job);
    const r2 = await handler(job);
    expect(r1).toStrictEqual(r2);
  });

  it('ignores job payload — audit needs only site context', async () => {
    const context: AuditSiteContext = { site: refMinimal };
    const handler = createAuditSiteHandler(context);

    const r1 = await handler(makeJob({}));
    const r2 = await handler(makeJob({ extra: 'ignored' }));
    expect(r1).toStrictEqual(r2);
  });
});
