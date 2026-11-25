import type { JSX } from 'react';
import { getErrorMessage } from '@azimut/core-model';
import type { ErrorCode } from '@azimut/core-model';
import { StateBanner } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import type { DecorationStore } from '../state/use-decoration-store.js';

/**
 * S6.1c — ce que l'éditeur doit dire de l'habillage du dépôt : un refus, une
 * relecture impossible, des lignes illisibles. Rien quand tout va bien.
 */
export function DecorationNotices({ store }: { readonly store: DecorationStore }): JSX.Element | null {
  const { t, lang } = useI18n();
  const stale = store.refusal.some(f => f.params['cause'] === '409');
  if (store.refusal.length === 0 && !store.loadFailed && store.unreadable === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {stale && <StateBanner severity="warning" message={t('decoration.refused.stale')} />}
      {!stale && store.refusal.map(finding => (
        <StateBanner
          key={finding.code}
          severity="blocking"
          code={finding.code}
          message={getErrorMessage(finding.code as ErrorCode, lang === 'en' ? 'en' : 'fr') ?? finding.code}
        />
      ))}
      {store.loadFailed && <StateBanner severity="warning" message={t('decoration.load.failed')} />}
      {store.unreadable > 0 && (
        <StateBanner severity="warning" message={t('decoration.unreadable', { count: store.unreadable })} />
      )}
    </div>
  );
}
