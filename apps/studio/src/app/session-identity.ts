/**
 * L'identité sous laquelle le parcours s'exécute, tant qu'aucune session
 * d'authentification n'est ouverte.
 *
 * Elle est nommée ici plutôt que devinée à chaque écran. Le cloisonnement réel
 * reste tenu par la base (A6.1) : ces valeurs ne le remplacent pas, elles
 * permettent au parcours d'exister avant lui. Ni l'une ni l'autre n'est un
 * secret ni une donnée client, au sens d'A2.4.
 */

/** L'organisation de la session. */
export const ORG_OF_SESSION = '00000000-0000-4000-8000-000000000001';

/**
 * Le rôle sous lequel la session consulte, au sens de la table R2 de la
 * partie R.
 *
 * `designer` est celui des écrans de l'atelier. R2 lui donne la consultation
 * et l'export du tableau des messages, et lui refuse l'approbation : « celui
 * qui génère ne peut pas approuver ».
 */
export const ACTOR_OF_SESSION = 'designer' as const;
