-- Q9 — le référentiel des pays.
--
-- M1 demande un pays et un fuseau horaire, et veut que le fuseau soit
-- pré-rempli d'après le pays quand celui-ci n'en compte qu'un. Aucune donnée
-- ne portait cette correspondance : elle aurait fini écrite dans le code, où
-- elle aurait vieilli sans que personne s'en aperçoive.
--
-- Q9.2 : « Aucune liste de pays, aucun fuseau et aucune correspondance entre
-- les deux n'est écrite dans le code. » La table est globale, en lecture seule
-- pour l'application, et alimentée par fichier — `packages/db/reference/`,
-- chargé par `pnpm seed:reference`, comme les paquets de règles le sont par
-- les fichiers de `rules-packs/` (M00.PL2).
--
-- `default_currency_code` reste vide. Aucune source de la machine ne porte la
-- correspondance d'un pays vers sa devise, et la table `currency` de Q4
-- n'existe pas encore. La colonne attend son fichier ; l'inventer serait la
-- faute que C4.1 décrit — un référentiel vide est un comportement correct, un
-- référentiel supposé est une faute.

CREATE TABLE azimut.country (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z]{2}$'),
  name_fr text NOT NULL CHECK (name_fr <> ''),
  name_en text NOT NULL CHECK (name_en <> ''),
  -- Les fuseaux du pays, dans l'ordre. Le pré-remplissage de M1 s'applique
  -- quand la liste n'en compte qu'un.
  timezones jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(timezones) = 'array'),
  -- Q4 — devise proposée par défaut pour une entité juridique de ce pays.
  -- Nulle tant que le fichier ne la porte pas.
  default_currency_code text CHECK (default_currency_code ~ '^[A-Z]{3}$'),
  -- Même exigence que pour une règle d'un paquet : sans référence
  -- documentaire, la ligne ne dit pas d'où elle vient et ne vaut rien.
  source_ref text NOT NULL CHECK (source_ref <> '')
);

-- Table globale, sans `org_id` : elle ne se cloisonne pas, elle se lit. Même
-- traitement que `rules_pack` en 0007.
ALTER TABLE azimut.country ENABLE ROW LEVEL SECURITY;

CREATE POLICY country_read ON azimut.country
  FOR SELECT TO authenticated USING (true);

-- Lecture seule pour l'application (M00.PL2) : l'alimentation passe par le
-- fichier et le propriétaire du schéma, jamais par l'interface.
GRANT SELECT ON azimut.country TO authenticated;
