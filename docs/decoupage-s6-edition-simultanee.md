# Découpage du lot S6, édition simultanée

Note de découpage au sens de la section G1.2 : S6 est classé XL en S11, et un
lot XL n'entre pas en développement avant d'être découpé. Cette note ne
modifie pas le cahier des charges et n'ajoute aucune règle. Elle découpe,
constate l'existant, et liste ce qui relève de la procédure d'arrêt et de
demande (A2.2) avant qu'une ligne de code soit écrite.

Établie le 13 novembre 2026 sur `master` à `856ad46`.

---

## 1. Ce que S6 demande

| Règle | Contenu |
| --- | --- |
| S-19 | Seules les commandes validées de E5.1 se propagent, jamais un geste en cours |
| S-20 | Verrou ferme sur l'objet en cours d'édition, qui tombe à la fin du geste ou à l'expiration |
| S-21 | Validation de complétude rejouée après chaque propagation ; un état incohérent bloque la publication et nomme les commandes en cause |
| S-22 | Présence, sélection et zone de travail des autres utilisateurs visibles |
| S-23 | Le hors ligne reste possible ; une session hors ligne ne participe pas à la propagation et se synchronise au retour |

Rattachement S11 : incrément 5. Le hors ligne dont dépend S-23 est le lot L4.4,
incrément 4.

---

## 2. Existant constaté

| Élément | État | Où |
| --- | --- | --- |
| Commande sérialisable E5.1 | Deux modèles coexistent : `Command` côté éditeur, `EntityCommand` côté modèle | `apps/studio/src/editor/command.ts`, `packages/core-model/src/site-commands.ts` |
| Pile d'annulation, commandes en attente | Présente, avec un champ `pending` non synchronisé | `apps/studio/src/state/command-store.ts` |
| Annulation après synchronisation | Garde `EDIT.UNDO_AFTER_SYNC` présente | `apps/studio/src/editor/undo-sync.ts` |
| Verrou consultatif G4.2 | Fonction pure testée, **branchée nulle part** hors de son test, aucune persistance | `apps/studio/src/domain/object-lock.ts` |
| Présence G4.2 | Absente de la barre d'état | `apps/studio/src/editor/StatusBar.tsx` |
| Validation de complétude | Présente, moteur pur | `packages/engine-graph/src/validate-graph.ts` |
| Barrière de publication | Présente | `apps/studio/src/publish-gate.ts` |
| Journal de commandes en base | Absent. Aucune table de commande, de verrou ou de présence dans `packages/db/migrations` | — |
| Hors ligne L4.4 | Non construit | — |
| Client de diffusion temps réel | Aucun. Le studio parle à la base par PostgREST, sans `@supabase/supabase-js` | `apps/studio/src/data/` |

Conséquence : T-1.16, préalable naturel de S6, n'est lui-même pas terminé. Le
verrou existe comme calcul, pas comme fonctionnalité.

---

## 3. Lots

Échelle de G1.2. Aucun lot n'est XL. « Bloqué » signifie qu'une question de la
section 4 doit être tranchée avant de commencer.

| Lot | Objet | Taille | Dépend de | Inconnue principale | État |
| --- | --- | --- | --- | --- | --- |
| S6.0 | Exploration bornée du transport de propagation | S | — | compatibilité avec l'installation autonome (A3.4) | Fait |
| S6.1a | Commande d'entité transportable et relue sous validation | S | — | aucune | Fait |
| S6.1b | Habillage exprimé en commandes d'entité | M | S6.1a | modèle de l'habillage | Prêt, Q6 et Q7 tranchées |
| S6.2 | Journal des commandes validées en base | L | S6.1a | ordre total par site, cloisonnement | Fait |
| S6.3 | Moteur d'application des commandes distantes | M | S6.1a | conflit constaté sans fusion | Fait |
| S6.4 | Verrou ferme, en base | M | S6.2 | autorisation en base, pas seulement à l'écran | Fait |
| S6.5 | Revalidation après propagation et barrière | M | S6.2, S6.3 | coût de la revalidation à chaque commande | Fait au poste ; barrière en base à décider |
| S6.6 | Diffusion en direct | M | S6.0, S6.2 | reprise après coupure sans perte ni doublon | Fait, sans intégration au poste (S6.6b) |
| S6.7 | Présence, sélection, zone de travail | M | S6.6 | nature éphémère ou persistée | Fait (S6.7a, S6.7b, S6.7c) |
| S6.8 | Annulation en présence de commandes distantes | M | S6.3, S6.6 | articulation avec E5.3 | Prêt |
| S6.9 | Session hors ligne et retour | L | L4.4, S6.3 | dépend d'un lot non construit | Bloqué, L4.4 |
| S6.10 | Essai de convergence à deux clients | M | S6.2 à S6.7 | instance autonome en intégration continue | Après les autres |

### S6.0 Exploration du transport

Livrable : une note, pas du code (G1.2). Elle compare les voies disponibles
dans la distribution autonome : le service de diffusion de l'installation
Supabase autonome, ou une écoute de la base relayée par le service existant.
Elle mesure pour chacune la reprise après coupure, l'ordre de livraison et le
cloisonnement par organisation, puis demande l'arbitrage. Elle ne choisit pas.

