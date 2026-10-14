import * as Location from 'expo-location';
import { useUserStore } from '../store/userStore';

const MIN_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // at most once per 30 min

let lastRefreshAt = 0;
let inFlight = false;

/**
 * Sends the device location to PATCH /profile/location when permission has
 * already been granted (never prompts) and the last refresh is older than
 * 30 minutes.
 */
export async function refreshLocationIfDue(): Promise<void> {
  if (inFlight || Date.now() - lastRefreshAt < MIN_REFRESH_INTERVAL_MS) return;
  inFlight = true;
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return;

    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    let city: string | undefined;
    let country: string | undefined;
    try {
      const [place] = await Location.reverseGeocodeAsync(loc.coords);
      city = place?.city ?? undefined;
      country = place?.country ?? undefined;
    } catch {
      /* reverse geocoding is optional */
    }
    await useUserStore.getState().updateLocation(loc.coords.latitude, loc.coords.longitude, city, country);
    lastRefreshAt = Date.now();
  } catch (err) {
    console.warn('[Location] refresh failed:', err);
  } finally {
    inFlight = false;
  }
}

/** Called on logout so the next session refreshes immediately. */
export function resetLocationThrottle(): void {
  lastRefreshAt = 0;
}
