import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { SOCKET_URL } from '../config';
import { refreshSession, notifyAuthFailure } from '../services/api';

type Listener = (...args: any[]) => void;

export interface AckResult {
  ok: boolean;
  error?: string;
  /** True when the server never answered (offline / timeout) — not a refusal. */
  transient?: boolean;
}

export interface SendMessageAck extends AckResult {
  message?: any;
}

export interface SendMessagePayload {
  matchId: string;
  content: string;
  type?: 'text' | 'image' | 'gif' | 'emoji';
  mediaUrl?: string;
  clientId?: string;
}

const ACK_TIMEOUT_MS = 10000;
const MAX_AUTH_RETRIES = 2;

/**
 * Socket.io client for the /chat namespace.
 *
 * - Listeners registered through `on()` live in a registry that survives
 *   reconnects and socket re-creation, so they can be attached once at
 *   session start (even before the socket exists).
 * - The handshake `auth` is a function, so every (re)connect reads the
 *   latest access token from SecureStore.
 * - Rooms joined through `joinMatch()` are re-joined after a reconnect.
 */
class SocketService {
  private socket: Socket | null = null;
  private connecting: Promise<void> | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private joinedRooms = new Set<string>();
  private authRetries = 0;

  async connect(): Promise<void> {
    if (this.socket) {
      if (!this.socket.connected && !this.socket.active) this.socket.connect();
      return;
    }
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        console.warn('[Socket] No auth token, skipping connection');
        return;
      }
      if (this.socket) return;

      const socket = io(`${SOCKET_URL}/chat`, {
        // Evaluated on every connection attempt → always the latest token.
        auth: (cb) => {
          SecureStore.getItemAsync('accessToken')
            .then((t) => cb({ token: t ?? '' }))
            .catch(() => cb({ token: '' }));
        },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 10000,
      });
      this.socket = socket;

      socket.on('connect', () => {
        console.log('[Socket] Connected');
        this.authRetries = 0;
        this.rejoinRooms();
      });

      socket.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected:', reason);
      });

      socket.on('connect_error', (err) => {
        console.warn('[Socket] Connection error:', err.message);
      });

      socket.on('auth_error', (payload: { message?: string; code?: string }) => {
        this.handleAuthError(payload);
      });

      // Attach every registered app-level event to this socket instance.
      this.listeners.forEach((_set, event) => this.attachDispatcher(socket, event));
    })().finally(() => {
      this.connecting = null;
    });

    return this.connecting;
  }

  disconnect(): void {
    this.joinedRooms.clear();
    this.authRetries = 0;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private async handleAuthError(payload: { message?: string; code?: string }) {
    console.warn('[Socket] auth_error:', payload?.code);
    if (payload?.code === 'ACCOUNT_SUSPENDED') {
      notifyAuthFailure('suspended');
      return;
    }
    // TOKEN_INVALID (expired / invalid access token): refresh, then reconnect.
    if (this.authRetries >= MAX_AUTH_RETRIES) return;
    this.authRetries++;
    try {
      await refreshSession();
      // The server disconnects us after auth_error; reconnect manually.
      if (this.socket && !this.socket.connected) this.socket.connect();
    } catch {
      // refreshSession logs the user out if the session is unrecoverable;
      // on a network error the next foreground / connect() will retry.
    }
  }

  private rejoinRooms() {
    this.joinedRooms.forEach((matchId) => {
      this.emitWithAck<AckResult>('join_match', { matchId }).catch(() => undefined);
    });
  }

  private attachDispatcher(socket: Socket, event: string) {
    socket.on(event, (...args: any[]) => {
      this.listeners.get(event)?.forEach((cb) => {
        try {
          cb(...args);
        } catch (err) {
          console.error(`[Socket] listener for "${event}" threw:`, err);
        }
      });
    });
  }

  /** Register an app-level listener. Survives reconnects. Returns an unsubscribe fn. */
  on(event: string, callback: Listener): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
      if (this.socket) this.attachDispatcher(this.socket, event);
    }
    set.add(callback);
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /** Emit and wait for the server ack (rejects on timeout / no connection). */
  async emitWithAck<T>(event: string, payload: unknown, timeoutMs = ACK_TIMEOUT_MS): Promise<T> {
    if (!this.socket) await this.connect();
    const socket = this.socket;
    if (!socket) throw new Error('Not connected to chat. Please check your connection.');
    return new Promise<T>((resolve, reject) => {
      socket.timeout(timeoutMs).emit(event, payload, (err: Error | null, res: T) => {
        if (err) reject(new Error('The server did not respond. Please try again.'));
        else resolve(res);
      });
    });
  }

  /** Join a match room (ack `{ ok, error? }`). The room is re-joined after reconnects. */
  async joinMatch(matchId: string): Promise<AckResult> {
    this.joinedRooms.add(matchId);
    try {
      const res = await this.emitWithAck<AckResult>('join_match', { matchId });
      if (!res?.ok) this.joinedRooms.delete(matchId);
      return res ?? { ok: false, error: 'No response' };
    } catch (err: any) {
      // Keep the room registered: it will be joined on the next (re)connect.
      return { ok: false, error: err?.message, transient: true };
    }
  }

  leaveMatch(matchId: string): void {
    this.joinedRooms.delete(matchId);
    this.socket?.emit('leave_match', { matchId });
  }

  /** Send a message; resolves with the server ack `{ ok, message | error }`. */
  async sendMessage(data: SendMessagePayload): Promise<SendMessageAck> {
    try {
      const res = await this.emitWithAck<SendMessageAck>('send_message', data);
      return res ?? { ok: false, error: 'No response from server' };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? 'Message could not be sent' };
    }
  }

  sendTyping(matchId: string, isTyping: boolean): void {
    if (this.socket?.connected) this.socket.emit('typing', { matchId, isTyping });
  }

  markRead(matchId: string): void {
    this.socket?.emit('read_receipt', { matchId });
  }

  /** Server answers with an `online_statuses` event (Record<userId, boolean>). */
  checkOnline(userIds: string[]): void {
    if (userIds.length === 0) return;
    this.socket?.emit('check_online', { userIds });
  }

  // ── Typed listener helpers ────────────────────────────────────────
  onConnect(callback: () => void): () => void {
    return this.on('connect', callback);
  }

  onMessage(callback: (data: any) => void): () => void {
    return this.on('receive_message', callback);
  }

  onTyping(callback: (data: { matchId: string; userId: string; isTyping: boolean }) => void): () => void {
    return this.on('typing', callback);
  }

  onReadReceipt(callback: (data: { matchId: string; messageIds: string[]; userId: string; readAt: string }) => void): () => void {
    return this.on('read_receipt', callback);
  }

  onUserOnline(callback: (data: { userId: string }) => void): () => void {
    return this.on('user:online', callback);
  }

  onUserOffline(callback: (data: { userId: string; lastSeen: string }) => void): () => void {
    return this.on('user:offline', callback);
  }

  onOnlineStatuses(callback: (data: Record<string, boolean>) => void): () => void {
    return this.on('online_statuses', callback);
  }

  onMessageFlagged(callback: (data: { matchId: string; messageId: string; severity: string; prompt: string }) => void): () => void {
    return this.on('message_flagged', callback);
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  getSocketId(): string | undefined {
    return this.socket?.id;
  }
}

// Singleton
export const socketService = new SocketService();
export default socketService;