**Faite le 21 novembre 2026**, `docs/note-s6-0-transport-propagation.md`.
Sans mesure, faute de base et de service de diffusion dans cette session. Elle
recommande l'interrogation périodique du journal, sans dépendance nouvelle, et
laisse Q4 ouverte.

### S6.1 Modèle de commande unique

S-19 propage « les commandes validées de E5.1 ». Deux formes coexistent ; une
seule peut circuler. Le lot se scinde en deux à l'examen.

**S6.1a, fait le 17 novembre 2026.** `EntityCommand` voyage : écriture
déterministe et relecture validée par schéma, qui rejoue `buildCommand` à la
réception. Fichier `packages/core-model/src/command-wire.ts`.

Deux ajouts prévus ci-dessus sont abandonnés, et pourquoi :

- **la version d'objet** est inutile. Une commande porte déjà son état
  `before`. La comparer à l'état courant suffit à refuser une commande
  périmée en S6.3, sans colonne de version que A5 ne prévoit pas ;
- **l'identifiant de commande** dépend du journal S6.2. Le reporter là évite
  de modifier tous les constructeurs de commande pour un champ que rien
  ne lit encore.

**S6.1b, bloqué, Q6 et Q7.** L'éditeur d'habillage émet `Command<DocumentPatch>`,
un état de document entier ciblé sur le site, qui ne se traduit pas en
commandes de ligne. Les obstacles sont dans le modèle de données, pas dans le
code.

Acceptation de S6.1a : une commande écrite se relit à l'identique, son inverse
aussi ; une commande reçue qui viole le schéma, la propriété unique ou le
registre de sécurité est refusée.

### S6.2 Journal des commandes validées

Table en insertion seule, cloisonnée par ligne. Elle sert la propagation, la
revalidation qui nomme les commandes en cause (S-21) et l'arbitrage hors
ligne. **Aucune table de ce type n'existe en A5 ni en S9.**

**Fait le 21 novembre 2026**, migration `0078_s6_2_command_journal`. La suite
est numérotée par site et non par niveau (Q1 bis) : une commande de site,
d'annuaire ou une liaison verticale n'a pas de niveau.

Constat qui a façonné le lot : `apply_commands` (0026) n'examine jamais
`before`, et la dernière écriture gagne. Le journal n'est donc pas écrit à
côté d'elle mais par une fonction nouvelle, `apply_journaled_commands`, qui
en une transaction sérialise les écritures du site, applique chaque commande
sous la condition de son `before` comparé dans le type de la colonne, et
inscrit ce qui a été appliqué. Une commande périmée fait échouer l'appel en
`PT409`, que PostgREST rend en 409. `apply_commands` reste inchangée.

Limites connues, non traitées dans ce lot :

- le garde qui réserve l'insertion au journal à la fonction repose sur un
  réglage de transaction. PostgREST n'expose aucun moyen de le poser, mais une
  connexion SQL directe sous le rôle applicatif le pourrait ;
- sous les politiques, une modification refusée à un `auditor` ressort en
  409, comme une commande périmée, et non en refus d'accès ;
- la sérialisation par site n'est pas éprouvée par deux connexions
  concurrentes : un tel essai laisserait au journal des lignes que rien ne
  peut retirer ;
- aucune limitation de débit sur l'appel, qui passe par PostgREST comme les
  autres écritures.

### S6.3 Moteur d'application des commandes distantes

**Fait le 21 novembre 2026**, `packages/core-model/src/remote-commands.ts`.

Fonction pure : état des lignes d'une organisation plus commande reçue donnent
un nouvel état, ou un conflit avec l'état inchangé. L'état `before` de la
commande sert de condition, colonne par colonne. Aucune fusion. Une commande
d'une autre organisation est refusée par `EDIT.WRITE_REFUSED` (A6.1). Sans
horloge, sans réseau, sans tirage aléatoire (A9).

Trois motifs de conflit : création d'une ligne existante, modification ou
suppression d'une ligne absente, colonne de `before` changée depuis.

Acceptation : deux postes qui reçoivent les mêmes commandes dans le même ordre
obtiennent le même état. Une commande en conflit laisse l'état inchangé et
porte les deux versions.

### S6.4 Verrou ferme

Remplace le verrou consultatif de `object-lock.ts` pendant une session
d'édition simultanée. Le refus doit avoir lieu en base, sinon un second client
qui contourne l'interface passe outre. C'est la règle permanente d'autorisation
en base.

