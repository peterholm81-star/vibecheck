import { useEffect, useState } from 'react';
import {
  InsightsData,
  InsightsPeriod,
  loadInsightsData,
} from '../api/insightsData';

interface UseInsightsDataOptions {
  venueId: string;
  period: InsightsPeriod;
}

export function useInsightsData({ venueId, period }: UseInsightsDataOptions) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const result = await loadInsightsData(venueId, period);
        if (!cancelled) setData(result);
      } catch (err: unknown) {
        console.error('Error loading insights data', err);
        if (!cancelled) setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [venueId, period]);

  return { data, loading, error };
}

