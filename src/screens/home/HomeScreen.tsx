import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SwipeCard } from '../../components/swipe/SwipeCard';
import { SwipeActions } from '../../components/swipe/SwipeActions';
import { MatchPopup } from '../../components/common/MatchPopup';
import BlockReportModal from '../../components/common/BlockReportModal';
import BoostBanner from '../../components/common/BoostBanner';
import { useSwipeStore, SwipeResult, SwipeError } from '../../store/swipeStore';
import { useUserStore } from '../../store/userStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { COLORS } from '../../constants';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const {
    profiles,
    currentIndex,
    isLoading,
    deckVersion,
    lastMatch,
    loadProfiles,
    swipeLike,
    swipeNope,
    swipeSuperLike,
    undoSwipe,
    dismissMatch,
  } = useSwipeStore();

  const { profile: myProfile } = useUserStore();
  const { status: subStatus, sendRose, canUndo, loadStatus: loadSubStatus } = useSubscriptionStore();
  const [blockReportTarget, setBlockReportTarget] = useState<{ userId: string; name: string } | null>(null);
  const handleSendRose = useCallback((userId: string, name: string) => {
    Alert.alert(
      `Send a Rose to ${name}?`,
      `You have ${subStatus?.rosesBalance ?? 0} rose${(subStatus?.rosesBalance ?? 0) !== 1 ? 's' : ''}. This will send one rose.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Rose 🌹',
          onPress: async () => {
            try {
              await sendRose(userId);
              Alert.alert('Rose Sent!', `Your rose was sent to ${name}.`);
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'Could not send rose.');
            }
          },
        },
      ],
    );
  }, [subStatus?.rosesBalance, sendRose]);

  const likesRemaining = subStatus?.remaining?.likes ?? null;
  const showLimitBanner = likesRemaining !== null && likesRemaining <= 10 && subStatus?.tier === 'free';

  useEffect(() => {
    if (profiles.length === 0) {
      loadProfiles();
    }
  }, []);

  const visibleProfiles = profiles.slice(currentIndex, currentIndex + 3);
  const isEmpty = visibleProfiles.length === 0 && !isLoading;
  const topProfile = visibleProfiles[0];

  const showSwipeError = useCallback(
    (error: SwipeError, title = "Couldn't complete that") => {
      if (error.isLimit) {
        // Limit reached: the card stays in the deck — offer an upgrade.
        loadSubStatus();
        Alert.alert('Limit reached', error.message, [
          { text: 'Not now', style: 'cancel' },
          { text: 'Upgrade', onPress: () => navigation.navigate('Subscription') },
        ]);
        return;
      }
      if (error.status === 404) {
        Alert.alert('Profile unavailable', error.message || 'This profile is no longer available.');
        return;
      }
      Alert.alert(title, error.message);
    },
    [navigation, loadSubStatus],
  );

  const handleResult = useCallback(
    (result: SwipeResult) => {
      if (!result.ok && result.error) showSwipeError(result.error);
    },
    [showSwipeError],
  );

  const handleLike = useCallback(async () => {
    if (!topProfile) return;
    handleResult(await swipeLike(topProfile.userId));
  }, [topProfile, swipeLike, handleResult]);

  const handleNope = useCallback(async () => {
    if (!topProfile) return;
    handleResult(await swipeNope(topProfile.userId));
  }, [topProfile, swipeNope, handleResult]);

  const handleSuperLike = useCallback(async () => {
    if (!topProfile) return;
    const result = await swipeSuperLike(topProfile.userId);
    handleResult(result);
    if (result.ok) loadSubStatus(); // refresh super-like balance / remaining
  }, [topProfile, swipeSuperLike, handleResult, loadSubStatus]);

  const handleUndo = useCallback(async () => {
    if (!canUndo()) {
      Alert.alert('No rewinds left', 'Upgrade to rewind more swipes.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Upgrade', onPress: () => navigation.navigate('Subscription') },
      ]);
      return;
    }
    const result = await undoSwipe();
    if (result.ok) {
      loadSubStatus();
    } else if (result.error) {
      showSwipeError(result.error, "Couldn't undo");
    }
  }, [canUndo, undoSwipe, navigation, showSwipeError, loadSubStatus]);

  const handleMatchMessage = useCallback(() => {
    if (!lastMatch) return;
    dismissMatch();
    navigation.navigate('Chat', { matchId: lastMatch.matchId });
  }, [lastMatch, dismissMatch, navigation]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.headerIcon}>👤</Text>
          </TouchableOpacity>

          <Text style={styles.logo}>GenXAura</Text>

          <TouchableOpacity onPress={() => navigation.navigate('MatchList')}>
            <View style={styles.matchesBtn}>
              <Text style={styles.headerIcon}>💬</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Boost active banner */}
        <BoostBanner
          isBoostActive={subStatus?.isBoostActive ?? false}
          boostExpiresAt={subStatus?.boostExpiresAt}
          onExpire={() => {/* status will refresh on next load */}}
        />

        {/* Limit nudge banner */}
        {showLimitBanner && (
          <TouchableOpacity
            style={styles.limitBanner}
            onPress={() => navigation.navigate('Subscription')}
          >
            <Text style={styles.limitBannerText}>
              ⚡ {likesRemaining} likes left today · Upgrade for unlimited
            </Text>
          </TouchableOpacity>
        )}

        {/* Cards area */}
        <View style={styles.cardContainer}>
          {isLoading && profiles.length === 0 ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.emptyText}>Finding your matches...</Text>
            </View>
          ) : isEmpty ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🌍</Text>
              <Text style={styles.emptyTitle}>You've seen everyone!</Text>
              <Text style={styles.emptyText}>
                Check back later for new people in your area
              </Text>
              <TouchableOpacity style={styles.refreshBtn} onPress={loadProfiles}>
                <Text style={styles.refreshText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Render 3 cards (back to front) */}
              {[...visibleProfiles].reverse().map((profile, reverseIdx) => {
                const stackIndex = visibleProfiles.length - 1 - reverseIdx;
                const isTop = stackIndex === 0;
                return (
                  <SwipeCard
                    key={`${profile._id}-${deckVersion}`}
                    profile={profile}
                    isTop={isTop}
                    index={stackIndex}
                    onSwipeLeft={handleNope}
                    onSwipeRight={handleLike}
                    onSwipeSuperLike={handleSuperLike}
                    onReport={(userId, name) => setBlockReportTarget({ userId, name })}
                    onSendRose={handleSendRose}
                    hasRoses={(subStatus?.rosesBalance ?? 0) > 0}
                  />
                );
              })}
            </>
          )}
        </View>

        {/* Action buttons */}
        {!isEmpty && !isLoading && (
          <SwipeActions
            onNope={handleNope}
            onLike={handleLike}
            onSuperLike={handleSuperLike}
            onUndo={handleUndo}
            canUndo={currentIndex > 0}
            disabled={!topProfile}
          />
        )}

        {/* Match popup */}
        <MatchPopup
          visible={!!lastMatch}
          matchedProfile={lastMatch?.profile ?? null}
          myProfile={myProfile as any}
          onSendMessage={handleMatchMessage}
          onKeepSwiping={dismissMatch}
        />

        {/* Block/Report modal */}
        <BlockReportModal
          visible={!!blockReportTarget}
          targetUserId={blockReportTarget?.userId ?? ''}
          targetName={blockReportTarget?.name ?? ''}
          onClose={() => setBlockReportTarget(null)}
          onBlocked={() => {
            setBlockReportTarget(null);
            loadProfiles();
          }}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
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
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  logo: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  headerIcon: {
    fontSize: 24,
  },
  matchesBtn: {
    position: 'relative',
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  refreshBtn: {
    marginTop: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 24,
  },
  refreshText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  limitBanner: {
    backgroundColor: `${COLORS.primary}22`,
    borderWidth: 1,
    borderColor: `${COLORS.primary}55`,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  limitBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'center',
  },
});
