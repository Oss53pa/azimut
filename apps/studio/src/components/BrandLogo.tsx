import { type JSX } from 'react';

type BrandLogoProps = {
  /** Horizontale pour la barre d'en-tête, verticale pour l'écran d'accueil. */
  readonly variant: 'horizontal' | 'vertical';
  /** Seule la hauteur se fixe ; la largeur suit les proportions du fichier. */
  readonly height: number;
  readonly alt: string;
};

const BRAND_DIR = `${import.meta.env.BASE_URL}brand/`;

/**
 * Le logo de l'application, tel que le kit de marque Atlas Studio le livre :
 * nom de l'application et signature « an Atlas Studio company », vectorisés.
 *
 * Les fichiers du kit ne se redessinent ni ne se recolorent. Les deux versions,
 * noire et blanche, sont servies telles quelles ; `theme.css` montre celle qui
 * convient au thème actif.
 */
export function BrandLogo({ variant, height, alt }: BrandLogoProps): JSX.Element {
  const base = `${BRAND_DIR}azimut_logo_${variant}`;
  return (
    <span className="az-brand-logo">
      <img className="az-brand-logo-noir" src={`${base}_noir.svg`} alt={alt} height={height} />
      <img className="az-brand-logo-blanc" src={`${base}_blanc.svg`} alt={alt} height={height} />
    </span>
  );
}
