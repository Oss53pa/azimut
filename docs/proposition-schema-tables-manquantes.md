# Proposition — schéma des tables manquantes

**Statut : proposition, non appliquée.** Aucune migration n'est écrite dans
`packages/db/migrations/`, aucun type n'est ajouté à `core-model`. Ce document
sert à décider (A2.2, cas 2 et 7) ; rien de ce qu'il décrit n'existe tant qu'une
décision ne l'a pas retenu.

Rédigé le 25 septembre 2026, à la suite de l'intégration des écrans de la
maquette « logiciel autonome v2 », qui a fait apparaître les manques.

## 1. Ce que l'inventaire a montré

L'inventaire a montré que « les tables manquent » était inexact dans la moitié
des cas. Les manques se rangent en trois familles, et une seule appelle de
nouvelles tables.

| Famille | Nature du travail | Migration | Décision requise |
| --- | --- | --- | --- |
| A. Tables présentes en base, absentes de `SiteData` | Lecture par le dépôt, types `core-model` | Aucune | Non : A5 et N2.2 les définissent déjà |
| B. Tables présentes, écartées de A5.7 | Ajout de colonnes, requalification d'une clé | Oui, dont une qui transforme | Oui : cas 7 |
| C. Besoins sans table ni définition A5 | Tables nouvelles, modules 05 à 09 | Oui, additives | Oui : cas 2 |

Deux besoins que l'on croyait de famille C n'en sont pas : les fermetures et les
emplacements de plans muraux se portent sur des colonnes que A5 prévoit déjà
(section 4).

## 2. Famille A — présentes en base, non chargées

Ces tables existent depuis la migration indiquée. Aucun écran ne peut s'en
servir, parce que `postgrest-repository.ts` ne les lit pas et que `SiteData` ne
les porte pas.

| Table | Migration | Module | Ce qu'elle débloque |
| --- | --- | --- | --- |
| `orientation_zone` (code, name_fr, name_en, kind, footprint_ids) | 0027 | 02 | Écran « Zonage » |
| `naming_rule` (target, pattern, max_length, uniqueness_scope) | 0027 | 02 | M02.W2 au-delà des collisions |
| `information_level` (typology_id, level) | 0027 | 02 | Écran « Hiérarchie », en partie (voir 3.3) |
| `wayfinding_sequence` (profile_id, ordinal, node_id, expected_level) | 0027 | 02 | Séquences déclarées, en regard des séquences calculées |
| `message_schedule`, `message_line` | 0027 | 02 | Versions enregistrées du tableau des messages |
| `zone` (level_id, name, kind) | 0003, 0029 | 01 | Zones de niveau |
| `charter` et ses tables filles | 0006 | 04 | Écran « Charte » (lecture seule déjà faite pour le lexique) |
| `installed_support`, `divergence`, `work_order` | 0006 | 08 | Parc posé et divergences enregistrées (après la famille B) |

**Proposition.** Une tâche par module, sans migration : type `core-model`,
lecture dans le dépôt, puis l'écran. Ce n'est pas un choix de modèle, c'est la
mise en service de tables déjà décidées.

## 3. Famille B — écarts entre la base et A5.7

### 3.1 `installed_support`

| A5.7 | En base | Écart |
| --- | --- | --- |
| `installed_version int` | absent | La version posée est ce qui fonde `outdated_content` |
| `condition` in (`good`,`worn`,`damaged`,`missing`) | absent | Sans elle, `damaged` et `missing` ne se relèvent pas |
| `surveyed_by`, `surveyed_at` | absent | La tournée ne laisse pas de trace sur le support |
| — | `installer_notes` | Présent en base, absent de A5.7 |

Proposé : ajout des quatre colonnes, `condition` sous `CHECK`. Additif, sans
transformation. `installer_notes` est conservé.

**Appliqué le 26/09/2026** par la migration `0047_a5_7_installed_support_columns` :
les quatre colonnes sont nullables, une pose antérieure n'ayant pas été relevée.

### 3.2 `divergence`

A5.7 rattache la divergence à `support_id` et lui donne `detail jsonb`. La base
la rattache à `installed_support_id` et lui donne `notes text`.

