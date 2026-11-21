/**
 * AUTH.3 — le jeton que portent les requêtes du poste.
 *
 * Sans session, l'atelier présentait la clé publiable comme jeton : PostgREST
 * basculait sur le rôle anonyme, et la base ne reconnaissait personne. Avec
 * une session, c'est le jeton d'accès de l'utilisateur qui part, et la base en
 * tire son identité (0024) et son niveau d'assurance (0080).
 *
 * La source est posée une fois, par la session d'authentification ; toutes
 * les requêtes la lisent au moment de partir. Un jeton rafraîchi vaut donc
 * dès la requête suivante, sans que rien ne le transporte d'écran en écran.
 */

let source: () => string | null = () => null;

/** Pose la source du jeton d'accès. Rend de quoi la retirer. */
export function setAccessTokenSource(next: () => string | null): () => void {
  source = next;
  return () => {
    if (source === next) source = () => null;
  };
}

/** Le jeton de l'en-tête `Authorization` : celui de la session, sinon la clé publiable. */
export function bearerToken(apiKey: string): string {
  const token = source();
  return token !== null && token !== '' ? token : apiKey;
}
