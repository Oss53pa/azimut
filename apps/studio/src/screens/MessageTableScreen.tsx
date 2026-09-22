import { type JSX, type KeyboardEvent, useId } from 'react';
import {
  ScreenStates, ScreenHeader, StateBanner, Note, SPACE, TEXT,
} from '../components/ui/index.js';
import type { ScreenState } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import type { MessageSchedule, ScheduleTrigger } from '@azimut/engine-graph';
import type { Option } from '../components/ui/index.js';
import type {
  Grouping, RowGroup, ScheduleFilters, ScheduleRow,
} from '../state/message-schedule-rows.js';
import type { TableSelection } from '../state/message-table-selection.js';
import { actionOfKey } from '../state/message-table-keys.js';
import type { MessageTableAction } from '../state/message-table-keys.js';
import { VersionBar } from './message-table/VersionBar.js';
import { FilterBar } from './message-table/FilterBar.js';
import { LineTable } from './message-table/LineTable.js';
import { LineDetail } from './message-table/LineDetail.js';
import type { SourceKey } from './message-table/LineDetail.js';
import { CompareView } from './message-table/CompareView.js';
import type { CompareViewProps } from './message-table/CompareView.js';

/**
 * Partie R — l'écran du tableau des messages, moitié consultation.
 *
 * R1 : « Le tableau des messages dit, pour chaque face de chaque support, ce
 * qui y sera écrit, dans quelle langue, avec quel pictogramme, dans quelle
 * direction, et quel point de décision le justifie. C'est lui que la maîtrise
 * d'ouvrage valide, avant tout dessin. »
 *
 * F5bis.3 : « c'est l'écran que la maîtrise d'ouvrage regardera le plus
 * longtemps. Sa densité et sa lisibilité priment sur son élégance. »
 *
 * L'écran ne compose rien de neuf : il reçoit les lignes déjà ordonnées,
 * filtrées et groupées, les actions déjà croisées avec les droits de R2, et
 * les bandeaux déjà décidés. Ce qu'il fait, et lui seul, c'est les disposer
 * selon R3 et servir le clavier de R15.
 */
export type MessageTableScreenProps = {
  readonly state: ScreenState;
  readonly schedule: MessageSchedule;
  readonly groups: readonly RowGroup[];
  readonly langs: readonly string[];

  readonly filters: ScheduleFilters;
  readonly onFilters: (filters: ScheduleFilters) => void;
  readonly grouping: Grouping;
  readonly onGrouping: (grouping: Grouping) => void;
  readonly supportOptions: readonly Option[];
  readonly directionOptions: readonly Option[];
  readonly decisionPointOptions: readonly Option[];
  readonly levelOptions: readonly Option[];
  readonly hidden: number;

  readonly selection: TableSelection;
  readonly onAction: (action: MessageTableAction) => void;
  readonly onFocusRow: (id: string) => void;
  readonly focusedRow: ScheduleRow | null;
  readonly profilesAtDecisionPoint: readonly string[];
  readonly onOpenSource: (source: SourceKey) => void;

  /** R4 (partie R) — actions croisées : légalité de l'état (R12) et droit (R2). */
  readonly actions: readonly ScheduleTrigger[];
  readonly onTrigger: (trigger: ScheduleTrigger) => void;
  /** R4 (partie R) — « Comparer | Au moins deux versions ». */
  readonly canCompare: boolean;
  readonly onCompare: () => void;
  /**
   * R11 — la comparaison, quand elle est ouverte. Elle prend la place du
   * tableau : R11 en veut « un seul tableau », et en montrer deux ferait
   * chercher l'écart d'un œil à l'autre.
   */
  readonly compare: CompareViewProps | null;
  readonly canExport: boolean;
  readonly onExport: () => void;

  /** R10 — nombre de lignes périmées, toutes versions confondues du tableau. */
  readonly staleCount: number;
  readonly blockingCount: number;
  readonly excludedCount: number;
  readonly onRegenerate: () => void;

  /** R14 — les deux bandeaux de prérequis. */
  readonly graphValidated: boolean;
  readonly rulesPackBound: boolean;
  readonly onOpenValidation: () => void;
  /** Lignes enregistrées illisibles : nommées, jamais écartées en silence. */
  readonly unreadableCount: number;
  readonly online: boolean;
  readonly onEmptyAction: () => void;
};

