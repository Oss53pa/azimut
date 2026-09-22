import { type JSX } from 'react';
import {
  MultiChoice, TextField, Toggle, Button, SelectField,
  SPACE, TEXT,
} from '../../components/ui/index.js';
import type { Option } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import type { UiMessageKey } from '../../i18n/index.js';
import { GROUPINGS } from '../../state/message-schedule-rows.js';
import type { Grouping, ScheduleFilters } from '../../state/message-schedule-rows.js';

/**
 * R6 (partie R) — regroupement, filtres, recherche.
 *
 * « Les filtres actifs sont visibles en permanence sous forme de pastilles
 * retirables. Un filtre actif qui masque des lignes affiche leur nombre. Un
 * filtre oublié ne doit jamais faire croire qu'une ligne n'existe pas. » Le
 * compte des lignes masquées est donc rendu par l'appelant et affiché ici sans
 * condition.
 *
 * Les filtres « Bâtiment » et « Zone d'orientation » de R6.2 ne figurent pas :
 * le rattachement d'un support à une zone ou à un bâtiment n'est porté par
 * aucune table chargée dans cette session. Les offrir vides ferait croire
 * qu'ils ne trouvent rien.
 */
export type FilterBarProps = {
  readonly filters: ScheduleFilters;
  readonly onFilters: (filters: ScheduleFilters) => void;
  readonly grouping: Grouping;
  readonly onGrouping: (grouping: Grouping) => void;
  readonly supportOptions: readonly Option[];
  readonly directionOptions: readonly Option[];
  readonly decisionPointOptions: readonly Option[];
  readonly levelOptions: readonly Option[];
  /** R6.2 (partie R) — nombre de lignes que les filtres retirent de la vue. */
  readonly hidden: number;
  readonly searchId: string;
};

const GROUPING_KEYS: Readonly<Record<Grouping, UiMessageKey>> = {
  support: 'msgtable.grouping.support',
  zone: 'msgtable.grouping.zone',
  level: 'msgtable.grouping.level',
  decision_point: 'msgtable.grouping.decision_point',
};

export function FilterBar(props: FilterBarProps): JSX.Element {
  const { t } = useI18n();
  const { filters } = props;

  function set(patch: Partial<ScheduleFilters>): void {
    props.onFilters({ ...filters, ...patch });
  }

  return (
    <section
      aria-label={t('msgtable.filters')}
      style={{
        display: 'flex', flexDirection: 'column', gap: SPACE.sm,
        padding: SPACE.md, borderBottom: '1px solid var(--border-hairline)',
      }}
    >
      <div style={{ display: 'flex', gap: SPACE.lg, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <SelectField
          label={t('msgtable.grouping')}
          value={props.grouping}
          options={GROUPINGS.map(g => ({ value: g, label: t(GROUPING_KEYS[g]) }))}
          onChange={value => { props.onGrouping(value as Grouping); }}
        />

        <div id={props.searchId} style={{ minWidth: 220 }}>
          <TextField
            label={t('msgtable.search')}
            value={filters.search}
            hint={t('msgtable.search.hint')}
            onChange={search => { set({ search }); }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: SPACE.lg, flexWrap: 'wrap' }}>
        <MultiChoice
          label={t('msgtable.filter.support')}
          options={props.supportOptions}
          selected={filters.supportIds}
          onChange={supportIds => { set({ supportIds }); }}
        />
        <MultiChoice
          label={t('msgtable.filter.direction')}
          options={props.directionOptions}
          selected={filters.directions}
          onChange={directions => { set({ directions }); }}
        />
        <MultiChoice
          label={t('msgtable.filter.information_level')}
          options={props.levelOptions}
          selected={filters.informationLevels.map(String)}
          onChange={values => {
            set({ informationLevels: values.map(Number).filter(Number.isInteger) });
          }}
        />
        <MultiChoice
          label={t('msgtable.filter.decision_point')}
          options={props.decisionPointOptions}
          selected={filters.decisionPointIds}
          onChange={decisionPointIds => { set({ decisionPointIds }); }}
        />
      </div>

      <div style={{ display: 'flex', gap: SPACE.lg, flexWrap: 'wrap' }}>
        <Toggle
          label={t('msgtable.filter.stale_only')}
          checked={filters.staleOnly}
          onChange={staleOnly => { set({ staleOnly }); }}
        />
        <Toggle
          label={t('msgtable.filter.anomalies_only')}
          checked={filters.anomaliesOnly}
          onChange={anomaliesOnly => { set({ anomaliesOnly }); }}
        />
        {/* R9 : masquées par défaut, visibles par ce filtre. */}
        <Toggle
          label={t('msgtable.filter.excluded')}
          checked={filters.showExcluded}
          onChange={showExcluded => { set({ showExcluded }); }}
        />
      </div>

      <ActiveChips filters={filters} onFilters={props.onFilters} />

      {/* R6.2 (partie R) : le compte s'affiche dès qu'un filtre masque une ligne. */}
      {props.hidden > 0 && (
        <p
          role="status"
          style={{ margin: 0, fontSize: TEXT.micro, color: 'var(--text-secondary)' }}
        >
          {t('msgtable.filter.hidden', { count: props.hidden })}
        </p>
      )}
    </section>
  );
}

/** Les pastilles retirables de R6.2 (partie R), une par filtre actif. */
function ActiveChips({ filters, onFilters }: {
  readonly filters: ScheduleFilters;
  readonly onFilters: (filters: ScheduleFilters) => void;
}): JSX.Element | null {
  const { t } = useI18n();

  const chips: readonly { key: UiMessageKey; clear: Partial<ScheduleFilters> }[] = [
    ...(filters.supportIds.length > 0
      ? [{ key: 'msgtable.filter.support' as const, clear: { supportIds: [] } }] : []),
    ...(filters.directions.length > 0
      ? [{ key: 'msgtable.filter.direction' as const, clear: { directions: [] } }] : []),
    ...(filters.informationLevels.length > 0
      ? [{ key: 'msgtable.filter.information_level' as const, clear: { informationLevels: [] } }] : []),
    ...(filters.decisionPointIds.length > 0
      ? [{ key: 'msgtable.filter.decision_point' as const, clear: { decisionPointIds: [] } }] : []),
    ...(filters.staleOnly
      ? [{ key: 'msgtable.filter.stale_only' as const, clear: { staleOnly: false } }] : []),
    ...(filters.anomaliesOnly
      ? [{ key: 'msgtable.filter.anomalies_only' as const, clear: { anomaliesOnly: false } }] : []),
    ...(filters.showExcluded
      ? [{ key: 'msgtable.filter.excluded' as const, clear: { showExcluded: false } }] : []),
    ...(filters.search.trim() !== ''
      ? [{ key: 'msgtable.search' as const, clear: { search: '' } }] : []),
  ];

  if (chips.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap' }}>
      {chips.map(chip => (
        <Button
          key={chip.key}
          rank="secondary"
          onClick={() => { onFilters({ ...filters, ...chip.clear }); }}
        >
          {`${t(chip.key)} · ${t('msgtable.filter.clear')}`}
        </Button>
      ))}
    </div>
  );
}
