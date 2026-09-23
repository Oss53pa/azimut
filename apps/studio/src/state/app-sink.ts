/**
 * L'émetteur de commandes de l'application, construit depuis l'environnement.
 *
 * Le chemin d'écriture existe depuis le lot 1.2 — `createPostgrestSink`
 * appelle `azimut.apply_commands`, qui applique une suite en une transaction.
 * Aucun écran ne l'employait : tous recevaient un émetteur local, qui accepte
 * la commande sans l'envoyer. Un formulaire qui écrit dans une session locale
 * n'écrit pas.
 *
 * La configuration est la même que celle du dépôt de lecture (A2.4 : aucune
 * clé, aucune URL dans le code). Sans elle, l'émetteur est absent et
 * l'appelant retombe sur le mode local — c'est le cas hors ligne que M8
 * (partie M) critère 3 demande, et le refuser rendrait la tranche
 * invérifiable sur un poste nu.
 */
import { createPostgrestSink } from './postgrest-sink.js';
import { DEFAULT_SCHEMA } from '../data/config.js';
import type { DataSourceEnv } from '../data/config.js';
import type { CommandSink } from './command-store.js';

function trimmed(value: string | undefined): string {
  return value === undefined ? '' : value.trim();
}

/**
 * Rend l'émetteur réel, ou `null` si le dépôt n'est pas configuré.
 *
 * Même exigence que pour le dépôt de lecture : l'URL **et** la clé. Une
 * configuration à moitié faite retombe en local plutôt que d'échouer à chaque
 * écriture.
 */
export function createSink(env: DataSourceEnv): CommandSink | null {
  const url = trimmed(env.VITE_AZIMUT_API_URL).replace(/\/+$/, '');
  const apiKey = trimmed(env.VITE_AZIMUT_API_KEY);
  if (url === '' || apiKey === '') return null;

  const schema = trimmed(env.VITE_AZIMUT_DB_SCHEMA);
  return createPostgrestSink({
    url, apiKey, schema: schema === '' ? DEFAULT_SCHEMA : schema,
  });
}

/** L'émetteur de l'application, construit depuis l'environnement de build. */
export function appSink(): CommandSink | null {
  return createSink(import.meta.env as DataSourceEnv);
}