**S6.4, fait le 24 novembre 2026** (décisions Q1, Q2, Q5). Migration 0083 :
la table `object_lock`, `acquire_object_lock` (pose, renouvelle, ou reprend
un verrou expiré ; refuse en 423 celui d'un autre), `release_object_lock`,
`live_object_locks`. Expiration de 60 secondes, renouvelée toutes les 20
secondes pendant le geste ; aucun passage en force : un poste coupé ne bloque
personne plus d'une minute.

Le refus est un déclencheur sur chaque table que le poste peut modifier (74
tables) : il tient quel que soit le chemin d'écriture, la table directement
par PostgREST comprise. Il s'exécute avec les droits du propriétaire et ne
consulte l'utilisateur courant que si un verrou vivant existe : la première
version appelait cette fonction à chaque écriture, et le service de
compilation, qui n'a pas accès au schéma de la plateforme, ne traitait plus
aucun travail ; la suite de base l'a montré avant le commit. Une garde de
catalogue exige le déclencheur de toute table future.

Au poste : le geste commence à la première modification non écrite d'un objet
dans le panneau du graphe (`app/useEditLock.ts`) et finit quand elle est
appliquée, abandonnée, ou que la sélection change. Tenu par un autre, le
verrou refuse le geste : le panneau revient à la base et l'écran dit
`EDIT.OBJECT_LOCKED`. Un 423 renvoyé par une écriture se dit du même code.
La session ne rendait aucun refus aux écrans : elle rend désormais celui du
dernier geste (`refusal`), que l'écran du graphe affiche.

L'ancien verrou consultatif (`domain/object-lock.ts`), que rien n'appelait et
qui prévoyait le passage en force que Q2 exclut, est retiré ;
`EDIT.LOCK_OVERRIDDEN` est inscrit comme non levé, pour cette raison.

Éprouvé sur base réelle (`packages/db/src/__tests__/s6-4-verrou-ferme.db.test.ts`,
8 essais, qui tombent tous sans le déclencheur), et dans un navigateur à deux
postes : le second est refusé 255 ms après avoir commencé à modifier le nœud
que le premier édite, son panneau revient à la base ; une fois le premier
enregistré, le second modifie sans refus.

**Branché sur les autres gestes d'édition, le 24 novembre 2026.** Le renommage
d'un bâtiment ou d'un niveau (`RenameField`, fiche du site), le formulaire
des faces et la réécriture d'un texte libre verrouillent leur objet le temps
de la saisie ; tenu par un autre, la saisie est rendue et le refus s'affiche
près du champ. La coquille fournit le contexte du verrou quand sa session
est suivie. Vérifié dans un navigateur à deux postes pour le renommage, le formulaire
des faces et la réécriture d'un texte libre.

Limites :
- les empreintes et le calage n'ont pas de panneau d'édition à verrouiller :
  leurs gestes sont des commandes d'un seul tenant, protégées par le contrôle
  d'état (409) et refusées en 423 si l'objet est tenu par un autre ;
- le refus ne nomme pas le détenteur ; le calque de présence le montre, sur
  l'objet qu'il a sélectionné ;
- les objets tenus par d'autres ne sont pas marqués avant qu'on y touche
  (`live_object_locks` n'est pas encore lu par le poste).

### S6.5 Revalidation après propagation

Rejoue `validateGraph` après chaque commande appliquée. En cas d'incohérence,
la publication est bloquée par `publish-gate.ts` et les commandes en cause sont
nommées. Le coût d'une validation complète à chaque commande est à mesurer
selon le protocole D13 avant de retenir une validation incrémentale.

**S6.5, fait le 24 novembre 2026** (S-21, décision Q5). À chaque lot de
commandes reçues d'autres postes, la validation du graphe est rejouée avant et
après ; les anomalies bloquantes apparues avec le lot sont retenues, chacune
portant en paramètre les numéros au journal des commandes en cause
(`state/propagation-findings.ts`). Une commande est en cause si elle porte sur
l'objet de l'anomalie ou si l'une de ses valeurs le cite ; si aucune ne le
touche, le lot entier est nommé. Une anomalie retenue tombe dès qu'une
validation suivante ne la montre plus. Aucun code nouveau.

Dans l'atelier, la session rejoue la validation sur ses lignes
(`app/usePropagationCheck.ts`) ; dans la coquille, qui relit le site au lieu
de rejouer les commandes, le site d'avant et le site relu sont comparés
(`state/use-shell-propagation.ts`). Les deux affichent le même bandeau
(`components/PropagationBanner.tsx`) : combien d'anomalies, quelles commandes,
et que la publication attend une nouvelle validation.

La publication était déjà fermée : l'émission du tableau des messages exige un
passage de validation réussi pour l'empreinte actuelle du graphe (M02.W11),
qu'une propagation qui touche le graphe change ; la porte de `publish-gate.ts`
rejoue la validation sur le site relu.

Vérifié dans un navigateur à deux postes : un nœud isolé posé par l'un fait
paraître chez l'autre, dans l'atelier comme dans la coquille, le bandeau
nommant la commande de création (n° 17 et 18, puis n° 19, relus au journal).

**Mesure D13** (médiane de 5 exécutions, la première écartée ; Node 22, 4
cœurs Xeon à 2,1 GHz, en mémoire, sans rendu) : `validateGraph` coûte 0,036 ms
sur `ref-minimal`, 0,062 ms sur `ref-multilevel`, 0,213 ms sur `ref-retail`
(26 nœuds, 29 arêtes). Le contrôle valide deux fois par lot. La validation
complète est retenue ; une validation incrémentale ne se justifie pas sur ces
sites. Ils sont petits : la mesure se reprend au premier site réel modélisé,
comme D13 le prévoit pour toute cible.

**Constaté, non traité, à décider** : le blocage de l'émission n'est tenu qu'au
poste. Aucune garde en base ne contrôle le passage d'un tableau des messages
en revue ou en émission ; un client qui écrit directement `message_schedule`
passe outre. Et la trace `graph_validation` est écrite par le poste lui-même :
la base ne peut pas en croire le « passé » sans rejouer la validation, qui
n'existe qu'en TypeScript. Le tenir en base suppose une validation par le
service (travail du compilateur) ou une décision de modèle.

### S6.6 Diffusion en direct

Branche le transport retenu en S6.0 sur le journal S6.2. Exigences : aucune
commande perdue ni appliquée deux fois après une coupure, et aucune commande
d'une autre organisation reçue, testé comme un canal indirect de fuite au même
titre que les autres essais d'étanchéité.

**Fait le 21 novembre 2026**, `apps/studio/src/state/journaled-sink.ts` et
`apps/studio/src/state/journal-follower.ts` :

- un émetteur qui écrit par `apply_journaled_commands` et rend les numéros
  que le journal a donnés à ses commandes ;
- une lecture du journal après un curseur, chaque commande relue par
  `parseCommand` ;
- un curseur pur, qui écarte une entrée déjà reçue, avance sans les rendre
  sur les écritures du poste, et s'arrête avant un trou ;
- une interrogation périodique (`JOURNAL_POLL_INTERVAL_MS`, 1 000 ms), qui
  n'avance pas après un échec et attend le retour d'une écriture en vol.

Par PostgREST : le journal d'un site d'une autre organisation se lit comme
celui d'un site absent.

**Ce que S6.6 ne fait pas.** Rien dans l'atelier n'appelle encore ces
fonctions. Le poste tient ses données comme un `SiteData` chargé, pas comme
l'état de lignes qu'applique S6.3. Les brancher est un lot à part :

| Lot | Objet | Taille | Dépend de |
| --- | --- | --- | --- |
| S6.6b | Intégration au poste : émettre par l'émetteur journalisé, suivre le journal, appliquer par S6.3, recharger les vues | L | S6.6, Q9 à Q11 — fait |
| S6.6c | Écrans de la coquille (fermetures, faces, blocs libres) sur le journal | M | S6.6b — fait |

**S6.6b, bloqué le 21 novembre 2026.** L'examen du poste a montré quatre
obstacles, dont aucun ne relève de S6 :

1. **Aucune session authentifiée** (Q9). L'atelier écrit sous la clé
   publique, avec une organisation et un rôle écrits en dur
   (`apps/studio/src/app/session-identity.ts`). `apply_journaled_commands`
   prend l'auteur dans `current_user_id()`, vide sans session : toute
   écriture journalisée échouerait. La présence (S6.7) et le verrou (S6.4)
   demandent la même identité.
2. **Identifiants de ligne prévisibles et communs à tous les postes** (Q10).
   `newId` de `useTrancheSession` rend `00000000-0000-4000-8000-<compteur>`,
   compteur repris des lignes chargées. Deux postes sur le même site tirent
   le même identifiant ; deux sites, même d'organisations différentes, aussi,
   puisque la clé primaire est globale. La seconde création échoue alors sur
   l'unicité, et cet échec dit qu'une ligne de ce numéro existe ailleurs
   (A6.1, canal indirect). C'est le problème de Q7, étendu à tout l'atelier.
3. **Un refus est mis en file comme une coupure.** `writeToSession` met en
   file toute commande que l'émetteur refuse, et la renvoie au retour du
   réseau. Une commande périmée (409) repartirait à chaque reconnexion,
   refusée à chaque fois. Le poste doit distinguer le conflit de la coupure.
4. **Fidélité de `before` non éprouvée** (Q11). Les lignes de la session
   viennent du modèle (`sessionFromSite`), pas de la base. Une valeur que le
   modèle arrondit ou transforme — un réel converti en double, une géométrie
   quantifiée — ne correspondra pas à la base, et chaque modification de
   cette famille finira en 409. Seul un parcours sur base réelle, famille de
   commande par famille, le dira.

**S6.6b, fait le 22 novembre 2026.** Avec une session authentifiée,
l'atelier et le tableau des messages écrivent par `apply_journaled_commands`
et suivent le journal du site (`app/useSiteWriter.ts`,
`app/useJournalFollow.ts`, `state/journal-session.ts`). Les commandes des
autres postes sont rejouées sur la session ; un saut de numéro ou une
commande illisible fait relire le site. Rien n'est reçu tant qu'un travail
local attend en file ou qu'un choix de reprise n'est pas tranché (S6.9).

Un refus définitif de la base (4xx) ne part plus en file : la session reste
telle qu'avant le geste, le refus est rendu à l'écran, et une commande
périmée (409) fait relire le site. Une coupure ou une erreur serveur restent
mises en file (E5.3).

Éprouvé par deux postes réels, chacun sous son jeton, par PostgREST : ce que
l'un écrit, l'autre le reçoit ; un poste ne reçoit pas le sien ; de deux
gestes concurrents, le second est refusé sans file ni trace locale ; les deux
finissent sur l'état de la base. Puis dans un navigateur, deux personnes
connectées : le renommage d'un bâtiment par l'une paraît chez l'autre en
moins d'une seconde.

Limites constatées, non traitées :

- ~~S-19 n'est pas tenue par le renommage.~~ **Corrigé le 22 novembre
  2026** (`screens/RenameField.tsx`) : le champ garde un brouillon et n'écrit
  qu'à Entrée ou à la sortie ; Échap rend le nom en place. Vérifié dans un
  navigateur à deux postes : un renommage de quatre caractères inscrit une
  seule commande au journal, et l'autre poste ne voit rien pendant la frappe.
  Les autres champs de l'atelier étaient déjà conformes : le panneau du
  graphe écrit sur « Appliquer », le calage et la liaison verticale par
  formulaire.
- ~~Les écrans de la coquille qui écrivent par `use-command-write` (fermetures,
  faces, blocs libres) restent sur `apply_commands`.~~ **Traité par S6.6c**,
  ci-dessous.
- Aucun indicateur de synchronisation dans la barre d'état (F5).

**S6.6c, fait le 22 novembre 2026.** La coquille fournit aux écrans qui
écrivent par `use-command-write` leur émetteur (`context/site-writer.ts`) et
suit le journal du site ouvert (`state/use-shell-journal.ts`). Avec une
session authentifiée, ces écrans écrivent par `apply_journaled_commands`.
Ils ne tiennent pas de session de commandes : une écriture d'un autre poste
fait relire le site, sans passer par « chargement », au lieu d'être rejouée.
Un saut de numéro ou une commande illisible font de même. La tête du journal
se lit avant toute relecture, et la première se retente à chaque
interrogation tant qu'elle échoue. Une commande périmée est refusée en 409 :
le refus reste affiché et l'écran se relit. L'enveloppe qui reconnaît les
écritures du poste (`trackOwnWrites`) est partagée avec l'atelier.

La coquille et l'atelier ne sont jamais montés ensemble (route `legacy`
contre écrans d'atelier) : un seul suivi interroge à la fois.

Éprouvé sur base réelle par PostgREST
(`state/__tests__/s6-6c-coquille.db.test.ts`), avec le `before` tiré du site
relu par le dépôt du studio, comme l'écran le construit :

| Famille | Constructeur | Écran | Résultat |
| --- | --- | --- | --- |
| Déclarer, retirer une fermeture | `declareClosureCommand`, `withdrawClosureCommand` | fermetures | accepté |
| Modifier une face | `updateFaceCommand` | faces des supports | accepté |
| Réécrire un texte libre, retirer un bloc | `updateFreeTextCommand`, `withdrawBlockCommand` | faces des supports | accepté |
| Retirer un bloc depuis un site non relu | `withdrawBlockCommand` | faces des supports | refusé en 409, accepté après relecture |

Puis dans un navigateur, deux personnes connectées sur l'écran des
fermetures : la fermeture déclarée par l'une paraît chez l'autre en 250 ms
environ, le retrait par la seconde disparaît chez la première en 760 ms
environ, et le journal porte deux commandes pour ces deux gestes.

Le 404 vu en console au premier passage navigateur est `favicon.ico`, que
l'aperçu de construction ne sert pas : aucun appel à l'API n'est en cause.

**Défaut introduit par la relecture, corrigé le 22 novembre 2026.** Relire le
site sous un formulaire ouvert neutralisait le contrôle d'état : le
formulaire des faces et la réécriture d'un texte libre tiraient leur
`before` du site relu, si bien qu'un brouillon commencé avant l'écriture
d'un autre poste passait par-dessus elle, sans refus. Chaque brouillon garde
désormais l'état sur lequel il est parti (`views/faces/draft-base.ts`) et
c'est lui qui sert de `before`. Quand l'objet change sous le brouillon,
l'écran le dit et propose de repartir de la version actuelle ; enregistrer
sans repartir est refusé en 409, et la saisie reste à l'écran. Vérifié dans
un navigateur à deux postes : l'avertissement paraît en 770 ms environ,
l'enregistrement du brouillon périmé est refusé, la base garde l'écriture
de l'autre poste, et l'enregistrement après « repartir » passe.

Les retraits (fermeture, bloc) et les déclarations ne sont pas concernés : un
retrait porte sur la ligne affichée au moment du clic, une déclaration n'a
pas d'état antérieur. Le verrou ferme de S-20 (S6.4) rendra ce cas
impossible au lieu de le refuser après coup.

Non éprouvés : `declareFaceCommand` et `declareBlockCommand`, des créations,
dont le `before` est vide et que le contrôle d'état ne touche donc pas.

**Q11, essais par famille, 21 novembre 2026**
(`apps/studio/src/state/__tests__/q11-fidelite-before.db.test.ts`). Le site,
son esquisse et le circuit du tableau des messages sont relus par PostgREST
et le dépôt du studio ; chaque commande est construite par le constructeur
de l'atelier, puis appliquée par `apply_journaled_commands` dans une
transaction annulée. Aucun faux conflit, pour toutes les familles qu'un
écran de l'atelier écrit :

| Famille | Constructeur | Écran | Résultat |
| --- | --- | --- | --- |
| Renommer un bâtiment, un niveau | `renameCommands` | fiche du site | accepté |
| Supprimer un niveau vide | `deleteLevelCommands` | fiche du site | accepté |
| Déplacer un nœud, longueurs comprises | `updateNodeCommands` | graphe | accepté |
| Modifier une arête | `updateEdgeCommands` | graphe | accepté |
| Rayer une empreinte | `strikeFootprints` | empreintes | accepté |
| Annuler la création d'empreintes, du graphe | `inverseCommand` | pile d'annulation | accepté |
| Masquer une couche d'esquisse, gommer un trait | `layerVisibilityCommand`, `eraseCommands` | esquisse | accepté |
| Clore une annotation de révision | `setStateCommand` | tableau des messages | accepté |
| Émettre le tableau pour revue | `transitionCommands` | tableau des messages | accepté |
| Caler un plan, origine comprise, puis l'annuler | `calibrationCommands`, `inverseCommand` | calage | accepté |

L'essai mord : un `before` faux y est refusé en `PT409`.

Non éprouvé : `setSupportCode`, qu'aucun écran n'appelle encore. Il le sera
quand un écran l'emploiera. Q11 est close pour l'atelier : S6.6b peut se
brancher.

Un essai de bout en bout entre deux postes reste à S6.10 : sur la base
d'essai partagée, il laisserait au journal des lignes que rien ne peut
retirer. Il demande une base jetable.

### S6.7 Présence

Utilisateurs présents sur le niveau, leur sélection et leur zone de travail.
Couvre au passage la présence de G4.2, jamais construite.

**S6.7a, indicateur de synchronisation (F5.2), fait le 22 novembre 2026.**
La barre d'état des quatre écrans d'atelier porte l'état de synchronisation
(`state/sync-status.ts`, `screens/SyncIndicator.tsx`), un seul à la fois, le
plus grave d'abord : locale (aucune base), gestes en attente d'envoi, sans
suivi (base sans session), journal injoignable, à jour. Vérifié contre les
services réels : PostgREST coupé, l'indicateur passe à « journal
injoignable » en 770 ms environ ; rétabli, il revient à « à jour » en 760 ms
environ.

Corrigé au passage : le suivi du journal de l'atelier ne démarrait jamais si
la première lecture de la tête échouait, et rien ne le disait. Il la retente
désormais à chaque interrogation, comme la coquille (S6.6c), et l'échec
s'affiche.

**Mise en page F5.1, faite le 22 novembre 2026 (décision Q14).** La barre
d'état tombait sous la fenêtre sur les écrans à canevas : aucun conteneur de
l'atelier n'avait de hauteur bornée, et la page mesurait 1042 pixels pour une
fenêtre de 768. Le cadre de l'application prend maintenant la hauteur de la
fenêtre ; l'atelier remplit ce qui reste sous les barres ; le canevas du
graphe prend la hauteur libre, avec un plancher de 320 pixels sous lequel sa
colonne défile ; les panneaux de propriétés défilent en eux-mêmes ; la zone
des empreintes garde sa hauteur fixe, dont son repère dépend, et défile si la
fenêtre est trop basse. Mesuré : barre d'état en vue à 1366 × 768 et
1920 × 1080, sans chevauchement à 1366 × 600. Le parcours e2e de F5.2 exige
désormais la barre dans la fenêtre sur les quatre écrans.

Mesuré ensuite avec une session ouverte, barre d'authentification et bouton
de changement d'organisation au-dessus de l'atelier : l'écran de calage
perdait sa barre d'état d'un pixel, sa barre étant au bout d'un contenu qui
grandit. Le calage et la fiche du site passent par `screens/WorkshopBody.tsx`
: le contenu défile, la barre d'état reste au bas de la zone. Barre en vue
sur les quatre écrans, avec une et deux organisations.

Non traité : l'indicateur n'est pas posé dans les écrans de la coquille, qui
n'ont pas de barre d'état.

**S6.7b, présence sur un niveau, faite le 22 novembre 2026** (décisions Q1,
Q12, Q13). Migration 0081 : `membership.display_name`, la table
`level_presence` (sélection et zone validées par schéma en base, heure de
présence posée par la base), `touch_presence`, `leave_presence` et
`level_presence_list` ; une présence non renouvelée depuis 30 secondes sort
de la liste, et l'heure de la dernière modification se lit dans le journal
(INV-1). Le nom d'un collègue passe par `member_label`, passage étroit qui ne
rouvre pas `membership` en lecture directe (0075). Le poste s'annonce sur le
niveau ouvert, se renouvelle toutes les 10 secondes, lit les présents toutes
les 3 secondes, et se retire en partant (`app/useLevelPresence.ts`) ; la
barre d'état des écrans d'atelier les nomme, avec l'heure de leur dernière
modification (`screens/PresenceIndicator.tsx`).

Éprouvé sur base réelle (`packages/db/src/__tests__/s6-7-presence.db.test.ts`,
10 essais) et dans un navigateur à deux postes : l'arrivée d'un collègue
paraît en 2,3 s environ, son nom affiché en 3 s, sa modification en 2,8 s,
son départ en 3,1 s.

Décisions prises sous les règles existantes, à confirmer :
- l'`auditor` voit qui est présent mais ne s'annonce pas : 0076 lui retire
  toute écriture, et les essais de garde l'exigent de toute table portant
  `org_id` ;
- aucune clé vers `auth.users` (A2.4, 0024) : un utilisateur parti sort de
  la liste faute de rattachement, et sa ligne expire.

**S6.7c, sélection et zone de travail visibles, faite le 24 novembre 2026**
(S-22). L'écran du graphe publie ce qu'il sélectionne (nœud ou arête) et le
rectangle que sa vue montre, arrondi au centimètre (`viewport/presence-zone.ts`,
`viewport/use-presence-report.ts`) ; l'écran des empreintes, qui n'a pas de
sélection, publie sa zone. La session annonce 400 ms après le dernier
changement, et à chaque renouvellement. Chez les autres, un calque dessine la
zone de chacun en pointillé, son nom, et cercle ou double ce qu'il a
sélectionné (`viewport/PresenceOverlay.tsx`), dans l'accent secondaire du
thème : les couleurs d'état restent à leur sens (F2.2). Le calque ne prend pas
le pointeur, et il est caché aux lecteurs d'écran, la barre d'état nommant les
mêmes présents.

Vérifié dans un navigateur à deux postes : la zone de l'un paraît chez
l'autre dès l'ouverture, un nœud sélectionné est cerclé et nommé en 2,3 s
environ, et le calque disparaît au départ en 2,8 s.

Non vérifié dans un navigateur : le doublement d'une arête sélectionnée. Le
décor d'essai portait des nœuds écrits à la main dans un format de position
que le modèle ne lit pas, et leur arête ne s'affichait pas.

Constaté, non traité : la base accepte une position de nœud mal formée (des
clés `x` et `y` au lieu de `x_m` et `y_m`) ; aucune validation par schéma ne
la refuse.

Aucun écran ne saisit encore `display_name` : c'est AUTH.7.


### S6.8 Annulation en présence de commandes distantes

E5.3 vide la pile d'annulation à la synchronisation. Appliquée littéralement à
une propagation continue, cette règle vide la pile à chaque commande d'un autre
utilisateur, et l'annulation devient inutilisable en édition simultanée. Le lot
attend la réponse à Q3.

### S6.9 Session hors ligne et retour

S-23 renvoie à l'arbitrage des conflits déjà spécifié, c'est-à-dire au lot
L4.4. Ce lot ne peut pas précéder L4.4.

### S6.10 Essai de convergence

Deux clients sur une instance autonome (A3.4) : séquences concurrentes, coupure
réseau, verrou expiré, incohérence topologique provoquée. Exige l'égalité
stricte des états finaux et le blocage de la publication dans le dernier cas.

### Ordre

S6.0, S6.1a et S6.3 sont faits. Depuis les décisions du 21 novembre, S6.1b
et S6.2 étaient prêts ; S6.2 est fait. S6.1b, S6.4, S6.5 et S6.6 peuvent
commencer ; S6.6 est fait. S6.7 et S6.8 sont prêts. S6.9 attend L4.4.

---

## 3 bis. Décisions d'Oss53pa, 21 novembre 2026

Réponses données en session aux questions de la section 4. Elles valent
jusqu'à ce que l'éditeur les reporte au cahier. Trois s'écartent de la lettre
du cahier : elles sont signalées à l'éditeur, section 5.

| Question | Décision |
| --- | --- |
| Q1 | Trois tables : `command_journal`, en insertion seule, avec un numéro d'ordre par site (Q1 bis, même jour) ; `object_lock`, le verrou ferme avec expiration ; `level_presence`, qui est sur le niveau, sa sélection, sa zone et sa dernière activité. Toutes cloisonnées par organisation |
| Q2 | Verrou ferme, refusé en base aux autres. Il tombe à la fin du geste, ou à une expiration courte renouvelée pendant le geste. Aucun passage en force |
| Q3 | La pile d'annulation est conservée. Annuler émet la commande inverse, propagée comme les autres ; si l'objet a changé ailleurs, c'est un conflit présenté par S6.3 |
| Q4 | Interrogation périodique du journal par PostgREST, intervalle en constante nommée. Voie recommandée par S6.0 |
| Q5 | Codes de validation existants, portant en paramètre les identifiants des commandes en cause. Aucun code nouveau |
| Q6 | Tables d'habillage créées selon E9.3, plus deux colonnes sur `decoration_shape` : `z_order int` et `style jsonb`, rôles seulement, aucune couleur |
| Q7 | Identifiant de forme : un `uuid` tiré par l'appelant à la création. Le rejeu reste déterministe, l'identifiant étant inscrit dans la commande |

Décisions du même jour sur les obstacles de S6.6b :

| Question | Décision |
| --- | --- |
| Q9 | Le lot d'authentification passe d'abord : connexion au poste et identité tirée du jeton, à la place de `session-identity.ts`. Préalable à S6.4, S6.6b et S6.7 |
| Q10 | La décision Q7 s'étend à tout l'atelier : `newId` tire un `uuid` aléatoire. Le rejeu reste déterministe, l'identifiant étant inscrit dans la commande |
| Q11 | Un essai sur base réelle par famille de commande, sur une base jetable, avant de brancher l'atelier sur le chemin journalisé |

Décisions d'Oss53pa du 22 novembre 2026, sur les obstacles de S6.7b :

| Question | Décision |
| --- | --- |
| Q12 | Le nom affiché vient d'une colonne `display_name` sur `membership`, par organisation, saisie par l'administrateur (AUTH.7). Vide : seul le rôle s'affiche. Rien n'est lu dans `auth.users` |
| Q13 | La sélection d'un collègue est une liste bornée de références `{table, id}` ; sa zone de travail, le rectangle de son cadrage en mètres du repère du niveau (x, y, largeur, hauteur). Les deux sont validés par schéma en base |
| Q14 | La barre d'état hors fenêtre se corrige dans un lot à part (F5.1), avant S6.7b |

La durée d'expiration du verrou (Q2) et l'intervalle d'interrogation (Q4) sont
des constantes nommées sans origine normative. Leurs valeurs initiales se
fixent au lot qui les emploie et se mesurent selon D13.

## 4. Questions à trancher avant développement (A2.2)

**Q1. Modèle de données, A2.2 cas 2.** S6 n'a aucune table : ni journal de
commandes, ni verrou, ni présence. S9 n'en ajoute pas. Il faut décider si ces
trois notions sont persistées, et sous quelle définition en A5.

**Q2. Nature du verrou ferme, A2.2 cas 3.** S-20 dit « verrouillé fermement »
et ne dit ni la durée d'expiration, ni si le passage en force de G4.2 subsiste.
Trois passages disent le contraire de S-20 sans avoir été mis à jour :

- T-1.16, acceptation : « Aucun verrou ne bloque sans recours » ;
- O, départ d'un collaborateur : « Ses verrous consultatifs tombent » ;
- G4.2 : « Aucun verrou dur ».

La valeur de 15 minutes de G4.2 est fixée pour un verrou consultatif. Rien ne
dit qu'elle vaut pour un verrou ferme.

**Q3. Annulation et propagation, A2.2 cas 3.** E5.3 vide la pile à la
synchronisation. Une propagation est-elle une synchronisation au sens de E5.3 ?
Si oui, l'annulation disparaît en pratique dès que deux personnes travaillent.
Si non, il faut dire quelles entrées restent annulables quand une commande
distante a touché le même objet.

**Q4. Transport, A2.2 cas 4.** Le studio n'a aucun client de diffusion.
L'exploration S6.0 compare trois voies. Seul le service de diffusion de
Supabase exige une bibliothèque nouvelle. Le relais de `LISTEN` ajoute un point
d'entrée exposé. L'interrogation périodique du journal n'exige ni l'un ni
l'autre, et c'est la voie recommandée. Le choix reste à Oss53pa.

**Q5. Code d'anomalie, A2.2 cas 3.** S-21 exige de nommer les commandes en
cause, et S10 n'ajoute aucun code pour cela. Faut-il un code dédié, ou les
codes de validation existants portant les identifiants de commandes en
paramètre ?

**Q6. Habillage absent de la base, A2.2 cas 2.** `decoration_layer` et
`decoration_shape` sont définies en E9.3 et attribuées au module 01 par L3.
Elles n'ont pourtant aucune migration, et ne figurent pas dans `OWNED_TABLES`.
Une commande d'habillage n'a donc aucune ligne à viser. Faut-il créer ces
tables, dans un lot distinct de S6 ?

**Q7. Écarts entre l'éditeur et E9.3, A2.2 cas 2.** Trois points du document
d'habillage n'ont pas de colonne en E9.3 :

- l'ordre de superposition des formes, que l'éditeur tient pour le site entier
  et que `decoration_shape` ne porte pas ;
- le style de forme (remplissage, trait, épaisseur, opacité), réduit à
  `style_role` en E9.3 ;
- l'identifiant de forme, dérivé du document (`dec-1`, `dec-2`…) pour le
  déterminisme (E4.4). Deux postes qui créent une forme en même temps
  dérivent le même identifiant : en édition simultanée, il y a collision. La
  base attend en outre un `uuid`.

Le troisième point oppose le déterminisme d'E4.4 à l'unicité qu'exige S6.

**Q8. Code de la commande périmée, levée sans code nouveau.** Un code ne
pouvait pas entrer au dépôt : `tests/catalogue-consolide.test.ts` lit le cahier
et refuse tout code qui n'y figure pas. S6.3 ne lève donc pas d'anomalie pour
une commande périmée. Il rend un résultat de conflit, état inchangé, portant
la version courante et la commande reçue, conformément à L4.4 : « les conflits
réels sont arbitrés par l'utilisateur avec les deux versions présentées ». Un
conflit n'est pas une entrée invalide au sens de A7 : la commande est bien
formée, l'objet a changé. Si l'éditeur veut tout de même un code, par exemple
pour journaliser les conflits, la proposition `EDIT.COMMAND_STALE` reste
valable.

---

## 5. Défauts du document relevés (A0, document unique)

Signalés à l'éditeur. Aucune des deux versions n'est appliquée en attendant.

1. **S-23 renvoie à « la section G8 » pour le hors ligne.** G8 est le catalogue
   des codes d'anomalie. Le hors ligne est traité en L4.4 et E5.3.
2. **Le registre K liste l'édition simultanée comme « exclue définitivement,
   présence et verrou consultatif à la place ».** S6 lève cette exclusion.
3. **E19, point 4, la déclare « hors périmètre ».** Même contradiction.
4. **T-1.16, O et G4.2 contre S-20**, voir Q2.
5. **Décisions d'Oss53pa qui s'écartent de la lettre du cahier**, à reporter
   par l'éditeur :
   - Q2 contredit G4.2 (« Aucun verrou dur ») et l'acceptation de T-1.16
     (« Aucun verrou ne bloque sans recours ») ; le recours restant est
     l'expiration ;
   - Q3 précise E5.3 : une propagation n'est pas une synchronisation qui vide
     la pile ;
   - Q6 ajoute deux colonnes à `decoration_shape`, absentes d'E9.3 ;
   - Q1 crée trois tables absentes de A5 et de S9.

---

## 6. Ce que cette note ne fait pas

Elle ne donne aucune durée (G1.1, G10 point 1). Elle ne tranche elle-même
aucune question : les réponses de la section 3 bis sont celles d'Oss53pa.
