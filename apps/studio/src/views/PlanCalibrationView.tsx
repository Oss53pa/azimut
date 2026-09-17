import { type JSX, useMemo, useState } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { calibratedLevelIds } from '@azimut/core-model';
import { useI18n } from '../i18n/useI18n.js';
import type { Translate } from '../i18n/index.js';
import {
  computeCalibration,
  DEFAULT_PLAUSIBLE_RESOLUTION,
  MIN_POINT_SEPARATION_PX,
  type PlanPoint,
} from '../domain/plan-calibration.js';
import {
  ScreenHeader, Panel, PanelGrid, StateBanner, Note, MetricRow, DataTable, Tag,
  SPACE, TEXT, LABEL_STYLE, type Column, type Metric,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';
import { CalibrationSurface, SURFACE_HEIGHT, SURFACE_WIDTH } from './calibration/CalibrationSurface.js';

/**
 * Tranche M · écran M2 — calage du fond de plan.
 *
 * Trois étapes, dans l'ordre : le fond, l'échelle, l'orientation. Le tracé des
 * empreintes reste inaccessible tant que l'orientation n'est pas saisie — un
 * fond non orienté produit des empreintes fausses que rien ne signalerait.
 */
export function PlanCalibrationView(): JSX.Element {
  const site = useSiteData();
  const { t } = useI18n();

  const levels = useMemo(
    () => [...site.levels].sort((a, b) => a.ordinal - b.ordinal),
    [site],
  );
  /**
   * N1.4 — état de calage enregistré, niveau par niveau. Lu depuis le site,
   * pas depuis la mesure en cours : rien n'écrit encore de calage, et un
   * écran qui présenterait la mesure comme un calage mentirait.
   */
  const levelStates = useMemo<readonly LevelCalibrationState[]>(() => {
    const calibrated = calibratedLevelIds(site.plan_sources, site.plan_calibrations);
    return levels.map(level => ({
      id: level.id,
      name: level.name,
      sourceCount: site.plan_sources.filter(p => p.level_id === level.id).length,
      calibrated: calibrated.has(level.id),
    }));
  }, [site, levels]);

  const uncalibratedCount = levelStates.filter(l => !l.calibrated).length;

  const [levelId, setLevelId] = useState(levels[0]?.id ?? '');
  const [pointA, setPointA] = useState<PlanPoint | null>(null);
  const [pointB, setPointB] = useState<PlanPoint | null>(null);
  const [distance, setDistance] = useState('42.500');
  const [azimuth, setAzimuth] = useState('');

  function placePoint(point: PlanPoint): void {
    if (pointA === null) { setPointA(point); return; }
    if (pointB === null) { setPointB(point); return; }
    setPointA(point);
    setPointB(null);
  }

  function reset(): void {
    setPointA(null);
    setPointB(null);
  }

  const parsedDistance = Number(distance.replace(',', '.'));
  const parsedAzimuth = azimuth.trim() === '' ? null : Number(azimuth.replace(',', '.'));

  const result = useMemo(() => {
    if (pointA === null || pointB === null) return null;
    return computeCalibration({
      a: pointA,
      b: pointB,
      real_distance_m: Number.isFinite(parsedDistance) ? parsedDistance : 0,
      north_azimuth_deg: parsedAzimuth !== null && Number.isFinite(parsedAzimuth) ? parsedAzimuth : null,
    });
  }, [pointA, pointB, parsedDistance, parsedAzimuth]);

  const calibration = result !== null && result.ok ? result.value : null;
  const findings = result === null ? [] : (result.ok ? result.warnings : result.findings);

  /** Étape courante : l'échelle tant que les deux points ne sont pas posés. */
  const currentStep: 'scale' | 'orientation' =
    pointA === null || pointB === null ? 'scale' : 'orientation';

  const metrics: readonly Metric[] = [
    {
      id: 'pixels',
      label: t('calibration.metric.pixels'),
      value: calibration === null ? '—' : calibration.pixel_distance.toFixed(1),
      note: t('calibration.unit.px'),
    },
    {
      id: 'resolution',
      label: t('calibration.metric.resolution'),
      value: calibration === null ? '—' : calibration.resolution_px_per_m.toFixed(3),
      note: t('calibration.unit.pxperm'),
    },
    {
      id: 'scale',
      label: t('calibration.metric.scale'),
      value: calibration === null ? '—' : `1:${String(calibration.scale_denominator)}`,
    },
    {
      id: 'north',
      label: t('calibration.metric.north'),
      value: calibration === null ? '—' : `${calibration.north_azimuth_deg.toFixed(1)}°`,
      severity: parsedAzimuth === null ? 'blocking' : 'valid',
    },
  ];

  return (
    <div>
      <ScreenHeader
        eyebrow={t('calibration.eyebrow')}
        title={t('calibration.title')}
        subtitle={t('calibration.subtitle')}
        actions={[{ id: 'reset', label: t('calibration.action.reset'), onSelect: reset }]}
      />

      <div style={{ marginBottom: SPACE.md }}>
        <StateBanner
          severity="info"
          message={t('calibration.synthetic.message')}
          hint={t('calibration.synthetic.hint')}
        />
      </div>

      <MetricRow metrics={metrics} />

      <div style={{ marginTop: SPACE.lg }}>
        <PanelGrid min={340}>
          <Panel title={t('calibration.panel.surface')} note={t(`calibration.step.${currentStep}`)} padded={false}>
            <div style={{ padding: SPACE.sm, borderBottom: '1px solid var(--border-hairline)' }}>
              <label style={{ ...LABEL_STYLE, display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                {t('calibration.field.level')}
                <select
                  value={levelId}
                  onChange={(e) => { setLevelId(e.target.value); reset(); }}
                  style={FIELD_STYLE}
                >
                  {levels.map(level => (
                    <option key={level.id} value={level.id}>{level.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <CalibrationSurface
              site={site}
              levelId={levelId}
              pointA={pointA}
              pointB={pointB}
              onPlace={placePoint}
            />
            <p style={{
              margin: 0,
              padding: `${String(SPACE.sm)}px ${String(SPACE.md)}px`,
              fontSize: TEXT.micro,
              color: 'var(--text-muted)',
            }}>
              {t('calibration.surface.hint', { width: SURFACE_WIDTH, height: SURFACE_HEIGHT })}
            </p>
          </Panel>

          <Panel title={t('calibration.panel.measure')}>
            <div style={{ display: 'grid', gap: SPACE.md }}>
              <Field
                label={t('calibration.field.distance')}
                hint={t('calibration.field.distance.hint')}
                value={distance}
                onChange={setDistance}
                inputMode="decimal"
              />
              <Field
                label={t('calibration.field.azimuth')}
                hint={t('calibration.field.azimuth.hint')}
                value={azimuth}
                onChange={setAzimuth}
                inputMode="decimal"
              />
              <div style={{ display: 'grid', gap: SPACE.xs }}>
                <span style={LABEL_STYLE}>{t('calibration.points.title')}</span>
                <PointReadout label={t('calibration.points.a')} point={pointA} empty={t('calibration.points.empty')} />
                <PointReadout label={t('calibration.points.b')} point={pointB} empty={t('calibration.points.empty')} />
              </div>
            </div>
            <Note>{t('calibration.plausible.note', {
              min: DEFAULT_PLAUSIBLE_RESOLUTION.min_px_per_m,
              max: DEFAULT_PLAUSIBLE_RESOLUTION.max_px_per_m,
              separation: MIN_POINT_SEPARATION_PX,
            })}</Note>
          </Panel>

          <Panel title={t('calibration.panel.levels')} padded={false}>
            <div style={{ padding: SPACE.sm }}>
              <StateBanner
                severity={uncalibratedCount === 0 ? 'valid' : 'blocking'}
                message={uncalibratedCount === 0
                  ? t('calibration.levels.clean')
                  : t('calibration.levels.blocking', { count: uncalibratedCount })}
              />
            </div>
            <DataTable
              columns={LEVEL_COLUMNS(t)}
              rows={levelStates}
              rowKey={(row) => row.id}
              empty={t('calibration.levels.empty')}
            />
            <div style={{ padding: `0 ${String(SPACE.md)}px` }}>
              <Note>{t('calibration.levels.note')}</Note>
            </div>
          </Panel>

          <Panel title={t('calibration.panel.findings')}>
            <FindingList findings={findings} empty={t('calibration.findings.empty')} />
            <Note>{t('calibration.findings.note')}</Note>
          </Panel>
        </PanelGrid>
      </div>

      <Note>{t('calibration.note')}</Note>
    </div>
  );
}

type LevelCalibrationState = {
  readonly id: string;
  readonly name: string;
  readonly sourceCount: number;
  readonly calibrated: boolean;
};

/**
 * Trois états et non deux : le libellé dit s'il reste à importer un fond ou à
 * caler celui qui est là. Le code d'anomalie est le même, la conduite à tenir
 * ne l'est pas.
 */
function LEVEL_COLUMNS(t: Translate): readonly Column<LevelCalibrationState>[] {
  return [
    { id: 'level', header: t('calibration.levels.col.level'), cell: (row) => row.name },
    {
      id: 'sources',
      header: t('calibration.levels.col.sources'),
      numeric: true,
      cell: (row) => row.sourceCount,
    },
    {
      id: 'state',
      header: t('calibration.levels.col.state'),
      cell: (row) => {
        if (row.calibrated) {
          return <Tag label={t('calibration.levels.state.calibrated')} severity="valid" />;
        }
        return (
          <Tag
            label={row.sourceCount === 0
              ? t('calibration.levels.state.nosource')
              : t('calibration.levels.state.uncalibrated')}
            severity="blocking"
          />
        );
      },
    },
  ];
}

const FIELD_STYLE: React.CSSProperties = {
  border: '1px solid var(--border-interactive)',
  background: 'var(--surface-panel)',
  color: 'var(--text-primary)',
  borderRadius: 4,
  padding: '4px 8px',
  fontSize: TEXT.small,
  fontFamily: 'inherit',
  textTransform: 'none',
  letterSpacing: 0,
};

type FieldProps = {
  readonly label: string;
  readonly hint: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly inputMode?: 'decimal';
};

function Field({ label, hint, value, onChange, inputMode }: FieldProps): JSX.Element {
  return (
    <label style={{ display: 'grid', gap: SPACE.xs }}>
      <span style={LABEL_STYLE}>{label}</span>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(e) => { onChange(e.target.value); }}
        style={{ ...FIELD_STYLE, fontFamily: 'var(--font-mono)' }}
      />
      <span style={{ fontSize: TEXT.micro, color: 'var(--text-muted)' }}>{hint}</span>
    </label>
  );
}

type PointReadoutProps = {
  readonly label: string;
  readonly point: PlanPoint | null;
  readonly empty: string;
};

function PointReadout({ label, point, empty }: PointReadoutProps): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.md, fontSize: TEXT.small }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
        {point === null ? empty : `${point.x_px.toFixed(0)} · ${point.y_px.toFixed(0)}`}
      </span>
    </div>
  );
}
