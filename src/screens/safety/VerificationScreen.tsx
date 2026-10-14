import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { verificationApi, getApiErrorMessage } from '../../services/api';
import { COLORS } from '../../constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const OVAL_WIDTH = SCREEN_WIDTH * 0.65;
const OVAL_HEIGHT = OVAL_WIDTH * 1.3;

type Step = 'intro' | 'camera' | 'preview' | 'loading' | 'success' | 'failure';
type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'needs_retry' | 'unverified';

export default function VerificationScreen() {
  const navigation = useNavigation<any>();
  const [step, setStep] = useState<Step>('intro');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [status, setStatus] = useState<VerificationStatus>('unverified');
  const [statusLoading, setStatusLoading] = useState(true);
  const [failureReason, setFailureReason] = useState<'needs_retry' | 'error'>('needs_retry');
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  React.useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const { data } = await verificationApi.getStatus();
      // Backend shape: { liveness: {status, submittedAt}|null, id: {...}|null }
      setStatus((data?.data?.liveness?.status as VerificationStatus) ?? 'unverified');
    } catch {
      // ignore
    } finally {
      setStatusLoading(false);
    }
  };

  const handleStartVerification = useCallback(async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        // Fallback to image picker
        launchFallbackPicker();
        return;
      }
    }
    setStep('camera');
  }, [permission]);

  const launchFallbackPicker = async () => {
    const pickerResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!pickerResult.granted) {
      Alert.alert('Permission Required', 'Please allow camera or photo library access to verify your identity.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
    });
    if (!picked.canceled && picked.assets[0]) {
      setCapturedUri(picked.assets[0].uri);
      setStep('preview');
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (photo?.uri) {
        setCapturedUri(photo.uri);
        setStep('preview');
      }
    } catch {
      Alert.alert('Error', 'Could not capture photo. Please try again.');
    }
  };

  const handleSubmit = async () => {
    if (!capturedUri) return;
    setStep('loading');
    try {
      const filename = capturedUri.split('/').pop() ?? 'selfie.jpg';
      const ext = filename.split('.').pop()?.toLowerCase();
      const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const formData = new FormData();
      formData.append('selfie', { uri: capturedUri, name: filename, type: mimeType } as any);

      const { data } = await verificationApi.submitLiveness(formData);
      const result = (data?.data?.status as VerificationStatus) ?? 'pending';
      setStatus(result);
      if (result === 'needs_retry') {
        // No single face detected — ask the user to retake the selfie.
        setFailureReason('needs_retry');
        setFailureMessage(null);
        setStep('failure');
      } else {
        setStep('success');
      }
    } catch (err) {
      setFailureReason('error');
      setFailureMessage(getApiErrorMessage(err, 'Could not submit your selfie. Please try again.'));
      setStep('failure');
    }
  };

  const handleRetry = () => {
    setCapturedUri(null);
    setStep('intro');
  };

  const statusBadge = () => {
    if (statusLoading) return null;
    const config: Record<VerificationStatus, { label: string; color: string; bg: string }> = {
      approved: { label: '✅ Verified', color: '#4CAF50', bg: '#4CAF5020' },
      pending: { label: '⏳ Pending Review', color: COLORS.warning, bg: `${COLORS.warning}20` },
      rejected: { label: '❌ Rejected', color: COLORS.error, bg: `${COLORS.error}20` },
      needs_retry: { label: '↻ Retake Needed', color: COLORS.warning, bg: `${COLORS.warning}20` },
      unverified: { label: '○ Not Verified', color: COLORS.textMuted, bg: `${COLORS.surface}` },
    };
    const cfg = config[status];
    return (
      <View style={[styles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.color + '50' }]}>
        <Text style={[styles.statusBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
    );
  };

  // ─── INTRO ────────────────────────────────────────────────────────────────
  if (step === 'intro') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Photo Verification</Text>
          <View style={styles.backBtn} />
        </View>

        {statusBadge()}

        <ScrollView contentContainerStyle={styles.introContent}>
          <Text style={styles.heroEmoji}>🤳</Text>
          <Text style={styles.introTitle}>Verify You're Real</Text>
          <Text style={styles.introSubtitle}>
            Take a quick selfie to prove you're a real person. This helps keep GenXAura safe for everyone.
          </Text>

          <View style={styles.infoCardList}>
            {[
              { icon: '🔒', text: 'Your photo is never shared publicly' },
              { icon: '🤖', text: 'We check that a single face is clearly visible' },
              { icon: '👀', text: 'A member of our team reviews every submission' },
              { icon: '✅', text: 'Earn a verified badge on your profile' },
            ].map(({ icon, text }) => (
              <View key={text} style={styles.infoRow}>
                <Text style={styles.infoRowIcon}>{icon}</Text>
                <Text style={styles.infoRowText}>{text}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleStartVerification}>
            <Text style={styles.primaryBtnText}>Start Verification</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── CAMERA ───────────────────────────────────────────────────────────────
  if (step === 'camera') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep('intro')}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Take Selfie</Text>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="front"
          >
            {/* Darkened overlay with oval cutout via borders */}
            <View style={styles.cameraOverlay}>
              <View style={styles.ovalGuide} />
            </View>
            <View style={styles.cameraInstructionContainer}>
              <Text style={styles.cameraInstruction}>
                Position your face in the oval and blink slowly
              </Text>
            </View>
          </CameraView>
        </View>

        <View style={styles.captureRow}>
          <TouchableOpacity
            style={styles.captureBtn}
            onPress={handleCapture}
            activeOpacity={0.8}
          >
            <View style={styles.captureBtnInner} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── PREVIEW ──────────────────────────────────────────────────────────────
  if (step === 'preview') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep('camera')}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Preview</Text>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.previewContainer}>
          {capturedUri && (
            <Image
              source={{ uri: capturedUri }}
              style={styles.previewImage}
              contentFit="cover"
            />
          )}
          <Text style={styles.previewHint}>
            Make sure your face is clearly visible and well-lit.
          </Text>
        </View>

        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('camera')}>
            <Text style={styles.secondaryBtnText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSubmit}>
            <Text style={styles.primaryBtnText}>Submit</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── LOADING ──────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredFull}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Uploading your selfie...</Text>
          <Text style={styles.loadingSubtext}>This usually takes just a moment</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── SUCCESS ──────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verification</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.centeredFull}>
          <View style={styles.successCircle}>
            <Text style={styles.successIcon}>✓</Text>
          </View>
          <Text style={styles.successTitle}>Submitted — Under Review</Text>
          <Text style={styles.successSubtitle}>
            Your selfie has been submitted and is under review by our team. You'll receive a verified badge once it is approved.
          </Text>
          <TouchableOpacity style={[styles.primaryBtn, { marginTop: 32 }]} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── FAILURE ──────────────────────────────────────────────────────────────
  if (step === 'failure') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verification</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.centeredFull}>
          <View style={styles.failureCircle}>
            <Text style={styles.failureIcon}>✕</Text>
          </View>
          <Text style={styles.failureTitle}>
            {failureReason === 'needs_retry' ? 'Please Retake Your Selfie' : 'Submission Failed'}
          </Text>
          <Text style={styles.failureSubtitle}>
            {failureReason === 'needs_retry'
              ? "We couldn't detect exactly one clear face. Please retake the photo in good lighting."
              : failureMessage}
          </Text>
          <View style={styles.failureTips}>
            {[
              'Face the camera directly',
              'Use good, even lighting',
              'Remove glasses or hats if possible',
            ].map((tip) => (
              <Text key={tip} style={styles.failureTip}>• {tip}</Text>
            ))}
          </View>
          <TouchableOpacity style={[styles.primaryBtn, { marginTop: 24 }]} onPress={handleRetry}>
            <Text style={styles.primaryBtnText}>
              {failureReason === 'needs_retry' ? 'Retake Selfie' : 'Try Again'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, alignItems: 'center' },
  backIcon: { fontSize: 32, color: COLORS.text, lineHeight: 36 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  statusBadge: {
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Intro
  introContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
  heroEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  introSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  infoCardList: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingVertical: 8,
    marginBottom: 32,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  infoRowIcon: { fontSize: 20 },
  infoRowText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center',
    width: '100%',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Camera
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  ovalGuide: {
    width: OVAL_WIDTH,
    height: OVAL_HEIGHT,
    borderRadius: OVAL_WIDTH / 2,
    borderWidth: 3,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
    // We punch out the overlay using mix-blend-mode is not available in RN,
    // so the oval is just a border guide.
  },
  cameraInstructionContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  cameraInstruction: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  captureRow: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtnInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.primary,
  },
  // Preview
  previewContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  previewImage: {
    width: OVAL_WIDTH,
    height: OVAL_HEIGHT,
    borderRadius: OVAL_WIDTH / 2,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  previewHint: {
    marginTop: 16,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  previewActions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  // Loading
  centeredFull: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  // Success
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${COLORS.success}20`,
    borderWidth: 3,
    borderColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successIcon: { fontSize: 48, color: COLORS.success },
  successTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Failure
  failureCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${COLORS.error}20`,
    borderWidth: 3,
    borderColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  failureIcon: { fontSize: 48, color: COLORS.error },
  failureTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  failureSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  failureTips: {
    alignSelf: 'flex-start',
    gap: 6,
  },
  failureTip: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
});
