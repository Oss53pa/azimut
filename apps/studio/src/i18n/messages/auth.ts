/**
 * AUTH.3 — la connexion au poste.
 *
 * Fragment du catalogue. La table française porte le jeu de clés ;
 * la table anglaise est typée contre elle, une traduction manquante
 * ne compile pas.
 *
 * Un refus du service ne dit jamais lequel, de l'adresse ou de la phrase de
 * passe, est faux : le dire permettrait d'éprouver quelles adresses ont un
 * compte.
 */
export const AUTH_FR = {
  'auth.title': 'Connexion',
  'auth.intro': 'Connectez-vous avec l’adresse et la phrase de passe de votre compte.',
  'auth.email': 'Adresse électronique',
  'auth.password': 'Phrase de passe',
  'auth.submit': 'Se connecter',
  'auth.submitting': 'Connexion…',
  'auth.loading': 'Vérification de la session…',
  'auth.failed': 'La connexion a échoué. Vérifiez l’adresse et la phrase de passe.',
  'auth.unavailable': 'Le service de connexion ne répond pas. Réessayez dans un instant.',
  'auth.refusal.email_required': 'Saisissez votre adresse.',
  'auth.refusal.email_invalid': 'Cette adresse n’a pas la forme d’une adresse électronique.',
  'auth.refusal.password_required': 'Saisissez votre phrase de passe.',
  'auth.refusal.too_long': 'L’adresse ou la phrase de passe est trop longue.',
  'auth.signed_in_as': 'Connecté : {email}',
  'auth.sign_out': 'Se déconnecter',
} as const;

export const AUTH_EN: Readonly<Record<keyof typeof AUTH_FR, string>> = {
  'auth.title': 'Sign in',
  'auth.intro': 'Sign in with your account’s email address and passphrase.',
  'auth.email': 'Email address',
  'auth.password': 'Passphrase',
  'auth.submit': 'Sign in',
  'auth.submitting': 'Signing in…',
  'auth.loading': 'Checking the session…',
  'auth.failed': 'Sign-in failed. Check the address and the passphrase.',
  'auth.unavailable': 'The sign-in service is not responding. Try again in a moment.',
  'auth.refusal.email_required': 'Enter your address.',
  'auth.refusal.email_invalid': 'This does not look like an email address.',
  'auth.refusal.password_required': 'Enter your passphrase.',
  'auth.refusal.too_long': 'The address or the passphrase is too long.',
  'auth.signed_in_as': 'Signed in: {email}',
  'auth.sign_out': 'Sign out',
};
