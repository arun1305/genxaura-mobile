export const COLORS = {
  primary: '#FF4458',       // GenXAura brand red-pink
  primaryLight: '#FF6B7A',
  primaryDark: '#D93044',
  secondary: '#FD8C73',     // coral accent
  accent: '#C850C0',        // purple accent for superlike
  superlike: '#1DAEFC',     // Tinder-style blue for superlike
  background: '#0F0F1A',
  surface: '#1A1A2E',
  surfaceLight: '#252540',
  text: '#FFFFFF',
  textSecondary: '#A0A0C0',
  textMuted: '#606080',
  border: '#2A2A45',
  success: '#4CAF50',
  warning: '#FFC107',
  error: '#F44336',
  gradient: ['#FF4458', '#C850C0'] as const,
  likeGreen: '#4CAF50',
  nopeRed: '#FF4458',
  superlikeBlue: '#1DAEFC',
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
};

export const INTERESTS = [
  '🎵 Music',
  '🎬 Movies',
  '📚 Reading',
  '✈️ Travel',
  '🍕 Food',
  '🏋️ Fitness',
  '🎮 Gaming',
  '🎨 Art',
  '📸 Photography',
  '🌿 Nature',
  '🐾 Pets',
  '🍷 Wine',
  '☕ Coffee',
  '🧘 Yoga',
  '🏄 Surfing',
  '🎸 Guitar',
  '💃 Dancing',
  '🏔 Hiking',
  '🎭 Theatre',
  '🌍 Social Justice',
  '🍳 Cooking',
  '🏊 Swimming',
  '🚴 Cycling',
  '🎯 Board Games',
  '🧪 Science',
  '💻 Tech',
  '🎤 Concerts',
  '🏈 Sports',
  '✍️ Writing',
  '🎻 Classical Music',
];

export const SWIPE_CONFIG = {
  SWIPE_THRESHOLD: 100,     // px to trigger swipe
  ROTATION_FACTOR: 0.08,    // card tilt amount
  MAX_ROTATION: 15,         // max degrees
  SWIPE_OUT_DURATION: 300,  // ms
  SPRING_CONFIG: {
    damping: 20,
    stiffness: 200,
    mass: 1,
  },
};

export const PAGINATION = {
  PROFILES_PER_PAGE: 20,
  MESSAGES_PER_PAGE: 50,
  MATCHES_PER_PAGE: 30,
};

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER: 'user',
  IS_ONBOARDED: 'isOnboarded',
  FCM_TOKEN: 'fcmToken',
};

export const SOCKET_EVENTS = {
  SEND_MESSAGE: 'send_message',
  RECEIVE_MESSAGE: 'receive_message',
  TYPING: 'typing',
  READ_RECEIPT: 'read_receipt',
  JOIN_MATCH: 'join_match',
  LEAVE_MATCH: 'leave_match',
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
  CHECK_ONLINE: 'check_online',
} as const;
