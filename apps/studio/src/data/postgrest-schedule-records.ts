/**
 * R12 (partie R) — le circuit du tableau des messages d'un site, lu par l'API
 * REST : versions (0027), lignes, décisions (0074) et passages de la
 * validation de complétude (0035).
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
  const [schedules, validations] = await Promise.all([
    query<Row>(config, 'message_schedule', `select=*&site_id=eq.${siteId}`),
    query<Row>(config, 'graph_validation', `select=*&site_id=eq.${siteId}`),
  ]);
  const scheduleIds = schedules.map(s => s.id);
  const [lines, approvals] = await Promise.all([
    queryIn<Row>(config, 'message_line', 'schedule_id', scheduleIds),
    queryIn<Row>(config, 'message_schedule_approval', 'schedule_id', scheduleIds),
  ]);
  return { schedules, lines, approvals, validations };
}
