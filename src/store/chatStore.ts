import { create } from 'zustand';
import { matchApi, chatApi } from '../services/api';
import socketService from '../sockets/socketService';

interface Message {
  _id: string;
  matchId: string;
  senderId: string;
  content: string;
  type: string;
  mediaUrl?: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
  senderProfile?: any;
}

interface Match {
  _id: string;
  users: string[];
  otherUser: any;
  unreadCount: number;
  lastMessagePreview?: any;
  createdAt: string;
}

interface TypingState {
  [matchId: string]: { [userId: string]: boolean };
}

interface ChatState {
  matches: Match[];
  messages: Record<string, Message[]>;
  typing: TypingState;
  onlineUsers: Set<string>;
  activeMatchId: string | null;
  isLoadingMatches: boolean;
  isLoadingMessages: Record<string, boolean>;

  // Actions
  loadMatches: () => Promise<void>;
  loadMessages: (matchId: string, page?: number) => Promise<void>;
  sendMessage: (matchId: string, content: string, type?: string, mediaUrl?: string) => void;
  setTyping: (matchId: string, userId: string, isTyping: boolean) => void;
  markRead: (matchId: string) => void;
  addMessage: (message: Message) => void;
  updateReadReceipt: (matchId: string, messageIds: string[]) => void;
  setActiveMatch: (matchId: string | null) => void;
  setUserOnline: (userId: string, online: boolean) => void;
  initSocketListeners: () => () => void;
  unmatch: (matchId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  matches: [],
  messages: {},
  typing: {},
  onlineUsers: new Set(),
  activeMatchId: null,
  isLoadingMatches: false,
  isLoadingMessages: {},

  loadMatches: async () => {
    set({ isLoadingMatches: true });
    try {
      const { data } = await matchApi.getMatches();
      set({ matches: data.data });
    } catch (err) {
      console.error('[ChatStore] Load matches error:', err);
    } finally {
      set({ isLoadingMatches: false });
    }
  },

  loadMessages: async (matchId, page = 1) => {
    set((state) => ({
      isLoadingMessages: { ...state.isLoadingMessages, [matchId]: true },
    }));
    try {
      const { data } = await chatApi.getMessages(matchId, page);
      const newMsgs: Message[] = data.data.messages;
      set((state) => ({
        messages: {
          ...state.messages,
          [matchId]:
            page === 1
              ? newMsgs
              : [...newMsgs, ...(state.messages[matchId] || [])],
        },
      }));

      // Join socket room
      socketService.joinMatch(matchId);

      // Mark as read
      get().markRead(matchId);
    } catch (err) {
      console.error('[ChatStore] Load messages error:', err);
    } finally {
      set((state) => ({
        isLoadingMessages: { ...state.isLoadingMessages, [matchId]: false },
      }));
    }
  },

  sendMessage: (matchId, content, type = 'text', mediaUrl) => {
    socketService.sendMessage({ matchId, content, type, mediaUrl });
  },

  setTyping: (matchId, userId, isTyping) => {
    set((state) => ({
      typing: {
        ...state.typing,
        [matchId]: { ...(state.typing[matchId] || {}), [userId]: isTyping },
      },
    }));
  },

  markRead: (matchId) => {
    socketService.markRead(matchId);
    // Optimistically clear unread count
    set((state) => ({
      matches: state.matches.map((m) =>
        m._id === matchId ? { ...m, unreadCount: 0 } : m
      ),
    }));
  },

  addMessage: (message) => {
    set((state) => {
      const existing = state.messages[message.matchId] || [];
      // Deduplicate
      if (existing.some((m) => m._id === message._id)) return state;

      const updated = [...existing, message];
      const updatedMatches = state.matches.map((m) =>
        m._id === message.matchId
          ? {
              ...m,
              lastMessagePreview: {
                content: message.type === 'image' ? '📷 Photo' : message.content,
                senderId: message.senderId,
                createdAt: message.createdAt,
              },
            }
          : m
      );

      return {
        messages: { ...state.messages, [message.matchId]: updated },
        matches: updatedMatches,
      };
    });
  },

  updateReadReceipt: (matchId, messageIds) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [matchId]: (state.messages[matchId] || []).map((m) =>
          messageIds.includes(m._id) ? { ...m, read: true } : m
        ),
      },
    }));
  },

  setActiveMatch: (matchId) => {
    const prev = get().activeMatchId;
    if (prev) socketService.leaveMatch(prev);
    set({ activeMatchId: matchId });
  },

  setUserOnline: (userId, online) => {
    set((state) => {
      const next = new Set(state.onlineUsers);
      online ? next.add(userId) : next.delete(userId);
      return { onlineUsers: next };
    });
  },

  initSocketListeners: () => {
    const unsubMessage = socketService.onMessage((msg) => {
      get().addMessage(msg);
    });

    const unsubTyping = socketService.onTyping(({ matchId, userId, isTyping }) => {
      get().setTyping(matchId, userId, isTyping);
    });

    const unsubRead = socketService.onReadReceipt(({ matchId, messageIds }) => {
      get().updateReadReceipt(matchId, messageIds);
    });

    const unsubOnline = socketService.onUserOnline(({ userId }) => {
      get().setUserOnline(userId, true);
    });

    const unsubOffline = socketService.onUserOffline(({ userId }) => {
      get().setUserOnline(userId, false);
    });

    return () => {
      unsubMessage();
      unsubTyping();
      unsubRead();
      unsubOnline();
      unsubOffline();
    };
  },

  unmatch: async (matchId) => {
    try {
      await matchApi.unmatch(matchId);
      set((state) => ({
        matches: state.matches.filter((m) => m._id !== matchId),
        messages: Object.fromEntries(
          Object.entries(state.messages).filter(([k]) => k !== matchId)
        ),
      }));
    } catch (err) {
      console.error('[ChatStore] Unmatch error:', err);
    }
  },
}));
