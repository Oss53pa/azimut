import { type JSX, useEffect, useState } from 'react';
import type { Finding, Point } from '@azimut/core-model';
import type { TrancheSession } from './useTrancheSession.js';
import { ORG_OF_SESSION } from './session-identity.js';
import { acceptFootprint } from '../state/footprint-input.js';
import type { FootprintKind } from '../state/footprint-input.js';
import { acceptSeries } from '../state/footprint-series.js';
import { createFootprintCommands } from '../state/footprint-commands.js';
import { actionForKey, toolForKey } from '../state/footprint-shortcuts.js';
import type { FootprintTool } from '../state/footprint-shortcuts.js';
import { countOf } from '../state/session-store.js';
import type { StoredRow } from '../state/session-store.js';
import { FootprintsScreen } from '../screens/FootprintsScreen.js';
import { useFootprintInk } from './useFootprintInk.js';
import type { SeriesDraft } from '../screens/FootprintsScreen.js';

/**
 * M3 (partie M) — l'adaptateur du tracé des empreintes.
 *
 * À part dans un fichier depuis que la duplication en série y est : les quatre
 * adaptateurs d'atelier portaient `workshop-adapters.tsx` près des 400 lignes
 * qu'A2.4 fixe, et celui-ci est le seul à tenir un second geste.
 */

/**
 * Le contour proposé à l'ouverture.
 *
 * La zone de travail n'est pas construite : sans contour de départ, la saisie
 * numérique des sommets — « le moyen le plus précis et le seul accessible au
 * clavier » (M3, partie M) — n'aurait aucun sommet à modifier. Quatre sommets,
 * que l'opérateur déplace au clavier.
 */
const DEFAULT_FOOTPRINT: readonly Point[] = [
  { x_m: 0, y_m: 0 }, { x_m: 5, y_m: 0 }, { x_m: 5, y_m: 4 }, { x_m: 0, y_m: 4 },
];

/**
 * Une copie, sans déplacement. Le pas et le nombre viennent de l'opérateur :
 * aucune trame n'est supposée, et une valeur de départ plus grande ferait
 * écrire vingt cellules à qui n'en voulait qu'une.
 */
const NO_SERIES: SeriesDraft = { dx_m: 0, dy_m: 0, count: 1 };

