// ── Runtime configuration ─────────────────────────────────────────────
// EXPO_PUBLIC_* variables are inlined at build time by the Expo CLI.
// See .env.example for the full list.

const DEV_FALLBACK_API_URL = 'http://localhost:3000/api/v1';

const rawApiUrl = (process.env.EXPO_PUBLIC_API_URL || '').trim();

/**
 * True when this is a non-development build that was produced without
 * EXPO_PUBLIC_API_URL. In that case the app must NOT silently talk to
 * localhost — App.tsx renders a visible configuration error instead.
 */
export const API_URL_MISSING = !rawApiUrl && !__DEV__;

function normalizeApiUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  return /\/api\/v1$/.test(trimmed) ? trimmed : `${trimmed}/api/v1`;
}

/** REST base URL, always ending in /api/v1 */
export const API_BASE_URL = normalizeApiUrl(rawApiUrl || DEV_FALLBACK_API_URL);

/** Socket.io origin (no /api/v1 suffix) */
export const SOCKET_URL = API_BASE_URL.replace(/\/api\/v1$/, '');

export const GOOGLE_WEB_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '').trim();

if (API_URL_MISSING) {
  console.error(
    '[Config] EXPO_PUBLIC_API_URL is not set. This build cannot reach the GenXAura API. ' +
      'Set EXPO_PUBLIC_API_URL (see .env.example) and rebuild.',
  );
} else if (!rawApiUrl) {
  console.warn(`[Config] EXPO_PUBLIC_API_URL not set — using dev fallback ${DEV_FALLBACK_API_URL}`);
}
