import { type JSX, useMemo, useState } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { renderFloorPlan } from '@azimut/engine-layout';
import type { FloorPlanTheme } from '@azimut/engine-layout';

const DEFAULT_THEME: FloorPlanTheme = {
  background: 'none',
  footprint_fill: 'var(--az-card-bg)',
  footprint_stroke: 'var(--az-text-secondary)',
  edge_stroke: 'var(--az-text-secondary)',
  edge_evacuation_stroke: 'var(--az-active-text)',
  node_fill: 'var(--az-active-bg)',
  node_stroke: 'var(--az-text-primary)',
  node_safety_fill: 'var(--az-active-text)',
  text_primary: 'var(--az-text-primary)',
  text_secondary: 'var(--az-text-secondary)',
};

export function FloorPlansView(): JSX.Element {
  const site = useSiteData();
  const sortedLevels = useMemo(
    () => [...site.levels].sort((a, b) => a.ordinal - b.ordinal),
    [site],
  );
  const [selectedLevel, setSelectedLevel] = useState(sortedLevels[0]?.id ?? '');

  const svgResult = useMemo(() => {
    if (!selectedLevel) return null;
    return renderFloorPlan(site, selectedLevel, {
      width_px: 700,
      height_px: 400,
      theme: DEFAULT_THEME,
      font_family: 'system-ui, sans-serif',
      show_destinations: true,
      show_edges: true,
      padding_px: 20,
    });
  }, [site, selectedLevel]);

  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: 22, color: 'var(--az-text-primary)' }}>
        Plans de niveaux
      </h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {sortedLevels.map((l) => (
          <button
            key={l.id}
            onClick={() => setSelectedLevel(l.id)}
            style={{
              padding: '6px 14px',
              border: '1px solid var(--az-border)',
              borderRadius: 6,
              background: selectedLevel === l.id ? 'var(--az-active-bg)' : 'var(--az-card-bg)',
              color: selectedLevel === l.id ? 'var(--az-active-text)' : 'var(--az-text-primary)',
              fontWeight: selectedLevel === l.id ? 600 : 400,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {l.name}
          </button>
        ))}
      </div>

      {svgResult && svgResult.ok ? (
        <div
          style={{
            borderRadius: 8,
            border: '1px solid var(--az-border)',
            overflow: 'hidden',
          }}
          dangerouslySetInnerHTML={{ __html: svgResult.value }}
        />
      ) : (
        <div style={{
          padding: 32,
          borderRadius: 8,
          border: '2px dashed var(--az-border)',
          textAlign: 'center',
          color: 'var(--az-text-secondary)',
          fontSize: 14,
        }}>
          {svgResult && !svgResult.ok
            ? `Erreur : ${svgResult.findings.map((f) => f.code).join(', ')}`
            : 'Selectionnez un niveau.'}
        </div>
      )}
    </div>
  );
}
