import { type JSX, useMemo, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { auditSurveySync } from '../domain/survey-sync.js';
import { DEMO_OBSERVATIONS, DEMO_ROUNDS, type InspectionRound } from '../domain/demo/production.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag, StateBanner, SPACE,
  type Column, type RegisterFilter,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';
import { natureKey } from './operations/labels.js';
import { formatDay } from './register/format.js';

const ALL = 'all';

/**
 * Module 08 — les tournées d'inspection (H7), au gabarit « registre ». Une
 * tournée relevée hors ligne reste visible tant qu'elle n'est pas
 * réconciliée : le garde `auditSurveySync` la signale. Jeu de démonstration.
 */
export function OpsRoundsView(): JSX.Element {
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const findings = useMemo(() => {
    const result = auditSurveySync(DEMO_ROUNDS.map(r => r.survey));
    return result.ok ? result.warnings : result.findings;
  }, []);
  const rows = [...DEMO_ROUNDS].sort((a, b) => a.survey.id.localeCompare(b.survey.id));
  const visible = filter === ALL ? rows : rows.filter(r => r.survey.sync_state === filter);
  const selected = rows.find(r => r.survey.id === selectedId) ?? visible[0] ?? null;

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('opsrounds.filter.all') },
    { id: 'synced', label: t('operations.sync.synced') },
    { id: 'pending', label: t('operations.sync.pending') },
  ];
  const syncTag = (r: InspectionRound): JSX.Element => (
    <Tag
      label={r.survey.sync_state === 'synced' ? t('operations.sync.synced') : t('operations.sync.pending')}
      severity={r.survey.sync_state === 'synced' ? 'valid' : 'warning'}
    />
  );

  const columns: readonly Column<InspectionRound>[] = [
    { id: 'id', header: t('operations.col.round'), cell: r => r.survey.id },
    { id: 'zone', header: t('operations.col.zone'), cell: r => r.zone },
    { id: 'surveyor', header: t('operations.col.surveyor'), cell: r => r.surveyor ?? '—' },
    { id: 'count', header: t('operations.col.observations'), numeric: true, cell: r => String(r.observation_count) },
    { id: 'sync', header: t('operations.col.sync'), cell: syncTag },
    { id: 'date', header: t('operations.col.surveyed'), cell: r => formatDay(r.surveyed_on ?? undefined, lang) ?? t('operations.round.planned') },
  ];

  const observations = selected === null ? [] : DEMO_OBSERVATIONS.filter(o => o.round_id === selected.survey.id);
  const inspector = selected === null
    ? <InspectorEmpty text={t('opsrounds.inspector.empty')} />
    : (
      <Inspector
        title={selected.survey.id}
        subtitle={t('opsrounds.inspector.subtitle', {
          zone: selected.zone,
          sync: selected.survey.sync_state === 'synced' ? t('operations.sync.synced') : t('operations.sync.pending'),
        })}
        sections={[
          {
            id: 'round',
            title: t('opsrounds.section.round'),
            rows: [
              { id: 'surveyor', label: t('operations.col.surveyor'), value: selected.surveyor ?? '—' },
              { id: 'date', label: t('operations.col.surveyed'), value: formatDay(selected.surveyed_on ?? undefined, lang) ?? t('operations.round.planned') },
              { id: 'count', label: t('operations.col.observations'), value: String(selected.observation_count) },
            ],
          },
          {
            id: 'observations',
            title: t('opsrounds.section.observations'),
            note: t('opsrounds.section.observations.note'),
            rows: observations.map(o => ({ id: o.id, label: o.support_id, value: t(natureKey(o.nature_key)) })),
          },
        ]}
      >
        <section style={{ padding: '12px 16px' }}>
          <FindingList
            findings={findings.filter(f => f.entity?.id === selected.survey.id)}
            empty={t('operations.sync.empty')}
          />
        </section>
      </Inspector>
    );

  return (
    <div>
      <div style={{ marginBottom: SPACE.lg }}>
        <StateBanner severity="info" message={t('demo.dataset.message')} hint={t('demo.dataset.hint')} />
      </div>
      <RegisterLayout
        title={t('operations.panel.rounds')}
        summary={t('opsrounds.summary', { count: rows.length, pending: findings.length })}
        filtersLabel={t('register.filters')}
        filters={filters}
        filter={filter}
        onFilter={id => { setFilter(id); setSelectedId(null); }}
        shown={t('opsrounds.shown', { count: visible.length })}
        inspector={inspector}
        note={t('operations.note')}
      >
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={r => r.survey.id}
          empty={t('operations.rounds.empty')}
          onSelect={r => { setSelectedId(r.survey.id); }}
          selectedKey={selected?.survey.id}
        />
      </RegisterLayout>
    </div>
  );
}
