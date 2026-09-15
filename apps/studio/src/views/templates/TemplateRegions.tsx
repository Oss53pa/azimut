import { type JSX } from 'react';
import type { FaceTemplate } from '@azimut/core-model';
import { useI18n } from '../../i18n/useI18n.js';

type TemplateRegionsProps = {
  readonly template: FaceTemplate;
};

const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 100;

/**
 * Les régions d'un gabarit, à l'échelle, dans le repère en pour-cent qu'elles
 * déclarent. Ce n'est pas un aperçu de face : aucun contenu n'est résolu ici,
 * seules les régions sont tracées.
 */
export function TemplateRegions({ template }: TemplateRegionsProps): JSX.Element {
  const { t } = useI18n();
  const blocks = [...template.blocks].sort((a, b) => a.ordinal - b.ordinal);

  return (
    <svg
      viewBox={`0 0 ${String(VIEW_WIDTH)} ${String(VIEW_HEIGHT)}`}
      width="100%"
      role="img"
      aria-label={t('templates.regions.aria', { name: template.name })}
      style={{
        display: 'block',
        background: 'var(--surface-canvas)',
        border: '1px solid var(--border-hairline)',
        borderRadius: 4,
        aspectRatio: '1 / 1',
        maxWidth: 260,
      }}
    >
      {blocks.map(block => (
        <g key={`${block.kind}-${String(block.ordinal)}`}>
          <rect
            x={block.region.x_pct}
            y={block.region.y_pct}
            width={block.region.w_pct}
            height={block.region.h_pct}
            fill="var(--surface-sunken)"
            stroke="var(--border-strong)"
            strokeWidth={0.4}
          />
          <text
            x={block.region.x_pct + 2}
            y={block.region.y_pct + 6}
            fill="var(--text-secondary)"
            fontSize={4}
            fontFamily="var(--font-mono)"
          >
            {block.kind}
          </text>
        </g>
      ))}
    </svg>
  );
}
