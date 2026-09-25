import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit';
import { renderFloorPlan, renderOrientedPlan, renderEvacuationPlan } from '@azimut/engine-layout';
import type {
  FloorPlanTheme, FloorPlanOptions,
  OrientedPlanTheme, OrientedPlanOptions,
  EvacuationTheme, EvacuationPlanOptions,
} from '@azimut/engine-layout';
import { renderIsoView } from '@azimut/engine-iso';
import type { IsoTheme, IsoOptions } from '@azimut/engine-iso';
import { ACCESSIBLE_FUNCTION_KEY, boundPackId } from '@azimut/core-model';
import type { Outcome, Pictogram, SiteData, Volume } from '@azimut/core-model';

/**
 * S-39 — « Rendu d'une place de stationnement, dans toutes les vues :
 *
 * - Plan de niveau et plan orienté : contour léger, sans libellé. Une place ne
 *   porte ni occupant ni catégorie, et ne doit pas concurrencer visuellement
 *   les cellules commerciales.
 * - Place accessible : elle porte le pictogramme du registre de sécurité
 *   désigné par la fonction d'accessibilité, section A5.4, jamais un symbole
 *   maison, section A1.2, invariant 3. Si aucune fonction n'est désignée, la
 *   marque est omise et signalée par `PICTO.FUNCTION_NOT_DESIGNATED` : le
 *   rendu ne dessine jamais un pictogramme de remplacement.
 * - Vue isométrique : la place reste au sol, sans volume.
 * - Plan d'évacuation : elle n'y apparaît pas, sauf si elle porte un
 *   cheminement d'évacuation. »
 *
 * Quatre vues, une règle. L'essai est ici, et non dans chaque moteur, parce
 * que c'est la cohérence des quatre qui fait la règle : trois vues conformes
 * et une quatrième qui dresse un parking en relief laisseraient la règle
 * violée sans qu'aucun essai de moteur ne le voie.
 *
 * `refMultilevel` porte quatre places au RDC, dont une accessible, `fp-ml-a3`,
 * et désigne dans son paquet de règles le pictogramme de sécurité qui la
 * marque. Le contre-exemple — la même place sans désignation — est dérivé ici,
 * au plus près du cas qu'il contredit.
 */

const RDC = 'lvl-ml-rdc';
const PLACES = ['fp-ml-a1', 'fp-ml-a2', 'fp-ml-a3', 'fp-ml-b1'];
const ACCESSIBLE = 'fp-ml-a3';

/** Le pictogramme que le site de référence désigne pour la place accessible. */
const DESIGNE = refMultilevel.pictograms.find(p => p.function_key === ACCESSIBLE_FUNCTION_KEY);
if (DESIGNE === undefined) throw new Error('refMultilevel ne désigne plus la fonction d’accessibilité');
const PAQUET = boundPackId(refMultilevel.rules_bindings, 'base');

/** Un autre tracé, pour distinguer à la sortie quel pictogramme a été posé. */
const AUTRE_TRACE = 'M4 4 L26 4 L26 26 L4 26 Z';

/** Le site de référence, augmenté des pictogrammes que l'essai lui donne. */
function avec(...pictogrammes: readonly Pictogram[]): SiteData {
  return { ...refMultilevel, pictograms: [...refMultilevel.pictograms, ...pictogrammes] };
}

/** Le contre-exemple : le même site, sans la désignation de la fonction. */
const sansDesignation: SiteData = {
  ...refMultilevel,
  pictograms: refMultilevel.pictograms.filter(p => p.id !== DESIGNE.id),
};

/** Le nombre de fois qu'un tracé est posé dans un rendu. */
function poses(svg: string, trace: string): number {
  return svg.split(`<path d="${trace}"`).length - 1;
}

/** Les codes que porte un rendu réussi, ou ceux de son refus. */
function codes(out: Outcome<string>): readonly string[] {
  return (out.ok ? out.warnings : out.findings).map(f => f.code);
}

const floorTheme: FloorPlanTheme = {
  background: 'tok-bg',
  footprint_fill: 'tok-fp-fill', footprint_stroke: 'tok-fp-stroke',
  parking_fill: 'tok-park-fill', parking_stroke: 'tok-park-stroke',
  uncovered_fill: 'tok-unc-fill', uncovered_stroke: 'tok-unc-stroke',
  edge_stroke: 'tok-edge', edge_evacuation_stroke: 'tok-evac',
  node_fill: 'tok-node', node_stroke: 'tok-node-stroke',
  node_safety_fill: 'tok-safety',
  text_primary: 'tok-txt', text_secondary: 'tok-txt2',
};

