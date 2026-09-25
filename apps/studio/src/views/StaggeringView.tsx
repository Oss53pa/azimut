import { type JSX, useMemo, useState } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag, StateBanner,
  type Column, type RegisterFilter, type Severity,
} from '../components/ui/index.js';
import { staggeringPlan, type StaggeringSequence } from '../domain/staggering.js';
import { buildScheduleModel, declaredInformationLevels, NO_WAYFINDING_RULES } from './message-schedule/schedule-model.js';
import { siteLabels } from './register/labels.js';
import { formatNumber } from './register/format.js';

const ALL = 'all';

type Continuity = 'continuous' | 'broken' | 'unannounced';

function continuityOf(s: StaggeringSequence): Continuity {
  if (s.breaks.length > 0) return 'broken';
  const points = s.steps.filter(step => !step.arrival);
  if (points.length > 0 && points.every(step => !step.announced)) return 'unannounced';
  return 'continuous';
}

const CONTINUITY_SEVERITY: Readonly<Record<Continuity, Severity>> = {
  continuous: 'valid',
  broken: 'blocking',
  unannounced: 'warning',
};

/**
 * Module 02 — le plan de jalonnement (H2.4), au gabarit « registre » : un
 * parcours par ligne, de chaque entrée vers chaque destination, et la suite de
 * ses points de décision avec ce que le tableau des messages y annonce.
 */
export function StaggeringView(): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();
  const profile = site.travel_profiles[0];
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const labels = useMemo(() => siteLabels(site, lang), [site, lang]);

  const plan = useMemo(() => {
    if (profile === undefined) return null;
    // Le même tableau que l'écran « Messages » calcule par défaut : première
    // typologie, aucune règle plafond, niveaux d'information déclarés.
    const model = buildScheduleModel(site, profile, {
      supportTypeKey: site.support_types[0]?.key ?? '',
      version: 1,
      rules: NO_WAYFINDING_RULES,
      informationLevels: declaredInformationLevels(site),
      lang,
    });
    return staggeringPlan(site, profile, model.schedule);
  }, [site, profile, lang]);

  if (profile === undefined || plan === null) {
    return <StateBanner severity="warning" message={t('staggering.noprofile')} />;
  }

  const origins = [...new Set(plan.sequences.map(s => s.originNodeId))];
  const visible = filter === ALL ? plan.sequences : plan.sequences.filter(s => s.originNodeId === filter);
  const selected = plan.sequences.find(s => s.id === selectedId) ?? visible[0] ?? null;
  const broken = plan.sequences.filter(s => s.breaks.length > 0).length;

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('staggering.filter.all') },
    ...origins.map(id => ({ id, label: t('staggering.filter.from', { origin: labels.node(id) }) })),
  ];

  const columns: readonly Column<StaggeringSequence>[] = [
    { id: 'origin', header: t('staggering.col.origin'), cell: s => labels.node(s.originNodeId) },
    { id: 'destination', header: t('staggering.col.destination'), cell: s => labels.destination(s.destinationId) },
    { id: 'points', header: t('staggering.col.points'), numeric: true, cell: s => String(s.steps.length - 1) },
    {
      id: 'announced',
      header: t('staggering.col.announced'),
      numeric: true,
      cell: s => `${String(s.steps.filter(x => !x.arrival && x.announced).length)} / ${String(s.steps.length - 1)}`,
    },
    { id: 'length', header: t('staggering.col.length'), numeric: true, cell: s => formatNumber(s.lengthM, lang, 2) },
    {
      id: 'continuity',
      header: t('staggering.col.continuity'),
      cell: s => {
        const c = continuityOf(s);
        return <Tag label={t(`staggering.continuity.${c}`)} severity={CONTINUITY_SEVERITY[c]} />;
      },
    },
  ];

  const inspector = selected === null
    ? <InspectorEmpty text={t('staggering.inspector.empty')} />
    : (
      <Inspector
        title={labels.destination(selected.destinationId)}
        subtitle={t('staggering.inspector.subtitle', { origin: labels.node(selected.originNodeId), profile: profile.name })}
        sections={[
          {
            id: 'steps',
            title: t('staggering.section.steps'),
            rows: selected.steps.map((step, i) => ({
              id: `${step.nodeId}-${String(i)}`,
              label: labels.node(step.nodeId),
              value: step.arrival
                ? t('staggering.step.arrival')
                : step.announced ? t('staggering.step.announced') : t('staggering.step.silent'),
            })),
          },
          {
            id: 'computed',
            title: t('sitesheet.section.computed'),
            note: t('staggering.section.computed.note'),
            rows: [
              { id: 'length', label: t('staggering.field.length'), value: formatNumber(selected.lengthM, lang, 2), unit: 'm', computed: true },
              { id: 'points', label: t('staggering.col.points'), value: String(selected.steps.length - 1), computed: true },
              { id: 'breaks', label: t('staggering.field.breaks'), value: String(selected.breaks.length), computed: true },
            ],
          },
        ]}
      />
    );

  return (
    <RegisterLayout
      title={t('staggering.title')}
      summary={t('staggering.summary', { sequences: plan.sequences.length, points: plan.decisionPoints, broken })}
      filtersLabel={t('register.filters')}
      filters={filters}
      filter={filter}
      onFilter={id => { setFilter(id); setSelectedId(null); }}
      shown={t('staggering.shown', { count: visible.length })}
      inspector={inspector}
      note={t('staggering.note')}
    >
      <DataTable
        columns={columns}
        rows={visible}
        rowKey={s => s.id}
        empty={t('staggering.empty')}
        onSelect={s => { setSelectedId(s.id); }}
        selectedKey={selected?.id}
      />
    </RegisterLayout>
  );
}
