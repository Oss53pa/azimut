import { type JSX } from 'react';
import {
  Panel, ScreenStates, NumericField, AngleField, Button, StatusBar,
  StateBanner, Tag, SPACE, TEXT, DIMENSIONLESS,
} from '../components/ui/index.js';
import type { ScreenState, StatusItem } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import { getErrorMessage } from '@azimut/core-model';
import type { ErrorCode, Finding } from '@azimut/core-model';
import { CALIBRATION_STEPS, blockingReason } from '../state/plan-calibration-steps.js';
import type { CalibrationDraft, CalibrationStep } from '../state/plan-calibration-steps.js';
import { CALIBRATION_SHORTCUTS } from '../state/calibration-shortcuts.js';
import { MAX_PLAN_BYTES, ACCEPTED_PLAN_FORMATS } from '../state/plan-import.js';
import type { PlanFile, ReplacementVerdict } from '../state/plan-import.js';
import { ConsequenceDialog } from './ConsequenceDialog.js';

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
/** Un point de calage en cours de saisie : chaque coordonnée peut manquer. */
export type PartialPoint = {
  readonly x_px: number | null;
  readonly y_px: number | null;
};

export type PlanCalibrationScreenProps = {
  readonly state: ScreenState;
  readonly draft: CalibrationDraft;
  readonly step: CalibrationStep;
  readonly findings: readonly Finding[];
  readonly warnings: readonly Finding[];
  readonly busy: boolean;
  readonly calibrated: boolean;
  /**
   * Le fichier déposé, décrit, et son contenu. M2 (partie M), version 27 :
   * la précision du fond se juge sur le contenu, jamais sur l'extension ;
   * l'écran le transmet sans le lire.
   */
  readonly onPickFile: (file: PlanFile, content: Blob) => void;
  /**
   * M2 (partie M) : « Page | sélecteur | si PDF multipage, requis ». Le nombre
   * de pages lu dans le contenu du fond ; `null` pour un fond d'une seule page
   * ou qui n'est pas un PDF. Le champ ne paraît que pour un PDF multipage.
   */
  readonly pageCount: number | null;
  readonly page: number | null;
  readonly onPage: (page: number | null) => void;
  /** M2 (partie M), action « Remplacer le fond ». */
  readonly onReplaceFile?: ((file: PlanFile) => void) | undefined;
  /**
   * Les deux points de calage, en coordonnées de l'image du fond.
   *
   * Portés coordonnée par coordonnée, et non comme des points : une abscisse
   * saisie avant son ordonnée ne fait pas encore un point, et si l'écran ne
   * gardait que les points complets, la première des deux valeurs saisies
   * disparaîtrait du champ à la frappe suivante.
   *
   * Un point à demi saisi n'est pas pour autant un point à l'origine. C'est
   * l'appelant qui en décide, et il ne le complète pas.
   */
  readonly pointA: PartialPoint;
  readonly pointB: PartialPoint;
  readonly onPointA: (coordinate: 'x_px' | 'y_px', value: number | null) => void;
  readonly onPointB: (coordinate: 'x_px' | 'y_px', value: number | null) => void;
  readonly onDistance: (metres: number | null) => void;
  readonly onAzimuth: (degrees: number | null) => void;
  readonly onRecalibrate: () => void;
  readonly onValidate: () => void;
  /**
   * M2 (partie M) : « Remplacer un fond sans recaler est le geste qui décale
   * silencieusement toute une modélisation. Il demande donc une confirmation
   * nommant la conséquence. » Non nul quand un remplacement attend l'accord.
   */
  readonly pendingReplacement?: ReplacementVerdict | undefined;
  readonly onConfirmReplacement?: (() => void) | undefined;
  readonly onCancelReplacement?: (() => void) | undefined;
};

