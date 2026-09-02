import { type JSX } from 'react';
import { useSiteData } from '../context/useSiteData.js';

export function TemplatesView(): JSX.Element {
  const site = useSiteData();

  const templates = [...site.face_templates].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: 22, color: 'var(--az-text-primary)' }}>
        Gabarits de face
      </h1>
      <p style={{ color: 'var(--az-text-secondary)', fontSize: 13, marginBottom: 16 }}>
        {templates.length} gabarit{templates.length !== 1 ? 's' : ''}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {templates.map((t) => (
          <div key={t.id} style={{
            padding: 16,
            borderRadius: 8,
            border: '1px solid var(--az-border)',
            background: 'var(--az-card-bg)',
          }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--az-text-primary)', marginBottom: 4 }}>
              {t.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--az-text-secondary)', marginBottom: 8 }}>
              {t.support_type_key} / {t.side}
            </div>
            <div style={{ fontSize: 12, color: 'var(--az-text-secondary)' }}>
              {t.blocks.length} bloc{t.blocks.length !== 1 ? 's' : ''} :
              {' '}{t.blocks.map((b) => b.kind).join(', ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
