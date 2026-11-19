import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { config } from './config.js';
import { connectDatabase } from './lib/db.js';
import { setIo } from './lib/realtime.js';
import { resolveSessionUser } from './lib/session.js';

/**
 * Socket.IO — realtime PUSH only, never authority.
 *
 * The handshake is authenticated with the same session cookie as the
 * REST API (resolveSessionUser); unauthenticated sockets are rejected
 * before they can join any room. Each authenticated socket joins
 * exactly one room, `user:<userId>`, so events can only ever reach
 * their own user. The server emits on real events only (friend
 * requests, invites, challenge progress, notifications); clients
 * always refetch authoritative data over REST afterwards, and the app
 * works fully if the socket never connects.
 */

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

try {
  await connectDatabase();

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: [
        config.FRONTEND_ORIGIN,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ],
      credentials: true,
    },
  });
  setIo(io);

  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const token = cookies[config.SESSION_COOKIE_NAME];
      if (!token) {
        next(new Error('Authentication required'));
        return;
      }
      const user = await resolveSessionUser(token);
      if (!user) {
        next(new Error('Authentication required'));
        return;
      }
      socket.data.authUser = user;
      next();
    } catch {
      next(new Error('Authentication required'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.authUser as { id: string; name: string };
    socket.join(`user:${user.id}`);
    // The server pushes only; clients send no events. Disconnects are
    // silent — REST remains the fallback for every read.
    socket.on('disconnect', () => undefined);
  });

  httpServer.listen(config.PORT, '0.0.0.0', () => {
    console.info(`AHDORA API listening on port ${config.PORT}`);
  });
} catch (error) {
  console.error(
    'API startup failed. Atlas connection is required; check MongoDB network access.',
    error instanceof Error ? error.message : 'Unknown error',
  );
  process.exit(1);
}
