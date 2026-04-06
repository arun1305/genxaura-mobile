import React, { useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { COLORS, SWIPE_CONFIG } from '../../constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 24;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.68;

// Inline helper - no external package dependency
const calculateAge = (dob: Date): number => {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
};

interface Profile {
  _id: string;
  userId: string;
  name: string;
  dob: string;
  bio: string;
  interests: string[];
  photos: { url: string; order: number; isMain: boolean }[];
  location?: { city?: string };
  distance?: number;
  isBoosted?: boolean;
  isSpotlight?: boolean;
}

interface SwipeCardProps {
  profile: Profile;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeSuperLike: () => void;
  onReport?: (userId: string, name: string) => void;
  onSendRose?: (userId: string, name: string) => void;
  hasRoses?: boolean;
  isTop: boolean;
  index: number;
}

export const SwipeCard: React.FC<SwipeCardProps> = ({
  profile,
  onSwipeLeft,
  onSwipeRight,
  onSwipeSuperLike,
  onReport,
  onSendRose,
  hasRoses,
  isTop,
  index,
}) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const photoIndex = useSharedValue(0);
  const roseAnim = useSharedValue(0);

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleSwipeRight = useCallback(() => {
    triggerHaptic();
    onSwipeRight();
  }, [onSwipeRight, triggerHaptic]);

  const handleSwipeLeft = useCallback(() => {
    triggerHaptic();
    onSwipeLeft();
  }, [onSwipeLeft, triggerHaptic]);

  const handleSuperLike = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onSwipeSuperLike();
  }, [onSwipeSuperLike]);

  const panGesture = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      const shouldSwipeRight = e.translationX > SWIPE_CONFIG.SWIPE_THRESHOLD;
      const shouldSwipeLeft = e.translationX < -SWIPE_CONFIG.SWIPE_THRESHOLD;
      const shouldSuperLike =
        e.translationY < -SWIPE_CONFIG.SWIPE_THRESHOLD &&
        Math.abs(e.translationX) < 80;

      if (shouldSuperLike) {
        translateY.value = withTiming(-SCREEN_HEIGHT, {
          duration: SWIPE_CONFIG.SWIPE_OUT_DURATION,
        });
        translateX.value = withTiming(0, {
          duration: SWIPE_CONFIG.SWIPE_OUT_DURATION,
        });
        runOnJS(handleSuperLike)();
      } else if (shouldSwipeRight) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, {
          duration: SWIPE_CONFIG.SWIPE_OUT_DURATION,
        });
        runOnJS(handleSwipeRight)();
      } else if (shouldSwipeLeft) {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, {
          duration: SWIPE_CONFIG.SWIPE_OUT_DURATION,
        });
        runOnJS(handleSwipeLeft)();
      } else {
        translateX.value = withSpring(0, SWIPE_CONFIG.SPRING_CONFIG);
        translateY.value = withSpring(0, SWIPE_CONFIG.SPRING_CONFIG);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-SWIPE_CONFIG.MAX_ROTATION, 0, SWIPE_CONFIG.MAX_ROTATION],
      Extrapolation.CLAMP,
    );

    const scale = isTop
      ? 1
      : interpolate(index, [0, 1, 2], [0.92, 0.96, 1], Extrapolation.CLAMP);

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
        { scale },
      ],
    };
  });

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  const nopeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-80, 0], [1, 0], Extrapolation.CLAMP),
  }));

  const superlikeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [-80, 0], [1, 0], Extrapolation.CLAMP),
  }));

  const roseOverlayStyle = useAnimatedStyle(() => ({
    opacity: roseAnim.value,
    transform: [{ scale: interpolate(roseAnim.value, [0, 1], [0.5, 1], Extrapolation.CLAMP) }],
  }));

  const handleSendRose = useCallback(() => {
    if (!onSendRose) return;
    roseAnim.value = withTiming(1, { duration: 300 }, () => {
      roseAnim.value = withTiming(0, { duration: 400 });
    });
    runOnJS(onSendRose)(profile.userId, profile.name);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [onSendRose, profile.userId, profile.name]);

  // Safely sort - avoid mutating original array
  const photos = [...(profile.photos || [])].sort((a, b) => a.order - b.order);
  const age = profile.dob ? calculateAge(new Date(profile.dob)) : null;
  const mainPhotoUrl = photos[0]?.url ?? null;

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, cardStyle]}>

        {/* Photo */}
        {mainPhotoUrl ? (
          <Image
            source={{ uri: mainPhotoUrl }}
            style={styles.photo}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.photo, styles.noPhoto]}>
            <Text style={styles.noPhotoText}>No Photo</Text>
          </View>
        )}

        {/* Photo tap zones */}
        <View style={styles.tapZones}>
          <TouchableOpacity
            style={styles.tapLeft}
            onPress={() => {
              if (photoIndex.value > 0) {
                photoIndex.value = photoIndex.value - 1;
              }
            }}
          />
          <TouchableOpacity
            style={styles.tapRight}
            onPress={() => {
              if (photoIndex.value < photos.length - 1) {
                photoIndex.value = photoIndex.value + 1;
              }
            }}
          />
        </View>

        {/* Boost / Spotlight badge */}
        {(profile.isBoosted || profile.isSpotlight) && (
          <View style={styles.featureBadge}>
            <Text style={styles.featureBadgeText}>
              {profile.isBoosted ? '⚡ Boosted' : '✨ Spotlight'}
            </Text>
          </View>
        )}

        {/* Report button */}
        {isTop && onReport && (
          <TouchableOpacity
            style={styles.reportBtn}
            onPress={() => onReport(profile.userId, profile.name)}
          >
            <Text style={styles.reportBtnText}>•••</Text>
          </TouchableOpacity>
        )}

        {/* Rose button */}
        {isTop && onSendRose && hasRoses && (
          <TouchableOpacity style={styles.roseBtn} onPress={handleSendRose}>
            <Text style={styles.roseBtnText}>🌹</Text>
          </TouchableOpacity>
        )}

        {/* Photo dots */}
        {photos.length > 1 && (
          <View style={styles.dotContainer}>
            {photos.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === 0 && styles.dotActive]}
              />
            ))}
          </View>
        )}

        {/* Gradient */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={styles.gradient}
        />

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {profile.name || 'Unknown'}
            </Text>
            {age !== null && <Text style={styles.age}>{age}</Text>}
          </View>

          {profile.location?.city ? (
            <Text style={styles.location}>
              {`📍 ${profile.location.city}${profile.distance != null ? ` · ${profile.distance} km` : ''}`}
            </Text>
          ) : null}

          {profile.bio ? (
            <Text style={styles.bio} numberOfLines={2}>
              {profile.bio}
            </Text>
          ) : null}

          {profile.interests && profile.interests.length > 0 && (
            <View style={styles.interests}>
              {profile.interests.slice(0, 3).map((interest, i) => (
                <View key={i} style={styles.interestTag}>
                  <Text style={styles.interestText}>{interest}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* LIKE overlay */}
        <Animated.View style={[styles.overlay, styles.likeOverlay, likeOpacity]}>
          <Text style={styles.likeText}>LIKE</Text>
        </Animated.View>

        {/* NOPE overlay */}
        <Animated.View style={[styles.overlay, styles.nopeOverlay, nopeOpacity]}>
          <Text style={styles.nopeText}>NOPE</Text>
        </Animated.View>

        {/* SUPER LIKE overlay */}
        <Animated.View style={[styles.overlay, styles.superlikeOverlay, superlikeOpacity]}>
          <Text style={styles.superlikeText}>SUPER LIKE ⭐</Text>
        </Animated.View>

        {/* ROSE overlay */}
        <Animated.View style={[styles.roseOverlay, roseOverlayStyle]}>
          <Text style={styles.roseOverlayText}>🌹</Text>
          <Text style={styles.roseOverlayLabel}>ROSE SENT</Text>
        </Animated.View>

      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  photo: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  noPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceLight,
  },
  noPhotoText: {
    color: COLORS.textMuted,
    fontSize: 16,
  },
  tapZones: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    flexDirection: 'row',
    zIndex: 5,
  },
  tapLeft: { flex: 1 },
  tapRight: { flex: 1 },
  reportBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 7,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  reportBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  dotContainer: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    zIndex: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 20,
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  info: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 24,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 4,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  age: {
    fontSize: 22,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.9)',
  },
  location: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 6,
  },
  bio: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
    marginBottom: 10,
  },
  interests: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  interestTag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  interestText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  overlay: {
    position: 'absolute',
    top: 50,
    padding: 8,
    borderRadius: 8,
    borderWidth: 3,
    zIndex: 10,
  },
  likeOverlay: {
    left: 20,
    borderColor: COLORS.likeGreen,
    transform: [{ rotate: '-20deg' }],
  },
  nopeOverlay: {
    right: 20,
    borderColor: COLORS.nopeRed,
    transform: [{ rotate: '20deg' }],
  },
  superlikeOverlay: {
    alignSelf: 'center',
    borderColor: COLORS.superlikeBlue,
    left: 0,
    right: 0,
    marginHorizontal: 60,
    alignItems: 'center',
  },
  likeText: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.likeGreen,
    letterSpacing: 2,
  },
  nopeText: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.nopeRed,
    letterSpacing: 2,
  },
  superlikeText: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.superlikeBlue,
    letterSpacing: 2,
    textAlign: 'center',
  },
  featureBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 7,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  featureBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  roseBtn: {
    position: 'absolute',
    bottom: 140,
    right: 16,
    zIndex: 7,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 24,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(232,49,91,0.6)',
  },
  roseBtnText: { fontSize: 22 },
  roseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(232,49,91,0.25)',
    zIndex: 11,
  },
  roseOverlayText: { fontSize: 72 },
  roseOverlayLabel: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 3,
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});

export default SwipeCard;
