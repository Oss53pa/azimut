import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * A6.3 : le hook Claude Code `.claude/hooks/bloquer-secrets-client.js` refuse
 * d'écrire une variable exposée au navigateur dont le nom annonce un secret.
 *
 * Le hook est lancé comme Claude Code le lance : un processus, l'appel d'outil
 * en JSON sur l'entrée standard, le code de sortie pour verdict (0 laisse
 * passer, 2 bloque).
 */

const HOOK = resolve(import.meta.dirname, '..', '.claude', 'hooks', 'bloquer-secrets-client.js');

function run(toolInput: Record<string, unknown>, toolName = 'Write'): { status: number | null; stderr: string } {
  const result = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: toolName, tool_input: toolInput }),
    encoding: 'utf-8',
  });
  return { status: result.status, stderr: result.stderr };
}

// Les noms sont assemblés pour que ce fichier ne soit pas lui-même refusé.
const name = (prefix: string, suffix: string): string => `${prefix}${suffix}`;

describe('hook bloquer-secrets-client', () => {
  it('bloque une clé de service exposée au client', () => {
    const out = run({ file_path: '.env.example', content: `${name('VITE_', 'SUPABASE_SERVICE_ROLE_KEY')}=` });
    expect(out.status).toBe(2);
    expect(out.stderr).toContain(name('VITE_', 'SUPABASE_SERVICE_ROLE_KEY'));
  });

  it('bloque un secret sous chacun des préfixes publics', () => {
    for (const prefix of ['VITE_', 'NEXT_PUBLIC_', 'REACT_APP_', 'EXPO_PUBLIC_']) {
      expect(run({ file_path: 'a.ts', content: name(prefix, 'STRIPE_SECRET') }).status).toBe(2);
    }
  });

  it('lit le texte écrit par Edit et par MultiEdit', () => {
    expect(run({ file_path: 'a.ts', old_string: 'x', new_string: name('VITE_', 'JWT_SECRET') }, 'Edit').status).toBe(2);
    expect(run({ file_path: 'a.ts', edits: [{ old_string: 'x', new_string: name('VITE_', 'DB_PASSWORD') }] }, 'MultiEdit').status).toBe(2);
  });

  it('laisse passer les clés publiques par conception et les variables serveur', () => {
    const content = [
      name('VITE_', 'SUPABASE_ANON_KEY'),
      name('VITE_', 'STRIPE_PUBLISHABLE_KEY'),
      name('VITE_', 'AZIMUT_API_URL'),
      name('VITE_', 'AZIMUT_API_KEY'),
      'AZIMUT_TEST_JWT_SECRET',
    ].join('\n');
    expect(run({ file_path: '.env.example', content }).status).toBe(0);
  });
});
