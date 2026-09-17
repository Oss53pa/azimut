import { type JSX, useMemo, useState } from 'react';
import type { GraphNode, PlanPixelPoint, SiteData } from '@azimut/core-model';
import { useI18n } from '../../i18n/useI18n.js';
import {
  evaluateMeasuredCalibration,
  landmarkNodes,
  MIN_CONTROL_POINTS,
  type PairDraft,
} from '../../domain/measured-calibration.js';
import {
  Panel, PanelGrid, DataTable, Note, MetricRow,
  SPACE, BUTTON_STYLE, type Column, type Metric,
} from '../../components/ui/index.js';
import { FindingList } from '../message-schedule/FindingList.js';
import { Field } from './Field.js';
import { MeasuredSurface } from './MeasuredSurface.js';
import { SURFACE_HEIGHT, SURFACE_WIDTH } from './surface-projection.js';

type MeasuredCalibrationPanelProps = {
  readonly site: SiteData;
  readonly levelId: string;
};

type ResidualRow = {
  readonly id: string;
  readonly label: string;
  readonly residual_mm: number | null;
};

/**
 * Calage mesuré — complément atelier M1.4, section de l'écran M2.
 *
 * L'opérateur arme un amer, le pose sur le fond, recommence. L'ajustement
 * tourne à chaque pose et rend ses résidus.
 *
 * Les deux tolérances sont saisies, sans valeur par défaut. Tant qu'elles sont
 * vides, l'écran affiche les résidus et le dit : il ne rend aucun verdict.
 * L'origine de ces seuils — norme opposable ou paramètre de produit — n'est pas
 * tranchée, et INV-5 interdit d'en inscrire un dans le code. Un défaut affiché
 * passerait pour une valeur retenue.
 */
