import { type JSX, useMemo, useState } from 'react';
import { codePointCompare, getErrorMessage } from '@azimut/core-model';
import type { ErrorCode, Finding } from '@azimut/core-model';
import type { RouteAnimationOptions, StepInstruction } from '@azimut/engine-graph';
import { Button, Panel, SelectField, StateBanner, SPACE, TEXT } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import type { UiMessageKey } from '../i18n/messages.js';
import { readSessionGraph } from '../state/session-graph.js';
import { planRoute, profilesOfSession } from '../state/route-preview.js';
import type { PlannedRoute } from '../state/route-preview.js';
import type { TrancheSession } from './useTrancheSession.js';

/**
 * L3.1 (partie L) — le parcours d'un visiteur, dans l'atelier du graphe : un
 * départ, une arrivée, un profil du site, et le tracé progressif niveau par
 * niveau, avec la transition dite à chaque changement de niveau.
 *
 * Le mode à animation réduite est respecté : la vue statique est alors celle
 * qui s'ouvre, et elle reste un choix à tout moment (E6, F18).
 */

/** Le tracé, aux couleurs du thème : l'accent est ce que le logiciel a calculé (M7.10, partie M). */
const OPTIONS: RouteAnimationOptions = {
  width_px: 560, height_px: 320, padding_px: 20, stroke_px: 4, marker_px: 12, duration_s: 6,
  theme: {
    background: 'var(--surface-canvas)',
    footprint_fill: 'var(--surface-panel)',
    footprint_stroke: 'var(--border-strong)',
    route: 'var(--accent)',
    marker: 'var(--text-primary)',
    marker_fill: 'var(--surface-canvas)',
  },
};

const MEANS: Readonly<Record<string, UiMessageKey>> = {
  elevator: 'route.means.elevator',
  stair: 'route.means.stair',
  escalator: 'route.means.escalator',
};

