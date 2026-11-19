import { io, type Socket } from 'socket.io-client';

/**
 * Socket.IO client — realtime PUSH only, never authority.
 *
 * The socket authenticates with the same session cookie as the REST
 * API (the cookie is sent automatically). When it connects, the
 * server puts it in the `user:<userId>` room. Every event only tells
 * the app to refetch authoritative data over REST; if the socket
 * never connects, every page still works from the list endpoints.
 * A failed connection is silent — it never blocks the UI.
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
  socket = io('/', {
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
