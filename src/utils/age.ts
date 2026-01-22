/**
 * Age Utilities
 * 
 * Re-exports from the single source of truth for backward compatibility.
 * New code should import directly from constants/ageRanges.ts
 */

// Re-export everything from the single source of truth
export {
  AGE_RANGES,
  AGE_RANGE_LABELS,
  AGE_RANGE_LABELS_SHORT,
  AGE_RANGE_OPTIONS,
  type AgeRange,
  isValidAgeRange,
  getAgeRangeLabel,
  getAgeRangeFromBirthYear,
} from "../constants/ageRanges";

// Legacy type alias for backward compatibility
import type { AgeRange } from "../constants/ageRanges";
export type AgeBand = AgeRange;

// Legacy function aliases
import { getAgeRangeFromBirthYear as _getAgeRangeFromBirthYear, getAgeRangeLabel as _getAgeRangeLabel } from "../constants/ageRanges";

/**
 * @deprecated Use getAgeRangeFromBirthYear from constants/ageRanges.ts
 */
export function getAgeBandFromBirthYear(birthYear: number | null): AgeRange | null {
  return _getAgeRangeFromBirthYear(birthYear);
}

/**
 * @deprecated Use getAgeRangeLabel from constants/ageRanges.ts
 */
export function getAgeBandLabel(ageBand: AgeRange | null): string {
  return _getAgeRangeLabel(ageBand);
}

/**
 * Generate birth year options (1960 to current year - 18)
 */
export function getBirthYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const minYear = 1960;
  const maxYear = currentYear - 18; // Must be at least 18
  
  const years: number[] = [];
  for (let year = maxYear; year >= minYear; year--) {
    years.push(year);
  }
  return years;
}

