import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPACING_SCALE, spacing, isAllowedSpacing } from '../tokens.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');
const STUDIO_DIR = resolve(ROOT, 'apps', 'studio', 'src');

// Spacing properties whose values must lie on the F4.1 scale. Sizing (width,
// height, fontSize, top/left, borderRadius, stroke) is out of scope here.
const JS_PROPS = [
  'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'gap', 'rowGap', 'columnGap',
];
const CSS_PROP = /\b(padding|margin|gap|row-gap|column-gap)(?:-(?:top|bottom|left|right))?\s*:\s*([^;]+);/g;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(tsx?|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function offScaleInLine(line: string): number[] {
  const found: number[] = [];
  for (const p of JS_PROPS) {
    const re = new RegExp(`\\b${p}\\s*:\\s*(['"][^'"]*['"]|[0-9]+)`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      const raw = (m[1] ?? '').replace(/['"]/g, '');
      for (const n of raw.match(/-?\d+(?:\.\d+)?/g) ?? []) {
        const v = Number.parseFloat(n);
        if (!isAllowedSpacing(v)) found.push(v);
      }
    }
  }
  let cm: RegExpExecArray | null;
  const cssRe = new RegExp(CSS_PROP);
  while ((cm = cssRe.exec(line)) !== null) {
    for (const px of (cm[2] ?? '').match(/(\d+(?:\.\d+)?)px/g) ?? []) {
      const v = Number.parseFloat(px);
      if (!isAllowedSpacing(v)) found.push(v);
    }
  }
  return found;
}

describe('F4.1 — spacing scale', () => {
  it('the scale holds exactly the ten allowed base-4 values', () => {
    expect([...SPACING_SCALE]).toEqual([2, 4, 6, 8, 12, 16, 20, 24, 32, 48]);
    expect(Object.values(spacing)).toEqual([...SPACING_SCALE]);
  });

  it('isAllowedSpacing accepts 0 and the scale, rejects off-scale', () => {
    expect(isAllowedSpacing(0)).toBe(true);
    for (const v of SPACING_SCALE) expect(isAllowedSpacing(v)).toBe(true);
    for (const v of [1, 3, 5, 10, 14, 40]) expect(isAllowedSpacing(v)).toBe(false);
  });
});

describe('F16 — no off-scale spacing in the studio app', () => {
  it('every padding/margin/gap value lies on the F4.1 scale', () => {
    const violations: string[] = [];
    for (const file of walk(STUDIO_DIR)) {
      const lines = readFileSync(file, 'utf-8').split('\n');
      lines.forEach((line, i) => {
        const off = offScaleInLine(line);
        if (off.length > 0) {
          violations.push(`${relative(ROOT, file)}:${i + 1}: off-scale ${off.join(', ')}`);
        }
      });
    }
    expect(
      violations,
      `Off-scale spacing found:\n${violations.join('\n')}`,
    ).toHaveLength(0);
  });
});
