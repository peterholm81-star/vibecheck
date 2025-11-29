import { KPICard } from './KPICard';
import type { KPIData } from '../api/insightsData';

interface KPIRowProps {
  kpi?: KPIData;
  loading?: boolean;
}

export function KPIRow({ kpi, loading = false }: KPIRowProps) {
  if (loading || !kpi) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Totalt besøk" value={0} loading={true} />
        <KPICard label="Party intent index" value={0} loading={true} />
        <KPICard label="Single-rate" value={0} loading={true} />
        <KPICard label="Dominerende alder" value="" loading={true} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        label="Totalt besøk"
        value={kpi.totalVisits.value.toLocaleString('nb-NO')}
        delta={kpi.totalVisits.deltaPct}
        deltaLabel="vs forrige periode"
        accentColor="cyan"
      />
      
      <KPICard
        label="Party intent index"
        value={kpi.partyIntentIndex.value}
        unit="%"
        delta={kpi.partyIntentIndex.deltaPct}
        deltaLabel="vs forrige periode"
        accentColor="indigo"
      />
      
      <KPICard
        label="Single-rate"
        value={kpi.singleRate.value}
        unit="%"
        delta={kpi.singleRate.deltaPct}
        deltaLabel="vs forrige periode"
        accentColor="pink"
      />
      
      <KPICard
        label="Dominerende alder"
        value={kpi.dominantAgeBand.label}
        delta={kpi.dominantAgeBand.deltaPoints > 0 
          ? `+${kpi.dominantAgeBand.deltaPoints} pp` 
          : `${kpi.dominantAgeBand.deltaPoints} pp`}
        deltaLabel="vs forrige periode"
        accentColor="emerald"
      />
    </div>
  );
}
