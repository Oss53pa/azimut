/**
 * Les bancs d'essai du chemin réel — PostgREST et le service
 * d'authentification — pour les suites d'autres paquets.
 *
 * Exposés à part de l'entrée principale : ils lancent des processus, et le
 * paquet du studio, qui lit `@azimut/db` pour son modèle, ne doit jamais les
 * emporter dans le navigateur.
 */
export { startPostgrest, signToken, installPlatformStubs, testJwtSecret } from './postgrest-harness.js';
export type { Harness } from './postgrest-harness.js';
export { startAuthService } from './auth-harness.js';
export type { AuthService } from './auth-harness.js';
export { totpNow } from './totp.js';
