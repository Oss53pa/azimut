# Matrice d'avancement — incréments 0, 1 et 2

Établie le 25 novembre 2026, mise à jour le même jour après l'ajout des sites
`ref-health`, `ref-transit` et `ref-campus` (C1), sur la branche `claude/azimut-partie-g-points-ouverts-cqpff0`
(commit b80e26d, CI 225 verte). Confrontée au cahier des charges consolidé, partie B,
et à lui seul. Elle ne fait pas foi : le cahier seul fait foi.

Règle de lecture, celle de `matrice-tranche-1.md` : **une exigence sans preuve par un
essai est absente**, même si du code paraît la couvrir.

- **tenue** : chaque critère d'acceptation est prouvé par un essai ;
- **partielle** : du code existe, au moins un critère n'est pas prouvé ;
- **absente** : rien ne la porte ;
- **hors dépôt** : critère qu'aucun fichier ne peut prouver (déploiement, matériel,
  tiers, client réel).

Méthode : lecture des tâches, de leurs renvois, et des fichiers d'essai, par trois
relectures indépendantes, puis contre-vérification des verdicts les plus lourds.
Les suites n'ont pas été rejouées pour cette matrice ; elles passent en CI (run 225).

---

## Synthèse

| Incrément | Tâches | Tenues | Partielles | Absentes | Avancement prouvé | Critère de sortie |
| --- | --- | --- | --- | --- | --- | --- |
| 0. Fondations | 16 | 5 | 11 | 0 | ≈ 60 % | chaîne et étanchéité en place |
| 1. Audit de signalétique | 19 | 11 | 8 | 0 | ≈ 75 % (≈ 65 % atteignable dans le studio) | hors dépôt, non atteint |
| 2. Production des supports | 20 | 6 | 12 | 2 | ≈ 50 à 55 % | hors dépôt, non atteint |
| **0 à 2** | **55** | **22** | **31** | **2** | **≈ 62 %** | |

Pondération : chaque tâche reçoit la part de ses critères prouvés, puis la moyenne est
pondérée par le nombre de tâches. Barème simple (tenue 1, partielle 0,5) : 66 %, 74 %,
60 %. Les chiffres retenus sont plus bas parce que plusieurs partielles sont presque
vides.

---

## Incrément 0. Fondations

