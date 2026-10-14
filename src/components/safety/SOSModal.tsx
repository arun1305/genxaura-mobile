import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Linking,
  Share,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { verificationApi, getApiErrorMessage } from '../../services/api';
import { startEmergencyLocationTracking } from '../../services/emergencyShareTracker';
import { COLORS } from '../../constants';

interface Props {
  visible: boolean;
  onClose: () => void;
  matchName?: string;
}

/**
 * Local emergency number. 911 for North America, 112 elsewhere (112 works on
 * mobile phones across the EU, UK, India and many other countries).
 */
function getEmergencyNumber(): string {
  let region = '';
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
    region = (locale.split(/[-_]/)[1] || '').toUpperCase();
  } catch {
    region = '';
  }
  return ['US', 'CA', 'MX', 'PR'].includes(region) ? '911' : '112';
}

type ShareState =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'shared'; viaSheet: boolean; locationShared: boolean };

/**
 * SOS sheet. GenXAura does NOT contact anyone automatically — every action
 * here is explicit and the copy states exactly what happened.
 */
export default function SOSModal({ visible, onClose, matchName }: Props) {
  const emergencyNumber = getEmergencyNumber();
  const [shareState, setShareState] = useState<ShareState>({ kind: 'idle' });

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    } else {
      setShareState({ kind: 'idle' });
    }
  }, [visible]);

  const handleCall = async () => {
    const url = `tel:${emergencyNumber}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        'Could not start the call',
        `Please dial ${emergencyNumber} from your phone app.`,
      );
    }
  };

  const handleShareLocation = async () => {
    setShareState({ kind: 'working' });
    try {
      // Reuse an active safety share if there is one, otherwise create one.
      let share: { shareUrl: string; expiresAt: string } | null = null;
      try {
        const { data } = await verificationApi.getActiveEmergencyShare();
        if (data?.data?.shareUrl) share = data.data;
      } catch {
        share = null;
      }
      if (!share) {
        const { data } = await verificationApi.createEmergencyShare({
          matchPersonName: matchName || undefined,
          durationHours: 4,
        });
        share = data.data;
      }
      if (!share?.shareUrl) throw new Error('Could not create a location link.');

      // Send the current position right away and keep it updated.
      let locationShared = false;
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (granted) {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          await verificationApi.updateLocation(loc.coords.latitude, loc.coords.longitude);
          locationShared = true;
        }
      } catch {
        locationShared = false;
      }
      startEmergencyLocationTracking(share.expiresAt);

      const result = await Share.share({
        message: `I need help. Follow my live location on GenXAura Safety: ${share.shareUrl}`,
        title: 'My live location',
      });
      setShareState({
        kind: 'shared',
        viaSheet: result.action === Share.sharedAction,
        locationShared,
      });
    } catch (err) {
      setShareState({ kind: 'idle' });
      Alert.alert('Could not share location', getApiErrorMessage(err, 'Please try again.'));
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.topRow}>
          <View style={styles.topRowSpacer} />
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.icon}>🆘</Text>
          <Text style={styles.title}>Emergency</Text>
          {matchName ? <Text style={styles.subtitle}>Current chat: {matchName}</Text> : null}
          <Text style={styles.notice}>
            GenXAura does not contact anyone automatically. Choose an action below.
          </Text>

          {/* Call emergency services */}
          <TouchableOpacity style={styles.callBtn} onPress={handleCall} activeOpacity={0.85}>
            <Text style={styles.callBtnText}>📞 Call emergency services ({emergencyNumber})</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>
            Opens your phone dialer with {emergencyNumber}. If this is not the right number where you are, dial your local emergency number.
          </Text>

          {/* Share live location */}
          <TouchableOpacity
            style={[styles.shareBtn, shareState.kind === 'working' && styles.btnDisabled]}
            onPress={handleShareLocation}
            disabled={shareState.kind === 'working'}
            activeOpacity={0.85}
          >
            {shareState.kind === 'working' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.shareBtnText}>📍 Share my live location with a trusted contact</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.hint}>
            Creates a private safety link (valid for 4 hours) and opens your share sheet so you can send it to someone you trust.
          </Text>

          {shareState.kind === 'shared' && (
            <View style={styles.resultCard}>
              <Text style={styles.resultText}>
                {shareState.viaSheet
                  ? '✓ The safety link was passed to the app you selected.'
                  : 'The safety link was created, but the share sheet was closed without sending it. Tap the button again to send it.'}
              </Text>
              <Text style={styles.resultText}>
                {shareState.locationShared
                  ? '📍 Your current location was added to the link and is updated every 2 minutes while GenXAura is open.'
                  : '⚠️ Location access is off, so the link does not include your location yet.'}
              </Text>
              <Text style={styles.resultText}>
                You can stop sharing anytime from Safety Center.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  topRowSpacer: { flex: 1 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { fontSize: 16, color: '#AAAAAA', fontWeight: '700' },
  content: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingBottom: 48,
    gap: 14,
  },
  icon: { fontSize: 64 },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FF2222',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
  },
  notice: {
    fontSize: 15,
    color: '#CCCCCC',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  callBtn: {
    width: '100%',
    backgroundColor: '#CC0000',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  callBtnText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  shareBtn: {
    width: '100%',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
    marginTop: 12,
  },
  shareBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  btnDisabled: { opacity: 0.6 },
  hint: {
    fontSize: 12,
    color: '#777777',
    textAlign: 'center',
    lineHeight: 18,
  },
  resultCard: {
    width: '100%',
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#333333',
    marginTop: 8,
  },
  resultText: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
  },
});
