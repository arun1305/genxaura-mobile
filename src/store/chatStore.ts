import { create } from 'zustand';
import { matchApi, chatApi } from '../services/api';
import socketService, { AckResult } from '../sockets/socketService';
import { PAGINATION } from '../constants';

export type MessageStatus = 'sending' | 'sent' | 'failed';

export interface Message {
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
  isDeleted?: boolean;
  /** Client-generated id used to reconcile optimistic messages with the server ack / echo. */
  clientId?: string;
  /** Local delivery state for own messages. Server messages have no status (= sent). */
  status?: MessageStatus;
  error?: string;
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

interface PaginationState {
  page: number;
  hasMore: boolean;
}

type MessageType = 'text' | 'image' | 'gif' | 'emoji';

interface ChatState {
  matches: Match[];
  /** Per match, sorted oldest → newest. */
  messages: Record<string, Message[]>;
  pagination: Record<string, PaginationState>;
  typing: TypingState;
  onlineUsers: Set<string>;
  activeMatchId: string | null;
  isLoadingMatches: boolean;
  isLoadingMessages: Record<string, boolean>;
  /** Logged-in user's id, set at session start (used for own-message checks). */
  myUserId: string | null;

  // Actions
  setMyUserId: (userId: string | null) => void;
  loadMatches: () => Promise<void>;
  loadMessages: (matchId: string, page?: number) => Promise<void>;
  loadOlderMessages: (matchId: string) => Promise<void>;
  sendMessage: (
    matchId: string,
    content: string,
    type?: MessageType,
    mediaUrl?: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  retryMessage: (matchId: string, clientId: string) => Promise<{ ok: boolean; error?: string }>;
  discardMessage: (matchId: string, clientId: string) => void;
  deleteMessage: (matchId: string, messageId: string) => Promise<void>;
  setTyping: (matchId: string, userId: string, isTyping: boolean) => void;
  markRead: (matchId: string) => void;
  addMessage: (message: Message) => void;
  updateReadReceipt: (matchId: string, messageIds: string[]) => void;
  setActiveMatch: (matchId: string | null) => Promise<AckResult>;
  setUserOnline: (userId: string, online: boolean) => void;
  checkOnlineStatuses: () => void;
  initSocketListeners: () => () => void;
  unmatch: (matchId: string) => Promise<void>;
  reset: () => void;
}

const sortByDate = (a: Message, b: Message) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

/** Merge message lists, deduping by _id and clientId (server copy wins over optimistic). */
function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  const byKey = new Map<string, Message>();
  const clientIdToKey = new Map<string, string>();

  const put = (m: Message, preferIncoming: boolean) => {
    if (m.clientId && clientIdToKey.has(m.clientId)) {
      const key = clientIdToKey.get(m.clientId)!;
      const prev = byKey.get(key)!;
      // Replace the optimistic copy with the server copy.
      if (preferIncoming || prev.status) {
        byKey.delete(key);
      } else {
        return;
      }
    }
    const prev = byKey.get(m._id);
    if (prev && !preferIncoming) return;
    byKey.set(m._id, prev ? { ...prev, ...m, status: undefined } : m);
    if (m.clientId) clientIdToKey.set(m.clientId, m._id);
  };

