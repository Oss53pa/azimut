import { createContext } from 'react';
import type { SiteData } from '@azimut/core-model';

export const SiteDataContext = createContext<SiteData | null>(null);
