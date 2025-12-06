/**
 * Admin Error Mapper
 * 
 * Utility functions for mapping technical errors to user-friendly Norwegian messages
 * for the venue refresh functionality in Admin Dashboard.
 */

// ============================================
// ERROR CODES (for structured error handling)
// ============================================

export type VenueRefreshErrorCode =
  | 'OVERPASS_TIMEOUT'
  | 'OVERPASS_RATE_LIMIT'
  | 'OVERPASS_UNAVAILABLE'
  | 'SUPABASE_ERROR'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'CITY_NOT_FOUND'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export type ErrorSeverity = 'error' | 'warning' | 'info';

export interface MappedError {
  code: VenueRefreshErrorCode;
  uiMessage: string;
  severity: ErrorSeverity;
  technicalDetails?: string;
}

// ============================================
// ERROR DETECTION HELPERS
// ============================================

/**
 * Detect error code from HTTP status
 */
function getErrorCodeFromStatus(status: number): VenueRefreshErrorCode {
  switch (status) {
    case 401:
    case 403:
      return 'UNAUTHORIZED';
    case 404:
      return 'CITY_NOT_FOUND';
    case 429:
      return 'OVERPASS_RATE_LIMIT';
    case 502:
    case 503:
      return 'OVERPASS_UNAVAILABLE';
    case 504:
      return 'OVERPASS_TIMEOUT';
    case 500:
    default:
      return 'SERVER_ERROR';
  }
}

/**
 * Detect error code from error message patterns
 */
function getErrorCodeFromMessage(message: string): VenueRefreshErrorCode {
  const lowerMessage = message.toLowerCase();
  
  // Timeout patterns
  if (
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('timed out') ||
    lowerMessage.includes('504') ||
    lowerMessage.includes('gateway timeout')
  ) {
    return 'OVERPASS_TIMEOUT';
  }
  
  // Rate limit patterns
  if (
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('too many requests') ||
    lowerMessage.includes('429')
  ) {
    return 'OVERPASS_RATE_LIMIT';
  }
  
  // Overpass/OSM unavailable
  if (
    lowerMessage.includes('overpass') ||
    lowerMessage.includes('osm') ||
    lowerMessage.includes('502') ||
    lowerMessage.includes('503') ||
    lowerMessage.includes('bad gateway') ||
    lowerMessage.includes('service unavailable')
  ) {
    return 'OVERPASS_UNAVAILABLE';
  }
  
  // Supabase/database errors
  if (
    lowerMessage.includes('supabase') ||
    lowerMessage.includes('database') ||
    lowerMessage.includes('insert') ||
    lowerMessage.includes('delete') ||
    lowerMessage.includes('pgrst') ||
    lowerMessage.includes('postgres')
  ) {
    return 'SUPABASE_ERROR';
  }
  
  // Network errors
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('fetch') ||
    lowerMessage.includes('failed to fetch') ||
    lowerMessage.includes('connection') ||
    lowerMessage.includes('econnrefused') ||
    lowerMessage.includes('enotfound')
  ) {
    return 'NETWORK_ERROR';
  }
  
  // Auth errors
  if (
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('forbidden') ||
    lowerMessage.includes('401') ||
    lowerMessage.includes('403')
  ) {
    return 'UNAUTHORIZED';
  }
  
  // City not found
  if (
    lowerMessage.includes('city') &&
    (lowerMessage.includes('not found') || lowerMessage.includes('404'))
  ) {
    return 'CITY_NOT_FOUND';
  }
  
  return 'UNKNOWN';
}

// ============================================
// ERROR MESSAGE MAPPING
// ============================================

/**
 * Get user-friendly Norwegian message for error code
 */
function getMessageForErrorCode(code: VenueRefreshErrorCode, cityName?: string): string {
  const cityText = cityName ? ` for ${cityName}` : '';
  
  switch (code) {
    case 'OVERPASS_TIMEOUT':
      return `OpenStreetMap/Overpass brukte for lang tid på å svare${cityText}. Venues ble ikke oppdatert. Prøv igjen om litt.`;
    
    case 'OVERPASS_RATE_LIMIT':
      return `For mange forespørsler mot OpenStreetMap på kort tid. Vent et par minutter før du prøver igjen.`;
    
    case 'OVERPASS_UNAVAILABLE':
      return `OpenStreetMap/Overpass er midlertidig utilgjengelig${cityText}. Prøv igjen senere.`;
    
    case 'SUPABASE_ERROR':
      return `Det oppstod en feil ved lagring i databasen${cityText}. Ingen endringer ble gjort. Prøv igjen senere.`;
    
    case 'NETWORK_ERROR':
      return `Kunne ikke koble til serveren. Sjekk internettforbindelsen din og prøv igjen.`;
    
    case 'UNAUTHORIZED':
      return `Autentisering feilet. Logg inn på nytt og prøv igjen.`;
    
    case 'CITY_NOT_FOUND':
      return `Byen${cityText} ble ikke funnet i databasen.`;
    
    case 'SERVER_ERROR':
      return `Det oppstod en serverfeil${cityText}. Prøv igjen senere.`;
    
    case 'UNKNOWN':
    default:
      return `Noe gikk galt under oppdatering av venues${cityText}. Prøv igjen senere.`;
  }
}

/**
 * Get severity level for error code
 */
