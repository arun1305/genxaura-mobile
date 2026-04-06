import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usersApi, moderationApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { COLORS } from '../../constants';

const PRECISE_LOCATION_KEY = 'settings_precise_location';

export default function PrivacyScreen() {
  const navigation = useNavigation<any>();
  const { logout } = useAuthStore();

  const [precisLocation, setPrecisLocation] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);

  // Delete account flow
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<1 | 2>(1);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadLocationPreference();
  }, []);

  const loadLocationPreference = async () => {
    try {
      const val = await AsyncStorage.getItem(PRECISE_LOCATION_KEY);
      setPrecisLocation(val === 'true');
    } catch {
      // ignore
    } finally {
      setLocationLoading(false);
    }
  };

  const handleLocationToggle = async (value: boolean) => {
    setPrecisLocation(value);
    try {
      await AsyncStorage.setItem(PRECISE_LOCATION_KEY, String(value));
    } catch {
      // ignore
    }
  };

  const handleExportData = async () => {
    setExportLoading(true);
    try {
      await moderationApi.exportGDPRData();
      Alert.alert(
        'Data Export Requested',
        'Your data export will be ready shortly. We\'ll email it to your registered address.',
        [{ text: 'OK' }],
      );
    } catch {
      Alert.alert('Error', 'Could not process your export request. Please try again later.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccountPress = () => {
    setDeleteConfirmStep(1);
    setDeleteText('');
    setDeleteModalVisible(true);
  };

  const handleDeleteStep1 = () => {
    setDeleteConfirmStep(2);
  };

  const handleDeleteStep2 = async () => {
    if (deleteText.trim() !== 'DELETE') {
      Alert.alert('Incorrect', 'Please type DELETE exactly to confirm.');
      return;
    }
    setDeleting(true);
    try {
      await usersApi.deleteAccount();
      setDeleteModalVisible(false);
      await logout();
    } catch {
      Alert.alert('Error', 'Could not delete your account. Please contact support at support@genxaura.com');
    } finally {
      setDeleting(false);
    }
  };

  const handlePrivacyPolicy = () => {
    Alert.alert(
      'Privacy Policy',
      'You can view our full Privacy Policy at https://genxaura.com/privacy\n\nThis app complies with GDPR, CCPA, and applicable privacy laws.',
      [{ text: 'OK' }],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* ── YOUR DATA ───────────────────────────────────────────────── */}
        <SectionHeader title="Your Data" />
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Download My Data</Text>
          <Text style={styles.cardDesc}>
            Under GDPR and CCPA, you have the right to access all personal data we hold about you. We'll send a full export to your email.
          </Text>
          <TouchableOpacity
            style={[styles.outlineBtn, exportLoading && styles.btnDisabled]}
            onPress={handleExportData}
            disabled={exportLoading}
          >
            {exportLoading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.outlineBtnText}>📥 Request Data Export</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── LOCATION ────────────────────────────────────────────────── */}
        <SectionHeader title="Location" />
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.rowLabel}>
              <Text style={styles.cardTitle}>Share Precise Location</Text>
              <Text style={styles.cardDesc}>
                Precise location shows matches within an exact distance. When off, we use an approximate city-level location.
              </Text>
            </View>
            {locationLoading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Switch
                value={precisLocation}
                onValueChange={handleLocationToggle}
                trackColor={{ false: COLORS.border, true: `${COLORS.primary}80` }}
                thumbColor={precisLocation ? COLORS.primary : COLORS.textMuted}
              />
            )}
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📍</Text>
            <Text style={styles.infoText}>
              Location data is only used for matching and is never sold to third parties.
            </Text>
          </View>
        </View>

        {/* ── VISIBILITY ──────────────────────────────────────────────── */}
        <SectionHeader title="Visibility" />
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Who Can See Your Profile</Text>
          <View style={styles.visibilityList}>
            {[
              { icon: '👀', text: 'Only users within your age and distance preferences can see you' },
              { icon: '🚫', text: 'Blocked users cannot view your profile or contact you' },
              { icon: '🔕', text: 'Incognito mode (Gold/Platinum) hides your profile until you like someone' },
              { icon: '🌍', text: 'Your exact location is never shown — only distance in km/miles' },
            ].map(({ icon, text }) => (
              <View key={text} style={styles.bulletRow}>
                <Text style={styles.bulletIcon}>{icon}</Text>
                <Text style={styles.bulletText}>{text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── DATA REQUESTS (GDPR) ─────────────────────────────────────── */}
        <SectionHeader title="Your Rights (GDPR)" />
        <View style={styles.card}>
          <Text style={styles.cardDesc} style={{ marginBottom: 12 }}>
            Under the General Data Protection Regulation (GDPR), you have the following rights:
          </Text>
          {[
            { right: 'Right to Access', desc: 'Request a copy of all data we hold about you.' },
            { right: 'Right to Erasure', desc: 'Request deletion of your account and all associated data.' },
            { right: 'Right to Portability', desc: 'Receive your data in a machine-readable format.' },
            { right: 'Right to Rectification', desc: 'Correct any inaccurate personal data.' },
            { right: 'Right to Object', desc: 'Object to processing of your data for marketing purposes.' },
          ].map(({ right, desc }) => (
            <View key={right} style={styles.gdprRow}>
              <Text style={styles.gdprRight}>{right}</Text>
              <Text style={styles.gdprDesc}>{desc}</Text>
            </View>
          ))}
          <Text style={styles.gdprContact}>
            For any data requests, contact us at: privacy@genxaura.com
          </Text>
        </View>

        {/* ── PRIVACY POLICY ──────────────────────────────────────────── */}
        <SectionHeader title="Legal" />
        <View style={styles.card}>
          <TouchableOpacity style={styles.linkRow} onPress={handlePrivacyPolicy}>
            <Text style={styles.linkRowText}>Privacy Policy</Text>
            <Text style={styles.linkRowChevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() =>
              Alert.alert(
                'Terms of Service',
                'View full terms at https://genxaura.com/terms',
                [{ text: 'OK' }],
              )
            }
          >
            <Text style={styles.linkRowText}>Terms of Service</Text>
            <Text style={styles.linkRowChevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() =>
              Alert.alert(
                'Cookie Policy',
                'We use only essential cookies. No third-party advertising cookies are used.',
                [{ text: 'OK' }],
              )
            }
          >
            <Text style={styles.linkRowText}>Cookie Policy</Text>
            <Text style={styles.linkRowChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── DANGER ZONE ─────────────────────────────────────────────── */}
        <SectionHeader title="Danger Zone" />
        <View style={[styles.card, styles.dangerCard]}>
          <Text style={styles.dangerTitle}>Delete Account</Text>
          <Text style={styles.dangerDesc}>
            Permanently deletes your profile, matches, messages, and all associated data. This cannot be undone.
          </Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccountPress}>
            <Text style={styles.deleteBtnText}>Delete My Account</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── DELETE ACCOUNT MODAL ────────────────────────────────────── */}
      <Modal
        visible={deleteModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Delete Account</Text>

            {deleteConfirmStep === 1 ? (
              <>
                <Text style={styles.modalDesc}>
                  Are you absolutely sure? This will permanently delete:
                </Text>
                <View style={{ gap: 6, marginVertical: 12 }}>
                  {['Your profile and photos', 'All matches and conversations', 'Your subscription and purchase history', 'All personal data'].map((item) => (
                    <Text key={item} style={styles.deleteListItem}>• {item}</Text>
                  ))}
                </View>
                <Text style={[styles.modalDesc, { color: COLORS.error, marginBottom: 20 }]}>
                  This action cannot be undone.
                </Text>
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteStep1}>
                  <Text style={styles.deleteBtnText}>I understand, continue</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalDesc}>
                  Type <Text style={{ color: COLORS.error, fontWeight: '700' }}>DELETE</Text> to confirm deletion of your account.
                </Text>
                <TextInput
                  style={styles.deleteInput}
                  value={deleteText}
                  onChangeText={setDeleteText}
                  placeholder="Type DELETE here"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.deleteBtn, (deleteText.trim() !== 'DELETE' || deleting) && styles.btnDisabled]}
                  onPress={handleDeleteStep2}
                  disabled={deleteText.trim() !== 'DELETE' || deleting}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.deleteBtnText}>Permanently Delete Account</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={styles.sectionHeader}>{title}</Text>
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
    paddingTop: 16,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  cardDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLabel: { flex: 1, gap: 4 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: 8,
    padding: 10,
  },
  infoIcon: { fontSize: 16 },
  infoText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  visibilityList: { gap: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletIcon: { fontSize: 18, lineHeight: 22 },
  bulletText: { flex: 1, fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  gdprRow: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 10,
    gap: 2,
  },
  gdprRight: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  gdprDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  gdprContact: {
    fontSize: 13,
    color: COLORS.primary,
    marginTop: 4,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  linkRowText: { fontSize: 15, color: COLORS.text },
  linkRowChevron: { fontSize: 22, color: COLORS.textMuted },
  divider: { height: 1, backgroundColor: COLORS.border },
  // Danger Zone
  dangerCard: {
    borderColor: '#FF444430',
    backgroundColor: '#FF444408',
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.error,
  },
  dangerDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  deleteBtn: {
    backgroundColor: COLORS.error,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  deleteBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  outlineBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    marginTop: 4,
  },
  outlineBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  btnDisabled: { opacity: 0.5 },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: 4,
  },
  modalDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
  deleteListItem: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  deleteInput: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.error,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    textAlign: 'center',
    fontWeight: '700',
    letterSpacing: 2,
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, color: COLORS.textMuted },
});
