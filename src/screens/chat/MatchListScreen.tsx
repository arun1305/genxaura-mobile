import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { COLORS } from '../../constants';

export default function MatchListScreen() {
  const formatLastActive = (date: Date): string => {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
};
  const navigation = useNavigation<any>();
  const { matches, loadMatches, isLoadingMatches, onlineUsers, initSocketListeners } =
    useChatStore();
  const { user } = useAuthStore();

  useEffect(() => {
    loadMatches();
    const cleanup = initSocketListeners();
    return cleanup;
  }, []);

  const renderMatch = ({ item }: { item: any }) => {
    const otherUser = item.otherUser;
    const isOnline = otherUser?.userId && onlineUsers.has(otherUser.userId);
    const preview = item.lastMessagePreview;
    const isOwnLast = preview?.senderId === user?._id;

    return (
      <TouchableOpacity
        style={styles.matchItem}
        onPress={() => navigation.navigate('Chat', { matchId: item._id })}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <View style={styles.avatarWrapper}>
          <Image
            source={{ uri: otherUser?.photos?.[0]?.url }}
            style={styles.avatar}
            contentFit="cover"
          />
          {isOnline && <View style={styles.onlineDot} />}
        </View>

        {/* Content */}
        <View style={styles.matchContent}>
          <View style={styles.matchHeader}>
            <Text style={styles.matchName}>{otherUser?.name || 'Unknown'}</Text>
            {preview && (
              <Text style={styles.matchTime}>
                {formatLastActive(new Date(preview.createdAt))}
              </Text>
            )}
          </View>

          <View style={styles.matchFooter}>
            <Text
              style={[
                styles.lastMessage,
                !preview && styles.newMatch,
                item.unreadCount > 0 && styles.unreadMessage,
              ]}
              numberOfLines={1}
            >
              {preview
                ? `${isOwnLast ? 'You: ' : ''}${preview.content}`
                : '🎉 New match! Say hello'}
            </Text>

            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>
                  {item.unreadCount > 9 ? '9+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Separate new matches (no messages) from conversations
  const newMatches = matches.filter((m) => !m.lastMessagePreview);
  const conversations = matches.filter((m) => m.lastMessagePreview);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>

      {isLoadingMatches ? (
        <View style={styles.loading}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : matches.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>💌</Text>
          <Text style={styles.emptyTitle}>No matches yet</Text>
          <Text style={styles.emptyText}>
            Start swiping to find your connections
          </Text>
        </View>
      ) : (
        <FlatList
          data={[
            ...(newMatches.length > 0
              ? [{ type: 'header', title: `New Matches (${newMatches.length})`, id: 'h1' }]
              : []),
            ...newMatches.map((m) => ({ ...m, type: 'match' })),
            ...(conversations.length > 0
              ? [{ type: 'header', title: 'Messages', id: 'h2' }]
              : []),
            ...conversations.map((m) => ({ ...m, type: 'match' })),
          ]}
          keyExtractor={(item: any) => item.id || item._id}
          renderItem={({ item }: any) => {
            if (item.type === 'header') {
              return (
                <Text style={styles.sectionHeader}>{item.title}</Text>
              );
            }
            return renderMatch({ item });
          }}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  list: {
    paddingBottom: 20,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  matchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 14,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  matchContent: {
    flex: 1,
    gap: 4,
  },
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matchName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  matchTime: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  matchFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  newMatch: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  unreadMessage: {
    color: COLORS.text,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
