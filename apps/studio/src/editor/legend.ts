/**
 * E9.4 — Legend generation.
 *
 * The legend is NOT a drawn object. It is generated from the categories
 * actually present on the level. Only its position is composed.
 * This guarantees it can never become stale — unlike a manually drawn
 * legend in a traditional graphics file.
 *
 * Same rule for the compass rose: oriented from data, not drawn.
 */

// ---------------------------------------------------------------------------
// Legend entry
// ---------------------------------------------------------------------------

export type LegendEntry = {
  readonly categoryId: string;
  readonly label: Readonly<Record<string, string>>;
  readonly color: string;
  readonly pictogramId: string | null;
  /** Number of destinations in this category on the level. */
  readonly count: number;
};

// ---------------------------------------------------------------------------
// Legend generation
// ---------------------------------------------------------------------------

export type CategoryPresence = {
  readonly categoryId: string;
  readonly label: Readonly<Record<string, string>>;
  readonly color: string;
  readonly pictogramId: string | null;
  readonly destinationCount: number;
};

/**
 * Generate legend entries from categories present on a level.
 *
 * Only categories with at least one destination are included.
 * Entries are sorted by category label in the given language,
 * with deterministic tiebreaking by categoryId.
 *
 * @param categories - All categories present on the level.
 * @param lang - Display language for sorting.
 */
export function generateLegend(
  categories: readonly CategoryPresence[],
  lang: string,
): readonly LegendEntry[] {
  return categories
    .filter(c => c.destinationCount > 0)
    .map(c => ({
      categoryId: c.categoryId,
      label: c.label,
      color: c.color,
      pictogramId: c.pictogramId,
      count: c.destinationCount,
    }))
    .sort((a, b) => {
      const labelA = a.label[lang] ?? '';
      const labelB = b.label[lang] ?? '';
      const cmp = labelA.localeCompare(labelB, lang);
      if (cmp !== 0) return cmp;
      return a.categoryId.localeCompare(b.categoryId);
    });
}

// ---------------------------------------------------------------------------
// Compass rose (E9.4)
// ---------------------------------------------------------------------------

/**
 * Compute the compass rose rotation from level north bearing.
 *
 * @param northBearing_deg - The bearing of geographic north relative
 *   to the level's coordinate system, in degrees clockwise from Y+.
 * @returns Rotation in degrees to apply to the compass rose symbol.
 */
export function compassRoseRotation(northBearing_deg: number): number {
  // Normalize to [0, 360)
  return ((northBearing_deg % 360) + 360) % 360;
}
