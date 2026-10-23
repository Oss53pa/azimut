import { describe, it, expect } from 'vitest';
import { validateSvg } from '../svg/svg-validate.js';
import { escapeXmlAttr, escapeXmlText } from '../xml-escape.js';

const NS = 'xmlns="http://www.w3.org/2000/svg"';
const wrap = (inner: string, attrs = ''): string => `<svg ${NS}${attrs}>${inner}</svg>`;
const reason = (svg: string, profile: 'asset' | 'render' = 'asset'): string => {
  const out = validateSvg(svg, profile);
  return out.ok ? 'accepté' : out.reason;
};

describe('lot 5 (D-7) : un SVG propre passe, reconstruit', () => {
  it('garde la géométrie, la présentation et les dégradés', () => {
    const svg = wrap('<defs><linearGradient id="g"><stop offset="0" stop-color="black"/></linearGradient></defs>'
      + '<g transform="translate(1 2)"><path d="M0 0L10 10" fill="url(#g)" stroke="navy"/>'
      + '<text x="1" y="2" font-family="Inter">Sortie d&apos;urgence &amp; accès</text></g>', ' viewBox="0 0 10 10"');
    const out = validateSvg(svg, 'asset');
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.svg).toContain('fill="url(#g)"');
      expect(out.svg).toContain('Sortie d&#39;urgence &amp; accès');
      expect(out.elements).toBe(7);
    }
  });

  it('retire les métadonnées, les commentaires et les attributs d’éditeur (E14.2)', () => {
    const svg = '<?xml version="1.0"?><!-- Généré par un éditeur -->'
      + `<svg ${NS} xmlns:inkscape="x" inkscape:version="1"><metadata><rdf:RDF>auteur</rdf:RDF></metadata>`
      + '<title>Logo</title><desc>Créé par Jean</desc><sodipodi:namedview/><rect width="1" height="1" inkscape:label="a"/></svg>';
    const out = validateSvg(svg, 'asset');
    expect(out).toEqual({ ok: true, svg: `<svg ${NS}><rect width="1" height="1"/></svg>`, elements: 2 });
  });

  it('un style ne garde que des propriétés de présentation', () => {
    const out = validateSvg(wrap('<rect style="fill: white ; stroke:black"/>'), 'asset');
    expect(out.ok && out.svg).toContain('style="fill:white;stroke:black"');
  });
});

describe('lot 5 (D-7) : tout le reste est refusé, jamais nettoyé', () => {
  it.each([
    ['un script', wrap('<script>alert(1)</script>'), 'element'],
    ['un script par espace de noms', wrap('<svg:script>alert(1)</svg:script>'), 'element'],
    ['un gestionnaire d’événement', `<svg ${NS} onload="alert(1)"/>`, 'attribute'],
    ['un gestionnaire d’événement sans guillemets', `<svg ${NS} onload=alert(1)/>`, 'malformed'],
    ['un gestionnaire d’événement entre apostrophes', wrap(`<rect onclick='alert(1)'/>`), 'attribute'],
    ['un lien javascript', wrap('<use href="javascript:alert(1)"/>'), 'value'],
    ['un lien javascript déguisé en entités', wrap('<use href="&#x6A;avascript:alert(1)"/>'), 'value'],
    ['un lien javascript coupé par une tabulation', wrap('<use href=" java&#x09;script:alert(1)"/>'), 'value'],
    ['un lien vers l’extérieur', wrap('<use xlink:href="https://evil.example/x.svg#a"/>'), 'value'],
    ['une url() externe', wrap('<rect fill="url(https://evil.example/a)"/>'), 'value'],
    ['une url() javascript dans un style', wrap('<rect style="fill:url(javascript:alert(1))"/>'), 'value'],
    ['une propriété de style hors liste', wrap('<rect style="behavior:url(#x)"/>'), 'value'],
    ['un élément style', wrap('<style>rect{fill:red}</style>'), 'element'],
    ['un foreignObject', wrap('<foreignObject><div/></foreignObject>'), 'element'],
    ['une image en mode point', wrap('<image href="data:image/png;base64,AAAA"/>'), 'element'],
    ['un lien cliquable', wrap('<a href="#x"><rect/></a>'), 'element'],
    ['une animation dans un actif', wrap('<set attributeName="href" to="javascript:alert(1)"/>'), 'element'],
    ['un DOCTYPE', `<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]>${wrap('<text>&x;</text>')}`, 'doctype'],
    ['une entité inconnue', wrap('<text>&x;</text>'), 'entity'],
    ['une section CDATA', wrap('<text><![CDATA[<script>]]></text>'), 'cdata'],
    ['une instruction de traitement', `<?xml-stylesheet href="evil.css"?>${wrap('')}`, 'processing_instruction'],
    ['un document qui n’est pas un SVG', '<html><body/></html>', 'not_svg'],
    ['un document mal fermé', `<svg ${NS}><g>`, 'unbalanced'],
  ])('%s', (_label, svg, expected) => {
    expect(reason(svg)).toBe(expected);
  });

  it('l’animation des moteurs ne vise jamais un lien', () => {
    expect(reason(wrap('<polyline points="0,0 1,1"><animate attributeName="stroke-dashoffset" from="9" to="0" dur="2s"/></polyline>'), 'render'))
      .toBe('accepté');
    expect(reason(wrap('<set attributeName="href" to="#x"/>'), 'render')).toBe('value');
  });

  it('les bornes viennent de l’appelant et s’appliquent', () => {
    const svg = wrap('<g><g><rect/></g></g>');
    expect(validateSvg(svg, 'asset', { maxBytes: 10 })).toMatchObject({ ok: false, reason: 'too_large' });
    expect(validateSvg(svg, 'asset', { maxElements: 3 })).toMatchObject({ ok: false, reason: 'too_complex' });
    expect(validateSvg(svg, 'asset', { maxDepth: 2 })).toMatchObject({ ok: false, reason: 'too_deep' });
    expect(validateSvg(svg, 'asset', { maxBytes: 1000, maxElements: 4, maxDepth: 3 }).ok).toBe(true);
  });
});

describe('lot 6 : un seul échappement, apostrophe comprise', () => {
  it('échappe les cinq caractères réservés', () => {
    expect(escapeXmlText(`<a href="x" title='y'>&</a>`)).toBe('&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
    expect(escapeXmlAttr(`"><script>'`)).toBe('&quot;&gt;&lt;script&gt;&#39;');
  });
});