Les deux lectures se défendent : une divergence naît d'un relevé, mais
`superfluous` et `missing` peuvent concerner un support sans ligne posée. Le
rapprochement du moteur (`reconcile`) produit aussi des lignes sur des
**nœuds** (point non couvert), qui n'ont ni support ni support posé.

**Décision à prendre**, et c'est une migration qui transforme (cas 7) :

1. suivre A5.7 : `support_id` requis, `installed_support_id` facultatif ;
2. garder la base, et consigner l'écart à A5.7 ;
3. ajouter `node_id` facultatif, pour enregistrer les points non couverts.

La recommandation technique est 1 et 3 ensemble. Elle reste une recommandation :
les lignes existantes seraient à rattacher à leur support par jointure.

**Décidé le 25/09/2026 : options 1 et 3**, appliquées par la migration
`0041_a5_7_divergence_support_node`, avec trois précisions tranchées au même
moment :

- `support_id` et `node_id` sont facultatifs, mais l'un des deux au moins est
  renseigné (contrainte `divergence_designates_support_or_node`) : un point
  non couvert s'enregistre par son nœud seul ;
- `notes` est recopiée dans `detail` sous la clé `notes`, puis retirée ;
- un point non couvert s'enregistre sous la nature `missing`, la liste A5.7
  restant inchangée.

### 3.3 `information_level`

La base porte un entier par typologie. La maquette montre une hiérarchie
nommée (N1 à N6), avec hauteur de lecture, distance, corps minimal, messages par
face.

La hauteur, la distance et le corps minimal sont des valeurs normatives : elles
viennent d'un paquet de règles (INV-5), jamais d'une colonne saisie. Proposé :
**aucune colonne normative**, seulement `code`, `name_fr`, `name_en` et `rank`,
chaque niveau citant la règle dont il tire ses seuils par `rules_pack_rule.code`.
Additif. Le nombre maximal de messages par face est déjà une règle
(`max_destinations_per_face`), et le reste.

**Décidé le 26/09/2026 : ne rien ajouter.** Les colonnes proposées auraient
recopié le nom d'un niveau sur chaque ligne typologie × niveau (INV-1). Les
niveaux restent 1 à 4 (H2.3), nommés par l'interface ; à rouvrir si le cahier
fixe une hiérarchie nommée.

### 3.4 `work_order.estimated_cost`

La colonne est un `numeric` d'unité majeure. H8 impose l'unité mineure entière
avec sa devise. Proposé : `estimated_cost_minor bigint` à côté, recopie des
valeurs existantes multipliées par cent, puis retrait de l'ancienne colonne. Les
valeurs sont transformées : cas 7, décision requise.

A5.7 déclare lui-même `estimated_cost numeric` : A5.7 et H8 se contredisent.
**Décidé le 26/09/2026 : H8 fait foi**, appliqué par la migration
`0048_h8_work_order_cost_minor`. La recopie multiplie par 10 puissance
l'exposant ISO 4217 de la devise, et non par cent partout (le franc CFA n'a pas
de sous-unité) ; elle refuse une devise hors de sa liste close et un montant
qui tomberait entre deux unités mineures. La descente restitue exactement.

## 4. Fermetures et plans muraux : pas de table

### 4.1 Fermetures

A5.3 prévoit `edge.availability jsonb`, présente en base depuis 0004, lue par
aucun code. C'est elle qui porte une fermeture : une arête indisponible sur une
plage ne se parcourt pas, et le calcul d'itinéraire, les plans d'évacuation, le
planning de pose la voient au même endroit. `building.opening_hours` porte déjà
les horaires.

Forme proposée, à valider avec O4 (fuseau du site) :

```json
{ "closures": [
  { "from": "2026-10-12T00:00:00", "to": "2026-10-16T23:59:59",
    "reason_key": "works", "declared_by": "<membership.id>" }
] }
```

Heures locales du site (O4). Aucune table. Travail : type, lecture, prise en
compte par `isEdgeTraversableFrom`.

**Décidé et appliqué le 26/09/2026.** Forme ci-dessus retenue, bornes incluses,
sans décalage horaire. Une fermeture ne compte **qu'à un instant donné** : le
calcul d'itinéraire reçoit un instant facultatif et écarte alors les arêtes
fermées ; sans instant, rien ne change. Le tableau des messages, les panneaux et
les plans d'évacuation, imprimés et durables, ignorent les fermetures
temporaires. Le contrôle `edge_availability` bloque une disponibilité illisible
(tenue pour fermée à tout instant) et avertit d'un chemin d'évacuation touché ;
l'écran des créneaux de pose montre les fermetures du jour autour de leurs
supports.

