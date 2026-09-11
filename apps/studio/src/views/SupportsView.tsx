import { type JSX } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';

export function SupportsView(): JSX.Element {
  const site = useSiteData();
  const { t } = useI18n();

  const types = [...site.support_types].sort((a, b) => a.key.localeCompare(b.key));

  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: 22, color: 'var(--text-primary)' }}>
        {t('supports.title')}
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
        {t('supports.count', { count: types.length })}
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-hairline)' }}>
              <Th>{t('supports.col.key')}</Th>
              <Th>{t('supports.col.name')}</Th>
              <Th>{t('supports.col.faces')}</Th>
              <Th>{t('supports.col.defaultdims')}</Th>
            </tr>
          </thead>
          <tbody>
            {types.map((st) => (
              <tr key={st.id} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-primary)' }}>
                  {st.key}
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>
                  {st.name}
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>
                  {st.face_count}
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 12 }}>
                  {st.faces.map((f) => `${f.side}: ${f.default_width_mm}x${f.default_height_mm} mm`).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { readonly children: string }): JSX.Element {
  return (
    <th style={{
      textAlign: 'left',
      padding: '8px 12px',
      fontWeight: 500,
      color: 'var(--text-secondary)',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}>
      {children}
    </th>
  );
}
