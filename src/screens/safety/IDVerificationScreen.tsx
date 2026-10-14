import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { verificationApi, getApiErrorMessage } from '../../services/api';
import { COLORS } from '../../constants';

type IDType = 'passport' | 'drivers_license' | 'national_id';
type SubmitStatus = 'idle' | 'uploading' | 'done' | 'error';
type ReviewStatus = 'unverified' | 'pending' | 'approved' | 'rejected' | 'needs_retry';

const ID_TYPES: { key: IDType; label: string }[] = [
  { key: 'passport', label: 'Passport' },
  { key: 'drivers_license', label: "Driver's License" },
  { key: 'national_id', label: 'National ID' },
];

export default function IDVerificationScreen() {
  const navigation = useNavigation<any>();
  const [selectedType, setSelectedType] = useState<IDType>('passport');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>('unverified');
  const [statusLoading, setStatusLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const { data } = await verificationApi.getStatus();
      // Backend shape: { liveness: {status}|null, id: {status, idType, rejectionReason}|null }
      const id = data?.data?.id;
      setReviewStatus((id?.status as ReviewStatus) ?? 'unverified');
      setRejectionReason(id?.rejectionReason ?? null);
      if (id?.idType) setSelectedType(id.idType as IDType);
    } catch {
      // ignore
    } finally {
      setStatusLoading(false);
    }
  };

  const handlePickImage = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library to upload an ID.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!imageUri) {
      Alert.alert('No Image', 'Please upload a photo of your ID first.');
      return;
    }
    setSubmitStatus('uploading');
    try {
      // The ID document is sent to the dedicated verification endpoint, where it is
      // stored privately. It must NEVER go through /profile/photos (public).
      const filename = imageUri.split('/').pop() ?? 'id_document.jpg';
      const ext = filename.split('.').pop()?.toLowerCase();
      const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const formData = new FormData();
      formData.append('document', { uri: imageUri, name: filename, type: mimeType } as any);
      formData.append('idType', selectedType);
      const { data } = await verificationApi.submitIDVerification(formData);

      setReviewStatus((data?.data?.status as ReviewStatus) ?? 'pending');
      setRejectionReason(null);
      setSubmitStatus('done');
    } catch (err: any) {
      setSubmitStatus('error');
      Alert.alert('Submission Failed', getApiErrorMessage(err, 'Something went wrong. Please try again.'));
    }
  };

  // ─── APPROVED STATE ───────────────────────────────────────────────────────
  if (!statusLoading && reviewStatus === 'approved') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ID Verification</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.centeredFull}>
          <Text style={styles.shieldIcon}>🛡️</Text>
          <View style={styles.approvedCircle}>
            <Text style={styles.approvedCheck}>✓</Text>
          </View>
          <Text style={styles.approvedTitle}>Identity Verified</Text>
          <Text style={styles.approvedSubtitle}>
            Your ID has been verified. You have a verified badge on your profile.
          </Text>
          <TouchableOpacity style={[styles.primaryBtn, { marginTop: 32 }]} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── PENDING STATE ────────────────────────────────────────────────────────
  if (!statusLoading && (reviewStatus === 'pending' || submitStatus === 'done')) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ID Verification</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.centeredFull}>
          <Text style={styles.shieldIcon}>🛡️</Text>
          <View style={styles.pendingCircle}>
            <Text style={styles.pendingIcon}>⏳</Text>
          </View>
          <Text style={styles.pendingTitle}>Under Review</Text>
          <Text style={styles.pendingSubtitle}>
            Your ID has been submitted and is waiting for review by our trust & safety team.
          </Text>
          <View style={styles.privacyNote}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.privacyText}>
              Your ID is stored privately and is never shown on your profile.
            </Text>
          </View>
          <TouchableOpacity style={[styles.outlineBtn, { marginTop: 32 }]} onPress={() => navigation.goBack()}>
            <Text style={styles.outlineBtnText}>Back to Safety Center</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── MAIN UPLOAD FORM ─────────────────────────────────────────────────────
  const isSubmitting = submitStatus === 'uploading';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ID Verification</Text>
        <View style={styles.backBtn} />
      </View>

      {statusLoading ? (
        <View style={styles.centeredFull}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Info Card */}
          <View style={styles.infoCard}>
            <Text style={styles.shieldIconSmall}>🛡️</Text>
            <Text style={styles.infoCardTitle}>ID Verification</Text>
            <Text style={styles.infoCardText}>
              ID Verification earns you a verified badge once our trust & safety team has reviewed your document.
            </Text>
          </View>

          {/* Rejected notice */}
          {(reviewStatus === 'rejected' || reviewStatus === 'needs_retry') && (
            <View style={styles.rejectedBanner}>
              <Text style={styles.rejectedText}>
                ❌ Your previous ID submission was not accepted
                {rejectionReason ? `: ${rejectionReason}` : '.'} Please submit a clear photo of your document.
              </Text>
            </View>
          )}

          {/* ID Type Selector */}
          <Text style={styles.sectionLabel}>Select ID Type</Text>
          <View style={styles.idTypeRow}>
            {ID_TYPES.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.idTypeBtn, selectedType === key && styles.idTypeBtnActive]}
                onPress={() => setSelectedType(key)}
              >
                <Text style={[styles.idTypeBtnText, selectedType === key && styles.idTypeBtnTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Upload Area */}
          <Text style={styles.sectionLabel}>Upload ID Photo</Text>
          <TouchableOpacity
            style={[styles.uploadArea, imageUri && styles.uploadAreaHasImage]}
            onPress={handlePickImage}
            disabled={isSubmitting}
          >
            {imageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: imageUri }} style={styles.idPreviewImage} contentFit="cover" />
                <TouchableOpacity style={styles.changePhotoBtn} onPress={handlePickImage}>
                  <Text style={styles.changePhotoBtnText}>Change Photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Text style={styles.uploadPlaceholderIcon}>📷</Text>
                <Text style={styles.uploadPlaceholderTitle}>Upload ID Photo</Text>
                <Text style={styles.uploadPlaceholderSubtitle}>
                  Tap to choose from your photo library
                </Text>
                <Text style={styles.uploadPlaceholderHint}>
                  Supported: JPG, PNG — Max 10MB
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Privacy Note */}
          <View style={styles.privacyCard}>
            <Text style={styles.lockIconMed}>🔒</Text>
            <Text style={styles.privacyCardText}>
              Your ID is stored privately and is never shown on your profile. We never share it with third parties.
            </Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.primaryBtn, (!imageUri || isSubmitting) && styles.primaryBtnDisabled]}
            onPress={handleSubmit}
            disabled={!imageUri || isSubmitting}
          >
            {isSubmitting ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>
                  Uploading...
                </Text>
              </View>
            ) : (
              <Text style={styles.primaryBtnText}>Submit for Verification</Text>
            )}
          </TouchableOpacity>

          {submitStatus === 'error' && (
            <Text style={styles.errorText}>
              Something went wrong. Please check your connection and try again.
            </Text>
          )}

          <Text style={styles.footerNote}>
            By submitting, you agree that your ID will be reviewed by our trust & safety team.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 48,
    gap: 16,
  },
  centeredFull: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  shieldIcon: { fontSize: 56, marginBottom: 8 },
  shieldIconSmall: { fontSize: 32, marginBottom: 4 },
  // Info Card
  infoCard: {
    backgroundColor: `${COLORS.primary}15`,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${COLORS.primary}30`,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  infoCardTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  infoCardText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Rejected banner
  rejectedBanner: {
    backgroundColor: `${COLORS.error}15`,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${COLORS.error}40`,
    padding: 12,
  },
  rejectedText: { fontSize: 14, color: COLORS.error, lineHeight: 20 },
  // Section label
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: -4,
  },
  // ID Type Selector
  idTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  idTypeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  idTypeBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}15`,
  },
  idTypeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  idTypeBtnTextActive: { color: COLORS.primary },
  // Upload area
  uploadArea: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    minHeight: 180,
    overflow: 'hidden',
  },
  uploadAreaHasImage: {
    borderStyle: 'solid',
    borderColor: COLORS.primary,
  },
  uploadPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  uploadPlaceholderIcon: { fontSize: 40 },
  uploadPlaceholderTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  uploadPlaceholderSubtitle: { fontSize: 14, color: COLORS.textSecondary },
  uploadPlaceholderHint: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  imagePreviewContainer: {
    position: 'relative',
  },
  idPreviewImage: {
    width: '100%',
    height: 200,
  },
  blurHintOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  blurHintText: {
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  changePhotoBtn: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  changePhotoBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  // Privacy card
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  lockIconMed: { fontSize: 22 },
  privacyCardText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  // Privacy note (compact)
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 8,
  },
  lockIcon: { fontSize: 18 },
  privacyText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  // Buttons
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  outlineBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingHorizontal: 32,
  },
  outlineBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    textAlign: 'center',
  },
  footerNote: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Approved / Pending states
  approvedCircle: {
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
  approvedCheck: { fontSize: 48, color: COLORS.success },
  approvedTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  approvedSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  pendingCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${COLORS.warning}20`,
    borderWidth: 3,
    borderColor: COLORS.warning,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pendingIcon: { fontSize: 48 },
  pendingTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  pendingSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
