import { type JSX, useMemo, useState } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import { renderPreview } from './signage/face-preview.js';

export function FacesView(): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();

  const templates = useMemo(
    () => [...site.face_templates].sort((a, b) => a.id.localeCompare(b.id)),
    [site],
  );

  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? '');
  const selected = templates.find((tpl) => tpl.id === selectedId);

  const profile = site.travel_profiles[0] ?? null;

  const preview = useMemo(() => {
    if (!selected || !profile) return null;
    return renderPreview(site, selected, profile, lang);
  }, [site, selected, profile, lang]);

  if (templates.length === 0) {
    return (
      <div>
        <h1 style={{ margin: '0 0 16px', fontSize: 22, color: 'var(--text-primary)' }}>
          {t('faces.title')}
        </h1>
        <div style={{
          marginTop: 16,
          padding: 32,
          borderRadius: 4,
          border: '2px dashed var(--border-hairline)',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: 13,
        }}>
          {t('faces.empty.notemplate')}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: 22, color: 'var(--text-primary)' }}>
        {t('faces.title')}
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
        {t('faces.subtitle')}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => setSelectedId(tpl.id)}
            style={{
              padding: '6px 16px',
              border: '1px solid var(--border-hairline)',
              borderRadius: 6,
              background: selectedId === tpl.id ? 'var(--surface-sunken)' : 'var(--surface-panel)',
              color: selectedId === tpl.id ? 'var(--accent)' : 'var(--text-primary)',
              fontWeight: selectedId === tpl.id ? 500 : 400,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {tpl.name}
          </button>
        ))}
      </div>

      {selected && (
        <div style={{
          marginBottom: 16,
          fontSize: 12,
          color: 'var(--text-secondary)',
        }}>
          {t('faces.meta', {
            type: selected.support_type_key,
            side: selected.side,
            blocks: selected.blocks.length,
          })}
        </div>
      )}

      {preview ? (
        <div style={{
          borderRadius: 4,
          border: '1px solid var(--border-hairline)',
          overflow: 'hidden',
          background: 'var(--surface-panel)',
        }}>
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--border-hairline)',
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}>
            {t('faces.previewnode', {
              label: preview.node.label,
              kind: preview.node.kind,
            })}
          </div>
          <div
            style={{ padding: 16 }}
            dangerouslySetInnerHTML={{ __html: preview.svg }}
          />
        </div>
      ) : (
        <div style={{
          padding: 32,
          borderRadius: 4,
          border: '2px dashed var(--border-hairline)',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: 13,
        }}>
          {!profile
            ? t('faces.noprofile')
            : t('faces.nopreview')}
        </div>
      )}
    </div>
  );
}