const floorOpts: FloorPlanOptions = {
  width_px: 800, height_px: 600, theme: floorTheme, font_family: 'Helvetica',
  show_destinations: true, show_edges: true, padding_px: 20,
};

const orientedTheme: OrientedPlanTheme = {
  background: 'tok-bg',
  parking_fill: 'tok-park-fill', parking_stroke: 'tok-park-stroke',
  footprint_fill: 'tok-fp-fill', footprint_stroke: 'tok-fp-stroke',
  edge_stroke: 'tok-edge', edge_evacuation_stroke: 'tok-evac',
  node_fill: 'tok-node', node_stroke: 'tok-node-stroke',
  node_safety_fill: 'tok-safety',
  text_primary: 'tok-txt', text_secondary: 'tok-txt2',
  marker_fill: 'tok-marker', marker_stroke: 'tok-marker-stroke',
};

const orientedOpts: OrientedPlanOptions = {
  width_px: 800, height_px: 600, theme: orientedTheme, font_family: 'Helvetica',
  orientation_deg: 0, viewer_position: { x_m: 0, y_m: 0 },
  show_destinations: true, show_edges: true, show_north_arrow: true, padding_px: 20,
};

function svgOf(outcome: { ok: boolean }): string {
  expect(outcome.ok, 'rendu refusé').toBe(true);
  return (outcome as { ok: true; value: string }).value;
}

/** Les attributs d'un `<polygon>` dont le remplissage porte ce jeton. */
function polygonsWith(svg: string, jeton: string): string[] {
  return [...svg.matchAll(/<polygon[^>]*\/>/g)]
    .map(m => m[0])
    .filter(tag => tag.includes(`fill="${jeton}"`));
}

describe('S-39 — plan de niveau : contour léger, sans libellé', () => {
  const svg = svgOf(renderFloorPlan(refMultilevel, RDC, floorOpts));

  it('dessine les quatre places avec le jeton des places, non celui du bâti', () => {
    expect(polygonsWith(svg, 'tok-park-fill')).toHaveLength(4);
  });

  it('leur donne un trait plus fin que celui d’une empreinte de bâti', () => {
    // « Contour léger » : une place est un marquage au sol, elle ne doit pas
    // concurrencer une cellule commerciale sur le même plan.
    for (const tag of polygonsWith(svg, 'tok-park-fill')) {
      expect(tag).toContain('stroke-width="0.5"');
    }
    for (const tag of polygonsWith(svg, 'tok-fp-fill')) {
      expect(tag).toContain('stroke-width="1"');
    }
  });

  it('ne pose aucun libellé sur une place', () => {
    // Structurellement garanti : un libellé vient d'une destination, et S-40
    // dit qu'une place n'en est pas une. L'essai le tient quand même, parce
    // que c'est la règle qui compte, pas le chemin par lequel elle est tenue.
    const libelles = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m => m[1]);
    for (const place of PLACES) {
      expect(libelles).not.toContain(place);
    }
    expect(libelles).not.toContain('Parking Ouest');
  });
});

describe('S-39 — plan orienté : le même traitement', () => {
  const svg = svgOf(renderOrientedPlan(refMultilevel, RDC, orientedOpts));

  it('dessine les places avec leur jeton et leur trait léger', () => {
    const places = polygonsWith(svg, 'tok-park-fill');
    expect(places).toHaveLength(4);
    for (const tag of places) expect(tag).toContain('stroke-width="0.5"');
  });

  it('ne les confond pas avec le bâti', () => {
    expect(polygonsWith(svg, 'tok-fp-fill').length).toBeGreaterThan(0);
  });
});

