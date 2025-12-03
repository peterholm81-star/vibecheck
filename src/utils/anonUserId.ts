/**
 * Anonymous User ID Helper
 * 
 * Manages a stable anonymous user ID per device/browser.
 * The ID is stored in localStorage and persists across sessions.
 * Never tied to real identity - purely for anonymous analytics.
 */

const STORAGE_KEY = 'vibecheck_anon_user_id';

/**
 * Generate a UUID v4
 * Uses crypto.randomUUID if available, otherwise falls back to manual generation
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Validate that a string is a valid UUID format
 */
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Get or create an anonymous user ID for this device/browser.
 * 
 * - If a valid ID exists in localStorage, return it
 * - If not, generate a new UUID, store it, and return it
 * 
 * @returns A stable UUID string for this device
 */
export function getAnonUserId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    
    if (stored && isValidUUID(stored)) {
      return stored;
    }
    
    // Generate new ID
    const newId = generateUUID();
    localStorage.setItem(STORAGE_KEY, newId);
    return newId;
  } catch (error) {
    // If localStorage is not available (e.g., private browsing in some browsers),
    // generate a new ID each time. This is not ideal but keeps the app working.
    console.warn('localStorage not available, generating temporary anon ID');
    return generateUUID();
  }
}

/**
 * Clear the anonymous user ID (for testing/debugging purposes)
 */
export function clearAnonUserId(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}

