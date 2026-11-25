import type { JSX } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import type { UndoConflict } from '../state/undo-conflict.js';
import { Button, StateBanner } from './ui/index.js';
import { NUMERIC_STYLE, SPACE, TEXT } from './ui/tokens.js';

/** Une valeur montrée telle quelle, bornée : c'est une donnée, pas un libellé. */
const SHOWN_MAX = 80;

function shown(value: unknown): string {
  const text = value === null || value === undefined
    ? '—'
    : typeof value === 'string' ? value : JSON.stringify(value) ?? '—';
  return text.length <= SHOWN_MAX ? text : `${text.slice(0, SHOWN_MAX - 1)}…`;
}

const cell = { padding: `2px ${String(SPACE.sm)}px`, textAlign: 'left', verticalAlign: 'top' } as const;

/**
 * S6.8, décision Q3 — une annulation ou un rétablissement refusé parce que
 * l'objet a changé sur un autre poste, avec les deux versions (S6.3). Rien
 * n'a été écrit ; l'utilisateur ferme, ou écarte le geste de la pile.
 */
export function UndoConflictBanner({ conflict, onDismiss, onDiscard }: {
  readonly conflict: UndoConflict | null;
  readonly onDismiss: () => void;
  readonly onDiscard: () => void;
}): JSX.Element | null {
  const { t } = useI18n();
  if (conflict === null) return null;
  const located = conflict.reason !== 'unlocated';
  const message = located
    ? t(conflict.side === 'undo' ? 'undo.conflict.undo' : 'undo.conflict.redo',
      { table: conflict.table ?? '', id: (conflict.id ?? '').slice(0, 8) })
    : t('undo.conflict.unlocated.title');
  return (
    <StateBanner severity="warning" message={message} hint={t('undo.conflict.hint')}>
      <div style={{ fontSize: TEXT.small, marginTop: SPACE.xs }}>
        {t(located ? `undo.conflict.${conflict.reason}` : 'undo.conflict.unlocated')}
      </div>
      {conflict.reason === 'row_changed' && conflict.columns.length > 0 && (
        <table style={{ fontSize: TEXT.micro, borderCollapse: 'collapse', marginTop: SPACE.xs }}>
          <thead>
            <tr>
              <th scope="col" style={cell}>{t('undo.conflict.column')}</th>
              <th scope="col" style={cell}>{t('undo.conflict.current')}</th>
              <th scope="col" style={cell}>{t('undo.conflict.wanted')}</th>
            </tr>
          </thead>
          <tbody>
            {conflict.columns.map(c => (
              <tr key={c.column}>
                <td style={{ ...cell, ...NUMERIC_STYLE }}>{c.column}</td>
                <td style={{ ...cell, ...NUMERIC_STYLE }}>{shown(c.current)}</td>
                <td style={{ ...cell, ...NUMERIC_STYLE }}>{shown(c.wanted)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ display: 'flex', gap: SPACE.sm, marginTop: SPACE.sm }}>
        <Button rank="secondary" onClick={onDiscard}>{t('undo.conflict.discard')}</Button>
        <Button rank="quiet" onClick={onDismiss}>{t('undo.conflict.dismiss')}</Button>
      </div>
    </StateBanner>
  );
}
