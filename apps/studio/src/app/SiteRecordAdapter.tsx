import { type JSX, useState } from 'react';
import type { Finding } from '@azimut/core-model';
import type { TrancheSession } from './useTrancheSession.js';
import { ORG_OF_SESSION } from './session-identity.js';
import { rowsOf } from '../state/session-store.js';
import type { StoredRow } from '../state/session-store.js';
import { text, numeric, boolean } from '../state/row-values.js';
import {
  acceptBuilding, acceptLevel, levelDraftComplete, nextOrdinal,
  buildingCommands, levelCommands, renameCommands, deleteLevelCommands,
} from '../state/site-structure.js';
import { SiteRecordScreen } from '../screens/SiteRecordScreen.js';
import type {
  BuildingRow, LevelRow, BuildingForm, LevelForm,
} from '../screens/SiteRecordScreen.js';

/**
 * M1bis (partie M) — l'adaptateur de la fiche de site.
 *
 * Il lit la structure dans le magasin de session, par le chemin inverse de
 * celui qui l'écrit, et délègue tout jugement à `state/site-structure.ts`.
 *
 * Le décompte de ce qu'un niveau porte se fait ici parce que lui seul voit le
 * magasin : le module d'état ne lit rien, il reçoit le décompte.
 */

const EMPTY_BUILDING: BuildingForm = {
  name: '', independentAccess: false, defaultEdgeWidthM: null,
};

export function SiteRecordScreenAdapter({ session, siteId }: {
  readonly session: TrancheSession;
  readonly siteId: string;
}): JSX.Element {
  const [findings, setFindings] = useState<readonly Finding[]>([]);
  const [buildingForm, setBuildingForm] = useState<BuildingForm | null>(null);
  const [levelForm, setLevelForm] = useState<LevelForm | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<LevelRow | null>(null);

  const buildings = readStructure(session);
  const siteName = text(rowsOf(session.state, 'site')[0]?.values ?? {}, 'name') ?? siteId;
  const write = { orgId: ORG_OF_SESSION, siteId, timestamp: session.now() };

  function namesOf(table: 'building' | 'level', exceptId: string): readonly string[] {
    return rowsOf(session.state, table)
      .filter(row => row.id !== exceptId)
      .flatMap(row => {
        const name = text(row.values, 'name');
        return name === null ? [] : [name];
      });
  }

  function createBuilding(): void {
    void (async () => {
      if (buildingForm === null) return;
      const accepted = acceptBuilding(buildingForm, {
        buildingNames: buildings.map(b => b.name), levelNames: [], ordinals: [],
      });
      if (!accepted.ok) { setFindings(accepted.findings); return; }

      const buildingId = session.newId();
      const built = buildingCommands(
        accepted.value,
        { id: session.newId(), name: DEFAULT_LEVEL_NAME },
        { buildingId },
        { ...write, timestamp: session.now() },
      );
      if (!built.ok) { setFindings(built.findings); return; }
      await session.write(built.value);
      setFindings([]);
      setBuildingForm(null);
    })();
  }

  function createLevel(): void {
    void (async () => {
      if (levelForm === null) return;
      const building = buildings.find(b => b.id === levelForm.buildingId);
      if (building === undefined) return;

      const accepted = acceptLevel(levelForm, {
        buildingNames: [],
        levelNames: building.levels.map(l => l.name),
        ordinals: building.levels.map(l => l.ordinal),
      });
      if (!accepted.ok) { setFindings(accepted.findings); return; }

      const built = levelCommands(
        accepted.value,
        { levelId: session.newId(), buildingId: building.id },
        { ...write, timestamp: session.now() },
      );
      if (!built.ok) { setFindings(built.findings); return; }
      await session.write(built.value);
      setFindings([]);
      setLevelForm(null);
    })();
  }

  function rename(table: 'building' | 'level', id: string, name: string): void {
    void (async () => {
      const row = rowsOf(session.state, table).find(r => r.id === id);
      if (row === undefined) return;
      const built = renameCommands(
        table, id, text(row.values, 'name') ?? '', name, namesOf(table, id),
        { ...write, timestamp: session.now() },
      );
      // Un nom vide en cours de frappe n'est pas une faute : l'anomalie
      // s'affiche, et le champ garde ce que l'opérateur a tapé (M7 (partie M), règle 5).
      if (!built.ok) { setFindings(built.findings); return; }
      await session.write(built.value);
      setFindings([]);
    })();
  }

  function confirmDeletion(): void {
    void (async () => {
      if (pendingDeletion === null) return;
      const row = rowsOf(session.state, 'level').find(r => r.id === pendingDeletion.id);
      if (row === undefined) return;
      const built = deleteLevelCommands(
        { id: row.id, values: row.values },
        { footprints: pendingDeletion.footprints, nodes: pendingDeletion.nodes },
        { ...write, timestamp: session.now() },
      );
      if (!built.ok) { setFindings(built.findings); setPendingDeletion(null); return; }
      await session.write(built.value);
      setFindings([]);
      setPendingDeletion(null);
    })();
  }

  return (
    <SiteRecordScreen
      state={buildings.length === 0 ? { kind: 'empty' } : { kind: 'ready' }}
      siteName={siteName}
      buildings={buildings}
      findings={findings}
      buildingForm={buildingForm}
      onOpenBuildingForm={() => { setBuildingForm(EMPTY_BUILDING); setLevelForm(null); }}
      onBuildingField={setBuildingForm}
      onCreateBuilding={createBuilding}
      levelForm={levelForm}
      onOpenLevelForm={buildingId => {
        const building = buildings.find(b => b.id === buildingId);
        setBuildingForm(null);
        setLevelForm({
          buildingId,
          name: '',
          // M1bis : « rang proposé à la suite du plus élevé ». Proposé, donc
          // saisissable : le champ reste modifiable.
          ordinal: nextOrdinal((building?.levels ?? []).map(l => l.ordinal)),
          elevationM: null,
        });
      }}
      onLevelField={setLevelForm}
      onCreateLevel={createLevel}
      levelFormComplete={levelForm !== null && levelDraftComplete(levelForm)}
      onCloseForms={() => { setBuildingForm(null); setLevelForm(null); setFindings([]); }}
      onRename={rename}
      pendingDeletion={pendingDeletion}
      onAskDeleteLevel={setPendingDeletion}
      onConfirmDeleteLevel={confirmDeletion}
      onCancelDeleteLevel={() => { setPendingDeletion(null); }}
    />
  );
}

