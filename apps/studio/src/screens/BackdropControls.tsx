import { type JSX } from 'react';
import { SPACE, TEXT } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import { OPACITY_STEP } from '../viewport/backdrop-settings.js';
import type { BackdropSettings } from '../viewport/backdrop-settings.js';

/**
 * J1.4 (partie J) — les réglages du fond de décalque, au clavier comme au
 * pointeur (E6.2) : un curseur d'opacité, une case pour les formes tracées.
 */
export function BackdropControls(props: {
  readonly id: string;
  readonly settings: BackdropSettings;
  readonly hasBackground: boolean;
  readonly onChange: (settings: BackdropSettings) => void;
}): JSX.Element {
  const { t } = useI18n();
  const { settings } = props;
  const percent = Math.round(settings.opacity * 100);
  return (
    <div role="group" aria-label={t('ink.backdrop.controls')}
      style={{ display: 'flex', gap: SPACE.md, flexWrap: 'wrap', alignItems: 'center', fontSize: TEXT.small }}>
      {props.hasBackground && (
        <label htmlFor={`${props.id}-opacity`} style={{ display: 'inline-flex', gap: SPACE.sm, alignItems: 'center' }}>
          {t('ink.backdrop.opacity')}
          <input id={`${props.id}-opacity`} type="range" min={0} max={1} step={OPACITY_STEP}
            value={settings.opacity}
            onChange={event => { props.onChange({ ...settings, opacity: Number(event.target.value) }); }} />
          <output htmlFor={`${props.id}-opacity`} style={{ fontVariantNumeric: 'tabular-nums' }}>{`${String(percent)} %`}</output>
        </label>
      )}
      <label htmlFor={`${props.id}-shapes`} style={{ display: 'inline-flex', gap: SPACE.xs, alignItems: 'center' }}>
        <input id={`${props.id}-shapes`} type="checkbox" checked={settings.showShapes}
          onChange={event => { props.onChange({ ...settings, showShapes: event.target.checked }); }} />
        {t('ink.backdrop.show_shapes')}
      </label>
    </div>
  );
}
