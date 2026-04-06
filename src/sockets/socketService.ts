import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3000';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  async connect(): Promise<void> {
    if (this.socket?.connected) return;

    const token = await SecureStore.getItemAsync('accessToken');
    if (!token) {
      console.warn('[Socket] No auth token, skipping connection');
      return;
    }

    this.socket = io(`${SOCKET_URL}/chat`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
      this.reconnectAttempts++;
    });

    this.socket.on('error', (err) => {
      console.error('[Socket] Error:', err);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinMatch(matchId: string): void {
    this.socket?.emit('join_match', { matchId });
  }

  leaveMatch(matchId: string): void {
    this.socket?.emit('leave_match', { matchId });
  }

  sendMessage(data: {
    matchId: string;
    content: string;
    type?: string;
    mediaUrl?: string;
  }): void {
    this.socket?.emit('send_message', data);
  }

  sendTyping(matchId: string, isTyping: boolean): void {
    this.socket?.emit('typing', { matchId, isTyping });
  }

  markRead(matchId: string): void {
    this.socket?.emit('read_receipt', { matchId });
  }

  checkOnline(userIds: string[]): void {
    this.socket?.emit('check_online', { userIds });
  }

  // ── Event listeners ───────────────────────────────────────────────
  onMessage(callback: (data: any) => void): () => void {
    this.socket?.on('receive_message', callback);
    return () => this.socket?.off('receive_message', callback);
  }

  onTyping(callback: (data: any) => void): () => void {
    this.socket?.on('typing', callback);
    return () => this.socket?.off('typing', callback);
  }

  onReadReceipt(callback: (data: any) => void): () => void {
    this.socket?.on('read_receipt', callback);
    return () => this.socket?.off('read_receipt', callback);
  }

  onUserOnline(callback: (data: { userId: string }) => void): () => void {
    this.socket?.on('user:online', callback);
    return () => this.socket?.off('user:online', callback);
  }

  onUserOffline(callback: (data: { userId: string; lastSeen: string }) => void): () => void {
    this.socket?.on('user:offline', callback);
    return () => this.socket?.off('user:offline', callback);
  }

  onOnlineStatuses(callback: (data: Record<string, boolean>) => void): () => void {
    this.socket?.on('online_statuses', callback);
    return () => this.socket?.off('online_statuses', callback);
  }

  onMessageFlagged(callback: (data: { matchId: string; messageId: string; severity: string; prompt: string }) => void): () => void {
    this.socket?.on('message_flagged', callback);
    return () => this.socket?.off('message_flagged', callback);
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
