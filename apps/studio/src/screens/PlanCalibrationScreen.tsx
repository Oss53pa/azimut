import { type JSX } from 'react';
import {
  Panel, ScreenStates, NumericField, AngleField, Button, StatusBar,
  StateBanner, Tag, SPACE, TEXT,
} from '../components/ui/index.js';
import type { ScreenState, StatusItem } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import { getErrorMessage } from '@azimut/core-model';
import type { ErrorCode, Finding } from '@azimut/core-model';
import { CALIBRATION_STEPS } from '../state/use-plan-calibration.js';
import type { CalibrationDraft, CalibrationStep } from '../state/use-plan-calibration.js';
import { CALIBRATION_SHORTCUTS } from '../state/calibration-shortcuts.js';
import { MAX_PLAN_BYTES, ACCEPTED_PLAN_FORMATS } from '../state/plan-import.js';
import type { PlanFile } from '../state/plan-import.js';

/**
 * M2 (partie M) — écran d'import et de calage de plan.
 *
 * « C'est l'écran d'entrée réel du produit, et le plus important de la
 * tranche. Tout le reste en dépend. »
 *
 * Les trois étapes sont visibles en permanence, et non révélées l'une après
 * l'autre : l'opérateur doit pouvoir revenir à l'échelle sans perdre son fond,
 * et voir d'un coup d'œil où il en est. L'étape courante se déduit de la
 * saisie (`stepOf`), elle n'est pas rangée à part.
 */
export type PlanCalibrationScreenProps = {
  readonly state: ScreenState;
  readonly draft: CalibrationDraft;
  readonly step: CalibrationStep;
  readonly findings: readonly Finding[];
  readonly warnings: readonly Finding[];
  readonly busy: boolean;
  readonly calibrated: boolean;
  readonly onPickFile: (file: PlanFile) => void;
  readonly onDistance: (metres: number | null) => void;
  readonly onAzimuth: (degrees: number | null) => void;
  readonly onRecalibrate: () => void;
  readonly onValidate: () => void;
};

