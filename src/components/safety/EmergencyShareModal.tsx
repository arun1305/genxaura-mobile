import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import { verificationApi } from '../../services/api';
import { COLORS } from '../../constants';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Duration = 2 | 4 | 8;

interface ActiveShare {
  shareUrl: string;
  expiresAt: string; // ISO date string
  venueName?: string;
}

export default function EmergencyShareModal({ visible, onClose }: Props) {
  const [activeShare, setActiveShare] = useState<ActiveShare | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [personMeeting, setPersonMeeting] = useState('');
  const [duration, setDuration] = useState<Duration>(4);
  const [creating, setCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  // Countdown timer
  const [timeRemaining, setTimeRemaining] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Location update state
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    if (visible) {
      checkActiveShare();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visible]);

  useEffect(() => {
    if (activeShare) {
      startCountdown(activeShare.expiresAt);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeShare]);

  const checkActiveShare = async () => {
    setLoading(true);
    try {
      const { data } = await verificationApi.getActiveShare();
      if (data?.data?.shareUrl) {
        setActiveShare(data.data);
        setShareUrl(data.data.shareUrl);
      } else {
        setActiveShare(null);
      }
    } catch {
      setActiveShare(null);
    } finally {
      setLoading(false);
    }
  };

  const startCountdown = (expiresAt: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const update = () => {
      const now = Date.now();
      const exp = new Date(expiresAt).getTime();
      const diff = exp - now;
      if (diff <= 0) {
        setTimeRemaining('Expired');
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeRemaining(`${hours}h ${minutes}m remaining`);
    };
    update();
    timerRef.current = setInterval(update, 60000);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data } = await verificationApi.createEmergencyShare({
        venueName: venueName || undefined,
        venueAddress: venueAddress || undefined,
        personMeeting: personMeeting || undefined,
        durationHours: duration,
      });
      const url: string = data?.data?.shareUrl;
      const expiresAt: string = data?.data?.expiresAt;
      if (url) {
        setShareUrl(url);
        setActiveShare({ shareUrl: url, expiresAt, venueName: venueName || undefined });
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Could not create safety share. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await Clipboard.setStringAsync(shareUrl);
    Alert.alert('Copied!', 'Safety link copied to clipboard.');
  };

  const handleShare = async () => {
    if (!shareUrl) return;
    try {
      await Share.share({
        message: `I'm on a date. You can track my safety here: ${shareUrl}`,
        url: shareUrl,
        title: 'My Safety Share Link',
      });
    } catch {
      // user cancelled share sheet
    }
  };

  const handleUpdateLocation = async () => {
    setUpdatingLocation(true);
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'Please allow location access to update your position.');
        setUpdatingLocation(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await verificationApi.updateLocation(loc.coords.latitude, loc.coords.longitude);
      Alert.alert('Location Updated', 'Your trusted friend can now see your current location.');
    } catch {
      Alert.alert('Error', 'Could not update your location. Please try again.');
    } finally {
      setUpdatingLocation(false);
    }
  };

  const handleStop = async () => {
    Alert.alert(
      'Stop Safety Share?',
      'Your trusted friend will no longer be able to track you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop Sharing',
          style: 'destructive',
          onPress: async () => {
            setStopping(true);
            try {
              await verificationApi.deactivateShare();
              setActiveShare(null);
              setShareUrl(null);
              setVenueName('');
              setVenueAddress('');
              setPersonMeeting('');
              if (timerRef.current) clearInterval(timerRef.current);
              onClose();
            } catch {
              Alert.alert('Error', 'Could not stop sharing. Please try again.');
            } finally {
              setStopping(false);
            }
          },
        },
      ],
    );
  };

  const handleClose = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.headerEmoji}>🛡️</Text>
            <Text style={styles.modalTitle}>
              {activeShare ? 'Active Safety Share' : 'Share Your Safety Info'}
            </Text>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : activeShare && shareUrl ? (
            // ── ACTIVE SHARE VIEW ──────────────────────────────────────
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {/* Countdown */}
              <View style={styles.statusBadge}>
                <View style={styles.greenDot} />
                <Text style={styles.statusText}>Active • {timeRemaining}</Text>
              </View>

              {/* Share URL */}
              <Text style={styles.sectionLabel}>Safety Link</Text>
              <View style={styles.urlBox}>
                <Text style={styles.urlText} numberOfLines={2}>{shareUrl}</Text>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} onPress={handleCopy}>
                  <Text style={styles.actionBtnOutlineText}>📋 Copy Link</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={handleShare}>
                  <Text style={styles.actionBtnPrimaryText}>↗ Share</Text>
                </TouchableOpacity>
              </View>

              {/* Update Location */}
              <TouchableOpacity
                style={[styles.updateLocationBtn, updatingLocation && styles.btnDisabled]}
                onPress={handleUpdateLocation}
                disabled={updatingLocation}
              >
                {updatingLocation ? (
                  <ActivityIndicator size="small" color={COLORS.text} />
                ) : (
                  <Text style={styles.updateLocationText}>📍 Update My Location</Text>
                )}
              </TouchableOpacity>

              {/* Stop Sharing */}
              <TouchableOpacity
                style={[styles.stopBtn, stopping && styles.btnDisabled]}
                onPress={handleStop}
                disabled={stopping}
              >
                {stopping ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.stopBtnText}>Stop Sharing</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          ) : (
            // ── CREATE SHARE FORM ──────────────────────────────────────
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.subtitle}>
                Let a trusted friend track your whereabouts during a date. Share the link — they don't need an account.
              </Text>

              {/* Optional fields */}
              <Text style={styles.sectionLabel}>Date Details (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Venue name (e.g. Coffee on Main St)"
                placeholderTextColor={COLORS.textMuted}
                value={venueName}
                onChangeText={setVenueName}
              />
              <TextInput
                style={styles.input}
                placeholder="Venue address"
                placeholderTextColor={COLORS.textMuted}
                value={venueAddress}
                onChangeText={setVenueAddress}
              />
              <TextInput
                style={styles.input}
                placeholder="Person you're meeting (e.g. Alex from GenXAura)"
                placeholderTextColor={COLORS.textMuted}
                value={personMeeting}
                onChangeText={setPersonMeeting}
              />

              {/* Duration selector */}
              <Text style={styles.sectionLabel}>Duration</Text>
              <View style={styles.durationRow}>
                {([2, 4, 8] as Duration[]).map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.durationBtn, duration === d && styles.durationBtnActive]}
                    onPress={() => setDuration(d)}
                  >
                    <Text style={[styles.durationBtnText, duration === d && styles.durationBtnTextActive]}>
                      {d}h
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* If share URL was just created */}
              {shareUrl && (
                <View style={styles.createdUrlCard}>
                  <Text style={styles.createdUrlLabel}>Your Safety Link</Text>
                  <Text style={styles.urlText} numberOfLines={2}>{shareUrl}</Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} onPress={handleCopy}>
                      <Text style={styles.actionBtnOutlineText}>📋 Copy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={handleShare}>
                      <Text style={styles.actionBtnPrimaryText}>↗ Share</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Create button */}
              <TouchableOpacity
                style={[styles.createBtn, creating && styles.btnDisabled]}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.createBtnText}>Create Safety Link</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.footerNote}>
                🔒 The link expires after your chosen duration and contains no personal information.
              </Text>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerEmoji: { fontSize: 22 },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '700' },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  loadingText: { fontSize: 15, color: COLORS.textSecondary },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 14,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 21,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 10,
  },
  durationBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  durationBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}15`,
  },
  durationBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  durationBtnTextActive: { color: COLORS.primary },
  createdUrlCard: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: `${COLORS.success}40`,
    gap: 10,
  },
  createdUrlLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.success,
  },
  urlBox: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  urlText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionBtnOutline: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  actionBtnOutlineText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  actionBtnPrimary: { backgroundColor: COLORS.primary },
  actionBtnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  // Active share
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${COLORS.success}15`,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: `${COLORS.success}40`,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  statusText: { fontSize: 14, fontWeight: '600', color: COLORS.success },
  updateLocationBtn: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  updateLocationText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  stopBtn: {
    backgroundColor: COLORS.error,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  stopBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  // Create form
  createBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  btnDisabled: { opacity: 0.5 },
  footerNote: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
