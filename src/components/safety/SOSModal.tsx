import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  PanResponder,
  Alert,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../constants';

interface Props {
  visible: boolean;
  onClose: () => void;
  matchName?: string;
}

type SOSState = 'idle' | 'holding' | 'cancelled' | 'activated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUTTON_SIZE = SCREEN_WIDTH * 0.55;
const RING_SIZE = BUTTON_SIZE + 32;
const HOLD_DURATION = 3000;

export default function SOSModal({ visible, onClose, matchName }: Props) {
  const [sosState, setSOSState] = useState<SOSState>('idle');
  const [activatedAt, setActivatedAt] = useState<Date | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const holdProgress = useRef(new Animated.Value(0)).current;
  const holdAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const holdStarted = useRef(false);

  // Ring scale pulse when activated
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!visible) {
      resetState();
    }
  }, [visible]);

  useEffect(() => {
    if (sosState === 'activated') {
      startPulse();
    } else {
      if (pulseRef.current) pulseRef.current.stop();
      pulseAnim.setValue(1);
    }
    return () => {
      if (pulseRef.current) pulseRef.current.stop();
    };
  }, [sosState]);

  const startPulse = () => {
    pulseRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    pulseRef.current.start();
  };

  const resetState = () => {
    setSOSState('idle');
    setActivatedAt(null);
    holdProgress.setValue(0);
    holdStarted.current = false;
    if (holdAnimation.current) holdAnimation.current.stop();
    if (pulseRef.current) pulseRef.current.stop();
    pulseAnim.setValue(1);
  };

  const handleHoldStart = () => {
    if (sosState === 'activated') return;
    holdStarted.current = true;
    setSOSState('holding');
    holdProgress.setValue(0);

    holdAnimation.current = Animated.timing(holdProgress, {
      toValue: 1,
      duration: HOLD_DURATION,
      useNativeDriver: false,
    });

    holdAnimation.current.start(({ finished }) => {
      if (finished && holdStarted.current) {
        activateSOS();
      }
    });
  };

  const handleHoldEnd = () => {
    if (sosState === 'activated') return;
    if (holdStarted.current && sosState === 'holding') {
      holdStarted.current = false;
      if (holdAnimation.current) holdAnimation.current.stop();
      holdProgress.setValue(0);
      setSOSState('cancelled');
      setTimeout(() => {
        if (sosState !== 'activated') setSOSState('idle');
      }, 2000);
    }
  };

  const activateSOS = async () => {
    holdStarted.current = false;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    // Extra haptic pulses for emphasis
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 400);
    setActivatedAt(new Date());
    setSOSState('activated');
  };

  const handleCancelSOS = () => {
    Alert.alert(
      'Cancel SOS?',
      'Are you sure you want to cancel the SOS alert?',
      [
        { text: 'Keep SOS Active', style: 'cancel' },
        {
          text: 'Cancel SOS',
          onPress: () => {
            resetState();
          },
        },
      ],
    );
  };

  // Stroke dash for ring progress
  const circumference = Math.PI * RING_SIZE;
  const strokeDashoffset = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  // Button scale feedback
  const btnScale = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => false,
      onPanResponderGrant: () => {
        Animated.spring(btnScale, { toValue: 0.95, useNativeDriver: true }).start();
        handleHoldStart();
      },
      onPanResponderRelease: () => {
        Animated.spring(btnScale, { toValue: 1, useNativeDriver: true }).start();
        handleHoldEnd();
      },
      onPanResponderTerminate: () => {
        Animated.spring(btnScale, { toValue: 1, useNativeDriver: true }).start();
        handleHoldEnd();
      },
    }),
  ).current;

  const formattedTime = activatedAt
    ? activatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={() => {
        if (sosState !== 'activated') onClose();
      }}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.topRow}>
          {sosState !== 'activated' && (
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          )}
          <View style={styles.topRowSpacer} />
          <TouchableOpacity onPress={() => setShowInfo(!showInfo)}>
            <Text style={styles.infoLink}>What is SOS?</Text>
          </TouchableOpacity>
        </View>

        {/* Info panel */}
        {showInfo && (
          <View style={styles.infoPanel}>
            <Text style={styles.infoPanelTitle}>About SOS</Text>
            <Text style={styles.infoPanelText}>
              The SOS button is designed to quickly alert emergency contacts and services when you feel unsafe during a date.
              {'\n\n'}
              Hold the button for 3 seconds to activate. Once activated, your location is logged and emergency contacts are notified.
              {'\n\n'}
              <Text style={styles.demoNote}>
                Demo Mode: Connect the Noonlight API for real emergency dispatch integration.
              </Text>
            </Text>
            <TouchableOpacity onPress={() => setShowInfo(false)}>
              <Text style={styles.infoPanelClose}>Got it</Text>
            </TouchableOpacity>
          </View>
        )}

        {sosState !== 'activated' ? (
          // ── PRE-ACTIVATION ──────────────────────────────────────────
          <View style={styles.content}>
            <Text style={styles.title}>Emergency SOS</Text>
            {matchName && (
              <Text style={styles.subtitle}>Current date: {matchName}</Text>
            )}
            <Text style={styles.instructions}>
              {sosState === 'holding'
                ? 'Keep holding...'
                : sosState === 'cancelled'
                ? 'SOS Cancelled'
                : 'Hold the button for 3 seconds to activate'}
            </Text>

            {/* Animated ring + button */}
            <View style={styles.buttonWrapper}>
              {/* Progress ring using Animated border trick */}
              <Animated.View
                style={[
                  styles.progressRing,
                  {
                    borderColor: holdProgress.interpolate({
                      inputRange: [0, 0.01, 1],
                      outputRange: ['#333333', '#FF3333', '#FF0000'],
                    }),
                    transform: [{ scale: sosState === 'holding' ? 1.02 : 1 }],
                  },
                ]}
              />
              {/* Inner fill indicator using clip */}
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    opacity: holdProgress,
                    transform: [
                      {
                        scaleY: holdProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 1],
                        }),
                      },
                    ],
                  },
                ]}
              />

              <Animated.View
                style={[styles.sosButton, { transform: [{ scale: btnScale }] }]}
                {...panResponder.panHandlers}
              >
                <Text style={styles.sosButtonText}>🆘</Text>
                <Text style={styles.sosButtonLabel}>HOLD TO{'\n'}ACTIVATE SOS</Text>
              </Animated.View>
            </View>

            {sosState === 'holding' && (
              <Animated.View
                style={[
                  styles.countdownBar,
                  {
                    width: holdProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            )}

            {sosState === 'cancelled' && (
              <View style={styles.cancelledBadge}>
                <Text style={styles.cancelledText}>SOS Cancelled — You're safe</Text>
              </View>
            )}
          </View>
        ) : (
          // ── ACTIVATED ───────────────────────────────────────────────
          <View style={styles.content}>
            <Animated.View style={[styles.activatedCircle, { transform: [{ scale: pulseAnim }] }]}>
              <Text style={styles.activatedIcon}>🆘</Text>
            </Animated.View>

            <Text style={styles.activatedTitle}>SOS Activated</Text>
            <Text style={styles.activatedSubtitle}>
              Emergency services have been notified
            </Text>

            <View style={styles.activatedInfoCard}>
              <Text style={styles.activatedInfoText}>
                📍 Your last location has been shared with emergency contacts
              </Text>
              <Text style={styles.activatedInfoText}>
                🕐 Activated at {formattedTime}
              </Text>
              {matchName && (
                <Text style={styles.activatedInfoText}>
                  👤 Date: {matchName}
                </Text>
              )}
            </View>

            <TouchableOpacity style={styles.cancelSOSBtn} onPress={handleCancelSOS}>
              <Text style={styles.cancelSOSBtnText}>CANCEL SOS</Text>
            </TouchableOpacity>

            <Text style={styles.demoDisclaimer}>
              ⚠️ Demo mode — connect Noonlight API for real emergency dispatch
            </Text>
          </View>
        )}
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
    justifyContent: 'space-between',
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
  infoLink: { fontSize: 14, color: '#888888', textDecorationLine: 'underline' },
  // Info panel
  infoPanel: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333333',
    gap: 8,
  },
  infoPanelTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  infoPanelText: { fontSize: 13, color: '#999999', lineHeight: 20 },
  demoNote: { color: COLORS.warning, fontStyle: 'italic' },
  infoPanelClose: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: 4,
  },
  // Content
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
  },
  instructions: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 8,
    minHeight: 24,
  },
  // SOS button and ring
  buttonWrapper: {
    width: RING_SIZE + 16,
    height: RING_SIZE + 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  progressRing: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 5,
    borderColor: '#333333',
  },
  progressFill: {
    position: 'absolute',
    width: RING_SIZE - 10,
    height: RING_SIZE - 10,
    borderRadius: (RING_SIZE - 10) / 2,
    backgroundColor: 'rgba(255, 0, 0, 0.08)',
    bottom: 0,
    left: 5,
  },
  sosButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: '#CC0000',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#FF0000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    gap: 6,
  },
  sosButtonText: { fontSize: 40 },
  sosButtonLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 18,
    letterSpacing: 1,
  },
  // Countdown bar
  countdownBar: {
    height: 4,
    backgroundColor: '#FF0000',
    borderRadius: 2,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  // Cancelled
  cancelledBadge: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#333333',
  },
  cancelledText: { fontSize: 14, color: '#888888', fontWeight: '600' },
  // Activated state
  activatedCircle: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: '#CC0000',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    shadowColor: '#FF0000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    marginBottom: 8,
  },
  activatedIcon: { fontSize: 60 },
  activatedTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FF2222',
    textAlign: 'center',
  },
  activatedSubtitle: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
  },
  activatedInfoCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    gap: 10,
    borderWidth: 1,
    borderColor: '#FF222230',
  },
  activatedInfoText: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  cancelSOSBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderWidth: 2,
    borderColor: '#FF2222',
    alignItems: 'center',
    marginTop: 8,
  },
  cancelSOSBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FF2222',
    letterSpacing: 2,
  },
  demoDisclaimer: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
