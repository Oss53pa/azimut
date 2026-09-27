import { type JSX, useState } from 'react';
import type { Finding, Point } from '@azimut/core-model';
import type { TrancheSession } from './useTrancheSession.js';
import { ORG_OF_SESSION } from './session-identity.js';
import { acceptFootprint } from '../state/footprint-input.js';
import type { FootprintKind } from '../state/footprint-input.js';
import type { FootprintTool } from '../state/footprint-shortcuts.js';
import { createFootprintCommands } from '../state/footprint-commands.js';
import { countOf } from '../state/session-store.js';
import type { StoredRow } from '../state/session-store.js';
import { FootprintsScreen } from '../screens/FootprintsScreen.js';

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

/** F15 — l'adaptateur de l'écran de tracé des empreintes (M3, partie M). */
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

  const drawn = countOf(session.state, 'footprint');

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
      onClose={() => {
        void (async () => {
          const accepted = acceptFootprint(
            { vertices, unitCode, kind, categoryId: null },
            {
              codesOnLevel: session.state.rows
                .filter((r: StoredRow) => r.table === 'footprint')
                .map((r: StoredRow) => String(r.values['unit_code'] ?? '')),
              existing: [],
            },
          );
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
          setUnitCode('');
          setVertices(DEFAULT_FOOTPRINT);
        })();
      }}
      onAbandon={() => { setVertices(DEFAULT_FOOTPRINT); setFindings([]); }}
    />
  );
}