export function MessageTableScreen(props: MessageTableScreenProps): JSX.Element {
  const { t } = useI18n();
  const searchId = useId();
  const tableId = useId();

  function handleKey(event: KeyboardEvent<HTMLElement>): void {
    const target = event.target;
    // La recherche est un champ de saisie : ses touches lui appartiennent.
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    const action = actionOfKey(event);
    if (action === null) return;
    event.preventDefault();
    props.onAction(action);
  }

  const lineCount = props.groups.reduce((n, group) => n + group.rows.length, 0);

  return (
    <ScreenStates
      state={props.state}
      invitation={{
        message: t('msgtable.empty.message'),
        actionLabel: t('msgtable.empty.action'),
        onAction: props.onEmptyAction,
      }}
      skeleton={<StateBanner severity="info" message={t('msgtable.loading')} />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md, minHeight: 0 }}>
        <ScreenHeader
          eyebrow={t('msgtable.eyebrow')}
          title={t('msgtable.title')}
          subtitle={t('msgtable.subtitle')}
        />

        <Banners {...props} />

        <VersionBar
          schedule={props.schedule}
          actions={props.actions}
          onAction={props.onTrigger}
          canCompare={props.canCompare}
          onCompare={props.onCompare}
          canExport={props.canExport}
          onExport={props.onExport}
        />

        {props.compare !== null ? <CompareView {...props.compare} /> : (
        <>
        <FilterBar
          filters={props.filters}
          onFilters={props.onFilters}
          grouping={props.grouping}
          onGrouping={props.onGrouping}
          supportOptions={props.supportOptions}
          directionOptions={props.directionOptions}
          decisionPointOptions={props.decisionPointOptions}
          levelOptions={props.levelOptions}
          hidden={props.hidden}
          searchId={searchId}
        />

        <div style={{ display: 'flex', gap: SPACE.md, alignItems: 'stretch', minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <LineTable
              groups={props.groups}
              langs={props.langs}
              focusedId={props.selection.focusedId}
              selectedIds={props.selection.selectedIds}
              onFocusRow={props.onFocusRow}
              onKeyDown={handleKey}
              emptyLabel={t('msgtable.table.empty')}
              tableId={tableId}
            />
          </div>

          {/* R3 (partie R) — le panneau de détail est repliable. */}
          {props.selection.detailOpen && (
            <LineDetail
              row={props.focusedRow}
              profilesAtDecisionPoint={props.profilesAtDecisionPoint}
              onOpenSource={props.onOpenSource}
              lang={props.langs[0] ?? 'fr'}
            />
          )}
        </div>

        </>
        )}

        <StatusLine
          lines={lineCount}
          stale={props.staleCount}
          blocking={props.blockingCount}
          excluded={props.excludedCount}
          selected={props.selection.selectedIds.length}
          online={props.online}
        />

        {/* R8 et M02.W6 : l'écran le dit, il ne se contente pas de ne pas
            offrir la saisie. */}
        <Note>{t('msgtable.readonly')}</Note>
      </div>
    </ScreenStates>
  );
}

/** R10 et R14 — les bandeaux, dans l'ordre où ils bloquent. */
function Banners(props: MessageTableScreenProps): JSX.Element {
  const { t } = useI18n();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
      {!props.graphValidated && (
        <StateBanner
          severity="blocking"
          code="GRAPH.NOT_VALIDATED"
          message={t('msgtable.banner.graph_not_validated')}
          hint={t('msgtable.banner.graph_not_validated.hint')}
        />
      )}
      {!props.rulesPackBound && (
        <StateBanner
          severity="warning"
          code="RULES.PACK_NOT_BOUND"
          message={t('msgtable.banner.no_rules_pack')}
        />
      )}
      {props.staleCount > 0 && (
        <StateBanner
          severity="warning"
          code="WAYFIND.SCHEDULE_STALE"
          message={t('msgtable.banner.stale', { count: props.staleCount })}
          hint={t('msgtable.banner.stale.action')}
        />
      )}
      {props.unreadableCount > 0 && (
        <StateBanner
          severity="blocking"
          message={t('msgtable.banner.unreadable', { count: props.unreadableCount })}
        />
      )}
    </div>
  );
}

/** R3 (partie R) — la barre d'état : lignes, périmées, bloquantes, écartées. */
function StatusLine(props: {
  readonly lines: number;
  readonly stale: number;
  readonly blocking: number;
  readonly excluded: number;
  readonly selected: number;
  readonly online: boolean;
}): JSX.Element {
  const { t } = useI18n();
  const parts = [
    t('msgtable.status.lines', { count: props.lines }),
    t('msgtable.status.stale', { count: props.stale }),
    t('msgtable.status.blocking', { count: props.blocking }),
    t('msgtable.status.excluded', { count: props.excluded }),
    props.online ? t('msgtable.status.sync') : t('msgtable.status.offline'),
  ];
  if (props.selected > 0) parts.push(t('msgtable.selection', { count: props.selected }));

  return (
    <p
      role="status"
      style={{
        margin: 0, padding: `${String(SPACE.sm)}px ${String(SPACE.md)}px`,
        borderTop: '1px solid var(--border-hairline)',
        fontSize: TEXT.micro, color: 'var(--text-secondary)',
      }}
    >
      {parts.join(' · ')}
    </p>
  );
}
