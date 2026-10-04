import { type JSX } from 'react';
import { Button, SPACE } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';

/**
 * E6.2 et E3.3 — la vue se règle aussi au clavier : « Toute opération
 * réalisable au pointeur l'est au clavier ». La molette et le déplacement au
 * pointeur ont donc leurs boutons, atteignables à la tabulation.
 */
export function ZoneViewControls(props: {
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onRefit: () => void;
}): JSX.Element {
  const { t } = useI18n();
  return (
    <div role="group" aria-label={t('ink.view.controls')} style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap' }}>
      <Button rank="secondary" onClick={props.onZoomIn}>{t('ink.view.zoom_in')}</Button>
      <Button rank="secondary" onClick={props.onZoomOut}>{t('ink.view.zoom_out')}</Button>
      <Button rank="secondary" onClick={props.onRefit}>{t('ink.view.refit')}</Button>
    </div>
  );
}
