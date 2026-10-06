import { type JSX, useState } from 'react';
import { Button, StateBanner, Tag, SPACE, TEXT } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import type { UiMessageKey } from '../../i18n/messages.js';
import type { AnnotationState, InkNote, ReviewAnnotation } from '../../state/review-annotation.js';
import { InkNoteView, InkPad } from './InkPad.js';

/**
 * R7.4 (partie R) et J4 (partie J) — les annotations de révision ancrées sur la
 * ligne : auteur, date, état, fil de réponses ; création depuis le panneau.
 *
 * Une remarque se rédige au clavier, se trace au stylet, ou les deux. Avec une
 * sélection de plusieurs lignes, la même remarque en crée une par ligne (R8).
 */
export type AnnotationPanelProps = {
  readonly annotations: readonly ReviewAnnotation[];
  /** R2 (partie R) — le rôle peut-il annoter ? Sinon le panneau se consulte. */
  readonly canAnnotate: boolean;
  /** Le nombre de lignes que la remarque visera : la sélection, ou la ligne. */
  readonly targetCount: number;
  readonly online: boolean;
  readonly onAnnotate: (note: { readonly body: string; readonly ink: InkNote | null }) => boolean;
  readonly onReply: (annotationId: string, body: string) => void;
  readonly onSetState: (annotation: ReviewAnnotation, state: AnnotationState) => void;
};

const STATE_LABEL: Readonly<Record<AnnotationState, UiMessageKey>> = {
  open: 'review.state.open',
  resolved: 'review.state.resolved',
  rejected: 'review.state.rejected',
};

const NOTE_WIDTH_PX = 240;
const NOTE_HEIGHT_PX = 94;

export function AnnotationPanel(props: AnnotationPanelProps): JSX.Element {
  const { t } = useI18n();
  const [body, setBody] = useState('');
  const [ink, setInk] = useState<InkNote>([]);
  const [notice, setNotice] = useState<UiMessageKey | null>(null);

  function submit(): void {
    const written = props.onAnnotate({ body, ink: ink.length === 0 ? null : ink });
    if (!written) { setNotice('review.new.empty'); return; }
    setBody(''); setInk([]); setNotice(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
      <ul aria-label={t('review.list.label')} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
        {props.annotations.map(annotation => (
          <AnnotationItem key={annotation.id} annotation={annotation} canAct={props.canAnnotate}
            onReply={props.onReply} onSetState={props.onSetState} />
        ))}
      </ul>
      {props.annotations.length === 0 && (
        <p style={{ margin: 0, fontSize: TEXT.micro, color: 'var(--text-muted)' }}>
          {t('msgtable.detail.annotations.none')}
        </p>
      )}
      {!props.canAnnotate ? (
        <p style={{ margin: 0, fontSize: TEXT.micro, color: 'var(--text-muted)' }}>{t('review.read_only')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
          <label htmlFor="review-new-body" style={{ fontSize: TEXT.micro, color: 'var(--text-secondary)' }}>
            {t('review.new.body')}
          </label>
          <textarea id="review-new-body" rows={2} value={body} onChange={event => { setBody(event.target.value); }}
            style={{ font: 'inherit', fontSize: TEXT.small, resize: 'vertical' }} />
          <InkPad label={t('review.new.ink')} ink={ink} onInk={setInk}
            onTouchRefused={() => { setNotice('review.ink.touch_refused'); }} />
          <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap' }}>
            <Button rank="primary" onClick={submit}>
              {props.targetCount > 1
                ? t('review.new.submit_selection', { count: props.targetCount })
                : t('review.new.submit')}
            </Button>
            {ink.length > 0 && (
              <Button rank="quiet" onClick={() => { setInk([]); }}>{t('review.new.ink_clear')}</Button>
            )}
          </div>
          {!props.online && <StateBanner severity="info" message={t('review.offline')} />}
          {notice !== null && <StateBanner severity="info" message={t(notice)} />}
        </div>
      )}
    </div>
  );
}

function AnnotationItem({ annotation, canAct, onReply, onSetState }: {
  readonly annotation: ReviewAnnotation;
  readonly canAct: boolean;
  readonly onReply: (annotationId: string, body: string) => void;
  readonly onSetState: (annotation: ReviewAnnotation, state: AnnotationState) => void;
}): JSX.Element {
  const { t } = useI18n();
  const [reply, setReply] = useState('');
  const replyId = `review-reply-${annotation.id}`;
  return (
    <li data-testid="review-annotation" data-state={annotation.state}
      style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs, padding: SPACE.sm, border: '1px solid var(--border-hairline)', borderRadius: 4 }}>
      <div style={{ display: 'flex', gap: SPACE.sm, alignItems: 'center' }}>
        <Tag label={t(STATE_LABEL[annotation.state])} muted={annotation.state !== 'open'} />
        <span style={{ fontSize: TEXT.micro, color: 'var(--text-muted)' }}>{annotation.created_at.slice(0, 16).replace('T', ' ')}</span>
      </div>
      {annotation.body !== '' && <p style={{ margin: 0, fontSize: TEXT.small }}>{annotation.body}</p>}
      {annotation.ink !== null && (
        <InkNoteView ink={annotation.ink} width={NOTE_WIDTH_PX} height={NOTE_HEIGHT_PX} label={t('review.ink.note')} />
      )}
      {annotation.replies.map(r => (
        <p key={r.id} style={{ margin: 0, paddingLeft: SPACE.md, fontSize: TEXT.micro, color: 'var(--text-secondary)' }}>{r.body}</p>
      ))}
      {canAct && (
        <>
          <div style={{ display: 'flex', gap: SPACE.xs, alignItems: 'center' }}>
            <label htmlFor={replyId} style={{ fontSize: TEXT.micro, color: 'var(--text-secondary)' }}>{t('review.reply.label')}</label>
            <input id={replyId} value={reply} onChange={event => { setReply(event.target.value); }}
              style={{ font: 'inherit', fontSize: TEXT.micro, flex: 1, minWidth: 0 }} />
            <Button rank="quiet" onClick={() => { onReply(annotation.id, reply); setReply(''); }}>{t('review.reply.submit')}</Button>
          </div>
          <div style={{ display: 'flex', gap: SPACE.xs }}>
            {annotation.state === 'open' ? (
              <>
                <Button rank="secondary" onClick={() => { onSetState(annotation, 'resolved'); }}>{t('review.action.resolve')}</Button>
                <Button rank="quiet" onClick={() => { onSetState(annotation, 'rejected'); }}>{t('review.action.reject')}</Button>
              </>
            ) : (
              <Button rank="quiet" onClick={() => { onSetState(annotation, 'open'); }}>{t('review.action.reopen')}</Button>
            )}
          </div>
        </>
      )}
    </li>
  );
}
