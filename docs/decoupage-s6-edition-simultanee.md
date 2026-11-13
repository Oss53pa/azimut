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
| S6.0 | Exploration bornée du transport de propagation | S | — | compatibilité avec l'installation autonome (A3.4) | Bloqué, Q4 |
| S6.1 | Modèle de commande unique, propageable | M | — | écart réel entre les deux modèles | Prêt |
| S6.2 | Journal des commandes validées en base | L | S6.1 | ordre total par niveau, cloisonnement | Bloqué, Q1 |
| S6.3 | Moteur d'application des commandes distantes | M | S6.1 | refus d'une commande périmée sans fusion | Prêt |
| S6.4 | Verrou ferme, en base | M | S6.2 | autorisation en base, pas seulement à l'écran | Bloqué, Q1, Q2 |
| S6.5 | Revalidation après propagation et barrière | M | S6.3 | coût de la revalidation à chaque commande | Bloqué, Q5 |
| S6.6 | Diffusion en direct | M | S6.0, S6.2 | reprise après coupure sans perte ni doublon | Bloqué, Q4 |
| S6.7 | Présence, sélection, zone de travail | M | S6.6 | nature éphémère ou persistée | Bloqué, Q1 |
| S6.8 | Annulation en présence de commandes distantes | M | S6.3 | articulation avec E5.3 | Bloqué, Q3 |
| S6.9 | Session hors ligne et retour | L | L4.4, S6.3 | dépend d'un lot non construit | Bloqué, L4.4 |
| S6.10 | Essai de convergence à deux clients | M | S6.2 à S6.7 | instance autonome en intégration continue | Après les autres |

### S6.0 Exploration du transport

Livrable : une note, pas du code (G1.2). Elle compare les voies disponibles
dans la distribution autonome : le service de diffusion de l'installation
Supabase autonome, ou une écoute de la base relayée par le service existant.
Elle mesure pour chacune la reprise après coupure, l'ordre de livraison et le
cloisonnement par organisation, puis demande l'arbitrage. Elle ne choisit pas.

### S6.1 Modèle de commande unique

S-19 propage « les commandes validées de E5.1 ». Deux formes coexistent
aujourd'hui ; une seule peut circuler. Le lot rapproche `Command` de
`EntityCommand`, qui porte déjà l'organisation, la table, le module émetteur
et le contrôle de propriété. Il ajoute ce que la propagation exige : un
identifiant de commande fourni par l'appelant et la version de l'objet sur
laquelle la commande a été validée. Ces deux champs ne touchent pas la base.

Acceptation : toute commande émise par l'éditeur se sérialise puis se
désérialise à l'identique, et son inverse reste calculable.

### S6.2 Journal des commandes validées

Table en insertion seule, cloisonnée par ligne, ordonnée par niveau. Elle sert
la propagation, la revalidation qui nomme les commandes en cause (S-21) et
l'arbitrage hors ligne. **Aucune table de ce type n'existe en A5 ni en S9.**

### S6.3 Moteur d'application des commandes distantes

Fonction pure : état courant plus commande distante donnent un nouvel état ou
un refus. Une commande dont la version d'origine ne correspond plus à l'état
est refusée, jamais fusionnée (concurrence optimiste au niveau de l'objet,
L4.4). Sans horloge, sans réseau, sans tirage aléatoire (A9).

Acceptation : deux clients qui reçoivent les mêmes commandes dans le même ordre
produisent des états strictement identiques. Une commande périmée est refusée
et l'état reste inchangé.

### S6.4 Verrou ferme

Remplace le verrou consultatif de `object-lock.ts` pendant une session
d'édition simultanée. Le refus doit avoir lieu en base, sinon un second client
qui contourne l'interface passe outre. C'est la règle permanente d'autorisation
en base.

### S6.5 Revalidation après propagation

Rejoue `validateGraph` après chaque commande appliquée. En cas d'incohérence,
la publication est bloquée par `publish-gate.ts` et les commandes en cause sont
nommées. Le coût d'une validation complète à chaque commande est à mesurer
selon le protocole D13 avant de retenir une validation incrémentale.

### S6.6 Diffusion en direct

Branche le transport retenu en S6.0 sur le journal S6.2. Exigences : aucune
commande perdue ni appliquée deux fois après une coupure, et aucune commande
d'une autre organisation reçue, testé comme un canal indirect de fuite au même
titre que les autres essais d'étanchéité.

### S6.7 Présence

Utilisateurs présents sur le niveau, leur sélection et leur zone de travail.
Couvre au passage la présence de G4.2, jamais construite.

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

S6.1 et S6.3 peuvent commencer sans aucune décision. Tout le reste attend au
moins une réponse de la section 4. S6.9 attend en plus L4.4.

---

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

**Q4. Transport, A2.2 cas 4.** Le studio n'a aucun client de diffusion. Toute
voie de propagation en direct demande soit une bibliothèque nouvelle, soit un
protocole implanté à la main. L'exploration S6.0 prépare ce choix, elle ne le
fait pas.

**Q5. Code d'anomalie, A2.2 cas 3.** S-21 exige de nommer les commandes en
cause, et S10 n'ajoute aucun code pour cela. Faut-il un code dédié, ou les
codes de validation existants portant les identifiants de commandes en
paramètre ?

---

## 5. Défauts du document relevés (A0, document unique)

Signalés à l'éditeur. Aucune des deux versions n'est appliquée en attendant.

1. **S-23 renvoie à « la section G8 » pour le hors ligne.** G8 est le catalogue
   des codes d'anomalie. Le hors ligne est traité en L4.4 et E5.3.
2. **Le registre K liste l'édition simultanée comme « exclue définitivement,
   présence et verrou consultatif à la place ».** S6 lève cette exclusion.
3. **E19, point 4, la déclare « hors périmètre ».** Même contradiction.
4. **T-1.16, O et G4.2 contre S-20**, voir Q2.

---

## 6. Ce que cette note ne fait pas

Elle ne donne aucune durée (G1.1, G10 point 1). Elle ne tranche aucune des
questions de la section 4. Elle n'autorise aucun lot bloqué à commencer.