export function PlanCalibrationScreen(props: PlanCalibrationScreenProps): JSX.Element {
  const { t, lang } = useI18n();
  const { draft, step, findings, busy, calibrated } = props;

  function messageFor(...codes: readonly string[]): string | undefined {
    const found = findings.find(f => codes.includes(f.code));
    return found === undefined
      ? undefined
      : getErrorMessage(found.code as ErrorCode, lang) ?? found.code;
  }

  const status: readonly StatusItem[] = [
    { id: 'step', label: t('calib.status.step'), value: t(stepKey(step)) },
    {
      id: 'points',
      label: t('calib.status.points'),
      value: `${String(countPoints(draft))}/2`,
    },
  ];

  return (
    <ScreenStates
      state={props.state}
      invitation={{
        message: t('calib.empty.message'),
        actionLabel: t('calib.empty.action'),
        onAction: () => { /* le sélecteur de fichier s'ouvre à l'action */ },
      }}
      skeleton={<StateBanner severity="info" message={t('calib.loading')} />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.lg }}>
        <StepTrail current={step} />

        {/* Étape 1 — le fond. */}
        <Panel title={t('calib.step.plan')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm, padding: SPACE.md }}>
            <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-secondary)' }}>
              {t('calib.plan.accepted', {
                formats: ACCEPTED_PLAN_FORMATS.map(f => f.key.toUpperCase()).join(', '),
                megabytes: String(Math.round(MAX_PLAN_BYTES / (1024 * 1024))),
              })}
            </p>
            <input
              type="file"
              aria-label={t('calib.plan.field')}
              disabled={busy}
              onChange={event => {
                const file = event.target.files?.[0];
                if (file === undefined) return;
                props.onPickFile({
                  name: file.name,
                  byteSize: file.size,
                  mediaType: file.type,
                  pageCount: null,
                  page: null,
                });
              }}
            />
            {draft.plan !== null && (
              <Tag label={t('calib.plan.loaded', { format: draft.plan.format.toUpperCase() })} severity="valid" />
            )}
            <Anomaly message={messageFor(
              'IMPORT.FORMAT_UNSUPPORTED', 'IMPORT.FILE_TOO_LARGE', 'IMPORT.PAGE_REQUIRED',
            )} />
          </div>
        </Panel>

        {/* Étape 2 — l'échelle. */}
        <Panel title={t('calib.step.scale')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md, padding: SPACE.md }}>
            <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-secondary)' }}>
              {t('calib.scale.hint')}
            </p>
            <NumericField
              label={t('calib.scale.distance')}
              unit={t('unit.metre')}
              value={draft.realDistanceM === 0 ? null : draft.realDistanceM}
              onChange={props.onDistance}
              step={0.001}
              min={0}
              disabled={busy || draft.plan === null}
              error={messageFor('CALIB.DISTANCE_INVALID')}
            />
            <Anomaly message={messageFor('CALIB.POINT_REQUIRED', 'CALIB.POINTS_TOO_CLOSE')} />
          </div>
        </Panel>

        {/* Étape 3 — l'orientation. */}
        <Panel title={t('calib.step.orientation')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md, padding: SPACE.md }}>
            <AngleField
              label={t('calib.orientation.azimuth')}
              value={draft.northAzimuthDeg}
              onChange={props.onAzimuth}
              disabled={busy || draft.plan === null}
              hint={t('calib.orientation.hint')}
              error={messageFor('CALIB.AZIMUTH_INVALID')}
            />
          </div>
        </Panel>

        {props.warnings.map(w => (
          <StateBanner
            key={w.code}
            severity="warning"
            message={getErrorMessage(w.code as ErrorCode, lang) ?? w.code}
          />
        ))}

        {calibrated && (
          <StateBanner severity="valid" message={t('calib.done')} />
        )}

        <div style={{ display: 'flex', gap: SPACE.sm }}>
          <Button rank="secondary" onClick={props.onRecalibrate} disabled={busy || draft.plan === null}>
            {t('calib.action.recalibrate')}
          </Button>
          <Button rank="primary" onClick={props.onValidate} disabled={busy || draft.plan === null}>
            {busy ? t('calib.action.validating') : t('calib.action.validate')}
          </Button>
        </div>

        <StatusBar items={status}>
          <span style={{ color: 'var(--text-muted)' }}>
            {CALIBRATION_SHORTCUTS.map(s => `${s.key} ${t(s.labelKey)}`).join(' · ')}
          </span>
        </StatusBar>
      </div>
    </ScreenStates>
  );
}

/** La trame des trois étapes, chacune disant son état en toutes lettres. */
function StepTrail({ current }: { readonly current: CalibrationStep }): JSX.Element {
  const { t } = useI18n();
  const index = CALIBRATION_STEPS.indexOf(current);
  return (
    <ol
      aria-label={t('calib.trail')}
      style={{
        display: 'flex', gap: SPACE.md, listStyle: 'none', margin: 0, padding: 0,
        fontSize: TEXT.small,
      }}
    >
      {CALIBRATION_STEPS.map((step, i) => (
        <li key={step} style={{ display: 'flex', gap: SPACE.xs }}>
          <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {i + 1}.
          </span>
          <span style={{ color: i === index ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {t(stepKey(step))}
          </span>
          {/* L'étape courante se dit, elle ne se devine pas à la teinte (M7.7, partie M). */}
          {i === index && <Tag label={t('calib.trail.current')} muted />}
        </li>
      ))}
    </ol>
  );
}

function Anomaly({ message }: { readonly message: string | undefined }): JSX.Element | null {
  return message === undefined
    ? null
    : <StateBanner severity="blocking" message={message} />;
}

function stepKey(step: CalibrationStep): 'calib.step.plan' | 'calib.step.scale' | 'calib.step.orientation' {
  return step === 'plan' ? 'calib.step.plan'
    : step === 'scale' ? 'calib.step.scale'
      : 'calib.step.orientation';
}

function countPoints(draft: CalibrationDraft): number {
  return (draft.a === null ? 0 : 1) + (draft.b === null ? 0 : 1);
}
