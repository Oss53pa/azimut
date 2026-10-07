/**
 * R12 (partie R) — le circuit du tableau des messages d'un site, lu par l'API
 * REST : versions (0027), lignes, décisions (0074), passages de la
 * validation de complétude (0035), et annotations de révision avec leur fil
 * (0073, J4). Les annotations et réponses supprimées ne sont pas relues : la
 * suppression est logique.
 *
 * Sans cette lecture, la session ne portait que ce que l'écran avait écrit
 * lui-même : à la réouverture d'un site, l'écran du tableau retombait dans
 * l'état vide de R16, et l'émission pour revue ne voyait plus aucun passage
 * de validation.
 *
 * Les colonnes sont rendues telles que la base les porte. Les colonnes `jsonb`
 * arrivent en objets là où le chemin d'écriture les avait posées en texte : la
 * lecture du tableau accepte les deux formes.
 */
import { query, queryIn, type PostgrestConfig } from './postgrest-http.js';
import type { ScheduleRecords } from './site-repository.js';

type Row = Readonly<Record<string, unknown>> & { readonly id: string };

export async function loadScheduleRecords(config: PostgrestConfig, siteId: string): Promise<ScheduleRecords> {
  const [schedules, validations, annotations] = await Promise.all([
    query<Row>(config, 'message_schedule', `select=*&site_id=eq.${siteId}`),
    query<Row>(config, 'graph_validation', `select=*&site_id=eq.${siteId}`),
    query<Row>(config, 'review_annotation', `select=*&site_id=eq.${siteId}&deleted_at=is.null`),
  ]);
  const scheduleIds = schedules.map(s => s.id);
  const [lines, approvals, replies] = await Promise.all([
    queryIn<Row>(config, 'message_line', 'schedule_id', scheduleIds),
    queryIn<Row>(config, 'message_schedule_approval', 'schedule_id', scheduleIds),
    queryIn<Row>(config, 'review_annotation_reply', 'annotation_id', annotations.map(a => a.id)),
  ]);
  const annotationReplies = replies
    .filter(r => r['deleted_at'] === null || r['deleted_at'] === undefined);
  return { schedules, lines, approvals, validations, annotations, annotationReplies };
}
