# Complément au cahier des charges de développement
## Azimut, partie N, second fichier. Modules 05 à 12

Éditeur : Atlas Studio

Suite de la partie N. Profondeur au niveau de la règle et de la frontière, conformément à N0.

---

# Module 05. Régie publicitaire

## N5.1 Rôle et frontière

Commercialiser les emplacements publicitaires d'un site, du recensement à la facture.

**Frontière ferme, à porter au contrat.** Azimut émet les factures et les états de vente. Il n'est jamais le livre comptable. Il exporte vers la comptabilité du client, et ne tient ni grand livre, ni déclaration fiscale, ni rapprochement bancaire. Franchir cette ligne obligerait à suivre les réglementations fiscales de chaque pays de vente.

**Seconde frontière.** Inventaire et planning des écrans numériques, jamais la diffusion, confiée à un système tiers.

## N5.2 Règles métier

**R1.** Un emplacement publicitaire est un objet distinct d'un support de signalétique, même s'il partage la géométrie du site. Il n'entre dans aucun quantitatif de signalétique.

**R2.** La tarification s'indexe sur l'exposition calculée par le module 03. Sans ce module, la grille est saisie à la main et l'écran le signale.

**R3.** Une option porte une date d'expiration. Elle tombe seule, sans intervention.

**R4.** Un emplacement ne peut pas être réservé deux fois sur des périodes qui se recoupent.

**R5.** Tout visuel reçu est assaini avant stockage, selon les règles d'import d'actifs déjà posées. Un visuel non assaini n'est jamais rendu.

**R6.** Les contrôles techniques sont automatiques : format, résolution, zone de sécurité, profil colorimétrique, poids. Les contrôles de fond sont déclaratifs et validés par un humain : conformité au règlement du site, contenu interdit, mentions légales.

**R7.** Les règles publicitaires applicables viennent d'une extension du paquet de règles, enfichable, versionnée, refusée sans référence documentaire. En son absence, le module produit une anomalie et n'invente aucune règle.

**R8.** Le rendu en situation compose le visuel reçu sur la vue du plan, à l'emplacement et à l'échelle réels. Il porte une mention d'aperçu, jamais présenté comme une épreuve.

**R9.** Une facture n'est jamais créée par un événement. Elle naît d'une décision humaine.

## N5.3 Contrôles

`AD.PLACEMENT_DOUBLE_BOOKED`, `AD.CREATIVE_SPEC_MISMATCH`, `AD.OPTION_EXPIRED`, `AD.RULES_PACK_MISSING`, `ASSET.SANITIZATION_FAILED`.

## N5.4 Écrans

Inventaire des emplacements, fiche technique, planning d'occupation, contrats, réception des visuels, rendu en situation, espace annonceur.

L'espace annonceur porte l'identité du site, jamais celle d'Azimut, et n'expose ni les données du site ni celles des autres annonceurs.

## N5.5 Intégration

Lit : géométrie du socle, exposition du module 03, paquet de règles publicitaires. Produit : fiches techniques, planning, factures, états de vente. Consommé par : 09, 10.

## N5.6 Critères d'acceptation

1. Deux réservations qui se recoupent sont refusées avec leur code.
2. Un visuel non conforme à la fiche technique est refusé, chaque critère testé séparément.
3. Un visuel non assaini ne peut pas être rendu.
4. Une facture ne peut pas être créée par un traitement automatique, vérifié par un test.
5. L'espace annonceur ne laisse fuir aucune donnée d'un autre annonceur, test d'étanchéité dédié.

## N5.7 Ouvert

Le corpus réglementaire publicitaire par pays. Mécanisme prêt, contenu absent.

---

# Module 06. Enseignes locataires

## N6.1 Rôle et frontière

Instruire et suivre les projets de devanture au regard du règlement d'enseigne.

**Frontière ferme.** Une enseigne locataire appartient au locataire. Elle est instruite et suivie, jamais conçue par Azimut. Elle n'est pas un support et n'entre dans aucun quantitatif.

## N6.2 Règles métier

**T1.** Le règlement d'enseigne est exprimé en règles contrôlables : hauteurs, débords, matériaux, éclairage, plages horaires, interdits.

**T2.** Ce qui est mesurable est contrôlé automatiquement. Le reste fait l'objet d'un avis humain, et la distinction est visible.

**T3.** Un refus est motivé. Un accord peut porter des réserves, qui se lèvent explicitement.

**T4.** L'historique par cellule survit au changement de locataire.

**T5.** Un constat de conformité après pose clôt le dossier, avec photographie.

## N6.3 Contrôles

`TENANT.RULE_VIOLATION`, plus les contrôles d'assainissement des pièces déposées.

## N6.4 Écrans

Règlement, dossiers déposés, instruction, constat de conformité, historique par cellule.

## N6.5 Intégration

Lit : destinations et géométrie du socle. Consommé par : 08 pour l'historique.

