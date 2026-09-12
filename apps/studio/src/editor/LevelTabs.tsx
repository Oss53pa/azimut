/**
 * Level selector for the editor.
 *
 * Changing the active level is a view change: it never enters the undo
 * stack (E5.2) and never alters the document.
 */

import type { JSX } from 'react';
import type { Level } from '@azimut/core-model';
import { useI18n } from '../i18n/useI18n.js';

type LevelTabsProps = {
  readonly levels: readonly Level[];
  readonly selectedId: string;
  readonly onSelect: (levelId: string) => void;
};

const BAR_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: '8px 12px',
  flexShrink: 0,
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 16px',
    border: '1px solid var(--border-hairline)',
    borderRadius: 'var(--radius-floating)',
    background: active ? 'var(--surface-sunken)' : 'var(--surface-panel)',
    color: active ? 'var(--accent)' : 'var(--text-primary)',
    fontFamily: 'inherit',
    fontWeight: active ? 500 : 400,
    fontSize: 13,
    cursor: 'pointer',
  };
}

export function LevelTabs({
  levels,
  selectedId,
  onSelect,
}: LevelTabsProps): JSX.Element {
  const { t } = useI18n();
  return (
    <div style={BAR_STYLE} role="tablist" aria-label={t('editor.levels.aria')}>
      {levels.map(level => {
        const active = level.id === selectedId;
        return (
          <button
            key={level.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(level.id)}
            style={tabStyle(active)}
          >
            {level.name}
          </button>
        );
      })}
    </div>
  );
}
