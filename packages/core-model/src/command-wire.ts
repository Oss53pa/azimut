/**
 * S-19 — la forme sous laquelle une commande validée voyage d'un poste à
 * l'autre.
 *
 * « Ce qui se propage, ce sont les commandes validées de la section E5.1,
 * jamais un geste en cours ni une saisie caractère par caractère. »
 *
 * Deux sens, et ils ne se valent pas :
 *  · écrire une commande que ce poste a construite, de façon déterministe
 *    (A9) : deux postes qui écrivent la même commande produisent la même
 *    chaîne, octet pour octet ;
 *  · relire une commande venue d'ailleurs. C'est une entrée non fiable : elle
 *    est validée par schéma — type, longueur, format, champs inconnus
 *    refusés — puis reconstruite par `buildCommand`, pour que la propriété
 *    unique (INT-1) et le cloisonnement du registre de sécurité (INV-3) soient
 *    contrôlés à la réception comme à l'émission. Une commande relue n'a pas
 *    d'autre chemin que celui d'une commande construite ici.
 *
 * Le fichier est pur : ni horloge, ni base, ni réseau.
 */
import { z } from 'zod';
import { COMMAND_OPERATIONS, buildCommand } from './site-commands.js';
import type { EntityCommand } from './site-commands.js';
import { MODULE_KEYS } from './module-ownership.js';
import type { ColumnValue, RowValues } from './row-values.js';
import type { Finding, Outcome } from './outcome.js';

// ---------------------------------------------------------------------------
// Bornes
// ---------------------------------------------------------------------------

/**
 * Longueur maximale d'une commande écrite, en unités de code. Borne technique
 * contre une entrée démesurée, sans origine normative. Elle borne aussi, par
 * construction, chaque valeur de colonne qu'elle contient.
 */
export const MAX_WIRE_COMMAND_LENGTH = 1_048_576;

/** Longueur maximale d'un identifiant de ligne ou d'organisation. */
export const MAX_WIRE_ID_LENGTH = 128;

/** Longueur maximale d'une clé de regroupement de geste (E5.2). */
export const MAX_WIRE_GROUP_KEY_LENGTH = 256;

/**
 * Un nom de table ou de colonne : celui que le schéma emploie. Il commence
 * par une lettre, ce qui écarte au passage `__proto__`, qu'une affectation
 * transformerait en changement de prototype. 63 est la longueur maximale d'un
 * identifiant PostgreSQL.
 */
const IDENTIFIER = /^[a-z][a-z0-9_]{0,62}$/;

/** L'horodatage tel que `Date.prototype.toISOString` l'écrit, en UTC. */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

/**
 * Écrit une commande. Les clés sont triées à chaque niveau ; les nombres et
 * les chaînes sont rendus par `JSON.stringify`, dont la sortie est fixée par
 * la norme ECMAScript, et un nombre écrit se relit à l'identique. `-0`
 * s'écrit `0`, que la base ne distingue pas de lui.
 *
 * Refuse un nombre non fini, qu'aucune colonne ne peut porter, et une
 * commande plus longue que la borne : le poste qui la recevrait la refuserait.
 */
export function serializeCommand(command: EntityCommand): Outcome<string> {
  for (const [state, row] of [['before', command.before], ['after', command.after]] as const) {
    const column = nonFiniteColumn(row);
    if (column !== null) {
      return refused({ fault: 'non_finite_number', state, column }, command.id);
    }
  }

  const text = canonical({
    after: command.after,
    before: command.before,
    groupKey: command.groupKey,
    id: command.id,
    module: command.module,
    operation: command.operation,
    org_id: command.org_id,
    table: command.table,
    timestamp: command.timestamp,
  });

  if (text.length > MAX_WIRE_COMMAND_LENGTH) {
    return refused({ fault: 'too_long', length: text.length }, command.id);
  }
  return { ok: true, value: text, warnings: [] };
}

function nonFiniteColumn(row: RowValues | null): string | null {
  if (row === null) return null;
  for (const [column, value] of Object.entries(row)) {
    if (typeof value === 'number' && !Number.isFinite(value)) return column;
  }
  return null;
}

type Canonical = ColumnValue | RowValues | { readonly [key: string]: Canonical };

function canonical(value: Canonical): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  const keys = Object.keys(value).sort();
  const record = value as { readonly [key: string]: Canonical };
  return `{${keys.map(k => `${JSON.stringify(k)}:${canonical(record[k] ?? null)}`).join(',')}}`;
}

// ---------------------------------------------------------------------------
// Relecture
// ---------------------------------------------------------------------------

const columnValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const rowValues = z.record(z.string().regex(IDENTIFIER), columnValue).nullable();

const wireCommand = z.strictObject({
  operation: z.enum(COMMAND_OPERATIONS),
  module: z.enum(MODULE_KEYS),
  table: z.string().regex(IDENTIFIER),
  id: z.string().min(1).max(MAX_WIRE_ID_LENGTH),
  org_id: z.string().min(1).max(MAX_WIRE_ID_LENGTH),
  before: rowValues,
  after: rowValues,
  timestamp: z.string().regex(ISO_INSTANT),
  groupKey: z.string().max(MAX_WIRE_GROUP_KEY_LENGTH).nullable(),
});

/**
 * Relit une commande venue d'un autre poste.
 *
 * Trois barrières, dans l'ordre : la longueur, avant tout décodage ; le
 * schéma, qui refuse toute clé inconnue et toute valeur hors de son type ; la
 * construction, qui rejoue les refus de `buildCommand`. Le refus ne recopie
 * aucune valeur reçue : il nomme l'endroit, pas le contenu.
 */
export function parseCommand(text: string): Outcome<EntityCommand> {
  if (text.length > MAX_WIRE_COMMAND_LENGTH) {
    return refused({ fault: 'too_long', length: text.length }, null);
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    return refused({ fault: 'not_json' }, null);
  }

  // `JSON.parse` garde `__proto__` comme clé propre, et le schéma l'écarte
  // sans la signaler : la commande perdrait une colonne en silence. Elle est
  // refusée ici, comme toute clé que le schéma ne connaît pas.
  if (hasProtoKey(decoded)) {
    return refused({ fault: 'schema', path: '__proto__' }, null);
  }

  const parsed = wireCommand.safeParse(decoded);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue === undefined ? '' : issue.path.map(String).join('.');
    return refused({ fault: 'schema', path }, null);
  }

  return buildCommand(parsed.data);
}

/**
 * Une commande a deux niveaux : ses champs, puis les colonnes d'un état. La
 * recherche s'arrête au-delà, où le schéma refusera de toute façon, ce qui
 * borne la récursion sur une entrée imbriquée à dessein.
 */
function hasProtoKey(value: unknown, depth = 0): boolean {
  if (value === null || typeof value !== 'object' || depth > 2) return false;
  if (Object.prototype.hasOwnProperty.call(value, '__proto__')) return true;
  return Object.values(value).some(v => hasProtoKey(v, depth + 1));
}

function refused(
  params: Record<string, string | number>,
  id: string | null,
): { ok: false; findings: Finding[] } {
  return {
    ok: false,
    findings: [{
      code: 'EDIT.COMMAND_SHAPE_INVALID',
      severity: 'blocking',
      entity: id === null ? null : { kind: 'command', id },
      params,
      ruleRef: 'S-19',
    }],
  };
}
