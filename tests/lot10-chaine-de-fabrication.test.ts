import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Lot 10 de l'audit : la chaîne de fabrication ne prend que ce qu'elle a
 * figé. Une action désignée par une étiquette, ou un outil pris dans sa
 * dernière version, change sans que le dépôt le dise.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS = resolve(ROOT, '.github', 'workflows');
const workflows = readdirSync(WORKFLOWS).filter(f => /\.ya?ml$/.test(f))
  .map(f => ({ name: f, text: readFileSync(resolve(WORKFLOWS, f), 'utf8') }));

describe('lot 10 : la chaîne de fabrication est figée', () => {
  it('chaque action est épinglée par son empreinte, avec sa version en clair', () => {
    const uses = workflows.flatMap(w => [...w.text.matchAll(/uses:\s*(\S+)(.*)$/gm)]
      .map(m => ({ where: w.name, ref: m[1] ?? '', comment: (m[2] ?? '').trim() })));
    expect(uses.length).toBeGreaterThan(0);
    expect(uses.filter(u => !/@[0-9a-f]{40}$/.test(u.ref)).map(u => `${u.where} ${u.ref}`)).toEqual([]);
    expect(uses.filter(u => !/^# v\d+\.\d+\.\d+$/.test(u.comment)).map(u => `${u.where} ${u.ref}`)).toEqual([]);
  });

  it('un outil appelé par npx l’est dans une version exacte', () => {
    const calls = workflows.flatMap(w => [...w.text.matchAll(/npx\s+(?:--yes\s+)?(\S+)/g)].map(m => m[1] ?? ''));
    expect(calls.filter(c => !/@\d+\.\d+\.\d+$/.test(c))).toEqual([]);
  });

  it('l’installation suit le verrou, et toutes les dépendances sont auditées', () => {
    const ci = workflows.map(w => w.text).join('\n');
    const installs = [...ci.matchAll(/pnpm install([^\n]*)/g)].map(m => m[1] ?? '');
    expect(installs.length).toBeGreaterThan(0);
    expect(installs.filter(i => !i.includes('--frozen-lockfile'))).toEqual([]);
    expect(ci).toContain('pnpm audit:all');
    const manifest = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(manifest.scripts['audit:all']).toBe('pnpm audit --audit-level=high');
  });

  it('une version forcée ne fait que corriger, dans la même version majeure', () => {
    const manifest = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
      pnpm?: { overrides?: Record<string, string> };
    };
    for (const [range, version] of Object.entries(manifest.pnpm?.overrides ?? {})) {
      const major = /@>=(\d+)\./.exec(range)?.[1];
      expect(version.split('.')[0], range).toBe(major);
    }
  });
});
