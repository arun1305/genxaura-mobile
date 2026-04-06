import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { formatLastActive } from '../../../../../packages/utils';
import { COLORS } from '../../constants';

interface ChatBubbleProps {
  message: {
    _id: string;
    content: string;
    type: string;
    mediaUrl?: string;
    read: boolean;
    readAt?: string;
    createdAt: string;
    senderId: string;
    isDeleted?: boolean;
  };
  isOwn: boolean;
  showTime?: boolean;
  onLongPress?: () => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  isOwn,
  showTime = false,
  onLongPress,
}) => {
  const isDeleted = message.isDeleted;

  const renderContent = () => {
    if (isDeleted) {
      return (
        <Text style={[styles.text, styles.deletedText]}>
          🚫 This message was deleted
        </Text>
      );
    }

    if (message.type === 'image' && message.mediaUrl) {
      return (
        <Image
          source={{ uri: message.mediaUrl }}
          style={styles.imageMessage}
          contentFit="cover"
        />
      );
    }

    if (message.type === 'gif' && message.mediaUrl) {
      return (
        <Image
          source={{ uri: message.mediaUrl }}
          style={styles.imageMessage}
          contentFit="cover"
        />
      );
    }

    return <Text style={[styles.text, isOwn && styles.ownText]}>{message.content}</Text>;
  };

  return (
    <View style={[styles.container, isOwn ? styles.ownContainer : styles.otherContainer]}>
      <TouchableOpacity
        onLongPress={onLongPress}
        activeOpacity={0.85}
        style={[
          styles.bubble,
          isOwn ? styles.ownBubble : styles.otherBubble,
          isDeleted && styles.deletedBubble,
          message.type === 'image' && styles.imageBubble,
        ]}
      >
        {renderContent()}
      </TouchableOpacity>

      {(showTime || isOwn) && (
        <View style={[styles.meta, isOwn && styles.ownMeta]}>
          {showTime && (
            <Text style={styles.time}>
              {new Date(message.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          )}
          {isOwn && (
            <Text style={[styles.readStatus, message.read && styles.readStatusSeen]}>
              {message.read ? '✓✓' : '✓'}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 3,
    maxWidth: '80%',
  },
  ownContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  otherContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  ownBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: COLORS.surfaceLight,
    borderBottomLeftRadius: 4,
  },
  deletedBubble: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  imageBubble: {
    padding: 3,
    backgroundColor: 'transparent',
  },
  text: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
  },
  ownText: {
    color: '#FFFFFF',
  },
  deletedText: {
    color: COLORS.textMuted,
    fontStyle: 'italic',
    fontSize: 13,
  },
  imageMessage: {
    width: 200,
    height: 200,
    borderRadius: 15,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    marginHorizontal: 4,
  },
  ownMeta: {
    justifyContent: 'flex-end',
  },
  time: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  readStatus: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  readStatusSeen: {
    color: COLORS.primary,
  },
});
