import { type JSX } from 'react';
import type { ViewId } from '../views.js';
import { useI18n } from '../i18n/useI18n.js';
import { moduleOfView } from '../product-map.js';
import { SPACE, TEXT } from './ui/index.js';

type ScreenTrailProps = {
  readonly view: ViewId;
  readonly onNavigate: (view: ViewId) => void;
};

/**
 * Le fil d'Ariane de la maquette : numéro du module, nom du module, écran.
 * Le nom du module ramène à son écran d'entrée. Hors module (accueil, carte
 * du produit), il n'y a pas de fil.
 */
export function ScreenTrail({ view, onNavigate }: ScreenTrailProps): JSX.Element | null {
  const { t } = useI18n();
  const module = moduleOfView(view);
  if (module === undefined) return null;
  const screen = module.screens.find(s => s.view === view);

  return (
    <nav
      aria-label={t('shell.trail.aria')}
      style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.lg }}
    >
      <span aria-hidden="true" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 32, height: 28, padding: '0 6px', borderRadius: 4,
        background: 'var(--text-primary)', color: 'var(--surface-panel)',
        fontSize: TEXT.small, fontWeight: 500,
      }}>
        {module.number}
      </span>
      <ol style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, listStyle: 'none', margin: 0, padding: 0 }}>
        <li>
          {screen === undefined
            ? <span style={{ fontSize: TEXT.lead }} aria-current="page">{t(module.nameKey)}</span>
            : (
              <button
                type="button"
                onClick={() => { onNavigate(module.entry); }}
                style={{
                  border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
                  font: 'inherit', fontSize: TEXT.body, color: 'var(--text-secondary)',
                }}
              >
                {t(module.nameKey)}
              </button>
            )}
        </li>
        {screen !== undefined && (
          <>
            <li aria-hidden="true" style={{ color: 'var(--text-muted)' }}>/</li>
            <li aria-current="page" style={{ fontSize: TEXT.lead }}>{t(screen.labelKey)}</li>
          </>
        )}
      </ol>
    </nav>
  );
}
