import { describe, it, expect } from 'vitest';
import {
  createdTables,
  tablesWithPolicy,
  tablesWithRlsEnabled,
  tablesWithRlsForced,
  allUpSql,
} from '../migration-corpus.js';

/**
 * A6.1 — le test que le cahier des charges rend obligatoire, et qui manquait.
 *
 * « Test obligatoire, exécuté à chaque migration : pour chaque table portant
 * `org_id`, une politique existe et est active. Une table nouvelle sans
 * politique fait échouer la CI. »
 *
 * Il manquait. La migration `0007` activait la sécurité par ligne nommément,
 * sur les tables qui existaient alors ; toute table créée ensuite devait s'en
 * charger elle-même. `0009` et `0015` ne l'ont pas fait, et rien ne l'a dit :
 * `approval`, `support_typology` et `support_version` portaient `org_id` sans
 * aucune politique. Constaté sur une base réelle, note du préalable K4 nº 7.
 */
describe('A6.1 — cloisonnement par ligne, contrôle de catalogue', () => {
  const tables = createdTables();
  const partitioned = [...tables]
    .filter(([, hasOrgId]) => hasOrgId)
    .map(([name]) => name)
    .sort();

  it('trouve les tables du schéma et celles qui portent org_id', () => {
    expect(tables.size).toBeGreaterThan(40);
    expect(partitioned).toContain('site');
    expect(partitioned).toContain('approval');
    expect(partitioned).not.toContain('rules_pack');
  });

  it('chaque table portant org_id a une politique', () => {
    const withPolicy = tablesWithPolicy();
    const sans = partitioned.filter(t => !withPolicy.has(t));
    expect(sans).toEqual([]);
  });

  it('chaque table portant org_id a la sécurité par ligne activée', () => {
    const enabled = tablesWithRlsEnabled();
    const sans = partitioned.filter(t => !enabled.has(t));
    expect(sans).toEqual([]);
  });

  /**
   * Sans `FORCE`, le propriétaire des tables contourne les politiques. Or
   * l'application se connecte aujourd'hui avec le rôle qui possède le schéma.
   * Vérifié sur une base réelle : la même requête rendait 1 site sous le rôle
   * `authenticated` et 2 sous le propriétaire, une somme de 5 contre 32.
   */
  it('chaque table portant org_id force la sécurité par ligne', () => {
    const forced = tablesWithRlsForced();
    const sans = partitioned.filter(t => !forced.has(t));
    expect(sans).toEqual([]);
  });

  /**
   * Les politiques sont toutes adressées au rôle `authenticated`. Sans droit
   * sur le schéma, ce rôle ne peut rien lire et les politiques ne sont jamais
   * exercées : elles décrivent une intention que rien n'applique.
   */
  it('le rôle visé par les politiques a des droits sur le schéma', () => {
    const sql = allUpSql();
    expect(sql).toContain('GRANT USAGE ON SCHEMA azimut TO authenticated');
    expect(sql).toMatch(/GRANT SELECT[^;]*ON ALL TABLES IN SCHEMA azimut TO authenticated/);
  });
});
