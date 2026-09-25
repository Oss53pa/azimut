import { type JSX, useMemo, useState } from 'react';
import type { NodeKind, TravelProfile } from '@azimut/core-model';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import type { UiMessageKey } from '../i18n/messages.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag,
  type Column, type RegisterFilter,
} from '../components/ui/index.js';
import { profileRoutes, type ProfileRoutes } from '../domain/profile-routes.js';
import { formatNumber } from './register/format.js';

const ALL = 'all';
const ACCESSIBLE = 'accessible';
const EMPTY = '—';

type ProfileRow = { readonly profile: TravelProfile; readonly routes: ProfileRoutes | undefined };

const NODE_KINDS: ReadonlySet<string> = new Set<NodeKind>([
  'entrance', 'junction', 'landing', 'elevator', 'stair', 'escalator', 'emergency_exit',
  'restroom', 'security_post', 'information_point', 'destination_access',
]);

/**
 * Module 03 — les profils de déplacement, au gabarit « registre ». Un profil
 * se lit par ses contraintes (types de passage exclus, accessibilité exigée,
 * horaires respectés) et par ce qu'elles font aux itinéraires du site :
 * combien aboutissent, combien restent sans solution, de combien ils
 * s'allongent face au profil de référence.
 */
export function ProfilesView(): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo<readonly ProfileRow[]>(() => {
    const routes = new Map(profileRoutes(site).map(r => [r.profileId, r]));
    return site.travel_profiles.map(profile => ({ profile, routes: routes.get(profile.id) }));
  }, [site]);

  const visible = filter === ALL ? rows : rows.filter(r => r.profile.require_accessible);
  const selected = rows.find(r => r.profile.id === selectedId) ?? visible[0] ?? null;
  const reference = site.travel_profiles[0];

  const kindLabel = (kind: string): string => (NODE_KINDS.has(kind)
    ? t(`graph.node.kind.${kind}` as UiMessageKey)
    : kind);
  const constraints = (p: TravelProfile): string => {
    const parts = [
      ...(p.require_accessible ? [t('profiles.constraint.accessible')] : []),
      ...p.excluded_edge_kinds.map(k => t('profiles.constraint.without', { kind: kindLabel(k).toLocaleLowerCase(lang) })),
      ...(p.honor_hours ? [t('profiles.constraint.hours')] : []),
    ];
    return parts.length === 0 ? t('profiles.constraint.none') : parts.join(' · ');
  };
  const detour = (r: ProfileRoutes | undefined): string => (r?.meanDetour === null || r === undefined
    ? EMPTY
    : `${r.meanDetour >= 0 ? '+' : ''}${formatNumber(r.meanDetour * 100, lang, 1)} %`);

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('profiles.filter.all') },
    { id: ACCESSIBLE, label: t('profiles.filter.accessible') },
  ];

  const columns: readonly Column<ProfileRow>[] = [
    { id: 'key', header: t('profiles.col.key'), cell: r => r.profile.key },
    { id: 'name', header: t('profiles.col.name'), cell: r => r.profile.name },
    { id: 'constraints', header: t('profiles.col.constraints'), cell: r => constraints(r.profile) },
    {
      id: 'routes',
      header: t('profiles.col.routes'),
      numeric: true,
      cell: r => `${String(r.routes?.solved ?? 0)} / ${String(r.routes?.pairs ?? 0)}`,
    },
    {
      id: 'unsolved',
      header: t('profiles.col.unsolved'),
      cell: r => ((r.routes?.unsolved ?? 0) > 0
        ? <Tag label={String(r.routes?.unsolved ?? 0)} severity="warning" />
        : '0'),
    },
    { id: 'detour', header: t('profiles.col.detour'), numeric: true, cell: r => detour(r.routes) },
  ];

  const yesNo = (v: boolean): string => (v ? t('placement.point.yes') : t('placement.point.no'));

  const inspector = selected === null
    ? <InspectorEmpty text={t('profiles.inspector.empty')} />
    : (
      <Inspector
        title={selected.profile.key}
        subtitle={selected.profile.id === reference?.id
          ? t('profiles.inspector.reference', { name: selected.profile.name })
          : selected.profile.name}
        sections={[
          {
            id: 'constraints',
            title: t('profiles.section.constraints'),
            rows: [
              { id: 'accessible', label: t('profiles.field.accessible'), value: yesNo(selected.profile.require_accessible) },
              { id: 'hours', label: t('profiles.field.hours'), value: yesNo(selected.profile.honor_hours) },
              ...selected.profile.excluded_edge_kinds.map(k => ({
                id: `x-${k}`, label: kindLabel(k), value: t('profiles.field.excluded'),
              })),
            ],
          },
          {
            id: 'computed',
            title: t('sitesheet.section.computed'),
            note: t('profiles.section.computed.note'),
            rows: [
              { id: 'solved', label: t('profiles.field.solved'), value: String(selected.routes?.solved ?? 0), computed: true },
              { id: 'unsolved', label: t('profiles.col.unsolved'), value: String(selected.routes?.unsolved ?? 0), computed: true },
              { id: 'detour', label: t('profiles.col.detour'), value: detour(selected.routes), computed: true },
            ],
          },
        ]}
      />
    );

  return (
    <RegisterLayout
      title={t('profiles.title')}
      summary={t('profiles.summary', { count: rows.length, site: site.site.name })}
      filtersLabel={t('register.filters')}
      filters={filters}
      filter={filter}
      onFilter={id => { setFilter(id); setSelectedId(null); }}
      shown={t('profiles.shown', { count: visible.length })}
      inspector={inspector}
      note={t('profiles.note')}
    >
      <DataTable
        columns={columns}
        rows={visible}
        rowKey={r => r.profile.id}
        empty={t('profiles.empty')}
        onSelect={r => { setSelectedId(r.profile.id); }}
        selectedKey={selected?.profile.id}
      />
    </RegisterLayout>
  );
}
