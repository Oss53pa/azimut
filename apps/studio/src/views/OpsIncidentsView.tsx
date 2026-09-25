import { type JSX, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { DEMO_OBSERVATIONS, DEMO_ROUNDS, type FieldObservation } from '../domain/demo/production.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag, StateBanner, SPACE,
  type Column, type RegisterFilter,
} from '../components/ui/index.js';
import { natureKey } from './operations/labels.js';
import { formatDay } from './register/format.js';

const ALL = 'all';

/**
 * Module 08 — les constats sur support relevés en tournée (H7), au gabarit
 * « registre ». Un constat bloquant appelle une intervention ; l'ordre de
 * travaux lui-même, né d'une décision humaine, n'a pas encore de moteur.
 * Jeu de démonstration.
 */
export function OpsIncidentsView(): JSX.Element {
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rounds = new Map(DEMO_ROUNDS.map(r => [r.survey.id, r]));
  const rows = [...DEMO_OBSERVATIONS].sort((a, b) =>
    (a.severity === b.severity ? 0 : a.severity === 'blocking' ? -1 : 1) || a.id.localeCompare(b.id));
  const visible = filter === ALL ? rows : rows.filter(o => o.severity === filter);
  const selected = rows.find(o => o.id === selectedId) ?? visible[0] ?? null;
  const blocking = rows.filter(o => o.severity === 'blocking').length;

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('opsincidents.filter.all') },
    { id: 'blocking', label: t('opsincidents.severity.blocking') },
    { id: 'warning', label: t('opsincidents.severity.warning') },
  ];
  const severityTag = (o: FieldObservation): JSX.Element => (
    <Tag
      label={t(o.severity === 'blocking' ? 'opsincidents.severity.blocking' : 'opsincidents.severity.warning')}
      severity={o.severity}
    />
  );

  const columns: readonly Column<FieldObservation>[] = [
    { id: 'id', header: t('operations.col.observation'), cell: o => o.id },
    { id: 'support', header: t('operations.col.support'), cell: o => o.support_id },
    { id: 'nature', header: t('operations.col.nature'), cell: o => t(natureKey(o.nature_key)) },
    { id: 'severity', header: t('operations.col.severity'), cell: severityTag },
    { id: 'round', header: t('operations.col.round'), cell: o => o.round_id },
    { id: 'date', header: t('operations.col.surveyed'), cell: o => formatDay(rounds.get(o.round_id)?.surveyed_on ?? undefined, lang) ?? '—' },
  ];

  const round = selected === null ? undefined : rounds.get(selected.round_id);
  const inspector = selected === null
    ? <InspectorEmpty text={t('opsincidents.inspector.empty')} />
    : (
      <Inspector
        title={selected.id}
        subtitle={t('opsincidents.inspector.subtitle', {
          support: selected.support_id,
          severity: t(selected.severity === 'blocking' ? 'opsincidents.severity.blocking' : 'opsincidents.severity.warning'),
        })}
        sections={[
          {
            id: 'incident',
            title: t('opsincidents.section.incident'),
            rows: [
              { id: 'nature', label: t('operations.col.nature'), value: t(natureKey(selected.nature_key)) },
              { id: 'round', label: t('operations.col.round'), value: selected.round_id },
              { id: 'zone', label: t('operations.col.zone'), value: round?.zone ?? '—' },
              { id: 'by', label: t('operations.col.surveyor'), value: round?.surveyor ?? '—' },
              {
                id: 'sync',
                label: t('operations.col.sync'),
                value: round?.survey.sync_state === 'synced' ? t('operations.sync.synced') : t('operations.sync.pending'),
              },
            ],
            note: t('opsincidents.section.incident.note'),
          },
        ]}
      />
    );

  return (
    <div>
      <div style={{ marginBottom: SPACE.lg }}>
        <StateBanner severity="info" message={t('demo.dataset.message')} hint={t('demo.dataset.hint')} />
      </div>
      <RegisterLayout
        title={t('opsincidents.title')}
        summary={t('opsincidents.summary', { count: rows.length, blocking })}
        filtersLabel={t('register.filters')}
        filters={filters}
        filter={filter}
        onFilter={id => { setFilter(id); setSelectedId(null); }}
        shown={t('opsincidents.shown', { count: visible.length })}
        inspector={inspector}
        note={t('opsincidents.note')}
      >
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={o => o.id}
          empty={t('operations.observations.empty')}
          onSelect={o => { setSelectedId(o.id); }}
          selectedKey={selected?.id}
        />
      </RegisterLayout>
    </div>
  );
}
