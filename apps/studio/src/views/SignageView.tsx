import { type JSX, useMemo, useState } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import { guardCharterOnSafety, checkFaceContentFit } from '@azimut/engine-graph';
import type { CharterApplication, TextMeasure } from '@azimut/engine-graph';
import type { Finding } from '@azimut/core-model';
import type { ViewId } from '../views.js';
import {
  ScreenHeader, MetricRow, Panel, PanelGrid, Note, Tag,
  SPACE, TEXT, LABEL_STYLE, type Metric, type ScreenAction,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';
import { renderPreview, FACE_THEME, PREVIEW_FONT_FAMILY } from './signage/face-preview.js';

type SignageViewProps = {
  readonly onNavigate: (view: ViewId) => void;
};

/**
 * Mesure de texte d'aperçu. Approximation déclarée : la largeur moyenne d'un
 * glyphe vaut 0,55 cadratin. Le compilateur, lui, mesure sur les métriques
 * réelles de la police embarquée (M04.G9) ; cet écran n'est qu'un aperçu et le dit.
 */
const PREVIEW_GLYPH_RATIO = 0.55;
const previewMeasure: TextMeasure = (text, fontSizeMm) =>
  text.length * fontSizeMm * PREVIEW_GLYPH_RATIO;

/**
 * Une application de charte d'essai sur le registre de sécurité, pour que
 * l'écran montre le refus plutôt que de l'affirmer (invariant 3).
 */
const SAFETY_PROBE: readonly CharterApplication[] = [
  {
    target_id: 'probe',
    target_registry: 'safety',
    change_kind: 'color',
    field: 'fill',
    value: 'charte-client',
  },
];

/**
 * Module 04 — la signalétique.
 *
 * Une face est une vue : son contenu est résolu depuis le graphe et l'annuaire
 * au moment du rendu. Cet écran montre ce que le moteur compose, les contrôles
 * qui s'y appliquent, et le volume à compiler.
 */
export function SignageView({ onNavigate }: SignageViewProps): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();

  const templates = useMemo(
    () => [...site.face_templates].sort((a, b) => a.id.localeCompare(b.id)),
    [site],
  );
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? '');
  const selected = templates.find(tpl => tpl.id === selectedId);
  const profile = site.travel_profiles[0];

  const preview = useMemo(() => {
    if (selected === undefined || profile === undefined) return null;
    return renderPreview(site, selected, profile, lang);
  }, [site, selected, profile, lang]);

  const fitFindings = useMemo<readonly Finding[]>(() => {
    if (preview === null) return [];
    return checkFaceContentFit(
      preview.face,
      {
        width_mm: preview.width_mm,
        height_mm: preview.height_mm,
        theme: FACE_THEME,
        font_family: PREVIEW_FONT_FAMILY,
        lang,
      },
      previewMeasure,
    );
  }, [preview, lang]);

  const safetyGuard = useMemo(() => guardCharterOnSafety(site, SAFETY_PROBE), [site]);

  /** Faces à compiler : une par face déclarée de chaque typologie implantée. */
  const facesToCompile = useMemo(() => {
    const firstType = site.support_types[0];
    if (firstType === undefined) return 0;
    // Le lien support → typologie n'est pas porté par le modèle A5 : le
    // décompte suppose la première typologie pour tous, et le dit.
    return site.supports.length * firstType.face_count;
  }, [site]);

  const metrics: readonly Metric[] = [
    { id: 'templates', label: t('signage.metric.templates'), value: String(templates.length) },
    { id: 'types', label: t('signage.metric.types'), value: String(site.support_types.length) },
    { id: 'supports', label: t('signage.metric.supports'), value: String(site.supports.length) },
    { id: 'faces', label: t('signage.metric.faces'), value: String(facesToCompile) },
    {
      id: 'fit',
      label: t('signage.metric.fit'),
      value: String(fitFindings.length),
      severity: fitFindings.length > 0 ? 'warning' : 'valid',
    },
  ];

  const actions: readonly ScreenAction[] = [
    { id: 'templates', label: t('signage.action.templates'), onSelect: () => { onNavigate('templates'); } },
    { id: 'proofs', label: t('signage.action.proofs'), onSelect: () => { onNavigate('proofs'); } },
    { id: 'faces', label: t('signage.action.faces'), primary: true, onSelect: () => { onNavigate('faces'); } },
  ];

  return (
    <div>
      <ScreenHeader
        eyebrow={t('signage.eyebrow')}
        title={t('signage.title')}
        subtitle={t('signage.subtitle')}
        actions={actions}
      />

      <MetricRow metrics={metrics} />

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: SPACE.sm,
        margin: `${String(SPACE.lg)}px 0 ${String(SPACE.sm)}px`,
      }}>
        <span style={{ ...LABEL_STYLE, alignSelf: 'center' }}>{t('signage.templates.label')}</span>
        {templates.map(template => (
          <button
            key={template.id}
            type="button"
            onClick={() => { setSelectedId(template.id); }}
            style={{
              border: `1px solid ${selectedId === template.id ? 'var(--accent)' : 'var(--border-interactive)'}`,
              background: selectedId === template.id ? 'var(--accent-soft)' : 'var(--surface-panel)',
              color: selectedId === template.id ? 'var(--accent)' : 'var(--text-primary)',
              borderRadius: 4,
              padding: '4px 12px',
              fontSize: TEXT.small,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {template.name}
          </button>
        ))}
      </div>

      <PanelGrid min={320}>
        <Panel
          title={t('signage.panel.preview')}
          note={preview === null ? undefined : `${String(preview.width_mm)} × ${String(preview.height_mm)} mm`}
        >
          {preview === null ? (
            <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-muted)' }}>
              {profile === undefined ? t('signage.preview.noprofile') : t('signage.preview.none')}
            </p>
          ) : (
            <>
              <div
                style={{ border: '1px solid var(--border-hairline)', borderRadius: 4, overflow: 'hidden' }}
                dangerouslySetInnerHTML={{ __html: preview.svg }}
              />
              <p style={{ margin: `${String(SPACE.sm)}px 0 0`, fontSize: TEXT.micro, color: 'var(--text-muted)' }}>
                {t('signage.preview.node', { label: preview.node.label, kind: preview.node.kind })}
              </p>
            </>
          )}
        </Panel>

        <Panel title={t('signage.panel.blocks')} note={String(selected?.blocks.length ?? 0)}>
          {selected === undefined ? (
            <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-muted)' }}>
              {t('signage.blocks.none')}
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: SPACE.xs }}>
              {[...selected.blocks]
                .sort((a, b) => a.ordinal - b.ordinal)
                .map(block => (
                  <li
                    key={`${block.kind}-${String(block.ordinal)}`}
                    style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.md, fontSize: TEXT.small }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      {block.kind}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {`${String(block.region.w_pct)} × ${String(block.region.h_pct)} %`}
                    </span>
                  </li>
                ))}
            </ul>
          )}
          <Note>{t('signage.blocks.note')}</Note>
        </Panel>

        <Panel title={t('signage.panel.checks')}>
          <FindingList findings={fitFindings} empty={t('signage.checks.empty')} limit={8} />
          <div style={{ marginTop: SPACE.md }}>
            <Tag
              label={safetyGuard.ok ? t('signage.safety.breached') : t('signage.safety.intact')}
              severity={safetyGuard.ok ? 'blocking' : 'valid'}
            />
          </div>
          <Note>{t('signage.safety.note')}</Note>
        </Panel>

        <Panel title={t('signage.panel.determinism')}>
          <dl style={{ margin: 0, display: 'grid', gap: SPACE.xs, fontSize: TEXT.small }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.md }}>
              <dt style={{ color: 'var(--text-secondary)' }}>{t('signage.determinism.faces')}</dt>
              <dd style={{ margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {String(facesToCompile)}
              </dd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.md }}>
              <dt style={{ color: 'var(--text-secondary)' }}>{t('signage.determinism.measure')}</dt>
              <dd style={{ margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {String(PREVIEW_GLYPH_RATIO)}
              </dd>
            </div>
          </dl>
          <Note>{t('signage.determinism.note')}</Note>
        </Panel>
      </PanelGrid>

      <Note>{t('signage.note')}</Note>
    </div>
  );
}
