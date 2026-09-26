import { type JSX, useState } from 'react';
import { EMPTY_WORKSITE_REGISTRY, type InstallSlot } from '@azimut/core-model';
import { useI18n } from '../i18n/useI18n.js';
import { loadWorksite, useRegistry } from '../data/index.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag,
  type Column, type RegisterFilter, type InspectorRow,
} from '../components/ui/index.js';
import { RegistryStatus } from './register/RegistryStatus.js';
import { useSiteData } from '../context/useSiteData.js';
import { closuresOnDay } from './closures/closure-rows.js';
import { siteLabels } from './register/labels.js';
import { formatDay } from './register/format.js';

const ALL = 'all';
const PLANNED = 'planned';
const UNPLANNED = 'unplanned';
/** Référence affichée d'un créneau : le début de son identifiant, faute de code en base. */
const SLOT_REF_LENGTH = 8;

/**
 * Module 07 — le planning de pose (H6.2), au gabarit « registre » : un
 * créneau par ligne, sa zone, ses supports, jour ou nuit, et les poses qui
 * attendent encore une date. Lu en base (0042), ou dans le jeu de
 * démonstration du dépôt de référence.
 */
type WorksiteSlotsViewProps = {
  /** Clé du site dans le dépôt, celle dont la coquille l'a chargé. */
  readonly siteKey: string;
};

export function WorksiteSlotsView({ siteKey }: WorksiteSlotsViewProps): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();
  const state = useRegistry(loadWorksite, EMPTY_WORKSITE_REGISTRY, siteKey);
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (state.status !== 'ready') return <RegistryStatus state={state} />;
  // Le dépôt rend les créneaux déjà triés : datés d'abord, par date.
  const rows = state.registry.slots;

  const visible = rows.filter(s => {
    if (filter === PLANNED) return s.planned_on !== null;
    if (filter === UNPLANNED) return s.planned_on === null;
    return true;
  });
  const selected = rows.find(s => s.id === selectedId) ?? visible[0] ?? null;
  const planned = rows.filter(s => s.planned_on !== null);

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('worksiteslots.filter.all') },
    { id: PLANNED, label: t('worksiteslots.filter.planned') },
    { id: UNPLANNED, label: t('worksiteslots.filter.unplanned') },
  ];
  const shift = (s: InstallSlot): string => (s.night_work ? t('worksite.shift.night') : t('worksite.shift.day'));

  const columns: readonly Column<InstallSlot>[] = [
    { id: 'slot', header: t('worksiteslots.col.slot'), cell: s => s.id.slice(0, SLOT_REF_LENGTH) },
    { id: 'zone', header: t('worksite.col.zone'), cell: s => s.zone_label },
    { id: 'supports', header: t('worksite.col.supports'), numeric: true, cell: s => String(s.support_ids.length) },
    { id: 'shift', header: t('worksite.col.shift'), cell: shift },
    {
      id: 'state',
      header: t('worksite.col.state'),
      cell: s => (s.planned_on === null
        ? <Tag label={t('worksite.slot.unplanned')} severity="warning" />
        : <Tag label={t('worksiteslots.state.planned')} severity="valid" />),
    },
    { id: 'date', header: t('worksite.col.date'), cell: s => formatDay(s.planned_on ?? undefined, lang) ?? '—' },
  ];

  // A5.3 — les arêtes qui aboutissent aux supports du créneau, fermées le jour de pose.
  const closureInfo = (slot: InstallSlot): readonly InspectorRow[] => {
    if (slot.planned_on === null) return [{ id: 'undated', label: t('worksiteslots.closures.undated'), value: '' }];
    const labels = siteLabels(site, lang);
    const closures = closuresOnDay(site, slot.support_ids, slot.planned_on);
    if (closures.length === 0) return [{ id: 'none', label: t('worksiteslots.closures.none'), value: '' }];
    return closures.map((c, i) => ({
      id: `${c.edge.id}-${String(i)}`,
      label: `${labels.node(c.edge.from_node_id)} — ${labels.node(c.edge.to_node_id)}`,
      value: c.closure === null ? t('closures.unreadable') : `${c.closure.from} → ${c.closure.to}`,
      computed: true,
    }));
  };

  const inspector = selected === null
    ? <InspectorEmpty text={t('worksiteslots.inspector.empty')} />
    : (
      <Inspector
        title={selected.id.slice(0, SLOT_REF_LENGTH)}
        subtitle={t('worksiteslots.inspector.subtitle', { zone: selected.zone_label, shift: shift(selected) })}
        sections={[
          {
            id: 'slot',
            title: t('worksiteslots.section.slot'),
            rows: [
              { id: 'zone', label: t('worksite.col.zone'), value: selected.zone_label },
              { id: 'date', label: t('worksite.col.date'), value: formatDay(selected.planned_on ?? undefined, lang) ?? t('worksite.slot.unplanned') },
              { id: 'shift', label: t('worksite.col.shift'), value: shift(selected) },
            ],
          },
          {
            id: 'computed',
            title: t('sitesheet.section.computed'),
            rows: [
              { id: 'supports', label: t('worksite.col.supports'), value: String(selected.support_ids.length), computed: true },
            ],
          },
          {
            id: 'closures',
            title: t('worksiteslots.section.closures'),
            // A5.3 — les arêtes qui aboutissent aux supports du créneau, fermées le jour de pose.
            rows: closureInfo(selected),
          },
        ]}
      />
    );

  return (
    <div>
      <RegistryStatus state={state} />
      <RegisterLayout
        title={t('worksite.panel.slots')}
        summary={t('worksiteslots.summary', {
          count: rows.length,
          planned: planned.reduce((n, s) => n + s.support_ids.length, 0),
          unplanned: rows.filter(s => s.planned_on === null).reduce((n, s) => n + s.support_ids.length, 0),
        })}
        filtersLabel={t('register.filters')}
        filters={filters}
        filter={filter}
        onFilter={id => { setFilter(id); setSelectedId(null); }}
        shown={t('worksiteslots.shown', { count: visible.length })}
        inspector={inspector}
        note={t('worksiteslots.note')}
      >
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={s => s.id}
          empty={t('worksite.slots.empty')}
          onSelect={s => { setSelectedId(s.id); }}
          selectedKey={selected?.id}
        />
      </RegisterLayout>
    </div>
  );
}
