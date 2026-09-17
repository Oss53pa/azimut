/**
 * N1.2 — horaires d'ouverture d'un bâtiment.
 *
 * « Par jour, plusieurs plages possibles, fuseau du site. » La structure suit
 * cette phrase : un jour de la semaine porte zéro, une ou plusieurs plages
 * horaires. Un jour absent est un jour fermé — l'absence est l'information,
 * il n'y a pas de plage vide à écrire.
 *
 * Les heures sont des heures de pendule locales, `HH:MM`, sans fuseau et sans
 * date. Le fuseau est celui du site, comme le dit N1.2 ; **aucun champ du
 * modèle ne le porte encore** et aucun moteur n'évalue donc « ouvert
 * maintenant ». Tant que ce champ manque, ces horaires se lisent et
 * s'affichent, ils ne se comparent pas à une horloge.
 */

/** Jours de la semaine, lundi d'abord, comme ISO 8601 les numérote. */
export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export function isWeekday(value: string): value is Weekday {
  return (WEEKDAYS as readonly string[]).includes(value);
}

/** Plage horaire locale, bornes `HH:MM`, `from` strictement avant `to`. */
export type OpeningRange = {
  readonly from: string;
  readonly to: string;
};

/** Un jour absent est fermé. */
export type OpeningHours = {
  readonly [D in Weekday]?: readonly OpeningRange[];
};

const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** Minutes depuis minuit, ou `null` si la chaîne n'est pas une heure `HH:MM`. */
export function minutesOfDay(value: string): number | null {
  if (!HHMM.test(value)) return null;
  const hours = Number(value.slice(0, 2));
  const minutes = Number(value.slice(3, 5));
  return hours * 60 + minutes;
}

/**
 * Une plage valide a deux bornes lisibles et une durée strictement positive.
 *
 * Une plage qui franchit minuit n'est pas représentable ici : elle s'écrit sur
 * deux jours, ce que la structure permet. Accepter `22:00 → 02:00` obligerait
 * tout lecteur à deviner le jour de la borne de fin.
 */
export function isOpeningRange(value: unknown): value is OpeningRange {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const { from, to } = record;
  if (typeof from !== 'string' || typeof to !== 'string') return false;
  const start = minutesOfDay(from);
  const end = minutesOfDay(to);
  if (start === null || end === null) return false;
  return start < end;
}

/**
 * Lit des horaires depuis une valeur de base quelconque.
 *
 * Tout ce qui n'est pas lisible est écarté : un jour inconnu, une plage
 * malformée, une plage de durée nulle ou négative. Les plages retenues sont
 * triées par heure de début, ce qui rend la lecture stable d'un chargement à
 * l'autre (invariant 4). Rend `undefined` quand il ne reste rien, plutôt qu'un
 * objet vide : un bâtiment sans horaires déclarés et un bâtiment fermé sept
 * jours sur sept ne se confondent pas.
 *
 * Aucun code d'anomalie ne couvre encore un horaire illisible ; l'écart est
 * donc silencieux, et conservateur — il retire une plage, il n'en invente pas.
 */
export function readOpeningHours(value: unknown): OpeningHours | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;

  const hours: { [D in Weekday]?: readonly OpeningRange[] } = {};
  let kept = 0;
  for (const day of WEEKDAYS) {
    const raw = record[day];
    if (!Array.isArray(raw)) continue;
    const ranges = raw
      .filter(isOpeningRange)
      .sort((a, b) => (minutesOfDay(a.from) ?? 0) - (minutesOfDay(b.from) ?? 0));
    if (ranges.length === 0) continue;
    hours[day] = ranges;
    kept += ranges.length;
  }

  return kept === 0 ? undefined : hours;
}

/** Plages déclarées pour un jour. Vide quand le jour est fermé. */
export function rangesForDay(
  hours: OpeningHours | undefined,
  day: Weekday,
): readonly OpeningRange[] {
  return hours?.[day] ?? [];
}
