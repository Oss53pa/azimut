# Consigne de travail
## Azimut, tache T-2.14a : empreinte de contenu et versions de support

Cette consigne suit le format de la partie B du cahier des charges. Les regles de conduite de la section A2 s'appliquent integralement.

---

## 0. Avant toute chose

Pousse le commit 9ab88f0.

C'est independant de la suite. Un commit dont les quatre verifications passent n'a pas a rester en local, et le garder ne protege rien.

---

## 1. Objectif

Implementer le calcul de l'empreinte de contenu d'une face, et le cycle de vie des versions de support qui en decoule.

A l'issue, le systeme sait dire exactement quelles faces sont perimees apres une modification de donnee, et lesquelles ne le sont pas.

C'est le mecanisme qui fonde la promesse d'exploitation du produit. Sa valeur tient entierement a sa precision : une empreinte trop large marque tout comme perime, une empreinte trop etroite laisse passer des supports faux.

---

## 2. Perimetre

**Dans le perimetre**

- `packages/core-model` : fonction de serialisation canonique, fonction d'empreinte.
- `packages/engine-layout` : calcul de `content_hash` a partir d'une face resolue.
- `packages/db` : migration des colonnes et contraintes de `support_version`, machine a etats.
- Tests unitaires et d'integration correspondants.

**Hors perimetre, a ne pas toucher**

- `composeFace` et sa chaine de resolution de contenu. Voir la section 7.
- Toute autre table que `support_version`.
- Toute optimisation, harmonisation ou correction reperee au passage.

---

## 3. Composition de l'empreinte

### 3.1 Ce qui entre dans `content_hash`

Rien d'autre que ces sept elements :

1. Le contenu resolu de la face, bloc par bloc, dans l'ordre des blocs.
2. La cle du gabarit et sa version.
3. L'identifiant de la charte et sa version.
4. La cle du paquet de regles et sa version.
5. Les langues actives de la face, triees.
6. Les dimensions calculees, largeur et hauteur en millimetres entiers.
7. Les identifiants des pictogrammes references, tries.

### 3.2 Ce qui n'entre pas

A exclure explicitement, et un test doit le prouver :

- L'identifiant du support et celui de la face.
- Tout horodatage, quel qu'il soit.
- L'auteur, le validateur, tout identifiant d'utilisateur.
- Le numero de version.
- Le chemin de stockage d'un artefact.
- L'etat de la version.
- L'ordre d'implantation, l'azimut, la distance de lecture. Ils influencent les dimensions calculees, qui sont deja dans l'empreinte ; les inclure en plus ferait varier l'empreinte sans que le contenu change.

### 3.3 `inputs_hash`, a ne pas confondre

`inputs_hash` sert a l'invalidation du cache de parcours. Il porte les noeuds, aretes et liaisons verticales du site, plus la definition du profil. Ni destinations, ni supports, ni chartes.

Les deux empreintes ne partagent aucune donnee et ne doivent pas partager de code au-dela de la fonction de serialisation canonique.

---

## 4. Serialisation canonique

C'est la partie ou une decision implicite casse tout. Elle est donc entierement specifiee, il n'y a rien a choisir.

1. Format JSON, encodage UTF-8, aucun espace, aucun retour a la ligne.
2. Cles d'objet triees par ordre lexicographique de points de code.
3. Un champ absent est omis. **Jamais de valeur nulle, jamais de chaine vide en remplacement d'une absence.** Deux etats equivalents doivent produire la meme chaine.
4. Les tableaux ordonnes par le metier conservent leur ordre, blocs d'une face par exemple. Les ensembles sans ordre metier sont tries par identifiant, pictogrammes et langues par exemple.
5. Nombres au format fixe, jamais en notation exponentielle. Dimensions en entiers. Toute autre valeur decimale a trois decimales, arrondie par la fonction d'arrondi unique de `core-model`.
6. Le zero negatif est interdit en sortie, il est converti en zero.
7. Les chaines sont normalisees en forme NFC avant hachage. Les accents du francais peuvent etre encodes de deux manieres, ce qui produirait deux empreintes pour un meme texte.
8. Booleens en `true` et `false`, jamais en 0 et 1.
9. Algorithme SHA-256, restitue en hexadecimal minuscule, prefixe `sha256:`.

---

## 5. Machine a etats de `support_version`

Les transitions non listees sont interdites et levent une erreur.

