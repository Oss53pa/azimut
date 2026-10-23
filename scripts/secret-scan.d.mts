// Les types de `secret-scan.mjs`, pour les essais qui l'importent.
export declare const DECLARED: ReadonlyMap<string, string>;
export declare function isPlaceholder(value: string): boolean;
export declare function jwtRole(token: string): string | null;
export declare function findSecrets(
  text: string,
  options?: { readonly allowed?: ReadonlySet<string>; readonly mode?: 'source' | 'dist' },
): string[];
export declare function trackedTextFiles(root: string): { path: string; text: string }[];
export declare function distTextFiles(dir: string): { path: string; text: string }[];
export declare function checkDist(files: readonly { path: string; text: string }[], publishable: string): string[];
