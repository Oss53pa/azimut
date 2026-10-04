import { type CSSProperties, type JSX } from 'react';
import { Button, SPACE, TEXT } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import type { UiMessageKey } from '../i18n/messages.js';
import { SKETCH_COLORS, SKETCH_TOOLS } from '../state/sketch.js';
import type { SketchColor, SketchTool } from '../state/sketch.js';

/**
 * J3.2 (partie J) — les outils de l'esquisse : crayon, feutre, marqueur
 * translucide, gomme, et la palette propre à l'esquisse.
 *
 * L'outil et la couleur actifs se lisent au texte et à l'état ARIA, jamais à
 * la seule teinte (M7.7, partie M) : chaque pastille porte son nom.
 */
export type SketchPen = SketchTool | 'eraser';

export type SketchToolbarProps = {
  readonly active: boolean;
  readonly onActive: (active: boolean) => void;
  readonly pen: SketchPen;
  readonly onPen: (pen: SketchPen) => void;
  readonly color: SketchColor;
  readonly onColor: (color: SketchColor) => void;
  readonly visible: boolean;
  readonly onVisible: (visible: boolean) => void;
  readonly strokeCount: number;
};

const PENS: readonly SketchPen[] = [...SKETCH_TOOLS, 'eraser'];

const PEN_LABEL: Readonly<Record<SketchPen, UiMessageKey>> = {
  pencil: 'ink.sketch.tool.pencil',
  felt: 'ink.sketch.tool.felt',
  marker: 'ink.sketch.tool.marker',
  eraser: 'ink.sketch.tool.eraser',
};

const COLOR_LABEL: Readonly<Record<SketchColor, UiMessageKey>> = {
  graphite: 'ink.sketch.color.graphite',
  brick: 'ink.sketch.color.brick',
  ultramarine: 'ink.sketch.color.ultramarine',
  fir: 'ink.sketch.color.fir',
};

function chip(selected: boolean): CSSProperties {
  return {
    font: 'inherit', fontSize: TEXT.small, display: 'inline-flex', alignItems: 'center', gap: SPACE.xs,
    padding: '4px 8px', borderRadius: 4, cursor: 'pointer',
    // Le choix actif porte une bordure pleine : la distinction tient au trait.
    border: `1px solid ${selected ? 'var(--border-strong)' : 'var(--border-hairline)'}`,
    background: selected ? 'var(--surface-sunken)' : 'transparent',
    color: 'var(--text-primary)',
  };
}

export function SketchToolbar(props: SketchToolbarProps): JSX.Element {
  const { t } = useI18n();
  return (
    <div role="group" aria-label={t('ink.sketch.toolbar')}
      style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
      <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" aria-pressed={props.active} style={chip(props.active)}
          onClick={() => { props.onActive(!props.active); }}>
          {t('ink.sketch.mode')}
        </button>
        {props.active && PENS.map(pen => (
          <button key={pen} type="button" aria-pressed={props.pen === pen} style={chip(props.pen === pen)}
            onClick={() => { props.onPen(pen); }}>
            {t(PEN_LABEL[pen])}
          </button>
        ))}
        <Button rank="secondary" onClick={() => { props.onVisible(!props.visible); }}>
          {t(props.visible ? 'ink.sketch.hide' : 'ink.sketch.show')}
        </Button>
        <span style={{ fontSize: TEXT.small, color: 'var(--text-secondary)' }}>
          {t('ink.sketch.count', { count: props.strokeCount })}
        </span>
      </div>
      {props.active && (
        <div role="group" aria-label={t('ink.sketch.colors')}
          style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap', alignItems: 'center' }}>
          {SKETCH_COLORS.map(color => (
            <button key={color} type="button" aria-pressed={props.color === color} style={chip(props.color === color)}
              onClick={() => { props.onColor(color); }}>
              <span aria-hidden="true" style={{
                width: 12, height: 12, borderRadius: 6, background: `var(--sketch-${color})`, display: 'inline-block',
              }} />
              {t(COLOR_LABEL[color])}
            </button>
          ))}
          <span style={{ fontSize: TEXT.small, color: 'var(--text-muted)' }}>{t('ink.sketch.mode_hint')}</span>
        </div>
      )}
    </div>
  );
}
