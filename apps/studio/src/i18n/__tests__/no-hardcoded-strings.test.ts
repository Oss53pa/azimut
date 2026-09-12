import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUDIO_SRC = resolve(HERE, '..', '..');

// Text-bearing attributes: their value is UI text and must come from a key
// (F10.3), never a literal. Empty literals (alt="") are allowed.
const TEXT_ATTR = /\b(aria-label|placeholder|title|alt)=["']([^"'{}][^"']*)["']/g;
// JSX text nodes with human letters (not an expression, not pure symbols).
const JSX_TEXT = />\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' .,!?:–-]{2,})\s*</g;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    // The dictionary is where strings live; tests may hold fixtures.
    if (entry.name === 'i18n' || entry.name === '__tests__') continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('F10.3 / F16 — no UI text written in a component', () => {
  it('every studio component string goes through an i18n key', () => {
    const violations: string[] = [];
    for (const file of walk(STUDIO_SRC)) {
      const rel = relative(STUDIO_SRC, file);
      readFileSync(file, 'utf-8').split('\n').forEach((line, i) => {
        for (const m of line.matchAll(TEXT_ATTR)) {
          violations.push(`${rel}:${i + 1}: ${m[1]}="${m[2]}"`);
        }
        for (const m of line.matchAll(JSX_TEXT)) {
          violations.push(`${rel}:${i + 1}: text ">${m[1]}<"`);
        }
      });
    }
    expect(
      violations,
      `Hardcoded UI strings (use an i18n key):\n${violations.join('\n')}`,
    ).toHaveLength(0);
  });
});