### 4.2 Emplacements de plans muraux

T-2.9 : « un rendu par implantation ». A5.6 donne à `content_block.kind` la
valeur `map`. Un emplacement de plan mural est donc un support dont une face
porte un bloc `map` ; son orientation est son azimut. Aucune table : l'écran
« Plans muraux » filtrera sur ce bloc au lieu de lister tous les supports.

**Appliqué le 26/09/2026** : l'écran ne liste plus que ces supports, et dit
comment en déclarer quand il n'y en a aucun.

## 5. Famille C — tables nouvelles, modules 05 à 09

Ni A5 ni la partie B ne définissent ces entités. Le studio les simule avec
`domain/demo/*` (retiré depuis : les jeux de démonstration sont servis par le dépôt
de référence, `apps/studio/src/data/reference-*.ts`). Les tables ci-dessous sont celles que les écrans et les gardes
existants lisent déjà, sans plus : chaque colonne a un lecteur dans le code
actuel.

Conventions appliquées partout, celles de A5 et des migrations 0007 et 0039 :
`id uuid` ; `org_id` requis sous RLS `org_id IN (SELECT azimut.user_org_ids())` ;
`site_id` quand l'entité appartient à un site ; aucune cascade vers
`organization` ni `site` ; `created_at`, `updated_at` ; `deleted_at` là où
l'utilisateur retire ; énumérés sous `CHECK` ; montants en `bigint` d'unité
mineure avec `currency char(3)`.

### 5.1 Module 05 — régie

```sql
ad_placement   (id, org_id, site_id, code, level_id, node_id null,
                typology_key, area_m2 numeric, created_at, updated_at, deleted_at)
               UNIQUE (site_id, code)
ad_booking     (id, org_id, placement_id, state, from_date date, to_date date,
                advertiser_name, created_at, updated_at)
               state in ('option','reserved','occupied','maintenance','retired')
               CHECK (from_date <= to_date)
ad_option      (id, org_id, placement_id, expires_at date, created_at)
ad_creative    (id, org_id, placement_id, format, resolution_dpi int,
                safe_zone_mm int, color_profile, weight_bytes bigint,
                storage_path, sanitation, verdict, received_at)
               sanitation in ('clean','failed','deferred')
               verdict in ('approved','refused','human_review')
```

Lecteurs : `guardPlacementBookings`, `auditOptionExpiry`, `receiveCreative`.
**Non proposé** : une contrainte d'exclusion sur le chevauchement des
réservations. Le garde relève le double emploi en bloquant ; l'interdire en
base empêcherait de l'enregistrer pour le montrer. À trancher.
**Hors proposition** : contrats, grille tarifaire, annonceurs (aucun lecteur),
fiche technique (générée, H4.2, donc non stockée).

### 5.2 Module 06 — enseignes

```sql
tenant_sign_regulation (id, org_id, site_id, max_height_mm int null,
                        max_overhang_mm int null, allowed_materials jsonb,
                        allowed_lighting jsonb, forbidden_features jsonb,
                        effective_from date, created_at)
tenant_sign_dossier    (id, org_id, site_id, destination_id, state,
                        submitted_on date, height_mm int, overhang_mm int,
                        material, lighting, features jsonb, created_at, updated_at)
                        state in ('submitted','instructing','approved','refused')
tenant_sign_part       (id, org_id, dossier_id, key, provided boolean, storage_path null)
```

`destination_id` rattache le dossier à la cellule réelle, ce que la démo ne
fait pas. `tenant_sign_regulation` est versionnée par `effective_from` : un
article s'applique aux dossiers déposés après lui. Lecteur : `guardSignProject`.
**Hors proposition** : constat photographié et historique par cellule (M06.T4,
M06.T5, aucun moteur).

### 5.3 Module 07 — chantier

