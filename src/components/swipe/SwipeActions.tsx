import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { COLORS } from '../../constants';

interface SwipeActionsProps {
  onNope: () => void;
  onLike: () => void;
  onSuperLike: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  disabled?: boolean;
}

const ActionButton: React.FC<{
  onPress: () => void;
  size: number;
  color: string;
  icon: string;
  fontSize: number;
  disabled?: boolean;
}> = ({ onPress, size, color, icon, fontSize, disabled }) => {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <TouchableOpacity
      onPressIn={() => { scale.value = withSpring(0.88); }}
      onPressOut={() => { scale.value = withSpring(1); }}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.9}
    >
      <Animated.View
        style={[
          styles.button,
          { width: size, height: size, borderRadius: size / 2, borderColor: color },
          animStyle,
        ]}
      >
        <Animated.Text style={[styles.icon, { fontSize }]}>{icon}</Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

export const SwipeActions: React.FC<SwipeActionsProps> = ({
  onNope,
  onLike,
  onSuperLike,
  onUndo,
  canUndo = false,
  disabled = false,
}) => {
  return (
    <View style={styles.container}>
      {onUndo && (
        <ActionButton
          onPress={onUndo}
          size={46}
          color={COLORS.warning}
          icon="↩"
          fontSize={20}
          disabled={!canUndo}
        />
      )}
      <ActionButton
        onPress={onNope}
        size={60}
        color={COLORS.nopeRed}
        icon="✕"
        fontSize={24}
        disabled={disabled}
      />
      <ActionButton
        onPress={onSuperLike}
        size={52}
        color={COLORS.superlikeBlue}
        icon="⭐"
        fontSize={20}
        disabled={disabled}
      />
      <ActionButton
        onPress={onLike}
        size={60}
        color={COLORS.likeGreen}
        icon="♥"
        fontSize={26}
        disabled={disabled}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 8,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    backgroundColor: COLORS.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  icon: {
    color: '#FFFFFF',
  },
});
