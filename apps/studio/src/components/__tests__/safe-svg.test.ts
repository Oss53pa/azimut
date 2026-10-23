import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SafeSvg } from '../SafeSvg.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', '..');

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules') continue;
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const NS = 'xmlns="http://www.w3.org/2000/svg"';

describe('lot 6 : un seul chemin vers la page pour un SVG', () => {
  it('aucun autre composant n’emploie dangerouslySetInnerHTML', () => {
    const offenders = sources(SRC)
      .filter(f => !f.endsWith('SafeSvg.tsx'))
      .filter(f => /dangerouslySetInnerHTML\s*=/.test(readFileSync(f, 'utf8')))
      .map(f => relative(SRC, f));
    expect(offenders).toEqual([]);
  });

  it('un SVG piégé n’est pas injecté ; l’élément dit pourquoi', () => {
    const html = renderToStaticMarkup(createElement(SafeSvg, {
      markup: `<svg ${NS}><script>alert(1)</script></svg>`, profile: 'render', role: 'img',
    }));
    expect(html).toBe('<div role="img" data-svg-refused="element"></div>');
  });

  it('un SVG propre est injecté sous sa forme reconstruite', () => {
    const html = renderToStaticMarkup(createElement(SafeSvg, {
      markup: `<svg ${NS}><!-- note --><rect width="1" height="1"/></svg>`, profile: 'render',
    }));
    expect(html).toBe(`<div><svg ${NS}><rect width="1" height="1"/></svg></div>`);
  });

  it('un nom de destination piégé, échappé par le moteur, reste du texte', () => {
    const name = `"><script>alert(1)</script><text x='`;
    const markup = `<svg ${NS}><text>${name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}</text></svg>`;
    const html = renderToStaticMarkup(createElement(SafeSvg, { markup, profile: 'render' }));
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;');
  });
});
