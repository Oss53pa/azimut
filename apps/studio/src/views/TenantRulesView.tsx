import { type JSX, useMemo, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { EMPTY_TENANT_REGISTRY, regulationInForce } from '@azimut/core-model';
import { useSiteData } from '../context/useSiteData.js';
import { loadTenant, useRegistry } from '../data/index.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag, StateBanner, SPACE,
  type Column, type RegisterFilter,
} from '../components/ui/index.js';
import { RegistryStatus } from './register/RegistryStatus.js';
import { signDossiers } from './tenant/dossiers.js';
import { formatDay } from './register/format.js';
import { instructDossier, regulationArticles, type Article } from './tenant/articles.js';
import { AXIS_KEYS } from './tenant/labels.js';
import { formatNumber } from './register/format.js';

const ALL = 'all';
const BREACHED = 'breached';

type ArticleRow = {
  readonly article: Article;
  /** Dossiers dont le projet s'écarte de l'article. */
  readonly failing: readonly string[];
};

/**
 * Module 06 — le règlement d'enseigne du site (H5.2), article par article, au
 * gabarit « registre ». Un article est un axe que le règlement borne ; ses
 * dossiers non conformes sont ceux où le garde `guardSignProject` relève un
 * écart sur cet axe. L'écran montre la version en vigueur aujourd'hui, et les
 * dossiers déposés sous elle. Lu en base (0046), ou dans le jeu de
 * démonstration du dépôt de référence.
 */
type TenantRulesViewProps = {
  /** Clé du site dans le dépôt, celle dont la coquille l'a chargé. */
  readonly siteKey: string;
};

export function TenantRulesView({ siteKey }: TenantRulesViewProps): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();
  const state = useRegistry(loadTenant, EMPTY_TENANT_REGISTRY, siteKey);
  const [filter, setFilter] = useState(ALL);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const regulation = useMemo(() => regulationInForce(state.registry.regulations, today), [state.registry, today]);
  // Les dossiers déposés sous cette version : chacun s'instruit contre la
  // version en vigueur à son dépôt, pas contre celle d'aujourd'hui.
  const governed = useMemo(
    () => signDossiers(site, state.registry).filter(d => regulation !== null && d.regulation?.id === regulation.id),
    [site, state.registry, regulation],
  );
  const rows = useMemo<readonly ArticleRow[]>(() => {
    if (regulation === null) return [];
    const instructions = governed.map(d => instructDossier(d, regulation));
    return regulationArticles(regulation).map(article => ({
      article,
      failing: instructions
        .filter(i => i.checks.some(c => c.article.axis === article.axis && c.findings.length > 0))
        .map(i => i.dossier.id),
    }));
  }, [governed, regulation]);

  if (state.status !== 'ready') return <RegistryStatus state={state} />;

  const visible = filter === BREACHED ? rows.filter(r => r.failing.length > 0) : rows;
  const selected = rows.find(r => r.article.code === selectedCode) ?? visible[0] ?? null;

  const requirement = (a: Article): string => {
    if (a.limitMm !== null) return t('tenantrules.requirement.max', { value: formatNumber(a.limitMm, lang, 0) });
    if (a.axis === 'forbidden_feature') return t('tenantrules.requirement.forbidden', { values: a.values.join(', ') });
    return t('tenantrules.requirement.allowed', { values: a.values.join(', ') });
  };

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('tenantrules.filter.all') },
    { id: BREACHED, label: t('tenantrules.filter.breached') },
  ];

  const columns: readonly Column<ArticleRow>[] = [
    { id: 'code', header: t('tenantrules.col.article'), cell: r => r.article.code },
    { id: 'axis', header: t('tenantrules.col.object'), cell: r => t(AXIS_KEYS[r.article.axis]) },
    { id: 'requirement', header: t('tenantrules.col.requirement'), cell: r => requirement(r.article) },
    { id: 'dossiers', header: t('tenantrules.col.dossiers'), numeric: true, cell: () => String(governed.length) },
    {
      id: 'failing',
      header: t('tenantrules.col.failing'),
      cell: r => (r.failing.length === 0
        ? <Tag label={t('tenantrules.failing.none')} severity="valid" />
        : <Tag label={String(r.failing.length)} severity="blocking" />),
    },
  ];

  const inspector = selected === null
    ? <InspectorEmpty text={t('tenantrules.inspector.empty')} />
    : (
      <Inspector
        title={selected.article.code}
        subtitle={t(AXIS_KEYS[selected.article.axis])}
        sections={[
          {
            id: 'article',
            title: t('tenantrules.section.article'),
            rows: [
              { id: 'requirement', label: t('tenantrules.col.requirement'), value: requirement(selected.article) },
              { id: 'scope', label: t('tenantrules.field.scope'), value: t('tenantrules.field.scope.site') },
            ],
          },
          {
            id: 'computed',
            title: t('sitesheet.section.computed'),
            rows: [
              { id: 'dossiers', label: t('tenantrules.col.dossiers'), value: String(governed.length), computed: true },
              { id: 'failing', label: t('tenantrules.col.failing'), value: String(selected.failing.length), computed: true },
              ...selected.failing.map(id => ({ id: `f-${id}`, label: id, value: t('tenantrules.failing.gap'), computed: true })),
            ],
          },
        ]}
      />
    );

  return (
    <div>
      <RegistryStatus state={state} />
      {regulation === null && (
        <div style={{ marginBottom: SPACE.lg }}>
          <StateBanner severity="info" message={t('tenant.regulation.none')} hint={t('tenant.regulation.none.hint')} />
        </div>
      )}
      <RegisterLayout
        title={t('tenantrules.title')}
        summary={regulation === null
          ? t('tenantrules.summary', { count: 0 })
          : `${t('tenantrules.summary', { count: rows.length })} · ${t('tenant.regulation.version', {
            date: formatDay(regulation.effective_from, lang) ?? regulation.effective_from,
          })}`}
        filtersLabel={t('register.filters')}
        filters={filters}
        filter={filter}
        onFilter={id => { setFilter(id); setSelectedCode(null); }}
        shown={t('tenantrules.shown', { count: visible.length })}
        inspector={inspector}
        note={t('tenantrules.note')}
      >
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={r => r.article.code}
          empty={t('tenantrules.empty')}
          onSelect={r => { setSelectedCode(r.article.code); }}
          selectedKey={selected?.article.code}
        />
      </RegisterLayout>
    </div>
  );
}
