import { AppState, AppStateStatus, NativeEventSubscription } from 'react-native';
import * as Location from 'expo-location';
import { verificationApi } from './api';

/**
 * Sends the device location to the active emergency share
 * (POST /verification/emergency-share/location) every 2 minutes while the app
 * is in the foreground, until the share expires or is stopped.
 */
const UPDATE_INTERVAL_MS = 2 * 60 * 1000;

let timer: ReturnType<typeof setInterval> | null = null;
let appStateSub: NativeEventSubscription | null = null;
let expiresAtMs = 0;
let lastSentAt = 0;
let sending = false;

async function sendLocation(): Promise<boolean> {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') return false;
  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  await verificationApi.updateLocation(loc.coords.latitude, loc.coords.longitude);
  lastSentAt = Date.now();
  return true;
}

async function tick(force = false) {
  if (Date.now() >= expiresAtMs) {
    stopEmergencyLocationTracking();
    return;
  }
  if (AppState.currentState !== 'active' || sending) return;
  if (!force && Date.now() - lastSentAt < UPDATE_INTERVAL_MS - 5000) return;
  sending = true;
  try {
    await sendLocation();
  } catch (err) {
    console.warn('[EmergencyShare] location update failed:', err);
  } finally {
    sending = false;
  }
}

export function startEmergencyLocationTracking(expiresAt: string | Date): void {
  expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return;
  if (timer) return; // already running; expiry updated above

  tick(true);
  timer = setInterval(() => tick(), UPDATE_INTERVAL_MS);
  appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
    // Catch up as soon as the app returns to the foreground.
    if (state === 'active') tick();
  });
}

export function stopEmergencyLocationTracking(): void {
  if (timer) clearInterval(timer);
  timer = null;
  appStateSub?.remove();
  appStateSub = null;
  expiresAtMs = 0;
  lastSentAt = 0;
}

export function isEmergencyLocationTrackingActive(): boolean {
  return timer !== null;
}

/** Sends the current location immediately (used by "Update my location"). */
export async function sendEmergencyLocationNow(): Promise<boolean> {
  return sendLocation();
}
