// Export all insight components
export { Card } from './Card';
export { SectionHeader } from './SectionHeader';
export { PeriodSelector } from './PeriodSelector';
export { KPICard } from './KPICard';
export { KPIRow } from './KPIRow';
export { ActivityLineChart } from './ActivityLineChart';
export { IntentStackedChart } from './IntentStackedChart';
export { DemographicPanel } from './DemographicPanel';
export { ComparisonBars } from './ComparisonBars';

// Export types
export type { 
  InsightsPeriod,
  InsightsData,
  KPIData,
  ActivityPoint,
  IntentPoint,
  AgeDistribution,
  GenderDistribution,
  RelationshipDistribution,
  ComparisonMetric,
} from '../api/insightsData';
