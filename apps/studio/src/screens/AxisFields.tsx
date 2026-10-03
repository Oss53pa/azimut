import { type JSX } from 'react';
import { NumericField, Button, StateBanner, SPACE } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import type { Point } from '@azimut/core-model';

/** Ce qu'une passe d'axe a produit, tel que l'écran le rapporte. */
export type AxisReport = {
  readonly nodes: number;
  readonly edges: number;
  readonly reused: number;
  readonly skipped: number;
};

/**
 * M4 (partie M) — l'axe de circulation, saisi point par point.
 *
 * L'action est refusée sous deux points : un axe sans segment ne trace rien,
 * et laisser presser un bouton qui ne fera rien est pire que de le refuser en
 * le disant. Le compte rendu nomme ce que la passe a repris et ce qu'elle a
 * passé — « sans doublon » ne se voit pas autrement, le graphe ayant la même
 * allure qu'il ait doublé un nœud ou non.
 */
export function AxisFields({ axis, onPoint, onAdd, onRemove, onDraw, report }: {
  readonly axis: readonly Point[];
  readonly onPoint: (index: number, coordinate: 'x_m' | 'y_m', value: number | null) => void;
  readonly onAdd: () => void;
  readonly onRemove: () => void;
  readonly onDraw: () => void;
  readonly report: AxisReport | null;
}): JSX.Element {
  const { t } = useI18n();
  return (
    <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
      <legend style={{ padding: 0, marginBottom: SPACE.sm }}>{t('graph.axis.title')}</legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE.sm, alignItems: 'flex-end' }}>
        {axis.map((point, index) => (
          <div key={`axis-${String(index)}`} style={{ display: 'flex', gap: SPACE.sm }}>
            <NumericField
              label={t('graph.axis.point_x', { n: index + 1 })}
              unit={t('unit.metre')}
              value={point.x_m}
              step={0.001}
              onChange={value => { onPoint(index, 'x_m', value); }}
            />
            <NumericField
              label={t('graph.axis.point_y', { n: index + 1 })}
              unit={t('unit.metre')}
              value={point.y_m}
              step={0.001}
              onChange={value => { onPoint(index, 'y_m', value); }}
            />
          </div>
        ))}
      </div>
      <p style={{ margin: `${SPACE.sm} 0 0`, color: 'var(--text-muted)' }}>
        {t('graph.axis.hint')}
      </p>
      <div style={{ display: 'flex', gap: SPACE.sm, marginTop: SPACE.sm }}>
        <Button rank="secondary" onClick={onAdd}>{t('graph.axis.add')}</Button>
        <Button rank="secondary" onClick={onRemove} disabled={axis.length <= 2}>
          {t('graph.axis.remove')}
        </Button>
        <Button rank="primary" onClick={onDraw} disabled={axis.length < 2}>
          {t('graph.axis.draw')}
        </Button>
      </div>
      {report !== null && (
        <div style={{ marginTop: SPACE.sm }}>
          <StateBanner
            severity="info"
            message={t('graph.axis.done', {
              nodes: report.nodes, edges: report.edges,
              reused: report.reused, skipped: report.skipped,
            })}
          />
        </div>
      )}
    </fieldset>
  );
}
