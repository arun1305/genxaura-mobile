import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  boostExpiresAt?: string;
  isBoostActive: boolean;
  onExpire?: () => void;
}

function getRemainingSeconds(expiresAt: string | undefined): number {
  if (!expiresAt) return 0;
  const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
  return Math.max(0, diff);
}

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const BOOST_GRADIENT: readonly [string, string] = ['#FF6B35', '#E8315B'];

export const BoostBanner: React.FC<Props> = ({ boostExpiresAt, isBoostActive, onExpire }) => {
  const [dismissed, setDismissed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(() => getRemainingSeconds(boostExpiresAt));

  // Pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // Slide-in animation
  const slideAnim = useRef(new Animated.Value(-60)).current;

  // Slide in on mount / when active
  useEffect(() => {
    if (isBoostActive && !dismissed) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 200,
      }).start();
    }
  }, [isBoostActive, dismissed]);

  // Pulse loop
  useEffect(() => {
    if (!isBoostActive || dismissed) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [isBoostActive, dismissed]);

  // Countdown timer
  useEffect(() => {
    if (!isBoostActive || dismissed) return;

    setSecondsLeft(getRemainingSeconds(boostExpiresAt));

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(interval);
          onExpire?.();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [boostExpiresAt, isBoostActive, dismissed]);

  if (!isBoostActive || dismissed) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          transform: [
            { translateY: slideAnim },
            { scale: pulseAnim },
          ],
        },
      ]}
    >
      <LinearGradient
        colors={BOOST_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <Text style={styles.label}>
            {'⚡ Boost Active — You\'re #1 in your area'}
          </Text>
          <Text style={styles.countdown}>{formatCountdown(secondsLeft)}</Text>
        </View>

        <TouchableOpacity
          style={styles.dismissButton}
          onPress={() => setDismissed(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Dismiss boost banner"
          accessibilityRole="button"
        >
          <Text style={styles.dismissText}>×</Text>
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    height: 44,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    flexShrink: 1,
  },
  countdown: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    fontFamily: 'Courier',
    letterSpacing: 0.5,
  },
  dismissButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '300',
    lineHeight: 22,
    includeFontPadding: false,
  },
});

export default BoostBanner;