| De | Vers | Declencheur | Effet |
| --- | --- | --- | --- |
| `draft` | `draft` | Modification | Recalcule `content_hash` |
| `draft` | `in_review` | Emission d'une epreuve | Fige le contenu et l'empreinte |
| `in_review` | `draft` | Rejet | Motif obligatoire |
| `in_review` | `approved` | Approbation | Ecrit une ligne d'approbation |
| `approved` | `superseded` | Nouvelle version approuvee | Automatique |

Regles complementaires :

- Une version `approved` n'est jamais modifiable. Une correction cree une nouvelle version.
- La table des approbations est en insertion seule, garanti au niveau de la base et non par convention applicative. Une tentative de modification ou de suppression echoue meme avec le role d'administration.
- Une version `in_review` ou `approved` conserve son empreinte figee. Elle ne se recalcule pas.
- Une face dont le `content_hash` recalcule differe de celui de la derniere version `approved` est **perimee**. C'est un etat derive, jamais stocke.

---

## 6. Criteres d'acceptation

Chacun se verifie par un test, pas par une appreciation.

1. **Determinisme.** La meme face serialisee deux fois produit la meme chaine, octet pour octet, et la meme empreinte.
2. **Independance a l'ordre d'insertion.** Une face construite en inserant ses pictogrammes dans un ordre, puis dans l'autre, produit la meme empreinte.
3. **Exclusions effectives.** Modifier l'identifiant du support, l'horodatage, l'auteur, le numero de version ou l'etat ne change pas l'empreinte. Un test par element exclu.
4. **Sensibilite.** Modifier le contenu d'un bloc, la version de la charte, la version du paquet de regles, une langue active, une dimension calculee ou un pictogramme change l'empreinte. Un test par element inclus.
5. **Absence contre valeur nulle.** Une face dont un champ optionnel est absent et une face dont ce champ vaut null produisent la meme empreinte.
6. **Normalisation des accents.** Deux ecritures Unicode equivalentes d'un meme libelle accentue produisent la meme empreinte.
7. **Precision de la peremption, critere principal.** Sur un site de reference, modifier une destination et verifier que le nombre de faces marquees perimees est exactement celui attendu, ni plus ni moins. Le test doit echouer si une face non concernee est marquee.
8. **Machine a etats.** Chaque transition autorisee passe, chaque transition non listee leve une erreur avec un code stable.
9. **Insertion seule.** Une tentative de modification et une tentative de suppression d'une ligne d'approbation echouent au niveau de la base, avec le role d'administration.
10. **Empreinte figee.** Une version `approved` conserve son empreinte apres modification des donnees sources.

---

## 7. Ce que tu ne fais pas dans cette tache

**Ne fais pas le rewire de `composeFace`.**

Motif, et il est structurel : le tableau des messages s'intercale entre le graphe et la composition. `composeFace` consommera `message_line`, pas `content_block` directement. Le mapping que tu demandes n'existe pas encore parce que le modele intermediaire n'est pas arrete.

Construire le rewire maintenant reviendrait a le refaire. Tu as d'ailleurs raison de relever qu'aucun producteur de lignes d'instance n'existe : c'est la consequence du meme manque, pas un oubli.

Porte le point en « constate, non traite » et n'y touche pas.

---

## 8. Cas limites a couvrir

- Face sans aucun bloc.
- Face dont tous les blocs sont vides.
- Face a une seule langue active alors que le site en declare deux.
- Libelle tres long, et libelle contenant des caracteres accentues, des apostrophes et des espaces insecables.
- Dimensions calculees nulles ou negatives, qui doivent lever une erreur avant le calcul d'empreinte plutot que produire une empreinte.
- Paquet de regles absent : l'empreinte ne se calcule pas, une anomalie bloquante est levee.
- Deux faces d'un meme support, contenus identiques, gabarits differents : empreintes differentes.
- Deux faces de supports differents, tout identique : empreintes identiques. C'est voulu, l'identifiant du support est exclu.

---

## 9. Rapport attendu

Format de la section A2.6, sans abreviation :

```
Tache : T-2.14a
Fait : <liste des changements reels>
Fichiers touches : <liste>
Verifications : <sortie reelle de pnpm typecheck, lint, test, test:visual>
Constate, non traite : <inclut le rewire composeFace>
Decisions prises : <liste ou "aucune">
Non verifie : <liste ou "rien">
```

La sortie reelle des quatre commandes, pas un resume. Une tache annoncee terminee sans que les tests aient tourne est la faute la plus grave prevue par ce cahier des charges.
