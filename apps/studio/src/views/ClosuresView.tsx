import { type JSX, useMemo, useState } from 'react';
import {
  asList, declareClosureCommand, withdrawClosureCommand, codePointCompare, type TemporaryClosure,
} from '@azimut/core-model';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import {
  ScreenHeader, Panel, PanelGrid, TextField, MultiChoice, Button, StateBanner, SPACE,
  type Option,
} from '../components/ui/index.js';
import { useCommandWrite } from '../state/use-command-write.js';
import { FindingList } from './message-schedule/FindingList.js';
import { NoticeList } from './message-schedule/NoticeList.js';
import { ClosuresPanel } from './closures/ClosuresPanel.js';
import { closureRows } from './closures/closure-rows.js';
import { siteLabels } from './register/labels.js';

/**
 * Module 01 — la saisie des fermetures temporaires (O11). Une fermeture porte
 * une ou plusieurs arêtes, un début, une fin et un motif libre ; elle se
 * déclare ou se retire par une commande sur `temporary_closure`, envoyée à
 * `apply_commands`, et l'écran relit ensuite le site, qui reste la source de
 * vérité.
 *
 * Sans base configurée, le formulaire est inactif et le dit : rien n'est
 * simulé en mémoire.
 */
export function ClosuresView(): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();
  const write = useCommandWrite();
  const { readonly, busy, findings, notices, done } = write;
  const labels = useMemo(() => siteLabels(site, lang), [site, lang]);
  const rows = useMemo(() => closureRows(site), [site]);

  const [edgeIds, setEdgeIds] = useState<readonly string[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const edgeOptions: readonly Option[] = useMemo(
    () => site.graph.edges
      .map(e => ({ value: e.id, label: `${labels.node(e.from_node_id)} — ${labels.node(e.to_node_id)}` }))
      .sort((a, b) => a.label.localeCompare(b.label, lang) || codePointCompare(a.value, b.value)),
    [site, labels, lang],
  );

  function declare(): void {
    const outcome = declareClosureCommand(site, { edgeIds, from, to, reason }, {
      newId: () => crypto.randomUUID(), timestamp: new Date().toISOString(),
    });
    void write.send(asList(outcome), 'closures.form.done').then(ok => {
      if (ok) { setEdgeIds([]); setFrom(''); setTo(''); setReason(''); }
    });
  }

  function withdraw(closure: TemporaryClosure): void {
    void write.send(asList(withdrawClosureCommand(closure, new Date().toISOString())), 'closures.form.withdrawn');
  }

  const inactive = readonly || busy;
  const edgesTouched = new Set(rows.flatMap(c => c.edge_ids)).size;
  return (
    <div>
      <ScreenHeader
        eyebrow={t('closures.eyebrow')}
        title={t('closures.title')}
        subtitle={t('closures.subtitle', { count: rows.length, edges: edgesTouched })}
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
            <MultiChoice
              label={t('closures.form.edge')}
              options={edgeOptions}
              selected={edgeIds}
              onChange={setEdgeIds}
              disabled={inactive}
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
            <TextField
              label={t('closures.form.reason')}
              value={reason}
              onChange={setReason}
              disabled={inactive}
            />
            <FindingList findings={findings} empty="" />
            <NoticeList notices={notices} />
            <div>
              <Button rank="primary" onClick={declare} disabled={inactive}>
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
