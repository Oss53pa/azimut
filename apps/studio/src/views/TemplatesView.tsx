import { type JSX, useMemo, useState } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import type { FaceTemplate } from '@azimut/core-model';
import type { ViewId } from '../views.js';
import {
  ScreenHeader, MetricRow, Panel, PanelGrid, DataTable, Tag, Note,
  SPACE, TEXT, type Metric, type Column,
} from '../components/ui/index.js';
import { TemplateRegions } from './templates/TemplateRegions.js';

type TemplatesViewProps = {
  readonly onNavigate: (view: ViewId) => void;
};

type TemplateRow = {
  readonly template: FaceTemplate;
  /** Part de la face couverte par les régions déclarées, en pour-cent. */
  readonly coverage_pct: number;
  readonly overlaps: number;
  readonly typologyFound: boolean;
  readonly sideFound: boolean;
};

/** Deux régions se recouvrent quand leurs rectangles se croisent. */
function overlaps(a: FaceTemplate['blocks'][number], b: FaceTemplate['blocks'][number]): boolean {
  return a.region.x_pct < b.region.x_pct + b.region.w_pct
    && b.region.x_pct < a.region.x_pct + a.region.w_pct
    && a.region.y_pct < b.region.y_pct + b.region.h_pct
    && b.region.y_pct < a.region.y_pct + a.region.h_pct;
}

/**
 * Module 04 — les gabarits.
 *
 * Un gabarit déclare des régions en pour-cent de la face et le type de contenu
 * qui s'y résout ; il ne porte aucun texte. Ce que l'écran mesure sur chacun,
 * c'est ce qu'un gabarit peut avoir de faux sans qu'aucun rendu ne le montre :
 * une couverture incomplète, deux régions qui se recouvrent, un rattachement
 * à une typologie ou à un côté qui n'existe pas.
 */
export function TemplatesView({ onNavigate }: TemplatesViewProps): JSX.Element {
  const site = useSiteData();
  const { t } = useI18n();

  const rows = useMemo<readonly TemplateRow[]>(() => {
    const typeByKey = new Map(site.support_types.map(type => [type.key, type]));

    return [...site.face_templates]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((template): TemplateRow => {
        const type = typeByKey.get(template.support_type_key);
        let overlapCount = 0;
        for (let i = 0; i < template.blocks.length; i++) {
          for (let j = i + 1; j < template.blocks.length; j++) {
            const a = template.blocks[i];
            const b = template.blocks[j];
            if (a !== undefined && b !== undefined && overlaps(a, b)) overlapCount++;
          }
        }
        const covered = template.blocks.reduce(
          (sum, block) => sum + (block.region.w_pct * block.region.h_pct) / 100,
          0,
        );
        return {
          template,
          coverage_pct: Math.round(covered),
          overlaps: overlapCount,
          typologyFound: type !== undefined,
          sideFound: type?.faces.some(f => f.side === template.side) ?? false,
        };
      });
  }, [site]);

  const [selectedId, setSelectedId] = useState<string | undefined>(rows[0]?.template.id);
  const selected = rows.find(r => r.template.id === selectedId);

  const orphan = rows.filter(r => !r.typologyFound || !r.sideFound).length;
  const withOverlap = rows.filter(r => r.overlaps > 0).length;
  const partial = rows.filter(r => r.coverage_pct < 100).length;

  const metrics: readonly Metric[] = [
    { id: 'templates', label: t('templates.metric.templates'), value: String(rows.length) },
    {
      id: 'blocks',
      label: t('templates.metric.blocks'),
      value: String(rows.reduce((n, r) => n + r.template.blocks.length, 0)),
    },
    {
      id: 'partial',
      label: t('templates.metric.partial'),
      value: String(partial),
      severity: partial > 0 ? 'warning' : 'valid',
    },
    {
      id: 'overlap',
      label: t('templates.metric.overlap'),
      value: String(withOverlap),
      severity: withOverlap > 0 ? 'warning' : 'valid',
    },
    {
      id: 'orphan',
      label: t('templates.metric.orphan'),
      value: String(orphan),
      severity: orphan > 0 ? 'blocking' : 'valid',
    },
  ];

  const columns: readonly Column<TemplateRow>[] = [
    { id: 'name', header: t('templates.col.name'), cell: r => r.template.name },
    { id: 'type', header: t('templates.col.typology'), cell: r => r.template.support_type_key },
    { id: 'side', header: t('templates.col.side'), cell: r => r.template.side },
    { id: 'blocks', header: t('templates.col.blocks'), numeric: true, cell: r => String(r.template.blocks.length) },
    {
      id: 'coverage',
      header: t('templates.col.coverage'),
      numeric: true,
      cell: r => (
        <Tag
          label={`${String(r.coverage_pct)} %`}
          severity={r.coverage_pct >= 100 ? 'valid' : 'warning'}
        />
      ),
    },
    {
      id: 'binding',
      header: t('templates.col.binding'),
      cell: r => (
        <Tag
          label={r.typologyFound
            ? (r.sideFound ? t('templates.binding.ok') : t('templates.binding.noside'))
            : t('templates.binding.notype')}
          severity={r.typologyFound && r.sideFound ? 'valid' : 'blocking'}
        />
      ),
    },
  ];

  return (
    <div>
      <ScreenHeader
        eyebrow={t('templates.eyebrow')}
        title={t('templates.title')}
        subtitle={t('templates.subtitle')}
        actions={[
          { id: 'faces', label: t('templates.action.faces'), onSelect: () => { onNavigate('faces'); } },
        ]}
      />

      <MetricRow metrics={metrics} />

      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('templates.panel.list')} note={t('templates.panel.list.note')} padded={false}>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={r => r.template.id}
            selectedKey={selectedId}
            onSelect={r => { setSelectedId(r.template.id); }}
            empty={t('templates.empty')}
          />
        </Panel>
      </div>

      <div style={{ marginTop: SPACE.lg }}>
        <PanelGrid min={300}>
          <Panel
            title={t('templates.panel.regions')}
            note={selected === undefined ? undefined : `${String(selected.coverage_pct)} %`}
          >
            {selected === undefined ? (
              <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-muted)' }}>
                {t('templates.regions.none')}
              </p>
            ) : (
              <TemplateRegions template={selected.template} />
            )}
            <Note>{t('templates.regions.note')}</Note>
          </Panel>

          <Panel title={t('templates.panel.blocks')} note={String(selected?.template.blocks.length ?? 0)}>
            {selected === undefined ? (
              <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-muted)' }}>
                {t('templates.blocks.none')}
              </p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: SPACE.xs }}>
                {[...selected.template.blocks]
                  .sort((a, b) => a.ordinal - b.ordinal)
                  .map(block => (
                    <li
                      key={`${block.kind}-${String(block.ordinal)}`}
                      style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.md, fontSize: TEXT.small }}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                        {`${String(block.ordinal)} · ${block.kind}`}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {`${String(block.region.x_pct)},${String(block.region.y_pct)}`
                          + ` · ${String(block.region.w_pct)}×${String(block.region.h_pct)}`}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
            <Note>{t('templates.blocks.note')}</Note>
          </Panel>
        </PanelGrid>
      </div>

      <Note>{t('templates.note')}</Note>
    </div>
  );
}