export function MeasuredCalibrationPanel(
  { site, levelId }: MeasuredCalibrationPanelProps,
): JSX.Element {
  const { t } = useI18n();
  const [drafts, setDrafts] = useState<readonly PairDraft[]>([]);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [meanTolerance, setMeanTolerance] = useState('');
  const [pointTolerance, setPointTolerance] = useState('');
  // E6.2 — saisie numérique du point, équivalent clavier du clic.
  const [entryX, setEntryX] = useState('');
  const [entryY, setEntryY] = useState('');
  const [announcement, setAnnouncement] = useState('');

  const landmarks = useMemo(() => landmarkNodes(site, levelId), [site, levelId]);
  const armed: GraphNode | null = landmarks.find((n) => n.id === armedId) ?? null;

  const tolerance = useMemo(() => {
    const mean = Number(meanTolerance.replace(',', '.'));
    const point = Number(pointTolerance.replace(',', '.'));
    if (meanTolerance.trim() === '' || pointTolerance.trim() === '') return null;
    if (!Number.isFinite(mean) || !Number.isFinite(point)) return null;
    if (mean <= 0 || point <= 0) return null;
    return { mean_m: mean, point_m: point };
  }, [meanTolerance, pointTolerance]);

  const state = useMemo(
    () => evaluateMeasuredCalibration(site, drafts, tolerance),
    [site, drafts, tolerance],
  );

  function place(point: PlanPixelPoint): void {
    if (armedId === null) return;
    const id = armedId;
    const label = landmarks.find((n) => n.id === id)?.label ?? id;
    setDrafts((current) => [...current.filter((d) => d.node_id !== id), { node_id: id, source: point }]);
    setArmedId(null);
    setEntryX('');
    setEntryY('');
    // E6.3 — le résultat de l'opération est annoncé, pas seulement dessiné.
    setAnnouncement(t('measured.announce.placed', {
      landmark: label,
      x: Math.round(point.x_px),
      y: Math.round(point.y_px),
    }));
  }

  /** Équivalent clavier du clic : le point saisi au chiffre près (E6.2). */
  function placeFromEntry(): void {
    // `Number('')` vaut 0, et passe donc le contrôle de finitude : sans le
    // rejet du champ vide, un bouton pressé sans rien saisir poserait l'amer à
    // l'origine du fond, et cet amer faux entrerait dans l'ajustement.
    if (entryX.trim() === '' || entryY.trim() === '') return;
    const x = Number(entryX.replace(',', '.'));
    const y = Number(entryY.replace(',', '.'));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    place({ x_px: x, y_px: y });
  }

  function arm(nodeId: string): void {
    const next = armedId === nodeId ? null : nodeId;
    setArmedId(next);
    const existing = next === null ? undefined : drafts.find((d) => d.node_id === next);
    // Valeur exacte, non arrondie : un amer posé au clic tombe sur une abscisse
    // fractionnaire, et le réarmer pour vérification le déplacerait d'un demi
    // pixel à chaque fois, en changeant l'ajustement sans que rien ne le dise.
    setEntryX(existing === undefined ? '' : String(existing.source.x_px));
    setEntryY(existing === undefined ? '' : String(existing.source.y_px));
  }

  function reset(): void {
    setDrafts([]);
    setArmedId(null);
    setEntryX('');
    setEntryY('');
    setAnnouncement(t('measured.announce.reset'));
  }

  const residualById = new Map(
    (state.calibration?.residuals ?? []).map((r) => [r.id, r.residual_m]),
  );

  const rows: readonly ResidualRow[] = landmarks
    .filter((node) => drafts.some((d) => d.node_id === node.id))
    .map((node) => {
      const residual = residualById.get(node.id);
      return {
        id: node.id,
        label: node.label,
        residual_mm: residual === undefined ? null : Math.round(residual * 1000),
      };
    });

  const columns: readonly Column<ResidualRow>[] = [
    { id: 'label', header: t('measured.col.landmark'), cell: (row) => row.label },
    {
      id: 'residual',
      header: t('measured.col.residual'),
      numeric: true,
      cell: (row) => (row.residual_mm === null ? '—' : String(row.residual_mm)),
    },
  ];

  const metrics: readonly Metric[] = [
    {
      id: 'pairs',
      label: t('measured.metric.pairs'),
      value: String(drafts.length),
      note: state.missing_pairs > 0
        ? t('measured.metric.pairs.missing', { count: state.missing_pairs })
        : t('measured.metric.pairs.note', { minimum: MIN_CONTROL_POINTS }),
    },
    {
      id: 'mean',
      label: t('measured.metric.mean'),
      value: state.calibration === null ? '—' : String(Math.round(state.calibration.mean_residual_m * 1000)),
      note: t('measured.unit.mm'),
    },
    {
      id: 'max',
      label: t('measured.metric.max'),
      value: state.calibration === null ? '—' : String(Math.round(state.calibration.max_residual_m * 1000)),
      note: t('measured.unit.mm'),
    },
  ];

  return (
    <>
      <MetricRow metrics={metrics} />
      <PanelGrid>
        <Panel
          title={t('measured.panel.surface')}
          note={t('measured.panel.surface.note', { placed: drafts.length, total: landmarks.length })}
        >
          <div style={{ border: '1px solid var(--border-hairline)' }}>
            <MeasuredSurface
              site={site}
              levelId={levelId}
              drafts={drafts}
              landmarks={landmarks}
              armed={armed}
              onPlace={place}
            />
          </div>
          <Note>
            {armed === null
              ? t('measured.surface.pick')
              : t('measured.surface.place', { landmark: armed.label })}
          </Note>
          <Note>
            {t('measured.surface.hint', { width: SURFACE_WIDTH, height: SURFACE_HEIGHT })}
          </Note>
          <button type="button" style={BUTTON_STYLE} onClick={reset} disabled={drafts.length === 0}>
            {t('measured.action.reset')}
          </button>
        </Panel>

        <Panel title={t('measured.panel.landmarks')}>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: SPACE.xs }}>
            {landmarks.map((node) => {
              const done = drafts.some((d) => d.node_id === node.id);
              return (
                <li key={node.id}>
                  <button
                    type="button"
                    style={{
                      ...BUTTON_STYLE,
                      width: '100%',
                      textAlign: 'left',
                      borderColor: armedId === node.id ? 'var(--accent)' : undefined,
                    }}
                    aria-pressed={armedId === node.id}
                    onClick={() => { arm(node.id); }}
                  >
                    {done ? '• ' : '◦ '}{node.label}
                  </button>
                </li>
              );
            })}
          </ul>
          {landmarks.length === 0 && (
            <Note>{t('measured.landmarks.empty')}</Note>
          )}

          {armed !== null && (
            <div style={{ display: 'grid', gap: SPACE.md, marginTop: SPACE.md }}>
              <Field
                label={t('measured.field.x')}
                hint={t('measured.field.px')}
                value={entryX}
                onChange={setEntryX}
                inputMode="decimal"
              />
              <Field
                label={t('measured.field.y')}
                hint={t('measured.field.px')}
                value={entryY}
                onChange={setEntryY}
                inputMode="decimal"
              />
              <button type="button" style={BUTTON_STYLE} onClick={placeFromEntry}>
                {t('measured.action.place', { landmark: armed.label })}
              </button>
              <Note>{t('measured.entry.note')}</Note>
            </div>
          )}
        </Panel>
      </PanelGrid>

      <PanelGrid>
        <Panel title={t('measured.panel.tolerance')}>
          <div style={{ display: 'grid', gap: SPACE.md }}>
            <Field
              label={t('measured.field.mean')}
              hint={t('measured.field.unit')}
              value={meanTolerance}
              onChange={setMeanTolerance}
              inputMode="decimal"
            />
            <Field
              label={t('measured.field.point')}
              hint={t('measured.field.unit')}
              value={pointTolerance}
              onChange={setPointTolerance}
              inputMode="decimal"
            />
          </div>
          <Note>{t('measured.tolerance.note')}</Note>
          {state.unjudged && <Note>{t('measured.tolerance.unjudged')}</Note>}
        </Panel>

        <Panel title={t('measured.panel.residuals')}>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            empty={t('measured.residuals.empty')}
          />
          <Note>{t('measured.residuals.note')}</Note>
        </Panel>
      </PanelGrid>

      <Panel title={t('measured.panel.findings')}>
        <FindingList findings={state.findings} empty={t('measured.findings.empty')} />
      </Panel>

      <p
        role="status"
        aria-live="polite"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
      >
        {announcement}
      </p>
    </>
  );
}
