import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import '../zod-sans-compilation.js';

/** Lot 7 de l'audit : zod valide sans compilation à la volée, réglé avant tout schéma. */
const MAIN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'main.tsx');

describe('lot 7 : zod sans compilation à la volée', () => {
  it('le réglage est posé', () => {
    expect(z.config().jitless).toBe(true);
  });

  it('le point d’entrée l’importe avant tout autre module', () => {
    const first = readFileSync(MAIN, 'utf8').split('\n').find(line => line.startsWith('import '));
    expect(first).toBe("import './security/zod-sans-compilation';");
  });
});
