import { type JSX, useMemo, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { EMPTY_INSPECTION_REGISTRY, type InspectionRound } from '@azimut/core-model';
import { loadInspection, useRegistry } from '../data/index.js';
import { RegistryStatus } from './register/RegistryStatus.js';
import { findingCounts, syncFindings } from './operations/rounds.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag,
  type Column, type RegisterFilter,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';
import { natureKey } from './operations/labels.js';
import { formatDay } from './register/format.js';

const ALL = 'all';

/**
 * Module 08 — les tournées d'inspection (H7), au gabarit « registre ». Une
 * tournée relevée hors ligne reste visible tant qu'elle n'est pas
 * réconciliée : le garde `auditSurveySync` la signale. Lu en base (0044), ou
 * dans le jeu de démonstration du dépôt de référence.
 */
type OpsRoundsViewProps = {
  /** Clé du site dans le dépôt, celle dont la coquille l'a chargé. */
  readonly siteKey: string;
};

export function OpsRoundsView({ siteKey }: OpsRoundsViewProps): JSX.Element {
  const { t, lang } = useI18n();
  const state = useRegistry(loadInspection, EMPTY_INSPECTION_REGISTRY, siteKey);
  const { rounds, findings: observationsAll } = state.registry;
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const findings = useMemo(() => syncFindings(rounds), [rounds]);
  const counts = useMemo(() => findingCounts(observationsAll), [observationsAll]);

  if (state.status !== 'ready') return <RegistryStatus state={state} />;
  const nature = (k: string): string => { const key = natureKey(k); return key === null ? k : t(key); };
  const rows = rounds;
  const visible = filter === ALL ? rows : rows.filter(r => r.sync_state === filter);
  const selected = rows.find(r => r.id === selectedId) ?? visible[0] ?? null;

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('opsrounds.filter.all') },
    { id: 'synced', label: t('operations.sync.synced') },
    { id: 'pending', label: t('operations.sync.pending') },
  ];
  const syncTag = (r: InspectionRound): JSX.Element => (
    <Tag
      label={r.sync_state === 'synced' ? t('operations.sync.synced') : t('operations.sync.pending')}
      severity={r.sync_state === 'synced' ? 'valid' : 'warning'}
    />
  );

  const columns: readonly Column<InspectionRound>[] = [
    { id: 'id', header: t('operations.col.round'), cell: r => r.id },
    { id: 'zone', header: t('operations.col.zone'), cell: r => r.zone_label },
    { id: 'surveyor', header: t('operations.col.surveyor'), cell: r => r.surveyor_id ?? '—' },
    { id: 'count', header: t('operations.col.observations'), numeric: true, cell: r => String(counts.get(r.id) ?? 0) },
    { id: 'sync', header: t('operations.col.sync'), cell: syncTag },
    { id: 'date', header: t('operations.col.surveyed'), cell: r => formatDay(r.surveyed_on ?? undefined, lang) ?? t('operations.round.planned') },
  ];

  const observations = selected === null ? [] : observationsAll.filter(o => o.round_id === selected.id);
  const inspector = selected === null
    ? <InspectorEmpty text={t('opsrounds.inspector.empty')} />
    : (
      <Inspector
        title={selected.id}
        subtitle={t('opsrounds.inspector.subtitle', {
          zone: selected.zone_label,
          sync: selected.sync_state === 'synced' ? t('operations.sync.synced') : t('operations.sync.pending'),
        })}
        sections={[
          {
            id: 'round',
            title: t('opsrounds.section.round'),
            rows: [
              { id: 'surveyor', label: t('operations.col.surveyor'), value: selected.surveyor_id ?? '—' },
              { id: 'date', label: t('operations.col.surveyed'), value: formatDay(selected.surveyed_on ?? undefined, lang) ?? t('operations.round.planned') },
              { id: 'count', label: t('operations.col.observations'), value: String(counts.get(selected.id) ?? 0) },
            ],
          },
          {
            id: 'observations',
            title: t('opsrounds.section.observations'),
            note: t('opsrounds.section.observations.note'),
            rows: observations.map(o => ({ id: o.id, label: o.support_id, value: nature(o.nature_key) })),
          },
        ]}
      >
        <section style={{ padding: '12px 16px' }}>
          <FindingList
            findings={findings.filter(f => f.entity?.id === selected.id)}
            empty={t('operations.sync.empty')}
          />
        </section>
      </Inspector>
    );

  return (
    <div>
      <RegistryStatus state={state} />
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
          rowKey={r => r.id}
          empty={t('operations.rounds.empty')}
          onSelect={r => { setSelectedId(r.id); }}
          selectedKey={selected?.id}
        />
      </RegisterLayout>
    </div>
  );
}
