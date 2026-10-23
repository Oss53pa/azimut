/**
 * D12.1 : connexion et second facteur (A6.3, O3).
 *
 * Un refus ne dit jamais lequel des deux identifiants est faux : « adresse
 * inconnue » apprendrait qu'une autre adresse, elle, existe.
 */
export const AUTH_FR = {
  'auth.signin.title': 'Connexion',
  'auth.signin.email': 'Adresse électronique',
  'auth.signin.password': 'Mot de passe',
  'auth.signin.submit': 'Se connecter',
  'auth.failure.refused': 'Connexion refusée. Vérifiez l’adresse et le mot de passe.',
  'auth.failure.invalid_code': 'Code refusé. Saisissez le code affiché par votre application d’authentification.',
  'auth.failure.unavailable': 'Le service d’authentification ne répond pas. Réessayez dans un instant.',
  'auth.failure.malformed': 'Réponse inattendue du service d’authentification. La connexion n’est pas ouverte.',
  'auth.mfa.enroll.title': 'Activer la double authentification',
  'auth.mfa.enroll.body': 'Votre rôle exige un second facteur. Ajoutez ce compte à votre application d’authentification, en scannant le code ou en saisissant la clé, puis entrez le code à six chiffres.',
  'auth.mfa.enroll.start': 'Afficher le code à scanner',
  'auth.mfa.enroll.qr': 'Code à scanner par l’application d’authentification',
  'auth.mfa.enroll.secret': 'Clé à saisir',
  'auth.mfa.verify.title': 'Double authentification',
  'auth.mfa.verify.body': 'Entrez le code à six chiffres affiché par votre application d’authentification.',
  'auth.mfa.code': 'Code à six chiffres',
  'auth.mfa.submit': 'Vérifier',
  'auth.signout.local': 'Se déconnecter',
  'auth.signout.global': 'Se déconnecter de tous les appareils',
  'auth.state.loading': 'Ouverture de la session…',
  'auth.state.incomplete': 'Configuration incomplète : l’API est déclarée sans service d’authentification. Aucune donnée n’est lue.',
  'auth.state.no_org': 'Ce compte n’est inscrit dans aucune organisation. Un administrateur doit vous y inviter.',
  'auth.state.read_failed': 'Vos inscriptions n’ont pas pu être lues. Réessayez, ou déconnectez-vous.',
} as const;

export const AUTH_EN: Readonly<Record<keyof typeof AUTH_FR, string>> = {
  'auth.signin.title': 'Sign in',
  'auth.signin.email': 'Email address',
  'auth.signin.password': 'Password',
  'auth.signin.submit': 'Sign in',
  'auth.failure.refused': 'Sign-in refused. Check the address and the password.',
  'auth.failure.invalid_code': 'Code refused. Enter the code shown by your authenticator app.',
  'auth.failure.unavailable': 'The authentication service is not responding. Try again in a moment.',
  'auth.failure.malformed': 'Unexpected response from the authentication service. No session was opened.',
  'auth.mfa.enroll.title': 'Turn on two-factor authentication',
  'auth.mfa.enroll.body': 'Your role requires a second factor. Add this account to your authenticator app, by scanning the code or typing the key, then enter the six-digit code.',
  'auth.mfa.enroll.start': 'Show the code to scan',
  'auth.mfa.enroll.qr': 'Code to scan with the authenticator app',
  'auth.mfa.enroll.secret': 'Key to type',
  'auth.mfa.verify.title': 'Two-factor authentication',
  'auth.mfa.verify.body': 'Enter the six-digit code shown by your authenticator app.',
  'auth.mfa.code': 'Six-digit code',
  'auth.mfa.submit': 'Verify',
  'auth.signout.local': 'Sign out',
  'auth.signout.global': 'Sign out of all devices',
  'auth.state.loading': 'Opening the session…',
  'auth.state.incomplete': 'Incomplete configuration: the API is declared without an authentication service. No data is read.',
  'auth.state.no_org': 'This account belongs to no organisation. An administrator must invite you.',
  'auth.state.read_failed': 'Your memberships could not be read. Try again, or sign out.',
};
