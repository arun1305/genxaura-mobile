import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { ChatBubble } from '../../components/chat/ChatBubble';
import GifPickerModal from '../../components/chat/GifPickerModal';
import SOSModal from '../../components/safety/SOSModal';
import { useChatStore, Message } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useUserStore } from '../../store/userStore';
import { chatApi, moderationApi, getApiErrorMessage } from '../../services/api';
import { COLORS } from '../../constants';
import socketService from '../../sockets/socketService';

const TYPING_IDLE_MS = 2000;

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

export default function ChatScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { matchId } = route.params;

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingSentRef = useRef(false);

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showSOS, setShowSOS] = useState(false);
  const [flaggedMessageId, setFlaggedMessageId] = useState<string | null>(null);
  const tenorKeySet = !!process.env.EXPO_PUBLIC_TENOR_API_KEY;

  const authUserId = useAuthStore((s) => s.user?.id);
  const profileUserId = useUserStore((s) => s.profile?.userId);
  const myUserId = authUserId ?? profileUserId ?? null;

  const {
    messages,
    matches,
    typing,
    onlineUsers,
    pagination,
    loadMatches,
    loadMessages,
    loadOlderMessages,
    sendMessage,
    retryMessage,
    discardMessage,
    deleteMessage,
    setActiveMatch,
    isLoadingMessages,
  } = useChatStore();

  const match = matches.find((m) => m._id === matchId);
  const otherUser = match?.otherUser;
  const currentMessages = messages[matchId] || [];
  // Newest first for the inverted list.
  const listData = useMemo(() => [...currentMessages].reverse(), [currentMessages]);
  const hasMore = pagination[matchId]?.hasMore ?? false;
  // Only the OTHER participant's typing state is shown.
  const isTyping = Object.entries(typing[matchId] || {}).some(
    ([uid, v]) => v === true && uid !== myUserId,
  );
  const isOnline = otherUser?.userId && onlineUsers.has(otherUser.userId);
  const isLoading = isLoadingMessages[matchId];
  const isLoadingOlder = isLoading && currentMessages.length > 0;

  const stopTyping = useCallback(() => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = null;
    if (isTypingSentRef.current) {
      isTypingSentRef.current = false;
      socketService.sendTyping(matchId, false);
    }
  }, [matchId]);

  useEffect(() => {
    // Opened from a push / match popup before the match list was loaded.
    if (!useChatStore.getState().matches.some((m) => m._id === matchId)) loadMatches();

    setActiveMatch(matchId).then((res) => {
      if (!res.ok && !res.transient) {
        Alert.alert(
          'Conversation unavailable',
          res.error || 'This conversation is no longer available.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      }
    });
    loadMessages(matchId, 1);

    // Listen for flagged messages ("Does this bother you?")
    const unsubFlag = socketService.onMessageFlagged(({ matchId: flaggedMatchId, messageId }) => {
      if (flaggedMatchId && flaggedMatchId !== matchId) return;
      setFlaggedMessageId(messageId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'Does this message bother you?',
        'Our AI detected content that may be offensive. You can report it or ignore.',
        [
          {
            text: 'Ignore',
            style: 'cancel',
            onPress: () => setFlaggedMessageId(null),
          },
          {
            text: 'Report',
            style: 'destructive',
            onPress: async () => {
              await moderationApi.markMessageBothered(messageId).catch(() => {});
              const otherId = useChatStore
                .getState()
                .matches.find((m) => m._id === matchId)?.otherUser?.userId;
              if (otherId) {
                await moderationApi
                  .submitReport(otherId, 'harassment', 'Offensive message', messageId, matchId)
                  .catch(() => {});
              }
              setFlaggedMessageId(null);
              Alert.alert('Reported', 'Thank you. Our team will review this.');
            },
          },
        ],
      );
    });

    return () => {
      stopTyping();
      setActiveMatch(null);
      unsubFlag();
    };
  }, [matchId]);

  const handleSendResult = useCallback((result: { ok: boolean; error?: string }) => {
    if (result.ok) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, []);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isSending) return;

    stopTyping();
    setIsSending(true);
    // The message stays visible (sending → sent / failed with retry), so the
    // text is never silently lost.
    setInputText('');
    try {
      const result = await sendMessage(matchId, text, 'text');
      handleSendResult(result);
    } finally {
      setIsSending(false);
    }
  }, [inputText, isSending, matchId, sendMessage, stopTyping, handleSendResult]);

  const handleTyping = useCallback(
    (text: string) => {
      setInputText(text);

      if (!text) {
        stopTyping();
        return;
      }

      // Emit "typing" once per burst, then "stopped" after 2s of inactivity.
      if (!isTypingSentRef.current) {
        isTypingSentRef.current = true;
        socketService.sendTyping(matchId, true);
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(stopTyping, TYPING_IDLE_MS);
    },
    [matchId, stopTyping],
  );

  const handleFailedPress = useCallback(
    (message: Message) => {
      if (!message.clientId) return;
      const clientId = message.clientId;
      Alert.alert('Message not sent', message.error || 'This message could not be delivered.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => discardMessage(matchId, clientId),
        },
        {
          text: 'Retry',
          onPress: async () => handleSendResult(await retryMessage(matchId, clientId)),
        },
      ]);
    },
    [matchId, discardMessage, retryMessage, handleSendResult],
  );

  const handleImagePick = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const formData = new FormData();
    formData.append('image', {
      uri: asset.uri,
      type: 'image/jpeg',
      name: 'chat_image.jpg',
    } as any);

    try {
      const { data } = await chatApi.uploadImage(matchId, formData);
      handleSendResult(await sendMessage(matchId, '📷 Photo', 'image', data.data.url));
    } catch (err) {
      Alert.alert('Upload failed', getApiErrorMessage(err, 'Could not send image. Please try again.'));
    }
  }, [matchId, sendMessage, handleSendResult]);

  const handleLoadOlder = useCallback(() => {
    if (!hasMore || isLoading) return;
    loadOlderMessages(matchId);
  }, [hasMore, isLoading, matchId, loadOlderMessages]);

  const renderMessage = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const isOwn = !!myUserId && item.senderId === myUserId;
      // listData is newest-first, so the chronologically previous message is index + 1.
      const prevMsg = listData[index + 1];
      const showTime =
        !prevMsg ||
        new Date(item.createdAt).getTime() -
          new Date(prevMsg.createdAt).getTime() >
          5 * 60 * 1000; // 5 min gap

      return (
        <ChatBubble
          message={item}
          isOwn={isOwn}
          showTime={showTime}
          onPressFailed={() => handleFailedPress(item)}
          onLongPress={() => {
            if (isOwn && !item.status && !item.isDeleted) {
              Alert.alert('Delete Message?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await deleteMessage(matchId, item._id);
                    } catch (err) {
                      Alert.alert(
                        'Could not delete message',
                        getApiErrorMessage(err, 'Please try again.'),
                      );
                    }
                  },
                },
              ]);
            }
          }}
        />
      );
    },
    [listData, myUserId, matchId, deleteMessage, handleFailedPress],
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerProfile}
          disabled={!otherUser?.userId}
          onPress={() =>
            navigation.navigate('ViewProfile', {
              userId: otherUser?.userId,
            })
          }
        >
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: otherUser?.photos?.[0]?.url }}
              style={styles.avatar}
              contentFit="cover"
            />
            {isOnline && <View style={styles.onlineDot} />}
          </View>

          <View>
            <Text style={styles.headerName}>{otherUser?.name || '...'}</Text>
            <Text style={styles.headerStatus}>
              {isTyping
                ? '✍️ typing...'
                : isOnline
                ? '🟢 Active now'
                : otherUser?.lastActive
                ? `Last seen ${formatLastActive(new Date(otherUser.lastActive))}`
                : ''}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() =>
            Alert.alert(
              'Chat Options',
              undefined,
              [
                {
                  text: '🆘 SOS — Emergency',
                  onPress: () => setShowSOS(true),
                },
                {
                  text: '🚩 Report',
                  onPress: () =>
                    otherUser?.userId &&
                    Alert.alert('Report', 'Use the Block/Report option from the profile.'),
                },
                { text: 'Cancel', style: 'cancel' },
              ],
            )
          }
        >
          <Text style={styles.menuIcon}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {isLoading && currentMessages.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : currentMessages.length === 0 ? (
          // Rendered outside the inverted list (an inverted list flips its empty component).
          <View style={[styles.emptyChat, { flex: 1 }]}>
            <Image
              source={{ uri: otherUser?.photos?.[0]?.url }}
              style={styles.emptyChatAvatar}
              contentFit="cover"
            />
            <Text style={styles.emptyChatName}>
              You matched with {otherUser?.name}!
            </Text>
            <Text style={styles.emptyChatHint}>
              Say hello and start the conversation 👋
            </Text>
          </View>
        ) : (
          <FlatList
            inverted
            data={listData}
            renderItem={renderMessage}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.messageList}
            // Inverted list: the "end" is the top of the conversation → older messages.
            onEndReached={handleLoadOlder}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              isLoadingOlder ? (
                <ActivityIndicator
                  color={COLORS.primary}
                  style={{ paddingVertical: 8 }}
                />
              ) : null
            }
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* GIF Picker */}
        <GifPickerModal
          visible={showGifPicker}
          onClose={() => setShowGifPicker(false)}
          onSelect={async (url) => {
            handleSendResult(await sendMessage(matchId, url, 'gif', url));
          }}
        />

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity
            onPress={handleImagePick}
            style={styles.attachBtn}
          >
            <Text style={styles.attachIcon}>📷</Text>
          </TouchableOpacity>

          {tenorKeySet && (
            <TouchableOpacity
              onPress={() => setShowGifPicker(true)}
              style={styles.attachBtn}
            >
              <Text style={styles.gifIcon}>GIF</Text>
            </TouchableOpacity>
          )}

          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={handleTyping}
            placeholder="Type a message..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={2000}
            returnKeyType="default"
          />

          <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
            style={[
              styles.sendBtn,
              (!inputText.trim() || isSending) && styles.sendBtnDisabled,
            ]}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendIcon}>➤</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Emergency */}
      <SOSModal
        visible={showSOS}
        onClose={() => setShowSOS(false)}
        matchName={otherUser?.name}
      />
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  backBtn: {
    padding: 8,
  },
  backIcon: {
    fontSize: 22,
    color: COLORS.text,
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerStatus: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  menuBtn: {
    padding: 8,
  },
  menuIcon: {
    fontSize: 22,
    color: COLORS.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  emptyChat: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
  },
  emptyChatAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: COLORS.primary,
    marginBottom: 6,
  },
  emptyChatName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyChatHint: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
    backgroundColor: COLORS.surface,
  },
  attachBtn: {
    padding: 8,
    marginBottom: 2,
  },
  attachIcon: {
    fontSize: 22,
  },
  gifIcon: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 110,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 20,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.surfaceLight,
    opacity: 0.5,
  },
  sendIcon: {
    fontSize: 16,
    color: '#FFFFFF',
  },
});
