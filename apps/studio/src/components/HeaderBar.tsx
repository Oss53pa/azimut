import { type JSX } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';

const HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  height: 44,
  borderBottom: '1px solid var(--border-hairline)',
  background: 'var(--surface-panel)',
  padding: '0 12px',
  gap: 16,
  flexShrink: 0,
};

const SEPARATOR_STYLE: React.CSSProperties = {
  width: 1,
  height: 20,
  background: 'var(--border-hairline)',
  flexShrink: 0,
};

const BUTTON_STYLE: React.CSSProperties = {
  border: '1px solid var(--border-interactive)',
  background: 'var(--surface-panel)',
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  fontSize: 12,
  padding: '6px 12px',
  borderRadius: 4,
  cursor: 'pointer',
  transition: 'background 120ms',
};

const PRIMARY_BUTTON_STYLE: React.CSSProperties = {
  border: '1px solid var(--text-primary)',
  background: 'var(--text-primary)',
  color: 'var(--surface-panel)',
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 500,
  padding: '6px 16px',
  borderRadius: 4,
  cursor: 'pointer',
  transition: 'opacity 120ms',
};

export function HeaderBar(): JSX.Element {
  const siteData = useSiteData();
  const { t } = useI18n();
  const buildingName = siteData.buildings[0]?.name ?? t('header.building.fallback');
  const siteName = siteData.site.name;

  return (
    <header style={HEADER_STYLE}>
      <div style={{
        fontSize: 15,
        fontWeight: 500,
        letterSpacing: '0.01em',
      }}>
        Azimut
      </div>
      <div style={SEPARATOR_STYLE} />
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{ fontSize: 13 }}>{siteName}</span>
        <span style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}>
          {buildingName}
        </span>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <button type="button" style={BUTTON_STYLE}>
          {t('header.action.save')}
        </button>
        <button type="button" style={BUTTON_STYLE}>
          {t('header.action.openaudit')}
        </button>
        <button type="button" style={PRIMARY_BUTTON_STYLE}>
          {t('header.action.publish')}
        </button>
      </div>
    </header>
  );
}
