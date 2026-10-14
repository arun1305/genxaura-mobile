import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import auth from '@react-native-firebase/auth';
import axios from 'axios';
import { useAuthStore } from '../../store/authStore';
import { getApiErrorMessage } from '../../services/api';
import {
  getGoogleFirebaseIdToken,
  getAppleFirebaseIdToken,
  isAppleSignInAvailable,
  isGoogleSignInConfigured,
  SocialSignInCancelledError,
} from '../../services/socialAuth';
import { COLORS } from '../../constants';

const { width } = Dimensions.get('window');

type Step = 'welcome' | 'phone' | 'otp';

/**
 * Normalises user input to E.164: strips spaces, dashes, parentheses and dots,
 * keeps a leading "+", converts a leading "00" international prefix to "+".
 * Returns null if the result is not a plausible E.164 number.
 */
export function normalizePhoneE164(input: string): string | null {
  let p = input.trim().replace(/[\s\-().]/g, '');
  if (p.startsWith('00')) p = `+${p.slice(2)}`;
  if (!p.startsWith('+')) p = `+${p}`;
  return /^\+[1-9]\d{6,14}$/.test(p) ? p : null;
}

const FIREBASE_AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-phone-number': 'That phone number is not valid. Include your country code, e.g. +1 555 000 0000.',
  'auth/invalid-verification-code': 'The code you entered is incorrect.',
  'auth/code-expired': 'This code has expired. Please request a new one.',
  'auth/session-expired': 'This code has expired. Please request a new one.',
  'auth/too-many-requests': 'Too many attempts. Please wait a while and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/account-exists-with-different-credential':
    'An account already exists with the same email but a different sign-in method.',
  'auth/user-disabled': 'This account has been disabled.',
};

/** User-facing message for Firebase, social-provider and API errors. */
function authErrorMessage(err: any, fallback: string): string {
  if (axios.isAxiosError(err)) return getApiErrorMessage(err, fallback);
  const code: string | undefined = err?.code;
  if (code && FIREBASE_AUTH_MESSAGES[code]) return FIREBASE_AUTH_MESSAGES[code];
  return err?.message || fallback;
}

