import { type JSX, useMemo, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { EMPTY_INSPECTION_REGISTRY, type InspectionFinding } from '@azimut/core-model';
import { loadInspection, useRegistry } from '../data/index.js';
import { RegistryStatus } from './register/RegistryStatus.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag,
  type Column, type RegisterFilter,
} from '../components/ui/index.js';
import { natureKey } from './operations/labels.js';
import { formatDay } from './register/format.js';

const ALL = 'all';

/**
 * Module 08 — les constats sur support relevés en tournée (H7), au gabarit
 * « registre ». Un constat bloquant appelle une intervention ; l'ordre de
 * travaux lui-même, né d'une décision humaine, n'a pas encore de moteur.
 * Lu en base (0044), ou dans le jeu de démonstration du dépôt de référence.
 */
type OpsIncidentsViewProps = {
  /** Clé du site dans le dépôt, celle dont la coquille l'a chargé. */
  readonly siteKey: string;
};

export function OpsIncidentsView({ siteKey }: OpsIncidentsViewProps): JSX.Element {
  const { t, lang } = useI18n();
  const state = useRegistry(loadInspection, EMPTY_INSPECTION_REGISTRY, siteKey);
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rounds = useMemo(() => new Map(state.registry.rounds.map(r => [r.id, r])), [state.registry]);

  if (state.status !== 'ready') return <RegistryStatus state={state} />;
  const nature = (k: string): string => { const key = natureKey(k); return key === null ? k : t(key); };
  const rows = [...state.registry.findings].sort((a, b) =>
    (a.severity === b.severity ? 0 : a.severity === 'blocking' ? -1 : 1) || a.id.localeCompare(b.id));
  const visible = filter === ALL ? rows : rows.filter(o => o.severity === filter);
  const selected = rows.find(o => o.id === selectedId) ?? visible[0] ?? null;
  const blocking = rows.filter(o => o.severity === 'blocking').length;

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('opsincidents.filter.all') },
    { id: 'blocking', label: t('opsincidents.severity.blocking') },
    { id: 'warning', label: t('opsincidents.severity.warning') },
  ];
  const severityTag = (o: InspectionFinding): JSX.Element => (
    <Tag
      label={t(o.severity === 'blocking' ? 'opsincidents.severity.blocking' : 'opsincidents.severity.warning')}
      severity={o.severity}
    />
  );

  const columns: readonly Column<InspectionFinding>[] = [
    { id: 'id', header: t('operations.col.observation'), cell: o => o.id },
    { id: 'support', header: t('operations.col.support'), cell: o => o.support_id },
    { id: 'nature', header: t('operations.col.nature'), cell: o => nature(o.nature_key) },
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
              { id: 'nature', label: t('operations.col.nature'), value: nature(selected.nature_key) },
              { id: 'round', label: t('operations.col.round'), value: selected.round_id },
              { id: 'zone', label: t('operations.col.zone'), value: round?.zone_label ?? '—' },
              { id: 'by', label: t('operations.col.surveyor'), value: round?.surveyor_id ?? '—' },
              {
                id: 'sync',
                label: t('operations.col.sync'),
                value: round?.sync_state === 'synced' ? t('operations.sync.synced') : t('operations.sync.pending'),
              },
            ],
            note: t('opsincidents.section.incident.note'),
          },
        ]}
      />
    );

  return (
    <div>
      <RegistryStatus state={state} />
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
