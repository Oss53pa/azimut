import type { SiteVocabulary } from '@azimut/core-model';
import { EMPTY_VOCABULARY } from '@azimut/core-model';

/**
 * Vocabulaire des sites de référence.
 *
 * Aucune donnée client : ces registres sont inventés pour exercer les
 * contrôles, comme les sites de référence eux-mêmes. Ils suivent les exemples
 * du complément atelier — parking gratuit contre les mots du paiement, charte
 * qui impose visiteurs plutôt que clients, charte contre plans sur le nombre de
 * niveaux de parking.
 *
 * Seul le site multi-niveaux en porte un. Les autres n'en déclarent pas, et
 * c'est délibéré : l'écran de validation doit montrer les deux cas, un site qui
 * exerce ses contrôles de vocabulaire et un site qui les laisse non exercés.
 */
const MULTILEVEL: SiteVocabulary = {
  lexicon: [
    { lang: 'fr', term: 'client', severity: 'forbidden' },
    { lang: 'fr', term: 'clients', severity: 'forbidden' },
    { lang: 'fr', term: 'boutique', severity: 'discouraged' },
    { lang: 'en', term: 'shop', severity: 'discouraged' },
  ],
  facts: [
    {
      key: 'parking_gratuit',
      value: 'oui',
      source: 'Décision de la Direction',
      recorded_on: '2026-03-12',
      forbidden: [
        { lang: 'fr', term: 'paiement' },
        { lang: 'fr', term: 'payant' },
        { lang: 'fr', term: 'tarif' },
        { lang: 'en', term: 'payment' },
      ],
    },
  ],
  claims: [
    { key: 'niveaux_parking', source: 'Charte', value: '3', recorded_on: '2026-01-10' },
    { key: 'niveaux_parking', source: 'Plans architecte', value: '2', recorded_on: '2026-05-04' },
  ],
};

const BY_SITE: ReadonlyMap<string, SiteVocabulary> = new Map([
  ['ref-multilevel', MULTILEVEL],
]);

export function referenceVocabulary(siteId: string): SiteVocabulary {
  return BY_SITE.get(siteId) ?? EMPTY_VOCABULARY;
}
