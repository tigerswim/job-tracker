// Name matching utilities for fuzzy comparison
// Used to avoid duplicate mutual connections when names differ slightly
// (e.g., "John Smith, MBA" vs "John Smith")

/**
 * Common credential suffixes that should be removed for comparison
 */
const CREDENTIAL_SUFFIXES = [
  'mba', 'phd', 'md', 'jd', 'cpa', 'pmp', 'cfa', 'cfp', 'esq', 'pe', 'rn',
  'bs', 'ba', 'ms', 'ma', 'msc', 'llm', 'edd', 'dba', 'dmin', 'psyd',
  'pharmd', 'dnp', 'dpt', 'do', 'dds', 'dmd', 'od', 'dc', 'dpm', 'drph',
  'mph', 'mha', 'mpa', 'msw', 'lcsw', 'lpc', 'lmft',
  'shrm-cp', 'shrm-scp', 'sphr', 'phr',
  'cissp', 'pmi-acp', 'csm', 'six sigma', 'ceh', 'ccna', 'ccnp',
  'aws', 'gcp', 'azure'
];

/**
 * Build a regex pattern to match credential suffixes
 */
const CREDENTIAL_PATTERN = new RegExp(
  `,?\\s*(${CREDENTIAL_SUFFIXES.join('|')})\\b`,
  'gi'
);

/**
 * Normalize a name for comparison
 * - Converts to lowercase
 * - Removes credential suffixes (MBA, PhD, etc.)
 * - Removes single letter initials (middle initials)
 * - Removes periods
 * - Normalizes whitespace
 *
 * @param name - The name to normalize
 * @returns The normalized name
 */
export function normalizeName(name: string): string {
  if (!name) return '';

  return name
    .toLowerCase()
    // Remove credential suffixes
    .replace(CREDENTIAL_PATTERN, '')
    // Remove single letter initials (e.g., "John D. Smith" -> "John Smith")
    .replace(/\b[a-z]\.\s*/gi, '')
    // Remove remaining periods
    .replace(/\./g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two names match after normalization
 *
 * @param name1 - First name to compare
 * @param name2 - Second name to compare
 * @returns True if the names match after normalization
 */
export function namesMatch(name1: string, name2: string): boolean {
  return normalizeName(name1) === normalizeName(name2);
}

/**
 * Check if a name exists in an array of names (using normalized comparison)
 *
 * @param name - The name to check
 * @param existingNames - Array of existing names to check against
 * @returns True if the name already exists (normalized match)
 */
export function nameExistsInArray(name: string, existingNames: string[]): boolean {
  const normalizedNew = normalizeName(name);
  return existingNames.some(existing => normalizeName(existing) === normalizedNew);
}

/**
 * Filter an array of names to only include new ones (not in existing array)
 *
 * @param incomingNames - Array of new names to filter
 * @param existingNames - Array of existing names to compare against
 * @returns Array of names that don't already exist (after normalization)
 */
export function findNewNames(incomingNames: string[], existingNames: string[]): string[] {
  const normalizedExisting = new Set(existingNames.map(normalizeName));

  return incomingNames.filter(name => {
    const normalized = normalizeName(name);
    return normalized && !normalizedExisting.has(normalized);
  });
}

/**
 * Merge new names into existing array, avoiding duplicates
 *
 * @param existingNames - Current array of names
 * @param newNames - New names to add
 * @returns Object with merged array and list of what was added
 */
export function mergeNames(
  existingNames: string[],
  newNames: string[]
): { merged: string[]; added: string[]; alreadyExisted: string[] } {
  const normalizedExisting = new Set(existingNames.map(normalizeName));
  const added: string[] = [];
  const alreadyExisted: string[] = [];

  for (const name of newNames) {
    const normalized = normalizeName(name);
    if (!normalized) continue;

    if (normalizedExisting.has(normalized)) {
      alreadyExisted.push(name);
    } else {
      added.push(name);
      normalizedExisting.add(normalized);
    }
  }

  return {
    merged: [...existingNames, ...added],
    added,
    alreadyExisted
  };
}