export function PlanCalibrationScreen(props: PlanCalibrationScreenProps): JSX.Element {
  const { t, lang } = useI18n();
  const { draft, step, findings, busy, calibrated } = props;
  const blocked = blockingReason(draft);

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

        {/*
          M2 (partie M), état « Partiel » : « Fond chargé, calage incomplet :
          le tracé reste inaccessible et l'écran dit pourquoi. »

          Il ne le disait pas. Les trois libellés étaient traduits dans les
          deux langues et affichés nulle part, et l'opérateur voyait un écran
          qui ne se débloquait pas sans savoir ce qu'il lui manquait. Le motif
          se déduit de la saisie, comme l'étape, plutôt que d'être rangé à
          part : deux sources pour un même fait divergent toujours.
        */}
        {blocked !== null && draft.plan !== null && !calibrated && (
          <StateBanner severity="info" message={t(blockedKey(blocked))} />
        )}

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
                props.onPickFile({ name: file.name, byteSize: file.size, page: null }, file);
              }}
            />
            {draft.plan !== null && (
              <>
                <Tag label={t('calib.plan.loaded', { format: draft.plan.format.toUpperCase() })} severity="valid" />
                {/*
                  M2 (partie M), troisième action : « Remplacer le fond |
                  Conserve le calage si les dimensions concordent, sinon
                  avertit et propose de recaler. » Elle n'apparaît qu'une fois
                  un fond chargé : remplacer ce qui n'existe pas n'a pas de
                  sens.
                */}
                <input
                  type="file"
                  aria-label={t('calib.plan.replace')}
                  disabled={busy}
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (file === undefined) return;
                    props.onReplaceFile?.({ name: file.name, byteSize: file.size, page: null });
                  }}
                />
              </>
            )}
            {props.pageCount !== null && props.pageCount > 1 && (
              <NumericField
                label={t('calib.plan.page')}
                unit={DIMENSIONLESS}
                value={props.page}
                onChange={props.onPage}
                step={1}
                min={1}
                max={props.pageCount}
                hint={t('calib.plan.pages', { pages: String(props.pageCount) })}
                error={messageFor('IMPORT.PAGE_REQUIRED')}
                disabled={busy}
              />
            )}
            <Anomaly message={messageFor('IMPORT.FORMAT_UNSUPPORTED', 'IMPORT.FILE_TOO_LARGE')} />
          </div>
        </Panel>

        {/* Étape 2 — l'échelle. */}
        <Panel title={t('calib.step.scale')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md, padding: SPACE.md }}>
            <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-secondary)' }}>
              {t('calib.scale.hint')}
            </p>
            {/*
              M7.2 (partie M) : « Toute valeur saisissable au pointeur l'est
              aussi au clavier, en numérique, dans le panneau et non dans un
              menu secondaire. » M2 pose les deux points au clic dans la zone
              de travail ; leur équivalent au clavier manquait, et l'écran
              n'avait aucun moyen de les recevoir. L'adaptateur y suppléait en
              posant deux points d'office à la validation — c'est-à-dire en
              écrivant en base des points de calage que personne n'avait posés.
            */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE.sm }}>
              <NumericField
                label={t('calib.scale.point_a_x')}
                unit={t('unit.pixel')}
                value={props.pointA.x_px}
                onChange={value => { props.onPointA('x_px', value); }}
                step={1}
                disabled={busy || draft.plan === null}
              />
              <NumericField
                label={t('calib.scale.point_a_y')}
                unit={t('unit.pixel')}
                value={props.pointA.y_px}
                onChange={value => { props.onPointA('y_px', value); }}
                step={1}
                disabled={busy || draft.plan === null}
              />
              <NumericField
                label={t('calib.scale.point_b_x')}
                unit={t('unit.pixel')}
                value={props.pointB.x_px}
                onChange={value => { props.onPointB('x_px', value); }}
                step={1}
                disabled={busy || draft.plan === null}
              />
              <NumericField
                label={t('calib.scale.point_b_y')}
                unit={t('unit.pixel')}
                value={props.pointB.y_px}
                onChange={value => { props.onPointB('y_px', value); }}
                step={1}
                disabled={busy || draft.plan === null}
                hint={t('calib.scale.points.hint')}
              />
            </div>
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

        {/* M7.9 (partie M) : la confirmation nomme la conséquence. */}
        {props.pendingReplacement !== undefined && (
          <ConsequenceDialog
            title={t('calib.replace.title')}
            consequence={props.pendingReplacement.consequence === 'calibration_kept'
              ? t('calib.replace.kept')
              : t('calib.replace.lost')}
            confirmLabel={t('calib.replace.confirm')}
            cancelLabel={t('calib.replace.cancel')}
            onConfirm={() => { props.onConfirmReplacement?.(); }}
            onCancel={() => { props.onCancelReplacement?.(); }}
          />
        )}

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

function blockedKey(
  step: CalibrationStep,
): 'calib.blocked.plan' | 'calib.blocked.scale' | 'calib.blocked.orientation' {
  return step === 'plan' ? 'calib.blocked.plan'
    : step === 'scale' ? 'calib.blocked.scale'
      : 'calib.blocked.orientation';
}

function stepKey(step: CalibrationStep): 'calib.step.plan' | 'calib.step.scale' | 'calib.step.orientation' {
  return step === 'plan' ? 'calib.step.plan'
    : step === 'scale' ? 'calib.step.scale'
      : 'calib.step.orientation';
}

function countPoints(draft: CalibrationDraft): number {
  return (draft.a === null ? 0 : 1) + (draft.b === null ? 0 : 1);
}
