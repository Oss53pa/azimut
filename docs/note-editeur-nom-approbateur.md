# Note à l'éditeur du cahier : le nom de l'approbateur d'un tableau des messages

Note d'arrêt au titre de A2.2, point 2. Elle a été rencontrée en écrivant le
bandeau de version approuvée de l'écran du tableau des messages (R16).

## Constat

R16 demande, pour une version approuvée, un « bandeau d'état indiquant
l'approbateur et la date ». R12 précise que l'approbation porte « l'approbateur,
la date et l'empreinte des entrées ».

Le modèle porte l'approbateur sous la forme d'un identifiant :
`message_schedule_approval.user_id` (H11). Il ne porte aucun nom affichable.
A5.1 donne `membership (id, org_id, user_id, role, created_at)` et rien d'autre.
L'identité de l'utilisateur vit du côté de la plateforme d'authentification, que
le produit ne lit pas (A3.4).

Le bandeau ne peut donc pas nommer l'approbateur. Il ne peut que donner son
identifiant.

## Ce qui est fait en attendant, avec l'accord de l'utilisatrice

Le bandeau affiche :

- la date de la décision ;
- les huit premiers caractères de l'identifiant de l'approbateur ;
- la valeur complète de l'identifiant, à côté.

C'est la règle que R4 donne pour l'empreinte des entrées. Rien n'est ajouté au
modèle, et aucun nom n'est inventé.

## Question

D'où vient le nom affichable d'un utilisateur ? Trois pistes ont été vues, et
aucune n'est appliquée :

1. Une colonne de nom dans `membership`, saisie à l'invitation.
2. Une table de profil propre au produit, une ligne par utilisateur.
3. Une lecture de la plateforme d'authentification. Elle se heurte à A3.4 en
   installation autonome.

La même question se posera pour l'auteur d'une annotation de révision
(`review_annotation.author_id`, J4), qui n'est montré nulle part aujourd'hui.
