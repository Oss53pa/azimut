/**
 * Construction de l'index des paquets de règles — lit le disque.
 *
 * Séparé de `resolve-site-pack.ts`, qui résout un paquet depuis un index
 * déjà construit et reste donc pur. Ce fichier-ci charge les paquets et
 * relève du serveur ; il n'entre jamais dans un paquet destiné au
 * navigateur.
 */

import type { Outcome } from '@azimut/core-model';
import type { LoadedRulesPack } from './rule-resolution.js';
import type { LoadRulesPackOptions } from './loader.js';
import { loadRulesPack } from './loader.js';
import type { RulesPackIndex, RulesPackSource } from './resolve-site-pack.js';

/**
 * Build a pack index from the file corpus. Each source binds an id to a
 * directory, loaded via {@link loadRulesPack} (checksum, source-ref and
 * TEST-environment guards all applied). The first source that fails to load
 * aborts the build with its findings — a corpus with one broken pack is never
 * returned as a silently partial index.
 *
 * This is the file-backed way to populate the index; a database-backed builder
 * (reading `rules_pack_rule` rows) can produce the same `RulesPackIndex`
 * without touching {@link resolveSiteRulesPack}.
 */
export function buildRulesPackIndex(
  sources: readonly RulesPackSource[],
  options: LoadRulesPackOptions,
): Outcome<RulesPackIndex> {
  const index = new Map<string, LoadedRulesPack>();
  for (const source of sources) {
    const loaded = loadRulesPack(source.directory, options);
    if (!loaded.ok) return loaded;
    index.set(source.id, loaded.value);
  }
  return { ok: true, value: index, warnings: [] };
}
