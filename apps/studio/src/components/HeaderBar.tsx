import { type JSX, useMemo } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useSiteVocabulary } from '../context/useSiteVocabulary.js';
import { useI18n } from '../i18n/useI18n.js';
import { evaluatePublishGate } from '../publish-gate.js';
import type { ViewId } from '../views.js';
import { SPACE, TEXT, BUTTON_STYLE, PRIMARY_BUTTON_STYLE, severityColor } from './ui/index.js';

type HeaderBarProps = {
  readonly onNavigate: (view: ViewId) => void;
};

const HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  height: 44,
  borderBottom: '1px solid var(--border-hairline)',
  background: 'var(--surface-panel)',
  padding: '0 12px',
  gap: SPACE.lg,
  flexShrink: 0,
};

const SEPARATOR_STYLE: React.CSSProperties = {
  width: 1,
  height: 20,
  background: 'var(--border-hairline)',
  flexShrink: 0,
};

/**
 * Barre d'en-tête.
 *
 * « Publier » n'est pas un bouton décoratif : il est refusé tant qu'une
 * anomalie bloquante est ouverte, et il dit laquelle. Il n'y a pas de bouton
 * « Enregistrer » — l'application n'a pas de dépôt persistant, et un bouton
 * qui n'enregistre rien est pire que son absence.
 */
export function HeaderBar({ onNavigate }: HeaderBarProps): JSX.Element {
  const site = useSiteData();
  const vocabulary = useSiteVocabulary();
  const { t, lang, setLang } = useI18n();

  const gate = useMemo(
    () => evaluatePublishGate(site, vocabulary),
    [site, vocabulary],
  );

  const blocking = gate.blocking;
  const publishable = gate.publishable;

  const publishTitle = gate.vocabularyRefusal === 'failed'
    ? t('header.publish.unreadable', { code: vocabulary.errorCode ?? '—' })
    : gate.vocabularyRefusal === 'loading'
      ? t('header.publish.loading')
      : blocking.length > 0
        ? t('header.publish.blocked', { count: blocking.length })
        : gate.unchecked.length > 0
          ? `${t('header.publish.ready')} ${t('header.publish.unchecked', { count: gate.unchecked.length })}`
          : t('header.publish.ready');
  const buildingName = site.buildings[0]?.name ?? t('header.building.fallback');

  return (
    <header style={HEADER_STYLE}>
      <div style={{ fontSize: TEXT.lead, fontWeight: 500, letterSpacing: '0.01em' }}>
        {t('header.product')}
      </div>
      <div style={SEPARATOR_STYLE} />
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, minWidth: 0 }}>
        <span style={{ fontSize: TEXT.body }}>{site.site.name}</span>
        <span style={{ fontSize: TEXT.small, color: 'var(--text-secondary)' }}>{buildingName}</span>
        <span style={{ fontSize: TEXT.micro, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {site.organization.slug}
        </span>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
        <div style={{ display: 'flex', gap: 2 }}>
          {(['fr', 'en'] as const).map(code => (
            <button
              key={code}
              type="button"
              onClick={() => { setLang(code); }}
              aria-pressed={lang === code}
              style={{
                ...BUTTON_STYLE,
                padding: '4px 8px',
                fontSize: TEXT.micro,
                textTransform: 'uppercase',
                color: lang === code ? 'var(--accent)' : 'var(--text-secondary)',
                borderColor: lang === code ? 'var(--accent)' : 'var(--border-interactive)',
              }}
            >
              {code}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => { onNavigate('checks'); }}
          style={BUTTON_STYLE}
        >
          {t('header.action.openaudit')}
        </button>
        <button
          type="button"
          disabled={!publishable}
          onClick={() => { onNavigate('proofs'); }}
          title={publishTitle}
          style={{
            ...PRIMARY_BUTTON_STYLE,
            opacity: publishable ? 1 : 0.45,
            cursor: publishable ? 'pointer' : 'not-allowed',
            borderColor: publishable ? 'var(--text-primary)' : severityColor('blocking'),
          }}
        >
          {t('header.action.publish')}
        </button>
      </div>
    </header>
  );
}