describe('S-39 — la marque d’une place accessible', () => {
  it('pose sur la seule place accessible le pictogramme que le site désigne', () => {
    // Le moteur ne connaît pas le code du pictogramme, et n'a pas à le
    // connaître : il nomme la fonction, A5.4, et la donnée nomme celui qui la
    // porte. C'est ce qu'INV-5 lui interdisait d'écrire.
    const out = renderFloorPlan(refMultilevel, RDC, floorOpts);
    expect(poses(svgOf(out), DESIGNE.svg_path)).toBe(1);
    expect(codes(out)).not.toContain('PICTO.FUNCTION_NOT_DESIGNATED');
  });

  it('le pose aussi au plan orienté', () => {
    const out = renderOrientedPlan(refMultilevel, RDC, orientedOpts);
    expect(poses(svgOf(out), DESIGNE.svg_path)).toBe(1);
    expect(codes(out)).not.toContain('PICTO.FUNCTION_NOT_DESIGNATED');
  });

  it('contre-exemple : omet la marque et le signale quand rien ne la désigne', () => {
    // « La marque est omise et signalée. » Omettre sans rien dire ferait d'un
    // plan incomplet un plan d'apparence complète.
    for (const out of [
      renderFloorPlan(sansDesignation, RDC, floorOpts),
      renderOrientedPlan(sansDesignation, RDC, orientedOpts),
    ]) {
      expect(codes(out)).toContain('PICTO.FUNCTION_NOT_DESIGNATED');
      expect(poses(svgOf(out), DESIGNE.svg_path)).toBe(0);
    }
  });

  it('ne dessine jamais un pictogramme de remplacement', () => {
    // Le paquet du site porte encore un pictogramme de sécurité, celui de la
    // sortie de secours, mais il ne porte pas la fonction. Prendre le premier
    // venu violerait l'invariant 3 aussi sûrement qu'inventer une silhouette.
    const svg = svgOf(renderFloorPlan(sansDesignation, RDC, floorOpts));
    expect(svg).not.toContain('<path d=');
  });

  it('ne voit pas la même fonction portée par le registre d’orientation', () => {
    // INV-3 cloisonne, S-39 y renvoie.
    const maison: Pictogram = {
      ...DESIGNE, id: 'picto-maison', registry: 'wayfinding', rules_pack_id: null,
      svg_path: AUTRE_TRACE,
    };
    const svg = svgOf(renderFloorPlan(
      { ...sansDesignation, pictograms: [...sansDesignation.pictograms, maison] },
      RDC, floorOpts,
    ));
    expect(poses(svg, AUTRE_TRACE)).toBe(0);
  });

  it('refuse le plan quand deux pictogrammes du paquet portent la fonction', () => {
    // Une fonction est désignée au plus une fois par paquet. En départager
    // deux serait décider à la place de celui qui a désigné, et A7 l'interdit.
    const second: Pictogram = { ...DESIGNE, id: 'picto-pmr-bis', svg_path: AUTRE_TRACE };
    for (const out of [
      renderFloorPlan(avec(second), RDC, floorOpts),
      renderOrientedPlan(avec(second), RDC, orientedOpts),
    ]) {
      expect(out.ok).toBe(false);
      expect(codes(out)).toEqual(['PICTO.FUNCTION_AMBIGUOUS']);
    }
  });

  it('ne réclame aucune fonction sur un niveau sans place accessible', () => {
    // La fonction ne manque pas là où personne ne la demande.
    const sansExtension: SiteData = { ...sansDesignation, parking_spaces: [] };
    expect(codes(renderFloorPlan(sansExtension, RDC, floorOpts)))
      .not.toContain('PICTO.FUNCTION_NOT_DESIGNATED');
  });

  it('ne marque pas une place dont l’extension ne dit pas qu’elle est accessible', () => {
    const site: SiteData = { ...refMultilevel, parking_spaces: [] };
    expect(poses(svgOf(renderFloorPlan(site, RDC, floorOpts)), DESIGNE.svg_path)).toBe(0);
  });
});

