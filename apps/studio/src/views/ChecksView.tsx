import { type JSX, useMemo } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import { runChecks, validateGraph, validateDirectory, validateGeometry } from '@azimut/engine-graph';
import { getErrorMessage } from '@azimut/core-model';
import type { Finding, ErrorCode } from '@azimut/core-model';

function collectFindings(result: { ok: boolean; warnings?: Finding[]; findings?: Finding[] }): Finding[] {
  if (result.ok && 'warnings' in result) return result.warnings as Finding[];
  if (!result.ok && 'findings' in result) return result.findings as Finding[];
  return [];
}

export function ChecksView(): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();

  const report = useMemo(() => {
    const checkResult = runChecks(site);
    const graphResult = validateGraph(site);
    const dirResult = validateDirectory(site);
    const geomResult = validateGeometry(site);

    const allFindings: Finding[] = [];
    if (checkResult.ok) allFindings.push(...checkResult.value.findings);
    allFindings.push(...collectFindings(graphResult));
    allFindings.push(...collectFindings(dirResult));
    allFindings.push(...collectFindings(geomResult));

    const checksRun = checkResult.ok ? checkResult.value.checks_run : [];
    const checksSkipped = checkResult.ok ? checkResult.value.checks_skipped : [];

    return { findings: allFindings, checksRun, checksSkipped };
  }, [site]);

  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: 22, color: 'var(--text-primary)' }}>
        {t('checks.title')}
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
        {t('checks.summary', {
          run: report.checksRun.length,
          skipped: report.checksSkipped.length,
        })}
      </p>

      {report.checksSkipped.length > 0 && (
        <div style={{
          marginBottom: 16,
          padding: '8px 12px',
          borderRadius: 6,
          border: '1px solid var(--border-hairline)',
          background: 'var(--surface-panel)',
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}>
          {t('checks.skipped', { list: report.checksSkipped.join(', ') })}
        </div>
      )}

      {report.findings.length === 0 ? (
        <div style={{
          padding: 32,
          borderRadius: 4,
          border: '2px dashed var(--border-hairline)',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: 13,
        }}>
          {t('checks.empty')}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-hairline)' }}>
                <Th>{t('checks.col.severity')}</Th>
                <Th>{t('checks.col.code')}</Th>
                <Th>{t('checks.col.entity')}</Th>
                <Th>{t('checks.col.message')}</Th>
                <Th>{t('checks.col.details')}</Th>
              </tr>
            </thead>
            <tbody>
              {report.findings.map((f, i) => (
                <tr key={`${f.code}-${i}`} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <SeverityBadge severity={f.severity} label={t(severityKey(f.severity))} />
                  </td>
                  <td style={{
                    padding: '8px 12px',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    color: 'var(--text-primary)',
                  }}>
                    {f.code}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 12 }}>
                    {f.entity ? `${f.entity.kind}:${f.entity.id}` : '—'}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontSize: 12 }}>
                    {getErrorMessage(f.code as ErrorCode, lang) ?? f.code}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 12 }}>
                    {formatParams(f.params)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { readonly children: string }): JSX.Element {
  return (
    <th style={{
      textAlign: 'left',
      padding: '8px 12px',
      fontWeight: 500,
      color: 'var(--text-secondary)',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}>
      {children}
    </th>
  );
}

type SeverityKey =
  | 'severity.blocking'
  | 'severity.warning'
  | 'severity.info';

function severityKey(severity: string): SeverityKey {
  switch (severity) {
    case 'blocking': return 'severity.blocking';
    case 'warning': return 'severity.warning';
    default: return 'severity.info';
  }
}

function SeverityBadge(
  { severity, label }: { readonly severity: string; readonly label: string },
): JSX.Element {
  return (
    <span
      title={severity}
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        background: 'var(--surface-sunken)',
        color: 'var(--accent)',
      }}
    >
      {label}
    </span>
  );
}

function formatParams(params: Record<string, unknown>): string {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(', ');
}