/** Le nom du premier niveau d'un bâtiment créé, comme en M1 (partie M) pour le site. */
const DEFAULT_LEVEL_NAME = 'RDC';

/**
 * La structure du site, telle que le magasin la porte.
 *
 * Une ligne dont les champs requis ne se lisent pas est écartée plutôt que
 * complétée : afficher un niveau de rang zéro qu'on n'a pas saisi ferait
 * croire à une structure que personne n'a posée.
 *
 * L'ordre est celui du nom de bâtiment, puis du rang, l'identifiant
 * départageant : deux lectures d'un même magasin rendent la même liste (A9).
 */
function readStructure(session: TrancheSession): readonly BuildingRow[] {
  const levels = rowsOf(session.state, 'level').flatMap(row => {
    const buildingId = text(row.values, 'building_id');
    const name = text(row.values, 'name');
    const ordinal = numeric(row.values, 'ordinal');
    const elevation = numeric(row.values, 'elevation_m');
    if (buildingId === null || name === null || ordinal === null || elevation === null) return [];
    return [{ buildingId, level: {
      id: row.id,
      name,
      ordinal,
      elevationM: elevation,
      footprints: countOn(session, 'footprint', row.id),
      nodes: countOn(session, 'node', row.id),
    } }];
  });

  const out = rowsOf(session.state, 'building').flatMap(row => {
    const name = text(row.values, 'name');
    if (name === null) return [];
    const own = levels
      .filter(entry => entry.buildingId === row.id)
      .map(entry => entry.level)
      .sort((a, b) => a.ordinal - b.ordinal || a.id.localeCompare(b.id));
    return [{
      id: row.id,
      name,
      independentAccess: boolean(row.values, 'independent_access'),
      defaultEdgeWidthM: numeric(row.values, 'default_edge_width_m'),
      levels: own,
    }];
  });
  return out.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/** Combien de lignes d'une table se rattachent à ce niveau. */
function countOn(session: TrancheSession, table: string, levelId: string): number {
  return rowsOf(session.state, table)
    .filter((row: StoredRow) => text(row.values, 'level_id') === levelId)
    .length;
}