describe('S-39 et A5.4 — une organisation, deux sites, deux paquets', () => {
  // « Une organisation qui exploite deux sites rattachés à deux paquets
  // différents porte légitimement deux pictogrammes de même fonction, un par
  // paquet : l'unicité par organisation les déclarerait ambigus à tort. »
  //
  // L'organisation du site de référence porte ici, en plus, le pictogramme
  // d'accessibilité d'un second paquet, celui de son autre site.
  const AUTRE_PAQUET = 'rp-autre-site';
  const duSecondPaquet: Pictogram = {
    ...DESIGNE, id: 'picto-pmr-autre-paquet', rules_pack_id: AUTRE_PAQUET,
    svg_path: AUTRE_TRACE,
  };
  const organisation = avec(duSecondPaquet);

  it('ne déclare pas le plan ambigu', () => {
    for (const out of [
      renderFloorPlan(organisation, RDC, floorOpts),
      renderOrientedPlan(organisation, RDC, orientedOpts),
    ]) {
      expect(out.ok).toBe(true);
      expect(codes(out)).not.toContain('PICTO.FUNCTION_AMBIGUOUS');
    }
  });

  it('pose le pictogramme du paquet de ce site, et non celui de l’autre', () => {
    const svg = svgOf(renderFloorPlan(organisation, RDC, floorOpts));
    expect(poses(svg, DESIGNE.svg_path)).toBe(1);
    expect(poses(svg, AUTRE_TRACE)).toBe(0);
  });

  it('pose celui de l’autre paquet sur le site qui y est rattaché', () => {
    const autreSite: SiteData = {
      ...organisation,
      rules_bindings: [{ id: 'rb-autre', rules_pack_id: AUTRE_PAQUET, role: 'base' }],
    };
    const svg = svgOf(renderFloorPlan(autreSite, RDC, floorOpts));
    expect(poses(svg, AUTRE_TRACE)).toBe(1);
    expect(poses(svg, DESIGNE.svg_path)).toBe(0);
  });

  it('ne pose rien sur un site sans paquet : le registre de sécurité n’y a pas de source', () => {
    const sansPaquet: SiteData = { ...organisation, rules_bindings: [] };
    const out = renderFloorPlan(sansPaquet, RDC, floorOpts);
    expect(codes(out)).toContain('PICTO.FUNCTION_NOT_DESIGNATED');
    expect(svgOf(out)).not.toContain('<path d=');
  });

  it('garde le paquet du site de référence comme portée', () => {
    expect(PAQUET).toBe(DESIGNE.rules_pack_id);
  });
});

describe('S-39 et A5.8 — un socle et une surcouche qui désignent la même fonction', () => {
  // « Précédence, pour une même fonction de pictogramme comme pour une
  // règle : la surcouche l'emporte sur le socle. L'ambiguïté ne se juge qu'à
  // l'intérieur d'un même paquet ; deux paquets qui désignent la même fonction
  // ne sont pas ambigus. »
  const SURCOUCHE = 'rp-surcouche-pays';
  const deLaSurcouche: Pictogram = {
    ...DESIGNE, id: 'picto-pmr-surcouche', rules_pack_id: SURCOUCHE, svg_path: AUTRE_TRACE,
  };
  const site: SiteData = {
    ...avec(deLaSurcouche),
    rules_bindings: [
      ...refMultilevel.rules_bindings,
      { id: 'rb-ml-surcouche', rules_pack_id: SURCOUCHE, role: 'overlay' },
    ],
  };

  it('pose la marque de la surcouche, et elle seule', () => {
    for (const out of [
      renderFloorPlan(site, RDC, floorOpts),
      renderOrientedPlan(site, RDC, orientedOpts),
    ]) {
      expect(out.ok).toBe(true);
      expect(codes(out)).not.toContain('PICTO.FUNCTION_AMBIGUOUS');
      expect(poses(svgOf(out), AUTRE_TRACE)).toBe(1);
      expect(poses(svgOf(out), DESIGNE.svg_path)).toBe(0);
    }
  });

  it('revient au socle quand la surcouche ne désigne pas la fonction', () => {
    const sansDesignationPays: SiteData = { ...site, pictograms: refMultilevel.pictograms };
    const svg = svgOf(renderFloorPlan(sansDesignationPays, RDC, floorOpts));
    expect(poses(svg, DESIGNE.svg_path)).toBe(1);
  });
});