  existing.forEach((m) => put(m, false));
  incoming.forEach((m) => put(m, true));
  return Array.from(byKey.values()).sort(sortByDate);
}

const newClientId = () => `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const previewFor = (m: Message) => ({
  content: m.type === 'image' ? '📷 Photo' : m.type === 'gif' ? 'GIF' : m.content,
  senderId: m.senderId,
  createdAt: m.createdAt,
});

const initialState = {
  matches: [] as Match[],
  messages: {} as Record<string, Message[]>,
  pagination: {} as Record<string, PaginationState>,
  typing: {} as TypingState,
  onlineUsers: new Set<string>(),
  activeMatchId: null as string | null,
  isLoadingMatches: false,
  isLoadingMessages: {} as Record<string, boolean>,
  myUserId: null as string | null,
};

export const useChatStore = create<ChatState>((set, get) => ({
  ...initialState,
  onlineUsers: new Set(),

  setMyUserId: (userId) => set({ myUserId: userId }),

  loadMatches: async () => {
    set({ isLoadingMatches: true });
    try {
      const { data } = await matchApi.getMatches();
      set({ matches: data.data });
      get().checkOnlineStatuses();
    } catch (err) {
      console.error('[ChatStore] Load matches error:', err);
    } finally {
      set({ isLoadingMatches: false });
    }
  },

  checkOnlineStatuses: () => {
    const ids = get()
      .matches.map((m) => m.otherUser?.userId)
      .filter((id): id is string => typeof id === 'string');
    socketService.checkOnline(ids);
  },

  loadMessages: async (matchId, page = 1) => {
    if (get().isLoadingMessages[matchId]) return;
    set((state) => ({
      isLoadingMessages: { ...state.isLoadingMessages, [matchId]: true },
    }));
    try {
      const { data } = await chatApi.getMessages(matchId, page, PAGINATION.MESSAGES_PER_PAGE);
      const newMsgs: Message[] = data.data.messages || [];
      const hasMore: boolean = !!data.data.hasMore;
      set((state) => {
        const prevPage = state.pagination[matchId]?.page ?? 0;
        return {
          messages: {
            ...state.messages,
            [matchId]: mergeMessages(state.messages[matchId] || [], newMsgs),
          },
          pagination: {
            ...state.pagination,
            // A page-1 refresh keeps how far back we already paged.
            [matchId]: page === 1 && prevPage > 1
              ? { page: prevPage, hasMore: state.pagination[matchId].hasMore }
              : { page, hasMore },
          },
        };
      });

      if (page === 1) get().markRead(matchId);
    } catch (err) {
      console.error('[ChatStore] Load messages error:', err);
    } finally {
      set((state) => ({
        isLoadingMessages: { ...state.isLoadingMessages, [matchId]: false },
      }));
    }
  },

  loadOlderMessages: async (matchId) => {
    const p = get().pagination[matchId];
    if (!p || !p.hasMore || get().isLoadingMessages[matchId]) return;
    await get().loadMessages(matchId, p.page + 1);
  },

  sendMessage: async (matchId, content, type = 'text', mediaUrl) => {
    const clientId = newClientId();
    const optimistic: Message = {
      _id: clientId,
      clientId,
      matchId,
      senderId: get().myUserId ?? '',
      content,
      type,
      mediaUrl,
      read: false,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };
    set((state) => ({
      messages: {
        ...state.messages,
        [matchId]: [...(state.messages[matchId] || []), optimistic],
      },
    }));
    return deliver(matchId, optimistic);
  },

  retryMessage: async (matchId, clientId) => {
    const msg = (get().messages[matchId] || []).find(
      (m) => m.clientId === clientId && m.status === 'failed',
    );
    if (!msg) return { ok: false, error: 'Message not found' };
    patchMessage(matchId, clientId, { status: 'sending', error: undefined });
    return deliver(matchId, msg);
  },

  discardMessage: (matchId, clientId) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [matchId]: (state.messages[matchId] || []).filter(
          (m) => !(m.clientId === clientId && m.status),
        ),
      },
    }));
  },

  deleteMessage: async (matchId, messageId) => {
    await chatApi.deleteMessage(messageId); // throws → caller shows an alert
    set((state) => ({
      messages: {
        ...state.messages,
        [matchId]: (state.messages[matchId] || []).map((m) =>
          m._id === messageId ? { ...m, isDeleted: true, content: '', mediaUrl: undefined } : m,
        ),
      },
    }));
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
    const { myUserId, activeMatchId } = get();
    const isOwn = !!myUserId && message.senderId === myUserId;
    const isActive = activeMatchId === message.matchId;
    let isNew = false;

    set((state) => {
      const existing = state.messages[message.matchId] || [];
      // Deduplicate by _id and by clientId (own echo of an optimistic message)
      if (existing.some((m) => m._id === message._id)) return state;
      isNew = !(message.clientId && existing.some((m) => m.clientId === message.clientId));

      const updated = mergeMessages(existing, [message]);
      const matchKnown = state.matches.some((m) => m._id === message.matchId);
      const updatedMatches = state.matches.map((m) =>
        m._id === message.matchId
          ? {
              ...m,
              lastMessagePreview: previewFor(message),
              unreadCount: !isOwn && !isActive && isNew ? (m.unreadCount || 0) + 1 : m.unreadCount,
            }
          : m
      );

      return {
        messages: { ...state.messages, [message.matchId]: updated },
        matches: matchKnown ? updatedMatches : state.matches,
        // The sender stopped typing once the message arrived.
        typing: state.typing[message.matchId]?.[message.senderId]
          ? {
              ...state.typing,
              [message.matchId]: { ...state.typing[message.matchId], [message.senderId]: false },
            }
          : state.typing,
      };
    });

    // A message for a match we don't know yet (e.g. brand new match) → refresh list.
    if (!get().matches.some((m) => m._id === message.matchId)) {
      get().loadMatches();
    }
    if (isActive && !isOwn) get().markRead(message.matchId);
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

  setActiveMatch: async (matchId) => {
    const prev = get().activeMatchId;
    if (prev && prev !== matchId) socketService.leaveMatch(prev);
    set({ activeMatchId: matchId });
    if (!matchId) return { ok: true };
    return socketService.joinMatch(matchId);
  },

  setUserOnline: (userId, online) => {
    set((state) => {
      const next = new Set(state.onlineUsers);
      online ? next.add(userId) : next.delete(userId);
      return { onlineUsers: next };
    });
  },

  initSocketListeners: () => {
    const unsubs = [
      socketService.onConnect(() => {
        // After (re)connect: refresh presence for our matches.
        get().checkOnlineStatuses();
      }),
      socketService.onMessage((msg) => {
        get().addMessage(msg);
      }),
      socketService.onTyping(({ matchId, userId, isTyping }) => {
        if (userId && userId === get().myUserId) return;
        get().setTyping(matchId, userId, isTyping);
      }),
      socketService.onReadReceipt(({ matchId, messageIds }) => {
        get().updateReadReceipt(matchId, messageIds);
      }),
      socketService.onUserOnline(({ userId }) => {
        get().setUserOnline(userId, true);
      }),
      socketService.onUserOffline(({ userId }) => {
        get().setUserOnline(userId, false);
      }),
      socketService.onOnlineStatuses((statuses) => {
        set((state) => {
          const next = new Set(state.onlineUsers);
          Object.entries(statuses || {}).forEach(([uid, online]) => {
            online ? next.add(uid) : next.delete(uid);
          });
          return { onlineUsers: next };
        });
      }),
    ];

    return () => unsubs.forEach((u) => u());
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

  reset: () => set({ ...initialState, onlineUsers: new Set() }),
}));

// ── Internal helpers (need the store instance) ─────────────────────────
function patchMessage(matchId: string, clientId: string, patch: Partial<Message>) {
  useChatStore.setState((state) => ({
    messages: {
      ...state.messages,
      [matchId]: (state.messages[matchId] || []).map((m) =>
        m.clientId === clientId && m.status ? { ...m, ...patch } : m,
      ),
    },
  }));
}

async function deliver(matchId: string, msg: Message): Promise<{ ok: boolean; error?: string }> {
  const ack = await socketService.sendMessage({
    matchId,
    content: msg.content,
    type: msg.type as MessageType,
    mediaUrl: msg.mediaUrl,
    clientId: msg.clientId,
  });

  if (ack.ok && ack.message) {
    const serverMsg: Message = { ...ack.message, clientId: msg.clientId };
    useChatStore.setState((state) => {
      const list = state.messages[matchId] || [];
      return {
        messages: { ...state.messages, [matchId]: mergeMessages(list, [serverMsg]) },
        matches: state.matches.map((m) =>
          m._id === matchId ? { ...m, lastMessagePreview: previewFor(serverMsg) } : m,
        ),
      };
    });
    return { ok: true };
  }
  if (ack.ok) {
    patchMessage(matchId, msg.clientId!, { status: undefined });
    return { ok: true };
  }

  const error = ack.error || 'Message could not be sent';
  patchMessage(matchId, msg.clientId!, { status: 'failed', error });
  return { ok: false, error };
}
