import { type JSX, useMemo } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { runChecks, validateGraph, validateDirectory } from '@azimut/engine-graph';
import type { Finding } from '@azimut/core-model';

function collectFindings(result: { ok: boolean; warnings?: Finding[]; findings?: Finding[] }): Finding[] {
  if (result.ok && 'warnings' in result) return result.warnings as Finding[];
  if (!result.ok && 'findings' in result) return result.findings as Finding[];
  return [];
}

export function ChecksView(): JSX.Element {
  const site = useSiteData();

  const report = useMemo(() => {
    const checkResult = runChecks(site);
    const graphResult = validateGraph(site);
    const dirResult = validateDirectory(site);

    const allFindings: Finding[] = [];
    if (checkResult.ok) allFindings.push(...checkResult.value.findings);
    allFindings.push(...collectFindings(graphResult));
    allFindings.push(...collectFindings(dirResult));

    const checksRun = checkResult.ok ? checkResult.value.checks_run : [];
    const checksSkipped = checkResult.ok ? checkResult.value.checks_skipped : [];

    return { findings: allFindings, checksRun, checksSkipped };
  }, [site]);

  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: 22, color: 'var(--az-text-primary)' }}>
        Controles qualite
      </h1>
      <p style={{ color: 'var(--az-text-secondary)', fontSize: 13, marginBottom: 16 }}>
        {report.checksRun.length} controle{report.checksRun.length !== 1 ? 's' : ''} execute{report.checksRun.length !== 1 ? 's' : ''},
        {' '}{report.checksSkipped.length} ignore{report.checksSkipped.length !== 1 ? 's' : ''}
        {' '}(valeurs normatives manquantes)
      </p>

      {report.checksSkipped.length > 0 && (
        <div style={{
          marginBottom: 16,
          padding: '8px 12px',
          borderRadius: 6,
          border: '1px solid var(--az-border)',
          background: 'var(--az-card-bg)',
          fontSize: 12,
          color: 'var(--az-text-secondary)',
        }}>
          Ignores : {report.checksSkipped.join(', ')}
        </div>
      )}

      {report.findings.length === 0 ? (
        <div style={{
          padding: 32,
          borderRadius: 8,
          border: '2px dashed var(--az-border)',
          textAlign: 'center',
          color: 'var(--az-text-secondary)',
          fontSize: 14,
        }}>
          Aucune alerte detectee.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--az-border)' }}>
                <Th>Severite</Th>
                <Th>Code</Th>
                <Th>Entite</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody>
              {report.findings.map((f, i) => (
                <tr key={`${f.code}-${i}`} style={{ borderBottom: '1px solid var(--az-border)' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <SeverityBadge severity={f.severity} />
                  </td>
                  <td style={{
                    padding: '8px 12px',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    color: 'var(--az-text-primary)',
                  }}>
                    {f.code}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--az-text-secondary)', fontSize: 12 }}>
                    {f.entity ? `${f.entity.kind}:${f.entity.id}` : '—'}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--az-text-primary)', fontSize: 12 }}>
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
      fontWeight: 600,
      color: 'var(--az-text-secondary)',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}>
      {children}
    </th>
  );
}

function SeverityBadge({ severity }: { readonly severity: string }): JSX.Element {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      background: 'var(--az-active-bg)',
      color: 'var(--az-active-text)',
    }}>
      {severity}
    </span>
  );
}

function formatParams(params: Record<string, unknown>): string {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(', ');
}
