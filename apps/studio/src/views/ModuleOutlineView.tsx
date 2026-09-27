import { type JSX } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import type { UiMessageKey } from '../i18n/messages.js';
import type { ViewId } from '../views.js';
import { PRODUCT_MODULES, ENGINE_LABEL_KEYS, type EngineState } from '../product-map.js';
import {
  ScreenHeader, Panel, PanelGrid, Tag, Note, Button, SPACE, TEXT, type Severity,
} from '../components/ui/index.js';

export type OutlineLink = {
  readonly labelKey: UiMessageKey;
  readonly noteKey: UiMessageKey;
  readonly view: ViewId;
};

type ModuleOutlineViewProps = {
  readonly moduleNumber: string;
  /** Ce qui existe déjà ailleurs dans l'application et sert ce module. */
  readonly available: readonly OutlineLink[];
  /** Les écrans que la maquette prévoit et qu'aucun code ne porte encore. */
  readonly planned: readonly UiMessageKey[];
  readonly noteKey: UiMessageKey;
  readonly onNavigate: (view: ViewId) => void;
};

function engineSeverity(engine: EngineState): Severity {
  switch (engine) {
    case 'complete': return 'valid';
    case 'partial': return 'warning';
    case 'absent': return 'blocking';
  }
}

/**
 * L'écran d'un module dont la maquette dessine les écrans et dont le code ne
 * porte encore qu'une partie. Il dit ce qui existe, où le trouver, et nomme
 * ce qui manque au lieu de le mimer : aucune donnée n'y est inventée.
 */
export function ModuleOutlineView(
  { moduleNumber, available, planned, noteKey, onNavigate }: ModuleOutlineViewProps,
): JSX.Element {
  const { t } = useI18n();
  const module = PRODUCT_MODULES.find(m => m.number === moduleNumber);
  if (module === undefined) return <Note>{t(noteKey)}</Note>;

  return (
    <div>
      <ScreenHeader
        eyebrow={t('outline.eyebrow', { number: module.number })}
        title={t(module.nameKey)}
      >
        <Tag label={t(ENGINE_LABEL_KEYS[module.engine])} severity={engineSeverity(module.engine)} />
      </ScreenHeader>
      <p style={{ margin: `0 0 ${String(SPACE.lg)}px`, fontSize: TEXT.body, color: 'var(--text-secondary)' }}>
        {t(module.summaryKey)}
      </p>
      <PanelGrid min={320}>
        <Panel title={t('outline.available')} note={String(available.length)}>
          {available.length === 0
            ? <p style={{ fontSize: TEXT.small, color: 'var(--text-muted)' }}>{t('outline.available.none')}</p>
            : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: SPACE.md }}>
                {available.map(link => (
                  <li key={link.view} style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: TEXT.body }}>{t(link.labelKey)}</span>
                      <span style={{ display: 'block', fontSize: TEXT.micro, color: 'var(--text-muted)' }}>
                        {t(link.noteKey)}
                      </span>
                    </span>
                    <Button onClick={() => { onNavigate(link.view); }}>{t('outline.open')}</Button>
                  </li>
                ))}
              </ul>
            )}
        </Panel>
        <Panel title={t('outline.planned')} note={String(planned.length)}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: SPACE.sm }}>
            {planned.map(key => (
              <li key={key} style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
                <span style={{ flex: 1, fontSize: TEXT.body }}>{t(key)}</span>
                <span style={{ fontSize: TEXT.micro, color: 'var(--text-muted)' }}>{t('outline.planned.state')}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </PanelGrid>
      <Note>{t(noteKey)}</Note>
    </div>
  );
}
