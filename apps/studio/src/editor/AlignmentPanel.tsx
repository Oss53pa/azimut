/**
 * E7.3 — Alignment and distribution panel.
 *
 * Appears when 2+ items are selected. Provides buttons for
 * alignment (left, center, right, top, middle, bottom),
 * distribution (horizontal, vertical), and z-order operations.
 *
 * This is a view component — it fires callbacks, never mutates
 * geometry directly (INV-2). The caller applies results via
 * Commands (E5).
 *
 * Uses design-token CSS variables exclusively (A2.4).
 */

import type { JSX } from 'react';
import type { AlignAxis, DistributeAxis, ZOrderOp } from './alignment.js';
import { useI18n } from '../i18n/useI18n.js';
import type { UiMessageKey } from '../i18n/messages.js';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type AlignmentPanelProps = {
  /** Number of selected items — panel hides when < 2. */
  readonly selectedCount: number;
  /** Called when an alignment button is clicked. */
  readonly onAlign: (axis: AlignAxis) => void;
  /** Called when a distribute button is clicked. */
  readonly onDistribute: (axis: DistributeAxis) => void;
  /** Called when a z-order button is clicked. */
  readonly onZOrder: (op: ZOrderOp) => void;
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const PANEL_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 8px',
  background: 'var(--surface-panel)',
  borderTop: '1px solid var(--border-hairline)',
  fontSize: 11,
  flexShrink: 0,
};

const BUTTON_STYLE: React.CSSProperties = {
  border: '1px solid var(--border-hairline)',
  background: 'var(--surface-panel)',
  cursor: 'pointer',
  fontSize: 11,
  padding: '3px 6px',
  borderRadius: 3,
  color: 'var(--text-secondary)',
  lineHeight: 1,
};

const SEPARATOR_STYLE: React.CSSProperties = {
  width: 1,
  height: 18,
  background: 'var(--border-hairline)',
  margin: '0 4px',
  flexShrink: 0,
};

const LABEL_STYLE: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 10,
  marginRight: 2,
  flexShrink: 0,
};

// ---------------------------------------------------------------------------
// Button config
// ---------------------------------------------------------------------------

type BtnConfig = {
  readonly label: string;
  readonly titleKey: UiMessageKey;
};

const ALIGN_BUTTONS: readonly (BtnConfig & { axis: AlignAxis })[] = [
  { axis: 'left', label: '⫷', titleKey: 'editor.align.title.left' },
  { axis: 'center_h', label: '⫿', titleKey: 'editor.align.title.center_h' },
  { axis: 'right', label: '⫸', titleKey: 'editor.align.title.right' },
  { axis: 'top', label: '⊤', titleKey: 'editor.align.title.top' },
  { axis: 'center_v', label: '⊖', titleKey: 'editor.align.title.center_v' },
  { axis: 'bottom', label: '⊥', titleKey: 'editor.align.title.bottom' },
];

const DISTRIBUTE_BUTTONS: readonly (BtnConfig & { axis: DistributeAxis })[] = [
  { axis: 'horizontal', label: '⇔', titleKey: 'editor.align.title.dist_h' },
  { axis: 'vertical', label: '⇕', titleKey: 'editor.align.title.dist_v' },
];

const ZORDER_BUTTONS: readonly (BtnConfig & { op: ZOrderOp })[] = [
  { op: 'bring_front', label: '⤒', titleKey: 'editor.align.title.front' },
  { op: 'bring_forward', label: '↑', titleKey: 'editor.align.title.forward' },
  { op: 'send_backward', label: '↓', titleKey: 'editor.align.title.backward' },
  { op: 'send_back', label: '⤓', titleKey: 'editor.align.title.back' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AlignmentPanel({
  selectedCount,
  onAlign,
  onDistribute,
  onZOrder,
}: AlignmentPanelProps): JSX.Element | null {
  const { t } = useI18n();
  if (selectedCount < 2) return null;

  const canDistribute = selectedCount >= 3;

  return (
    <div style={PANEL_STYLE} role="toolbar" aria-label={t('editor.align.aria')}>
      {/* Alignment */}
      <span style={LABEL_STYLE}>{t('editor.align.section.align')}</span>
      {ALIGN_BUTTONS.map(btn => (
        <button
          key={btn.axis}
          type="button"
          style={BUTTON_STYLE}
          title={t(btn.titleKey)}
          aria-label={t(btn.titleKey)}
          onClick={() => onAlign(btn.axis)}
        >
          {btn.label}
        </button>
      ))}

      <div style={SEPARATOR_STYLE} />

      {/* Distribution */}
      <span style={LABEL_STYLE}>{t('editor.align.section.distribute')}</span>
      {DISTRIBUTE_BUTTONS.map(btn => (
        <button
          key={btn.axis}
          type="button"
          style={{
            ...BUTTON_STYLE,
            opacity: canDistribute ? 1 : 0.4,
            cursor: canDistribute ? 'pointer' : 'default',
          }}
          title={t(btn.titleKey)}
          aria-label={t(btn.titleKey)}
          disabled={!canDistribute}
          onClick={() => onDistribute(btn.axis)}
        >
          {btn.label}
        </button>
      ))}

      <div style={SEPARATOR_STYLE} />

      {/* Z-order */}
      <span style={LABEL_STYLE}>{t('editor.align.section.order')}</span>
      {ZORDER_BUTTONS.map(btn => (
        <button
          key={btn.op}
          type="button"
          style={BUTTON_STYLE}
          title={t(btn.titleKey)}
          aria-label={t(btn.titleKey)}
          onClick={() => onZOrder(btn.op)}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}
