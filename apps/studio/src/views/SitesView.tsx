import { type JSX, useMemo, useState } from 'react';
import { getErrorMessage } from '@azimut/core-model';
import type { ErrorCode } from '@azimut/core-model';
import { useI18n } from '../i18n/useI18n.js';
import { appRepository, useSiteList, type SiteSummary } from '../data/index.js';
import {
  ScreenHeader, MetricRow, Panel, DataTable, Tag, Note, StateBanner,
  SPACE, TEXT, type Metric, type Column, type ScreenAction,
} from '../components/ui/index.js';

type SitesViewProps = {
  readonly currentKey: string;
  readonly onOpenSite: (key: string) => void;
};

/**
 * Module 01 · écran M1 — la liste des sites.
 *
 * Elle vient du dépôt, quel qu'il soit : les sites de référence quand aucune
 * URL n'est configurée, le dépôt réel sinon. L'écran dit toujours laquelle des
 * deux, parce qu'une liste de sites ne se lit pas de la même façon selon qu'on
 * regarde des cas d'essai ou des sites réels.
 */
export function SitesView({ currentKey, onOpenSite }: SitesViewProps): JSX.Element {
  const { t, lang } = useI18n();
  const repository = useMemo(() => appRepository(), []);
  const { state, reload } = useSiteList(repository);
  const [query, setQuery] = useState('');

  const sites = state.status === 'ready' ? state.value : [];
  const filtered = sites.filter(site =>
    query.length === 0 || site.name.toLowerCase().includes(query.toLowerCase()),
  );

  const bound = sites.filter(site => site.rules_pack_id !== null).length;
  const countries = new Set(sites.map(site => site.country_code));

  const metrics: readonly Metric[] = [
    { id: 'sites', label: t('sites.metric.sites'), value: String(sites.length) },
    { id: 'countries', label: t('sites.metric.countries'), value: String(countries.size) },
    {
      id: 'bound',
      label: t('sites.metric.bound'),
      value: `${String(bound)} / ${String(sites.length)}`,
      severity: bound === sites.length && sites.length > 0 ? 'valid' : 'warning',
    },
  ];

  const actions: readonly ScreenAction[] = [
    { id: 'reload', label: t('sites.action.reload'), onSelect: reload },
  ];

  const columns: readonly Column<SiteSummary>[] = [
    {
      id: 'name',
      header: t('sites.col.name'),
      cell: site => (
        <span style={{ fontWeight: site.id === currentKey ? 500 : 400 }}>{site.name}</span>
      ),
    },
    { id: 'country', header: t('sites.col.country'), cell: site => site.country_code },
    {
      id: 'pack',
      header: t('sites.col.rulespack'),
      cell: site => (
        site.rules_pack_id === null
          ? <Tag label={t('sites.pack.none')} severity="warning" />
          : site.rules_pack_id
      ),
    },
    { id: 'org', header: t('sites.col.organization'), cell: site => site.org_id },
    {
      id: 'open',
      header: t('sites.col.action'),
      cell: site => (
        <button
          type="button"
          onClick={() => { onOpenSite(site.id); }}
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
          {site.id === currentKey ? t('sites.action.current') : t('sites.action.open')}
        </button>
      ),
    },
  ];

  const isReference = repository.kind === 'reference';

  return (
    <div>
      <ScreenHeader
        eyebrow={t('sites.eyebrow')}
        title={t('sites.title')}
        subtitle={t('sites.subtitle')}
        actions={actions}
      />

      <div style={{ display: 'grid', gap: SPACE.sm, marginBottom: SPACE.md }}>
        <StateBanner
          severity={isReference ? 'warning' : 'info'}
          message={t(isReference ? 'sites.source.reference' : 'sites.source.repository')}
          hint={t(isReference ? 'sites.source.reference.hint' : 'sites.source.repository.hint')}
        />
        {state.status === 'loading' && (
          <StateBanner severity="info" message={t('sites.state.loading')} />
        )}
        {state.status === 'failed' && (
          <StateBanner
            severity={state.error.code === 'NET.OFFLINE' ? 'warning' : 'blocking'}
            code={state.error.code}
            message={getErrorMessage(state.error.code as ErrorCode, lang) ?? t('sites.state.failed')}
            hint={state.error.detail}
          />
        )}
      </div>

      <MetricRow metrics={metrics} />

      <div style={{ margin: `${String(SPACE.lg)}px 0 ${String(SPACE.sm)}px` }}>
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

      <Panel
        title={t('sites.panel.list')}
        note={t('sites.panel.note', { count: filtered.length })}
        padded={false}
      >
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={site => site.id}
          selectedKey={currentKey}
          empty={state.status === 'ready' ? t('sites.empty') : t('sites.state.loading')}
        />
      </Panel>

      <div style={{
        marginTop: SPACE.md,
        display: 'flex',
        gap: SPACE.sm,
        alignItems: 'baseline',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: TEXT.micro, color: 'var(--text-secondary)' }}>
          {t('sites.source.origin')}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: TEXT.micro,
          color: 'var(--text-muted)',
          overflowWrap: 'anywhere',
        }}>
          {repository.origin}
        </span>
      </div>

      <Note>{t('sites.note')}</Note>
    </div>
  );
}
