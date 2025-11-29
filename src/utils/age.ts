import type { AgeBand } from "../hooks/useProfile";

/**
 * Calculate age band from birth year
 * Returns null if under 18 or no birth year provided
 */
export function getAgeBandFromBirthYear(birthYear: number | null): AgeBand | null {
  if (!birthYear) return null;

  const now = new Date();
  const age = now.getFullYear() - birthYear;

  // Ignore under 18
  if (age < 18) return null;

  if (age <= 25) return "18_25";
  if (age <= 30) return "25_30";
  if (age <= 35) return "30_35";
  if (age <= 40) return "35_40";
  return "40_plus";
}

/**
 * Get human-readable label for age band
 */
export function getAgeBandLabel(ageBand: AgeBand | null): string {
  if (!ageBand) return "Ikke oppgitt";
  
  const labels: Record<AgeBand, string> = {
    "18_25": "18-25 år",
    "25_30": "25-30 år",
    "30_35": "30-35 år",
    "35_40": "35-40 år",
    "40_plus": "40+ år",
  };
  
  return labels[ageBand];
}

/**
 * Generate birth year options (1980 to current year - 18)
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

