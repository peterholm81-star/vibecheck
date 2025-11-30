import type { GeoPosition } from '../hooks/useSmartCheckinLocation';
import type { Venue } from '../types';

// ============================================
// CONSTANTS
// ============================================

/** Radius threshold for smart check-in (in meters) */
export const SMART_CHECKIN_RADIUS_METERS = 70;

/** Earth's radius in meters */
const EARTH_RADIUS_METERS = 6371000;

// ============================================
// HAVERSINE DISTANCE FORMULA
// ============================================

/**
 * Calculate the distance between two geographic points using the Haversine formula.
 * 
 * @param point1 - First point with lat/lng
 * @param point2 - Second point with lat/lng
 * @returns Distance in meters
 */
export function calculateDistanceMeters(
  point1: GeoPosition,
  point2: GeoPosition
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const lat1Rad = toRadians(point1.lat);
  const lat2Rad = toRadians(point2.lat);
  const deltaLat = toRadians(point2.lat - point1.lat);
  const deltaLng = toRadians(point2.lng - point1.lng);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

// ============================================
// NEAREST VENUE DETECTION
// ============================================

export interface NearestVenueResult {
  venue: Venue;
  distanceMeters: number;
}

/**
 * Find the nearest venue within a specified radius.
 * 
 * @param userPosition - Current user position
 * @param venues - List of venues with lat/lng
 * @param radiusMeters - Maximum distance to consider (default: SMART_CHECKIN_RADIUS_METERS)
 * @returns The nearest venue within radius, or null if none found
 */
export function findNearestVenueWithinRadius(
  userPosition: GeoPosition,
  venues: Venue[],
  radiusMeters: number = SMART_CHECKIN_RADIUS_METERS
): NearestVenueResult | null {
  let nearestVenue: Venue | null = null;
  let nearestDistance = Infinity;

  for (const venue of venues) {
    // Skip venues without valid coordinates
    if (venue.latitude == null || venue.longitude == null) {
      continue;
    }

    const venuePosition: GeoPosition = {
      lat: venue.latitude,
      lng: venue.longitude,
    };

    const distance = calculateDistanceMeters(userPosition, venuePosition);

    if (distance < nearestDistance && distance <= radiusMeters) {
      nearestDistance = distance;
      nearestVenue = venue;
    }
  }

  if (nearestVenue) {
    return {
      venue: nearestVenue,
      distanceMeters: nearestDistance,
    };
  }

  return null;
}

/**
 * Check if two positions are within a given radius of each other.
 * 
 * @param pos1 - First position
 * @param pos2 - Second position
 * @param radiusMeters - Maximum distance threshold
 * @returns true if within radius
 */
export function isWithinRadius(
  pos1: GeoPosition,
  pos2: GeoPosition,
  radiusMeters: number
): boolean {
  return calculateDistanceMeters(pos1, pos2) <= radiusMeters;
}