describe('S-39 — vue isométrique : la place reste au sol, sans volume', () => {
  const isoTheme: IsoTheme = {
    background: 'tok-bg',
    floor_top: 'tok-top', floor_stroke: 'tok-stroke',
    wall_front: 'tok-wall-front', wall_side: 'tok-wall-side',
    wall_stroke: 'tok-wall-stroke',
    node_fill: 'tok-node', node_stroke: 'tok-node-stroke',
    text_primary: 'tok-txt',
  };
  const isoOpts: IsoOptions = {
    width_px: 800, height_px: 600, theme: isoTheme, font_family: 'Helvetica',
    padding_px: 20, show_nodes: false, mode: { kind: 'all' },
  };

  /** Un volume posé sur la place accessible, que la vue doit ignorer. */
  const volumeSurPlace: Volume = {
    id: 'vol-sur-place',
    org_id: 'org-test-001',
    footprint_id: ACCESSIBLE,
    base_elevation_m: 0,
    height_m: 3,
    material_key: 'concrete',
  };

  function murs(site: SiteData): number {
    const r = renderIsoView(site, [RDC], isoOpts);
    expect(r.ok).toBe(true);
    if (!r.ok) return -1;
    // Un volume élevé dessine ses faces latérales en plus de sa face
    // supérieure. Les compter suffit à dire si la place a été dressée.
    return polygonsWith(r.value.svg, 'tok-wall-front').length
      + polygonsWith(r.value.svg, 'tok-wall-side').length;
  }

  it('n’élève pas une place à laquelle un volume serait rattaché', () => {
    const avecVolume: SiteData = {
      ...refMultilevel,
      volumes: [...refMultilevel.volumes, volumeSurPlace],
    };
    expect(murs(avecVolume)).toBe(murs(refMultilevel));
  });

  it('la dessine tout de même, à plat', () => {
    const r = renderIsoView(refMultilevel, [RDC], isoOpts);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Quatre places et l'empreinte du bâti : cinq faces supérieures au moins.
    expect(polygonsWith(r.value.svg, 'tok-top').length).toBeGreaterThanOrEqual(5);
  });
});

describe('S-39 — plan d’évacuation : absente, sauf cheminement', () => {
  const evacTheme: EvacuationTheme = {
    background: 'tok-bg',
    footprint_fill: 'tok-fp-fill', footprint_stroke: 'tok-fp-stroke',
    route_stroke: 'tok-route', route_arrow: 'tok-arrow',
    non_route_stroke: 'tok-non-route',
    exit_fill: 'tok-exit', exit_stroke: 'tok-exit-stroke',
    assembly_fill: 'tok-assembly', assembly_stroke: 'tok-assembly-stroke',
    node_fill: 'tok-node', node_stroke: 'tok-node-stroke',
    marker_fill: 'tok-marker', marker_stroke: 'tok-marker-stroke',
    text_primary: 'tok-txt', text_secondary: 'tok-txt2',
  };
  const evacOpts: EvacuationPlanOptions = {
    width_px: 800, height_px: 600, theme: evacTheme, font_family: 'Helvetica',
    padding_px: 20, viewer_position: null, show_non_evacuation: false,
  };

  /** Le plan d'évacuation rend un couple, le tracé et ses compteurs. */
  function evacSvg(site: SiteData): string {
    const r = renderEvacuationPlan(site, RDC, evacOpts);
    expect(r.ok, 'rendu refusé').toBe(true);
    return r.ok ? r.value.svg : '';
  }

  it('n’y fait apparaître aucune place', () => {
    const svg = evacSvg(refMultilevel);
    // Le bâti seul. Un parking dessiné place par place encombrerait le plan de
    // rectangles qui ne disent rien de la sortie.
    expect(polygonsWith(svg, 'tok-fp-fill')).toHaveLength(1);
  });

  it('fait apparaître celle qui porte un cheminement d’évacuation', () => {
    // Un nœud d'une arête d'évacuation posé dans le tracé de la place. C'est
    // le seul rattachement que le modèle permet.
    const place = refMultilevel.footprints.find(f => f.id === ACCESSIBLE);
    const sommet = place?.geometry.vertices[0];
    expect(sommet).toBeDefined();
    if (sommet === undefined) return;

    const site: SiteData = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        nodes: [
          ...refMultilevel.graph.nodes,
          {
            id: 'n-evac-a', org_id: 'org-test-001', level_id: RDC,
            kind: 'junction' as const,
            position: { x_m: sommet.x_m + 1, y_m: sommet.y_m + 1 },
            label: 'Essai',
          },
          {
            id: 'n-evac-b', org_id: 'org-test-001', level_id: RDC,
            kind: 'emergency_exit' as const,
            position: { x_m: sommet.x_m + 1, y_m: sommet.y_m + 20 },
            label: 'Essai',
          },
        ],
        edges: [
          ...refMultilevel.graph.edges,
          {
            id: 'e-evac', org_id: 'org-test-001',
            from_node_id: 'n-evac-a', to_node_id: 'n-evac-b',
            width_m: 2, slope_pct: 0, accessible: true,
            direction: 'both' as const,
            evacuation_route: true, length_m: 19,
          },
        ],
      },
    };
    expect(polygonsWith(evacSvg(site), 'tok-fp-fill')).toHaveLength(2);
  });
});
