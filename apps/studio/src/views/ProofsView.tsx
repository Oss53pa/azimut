import { type JSX, useMemo } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import { composeFace } from '@azimut/engine-graph';
import { admittedEvents } from '@azimut/core-model';
import type { SupportVersionEvent } from '@azimut/core-model';
import type { FaceTemplate, SupportVersionState, SupportVersion } from '@azimut/core-model';
import type { ViewId } from '../views.js';
import { findPreviewNode } from './signage/face-preview.js';
import {
  ScreenHeader, MetricRow, Panel, PanelGrid, DataTable, Tag, Note, StateBanner,
  SPACE, TEXT, type Metric, type Column,
} from '../components/ui/index.js';
import { FindingList } from './message-schedule/FindingList.js';

type ProofsViewProps = {
  readonly onNavigate: (view: ViewId) => void;
};

/** Valeurs fixes de l'épreuve : deux passages sur les mêmes données coïncident. */
const REVIEW_SUPPORT_ID = 'review';
const REVIEW_GENERATED_AT = '1970-01-01T00:00:00.000Z';

const VERSION_STATES: readonly SupportVersionState[] = [
  'draft', 'in_review', 'approved', 'superseded',
];

type FaceStatus = {
  readonly template: FaceTemplate;
  readonly composable: boolean;
  readonly warnings: number;
  readonly blockers: number;
};

/**
 * Ce qu'un état admet, lu dans la machine plutôt que recopié (invariant 1).
 *
 * L'écran interrogeait jusqu'ici la table de D9, qui ne porte que les états.
 * Il interroge désormais celle des versions de support, qui porte les
 * événements — et c'est elle qui dit G7 : depuis `approved`, aucun événement
 * n'est admis sauf le remplacement. Montrer « approuvé → remplacé » sans
 * nommer l'événement laissait croire qu'une version approuvée pouvait encore
 * bouger d'elle-même.
 */
function admittedFrom(
  state: SupportVersionState,
): readonly { readonly event: SupportVersionEvent; readonly to: SupportVersionState }[] {
  return admittedEvents(state).filter(admitted => admitted.to !== state);
}

/**
 * Module 04 — les épreuves et le bon à tirer.
 *
 * Une face ne part en épreuve que si elle se compose. L'écran mesure donc
 * d'abord cela, face par face, puis montre la colonne vertébrale des versions
 * — brouillon, en revue, approuvé, remplacé — et les transitions que la machine
 * à états autorise depuis chacune.
 */
