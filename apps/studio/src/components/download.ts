/**
 * Remise d'un fichier calculé à l'utilisateur.
 *
 * Le contenu vient toujours d'un moteur ; cette fonction ne fabrique rien,
 * elle ne fait que le remettre. Elle est isolée ici parce qu'elle touche au
 * DOM, ce qu'aucun écran n'a à faire.
 */
export function downloadText(filename: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
