/**
 * L'identité du mode local : sans base ni service d'authentification, le
 * parcours s'exécute sous cette organisation, celle des sites de référence,
 * et sous ce rôle.
 *
 * Avec une session, l'identité vient des rattachements de l'utilisateur
 * (AUTH.4, `auth/identity.ts`) et ces valeurs ne servent plus. Le
 * cloisonnement réel reste tenu par la base (A6.1). Ni l'une ni l'autre n'est
 * un secret ni une donnée client, au sens d'A2.4.
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