function getSeverityForErrorCode(code: VenueRefreshErrorCode): ErrorSeverity {
  switch (code) {
    case 'OVERPASS_RATE_LIMIT':
    case 'OVERPASS_TIMEOUT':
      return 'warning'; // Temporary issues, likely to resolve
    
    case 'UNAUTHORIZED':
    case 'SUPABASE_ERROR':
    case 'SERVER_ERROR':
      return 'error'; // More serious issues
    
    default:
      return 'error';
  }
}

// ============================================
// MAIN MAPPING FUNCTIONS
// ============================================

/**
 * Map an error from single city refresh to user-friendly format
 */
export function mapSingleCityError(
  error: unknown,
  cityName?: string,
  httpStatus?: number
): MappedError {
  let errorMessage = '';
  
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    errorMessage = String((error as { message: unknown }).message);
  } else {
    errorMessage = String(error);
  }
  
  // Determine error code
  let code: VenueRefreshErrorCode;
  if (httpStatus) {
    code = getErrorCodeFromStatus(httpStatus);
  } else {
    code = getErrorCodeFromMessage(errorMessage);
  }
  
  // Log structured error for debugging
  console.error('[Admin/RefreshCity] Error:', {
    scope: 'Admin/RefreshCity',
    cityName,
    errorCode: code,
    httpStatus,
    rawMessage: errorMessage,
  });
  
  return {
    code,
    uiMessage: getMessageForErrorCode(code, cityName),
    severity: getSeverityForErrorCode(code),
    technicalDetails: errorMessage,
  };
}

/**
 * Map batch refresh results to user-friendly format
 */
export interface BatchResultSummary {
  summaryMessage: string;
  severity: ErrorSeverity;
  successCount: number;
  failedCount: number;
  totalVenuesInserted: number;
  failedCities: Array<{
    cityName: string;
    errorMessage: string;
    errorCode: VenueRefreshErrorCode;
  }>;
  successCities: Array<{
    cityName: string;
    venuesInserted: number;
  }>;
}

export interface BatchApiResult {
  cityId: number;
  cityName: string;
  status: 'success' | 'error';
  inserted?: number;
  radiusKm?: number;
  error?: string;
}

export interface BatchApiResponse {
  success?: boolean;
  totalCities?: number;
  successCount: number;
  failedCount: number;
  totalVenuesInserted: number;
  results: BatchApiResult[];
  error?: string;
}

export function mapBatchResultToUi(response: BatchApiResponse): BatchResultSummary {
  const { successCount, failedCount, totalVenuesInserted, results } = response;
  
  // Process failed cities
  const failedCities = results
    .filter(r => r.status === 'error')
    .map(r => ({
      cityName: r.cityName,
      errorMessage: getMessageForErrorCode(
        getErrorCodeFromMessage(r.error || ''),
        r.cityName
      ),
      errorCode: getErrorCodeFromMessage(r.error || ''),
    }));
  
  // Process successful cities
  const successCities = results
    .filter(r => r.status === 'success')
    .map(r => ({
      cityName: r.cityName,
      venuesInserted: r.inserted ?? 0,
    }));
  
  // Determine overall severity and message
  let severity: ErrorSeverity;
  let summaryMessage: string;
  
  if (failedCount === 0) {
    severity = 'info';
    summaryMessage = `✓ Oppdaterte venues for alle ${successCount} byer. Totalt ${totalVenuesInserted} venues ble hentet.`;
  } else if (successCount === 0) {
    severity = 'error';
    summaryMessage = `Alle ${failedCount} byer feilet under oppdatering. Ingen venues ble hentet.`;
  } else {
    severity = 'warning';
    summaryMessage = `⚠️ Oppdaterte venues for ${successCount} av ${successCount + failedCount} byer. ${failedCount} byer feilet. Totalt ${totalVenuesInserted} venues ble hentet.`;
  }
  
  // Log summary for debugging
  console.log('[Admin/BatchRefresh] Summary:', {
    scope: 'Admin/BatchRefresh',
    successCount,
    failedCount,
    totalVenuesInserted,
    failedCities: failedCities.map(c => ({ city: c.cityName, code: c.errorCode })),
  });
  
  return {
    summaryMessage,
    severity,
    successCount,
    failedCount,
    totalVenuesInserted,
    failedCities,
    successCities,
  };
}

/**
 * Map a batch API error (when the entire API call fails)
 */
export function mapBatchApiError(
  error: unknown,
  httpStatus?: number
): MappedError {
  let errorMessage = '';
  
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else {
    errorMessage = String(error);
  }
  
  // Determine error code
  let code: VenueRefreshErrorCode;
  if (httpStatus) {
    code = getErrorCodeFromStatus(httpStatus);
  } else {
    code = getErrorCodeFromMessage(errorMessage);
  }
  
  // Log structured error for debugging
  console.error('[Admin/BatchRefresh] API Error:', {
    scope: 'Admin/BatchRefresh',
    errorCode: code,
    httpStatus,
    rawMessage: errorMessage,
  });
  
  // Special message for complete batch failure
  const uiMessage = code === 'NETWORK_ERROR'
    ? 'Kunne ikke starte batch-oppdatering. Sjekk internettforbindelsen din.'
    : code === 'UNAUTHORIZED'
    ? 'Autentisering feilet. Logg inn på nytt og prøv igjen.'
    : 'Klarte ikke å starte batch-oppdatering for byer. Prøv igjen senere.';
  
  return {
    code,
    uiMessage,
    severity: 'error',
    technicalDetails: errorMessage,
  };
}