```sql
fabrication_lot (id, org_id, site_id, code, manufacturer_name, state,
                 created_at, updated_at)
                 state in ('ordered','in_production','delivered','installed')
lot_support     (id, org_id, lot_id, support_id)
                 UNIQUE (support_id)          -- un support, un seul lot
install_slot    (id, org_id, site_id, zone_label, planned_on date null,
                 night_work boolean, created_at)
slot_support    (id, org_id, slot_id, support_id)
install_reserve (id, org_id, support_id, lot_id, observation_key,
                 observed_by, observed_at, lifted_at null, photo_path null)
```

`lot_support` remplace le simple compte de la démo : le nombre de supports d'un
lot devient calculé. Lecteur : `auditInstallReserves`. Une réserve se lève par
`lifted_at`, jamais par suppression.

### 5.4 Module 08 — tournées

```sql
inspection_round   (id, org_id, site_id, zone_label, surveyor_id null,
                    surveyed_on date null, sync_state, created_at)
                    sync_state in ('pending','synced')
inspection_finding (id, org_id, round_id, support_id, nature_key, severity,
                    photo_path null, created_at)
                    severity in ('blocking','warning')
```

S'ajoutent à `installed_support`, `divergence`, `work_order` (famille B), qui
restent la couche de divergence de A5.7. Lecteur : `auditSurveySync`.

### 5.5 Module 09 — budget

```sql
cost_reference (id, org_id, typology_key, substrate_key,
                manufacturer_name null, unit_cost_minor bigint null,
                currency char(3) null, since date null, created_at)
                CHECK ((unit_cost_minor IS NULL) = (currency IS NULL))
budget_line    (id, org_id, site_id, phase_key, lot_id null,
                estimated_minor bigint null, quoted_minor bigint null,
                actual_minor bigint null, currency char(3), created_at, updated_at)
```

Un coût absent reste `NULL`, jamais zéro : c'est ce qui permet à
`auditCostReferences` de le relever. Une ligne ne mélange pas deux devises.
**Hors proposition** : estimation et coût de reprise, qui se calculent et ne se
stockent pas (INV-1). Ils demandent en revanche la **typologie du support**,
colonne `support.typology_id` de A5.6, présente en base et non lue par
`core-model` : c'est un travail de famille A, préalable à ces deux écrans.

## 6. Ordre proposé

1. Famille A, module par module, sans migration.
2. Correctif de l'écran « Évacuation » (voir 8), sans migration.
3. Fermetures et plans muraux (section 4), sans migration.
4. Famille B, une migration par table, chacune avec sa `down`, dont 3.2 et 3.4
   qui transforment des données.
5. Famille C, une migration par module, additive, avec sa `down` et ses
   politiques RLS, dans l'ordre 07, 09, 08, 05, 06 : c'est l'ordre dans lequel
   un module réel en lit un autre (le budget lit les lots, la tournée lit le
   parc posé).

Chaque migration ajoute son entrée à `migrations/ORDRE.md` et ses tables à
`OWNED_TABLES` de `module-ownership.ts`.

## 7. Décisions attendues

1. Famille A : engager la mise en service, module par module ? (aucun risque de
   données)
2. ~~`divergence` : option 1, 2 ou 3 de 3.2 ?~~ Décidé : 1 et 3 (migration 0041).
3. ~~`information_level` : colonnes de 3.3, sans valeur normative ?~~ Décidé : rien n'est ajouté.
4. ~~`work_order` : conversion en unité mineure de 3.4 ?~~ Décidé : H8 fait foi (migration 0048).
5. ~~Fermetures : format de `edge.availability` de 4.1 ?~~ Décidé : forme de 4.1, à un instant donné seulement.
6. ~~Famille C : lesquels des modules 05 à 09 passent aux données réelles, et
   dans quel ordre ?~~ Décidé : tous, dans l'ordre 07, 09, 08, 05, 06 (0042 à 0046).
7. ~~Régie : interdire en base le chevauchement de réservations, ou le laisser au
   garde ?~~ Décidé : laissé au garde.

## 8. Défaut relevé pendant cet inventaire

T-2.10 : un plan d'évacuation « ne peut être produit que sous un paquet de
règles rattaché. Refus explicite si absent ». L'écran « Évacuation » du module
04, ajouté avec la maquette, rendait son aperçu sans vérifier ce rattachement.
Il est corrigé dans le même lot que ce document : sans paquet rattaché, l'écran
refuse et le dit.
