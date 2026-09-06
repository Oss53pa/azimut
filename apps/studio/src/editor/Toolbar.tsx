/**
 * E7.1 — Toolbar component.
 *
 * Renders the tool palette grouped by function. Each button
 * dispatches set_tool to the tool reducer. The active tool is
 * highlighted. Keyboard shortcuts are shown in tooltips.
 *
 * Groups (from TOOL_REGISTRY):
 *   navigation → selection → shape → path → annotation
 *
 * Uses design-token CSS variables exclusively (A2.4).
 */

import { type JSX, useCallback, useEffect } from 'react';
import type { ToolId, ToolAction } from './tool-state.js';
import { TOOL_REGISTRY } from './tool-state.js';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ToolbarProps = {
  readonly currentTool: ToolId;
  readonly dispatchTool: (action: ToolAction) => void;
};

// ---------------------------------------------------------------------------
// Styles (inline, no hardcoded colors)
// ---------------------------------------------------------------------------

const TOOLBAR_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  padding: '6px',
  background: 'var(--surface-panel)',
  borderRight: '1px solid var(--border-hairline)',
  minWidth: '44px',
};

const GROUP_DIVIDER_STYLE: React.CSSProperties = {
  height: '1px',
  background: 'var(--border-hairline)',
  margin: '4px 0',
};

function buttonStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: active ? 500 : 400,
    background: active ? 'var(--surface-sunken)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-primary)',
  };
}

// ---------------------------------------------------------------------------
// Tool icon abbreviations (minimal, no SVG icons needed yet)
// ---------------------------------------------------------------------------

const TOOL_ABBR: Record<ToolId, string> = {
  select: 'V',
  direct_select: 'A',
  hand: 'H',
  zoom_tool: 'Z',
  rectangle: 'R',
  ellipse: 'E',
  regular_polygon: 'Pg',
  polyline: 'P',
  bezier: 'Bz',
  text: 'T',
  dimension: 'Ct',
  measure: 'Ms',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Toolbar({ currentTool, dispatchTool }: ToolbarProps): JSX.Element {
  const setTool = useCallback((tool: ToolId) => {
    dispatchTool({ type: 'set_tool', tool });
  }, [dispatchTool]);

  // Keyboard shortcuts for tools
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Skip if in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      // Skip if any modifier is held
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const match = TOOL_REGISTRY.find(t => t.shortcutKey === e.key.toLowerCase());
      if (match !== undefined) {
        e.preventDefault();
        setTool(match.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool]);

  // Group tools with dividers between groups
  const groups = ['navigation', 'selection', 'shape', 'path', 'annotation'] as const;
  const elements: JSX.Element[] = [];

  for (const group of groups) {
    const tools = TOOL_REGISTRY.filter(t => t.group === group);
    if (tools.length === 0) continue;

    if (elements.length > 0) {
      elements.push(<div key={`div-${group}`} style={GROUP_DIVIDER_STYLE} />);
    }

    for (const tool of tools) {
      const shortcut = tool.shortcutKey !== null ? ` (${tool.shortcutKey.toUpperCase()})` : '';
      elements.push(
        <button
          key={tool.id}
          type="button"
          style={buttonStyle(currentTool === tool.id)}
          title={`${tool.label}${shortcut}`}
          aria-label={tool.label}
          aria-pressed={currentTool === tool.id}
          onClick={() => setTool(tool.id)}
        >
          {TOOL_ABBR[tool.id]}
        </button>,
      );
    }
  }

  return (
    <div style={TOOLBAR_STYLE} role="toolbar" aria-label="Outils">
      {elements}
    </div>
  );
}
