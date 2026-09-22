import { type JSX } from 'react';
import { Button, Dialog, SPACE, TEXT } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';

/**
 * E5.4 — « Reprise proposée à la réouverture après incident, avec choix
 * explicite de l'utilisateur entre l'état local et l'état serveur. Aucune
 * fusion silencieuse. »
 *
 * Trois exigences, et chacune se voit dans ce composant :
 *
 *   · *proposée*, donc une question posée, jamais une restauration d'office ;
 *   · *choix explicite*, donc deux actions nommées, aucune par défaut ;
 *   · *aucune fusion*, donc l'écart est dit à l'utilisateur avant qu'il
 *     tranche, puisque c'est lui qui perd quelque chose dans les deux cas.
 *
 * M7.9 (partie M) s'applique aussi : écarter l'état local est irréversible,
 * et la conséquence est nommée plutôt que sous-entendue.
 */
export type ResumeSessionDialogProps = {
  readonly rowCount: number;
  readonly queuedCount: number;
  readonly onAccept: () => void;
  readonly onDiscard: () => void;
};

export function ResumeSessionDialog({
  rowCount, queuedCount, onAccept, onDiscard,
}: ResumeSessionDialogProps): JSX.Element {
  const { t } = useI18n();
  return (
    <Dialog
      title={t('session.resume.title')}
      onClose={onDiscard}
      actions={
        <>
          <Button rank="secondary" onClick={onDiscard}>{t('session.resume.discard')}</Button>
          <Button rank="primary" onClick={onAccept}>{t('session.resume.accept')}</Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
        <p style={{ margin: 0, fontSize: TEXT.body, lineHeight: 1.5 }}>
          {t('session.resume.body')}
        </p>
        <p style={{ margin: 0, fontSize: TEXT.body, lineHeight: 1.5 }}>
          {t('session.resume.count', {
            rows: String(rowCount),
            queued: String(queuedCount),
          })}
        </p>
        <p
          data-consequence="true"
          style={{ margin: 0, fontSize: TEXT.body, lineHeight: 1.5 }}
        >
          {t('session.resume.warning')}
        </p>
      </div>
    </Dialog>
  );
}
