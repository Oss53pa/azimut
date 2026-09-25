import type { SiteVocabulary } from '@azimut/core-model';
import { EMPTY_VOCABULARY } from '@azimut/core-model';

/**
 * Vocabulaire des sites de référence.
 *
 * Aucune donnée client : ces registres sont inventés pour exercer les
 * contrôles, comme les sites de référence eux-mêmes. Quatre cas, un par
 * registre d'A5.8 et d'A5.11 — règles de rédaction de la charte, charte qui
 * impose visiteurs plutôt que clients, parking gratuit contre les mots du
 * paiement, charte contre plans sur le nombre de niveaux de parking.
 *
 * Seul le site multi-niveaux en porte un. Les autres n'en déclarent pas, et
 * c'est délibéré : l'écran de validation doit montrer les deux cas, un site qui
 * exerce ses contrôles de vocabulaire et un site qui les laisse non exercés.
 */
const MULTILEVEL: SiteVocabulary = {
  /**
   * A5.8 — les deux règles de rédaction que le dépôt sait opposer.
   *
   * Elles étaient écrites dans le code des contrôles, comme des valeurs du
   * produit. A5.8 les range parmi les règles de charte, et elles sont donc ici,
   * dans la charte inventée d'un site de référence. Les noms de caractères sont
   * ceux qu'une charte emploierait, et l'anomalie les rapporte tels quels.
   */
  charter_rules: [
    {
      kind: 'forbidden_character',
      params: {
        characters: [
          { from: 0x00b7, to: 0x00b7, name: 'point médian' },
          { from: 0x00d7, to: 0x00d7, name: 'signe de multiplication' },
          { from: 0x2013, to: 0x2013, name: 'tiret demi-cadratin' },
          { from: 0x2014, to: 0x2014, name: 'tiret cadratin' },
          { from: 0x2026, to: 0x2026, name: 'points de suspension' },
          { from: 0x2190, to: 0x21ff, name: 'flèche' },
        ],
      },
    },
    { kind: 'max_sentence_words', params: { maximum: 25 } },
  ],
  lexicon: [
    { lang: 'fr', term: 'client', severity: 'forbidden' },
    { lang: 'fr', term: 'clients', severity: 'forbidden' },
    { lang: 'fr', term: 'boutique', severity: 'discouraged' },
    { lang: 'en', term: 'shop', severity: 'discouraged' },
  ],
  facts: [
    {
      key: 'parking_gratuit',
      // Un fait arrêté, donc `existing` : c'est le seul statut qu'un livrable
      // a le droit de montrer comme un fait (A5.11, règle M01.S11).
      value: true,
      status: 'existing',
      source_ref: 'Décision de la Direction',
      declared_at: '2026-03-12',
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
