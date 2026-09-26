import { type JSX, useState } from 'react';
import {
  ENTERABLE_BLOCK_KINDS, declareBlockCommand, updateFreeTextCommand, withdrawBlockCommand,
  faceLangs, readFreeTexts, isEnterableBlockKind,
  type ContentBlockInstance, type FreeTexts, type SupportFace,
} from '@azimut/core-model';
import { useSiteData } from '../../context/useSiteData.js';
import { useI18n } from '../../i18n/useI18n.js';
import type { UiMessageKey } from '../../i18n/messages.js';
import { SelectField, TextField, Button, Note, SPACE, TEXT, LABEL_STYLE, type Option } from '../../components/ui/index.js';
import type { CommandWrite } from '../../state/use-command-write.js';
import { single } from '../../state/use-command-write.js';

const KNOWN_KINDS: ReadonlySet<string> = new Set(['free', 'legend', 'map', 'resolved', 'pictogram']);

type FaceBlocksProps = {
  readonly face: SupportFace;
  readonly write: CommandWrite;
};

function TextFields({ langs, texts, onChange, disabled }: {
  readonly langs: readonly string[];
  readonly texts: FreeTexts;
  readonly onChange: (texts: FreeTexts) => void;
  readonly disabled: boolean;
}): JSX.Element {
  const { t } = useI18n();
  return (
    <>
      {langs.map(lang => (
        <TextField
          key={lang}
          label={t('faceblocks.text.label', { lang })}
          value={texts[lang] ?? ''}
          onChange={value => { onChange({ ...texts, [lang]: value }); }}
          disabled={disabled}
        />
      ))}
    </>
  );
}

/**
 * D8.3 — les blocs d'une face déclarée : ajouter un bloc libre ou une
 * légende, réécrire un texte libre, retirer. Les blocs venus du gabarit ou
 * des plans muraux se lisent ici sans se saisir.
 */
export function FaceBlocks({ face, write }: FaceBlocksProps): JSX.Element {
  const site = useSiteData();
  const { t } = useI18n();
  const langs = faceLangs(site, face);
  const [kind, setKind] = useState<string>(ENTERABLE_BLOCK_KINDS[0]);
  const [texts, setTexts] = useState<FreeTexts>({});
  const [editing, setEditing] = useState<{ readonly id: string; readonly texts: FreeTexts } | null>(null);
  const inactive = write.readonly || write.busy;

  const blocks = site.content_blocks
    .filter(b => b.face_id === face.id)
    .sort((a, b) => a.block_index - b.block_index || a.id.localeCompare(b.id));
  const kindLabel = (k: string): string => (KNOWN_KINDS.has(k) ? t(`faceblocks.kind.${k}` as UiMessageKey) : k);
  const kindOptions: readonly Option[] = ENTERABLE_BLOCK_KINDS.map(k => ({ value: k, label: kindLabel(k) }));
  const now = (): string => new Date().toISOString();

  function add(): void {
    const outcome = declareBlockCommand(site, face, kind, kind === 'free' ? texts : {}, {
      newId: () => crypto.randomUUID(), timestamp: now(),
    });
    void write.send(single(outcome), 'faceblocks.added').then(ok => { if (ok) setTexts({}); });
  }

  function save(block: ContentBlockInstance, next: FreeTexts): void {
    void write.send(single(updateFreeTextCommand(site, face, block, next, now())), 'faceblocks.saved')
      .then(ok => { if (ok) setEditing(null); });
  }

  const summary = (b: ContentBlockInstance): string => {
    if (b.kind !== 'free') return isEnterableBlockKind(b.kind) ? '' : t('faceblocks.fixed');
    const read = readFreeTexts(b);
    return langs.map(l => read[l]).filter((v): v is string => v !== undefined).join(' · ');
  };

  return (
    <section style={{ padding: '12px 16px', display: 'grid', gap: SPACE.sm }} aria-label={t('faceblocks.title')}>
      <h3 style={{ ...LABEL_STYLE, margin: 0 }}>{t('faceblocks.title')}</h3>
      {blocks.length === 0 && <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-muted)' }}>{t('faceblocks.none')}</p>}
      {blocks.map(b => (
        <div key={b.id} style={{ display: 'grid', gap: SPACE.xs }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: SPACE.sm }}>
            <span style={{ fontSize: TEXT.small }}>{t('faceblocks.item', { index: b.block_index, kind: kindLabel(b.kind) })}</span>
            {isEnterableBlockKind(b.kind) && (
              <span style={{ display: 'flex', gap: SPACE.xs }}>
                {b.kind === 'free' && editing?.id !== b.id && (
                  <Button rank="quiet" disabled={inactive} onClick={() => { setEditing({ id: b.id, texts: readFreeTexts(b) }); }}>
                    {t('faceblocks.edit')}
                  </Button>
                )}
                <Button
                  rank="quiet"
                  disabled={inactive}
                  onClick={() => { void write.send(single(withdrawBlockCommand(b, now())), 'faceblocks.withdrawn'); }}
                >
                  {t('faceblocks.withdraw')}
                </Button>
              </span>
            )}
          </div>
          {editing?.id === b.id
            ? (
              <div style={{ display: 'grid', gap: SPACE.sm }}>
                <TextFields langs={langs} texts={editing.texts} onChange={next => { setEditing({ id: b.id, texts: next }); }} disabled={inactive} />
                <span style={{ display: 'flex', gap: SPACE.xs }}>
                  <Button rank="secondary" disabled={inactive} onClick={() => { save(b, editing.texts); }}>{t('faceblocks.save')}</Button>
                  <Button rank="quiet" onClick={() => { setEditing(null); }}>{t('faceblocks.cancel')}</Button>
                </span>
              </div>
            )
            : summary(b) !== '' && <span style={{ fontSize: TEXT.micro, color: 'var(--text-muted)' }}>{summary(b)}</span>}
        </div>
      ))}
      <h3 style={{ ...LABEL_STYLE, margin: `${String(SPACE.sm)}px 0 0` }}>{t('faceblocks.add.title')}</h3>
      <SelectField label={t('faceblocks.add.kind')} value={kind} options={kindOptions} onChange={setKind} disabled={inactive} />
      {kind === 'free' && <TextFields langs={langs} texts={texts} onChange={setTexts} disabled={inactive} />}
      <div>
        <Button rank="secondary" onClick={add} disabled={inactive}>{t('faceblocks.add.submit')}</Button>
      </div>
      <Note>{t('faceblocks.note')}</Note>
    </section>
  );
}
