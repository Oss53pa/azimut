import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RADIUS_SCALE, isAllowedRadius, durations } from '../tokens.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');
const STUDIO_DIR = resolve(ROOT, 'apps', 'studio', 'src');

// Motion durations allowed by F11 (three values only), in milliseconds.
const ALLOWED_MS = new Set([120, 200, 240]);

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

function radiusViolations(line: string): number[] {
  const bad: number[] = [];
  for (const m of line.matchAll(/border-?[Rr]adius:\s*(\d+(?:\.\d+)?)/g)) {
    const v = Number.parseFloat(m[1] ?? '');
    if (!isAllowedRadius(v)) bad.push(v);
  }
  return bad;
}

// Durations appear as `120ms`/`0.2s` inside transition/animation strings.
function durationViolations(line: string): string[] {
  const bad: string[] = [];
  if (!/transition|animation/.test(line)) return bad;
  for (const m of line.matchAll(/(\d+(?:\.\d+)?)(ms|s)\b/g)) {
    const raw = Number.parseFloat(m[1] ?? '');
    const ms = m[2] === 's' ? raw * 1000 : raw;
    if (!ALLOWED_MS.has(ms)) bad.push(`${m[1]}${m[2]}`);
  }
  return bad;
}

describe('F4.3 — radius scale', () => {
  it('holds exactly {0, 4, 6}', () => {
    expect([...RADIUS_SCALE]).toEqual([0, 4, 6]);
    expect(isAllowedRadius(0)).toBe(true);
    for (const v of [3, 10, 12, 20]) expect(isAllowedRadius(v)).toBe(false);
  });

  it('no off-scale border radius in the studio app (F16)', () => {
    const violations: string[] = [];
    for (const file of walk(STUDIO_DIR)) {
      readFileSync(file, 'utf-8').split('\n').forEach((line, i) => {
        const off = radiusViolations(line);
        if (off.length > 0) violations.push(`${relative(ROOT, file)}:${i + 1}: radius ${off.join(', ')}`);
      });
    }
    expect(violations, `Off-scale radii:\n${violations.join('\n')}`).toHaveLength(0);
  });
});

describe('F11 — motion durations (three values only)', () => {
  it('declares exactly 120, 200, 240 ms', () => {
    expect(Object.values(durations)).toEqual([120, 200, 240]);
  });

  it('no transition/animation duration off the scale in the studio app', () => {
    const violations: string[] = [];
    for (const file of walk(STUDIO_DIR)) {
      readFileSync(file, 'utf-8').split('\n').forEach((line, i) => {
        const off = durationViolations(line);
        if (off.length > 0) violations.push(`${relative(ROOT, file)}:${i + 1}: duration ${off.join(', ')}`);
      });
    }
    expect(violations, `Off-scale durations:\n${violations.join('\n')}`).toHaveLength(0);
  });
});
