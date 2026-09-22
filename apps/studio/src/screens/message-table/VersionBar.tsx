import { type JSX } from 'react';
import { Button, Tag, SPACE, TEXT, NUMERIC_STYLE } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import type { UiMessageKey } from '../../i18n/index.js';
import type { MessageSchedule, ScheduleState, ScheduleTrigger } from '@azimut/engine-graph';

/**
 * R4 (partie R) — la barre de version.
 *
 * Quatre éléments lus sur `message_schedule`, et les actions permises. R4 :
 * « Une action non permise est absente, jamais grisée. » Le tableau des
 * actions reçues est donc déjà filtré par l'appelant, qui croise la légalité
 * de l'état (R12) et la permission du rôle (R2) ; cette barre n'en juge pas,
 * elle les dessine.
 */
export type VersionBarProps = {
  readonly schedule: MessageSchedule;
  /** Les actions à offrir, déjà croisées état et rôle. */
  readonly actions: readonly ScheduleTrigger[];
  readonly onAction: (trigger: ScheduleTrigger) => void;
  /** R4 (partie R) — « Comparer | Au moins deux versions ». */
  readonly canCompare: boolean;
  readonly onCompare: () => void;
  readonly canExport: boolean;
  readonly onExport: () => void;
};

const STATE_KEYS: Readonly<Record<ScheduleState, UiMessageKey>> = {
  draft: 'msgtable.state.draft',
  in_review: 'msgtable.state.in_review',
  approved: 'msgtable.state.approved',
  superseded: 'msgtable.state.superseded',
};

const ACTION_KEYS: Readonly<Record<ScheduleTrigger, UiMessageKey>> = {
  generate: 'msgtable.action.generate',
  regenerate: 'msgtable.action.regenerate',
  submit_for_review: 'msgtable.action.submit_for_review',
  reject: 'msgtable.action.reject',
  approve: 'msgtable.action.approve',
  // R12 : le remplacement est automatique. Il n'a pas de bouton, et le libellé
  // n'existe que pour que la table soit exhaustive.
  supersede: 'msgtable.state.superseded',
};

export function VersionBar(props: VersionBarProps): JSX.Element {
  const { t } = useI18n();
  const { schedule } = props;
  // R4 (partie R) : « huit premiers caractères, chasse fixe, valeur complète en infobulle ».
  const shortHash = schedule.inputs_hash.slice(0, 8);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', flexWrap: 'wrap',
      gap: SPACE.md, padding: `${String(SPACE.sm)}px ${String(SPACE.md)}px`,
      borderBottom: '1px solid var(--border-hairline)',
    }}>
      <strong style={{ fontSize: TEXT.small, color: 'var(--text-primary)' }}>
        {t('msgtable.version', { version: schedule.version })}
      </strong>

      <Tag
        label={t(STATE_KEYS[schedule.state])}
        severity={schedule.state === 'approved' ? 'info' : undefined}
        muted={schedule.state === 'superseded'}
      />

      <Field label={t('msgtable.generated_at')} value={schedule.generated_at} />
      <Field
        label={t('msgtable.inputs_hash')}
        value={shortHash}
        title={t('msgtable.inputs_hash.full', { hash: schedule.inputs_hash })}
      />

      <div style={{ marginLeft: 'auto', display: 'flex', gap: SPACE.sm, flexWrap: 'wrap' }}>
        {props.actions
          .filter(trigger => trigger !== 'supersede')
          .map(trigger => (
            <Button
              key={trigger}
              rank={trigger === 'approve' ? 'primary' : 'secondary'}
              onClick={() => { props.onAction(trigger); }}
            >
              {t(ACTION_KEYS[trigger])}
            </Button>
          ))}
        {props.canCompare && (
          <Button rank="secondary" onClick={props.onCompare}>
            {t('msgtable.action.compare')}
          </Button>
        )}
        {props.canExport && (
          <Button rank="secondary" onClick={props.onExport}>
            {t('msgtable.action.export')}
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, title }: {
  readonly label: string;
  readonly value: string;
  readonly title?: string | undefined;
}): JSX.Element {
  return (
    <span
      title={title}
      style={{ display: 'flex', gap: SPACE.xs, alignItems: 'baseline', minWidth: 0 }}
    >
      <span style={{ fontSize: TEXT.micro, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ ...NUMERIC_STYLE, fontSize: TEXT.micro, color: 'var(--text-primary)' }}>
        {value}
      </span>
    </span>
  );
}
