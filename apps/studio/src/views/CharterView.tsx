import { type JSX, useMemo, useState } from 'react';
import type { SiteCharter } from '@azimut/core-model';
import { useI18n } from '../i18n/useI18n.js';
import { appRepository, useCharterRegistryLoad } from '../data/index.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag, Note, StateBanner, SelectField, SPACE,
  type Column, type RegisterFilter, type InspectorSection,
} from '../components/ui/index.js';
import {
  charterElements, colorContrasts, CHARTER_ELEMENT_KINDS, type CharterElement,
} from './signage/charter-rows.js';
import { formatDay, formatNumber } from './register/format.js';

const ALL = 'all';

/**
 * Module 04 — la charte du site (A5.8), au gabarit « registre » : couleurs,
 * caractères, règles et lexique en une seule liste. L'écran lit la charte en
 * base et n'en modifie rien. Ses valeurs sont citées en texte, jamais
 * appliquées à l'interface (F1.3) ; le contraste se calcule, le seuil
 * exigible reste au paquet de règles (INV-5).
 */
type CharterViewProps = {
  /** Clé du site dans le dépôt, celle dont la coquille l'a chargé. */
  readonly siteKey: string;
};

export function CharterView({ siteKey }: CharterViewProps): JSX.Element {
  const { t, lang } = useI18n();
  const repository = useMemo(() => appRepository(), []);
  const state = useCharterRegistryLoad(repository, siteKey);
  const [charterId, setCharterId] = useState<string | null>(null);
  const [filter, setFilter] = useState(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const charters = state.registry.charters;
  const charter: SiteCharter | null = charters.find(c => c.id === charterId) ?? charters[0] ?? null;
  const elements = useMemo(() => (charter === null ? [] : charterElements(charter)), [charter]);

  if (state.status === 'loading') return <StateBanner severity="info" message={t('charter.loading')} />;
  if (state.status === 'failed') {
    return <StateBanner severity="blocking" message={t('charter.failed')} hint={t('charter.failed.hint')} />;
  }
  if (charter === null) {
    return (
      <div>
        <StateBanner severity="info" message={t('charter.none')} hint={t('charter.none.hint')} />
        <Note>{t('charter.note')}</Note>
      </div>
    );
  }

  const visible = filter === ALL ? elements : elements.filter(e => e.kind === filter);
  const selected = elements.find(e => e.id === selectedId) ?? visible[0] ?? null;

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('charter.filter.all') },
    ...CHARTER_ELEMENT_KINDS.map(kind => ({ id: kind, label: t(`charter.filter.${kind}`) })),
  ];

  const stateTag = (e: CharterElement): JSX.Element => {
    if (e.kind === 'term') {
      return (
        <Tag
          label={t(`charter.state.${e.source.severity}`)}
          severity={e.source.severity === 'forbidden' ? 'blocking' : 'warning'}
        />
      );
    }
    return e.valid
      ? <Tag label={t('charter.state.ok')} severity="valid" />
      : <Tag label={t('charter.state.invalid')} severity="blocking" />;
  };

  const label = (e: CharterElement): string => (e.kind === 'rule' ? t(`charter.rule.${e.source.kind}`) : e.label);

  const columns: readonly Column<CharterElement>[] = [
    { id: 'element', header: t('charter.col.element'), cell: label },
    { id: 'type', header: t('charter.col.type'), cell: e => t(`charter.type.${e.kind}`) },
    { id: 'value', header: t('charter.col.value'), cell: e => e.value },
    { id: 'state', header: t('charter.col.state'), cell: stateTag },
  ];

  const sectionsOf = (e: CharterElement): readonly InspectorSection[] => {
    switch (e.kind) {
      case 'color': {
        const contrasts = colorContrasts(e.source, charter);
        return [
          {
            id: 'color', title: t('charter.type.color'),
            rows: [
              { id: 'value', label: t('charter.field.value'), value: e.source.hex },
              { id: 'usage', label: t('charter.field.usage'), value: e.source.usage },
            ],
          },
          {
            id: 'contrast', title: t('charter.section.contrast'), note: t('charter.section.contrast.note'),
            rows: contrasts.length === 0
              ? [{ id: 'none', label: t('charter.contrast.none'), value: '' }]
              : contrasts.map(c => ({
                id: c.key,
                label: c.key,
                value: c.ratio === null ? t('charter.contrast.unreadable') : `${formatNumber(c.ratio, lang, 2)} : 1`,
                computed: c.ratio !== null,
              })),
          },
        ];
      }
      case 'typeface':
        return [{
          id: 'typeface', title: t('charter.type.typeface'),
          rows: [
            { id: 'family', label: t('charter.field.family'), value: e.source.family },
            { id: 'weight', label: t('charter.field.weight'), value: String(e.source.weight) },
            { id: 'min', label: t('charter.field.minsize'), value: formatNumber(e.source.min_size_mm, lang, 1), unit: 'mm' },
          ],
        }];
      case 'rule':
        return [{
          id: 'rule', title: t('charter.type.rule'), note: t('charter.rule.note'),
          rows: [
            { id: 'kind', label: t('charter.field.kind'), value: t(`charter.rule.${e.source.kind}`) },
            { id: 'params', label: t('charter.field.params'), value: e.value },
          ],
        }];
      case 'term':
        return [{
          id: 'term', title: t('charter.type.term'),
          rows: [
            { id: 'lang', label: t('charter.field.lang'), value: e.source.lang },
            { id: 'severity', label: t('charter.field.severity'), value: t(`charter.state.${e.source.severity}`) },
          ],
        }];
    }
  };

  const inspector = selected === null
    ? <InspectorEmpty text={t('charter.inspector.empty')} />
    : (
      <Inspector
        title={label(selected)}
        subtitle={t('charter.inspector.subtitle', { type: t(`charter.type.${selected.kind}`), charter: charter.name })}
        sections={sectionsOf(selected)}
      />
    );

  return (
    <div>
      {charters.length > 1 && (
        <div style={{ width: 320, marginBottom: SPACE.lg }}>
          <SelectField
            label={t('charter.select')}
            value={charter.id}
            options={charters.map(c => ({ value: c.id, label: t('charter.option', { name: c.name, version: c.version }) }))}
            onChange={id => { setCharterId(id); setSelectedId(null); }}
          />
        </div>
      )}
      <RegisterLayout
        title={t('charter.title')}
        summary={t('charter.summary', {
          name: charter.name,
          version: charter.version,
          date: formatDay(charter.created_at.slice(0, 10), lang) ?? charter.created_at,
        })}
        filtersLabel={t('register.filters')}
        filters={filters}
        filter={filter}
        onFilter={id => { setFilter(id); setSelectedId(null); }}
        shown={t('charter.shown', { count: visible.length, total: elements.length })}
        inspector={inspector}
        note={t('charter.note')}
      >
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={e => e.id}
          empty={t('charter.empty')}
          onSelect={e => { setSelectedId(e.id); }}
          selectedKey={selected?.id}
        />
      </RegisterLayout>
    </div>
  );
}
