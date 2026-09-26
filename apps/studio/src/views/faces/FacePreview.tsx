import { type JSX, useMemo } from 'react';
import type { Support } from '@azimut/core-model';
import { useSiteData } from '../../context/useSiteData.js';
import { useI18n } from '../../i18n/useI18n.js';
import { SPACE, TEXT, LABEL_STYLE } from '../../components/ui/index.js';
import { renderSupportFace } from '../signage/face-preview.js';

type FacePreviewProps = {
  readonly support: Support;
  readonly faceIndex: number;
};

/**
 * A5.6 / D8.3 — la face telle que le moteur la rend : gabarit de la
 * typologie, contenu du tableau des messages, textes saisis sur la face, dans
 * la langue de l'interface. Rien n'est dessiné par l'écran (INV-2).
 */
export function FacePreview({ support, faceIndex }: FacePreviewProps): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();
  const profile = site.travel_profiles[0];
  const preview = useMemo(
    () => (profile === undefined ? null : renderSupportFace(site, support, faceIndex, profile, lang)),
    [site, support, faceIndex, profile, lang],
  );

  return (
    <section style={{ padding: '12px 16px', display: 'grid', gap: SPACE.sm }} aria-label={t('faceblocks.preview.title')}>
      <h3 style={{ ...LABEL_STYLE, margin: 0 }}>{t('faceblocks.preview.title')}</h3>
      {preview === null
        ? <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-muted)' }}>{t('faceblocks.preview.none')}</p>
        : (
          <div
            className="az-svg-fit"
            role="img"
            aria-label={t('faceblocks.preview.aria', { support: support.code ?? support.id, face: faceIndex })}
            style={{ border: '1px solid var(--border-hairline)', borderRadius: 4, overflow: 'hidden' }}
            dangerouslySetInnerHTML={{ __html: preview.svg }}
          />
        )}
    </section>
  );
}