const STEP: Readonly<Record<StepInstruction['key'], UiMessageKey>> = {
  from: 'route.step.from',
  take_elevator: 'route.step.take_elevator',
  take_stairs: 'route.step.take_stairs',
  take_escalator: 'route.step.take_escalator',
  pass_by: 'route.step.pass_by',
  arrival: 'route.step.arrival',
  continue_towards: 'route.step.continue_towards',
  go_through: 'route.step.go_through',
  continue_for: 'route.step.continue_for',
};

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function useRoutePreview(session: TrancheSession): { readonly panel: JSX.Element } {
  const { t, lang } = useI18n();
  const nodes = useMemo(() => readSessionGraph(session.state).nodes, [session.state]);
  const profiles = useMemo(() => profilesOfSession(session.state), [session.state]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [profileId, setProfileId] = useState('');
  const [planned, setPlanned] = useState<PlannedRoute | null>(null);
  const [findings, setFindings] = useState<readonly Finding[]>([]);
  const [frame, setFrame] = useState(0);
  const [still, setStill] = useState(prefersReducedMotion);
  const [replay, setReplay] = useState(0);

  const options = [...nodes]
    .sort((a, b) => (a.label || a.id).localeCompare(b.label || b.id, lang) || codePointCompare(a.id, b.id))
    .map(n => ({ value: n.id, label: `${n.label === '' ? n.kind : n.label} · ${n.id.slice(-6)}` }));
  const profile = profiles.find(p => p.id === profileId) ?? profiles[0];

  function trace(): void {
    if (profile === undefined || from === '' || to === '') return;
    const out = planRoute(session.state, profile, from, to, OPTIONS);
    if (!out.ok) { setPlanned(null); setFindings(out.findings); return; }
    // Un tracé réussi peut porter des avertissements : ils se disent aussi.
    setPlanned(out.value); setFindings(out.warnings); setFrame(0); setReplay(r => r + 1);
  }

  const current = planned?.animation.frames[frame] ?? null;
  const change = planned?.animation.level_changes[frame] ?? null;
  const levelName = (id: string): string => planned?.levels.find(l => l.id === id)?.name ?? id;

  const panel = (
    <Panel title={t('route.title')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm, padding: SPACE.md }}>
        {profiles.length === 0 ? (
          <StateBanner severity="info" message={t('route.no_profile')} />
        ) : nodes.length < 2 ? (
          <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-muted)' }}>{t('route.too_few_nodes')}</p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <SelectField label={t('route.from')} value={from} onChange={setFrom}
                options={[{ value: '', label: '—' }, ...options]} />
              <SelectField label={t('route.to')} value={to} onChange={setTo}
                options={[{ value: '', label: '—' }, ...options]} />
              <SelectField label={t('route.profile')} value={profile?.id ?? ''} onChange={setProfileId}
                options={profiles.map(p => ({ value: p.id, label: p.name }))} />
              <Button rank="primary" onClick={trace}>{t('route.trace')}</Button>
            </div>
            {findings.map(f => (
              <StateBanner key={`${f.code}:${f.entity?.id ?? ''}`} severity={f.severity} code={f.code}
                message={getErrorMessage(f.code as ErrorCode, lang) ?? f.code} />
            ))}
          </>
        )}
        {planned !== null && current !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
            <p style={{ margin: 0, fontSize: TEXT.small }} role="status">
              {t('route.frame', {
                level: levelName(current.level_id), index: frame + 1,
                count: planned.animation.frames.length, length: current.length_m,
              })}
              {' · '}
              {t('route.decisions', { count: current.decision_node_ids.length })}
            </p>
            <div key={`${String(replay)}:${String(frame)}:${String(still)}`} role="img" data-testid="route-frame"
              data-level={current.level_id} data-still={still ? 'true' : 'false'}
              aria-label={t('route.frame_label', { level: levelName(current.level_id) })}
              dangerouslySetInnerHTML={{ __html: still ? current.static_svg : current.svg }} />
            <p style={{ margin: 0, fontSize: TEXT.micro, color: 'var(--text-muted)' }}>{t('route.legend')}</p>
            {change !== null && (
              <StateBanner severity="info" message={t('route.change', {
                means: t(MEANS[planned.nodeKinds.get(change.exit_node_id) ?? ''] ?? 'route.means.other'),
                level: levelName(change.to_level_id),
              })} />
            )}
            <h3 style={{ margin: 0, fontSize: TEXT.small }}>
              {t('route.steps', { distance: Math.round(planned.totalDistance_m) })}
            </h3>
            <ol aria-label={t('route.steps', { distance: Math.round(planned.totalDistance_m) })}
              style={{ margin: 0, paddingLeft: SPACE.lg, fontSize: TEXT.small }}>
              {planned.steps.map((step, i) => (
                <li key={`${step.node_id}:${String(i)}`}>
                  {step.instruction.key === 'continue_for'
                    ? t(STEP.continue_for, { distance: Math.round(step.instruction.distance_m) })
                    : t(STEP[step.instruction.key], { label: step.instruction.label === '' ? step.kind : step.instruction.label })}
                </li>
              ))}
            </ol>
            <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button rank="secondary" onClick={() => { setReplay(r => r + 1); }}>{t('route.replay')}</Button>
              {frame > 0 && (
                <Button rank="quiet" onClick={() => { setFrame(f => f - 1); }}>{t('route.previous_level')}</Button>
              )}
              {frame < planned.animation.frames.length - 1 && (
                <Button rank="secondary" onClick={() => { setFrame(f => f + 1); }}>{t('route.next_level')}</Button>
              )}
              <label style={{ display: 'inline-flex', gap: SPACE.xs, alignItems: 'center', fontSize: TEXT.small }}>
                <input type="checkbox" checked={still} onChange={event => { setStill(event.target.checked); }} />
                {t('route.static')}
              </label>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
  return { panel };
}