export function ProofsView({ onNavigate }: ProofsViewProps): JSX.Element {
  const site = useSiteData();
  const { t } = useI18n();
  const profile = site.travel_profiles[0];

  const statuses = useMemo<readonly FaceStatus[]>(() => {
    const node = findPreviewNode(site.graph.nodes);
    if (profile === undefined || node === undefined) {
      return [...site.face_templates].map((template): FaceStatus => ({
        template, composable: false, warnings: 0, blockers: 0,
      }));
    }
    return [...site.face_templates]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((template): FaceStatus => {
        const result = composeFace({
          site,
          template,
          profile,
          supportId: REVIEW_SUPPORT_ID,
          nodeId: node.id,
          generated_at: REVIEW_GENERATED_AT,
        });
        return {
          template,
          composable: result.ok,
          warnings: result.ok ? result.warnings.length : 0,
          blockers: result.ok ? 0 : result.findings.length,
        };
      });
  }, [site, profile]);

  const blockingFindings = useMemo(() => {
    const node = findPreviewNode(site.graph.nodes);
    if (profile === undefined || node === undefined) return [];
    return statuses.flatMap(status => {
      if (status.composable) return [];
      const result = composeFace({
        site,
        template: status.template,
        profile,
        supportId: REVIEW_SUPPORT_ID,
        nodeId: node.id,
        generated_at: REVIEW_GENERATED_AT,
      });
      return result.ok ? [] : result.findings;
    });
  }, [site, profile, statuses]);

  const composable = statuses.filter(s => s.composable).length;
  const versions = site.support_versions;

  const metrics: readonly Metric[] = [
    { id: 'faces', label: t('proofs.metric.faces'), value: String(statuses.length) },
    {
      id: 'composable',
      label: t('proofs.metric.composable'),
      value: `${String(composable)} / ${String(statuses.length)}`,
      severity: composable === statuses.length ? 'valid' : 'blocking',
    },
    (() => {
      const total = statuses.reduce((n, s) => n + s.warnings, 0);
      return {
        id: 'warnings',
        label: t('proofs.metric.warnings'),
        value: String(total),
        ...(total > 0 ? { severity: 'warning' as const } : {}),
      };
    })(),
    { id: 'versions', label: t('proofs.metric.versions'), value: String(versions.length) },
    {
      id: 'approved',
      label: t('proofs.metric.approved'),
      value: String(versions.filter(v => v.state === 'approved').length),
      // Pas de vert quand il n'y a rien à approuver : zéro sur zéro n'est
      // pas une réussite.
      ...(versions.length > 0 ? { severity: 'valid' as const } : {}),
    },
  ];

  const faceColumns: readonly Column<FaceStatus>[] = [
    { id: 'name', header: t('proofs.col.template'), cell: s => s.template.name },
    { id: 'type', header: t('proofs.col.typology'), cell: s => s.template.support_type_key },
    { id: 'side', header: t('proofs.col.side'), cell: s => s.template.side },
    {
      id: 'state',
      header: t('proofs.col.composition'),
      cell: s => (
        <Tag
          label={s.composable ? t('proofs.composition.ok') : t('proofs.composition.failed')}
          severity={s.composable ? 'valid' : 'blocking'}
        />
      ),
    },
    {
      id: 'warnings',
      header: t('proofs.col.warnings'),
      numeric: true,
      cell: s => String(s.warnings),
    },
  ];

  const versionColumns: readonly Column<SupportVersion>[] = [
    { id: 'support', header: t('proofs.col.support'), cell: v => v.support_id },
    { id: 'version', header: t('proofs.col.version'), numeric: true, cell: v => String(v.version) },
    {
      id: 'state',
      header: t('proofs.col.state'),
      cell: v => (
        <Tag
          label={t(STATE_KEYS[v.state])}
          severity={v.state === 'approved' ? 'valid' : v.state === 'superseded' ? undefined : 'warning'}
          muted={v.state === 'superseded'}
        />
      ),
    },
    { id: 'hash', header: t('proofs.col.hash'), cell: v => v.content_hash?.slice(0, 12) ?? '—' },
    { id: 'created', header: t('proofs.col.created'), cell: v => v.created_at },
  ];

  return (
    <div>
      <ScreenHeader
        eyebrow={t('proofs.eyebrow')}
        title={t('proofs.title')}
        subtitle={t('proofs.subtitle')}
        actions={[
          { id: 'signage', label: t('proofs.action.signage'), onSelect: () => { onNavigate('signage'); } },
        ]}
      />

      <MetricRow metrics={metrics} />

      {profile === undefined && (
        <div style={{ marginTop: SPACE.md }}>
          <StateBanner
            severity="blocking"
            code="GRAPH.PROFILE_NOT_ACCESSIBLE"
            message={t('proofs.noprofile.message')}
          />
        </div>
      )}

      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('proofs.panel.faces')} note={t('proofs.panel.faces.note')} padded={false}>
          <DataTable
            columns={faceColumns}
            rows={statuses}
            rowKey={s => s.template.id}
            empty={t('proofs.faces.empty')}
          />
        </Panel>
      </div>

      <div style={{ marginTop: SPACE.lg }}>
        <Panel title={t('proofs.panel.versions')} note={t('proofs.panel.versions.note')} padded={false}>
          <DataTable
            columns={versionColumns}
            rows={[...versions].sort((a, b) => a.support_id.localeCompare(b.support_id) || a.version - b.version)}
            rowKey={v => v.id}
            empty={t('proofs.versions.empty')}
          />
        </Panel>
      </div>

      <div style={{ marginTop: SPACE.lg }}>
        <PanelGrid min={300}>
          <Panel title={t('proofs.panel.machine')} note={t('proofs.panel.machine.note')}>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: SPACE.sm }}>
              {VERSION_STATES.map(state => {
                const admitted = admittedFrom(state);
                return (
                  <li key={state} style={{ display: 'grid', gap: 2 }}>
                    <span style={{ fontSize: TEXT.small, color: 'var(--text-primary)' }}>
                      {t(STATE_KEYS[state])}
                    </span>
                    <span style={{ fontSize: TEXT.micro, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {admitted.length === 0
                        ? t('proofs.machine.terminal')
                        : admitted
                          .map(a => `${t(EVENT_KEYS[a.event])} → ${t(STATE_KEYS[a.to])}`)
                          .join(' · ')}
                    </span>
                  </li>
                );
              })}
            </ul>
            <Note>{t('proofs.machine.note')}</Note>
            <Note>{t('proofs.g7.note')}</Note>
          </Panel>

          <Panel title={t('proofs.panel.blockers')} note={String(blockingFindings.length)}>
            <FindingList findings={blockingFindings} empty={t('proofs.blockers.empty')} limit={10} />
          </Panel>
        </PanelGrid>
      </div>

      <Note>{t('proofs.note')}</Note>
    </div>
  );
}

const EVENT_KEYS = {
  modify: 'proofs.event.modify',
  emit_proof: 'proofs.event.emitproof',
  reject: 'proofs.event.reject',
  approve: 'proofs.event.approve',
  supersede: 'proofs.event.supersede',
} as const;

const STATE_KEYS = {
  draft: 'proofs.state.draft',
  in_review: 'proofs.state.inreview',
  approved: 'proofs.state.approved',
  superseded: 'proofs.state.superseded',
} as const;
