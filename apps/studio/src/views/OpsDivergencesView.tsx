import { type JSX, useMemo, useState } from 'react';
import type { ReconciliationLine } from '@azimut/engine-graph';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import type { UiMessageKey } from '../i18n/messages.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag, StateBanner,
  type Column, type RegisterFilter,
} from '../components/ui/index.js';
import { divergenceReport } from './operations/divergence.js';
import { siteLabels } from './register/labels.js';
import { RecordedDivergencesPanel } from './operations/RecordedDivergencesPanel.js';

const ALL = 'all';

type Issue = ReconciliationLine['issue'];

const ISSUE_KEYS: Readonly<Record<Issue, UiMessageKey>> = {
  superfluous: 'opsdiv.issue.superfluous',
  uncovered: 'opsdiv.issue.uncovered',
  wrong_orientation: 'opsdiv.issue.orientation',
  undersized: 'opsdiv.issue.undersized',
};

const EXPLAIN_KEYS: Readonly<Record<Issue, UiMessageKey>> = {
  superfluous: 'opsdiv.explain.superfluous',
  uncovered: 'opsdiv.explain.uncovered',
  wrong_orientation: 'opsdiv.explain.orientation',
  undersized: 'opsdiv.explain.undersized',
};

/**
 * Module 08 — les divergences entre le parc et la conception, au gabarit
 * « registre ». Elles viennent du moteur de rapprochement (`reconcile`) sur
 * les données du site : un support posé hors de tout point de décision, un
 * point de décision sans support. Ce ne sont pas des données de démonstration.
 */
type OpsDivergencesViewProps = {
  /** Clé du site dans le dépôt, celle dont la coquille l'a chargé. */
  readonly siteKey: string;
};

export function OpsDivergencesView({ siteKey }: OpsDivergencesViewProps): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();
  const labels = useMemo(() => siteLabels(site, lang), [site, lang]);
  const profile = site.travel_profiles[0];
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const report = useMemo(
    () => (profile === undefined ? null : divergenceReport(site, profile)),
    [site, profile],
  );
  const supports = useMemo(() => new Map(site.supports.map(s => [s.id, s])), [site]);

  if (profile === undefined || report === null) {
    return <StateBanner severity="warning" message={t('operations.divergence.unavailable')} />;
  }

  const lineId = (l: ReconciliationLine): string => `${l.issue}:${l.entity_id}`;
  const nodeOf = (l: ReconciliationLine): string =>
    l.entity_kind === 'node' ? l.entity_id : (supports.get(l.entity_id)?.node_id ?? '');
  const entityLabel = (l: ReconciliationLine): string =>
    l.entity_kind === 'node' ? labels.node(l.entity_id) : (supports.get(l.entity_id)?.code ?? l.entity_id);
  const levelOf = (l: ReconciliationLine): string => {
    const level = labels.nodeLevel(nodeOf(l));
    return level === null ? '—' : labels.level(level);
  };

  const rows = report.lines;
  const visible = filter === ALL ? rows : rows.filter(l => l.issue === filter);
  const selected = rows.find(l => lineId(l) === selectedId) ?? visible[0] ?? null;
  const issues = [...new Set(rows.map(l => l.issue))];

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('opsdiv.filter.all') },
    ...issues.map(i => ({ id: i, label: t(ISSUE_KEYS[i]) })),
  ];

  const columns: readonly Column<ReconciliationLine>[] = [
    { id: 'entity', header: t('opsdiv.col.entity'), cell: entityLabel },
    { id: 'kind', header: t('opsdiv.col.kind'), cell: l => t(l.entity_kind === 'node' ? 'opsdiv.kind.point' : 'opsdiv.kind.support') },
    { id: 'level', header: t('placement.col.level'), cell: levelOf },
    { id: 'node', header: t('placement.col.node'), cell: l => labels.node(nodeOf(l)) },
    {
      id: 'issue',
      header: t('opsdiv.col.issue'),
      cell: l => <Tag label={t(ISSUE_KEYS[l.issue])} severity={l.issue === 'uncovered' ? 'blocking' : 'warning'} />,
    },
  ];

  const inspector = selected === null
    ? <InspectorEmpty text={t('opsdiv.inspector.empty')} />
    : (
      <Inspector
        title={entityLabel(selected)}
        subtitle={t(ISSUE_KEYS[selected.issue])}
        sections={[
          {
            id: 'where',
            title: t('opsdiv.section.where'),
            rows: [
              { id: 'kind', label: t('opsdiv.col.kind'), value: t(selected.entity_kind === 'node' ? 'opsdiv.kind.point' : 'opsdiv.kind.support') },
              { id: 'level', label: t('placement.col.level'), value: levelOf(selected) },
              { id: 'node', label: t('placement.col.node'), value: labels.node(nodeOf(selected)) },
            ],
            note: t(EXPLAIN_KEYS[selected.issue]),
          },
        ]}
      />
    );

  return (
    <div>
      <RegisterLayout
        title={t('opsdiv.title')}
        summary={t('opsdiv.summary', {
          count: rows.length,
          superfluous: report.superfluous_count,
          uncovered: report.uncovered_count,
        })}
        filtersLabel={t('register.filters')}
        filters={filters}
        filter={filter}
        onFilter={id => { setFilter(id); setSelectedId(null); }}
        shown={t('opsdiv.shown', { count: visible.length })}
        inspector={inspector}
        note={t('opsdiv.note')}
      >
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={lineId}
          empty={t('opsdiv.empty')}
          onSelect={l => { setSelectedId(lineId(l)); }}
          selectedKey={selected === null ? undefined : lineId(selected)}
        />
      </RegisterLayout>
      <RecordedDivergencesPanel siteKey={siteKey} />
    </div>
  );
}
