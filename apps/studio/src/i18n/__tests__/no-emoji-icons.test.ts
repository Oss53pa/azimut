import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUDIO_SRC = resolve(HERE, '..', '..');

// F9.1/F9.2 — interface icons are stroke-only, from a controlled set, never a
// filled/coloured glyph. Emoji (Extended_Pictographic) are exactly the "aplat
// plein" F9 forbids, and several risk confusion with wayfinding/safety
// pictograms. F16 requires the static iconographic control.
const EMOJI = /\p{Extended_Pictographic}/u;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__') continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('F9 / F16 — no emoji or filled-glyph icons in the studio', () => {
  it('no Extended_Pictographic character in any component', () => {
    const violations: string[] = [];
    for (const file of walk(STUDIO_SRC)) {
      const rel = relative(STUDIO_SRC, file);
      readFileSync(file, 'utf-8').split('\n').forEach((line, i) => {
        if (EMOJI.test(line)) violations.push(`${rel}:${i + 1}: ${line.trim().slice(0, 60)}`);
      });
    }
    expect(
      violations,
      `Emoji/filled-glyph icons found (use a stroke icon, F9):\n${violations.join('\n')}`,
    ).toHaveLength(0);
  });
});
