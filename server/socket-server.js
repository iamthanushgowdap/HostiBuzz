import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

// Serve Static Frontend (Vite build output)
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// Use Render's dynamic port or default to 5000
const PORT = process.env.PORT || 5000;

// Handle SPA routing (redirect all unknown requests to index.html)
app.get('/*', (req, res, next) => {
  if (req.path.startsWith('/socket.io')) return next();
  res.sendFile(path.join(distPath, 'index.html'));
});

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