export default function LoginScreen() {
  const [step, setStep] = useState<Step>('welcome');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState<any>(null);
  const otpInputRef = useRef<TextInput>(null);

  const [appleAvailable, setAppleAvailable] = useState(false);

  const { loginWithPhone, loginWithGoogle, loginWithApple } = useAuthStore();

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  // ── Send OTP ──────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    const formatted = normalizePhoneE164(phone);
    if (!formatted) {
      Alert.alert('Invalid phone', 'Enter a valid phone number including your country code, e.g. +1 555 000 0000.');
      return;
    }
    setLoading(true);
    try {
      const conf = await auth().signInWithPhoneNumber(formatted);
      setConfirmation(conf);
      setStep('otp');
      setTimeout(() => otpInputRef.current?.focus(), 200);
    } catch (err: any) {
      Alert.alert('Could not send code', authErrorMessage(err, 'Failed to send the code. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  // ── Verify OTP ────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otp.length < 6) {
      Alert.alert('Invalid OTP', 'Enter the 6-digit code.');
      return;
    }
    const formatted = normalizePhoneE164(phone);
    if (!formatted || !confirmation) {
      Alert.alert('Invalid phone', 'Please go back and re-enter your phone number.');
      return;
    }
    setLoading(true);
    try {
      const result = await confirmation.confirm(otp);
      const idToken = await result.user.getIdToken();
      await loginWithPhone(formatted, idToken);
      // Navigation handled by root navigator based on auth state
    } catch (err: any) {
      console.warn('[OTP] verification failed:', err?.code ?? err?.response?.status);
      Alert.alert('Verification failed', authErrorMessage(err, 'Could not verify the code. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  // ── Google Sign-In ────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    if (!isGoogleSignInConfigured()) {
      Alert.alert('Unavailable', 'Google sign-in is not configured.');
      return;
    }
    setLoading(true);
    try {
      const idToken = await getGoogleFirebaseIdToken();
      await loginWithGoogle(idToken);
    } catch (err: any) {
      if (err instanceof SocialSignInCancelledError) return;
      Alert.alert('Google Sign-In failed', authErrorMessage(err, 'Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  // ── Apple Sign-In (iOS) ───────────────────────────────────────────
  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      const { idToken, fullName } = await getAppleFirebaseIdToken();
      await loginWithApple(idToken, fullName);
    } catch (err: any) {
      if (err instanceof SocialSignInCancelledError) return;
      Alert.alert('Apple Sign-In failed', authErrorMessage(err, 'Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  // ── Welcome screen ────────────────────────────────────────────────
  if (step === 'welcome') {
    return (
      <LinearGradient
        colors={['#0F0F1A', '#1A0A2E', '#0F0F1A']}
        style={styles.gradientContainer}
      >
        <SafeAreaView style={styles.welcomeContainer}>
          <View style={styles.logoSection}>
            <Text style={styles.logoEmoji}>💫</Text>
            <Text style={styles.logoText}>GenXAura</Text>
            <Text style={styles.tagline}>Find your perfect connection</Text>
          </View>

          <View style={styles.authButtons}>
            <TouchableOpacity
              style={styles.phoneBtn}
              onPress={() => setStep('phone')}
            >
              <LinearGradient
                colors={[COLORS.primary, '#C850C0']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}
              >
                <Text style={styles.phoneBtnText}>📱 Continue with Phone</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialBtn, loading && styles.continueBtnDisabled]}
              onPress={handleGoogleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={styles.socialBtnText}>🔵 Continue with Google</Text>
              )}
            </TouchableOpacity>

            {appleAvailable && (
              <TouchableOpacity
                style={[styles.socialBtn, loading && styles.continueBtnDisabled]}
                onPress={handleAppleSignIn}
                disabled={loading}
              >
                <Text style={styles.socialBtnText}>🍎 Continue with Apple</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.terms}>
            By continuing you agree to our{' '}
            <Text style={styles.link}>Terms of Service</Text> &{' '}
            <Text style={styles.link}>Privacy Policy</Text>
          </Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Phone input ───────────────────────────────────────────────────
  if (step === 'phone') {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.formContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            onPress={() => setStep('welcome')}
            style={styles.backBtn}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.stepTitle}>My phone number is</Text>
          <Text style={styles.stepSubtitle}>
            We'll send you a verification code
          </Text>

          <View style={styles.phoneInput}>
            <Text style={styles.phoneFlag}>🌍</Text>
            <TextInput
              style={styles.phoneField}
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 555 000 0000"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="phone-pad"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSendOtp}
            />
          </View>

          <TouchableOpacity
            style={[styles.continueBtn, loading && styles.continueBtnDisabled]}
            onPress={handleSendOtp}
            disabled={loading || phone.length < 5}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.continueBtnText}>Send Code →</Text>
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── OTP verification ──────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.formContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          onPress={() => setStep('phone')}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.stepTitle}>Enter the code</Text>
        <Text style={styles.stepSubtitle}>
          We sent a 6-digit code to {phone}
        </Text>

        <TextInput
          ref={otpInputRef}
          style={styles.otpInput}
          value={otp}
          onChangeText={setOtp}
          placeholder="000000"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          textContentType="oneTimeCode"
        />

        <TouchableOpacity
          style={[
            styles.continueBtn,
            (loading || otp.length < 6) && styles.continueBtnDisabled,
          ]}
          onPress={handleVerifyOtp}
          disabled={loading || otp.length < 6}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.continueBtnText}>Verify →</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setOtp('');
            handleSendOtp();
          }}
          style={styles.resendBtn}
        >
          <Text style={styles.resendText}>Didn't receive it? Resend</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  gradientContainer: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.background },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  logoSection: { alignItems: 'center', paddingTop: 60 },
  logoEmoji: { fontSize: 72, marginBottom: 12 },
  logoText: {
    fontSize: 48,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 17,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  authButtons: { gap: 14 },
  phoneBtn: { borderRadius: 16, overflow: 'hidden' },
  btnGradient: { paddingVertical: 17, alignItems: 'center', borderRadius: 16 },
  phoneBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  socialBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  socialBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  terms: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  link: { color: COLORS.primary },
  formContainer: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 20,
  },
  backBtn: { paddingVertical: 12, marginBottom: 24 },
  backText: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  stepTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: 36,
    lineHeight: 22,
  },
  phoneInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  phoneFlag: { fontSize: 22, marginRight: 10 },
  phoneField: {
    flex: 1,
    paddingVertical: 18,
    fontSize: 18,
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  otpInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 20,
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 12,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
  },
  continueBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
  },
  continueBtnDisabled: { opacity: 0.45 },
  continueBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resendBtn: { paddingVertical: 16, alignItems: 'center' },
  resendText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
});