export function FootprintsScreenAdapter({ session, levelId }: {
  readonly session: TrancheSession;
  readonly levelId: string;
}): JSX.Element {
  const [tool, setTool] = useState<FootprintTool>('cell');
  const [vertices, setVertices] = useState<readonly Point[]>(DEFAULT_FOOTPRINT);
  const [unitCode, setUnitCode] = useState('');
  const [kind, setKind] = useState<FootprintKind>('cell');
  const [findings, setFindings] = useState<readonly Finding[]>([]);
  const [warnings, setWarnings] = useState<readonly Finding[]>([]);
  const [series, setSeries] = useState<SeriesDraft>(NO_SERIES);
  /**
   * L'empreinte dont la série part : la dernière fermée.
   *
   * M3 (partie M) attache les actions en série à une sélection, et l'outil de
   * sélection suppose la zone de travail, qui n'est pas construite. La
   * dernière empreinte fermée est le seul sujet que l'écran connaisse sans
   * elle, et il le nomme au lieu de le laisser deviner.
   */
  const [reference, setReference] = useState<Reference | null>(null);

  const drawn = countOf(session.state, 'footprint');
  // J1 — la zone de travail au stylet : un trait lu remplace le contour en
  // cours, que `close` ferme comme une saisie au clavier.
  const ink = useFootprintInk(session, levelId, tool, vertices, setVertices);

  function codesOnLevel(): readonly string[] {
    return session.state.rows
      .filter((row: StoredRow) => row.table === 'footprint')
      .map((row: StoredRow) => String(row.values['unit_code'] ?? ''));
  }

  function close(): void {
    void (async () => {
      const draft = { vertices, unitCode, kind, categoryId: null };
      const accepted = acceptFootprint(draft, { codesOnLevel: codesOnLevel(), existing: [] });
      if (!accepted.ok) { setFindings(accepted.findings); return; }

      const id = session.newId();
      const commands = createFootprintCommands(
        [{ id, footprint: accepted.value }],
        { orgId: ORG_OF_SESSION, levelId, timestamp: session.now() },
        `footprint:${id}`,
      );
      if (!commands.ok) { setFindings(commands.findings); return; }

      await session.write(commands.value);
      setFindings([]);
      setWarnings(accepted.warnings);
      setReference({ ...draft, vertices: accepted.value.vertices });
      setUnitCode('');
      setVertices(DEFAULT_FOOTPRINT);
      ink.settle();
    })();
  }

  /**
   * M3 (partie M) critère 4 — « La duplication en série de 20 cellules se fait
   * en une commande annulable d'un seul geste. »
   *
   * Un seul `write`, donc une seule entrée de pile : le magasin empile un
   * geste et non une commande. Vingt annulations pour défaire une action
   * seraient une punition (E5.2).
   */
  function duplicate(): void {
    void (async () => {
      if (reference === null) return;
      const accepted = acceptSeries(
        reference,
        { dx_m: series.dx_m, dy_m: series.dy_m, count: series.count },
        { codesOnLevel: codesOnLevel(), existing: [] },
      );
      if (!accepted.ok) { setFindings(accepted.findings); return; }

      const rows = accepted.value.map(footprint => ({ id: session.newId(), footprint }));
      const first = rows[0];
      if (first === undefined) return;
      const commands = createFootprintCommands(
        rows,
        { orgId: ORG_OF_SESSION, levelId, timestamp: session.now() },
        `series:${first.id}`,
      );
      if (!commands.ok) { setFindings(commands.findings); return; }

      await session.write(commands.value);
      setFindings([]);
      setWarnings(accepted.warnings);
    })();
  }

  /**
   * M3 (partie M) — la table des raccourcis, rendue opposable.
   *
   * Elle était affichée en bas de l'écran et n'était liée à rien : `Entrée`,
   * `Échap`, `Retour arrière` et `Ctrl+D` ne faisaient rien. Un écran qui
   * annonce un raccourci inerte est pire qu'un écran qui n'en annonce aucun.
   *
   * `Ctrl+Z` est la seule action de la table qui n'est pas liée ici : la
   * portée de la pile est le site en cours d'édition, et le routeur la lie une
   * fois pour les quatre écrans. Deux liaisons concurrentes annuleraient deux
   * gestes pour une frappe.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target;
      const typing = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement;
      // M3 (partie M) donne une touche à chacun des cinq outils. La table
      // existait en donnée et n'était liée à rien : presser `C` ne faisait
      // rien alors que l'écran annonçait le contraire.
      //
      // Une touche nue ne s'applique pas dans un champ de saisie, où elle est
      // un caractère. C'est la seule raison pour laquelle elle est écartée là.
      const tool = event.ctrlKey || event.metaKey || event.altKey
        ? null
        : toolForKey(event.key);
      if (tool !== null && !typing) {
        event.preventDefault();
        setTool(tool);
        return;
      }

      const action = actionForKey(event.key, {
        ctrl: event.ctrlKey || event.metaKey,
        shift: event.shiftKey,
        alt: event.altKey,
      });
      if (action === null || action === 'undo') return;
      // Un champ de saisie garde `Retour arrière` : il y efface un caractère,
      // et non le dernier sommet du contour.
      if (typing && !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      if (action === 'close_polygon') close();
      if (action === 'duplicate') duplicate();
      if (action === 'abandon_drawing') { setVertices(DEFAULT_FOOTPRINT); setFindings([]); ink.settle(); }
      if (action === 'remove_last_vertex') {
        setVertices(previous => previous.slice(0, -1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  });

  return (
    <FootprintsScreen
      state={drawn === 0 ? { kind: 'empty' } : { kind: 'ready' }}
      tool={tool}
      onTool={setTool}
      vertices={vertices}
      onVertex={(index, axis, value) => {
        setVertices(previous => previous.map((v, i) =>
          i === index ? { ...v, [axis]: value ?? 0 } : v));
      }}
      unitCode={unitCode}
      onUnitCode={setUnitCode}
      kind={kind}
      onKind={setKind}
      areaM2={null}
      findings={findings}
      warnings={warnings}
      footprintCount={drawn}
      onClose={close}
      onAbandon={() => { setVertices(DEFAULT_FOOTPRINT); setFindings([]); ink.settle(); }}
      series={series}
      onSeries={(field, value) => {
        setSeries(previous => ({ ...previous, [field]: value ?? 0 }));
      }}
      seriesReference={reference?.unitCode ?? null}
      onDuplicate={duplicate}
    >
      {ink.zone}
    </FootprintsScreen>
  );
}

/** Le contour et le code dont une série part. */
type Reference = {
  readonly vertices: readonly Point[];
  readonly unitCode: string;
  readonly kind: FootprintKind;
  readonly categoryId: string | null;
};
