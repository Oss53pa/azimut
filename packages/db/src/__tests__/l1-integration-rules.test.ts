import { describe, it, expect } from 'vitest';
import {
  MODULE_KEYS,
  MODULE_LAYER,
  OWNED_TABLES,
  MODULE_READS,
  DECLARED_UPWARD_READS,
  DEGRADATION_WHEN_ABSENT,
  TABLES_WITHOUT_DECLARED_OWNER,
  SUPPORT_COLUMN_OWNER,
  SUPPORT_IDENTITY_COLUMNS,
  COLUMNS_SPECIFIED_NOT_YET_IN_SCHEMA,
} from '@azimut/core-model';
import type { ModuleKey } from '@azimut/core-model';
import { createdTables, allUpSql } from '../migration-corpus.js';

/**
 * L1 — les quatre règles d'intégration, une par test.
 *
 * Une règle numérotée est opposable et se cite dans une revue et dans un test
 * (N0). Attention au jeton : `R1` à `R4` désignent ici les règles
 * d'intégration de L1, non les règles métier `R1` à `R9` du module 05 (N5.2)
 * ni les `R1` à `R6` du complément « atelier ».
 */
describe('L1 — règles d’intégration', () => {
  const schemaTables = [...createdTables().keys()].sort();

  /**
   * R1 (partie L). Propriété unique. « Chaque entité appartient à exactement un module.
   * Lui seul l'écrit. Une entité sans propriétaire déclaré ne peut pas être
   * créée. »
   */
  describe('R1 — propriété unique', () => {
    it('aucune table n’a deux propriétaires', () => {
      const seen = new Map<string, ModuleKey>();
      const doubles: string[] = [];
      for (const module of MODULE_KEYS) {
        for (const table of OWNED_TABLES[module]) {
          const first = seen.get(table);
          if (first !== undefined) doubles.push(`${table} : ${first} et ${module}`);
          else seen.set(table, module);
        }
      }
      expect(doubles).toEqual([]);
    });

    /**
     * Le seul cas de propriété partagée du modèle, et il est voulu : L0 scinde
     * `support` entre wayfinding et signalétique, colonne par colonne, ce qui
     * supprime le cycle entre les deux modules.
     */
    it('`support` est la seule table à propriété partagée, et elle l’est par colonne', () => {
      expect(Object.keys(OWNED_TABLES).every(m => !OWNED_TABLES[m as ModuleKey].includes('support'))).toBe(true);
      const owners = new Set(Object.values(SUPPORT_COLUMN_OWNER));
      expect([...owners].sort()).toEqual(['02-wayfinding', '04-signaletique']);
    });

    it('aucune colonne de `support` n’est à la fois d’identité et attribuée', () => {
      const attributed = Object.keys(SUPPORT_COLUMN_OWNER);
      const both = SUPPORT_IDENTITY_COLUMNS.filter(c => attributed.includes(c));
      expect(both).toEqual([]);
    });

    /**
     * Le contrôle qui mord : toute table du schéma est soit attribuée à un
     * module, soit inscrite comme non attribuée avec son motif. Une table
     * nouvelle ne peut donc pas entrer sans que la question soit posée.
     */
    it('toute table du schéma est attribuée ou justifiée', () => {
      const owned = new Set(MODULE_KEYS.flatMap(m => [...OWNED_TABLES[m]]));
      const justified = new Set(Object.keys(TABLES_WITHOUT_DECLARED_OWNER));
      const orphelines = schemaTables.filter(t => !owned.has(t) && !justified.has(t));
      expect(orphelines).toEqual([]);
    });

    it('aucune justification ne porte sur une table absente du schéma', () => {
      const perimees = Object.keys(TABLES_WITHOUT_DECLARED_OWNER)
        .filter(t => !schemaTables.includes(t));
      expect(perimees).toEqual([]);
    });

    it('aucune table possédée n’est absente du schéma', () => {
      const manquantes = MODULE_KEYS
        .flatMap(m => OWNED_TABLES[m].map(t => `${m} : ${t}`))
        .filter(entry => !schemaTables.includes(entry.split(' : ')[1] ?? ''));
      expect(manquantes).toEqual([]);
    });
  });

  /**
   * R1 (partie L) — le registre ne doit jamais déclarer la propriété d'une
   * colonne qui
   * n'existe pas : ce serait décrire un modèle au lieu de décrire le schéma.
   * Les colonnes que A5.6 et N4.2 spécifient et que le schéma n'a pas encore
   * sont recensées à part, avec la tranche qui les construira.
   */
  describe('R1 — le registre ne déclare que ce qui existe', () => {
    const sql = allUpSql();

    function supportHasColumn(column: string): boolean {
      return new RegExp(`\\b${column}\\b`).test(sql);
    }

    it('chaque colonne de `support` attribuée existe au schéma', () => {
      const fantomes = Object.keys(SUPPORT_COLUMN_OWNER).filter(c => !supportHasColumn(c));
      expect(fantomes).toEqual([]);
    });

    it('aucune colonne différée n’est aussi déclarée possédée', () => {
      const differees = Object.keys(COLUMNS_SPECIFIED_NOT_YET_IN_SCHEMA)
        .filter(k => k.startsWith('support.'))
        .map(k => k.slice('support.'.length));
      const doubles = differees.filter(c => c in SUPPORT_COLUMN_OWNER);
      expect(doubles).toEqual([]);
    });

    it('chaque colonne différée porte son motif et sa tranche', () => {
      for (const [column, reason] of Object.entries(COLUMNS_SPECIFIED_NOT_YET_IN_SCHEMA)) {
        expect(reason.length, column).toBeGreaterThan(40);
      }
    });
  });

  /**
   * R2 (partie L). Lecture sans écriture. « Tout module lit ce dont il a besoin dans les
   * autres, aucun n'y écrit. »
   *
   * Le contrôle complet demande un chemin d'écriture, qui est le lot 1.2 de la
   * tranche 1. Ce
   * qui se vérifie aujourd'hui : un module ne déclare jamais lire ce qu'il
   * possède déjà — une telle déclaration signalerait une attribution fausse,
   * comme le cycle que L0 a résolu.
   */
  describe('R2 — lecture sans écriture', () => {
    it('aucun module ne déclare lire ses propres données', () => {
      const fautes = MODULE_KEYS
        .filter(m => MODULE_READS[m].includes(m))
        .map(m => `${m} se lit lui-même`);
      expect(fautes).toEqual([]);
    });
  });

  /**
   * R3 (partie L). Dépendance descendante. « Une couche lit les couches inférieures,
   * jamais les supérieures. Un cycle est une erreur de conception, jamais un
   * cas à gérer. »
   */
  describe('R3 — dépendance descendante', () => {
    it('aucune lecture ne remonte d’une couche, hors celles que L3 déclare', () => {
      const declared = new Set(DECLARED_UPWARD_READS.map(r => `${r.from}->${r.to}`));
      const remontees = MODULE_KEYS.flatMap(from =>
        MODULE_READS[from]
          .filter(to => MODULE_LAYER[to] > MODULE_LAYER[from])
          .map(to => `${from}->${to}`),
      ).filter(pair => !declared.has(pair));
      expect(remontees).toEqual([]);
    });

    it('chaque remontée déclarée porte son motif', () => {
      for (const read of DECLARED_UPWARD_READS) {
        expect(read.reason.length).toBeGreaterThan(20);
      }
    });

    /**
     * Le cycle que L0 a résolu ne doit pas revenir : le wayfinding ne lit plus
     * la signalétique, il possède les attributs d'implantation dont il a besoin.
     */
    it('le cycle entre wayfinding et signalétique reste supprimé', () => {
      expect(MODULE_READS['02-wayfinding']).not.toContain('04-signaletique');
      expect(MODULE_READS['04-signaletique']).toContain('02-wayfinding');
    });
  });

  /**
   * R4 (partie L). Dégradation déclarée. « Chaque module dit ce qu'il devient quand un
   * module dont il dépend n'est pas souscrit. Le comportement dégradé est
   * spécifié, jamais improvisé, et jamais silencieux. »
   */
  describe('R4 — dégradation déclarée', () => {
    it('les douze modules déclarent leur dégradation', () => {
      const muets = MODULE_KEYS.filter(m => (DEGRADATION_WHEN_ABSENT[m] ?? '').trim() === '');
      expect(muets).toEqual([]);
    });
  });
});
