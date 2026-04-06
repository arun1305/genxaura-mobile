import React, { useState, useRef } from 'react';
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
import { useAuthStore } from '../../store/authStore';
import { COLORS } from '../../constants';

const { width } = Dimensions.get('window');

type Step = 'welcome' | 'phone' | 'otp';

export default function LoginScreen() {
  const [step, setStep] = useState<Step>('welcome');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState<any>(null);
  const otpInputRef = useRef<TextInput>(null);

  const { loginWithPhone, loginWithGoogle } = useAuthStore();

  // ── Send OTP ──────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    const formatted = (phone.startsWith('+') ? phone : `+${phone}`).replace(/\s+/g, '');
    if (formatted.length < 8) {
      Alert.alert('Invalid phone', 'Enter a valid phone number with country code.');
      return;
    }
    setLoading(true);
    try {
      const conf = await auth().signInWithPhoneNumber(formatted);
      setConfirmation(conf);
      setStep('otp');
      setTimeout(() => otpInputRef.current?.focus(), 200);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send OTP. Try again.');
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
    setLoading(true);
    try {
      const result = await confirmation.confirm(otp);
      const idToken = await result.user.getIdToken();
      const formatted = (phone.startsWith('+') ? phone : `+${phone}`).replace(/\s+/g, '');
      console.log('[OTP] sending phone:', formatted);
      const { isNew } = await loginWithPhone(formatted, idToken);
      // Navigation handled by root navigator based on auth state
    } catch (err: any) {
      console.error('[OTP Error] code:', err?.code, 'message:', err?.message);
      Alert.alert('Error', err?.code + ': ' + err?.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Google Sign-In ────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { idToken } = await auth().signInWithPopup(
        new (auth as any).GoogleAuthProvider(),
      );
      await loginWithGoogle(idToken);
    } catch (err: any) {
      Alert.alert('Google Sign-In failed', err.message);
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
              style={styles.socialBtn}
              onPress={handleGoogleSignIn}
              disabled={loading}
            >
              <Text style={styles.socialBtnText}>🔵 Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.socialBtn}>
              <Text style={styles.socialBtnText}>🍎 Continue with Apple</Text>
            </TouchableOpacity>
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
