import { type JSX, useMemo, useState } from 'react';
import {
  CLOSURE_REASONS, declareClosureCommand, withdrawClosureCommand,
  type EntityCommand, type Finding, type Outcome,
} from '@azimut/core-model';
import { useSiteData } from '../context/useSiteData.js';
import { useSiteReload } from '../context/useSiteReload.js';
import { useI18n } from '../i18n/useI18n.js';
import type { UiMessageKey } from '../i18n/messages.js';
import {
  ScreenHeader, Panel, PanelGrid, TextField, SelectField, Button, StateBanner, SPACE,
  type Option,
} from '../components/ui/index.js';
import { appSink } from '../state/app-sink.js';
import { FindingList } from './message-schedule/FindingList.js';
import { ClosuresPanel } from './closures/ClosuresPanel.js';
import { closureRows, type ClosureRow } from './closures/closure-rows.js';
import { siteLabels } from './register/labels.js';

const FIRST_REASON = CLOSURE_REASONS[0];

/**
 * Module 01 — la saisie des fermetures d'arêtes (A5.3). Une fermeture se
 * déclare ou se retire par une commande `update` sur `edge.availability`,
 * envoyée à `apply_commands` ; l'écran relit ensuite le site, qui reste la
 * source de vérité.
 *
 * Sans base configurée, le formulaire est inactif et le dit : rien n'est
 * simulé en mémoire (décision du 26/09/2026).
 */
export function ClosuresView(): JSX.Element {
  const site = useSiteData();
  const reload = useSiteReload();
  const { t, lang } = useI18n();
  const sink = useMemo(() => appSink(), []);
  const labels = useMemo(() => siteLabels(site, lang), [site, lang]);
  const rows = useMemo(() => closureRows(site), [site]);

  const [edgeId, setEdgeId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState<string>(FIRST_REASON);
  const [findings, setFindings] = useState<readonly Finding[]>([]);
  const [done, setDone] = useState<UiMessageKey | null>(null);
  const [busy, setBusy] = useState(false);

  const readonly = sink === null;
  const edgeOptions: readonly Option[] = useMemo(
    () => site.graph.edges
      .map(e => ({ value: e.id, label: `${labels.node(e.from_node_id)} — ${labels.node(e.to_node_id)}` }))
      .sort((a, b) => a.label.localeCompare(b.label, lang) || a.value.localeCompare(b.value)),
    [site, labels, lang],
  );
  const reasonOptions: readonly Option[] = CLOSURE_REASONS.map(r => ({ value: r, label: t(`closures.reason.${r}`) }));
  const edge = site.graph.edges.find(e => e.id === edgeId);
  const unreadable = edge?.availability?.readable === false;

  async function send(outcome: Outcome<EntityCommand>, doneKey: UiMessageKey): Promise<boolean> {
    setDone(null);
    if (!outcome.ok) { setFindings(outcome.findings); return false; }
    if (sink === null) return false;
    setBusy(true);
    const result = await sink([outcome.value]);
    setBusy(false);
    if (!result.ok) { setFindings(result.findings); return false; }
    setFindings([]);
    setDone(doneKey);
    reload();
    return true;
  }

  function declare(): void {
    if (edge === undefined) { setDone(null); setFindings([]); return; }
    const outcome = declareClosureCommand(
      edge,
      { from, to, reason_key: reason },
      { timestamp: new Date().toISOString(), declaredBy: null },
    );
    void send(outcome, 'closures.form.done').then(ok => {
      if (ok) { setFrom(''); setTo(''); }
    });
  }

  function withdraw(row: ClosureRow): void {
    if (row.closure === null) return;
    void send(withdrawClosureCommand(row.edge, row.closure, new Date().toISOString()), 'closures.form.withdrawn');
  }

  const inactive = readonly || busy;
  return (
    <div>
      <ScreenHeader
        eyebrow={t('closures.eyebrow')}
        title={t('closures.title')}
        subtitle={t('closures.subtitle', { count: rows.filter(r => r.closure !== null).length, edges: new Set(rows.map(r => r.edge.id)).size })}
      />
      {readonly && (
        <div style={{ marginBottom: SPACE.lg }}>
          <StateBanner severity="info" message={t('closures.form.readonly')} />
        </div>
      )}
      {done !== null && (
        <div style={{ marginBottom: SPACE.lg }}>
          <StateBanner severity="valid" message={t(done)} />
        </div>
      )}
      <PanelGrid min={360}>
        <Panel title={t('closures.form.panel')}>
          <div style={{ display: 'grid', gap: SPACE.md }}>
            <SelectField
              label={t('closures.form.edge')}
              value={edgeId}
              options={edgeOptions}
              placeholder={t('closures.form.edge.placeholder')}
              onChange={setEdgeId}
              disabled={inactive}
              error={unreadable ? t('closures.form.unreadable') : undefined}
            />
            <TextField
              label={t('closures.form.from')}
              value={from}
              onChange={setFrom}
              hint={t('closures.form.instant.hint')}
              disabled={inactive}
            />
            <TextField
              label={t('closures.form.to')}
              value={to}
              onChange={setTo}
              hint={t('closures.form.instant.hint')}
              disabled={inactive}
            />
            <SelectField
              label={t('closures.form.reason')}
              value={reason}
              options={reasonOptions}
              onChange={setReason}
              disabled={inactive}
            />
            <FindingList findings={findings} empty={edge === undefined && !readonly ? t('closures.form.edge.required') : ''} />
            <div>
              <Button rank="primary" onClick={declare} disabled={inactive || edge === undefined || unreadable}>
                {t('closures.form.submit')}
              </Button>
            </div>
          </div>
        </Panel>
        <ClosuresPanel onWithdraw={withdraw} disabled={inactive} />
      </PanelGrid>
    </div>
  );
}
