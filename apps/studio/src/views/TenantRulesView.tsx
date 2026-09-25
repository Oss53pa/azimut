import { type JSX, useMemo, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { DEMO_SIGN_DOSSIERS, DEMO_SIGN_REGULATION } from '../domain/demo/commerce.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag, StateBanner, SPACE,
  type Column, type RegisterFilter,
} from '../components/ui/index.js';
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
 * écart sur cet axe. Jeu de démonstration, comme le reste du module.
 */
export function TenantRulesView(): JSX.Element {
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState(ALL);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const rows = useMemo<readonly ArticleRow[]>(() => {
    const instructions = DEMO_SIGN_DOSSIERS.map(d => instructDossier(d, DEMO_SIGN_REGULATION));
    return regulationArticles(DEMO_SIGN_REGULATION).map(article => ({
      article,
      failing: instructions
        .filter(i => i.checks.some(c => c.article.axis === article.axis && c.findings.length > 0))
        .map(i => i.dossier.id),
    }));
  }, []);

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
    { id: 'dossiers', header: t('tenantrules.col.dossiers'), numeric: true, cell: () => String(DEMO_SIGN_DOSSIERS.length) },
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
              { id: 'dossiers', label: t('tenantrules.col.dossiers'), value: String(DEMO_SIGN_DOSSIERS.length), computed: true },
              { id: 'failing', label: t('tenantrules.col.failing'), value: String(selected.failing.length), computed: true },
              ...selected.failing.map(id => ({ id: `f-${id}`, label: id, value: t('tenantrules.failing.gap'), computed: true })),
            ],
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
        title={t('tenantrules.title')}
        summary={t('tenantrules.summary', { count: rows.length })}
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
