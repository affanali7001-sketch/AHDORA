import type { Server } from 'socket.io';

/**
 * Socket.IO registry.
 *
 * Sockets only PUSH — they never carry authority. Every event tells the
 * client to refetch the authoritative data over REST afterwards, and
 * the app works fully without a socket (the list endpoints are the
 * fallback). One room per user: `user:<userId>`.
 *
 * No scheduled or push reminders exist here: events are emitted only
 * when a real server event happens while the user is connected.
 */

let io: Server | null = null;

export function setIo(server: Server | null): void {
  io = server;
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  if (!io) return;
  try {
    io.to(`user:${userId}`).emit(event, payload);
  } catch {
    // A failed push must never break the request that triggered it.
  }
}

export function emitToUsers(userIds: string[], event: string, payload: unknown): void {
  for (const userId of userIds) emitToUser(userId, event, payload);
}
