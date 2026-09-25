import { type JSX, useEffect, useRef, useState } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import type { SiteSummary } from '../data/index.js';
import type { ViewId } from '../views.js';
import { Icon } from './Icon.js';
import { siteInitials } from './site-initials.js';
import { SPACE, TEXT, LABEL_STYLE } from './ui/index.js';

type ProjectSwitcherProps = {
  readonly sites: readonly SiteSummary[];
  readonly currentId: string;
  readonly onOpenSite: (id: string) => void;
  readonly onNavigate: (view: ViewId) => void;
};

function Badge({ name }: { readonly name: string }): JSX.Element {
  return (
    <span aria-hidden="true" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: 32, height: 32, borderRadius: 4, flexShrink: 0,
      background: 'var(--text-primary)', color: 'var(--surface-panel)',
      fontSize: TEXT.small, fontWeight: 500,
    }}>
      {siteInitials(name)}
    </span>
  );
}

const MENU_ITEM: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: SPACE.md, width: '100%',
  padding: '8px 12px', border: 'none', borderRadius: 4, textAlign: 'left',
  background: 'transparent', color: 'var(--text-primary)', font: 'inherit',
  fontSize: TEXT.body, cursor: 'pointer',
};

/**
 * Le projet ouvert, et le moyen d'en changer. Dans l'application, un projet
 * est un site : la pastille dit lequel, le menu liste les sites de
 * l'organisation et mène au portefeuille (module 10).
 */
export function ProjectSwitcher({ sites, currentId, onOpenSite, onNavigate }: ProjectSwitcherProps): JSX.Element {
  const site = useSiteData();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDown(e: MouseEvent): void {
      if (root.current !== null && !root.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const buildingName = site.buildings[0]?.name ?? t('header.building.fallback');

  function go(action: () => void): void {
    setOpen(false);
    action();
  }

  return (
    <div ref={root} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); }}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: SPACE.sm,
          padding: '4px 8px 4px 4px', borderRadius: 4, cursor: 'pointer',
          border: '1px solid var(--border-hairline)', background: 'var(--surface-panel)',
          font: 'inherit', color: 'var(--text-primary)',
        }}
      >
        <Badge name={site.site.name} />
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
          <span style={{ fontSize: TEXT.body, fontWeight: 500 }}>{site.site.name}</span>
          <span style={{ fontSize: TEXT.micro, color: 'var(--text-muted)' }}>
            {t('shell.project.meta', { building: buildingName, organization: site.organization.name })}
          </span>
        </span>
        <span style={{ color: 'var(--text-muted)' }}><Icon name="chevD" size={16} /></span>
      </button>
      {open && (
        <div role="menu" style={{
          position: 'absolute', left: 0, top: 48, width: 320, zIndex: 40,
          background: 'var(--surface-panel)', border: '1px solid var(--border-strong)',
          borderRadius: 6, boxShadow: 'var(--shadow-float)', padding: SPACE.xs,
        }}>
          <div style={{ ...LABEL_STYLE, padding: '8px 12px 4px' }}>{t('shell.project.menu')}</div>
          {sites.map(s => (
            <button
              key={s.id}
              type="button"
              role="menuitem"
              aria-current={s.id === currentId ? 'true' : undefined}
              onClick={() => { go(() => { onOpenSite(s.id); }); }}
              style={{
                ...MENU_ITEM,
                background: s.id === currentId ? 'var(--surface-sunken)' : 'transparent',
              }}
            >
              <Badge name={s.name} />
              <span style={{ flex: 1, fontWeight: s.id === currentId ? 500 : 400 }}>{s.name}</span>
              <span style={{ ...LABEL_STYLE, color: 'var(--text-muted)' }}>{s.country_code}</span>
            </button>
          ))}
          <div style={{ height: 1, margin: '4px 0', background: 'var(--border-hairline)' }} />
          <button type="button" role="menuitem" style={MENU_ITEM} onClick={() => { go(() => { onNavigate('portfolio'); }); }}>
            <Icon name="grid" size={18} />
            <span>{t('shell.project.portfolio')}</span>
          </button>
          <button type="button" role="menuitem" style={MENU_ITEM} onClick={() => { go(() => { onNavigate('sites'); }); }}>
            <Icon name="layers" size={18} />
            <span>{t('shell.project.all')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
