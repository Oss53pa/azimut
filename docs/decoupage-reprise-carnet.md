# Reprise d'un carnet de supports existant (T-1.13)

Note de travail, ouverte le 27 novembre 2026. Elle ne fait pas foi : le cahier
des charges consolidé (`docs/cahier-des-charges.md`) seul fait foi.

## Le constat

T-1.13 et D4.1 décrivent l'import d'un carnet tableur. Le moteur
(`importSupports`) lisait le fichier, mais rien ne menait à une écriture.
En les reliant aux tables de A5, des trous du modèle sont apparus : le cahier
ne dit pas où ranger une partie de ce qu'une ligne du carnet porte, ni quel
module crée une ligne `support`.

## Décisions d'Oss53pa (A2.2, cas 2)

| Question | Décision |
| --- | --- |
| QI1 | Une ligne qui donne une position x/y mais aucun nœud reste en attente au rapport, sans être écrite. Aucune donnée n'est inventée |
| QI2 | Le contenu constaté (`content_fr`, `content_en`) reste au rapport ; il n'est pas stocké |
| QI3 | L'état et la date de pose vont dans `installed_support`. Corrigée le 28 novembre : la version de pose reste vide, « posé avant Azimut, version inconnue », la base refusant 0 (`installed_version >= 1`, 0047) ; aucune migration |
| QI4 | La photographie est un lot à part, qui commence par le choix du stockage (A3.4) |
| QI5 | Le module 02 (wayfinding) crée la ligne `support`, identité comprise ; les cotes viennent par une commande du module 04, dans le même geste |
| QI6 | `support.kind`, colonne de 0006 que A5.6 ne nomme pas, devient facultative (migration 0087) ; rien ne l'écrit plus |
| QI7 | `support.registry` est écrit par le module 02 |

Dans l'esprit de QI1, et sans question nouvelle : un azimut absent laisse la
ligne en attente, la base y mettant 0 ; une date de pose absente n'écrit pas de
ligne `installed_support`, la base y mettant l'instant de l'import. Le registre
n'est pas écrit à l'import : la typologie ne le porte pas encore
(`support_typology.registry`, colonne spécifiée et absente du schéma). Le
substrat reste au rapport, sa colonne n'existant pas non plus.

## Fait le 28 novembre 2026

- `state/carnet-import.ts` : chaque ligne du fichier confrontée au site
  (typologie, bâtiment, niveau, nœud et son niveau, code déjà porté, typologie
  ambiguë), puis les commandes des lignes prêtes.
- `state/carnet-file.ts` : le fichier vérifié sur ses octets avant tout
  calcul (taille bornée, UTF-8 strict, aucun octet nul).
- `views/supports/CarnetImportPanel.tsx` : le panneau de l'écran des
  supports, rapport ligne à ligne et import des lignes prêtes par l'émetteur
  journalisé de la coquille.
- `buildCommand` laisse le module 02 écrire l'identité d'un support à la
  création, et lui seul (`SUPPORT_CREATOR`).
- `importSupports` écrivait `dimensions_source: 'default'`, que la base refuse :
  la valeur de A5.6 est `computed`.

Éprouvé : 16 essais purs (`carnet-import`, `carnet-file`,
`l0-support-creation`), un essai sur base par PostgREST et le journal
(`t-1-13-carnet.db`), deux de bout en bout (`t-1-13-reprise-carnet.spec`).

## À signaler à l'éditeur

- L0 ne dit pas quel module crée une ligne `support` (QI5).
- `support.kind` existe en base et n'est pas en A5.6 (QI6).
- `support.registry` n'avait pas de propriétaire (QI7).
- D4.1 porte un contenu constaté qu'aucune table ne reçoit (QI2).
- `installed_version` est requise par A5.7 et ne peut pas l'être pour un
  support posé avant le logiciel (QI3).
- La typologie appartient à l'organisation, sans clé unique : une clé portée
  deux fois rend la ligne ambiguë, et elle est refusée.