| Tâche | État | Preuve | Reste |
| --- | --- | --- | --- |
| T-0.1 Squelette | tenue | CI `typecheck`, `lint`, `scripts/check-deps.js` | le contrôle ne lit que les `package.json`, pas les imports ; aucun cas négatif |
| T-0.2 Chaîne | partielle | `ci.yml`, neuf étapes dans l'ordre | aucune preuve d'échec si une étape manque ; certaines suites se sautent encore sans garde (`m02-w11-barriere`, `audit-site-job`) |
| T-0.3 Base et migrations | partielle | migrations appliquées sur base vide en CI | aucun essai up → down → up ; `db:reset` n'est éprouvé que dans ses refus |
| T-0.4 Schéma A5.1, A5.2 | partielle | `a5-jsonb-validation.db`, `a5-positions-point.db`, `a6-2-role-marketing.db`, `a5-contraintes-insertion.db` (volume, code d'unité, nature d'empreinte, langues, origine, calage, sens et boucle d'arête, liaison verticale) | `edge.width_m > 0` et une borne sur `ordinal` n'existent pas en base, et A5 ne les pose pas |
| T-0.5 Authentification et rôles | partielle | `auth-2-connexion-reelle.db`, `a6-2-roles-en-base.db` | journalisation des changements de rôle (QA5) ; utilisateur authentifié sans rattachement non éprouvé |
| T-0.6 Cloisonnement | partielle | `test:rls` en CI, `a10-4-etancheite-postgrest.db` | pas de cas négatif de couverture ; temps de réponse ; sondes par clé étrangère |
| T-0.7 Jetons de thème | tenue | `no-hardcoded-colors`, `contrast.test.ts` | l'analyse ne voit ni `hsl()`, ni hex à 8 chiffres, ni couleurs nommées |
| T-0.8 Paquets de règles | tenue | `loader-guard`, `resolve-rule` | deux codes pour un même défaut selon la voie de chargement |
| T-0.9 Génération PDF | partielle | déterminisme : `export-pdf.test.ts` | conformité PDF/X par outil tiers absente ; décision à confirmer par Oss53pa |
| T-0.10 Trousse de test | partielle | les sept sites de C1 en mémoire, empreintes figées (`sites.test.ts`), `svg-compare` | aucun chargement d'un site de référence en base |
| T-0.11 Service de compilation | tenue | `db-queue.db.test.ts`, `worker.test.ts` | ni conteneur (A3.1) ni déploiement — prérequis de toute fusion |
| T-0.12 Auto-hébergement | partielle, faible | base nue, PostgREST et service d'authentification en CI | aucun passage quotidien ; e2e non joués sur l'instance ; ni Storage ni fonctions |
| T-0.13 Composants et états | partielle, faible | focus visible seulement | liste fermée de F6, sept états, non-régression visuelle : à faire |
| T-0.14 Icônes | partielle, faible | `no-emoji-icons` | contrôle aplat et forme pleine absent ; aucun texte de remplacement ; taille de base 18 px au lieu de 16 |
| T-0.15 Bilinguisme | tenue | `i18n-errors`, `no-hardcoded-strings`, `a11y-axe` (fr, en) | le motif de clé admet deux segments, D12 en veut trois |
| T-0.16 Métriques de police | partielle | `font-embedding`, `font-registry` | extraction, mesure de référence, invalidation, registre en base, branchement du contrôle d'incorporation |

## Incrément 1. Audit de signalétique

| Tâche | État | Preuve | Reste |
| --- | --- | --- | --- |
| T-1.1 Import et calage | tenue | `plan-calibration`, `plan-import`, `affine-calibration` | cas limites « sans échelle » et « échelle non uniforme » en deux points |
| T-1.2 Empreintes | tenue | `footprint-input`, `validate-geometry`, `n1-3-no-pixels-in-schema` | édition des sommets d'un polygone existant |
| T-1.2b Commandes et annulation | tenue | `e4-4-rejeu-commandes` (état complet après annulation et après rétablissement), `command-store`, S6.8 | — |
| T-1.2c Outils métier | partielle | axe : `graph-axis`, `m4-axe.spec` | division, fusion, décalage, report : hors atelier, sans contrôle de saisie ni arbitrage des attributs |
| T-1.2d Magnétisme | tenue (moteur) | `snap.test.ts`, `snap-integration` | branché dans l'éditeur d'habillage seul, pas dans M3 et M4 |
| T-1.3 Volumes | partielle | moteur : `validate-geometry` ; base : `a5-contraintes-insertion.db` | aucun écran de saisie ; valeurs par défaut du niveau absentes |
| T-1.4 Graphe | tenue | `graph-input`, `m4-proprietes.spec` | — |
| T-1.5 Liaisons verticales | tenue | `checks-structure`, `t-1-5-liaison-verticale.spec` | — |
| T-1.6 Complétude | tenue | `n1-7-3-cas-et-contre-exemple`, `validate-graph` | — |
| T-1.7 Annuaire | tenue | `validate-directory`, `validate-graph` | — |
| T-1.8 Bibliothèques | partielle | moteur : `library-safety-guards`, `inv3-…` ; base : `a5-contraintes-insertion.db` (modification et suppression refusées, import refusé) | jeux sectoriels préchargés absents |
| T-1.9 Profils | partielle | `c1-sites-sante-transport-campus.test.ts` : les deux propriétés sur chaque site de référence valide qui porte le profil, de chaque entrée à chaque destination ; l'essai mord | `ref-minimal`, `ref-retail` et `ref-adversarial` ne portent pas les deux profils |
| T-1.10 Moteur de parcours | partielle | `compute-route`, `edge-closures`, `route-cache` (gardes vides remplacées par des échecs) | invalidation sélective du cache non tenue (empreinte du site entier) |
| T-1.11 Points de décision | partielle | `decision-points` (`toContain`) | listes attendues exactes par site ; un nœud de passage sur une chaîne y est consacré point de décision — à confronter à la règle « une seule issue » |
| T-1.12 Audits | tenue | `audit.test.ts`, `audit-accessibility-evacuation` | — |
| T-1.13 Reprise de carnet | partielle | `import-supports` (chaque garde précédée de son affirmation) | non branché dans le studio ; azimut absent, encodages |
| T-1.14 Rapprochement | tenue | `reconciliation` ; export : `reconciliation-export.test.ts` (identifiant sur chaque ligne, reproductible, aucune formule de tableur), `t-1-14-export-rapprochement.spec` (téléchargement depuis l'écran) | — |
| T-1.15 Écran de conception | partielle | `a11y-axe.spec` (M1 à M5, R) | écrans d'audit non analysés |
| T-1.16 Présence et verrou (S6) | tenue | `s6-4-verrou-ferme.db`, `s6-7-presence.db`, `s6-10-convergence.db` | contradictions T-1.16, G4.2, S-20 à reporter par l'éditeur |

Critère de sortie, « deux audits vendus et payés » : hors dépôt. La chaîne de l'audit
n'est pas complète dans le studio (import du carnet, rapprochement exportable).

## Incrément 2. Production des supports

| Tâche | État | Preuve | Reste |
| --- | --- | --- | --- |
| T-2.1 Typologies | tenue (mince) | `validate-supports` | une typologie ajoutée jusqu'à la face compilée |
| T-2.2 Gabarits | tenue | `compile-template` | — |
| T-2.3 Résolution | tenue | `compute-staleness`, `content-hash-peremption`, `resolve-face` | — |
| T-2.4 Dimensions | partielle | `required-face-format`, `face-format` | saisie manuelle dans le studio ; preuve que le constat bloque |
| T-2.5 Contrôles | partielle | lisibilité, contraste, lexique, destinations | adjacence chromatique (attend une règle de paquet, A2.2) ; garde générique sur `ruleRef` |
| T-2.6 Registre de sécurité | partielle | `inv3-registre-securite-cloisonne` | un code distinct par nature de tentative : le catalogue n'en a pas (A2.2, catalogue) |
| T-2.7 Isométrie | partielle | `painter-sort`, `hit-zones` | changement d'occupant sans redécoupage ; preuve de non-stockage |
| T-2.8 Plan simplifié | partielle, faible | `render-floor-plan` | disponibilité, contraste au calcul, densité mesurée |
| T-2.9 Plans muraux | tenue | `build-wall-plans`, `render-oriented-plan` | — |
| T-2.10 Évacuation | partielle | refus dans l'écran seul | refus dans le moteur et son essai |
| T-2.11 Tactile et braille | absente | — | standard de transcription non tranché (C4, A2.2) |
| T-2.12 PDF | partielle | déterminisme : `export-pdf` | validateur tiers en CI ; profils par substrat |
| T-2.13 Quantitatif | partielle | `compute-quantities`, CSV | recoupement avec la base ; les supports mal formés sont écartés en silence |
| T-2.14 Versions et BAT | tenue (critère) | `a12-3-insertion-seule.db` | transitions d'état non branchées sur une écriture |
| T-2.15 Rendu de face | partielle | `tests/visual.test.ts` (une face) | tous les gabarits, tous les sites |
| T-2.16 Compilation en lot | partielle | `batch.test.ts` (gestionnaire factice) | mesure sur 300 compilations réelles |
| T-2.17 Habillage | tenue | `s7-habillage-hors-calcul`, `e9-3-habillage.db`, `s6-1b-habillage.db` | — (étendre le garde aux applications interdirait de dessiner l'habillage sur les plans produits : M01.S7 l'exclut des calculs, non du rendu) |
| T-2.18 Annotations et symboles | absente | — | table `annotation` (E9.3) ; bibliothèque de symboles sans modèle (A2.2) |
| T-2.19 Composition de page | partielle | `plan-legend`, `legend` | `layout_composition` et la composition |
| T-2.20 Import d'actifs | partielle | `asset-sanitizer` | `imported_asset`, outil serveur isolé, garde au rendu |

Critère de sortie, « un carnet complet accepté par un fabricant réel et posé » : hors
dépôt, et non atteignable en l'état (braille, PDF validé, composition, actifs).

---

## Questions à trancher (A2.2), relevées par l'audit

1. Standard de transcription braille (C4) — T-2.11.
2. Règle d'adjacence chromatique, à fournir par un paquet — T-2.5.
3. Codes distincts par nature de tentative sur le registre de sécurité, absents du
   catalogue — T-2.6.
4. Bibliothèque de symboles d'habillage, sans table en E9.3 — T-2.18.
5. Règle du degré 2 des points de décision — T-1.11.
6. Plusieurs essais sur base lèvent un instant `FORCE ROW LEVEL SECURITY` pour poser
   leur décor (`organization`, et `object_lock` dans `s6-10-convergence`). CLAUDE.md
   interdit de contourner le cloisonnement, y compris en essai. À trancher : pratique
   admise pour amorcer un décor, ou décor à poser autrement.
7. « Service ouvert en continu » (C1, `ref-health`) : une plage horaire ne
   s'écrit que de 00:00 à 23:59, sans 24:00 ni franchissement de minuit, et un
   bâtiment sans horaires déclarés n'est pas un bâtiment ouvert sans
   interruption. Le modèle ne sait pas le dire ; l'hôpital ne déclare rien.
8. « Pointes de charge » et « flux séparés » (C1, `ref-transit`, `ref-health`) :
   le graphe ne porte que la capacité des liaisons verticales, et un profil
   n'exclut que des natures de nœud, jamais une arête. Les hypothèses de flux
   (`flow_hypothesis`, module 03) ne sont pas dans `SiteData`.
