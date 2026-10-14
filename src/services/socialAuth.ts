import { Platform } from 'react-native';
import auth from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes, isErrorWithCode } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { GOOGLE_WEB_CLIENT_ID } from '../config';

/** The user dismissed the provider's sign-in UI — not an error to show. */
export class SocialSignInCancelledError extends Error {
  constructor() {
    super('Sign-in cancelled');
    this.name = 'SocialSignInCancelledError';
  }
}

export class SocialSignInNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SocialSignInNotConfiguredError';
  }
}

// ── Google ────────────────────────────────────────────────────────────
let googleConfigured = false;

export function isGoogleSignInConfigured(): boolean {
  return !!GOOGLE_WEB_CLIENT_ID;
}

function ensureGoogleConfigured() {
  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new SocialSignInNotConfiguredError(
      'Google sign-in is not configured (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing).',
    );
  }
  if (!googleConfigured) {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    googleConfigured = true;
  }
}

/**
 * Google → Firebase credential → Firebase ID token (provider google.com),
 * which is what POST /auth/google expects.
 */
export async function getGoogleFirebaseIdToken(): Promise<string> {
  ensureGoogleConfigured();
  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success') throw new SocialSignInCancelledError();

    const googleIdToken = response.data.idToken;
    if (!googleIdToken) throw new Error('Google did not return an ID token.');

    const credential = auth.GoogleAuthProvider.credential(googleIdToken);
    const userCredential = await auth().signInWithCredential(credential);
    return await userCredential.user.getIdToken();
  } catch (err) {
    if (isErrorWithCode(err)) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED || err.code === statusCodes.IN_PROGRESS) {
        throw new SocialSignInCancelledError();
      }
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play Services is not available or needs an update.');
      }
    }
    throw err;
  }
}

// ── Apple (iOS only) ──────────────────────────────────────────────────
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Apple → Firebase credential (with nonce) → Firebase ID token for POST /auth/apple.
 * `fullName` is only provided by Apple on the very first authorization.
 */
export async function getAppleFirebaseIdToken(): Promise<{ idToken: string; fullName?: string }> {
  if (Platform.OS !== 'ios') {
    throw new SocialSignInNotConfiguredError('Sign in with Apple is only available on iOS.');
  }
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  let appleCredential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (err: any) {
    if (err?.code === 'ERR_REQUEST_CANCELED') throw new SocialSignInCancelledError();
    throw err;
  }

  if (!appleCredential.identityToken) {
    throw new Error('Apple did not return an identity token.');
  }

  const credential = auth.AppleAuthProvider.credential(appleCredential.identityToken, rawNonce);
  const userCredential = await auth().signInWithCredential(credential);
  const idToken = await userCredential.user.getIdToken();

  const fullName =
    [appleCredential.fullName?.givenName, appleCredential.fullName?.familyName]
      .filter(Boolean)
      .join(' ') || undefined;

  return { idToken, fullName };
}

/** Best-effort sign-out from social providers (called on logout). */
export async function signOutSocialProviders(): Promise<void> {
  if (!isGoogleSignInConfigured()) return;
  try {
    ensureGoogleConfigured();
    await GoogleSignin.signOut();
  } catch {
    /* ignore */
  }
}
