import { type JSX, useContext } from 'react';
import { SyncStatusContext } from '../context/sync-status.js';
import type { SyncStatus } from '../state/sync-status.js';
import { useI18n } from '../i18n/useI18n.js';
import { SPACE, severityColor, type Severity } from '../components/ui/index.js';

/**
 * F5.2 — l'état de synchronisation, en permanence dans la barre d'état de
 * l'atelier. Le texte porte le sens ; la couleur d'état le double sans le
 * remplacer (F4.3). Annoncé poliment aux lecteurs d'écran à chaque changement.
 */
const SEVERITY: Readonly<Record<SyncStatus['kind'], Severity>> = {
  local: 'info',
  pending: 'warning',
  direct: 'warning',
  unreachable: 'blocking',
  synced: 'valid',
};

export function SyncIndicator(): JSX.Element {
  const status = useContext(SyncStatusContext);
  const { t } = useI18n();
  const value = status.kind === 'pending'
    ? t('sync.pending', { count: status.count })
    : t(`sync.${status.kind}`);
  return (
    <span role="status" aria-live="polite" style={{ display: 'inline-flex', gap: SPACE.xs, marginLeft: 'auto' }}>
      <span style={{ color: 'var(--text-muted)' }}>{t('sync.label')}</span>
      <span style={{ color: severityColor(SEVERITY[status.kind]) }}>{value}</span>
    </span>
  );
}
