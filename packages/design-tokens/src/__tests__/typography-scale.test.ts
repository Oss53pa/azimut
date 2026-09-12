import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  typeScale,
  TYPE_SIZES,
  TYPE_WEIGHTS,
  isAllowedFontSize,
  isAllowedFontWeight,
} from '../tokens.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');
const STUDIO_DIR = resolve(ROOT, 'apps', 'studio', 'src');

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

function scan(line: string): string[] {
  const bad: string[] = [];
  for (const m of line.matchAll(/fontSize:\s*(\d+)/g)) {
    const v = Number.parseInt(m[1] ?? '', 10);
    if (!isAllowedFontSize(v)) bad.push(`fontSize ${v}`);
  }
  for (const m of line.matchAll(/font-size:\s*(\d+)px/g)) {
    const v = Number.parseInt(m[1] ?? '', 10);
    if (!isAllowedFontSize(v)) bad.push(`font-size ${v}px`);
  }
  for (const m of line.matchAll(/fontWeight:\s*(\d+)/g)) {
    const v = Number.parseInt(m[1] ?? '', 10);
    if (!isAllowedFontWeight(v)) bad.push(`fontWeight ${v}`);
  }
  for (const m of line.matchAll(/font-weight:\s*(\d+)/g)) {
    const v = Number.parseInt(m[1] ?? '', 10);
    if (!isAllowedFontWeight(v)) bad.push(`font-weight ${v}`);
  }
  return bad;
}

describe('F3.4 — typographic scale', () => {
  it('holds the seven roles with two weights only', () => {
    expect(Object.keys(typeScale)).toEqual([
      'micro', 'fieldLabel', 'body', 'value', 'panelTitle', 'screenTitle', 'docTitle',
    ]);
    expect([...TYPE_SIZES]).toEqual([11, 12, 13, 15, 18, 22]);
    expect([...TYPE_WEIGHTS]).toEqual([400, 500]);
    for (const role of Object.values(typeScale)) {
      expect(TYPE_WEIGHTS as readonly number[]).toContain(role.weight);
      expect(TYPE_SIZES as readonly number[]).toContain(role.size);
    }
  });
});

describe('F16 — no off-scale typography in the studio app', () => {
  it('every font size is on the scale and every weight is 400 or 500', () => {
    const violations: string[] = [];
    for (const file of walk(STUDIO_DIR)) {
      readFileSync(file, 'utf-8').split('\n').forEach((line, i) => {
        const bad = scan(line);
        if (bad.length > 0) {
          violations.push(`${relative(ROOT, file)}:${i + 1}: ${bad.join(', ')}`);
        }
      });
    }
    expect(
      violations,
      `Off-scale typography found:\n${violations.join('\n')}`,
    ).toHaveLength(0);
  });
});
