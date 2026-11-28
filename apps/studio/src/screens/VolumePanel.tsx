import { type JSX, useMemo, useState } from 'react';
import type { Finding, Footprint, FormNotice } from '@azimut/core-model';
import type { UiMessageKey } from '../i18n/messages.js';
import { VOLUME_MATERIALS } from '@azimut/db/reference';
import { useI18n } from '../i18n/useI18n.js';
import { useSessionIdentity } from '../auth/identity.js';
import { Button, DataTable, NumericField, Panel, SelectField, StateBanner, type Column } from '../components/ui/index.js';
import { SPACE } from '../components/ui/tokens.js';
import { FindingList } from '../views/message-schedule/FindingList.js';
import { NoticeList } from '../views/message-schedule/NoticeList.js';
import { footprintsOfLevel, levelsOfSession } from '../state/session-scope.js';
import { rowsOf } from '../state/session-store.js';
import type { StoredRow } from '../state/session-store.js';
import { numeric, text } from '../state/row-values.js';
import { acceptVolume, volumeCommand, volumeDefaults } from '../state/volume-input.js';
import type { TrancheSession } from '../app/useTrancheSession.js';

/**
 * T-1.3 — le volume d'une empreinte, dans l'atelier des empreintes.
 *
 * L'opérateur choisit une empreinte du niveau ; le formulaire se remplit du
 * volume qu'elle porte, ou, à défaut, des valeurs tirées du niveau
 * (`volumeDefaults`). La matière se choisit toujours. Un enregistrement est un
 * geste annulable, comme tout geste de l'atelier ; la base revalide la hauteur
 * et la matière.
 */
type Draft = {
  readonly base: number | null;
  readonly height: number | null;
  readonly material: string;
};

const KEYS = VOLUME_MATERIALS.map(m => m.key);

const KIND_LABEL: Readonly<Record<Footprint['kind'], UiMessageKey>> = {
  cell: 'fp.kind.cell',
  circulation: 'fp.kind.circulation',
  technical: 'fp.kind.technical',
  vertical_core: 'fp.kind.vertical_core',
  outdoor: 'fp.kind.outdoor',
  parking_space: 'fp.kind.parking_space',
};