## N6.6 Critères d'acceptation

1. Un projet non conforme sur un critère mesurable est refusé automatiquement, avec le critère nommé.
2. Un accord sans levée de réserve ne clôt pas le dossier.
3. L'historique survit à deux changements de locataire sur la même cellule.

---

# Module 07. Chantier et pose

## N7.1 Rôle et frontière

Conduire la fabrication et la pose, de l'approbation au constat.

C'est le module qui comble le vide entre le bon à tirer approuvé et le support posé. Sans lui, les divergences sont détectées sans que leur origine soit connue.

## N7.2 Règles métier

**C1.** Un lot de fabrication ne peut contenir que des versions approuvées. Une version en revue bloque la constitution du lot.

**C2.** Un prestataire n'accède qu'aux exécutions du lot qui lui est rattaché. C'est le rôle le plus contraint du produit et il fait l'objet de tests dédiés.

**C3.** Une réception peut porter des réserves. Une réserve non levée est visible jusqu'à sa levée, et bloque la clôture du lot.

**C4.** Le constat de pose crée le support posé et fixe la version installée. C'est ce qui donne une origine connue à toute divergence ultérieure.

**C5.** Un procès-verbal de pose porte une photographie. Sans elle, il n'est pas valide.

## N7.3 Contrôles

`INSTALL.RESERVATION_OPEN`, plus un code à ajouter pour un lot contenant une version non approuvée.

## N7.4 Écrans

Allotissement, ordres de fabrication, planning de pose, procès-verbaux, réserves.

## N7.5 Intégration

Lit : versions approuvées et exécutions du module 04. Produit : supports posés. Consommé par : 08, 09.

Dégradation : sans ce module, saisie manuelle des poses dans le module 08, origine des divergences inconnue.

## N7.6 Critères d'acceptation

1. Un lot contenant une version non approuvée est refusé.
2. Un prestataire ne voit aucune exécution hors de son lot, y compris par canal indirect.
3. Une réserve non levée empêche la clôture.
4. Le constat de pose crée bien le support posé avec la bonne version.

---

# Module 08. Exploitation et maintenance

## N8.1 Rôle et frontière

Maintenir le parc en condition, et détecter l'écart entre le conçu et le posé.

C'est le module qui fonde la logique d'abonnement. Sans lui, le produit redevient un outil de conception vendu au projet.

## N8.2 Règles métier

**E1.** L'état conçu et l'état physique installé sont deux objets distincts. Les confondre supprime toute possibilité de détecter une divergence.

**E2.** Une divergence est typée et datée. Elle ne disparaît jamais sans trace : elle se résout par un constat de pose conforme, ou s'accepte par une décision explicite tracée.

**E3.** Un ordre de travaux naît d'une décision humaine. Aucun événement ne le crée.

**E4.** Une tournée d'inspection fonctionne hors ligne, en application web installable, sans application native.

**E5.** Un relevé porte une photographie et une position dans le plan.

## N8.3 Contrôles

Les six types de divergence de la partie H, plus `SURVEY.SYNC_PENDING`.

## N8.4 Écrans

Tournées, relevé mobile hors ligne, incidents, divergences, ordres de travaux, état du parc.

## N8.5 Intégration

Lit : versions et empreintes du module 04, constats du module 07. Produit : divergences, ordres de travaux, indicateurs. Consommé par : 09, 10.

## N8.6 Critères d'acceptation

1. Une modification d'annuaire crée exactement les divergences attendues, ni plus ni moins.
2. Une divergence acceptée conserve sa trace.
3. Une tournée complète se réalise sans réseau et se synchronise sans perte.
4. Aucun ordre de travaux n'est créé automatiquement, vérifié par un test.

---

# Module 09. Budget et estimation

## N9.1 Rôle et frontière

Chiffrer et suivre. Le module ne décide rien, il valorise.

## N9.2 Règles métier

**B1.** Un coût de référence est historisé. Le remplacer n'efface pas le précédent, sans quoi aucune comparaison dans le temps n'est possible.

**B2.** Multi-devises, avec la devise portée par la ligne et jamais supposée.

**B3.** Une estimation porte la date et la version des coûts de référence utilisés.

**B4.** L'écart entre estimé, engagé et réalisé est toujours affiché ensemble. Un chiffre seul induit en erreur.

**B5.** Le coût de reprise sur mutation ne valorise que les supports réellement périmés, selon l'empreinte de contenu.

## N9.3 Contrôles

`COST.REFERENCE_MISSING`, plus un code pour une devise absente.

## N9.4 Écrans

Coûts de référence, estimation, suivi budgétaire, coût de reprise.

## N9.5 Intégration

Lit : quantitatif du module 04, lots du 07, ordres de travaux du 08, contrats du 05, exposition du 03.

Dégradation : absent, le quantitatif reste produit sans valorisation.

