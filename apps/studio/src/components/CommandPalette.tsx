import { type JSX, useEffect, useMemo, useRef, useState } from 'react';
import type { ViewId } from '../views.js';
import { useI18n } from '../i18n/useI18n.js';
import { commandEntries, searchCommands } from './command-search.js';
import { Icon, MODULE_ICONS } from './Icon.js';
import { SPACE, TEXT, LABEL_STYLE, NUMERIC_STYLE } from './ui/index.js';

type CommandPaletteProps = {
  readonly onNavigate: (view: ViewId) => void;
  readonly onClose: () => void;
};

const LIST_ID = 'az-command-list';

/**
 * La palette « Rechercher, aller à… » (Ctrl K). Une liste filtrée des
 * modules et des écrans ; flèches pour choisir, Entrée pour ouvrir, Échap
 * pour fermer. Le champ garde le focus, la ligne choisie est annoncée par
 * `aria-activedescendant`.
 */
export function CommandPalette({ onNavigate, onClose }: CommandPaletteProps): JSX.Element {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const entries = useMemo(() => commandEntries(), []);
  const results = useMemo(() => searchCommands(entries, query, k => t(k)), [entries, query, t]);
  const current = Math.min(index, Math.max(0, results.length - 1));

  useEffect(() => { input.current?.focus(); }, []);

  function open(view: ViewId): void {
    onNavigate(view);
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex(Math.min(current + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex(Math.max(current - 1, 0));
    } else if (e.key === 'Enter') {
      const chosen = results[current];
      if (chosen !== undefined) open(chosen.view);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay-scrim)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '12vh',
        zIndex: 50,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('shell.search.aria')}
        onMouseDown={e => { e.stopPropagation(); }}
        style={{
          width: 'min(600px, calc(100vw - 32px))',
          background: 'var(--surface-panel)',
          border: '1px solid var(--border-strong)',
          borderRadius: 6,
          boxShadow: 'var(--shadow-dialog)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: SPACE.md,
          padding: '12px 16px', borderBottom: '1px solid var(--border-hairline)',
          color: 'var(--text-muted)',
        }}>
          <Icon name="search" size={18} />
          <input
            ref={input}
            value={query}
            onChange={e => { setQuery(e.target.value); setIndex(0); }}
            onKeyDown={onKeyDown}
            placeholder={t('shell.search.placeholder')}
            aria-label={t('shell.search.aria')}
            role="combobox"
            aria-expanded="true"
            aria-controls={LIST_ID}
            aria-activedescendant={results.length > 0 ? `${LIST_ID}-${String(current)}` : undefined}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              font: 'inherit', fontSize: TEXT.lead, color: 'var(--text-primary)',
            }}
          />
          <kbd style={{ ...NUMERIC_STYLE, fontSize: TEXT.micro }}>{t('shell.search.hint.close')}</kbd>
        </div>
        <ul id={LIST_ID} role="listbox" style={{ listStyle: 'none', margin: 0, padding: SPACE.xs, maxHeight: 360, overflowY: 'auto' }}>
          {results.map((entry, i) => (
            <li
              key={`${entry.kind}-${entry.view}`}
              id={`${LIST_ID}-${String(i)}`}
              role="option"
              aria-selected={i === current}
              onMouseEnter={() => { setIndex(i); }}
              onClick={() => { open(entry.view); }}
              style={{
                display: 'flex', alignItems: 'center', gap: SPACE.md,
                padding: '8px 12px', borderRadius: 4, cursor: 'pointer',
                background: i === current ? 'var(--surface-sunken)' : 'transparent',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>
                <Icon name={entry.moduleNumber === null ? 'home' : (MODULE_ICONS[entry.moduleNumber] ?? 'file')} size={18} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: TEXT.body }}>{t(entry.labelKey)}</span>
                {entry.kind === 'screen' && entry.moduleNameKey !== null && (
                  <span style={{ display: 'block', fontSize: TEXT.micro, color: 'var(--text-muted)' }}>
                    {t('shell.search.module', { number: entry.moduleNumber ?? '', module: t(entry.moduleNameKey) })}
                  </span>
                )}
              </span>
              <span style={LABEL_STYLE}>
                {t(entry.kind === 'module' ? 'shell.search.kind.module' : 'shell.search.kind.screen')}
              </span>
            </li>
          ))}
        </ul>
        {results.length === 0 && (
          <p style={{ padding: '24px 16px', textAlign: 'center', fontSize: TEXT.body, color: 'var(--text-muted)' }}>
            {t('shell.search.empty')}
          </p>
        )}
        <div style={{
          display: 'flex', gap: SPACE.lg, padding: '8px 16px',
          borderTop: '1px solid var(--border-hairline)', background: 'var(--surface-page)',
          fontSize: TEXT.micro, color: 'var(--text-muted)',
        }}>
          <span>{t('shell.search.hint.move')}</span>
          <span>{t('shell.search.hint.open')}</span>
        </div>
      </div>
    </div>
  );
}