export function VolumePanel({ session, levelId }: {
  readonly session: TrancheSession;
  readonly levelId: string;
}): JSX.Element {
  const { t, lang } = useI18n();
  const identity = useSessionIdentity();
  const [footprintId, setFootprintId] = useState('');
  const [draft, setDraft] = useState<Draft>({ base: null, height: null, material: '' });
  const [findings, setFindings] = useState<readonly Finding[]>([]);
  const [notices, setNotices] = useState<readonly FormNotice[]>([]);
  const [saved, setSaved] = useState(false);

  const footprints = useMemo(() => footprintsOfLevel(session.state, levelId), [session.state, levelId]);
  const volumes = useMemo(() => {
    const ids = new Set(footprints.map(f => f.id));
    return rowsOf(session.state, 'volume').filter(row => ids.has(text(row.values, 'footprint_id') ?? ''));
  }, [session.state, footprints]);
  const defaults = useMemo(
    () => volumeDefaults(levelsOfSession(session.state).levels, levelId),
    [session.state, levelId],
  );

  const volumeOf = (id: string): StoredRow | null =>
    volumes.find(row => text(row.values, 'footprint_id') === id) ?? null;
  // Une empreinte sans code se nomme par sa nature et son rang parmi celles
  // de même nature sans code, dans l'ordre des identifiants (A9) : quatre
  // places de stationnement ne doivent pas porter le même nom dans la liste.
  const labelOf = (id: string): string => {
    const footprint = footprints.find(f => f.id === id);
    if (footprint === undefined) return id;
    if (footprint.unit_code !== undefined && footprint.unit_code !== '') return footprint.unit_code;
    const peers = footprints.filter(f => f.kind === footprint.kind && (f.unit_code ?? '') === '');
    return t('volume.unnamed', { kind: t(KIND_LABEL[footprint.kind]), rank: peers.indexOf(footprint) + 1 });
  };
  const materialLabel = (key: string): string => {
    const material = VOLUME_MATERIALS.find(m => m.key === key);
    if (material === undefined) return key;
    return lang === 'en' ? material.name_en : material.name_fr;
  };

  function choose(id: string): void {
    setFootprintId(id);
    setFindings([]);
    setNotices([]);
    setSaved(false);
    const existing = volumeOf(id);
    if (existing !== null) {
      setDraft({
        base: numeric(existing.values, 'base_elevation_m'),
        height: numeric(existing.values, 'height_m'),
        material: text(existing.values, 'material_key') ?? '',
      });
      return;
    }
    setDraft({ base: defaults?.base_elevation_m ?? null, height: defaults?.height_m ?? null, material: '' });
  }

  function save(): void {
    void (async () => {
      setSaved(false);
      const accepted = acceptVolume(
        { footprintId, base_elevation_m: draft.base, height_m: draft.height, material_key: draft.material }, KEYS,
      );
      setNotices(accepted.notices);
      if (!accepted.ok) { setFindings(accepted.findings); return; }
      const existing = volumeOf(footprintId);
      const command = volumeCommand(
        accepted.value,
        existing === null ? null : { id: existing.id, values: existing.values },
        { orgId: identity.orgId, timestamp: session.now(), newId: session.newId() },
      );
      if (!command.ok) { setFindings(command.findings); return; }
      setFindings([]);
      if (await session.write([command.value])) setSaved(true);
    })();
  }

  const columns: readonly Column<StoredRow>[] = [
    { id: 'footprint', header: t('volume.col.footprint'), cell: row => labelOf(text(row.values, 'footprint_id') ?? '') },
    { id: 'base', header: t('volume.col.base'), numeric: true, cell: row => String(numeric(row.values, 'base_elevation_m') ?? '') },
    { id: 'height', header: t('volume.col.height'), numeric: true, cell: row => String(numeric(row.values, 'height_m') ?? '') },
    { id: 'material', header: t('volume.col.material'), cell: row => materialLabel(text(row.values, 'material_key') ?? '') },
  ];

  if (footprints.length === 0) {
    return (
      <Panel title={t('volume.panel')} note={t('volume.note')}>
        <StateBanner severity="info" message={t('volume.no_footprint')} />
      </Panel>
    );
  }

  const fresh = footprintId !== '' && volumeOf(footprintId) === null;
  return (
    <Panel title={t('volume.panel')} note={t('volume.note')}>
      <div style={{ display: 'grid', gap: SPACE.md }}>
        <DataTable columns={columns} rows={volumes} rowKey={row => row.id} empty={t('volume.none')} />
        <div style={{ display: 'flex', gap: SPACE.md, alignItems: 'end', flexWrap: 'wrap' }}>
          <SelectField
            label={t('volume.footprint')}
            value={footprintId}
            placeholder={t('volume.footprint.choose')}
            options={footprints.map(f => ({ value: f.id, label: labelOf(f.id) }))}
            onChange={choose}
          />
          <NumericField
            label={t('volume.base')} unit="m" step={0.01} value={draft.base}
            disabled={footprintId === ''}
            onChange={value => { setDraft(d => ({ ...d, base: value })); }}
          />
          <NumericField
            label={t('volume.height')} unit="m" step={0.01} min={0} value={draft.height}
            disabled={footprintId === ''}
            hint={fresh ? t(defaults?.height_m === null ? 'volume.height.hint.top' : 'volume.height.hint.next') : undefined}
            onChange={value => { setDraft(d => ({ ...d, height: value })); }}
          />
          <SelectField
            label={t('volume.material')}
            value={draft.material}
            placeholder={t('volume.material.choose')}
            disabled={footprintId === ''}
            options={VOLUME_MATERIALS.map(m => ({ value: m.key, label: lang === 'en' ? m.name_en : m.name_fr }))}
            onChange={value => { setDraft(d => ({ ...d, material: value })); }}
          />
          <Button rank="primary" onClick={save} disabled={footprintId === ''}>{t('volume.save')}</Button>
        </div>
        <FindingList findings={findings} empty="" />
        <NoticeList notices={notices} />
        {saved && <StateBanner severity="valid" message={t('volume.saved')} />}
      </div>
    </Panel>
  );
}
