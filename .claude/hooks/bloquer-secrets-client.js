#!/usr/bin/env node

/**
 * Hook PreToolUse de Claude Code : refuse d'écrire une variable d'environnement
 * exposée au navigateur dont le nom annonce un secret.
 *
 * Les préfixes VITE_, NEXT_PUBLIC_, REACT_APP_, EXPO_PUBLIC_ et PUBLIC_ sont
 * recopiés dans le bundle client par leur outil de construction : une clé de
 * service, un jeton ou un mot de passe qui porte l'un d'eux est publié à tout
 * visiteur. Le hook lit sur l'entrée standard l'appel d'outil (Write, Edit,
 * MultiEdit), cherche ces noms dans le texte qui va être écrit, et sort en
 * code 2 pour bloquer l'écriture, avec la raison sur la sortie d'erreur.
 *
 * Une clé publique par conception (clé anon ou publiable de Supabase) passe si
 * son nom le dit (ANON, PUBLISHABLE, PUBLIC) ou si elle figure dans
 * `variables-client-autorisees.json`, à côté de ce fichier.
 *
 * Limite connue : une écriture faite par le shell (echo >> .env) ne passe pas
 * par ce hook. Le test `tests/a6-3-no-secret-in-repo.test.ts` reste le filet.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CLIENT_VAR =
  /\b(?:VITE_|NEXT_PUBLIC_|REACT_APP_|EXPO_PUBLIC_|PUBLIC_)[A-Z0-9_]+\b/g;

/**
 * Un nom en `_KEY` seul n'est pas bloqué : la clé publiable du studio en porte
 * un (voir `.env.example`). Pour bloquer aussi les `*_API_KEY`, créer
 * `variables-client-autorisees.json` avec les clés publiques vérifiées, puis
 * ajouter `_KEY$` à ce motif.
 */
const SECRET_WORD =
  /(SECRET|SERVICE_ROLE|SERVICE_KEY|PRIVATE|PASSWORD|PASSWD|TOKEN|JWT|CREDENTIAL)/;

const PUBLIC_WORD = /(ANON|PUBLISHABLE|_PUBLIC_KEY)/;

function allowlist() {
  const path = join(import.meta.dirname, 'variables-client-autorisees.json');
  if (!existsSync(path)) return new Set();
  const parsed = JSON.parse(readFileSync(path, 'utf-8'));
  if (!Array.isArray(parsed) || !parsed.every((v) => typeof v === 'string')) {
    throw new Error(`${path} doit contenir un tableau de noms de variables.`);
  }
  return new Set(parsed);
}

/** Le texte que l'appel d'outil s'apprête à écrire. */
function writtenText(input) {
  const tool = input.tool_input ?? {};
  const parts = [];
  if (typeof tool.content === 'string') parts.push(tool.content);
  if (typeof tool.new_string === 'string') parts.push(tool.new_string);
  if (Array.isArray(tool.edits)) {
    for (const edit of tool.edits) {
      if (typeof edit?.new_string === 'string') parts.push(edit.new_string);
    }
  }
  return parts.join('\n');
}

export function forbiddenNames(text, allowed) {
  const found = new Set();
  for (const [name] of text.matchAll(CLIENT_VAR)) {
    if (allowed.has(name)) continue;
    const suffix = name.replace(/^(VITE_|NEXT_PUBLIC_|REACT_APP_|EXPO_PUBLIC_|PUBLIC_)/, '');
    if (PUBLIC_WORD.test(suffix)) continue;
    if (SECRET_WORD.test(suffix)) found.add(name);
  }
  return [...found].sort();
}

function main() {
  const raw = readFileSync(0, 'utf-8');
  const input = JSON.parse(raw);
  const names = forbiddenNames(writtenText(input), allowlist());
  if (names.length === 0) process.exit(0);
  process.stderr.write(
    `Écriture refusée : ${names.join(', ')} serait exposé au navigateur.\n`
      + 'Un secret reste côté serveur (service, fonction de base). Si la clé est '
      + 'publique par conception, renomme-la (ANON, PUBLISHABLE) ou ajoute-la à '
      + '.claude/hooks/variables-client-autorisees.json après vérification.\n',
  );
  process.exit(2);
}

main();
