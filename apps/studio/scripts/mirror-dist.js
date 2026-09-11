/**
 * Recopie le bundle à la racine du dépôt, en plus de apps/studio/dist.
 *
 * L'hébergeur cherche son répertoire de sortie à un endroit qui dépend
 * de réglages non versionnés — répertoire racine du projet, répertoire
 * de sortie du tableau de bord — que le dépôt ne peut pas garantir.
 * Publier aux deux emplacements couvre les deux conventions au lieu de
 * parier sur l'une d'elles.
 *
 * La copie ne fait jamais échouer le build : apps/studio/dist reste la
 * sortie de référence, la racine n'est qu'un miroir.
 */

import { cp, rm, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(HERE, '..', 'dist');
const MIRROR = resolve(HERE, '..', '..', '..', 'dist');

async function main() {
  try {
    await access(SOURCE);
  } catch {
    console.error(`mirror-dist : source absente (${SOURCE}), rien à recopier.`);
    return;
  }

  if (SOURCE === MIRROR) {
    console.log('mirror-dist : source et miroir confondus, rien à faire.');
    return;
  }

  try {
    await rm(MIRROR, { recursive: true, force: true });
    await cp(SOURCE, MIRROR, { recursive: true });
    console.log(`mirror-dist : ${SOURCE} → ${MIRROR}`);
  } catch (error) {
    // Pas d'échec du build : la sortie de référence est déjà produite.
    console.error('mirror-dist : recopie impossible —', String(error));
  }
}

await main();
