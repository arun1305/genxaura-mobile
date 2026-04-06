import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated as RNAnimated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { COLORS } from '../../constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MatchPopupProps {
  visible: boolean;
  matchedProfile: {
    name: string;
    photos: { url: string }[];
  } | null;
  myProfile: {
    name: string;
    photos: { url: string }[];
  } | null;
  onSendMessage: () => void;
  onKeepSwiping: () => void;
}

export const MatchPopup: React.FC<MatchPopupProps> = ({
  visible,
  matchedProfile,
  myProfile,
  onSendMessage,
  onKeepSwiping,
}) => {
  const scaleAnim = useRef(new RNAnimated.Value(0)).current;
  const opacityAnim = useRef(new RNAnimated.Value(0)).current;
  const photo1Anim = useRef(new RNAnimated.Value(-100)).current;
  const photo2Anim = useRef(new RNAnimated.Value(100)).current;

  useEffect(() => {
    if (visible) {
      // Reset
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      photo1Anim.setValue(-100);
      photo2Anim.setValue(100);

      // Animate in
      RNAnimated.parallel([
        RNAnimated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
        RNAnimated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        RNAnimated.spring(photo1Anim, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8, delay: 150 }),
        RNAnimated.spring(photo2Anim, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8, delay: 150 }),
      ]).start();
    }
  }, [visible]);

  if (!matchedProfile || !myProfile) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <LinearGradient
        colors={['rgba(15,15,26,0.96)', 'rgba(200,80,192,0.3)', 'rgba(255,68,88,0.3)']}
        style={styles.backdrop}
      >
        <RNAnimated.View
          style={[
            styles.container,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          {/* Celebration header */}
          <Text style={styles.matchEmoji}>💫</Text>
          <Text style={styles.title}>It's a Match!</Text>
          <Text style={styles.subtitle}>
            You and {matchedProfile.name} liked each other
          </Text>

          {/* Profile photos */}
          <View style={styles.photosContainer}>
            <RNAnimated.View
              style={[
                styles.photoWrapper,
                styles.photoLeft,
                { transform: [{ translateX: photo1Anim }] },
              ]}
            >
              <Image
                source={{ uri: myProfile.photos[0]?.url }}
                style={styles.photo}
                contentFit="cover"
              />
              <View style={styles.photoRing} />
            </RNAnimated.View>

            <View style={styles.heartCenter}>
              <Text style={styles.heartEmoji}>❤️</Text>
            </View>

            <RNAnimated.View
              style={[
                styles.photoWrapper,
                styles.photoRight,
                { transform: [{ translateX: photo2Anim }] },
              ]}
            >
              <Image
                source={{ uri: matchedProfile.photos[0]?.url }}
                style={styles.photo}
                contentFit="cover"
              />
              <View style={styles.photoRing} />
            </RNAnimated.View>
          </View>

          {/* Actions */}
          <TouchableOpacity style={styles.messageBtn} onPress={onSendMessage}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.messageBtnGradient}
            >
              <Text style={styles.messageBtnText}>Send a Message 💬</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.keepSwipingBtn} onPress={onKeepSwiping}>
            <Text style={styles.keepSwipingText}>Keep Swiping</Text>
          </TouchableOpacity>
        </RNAnimated.View>
      </LinearGradient>
    </Modal>
  );
};

const PHOTO_SIZE = 120;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    width: SCREEN_WIDTH - 48,
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(26,26,46,0.95)',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,68,88,0.3)',
  },
  matchEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    marginBottom: 32,
  },
  photosContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
    height: PHOTO_SIZE + 20,
  },
  photoWrapper: {
    position: 'relative',
  },
  photoLeft: {
    marginRight: -20,
    zIndex: 1,
  },
  photoRight: {
    marginLeft: -20,
    zIndex: 1,
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: PHOTO_SIZE / 2,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  photoRing: {
    position: 'absolute',
    inset: -4,
    borderRadius: (PHOTO_SIZE + 8) / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,68,88,0.4)',
  },
  heartCenter: {
    zIndex: 2,
    backgroundColor: COLORS.surface,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartEmoji: { fontSize: 20 },
  messageBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  messageBtnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  messageBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  keepSwipingBtn: {
    paddingVertical: 12,
  },
  keepSwipingText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
});
