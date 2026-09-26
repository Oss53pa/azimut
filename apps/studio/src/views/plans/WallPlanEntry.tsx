import { type JSX, useMemo, useState } from 'react';
import { declareWallPlanCommands, supportFaceCount } from '@azimut/core-model';
import { useSiteData } from '../../context/useSiteData.js';
import { useI18n } from '../../i18n/useI18n.js';
import { Panel, SelectField, Button, StateBanner, Note, SPACE, type Option } from '../../components/ui/index.js';
import type { CommandWrite } from '../../state/use-command-write.js';
import { FindingList } from '../message-schedule/FindingList.js';
import { siteLabels } from '../register/labels.js';

type WallPlanEntryProps = {
  /** L'écriture partagée avec l'écran, dont le retrait passe aussi par elle. */
  readonly write: CommandWrite;
};

/**
 * T-2.9 — déclarer un plan mural : un support, une de ses faces, et le bloc
 * `map` s'y écrit (la face d'abord si elle manque). Inactif sans base.
 */
export function WallPlanEntry({ write }: WallPlanEntryProps): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();
  const labels = useMemo(() => siteLabels(site, lang), [site, lang]);
  const [supportId, setSupportId] = useState('');
  const [face, setFace] = useState('0');

  const supportOptions: readonly Option[] = useMemo(
    () => [...site.supports]
      .sort((a, b) => (a.code ?? a.id).localeCompare(b.code ?? b.id))
      .map(s => ({ value: s.id, label: `${s.code ?? s.id} · ${labels.node(s.node_id)}` })),
    [site, labels],
  );
  const faces = supportId === '' ? 0 : supportFaceCount(site, supportId);
  const faceOptions: readonly Option[] = Array.from({ length: faces }, (_, i) => ({
    value: String(i), label: t('wallplans.entry.face.option', { index: i }),
  }));
  const inactive = write.readonly || write.busy;

  function declare(): void {
    if (supportId === '') { write.clear(); return; }
    const outcome = declareWallPlanCommands(site, supportId, Number(face), {
      newId: () => crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    });
    void write.send(outcome, 'wallplans.entry.done');
  }

  return (
    <div style={{ marginBottom: SPACE.lg }}>
      {write.readonly && (
        <div style={{ marginBottom: SPACE.md }}>
          <StateBanner severity="info" message={t('wallplans.entry.readonly')} />
        </div>
      )}
      {write.done !== null && (
        <div style={{ marginBottom: SPACE.md }}>
          <StateBanner severity="valid" message={t(write.done)} />
        </div>
      )}
      <Panel title={t('wallplans.entry.panel')}>
        <div style={{ display: 'grid', gap: SPACE.md, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', alignItems: 'start' }}>
          <SelectField
            label={t('wallplans.entry.support')}
            value={supportId}
            options={supportOptions}
            placeholder={t('wallplans.entry.support.placeholder')}
            onChange={id => { setSupportId(id); setFace('0'); }}
            disabled={inactive}
          />
          <SelectField
            label={t('wallplans.entry.face')}
            value={face}
            options={faceOptions}
            onChange={setFace}
            placeholder={faces === 0 ? t('wallplans.entry.face.placeholder') : undefined}
            disabled={inactive || faces === 0}
          />
          <div style={{ paddingTop: SPACE.lg }}>
            <Button rank="primary" onClick={declare} disabled={inactive || supportId === ''}>
              {t('wallplans.entry.submit')}
            </Button>
          </div>
        </div>
        <FindingList findings={write.findings} empty="" />
        <Note>{`${t('wallplans.entry.face.hint')} ${t('wallplans.entry.note')}`}</Note>
      </Panel>
    </div>
  );
}