## N9.6 Critères d'acceptation

1. Une estimation se rejoue à l'identique avec la même version de coûts.
2. Le coût de reprise porte sur le nombre exact de supports périmés.
3. Un changement de coût de référence n'altère pas une estimation déjà émise.

---

# Module 10. Portefeuille

## N10.1 Rôle

Vue et consolidation multi-sites pour une organisation qui en gère plusieurs.

## N10.2 Règles métier

**F1.** Une bibliothèque de portefeuille est héritée par les sites. Un site peut y déroger, la dérogation est explicite et visible.

**F2.** Une charte de groupe suit la même logique d'héritage et de dérogation.

**F3.** La consolidation ne franchit jamais la frontière d'organisation.

**F4.** Une comparaison entre sites porte sur des indicateurs de même définition et de même date, ou elle ne se fait pas.

## N10.3 Écrans

Vue multi-sites, comparaison, bibliothèques partagées, consolidation budgétaire.

## N10.4 Critères d'acceptation

1. Une modification d'une bibliothèque de portefeuille se propage aux sites non dérogataires, et à eux seuls.
2. Aucune donnée d'une autre organisation n'apparaît, y compris dans un agrégat.

---

# Module 11. Fonctions transverses

## N11.1 Rôle

Ce dont tous les modules ont besoin : documents, recherche, notifications, tâches, journal d'activité, tableau de bord.

## N11.2 Règles métier

**X1.** La recherche globale n'expose jamais une entité d'un module non souscrit ni d'une organisation tierce. Test dédié.

**X2.** Une pièce jointe est versionnée et rattachée à une entité, jamais flottante.

**X3.** Les notifications sont réglables par utilisateur. Une notification non réglable devient du bruit et fait ignorer les autres.

**X4.** Le journal d'activité visible par l'utilisateur est distinct du journal d'audit technique, qui reste en insertion seule.

**X5.** Un tableau de bord montre ce qui attend l'utilisateur dans son rôle. Jamais une collection d'indicateurs décoratifs.

## N11.3 Critères d'acceptation

1. La recherche ne remonte rien d'un module non souscrit, ni d'une autre organisation.
2. Une pièce jointe survit à trois versions successives, chacune consultable.
3. Le journal d'audit résiste à une tentative de modification avec le rôle d'administration.

---

# Module 12. Atelier de dessin

## N12.1 Rôle et frontière

Surface d'édition commune des modules 01, 02, 04 et 05. Il ne possède aucune donnée métier.

Spécifié en parties E, I et J. Cette fiche récapitule les règles opposables.

## N12.2 Règles métier

**A1.** Trois contextes d'édition, jamais confondus : géométrie et habillage librement éditables, gabarits édités visuellement mais produisant une donnée, faces de supports non éditables.

**A2.** L'atelier n'écrit jamais directement en base. Il appelle les commandes du module propriétaire. C'est ce qui empêche la règle de propriété unique d'être contournée par l'interface.

**A3.** L'encre est une méthode de saisie, pas une donnée. La forme reconnue est quantifiée au millimètre, le tracé disparaît. Deux exceptions cantonnées : la couche d'esquisse et l'annotation de révision.

**A4.** Toute opération est quantifiée à la validation du geste, jamais pendant, jamais au rendu.

**A5.** Toute opération réalisable au pointeur l'est au clavier, y compris le dessin.

**A6.** La pile d'annulation est vidée à la synchronisation. Revenir sur une modification synchronisée se fait par une commande inverse tracée.

**A7.** Aucune bibliothèque tierce de dessin, de diagramme ou de gestion d'état.

**A8.** Le tracé libre au doigt est exclu. La pression et l'inclinaison ne servent que la couche d'esquisse.

**A9.** Le budget de rendu est mesuré à l'exécution. Le mode allégé change la façon de dessiner, jamais le résultat.

## N12.3 Critères d'acceptation

1. Une forme tracée au stylet et la même saisie au clavier produisent des données identiques.
2. Une esquisse n'apparaît dans aucun export destiné à un tiers, contrôle automatisé.
3. Une opération interdite dans son contexte est refusée avec son code.
4. Le mode allégé et le mode complet produisent le même état final après la même séquence.

---

# N13. Ce que cette partie ne couvre pas

1. **Les écrans, sauf ceux de la partie M.** Les autres se conforment aux onze règles de M7 et seront spécifiés en entrant dans leur incrément.
2. **Le tableau des messages, au champ près.** C'est la spécification d'écran qui vient ensuite, et celle qui débloque la composition.
3. **Les champs des modules 05 à 11.** Volontairement non descendus au champ, conformément à N0.
4. **Les droits de rôle module par module.** Les six rôles sont définis, leur déclinaison fine reste à faire au moment de construire chaque module.
5. **Le chiffrage.** Cette partie ne modifie pas le périmètre, elle le précise. La décomposition de la partie I reste valable.
