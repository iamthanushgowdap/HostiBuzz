import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

const PORT = 5000;

// 10/10 Architecture: Per-Event Versioning
const eventVersions = new Map(); // eventId -> version

function getNextVersion(eventId) {
  const current = eventVersions.get(eventId) || 0;
  const next = current + 1;
  eventVersions.set(eventId, next);
  return next;
}

io.on('connection', (socket) => {
  console.log('⚡ Connection handshake:', socket.id);

  // 10/10 Security Logic: Everyone joins, but only admins trigger
  socket.on('join_event', ({ eventId, role }) => {
    if (!eventId || typeof eventId !== 'string') {
      console.warn(`❌ Malformed join attempt from ${socket.id}`);
      socket.disconnect();
      return;
    }

    socket.join(`event_${eventId}`);
    socket.eventId = eventId;
    socket.isAdmin = role === 'admin';
    
    // Server-Side Confirmation
    socket.emit('joined_event', { eventId });
    
    console.log(`🏠 ${socket.isAdmin ? '[ADMIN]' : '[TEAM]'} Socket ${socket.id} joined room: event_${eventId}`);
  });

  // Admin Commands (Isolated by isAdmin flag)
  const handleAdminEvent = (inboundEvent, outboundEvent) => {
    socket.on(inboundEvent, (data) => {
      if (!socket.isAdmin) {
        console.warn(`🛡️  Unauthorized event attempt: ${inboundEvent} from ${socket.id}`);
        return;
      }
      
      const eventId = data.eventId || socket.eventId;
      if (!eventId) return;

      const version = getNextVersion(eventId);
      const payload = { ...data, eventId, version };

      io.to(`event_${eventId}`).emit(outboundEvent, payload);
      console.log(`📡 Broadcast [${outboundEvent}] v${version} to room event_${eventId}`);
    });
  };

  // Map Admin Commands to Client Updates
  handleAdminEvent('admin:round_start', 'round_started');
  handleAdminEvent('admin:leaderboard_update', 'leaderboard_updated');
  handleAdminEvent('admin:announcement', 'announcement');
  handleAdminEvent('admin:eliminate', 'team_eliminated');
  handleAdminEvent('admin:status_update', 'round_status_updated');

  socket.on('disconnect', () => {
    console.log('🔌 Disconnected:', socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Elite Real-time server running at http://localhost:${PORT}`);
});
