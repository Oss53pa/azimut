import { type JSX, useContext } from 'react';
import { PresenceContext } from '../context/presence.js';
import type { Presence } from '../state/presence.js';
import { useI18n } from '../i18n/useI18n.js';
import { SPACE } from '../components/ui/index.js';

/**
 * G4.2 — « Les utilisateurs ayant le niveau ouvert sont affichés en
 * permanence dans la barre d'état, avec leur nom et l'heure de leur dernière
 * modification. » Le nom affiché (Q12), à défaut le rôle. Rien quand la
 * présence n'est pas suivie.
 */
export function PresenceIndicator(): JSX.Element | null {
  const present = useContext(PresenceContext);
  const { t, lang } = useI18n();
  if (present === null) return null;

  const time = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' });
  const describe = (p: Presence): string => {
    const who = p.displayName ?? t(`auth.role.${p.role}`);
    return p.lastChangeAt === null
      ? t('presence.unchanged', { who })
      : t('presence.changed', { who, time: time.format(new Date(p.lastChangeAt)) });
  };
  const value = present.length === 0 ? t('presence.none') : present.map(describe).join(' · ');

  return (
    <span role="status" aria-live="polite" style={{ display: 'inline-flex', gap: SPACE.xs }}>
      <span style={{ color: 'var(--text-muted)' }}>{t('presence.label')}</span>
      <span>{value}</span>
    </span>
  );
}
