import { type JSX, useMemo, useState } from 'react';
import { allReferenceSites } from '@azimut/testkit/sites';
import { runChecks, validateGraph, validateGeometry, validateDirectory } from '@azimut/engine-graph';
import type { SiteData, Finding } from '@azimut/core-model';
import { useI18n } from '../i18n/useI18n.js';
import {
  ScreenHeader, Panel, DataTable, Tag, Note, StateBanner,
  SPACE, TEXT, type Column,
} from '../components/ui/index.js';

type SitesViewProps = {
  readonly currentKey: string;
  readonly onOpenSite: (key: string) => void;
};

type SiteRow = {
  readonly key: string;
  readonly site: SiteData;
  readonly levels: number;
  readonly cells: number;
  readonly blocking: number;
  readonly warnings: number;
};

function findingsOf(result: { ok: boolean; warnings?: Finding[]; findings?: Finding[] }): readonly Finding[] {
  if (result.ok) return result.warnings ?? [];
  return result.findings ?? [];
}

/** Toutes les anomalies d'un site, tous contrôles confondus. */
function auditSite(site: SiteData): readonly Finding[] {
  const checks = runChecks(site);
  return [
    ...(checks.ok ? checks.value.findings : checks.findings),
    ...findingsOf(validateGraph(site)),
    ...findingsOf(validateGeometry(site)),
    ...findingsOf(validateDirectory(site)),
  ];
}

/**
 * Module 01 · écran M1 — la liste des sites.
 *
 * Un site contient les plans de niveaux, les empreintes et le graphe de
 * circulation ; tout le reste en est dérivé. Les compteurs affichés sont donc
 * calculés, jamais stockés.
 */
export function SitesView({ currentKey, onOpenSite }: SitesViewProps): JSX.Element {
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  const rows = useMemo<readonly SiteRow[]>(() => {
    const out: SiteRow[] = [];
    for (const [key, site] of allReferenceSites) {
      const findings = auditSite(site);
      out.push({
        key,
        site,
        levels: site.levels.length,
        cells: site.footprints.length,
        blocking: findings.filter(f => f.severity === 'blocking').length,
        warnings: findings.filter(f => f.severity === 'warning').length,
      });
    }
    return out.sort((a, b) => a.site.site.name.localeCompare(b.site.site.name));
  }, []);

  const filtered = rows.filter(row =>
    query.length === 0
    || row.site.site.name.toLowerCase().includes(query.toLowerCase()),
  );

  const columns: readonly Column<SiteRow>[] = [
    {
      id: 'name',
      header: t('sites.col.name'),
      cell: row => (
        <span style={{ fontWeight: row.key === currentKey ? 500 : 400 }}>
          {row.site.site.name}
        </span>
      ),
    },
    { id: 'org', header: t('sites.col.organization'), cell: row => row.site.organization.name },
    { id: 'country', header: t('sites.col.country'), cell: row => row.site.site.country_code },
    { id: 'levels', header: t('sites.col.levels'), numeric: true, cell: row => String(row.levels) },
    { id: 'cells', header: t('sites.col.cells'), numeric: true, cell: row => String(row.cells) },
    {
      id: 'blocking',
      header: t('sites.col.blocking'),
      numeric: true,
      cell: row => (
        <Tag
          label={String(row.blocking)}
          severity={row.blocking > 0 ? 'blocking' : 'valid'}
        />
      ),
    },
    {
      id: 'warnings',
      header: t('sites.col.warnings'),
      numeric: true,
      cell: row => String(row.warnings),
    },
    {
      id: 'pack',
      header: t('sites.col.rulespack'),
      cell: row => row.site.site.rules_pack_id ?? t('sites.pack.none'),
    },
    {
      id: 'open',
      header: t('sites.col.action'),
      cell: row => (
        <button
          type="button"
          onClick={() => { onOpenSite(row.key); }}
          style={{
            border: '1px solid var(--border-interactive)',
            background: 'var(--surface-panel)',
            color: 'var(--text-primary)',
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: TEXT.micro,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          {row.key === currentKey ? t('sites.action.current') : t('sites.action.open')}
        </button>
      ),
    },
  ];

  return (
    <div>
      <ScreenHeader
        eyebrow={t('sites.eyebrow')}
        title={t('sites.title')}
        subtitle={t('sites.subtitle')}
      />

      <div style={{ marginBottom: SPACE.md }}>
        <StateBanner
          severity="info"
          code="RULES.PACK_NOT_BOUND"
          message={t('sites.nopack.message')}
          hint={t('sites.nopack.hint')}
        />
      </div>

      <div style={{ marginBottom: SPACE.sm }}>
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); }}
          aria-label={t('sites.search.label')}
          placeholder={t('sites.search.label')}
          style={{
            border: '1px solid var(--border-interactive)',
            background: 'var(--surface-panel)',
            color: 'var(--text-primary)',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: TEXT.small,
            fontFamily: 'inherit',
            minWidth: 220,
          }}
        />
      </div>

      <Panel title={t('sites.panel.list')} note={t('sites.panel.note', { count: filtered.length })} padded={false}>
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={row => row.key}
          selectedKey={currentKey}
          empty={t('sites.empty')}
        />
      </Panel>

      <Note>{t('sites.note')}</Note>
    </div>
  );
}
