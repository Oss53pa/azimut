import type { CsvLimits } from '../csv-utils.js';

/**
 * Les bornes d'import des essais : les valeurs que 0082 inscrit
 * (`import.csv.max_bytes`, `import.csv.max_rows`, `input.text.max_chars`).
 * Un moteur ne les tient pas en dur ; l'appelant les lit et les transmet.
 */
export const CSV_LIMITS: CsvLimits = { maxBytes: 10485760, maxRows: 50000, maxChars: 65536 };
