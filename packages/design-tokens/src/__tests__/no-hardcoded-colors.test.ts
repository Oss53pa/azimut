import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');
const DESIGN_TOKENS_DIR = resolve(ROOT, 'packages', 'design-tokens');

const HEX_PATTERN = /#(?:[0-9a-fA-F]{3}){1,2}(?=[^0-9a-fA-F]|$)/g;
// Literal rgb()/rgba() only — a numeric channel immediately follows. Data-driven
// calls like rgb(c.r, c.g, c.b) (content colours from data, F2.5) are not flagged.
const RGBA_LITERAL_PATTERN = /rgba?\(\s*[\d.]/g;

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (/\.(ts|tsx|css)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

describe('no hardcoded colors outside design-tokens (A2.4)', () => {
  it('finds no hex color literals in source files', () => {
    const violations: string[] = [];

    const dirs = [
      resolve(ROOT, 'packages'),
      resolve(ROOT, 'apps'),
    ];

    const STUDIO_DIR = resolve(ROOT, 'apps', 'studio', 'src');

    for (const dir of dirs) {
      for (const file of walk(dir)) {
        if (file.startsWith(DESIGN_TOKENS_DIR)) continue;

        // rgb()/rgba() is a legitimate content-colour form in the engines (PDF
        // and SVG produced from data). It is forbidden only as interface chrome,
        // which lives in the studio app; skip test fixtures there too.
        const checkRgba =
          file.startsWith(STUDIO_DIR) && !/\.test\.tsx?$/.test(file);

        const content = readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line === undefined) continue;
          const matches = [
            ...(line.match(HEX_PATTERN) ?? []),
            ...(checkRgba ? line.match(RGBA_LITERAL_PATTERN) ?? [] : []),
          ];
          if (matches.length > 0) {
            const rel = relative(ROOT, file);
            violations.push(`${rel}:${i + 1}: ${matches.join(', ')}`);
          }
        }
      }
    }

    expect(
      violations,
      `Hardcoded colors found:\n${violations.join('\n')}`,
    ).toHaveLength(0);
  });
});
