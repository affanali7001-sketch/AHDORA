import { io, type Socket } from 'socket.io-client';
import { API_BASE } from './http.js';

/**
 * Socket.IO client — realtime PUSH only, never authority.
 *
 * The socket authenticates with the same session cookie as the REST
 * API (the cookie is sent automatically). When it connects, the
 * server puts it in the `user:<userId>` room. Every event only tells
 * the app to refetch authoritative data over REST; if the socket
 * never connects, every page still works from the list endpoints.
 * A failed connection is silent — it never blocks the UI.
 *
 * APK note: in the native build the socket URL is the absolute API
 * origin (API_BASE from http.ts). The live server rejects the
 * Capacitor WebView origin at the Socket.IO handshake, so realtime
 * push does NOT connect inside the APK today — that is expected and
 * harmless (REST refetch still works); fixing it needs the server to
 * allow the Capacitor origin, which is a server change, not an APK
 * change. On web, API_BASE is empty and the URL stays '/'.
 */

let socket: Socket | null = null;

export type RealtimeEvent =
  | 'friend_request_received'
  | 'friend_request_accepted'
  | 'challenge_invite_received'
  | 'challenge_invite_response'
  | 'challenge_progress_updated'
  | 'notification_created';

export function connectSocket(): Socket {
  if (socket) return socket;
  socket = io(API_BASE || '/', {
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
  });
  return socket;
}

export function disconnectSocket(): void {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
