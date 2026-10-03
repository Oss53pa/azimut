import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCUMENT = 'docs/cahier-des-charges.md';
const DEPOSIT = 'docs/cahier-des-charges.sha256';

/**
 * Le cahier des charges consolidé et son empreinte déposée.
 *
 * Trois règles portent ce fichier, et celle-ci en tient deux.
 *
 * **C'est le seul document de référence.** A0 : « Cette version consolidée
 * remplace les seize documents antérieurs. Ils ne font plus foi et ne doivent
 * plus être consultés. » Ceux qui subsistent sous `docs/` le sont pour
 * l'historique.
 *
 * **Il ne s'édite jamais depuis le code.** Rien dans le dépôt ne l'écrit, et
 * ce contrôle est ce qui rend la règle vérifiable plutôt que déclarative :
 * une écriture, d'où qu'elle vienne — une main, un script, un agent qui croit
 * corriger une coquille — déplace l'empreinte et fait rougir la chaîne au pas
 * suivant. Corriger le document est un geste de l'éditeur, qui redonne alors
 * l'empreinte de la version nouvelle ; ce n'est pas un geste du dépôt.
 *
 * **Il est accompagné de son empreinte.** Le nombre d'octets n'est pas déposé
 * à côté : une empreinte SHA-256 le contient déjà, un fichier d'une autre
 * longueur en ayant nécessairement une autre. Deux chiffres à tenir à jour
 * pour un seul fait auraient fini par diverger l'un de l'autre.
 *
 * Le pas homonyme de la chaîne d'intégration (A13.2) fait le même calcul avant
 * l'installation des dépendances, pour qu'une divergence se voie sans attendre
 * la compilation. Les deux lisent la même valeur déposée : il n'y a qu'une
 * définition de l'empreinte attendue.
 */
describe('Cahier des charges consolidé — empreinte déposée', () => {
  const deposited = readFileSync(resolve(ROOT, DEPOSIT), 'utf-8');

  it('le dépôt ne porte qu’une ligne, et elle nomme le document', () => {
    const lines = deposited.split('\n').filter(line => line.trim() !== '');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(new RegExp(`^[0-9a-f]{64} {2}${DOCUMENT}$`));
  });

  it('l’empreinte du fichier est celle qui est déposée', () => {
    const expected = deposited.slice(0, 64);
    const actual = createHash('sha256')
      .update(readFileSync(resolve(ROOT, DOCUMENT)))
      .digest('hex');

    expect(
      actual,
      `${DOCUMENT} ne porte plus l’empreinte déposée dans ${DEPOSIT}.\n`
      + 'Ce document ne s’édite jamais depuis le code : il est donné par '
      + 'l’éditeur, avec son empreinte. Si une version nouvelle vient d’être '
      + 'installée, déposer l’empreinte que l’éditeur en donne ; sinon, '
      + 'rétablir le fichier.',
    ).toBe(expected);
  });

  /**
   * Le contre-exemple : le contrôle distingue deux contenus. Sans lui, un
   * comparateur devenu inopérant passerait pour un document intact.
   */
  it('reconnaît un document divergent', () => {
    const body = readFileSync(resolve(ROOT, DOCUMENT));
    const altered = createHash('sha256')
      .update(Buffer.concat([body, Buffer.from(' ')]))
      .digest('hex');
    expect(altered).not.toBe(deposited.slice(0, 64));
  });

  /**
   * A0 : le consolidé porte les parties A à Q et les annexes T et Z. L'ancien
   * fichier de ce nom n'en portait que A à C, et l'absence de cette borne
   * laisserait passer sa réinstallation sous une empreinte à jour.
   */
  it('porte bien le consolidé entier, et non ses seules parties A à C', () => {
    const body = readFileSync(resolve(ROOT, DOCUMENT), 'utf-8');
    for (const part of ['# PARTIE C.', '# PARTIE K.', '# PARTIE Q.', '# ANNEXE Z.']) {
      expect(body, part).toContain(part);
    }
  });
});
