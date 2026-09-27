import { type JSX, useMemo } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useSiteVocabulary } from '../context/useSiteVocabulary.js';
import { useI18n } from '../i18n/useI18n.js';
import { evaluatePublishGate } from '../publish-gate.js';
import type { SiteSummary } from '../data/index.js';
import type { ViewId } from '../views.js';
import { Icon } from './Icon.js';
import { ProjectSwitcher } from './ProjectSwitcher.js';
import { SPACE, TEXT, BUTTON_STYLE, PRIMARY_BUTTON_STYLE, severityColor } from './ui/index.js';

type HeaderBarProps = {
  readonly onNavigate: (view: ViewId) => void;
  readonly onOpenSearch: () => void;
  readonly sites: readonly SiteSummary[];
  readonly currentSiteId: string;
  readonly onOpenSite: (id: string) => void;
};

const HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  height: 56,
  borderBottom: '1px solid var(--border-hairline)',
  background: 'var(--surface-panel)',
  padding: '0 16px',
  gap: SPACE.lg,
  flexShrink: 0,
};

/**
 * Barre d'en-tête, dessinée sur la maquette « logiciel autonome v2 » :
 * logotype, projet ouvert, recherche, puis les actions.
 *
 * « Publier » n'est pas un bouton décoratif : il est refusé tant qu'une
 * anomalie bloquante est ouverte, et il dit laquelle. Il n'y a pas de bouton
 * « Enregistrer » — l'application n'a pas de dépôt persistant, et un bouton
 * qui n'enregistre rien est pire que son absence. Pour la même raison, la
 * cloche de notifications et le menu du compte de la maquette n'y sont pas :
 * aucune donnée ne les porte encore.
 */
export function HeaderBar({ onNavigate, onOpenSearch, sites, currentSiteId, onOpenSite }: HeaderBarProps): JSX.Element {
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

  return (
    <header style={HEADER_STYLE}>
      <button
        type="button"
        onClick={() => { onNavigate('dashboard'); }}
        aria-label={t('shell.brand.home')}
        style={{
          border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
          fontFamily: 'var(--font-brand)', fontSize: TEXT.title, fontWeight: 400,
          color: 'var(--text-primary)', lineHeight: 1,
        }}
      >
        {t('header.product')}
      </button>
      <ProjectSwitcher sites={sites} currentId={currentSiteId} onOpenSite={onOpenSite} onNavigate={onNavigate} />
      <div style={{ flex: 1 }} />
      <button
        type="button"
        onClick={onOpenSearch}
        aria-keyshortcuts="Control+K"
        style={{
          display: 'flex', alignItems: 'center', gap: SPACE.sm,
          width: 280, height: 36, padding: '0 8px 0 12px',
          border: '1px solid var(--border-hairline)', borderRadius: 4,
          background: 'var(--surface-page)', color: 'var(--text-muted)',
          font: 'inherit', fontSize: TEXT.body, cursor: 'text',
        }}
      >
        <Icon name="search" size={16} />
        <span style={{ flex: 1, textAlign: 'left' }}>{t('shell.search.placeholder')}</span>
        <kbd style={{
          fontSize: TEXT.micro, padding: '2px 6px', borderRadius: 4,
          border: '1px solid var(--border-strong)', background: 'var(--surface-panel)',
          color: 'var(--text-secondary)', fontFamily: 'inherit',
        }}>
          {t('shell.search.shortcut')}
        </kbd>
      </button>
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
                // M7.10 (partie M) : la langue choisie n'est pas une valeur calculée.
                color: lang === code ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderColor: lang === code ? 'var(--border-strong)' : 'var(--border-interactive)',
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
