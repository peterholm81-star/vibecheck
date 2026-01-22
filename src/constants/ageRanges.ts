/**
 * Age Ranges - Single Source of Truth
 * 
 * IMPORTANT: These values MUST match the database CHECK constraints exactly.
 * Uses en-dash (–) character, not hyphen (-).
 * 
 * Standard values: '18–24', '25–34', '35–44', '45+'
 */

// ============================================
// CORE CONSTANTS (Single Source of Truth)
// ============================================

/**
 * Valid age range values - matches DB constraint exactly
 * Uses en-dash (–) U+2013, not hyphen (-)
 */
export const AGE_RANGES = ['18–24', '25–34', '35–44', '45+'] as const;

/**
 * Age range type derived from the constant
 */
export type AgeRange = typeof AGE_RANGES[number];

/**
 * Human-readable labels for each age range (Norwegian)
 */
export const AGE_RANGE_LABELS: Record<AgeRange, string> = {
  '18–24': '18–24 år',
  '25–34': '25–34 år',
  '35–44': '35–44 år',
  '45+': '45+ år',
};

/**
 * Short labels without "år" suffix
 */
export const AGE_RANGE_LABELS_SHORT: Record<AgeRange, string> = {
  '18–24': '18–24',
  '25–34': '25–34',
  '35–44': '35–44',
  '45+': '45+',
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if a value is a valid age range
 */
export function isValidAgeRange(value: unknown): value is AgeRange {
  return typeof value === 'string' && AGE_RANGES.includes(value as AgeRange);
}

/**
 * Get label for an age range, with fallback
 */
export function getAgeRangeLabel(ageRange: AgeRange | null | undefined): string {
  if (!ageRange || !isValidAgeRange(ageRange)) {
    return 'Ikke oppgitt';
  }
  return AGE_RANGE_LABELS[ageRange];
}

/**
 * Calculate age range from birth year
 * Returns null if under 18 or invalid birth year
 */
export function getAgeRangeFromBirthYear(birthYear: number | null | undefined): AgeRange | null {
  if (!birthYear || typeof birthYear !== 'number') return null;

  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;

  if (age < 18) return null;
  if (age <= 24) return '18–24';
  if (age <= 34) return '25–34';
  if (age <= 44) return '35–44';
  return '45+';
}

/**
 * Options array for select/dropdown components
 */
export const AGE_RANGE_OPTIONS: Array<{ value: AgeRange; label: string }> = AGE_RANGES.map(
  (range) => ({
    value: range,
    label: AGE_RANGE_LABELS[range],
  })
);

