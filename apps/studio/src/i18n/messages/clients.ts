/**
 * Q5 — les clients de l'organisation : ses entités juridiques, listées et
 * créées sous la liste des sites.
 *
 * Fragment du catalogue. La table française porte le jeu de clés ;
 * la table anglaise est typée contre elle, une traduction manquante
 * ne compile pas.
 */
export const CLIENTS_FR = {
  'clients.title': 'Clients',
  'clients.intro': 'Les entités juridiques de l’organisation : la société qui possède ou exploite un site, et au nom de laquelle une facture s’émet.',
  'clients.create.open': 'Nouveau client',
  'clients.empty': 'Aucun client enregistré.',
  'clients.loading': 'Chargement des clients…',
  'clients.failed': 'Les clients n’ont pas pu être lus.',
  'clients.col.name': 'Raison sociale',
  'clients.create.title': 'Nouveau client',
  'clients.create.name': 'Raison sociale',
  'clients.create.country': 'Pays',
  'clients.create.country.placeholder': 'Choisir un pays',
  'clients.create.currency': 'Devise',
  'clients.create.currency.hint': 'Trois lettres majuscules, par exemple XOF ou EUR. Pré-remplie quand le pays en propose une.',
  'clients.create.registration': 'Numéro d’immatriculation',
  'clients.create.tax': 'Numéro fiscal',
  'clients.create.optional': 'Facultatif.',
  'clients.create.address.note': 'L’adresse ne se saisit pas encore : sa forme n’est pas définie.',
  'clients.create.cancel': 'Annuler',
  'clients.create.submit': 'Créer le client',
  'clients.create.submitting': 'Création…',
  'clients.create.done': 'Client créé.',
} as const;

export const CLIENTS_EN: Readonly<Record<keyof typeof CLIENTS_FR, string>> = {
  'clients.title': 'Clients',
  'clients.intro': 'The organisation’s legal entities: the company that owns or operates a site, and in whose name an invoice is issued.',
  'clients.create.open': 'New client',
  'clients.empty': 'No client recorded.',
  'clients.loading': 'Loading clients…',
  'clients.failed': 'The clients could not be read.',
  'clients.col.name': 'Legal name',
  'clients.create.title': 'New client',
  'clients.create.name': 'Legal name',
  'clients.create.country': 'Country',
  'clients.create.country.placeholder': 'Choose a country',
  'clients.create.currency': 'Currency',
  'clients.create.currency.hint': 'Three capital letters, for example XOF or EUR. Pre-filled when the country suggests one.',
  'clients.create.registration': 'Registration number',
  'clients.create.tax': 'Tax number',
  'clients.create.optional': 'Optional.',
  'clients.create.address.note': 'The address cannot be entered yet: its form is not defined.',
  'clients.create.cancel': 'Cancel',
  'clients.create.submit': 'Create client',
  'clients.create.submitting': 'Creating…',
  'clients.create.done': 'Client created.',
};
