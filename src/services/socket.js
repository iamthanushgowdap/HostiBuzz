import { io } from 'socket.io-client';
import { getState } from './state.js';
import { Notifier } from './notifier.js';

class SocketService {
  constructor() {
    this.socket = null;
    this.currentEventId = null;
    this.currentRole = null;
    this.joinedEventId = null;
    this.listeners = new Map();
    this.lastVersion = new Map();
    this.status = 'offline'; // 'offline', 'connecting', 'connected', 'joined'
    this.statusListeners = [];
    this.queue = [];
    this.isReady = false;
  }

  init() {
    if (this.socket) return;

    // ELITE FIX: Enterprise Protocol Detection
    const isSecure = window.location.protocol === "https:";
    const host = window.location.hostname || 'localhost';
    
    // Choose WSS for Production, HTTP for Local
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 
                      (isSecure ? `wss://${host}` : `http://${host}:5000`);
    
    console.log(`🔌 Initializing Socket on: ${socketUrl} [Secure: ${isSecure}]`);
    this.updateStatus('connecting');

    this.socket = io(socketUrl, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      transports: ["websocket"] // Enforce WebSocket for performance
    });

    this.socket.on('connect', () => {
      this.updateStatus('connected');
      
      if (this.currentEventId) {
        this.joinRoom(this.currentEventId, this.currentRole);
      } else {
        const user = getState('user');
        if (user && user.event_id) {
          this.joinRoom(user.event_id, user.role);
        }
      }
    });

    this.socket.on('connect_error', (err) => {
      console.error('📡 Pulse Link Error:', err.message);
      this.updateStatus('offline');
      this.isReady = false; // Connection lost, lock emits
    });

    this.socket.on('disconnect', () => {
      console.warn('⚠️ Pulse Link Severed → Fallback to Supabase Heartbeat');
      this.updateStatus('offline');
      this.isReady = false;
    });

    this.socket.on('joined_event', (data) => {
      this.joinedEventId = data.eventId;
      this.updateStatus('joined');
      this.isReady = true;
      console.log(`%c✅ Verified Room Membership: ${data.eventId}`, 'color: #00ff00; font-weight: bold');
      
      // Flush Pulse Queue
      if (this.queue.length > 0) {
        console.log(`🔋 Flushing ${this.queue.length} buffered Pulses...`);
        this.queue.forEach(({ event, data }) => {
          this.socket.emit(event, data);
        });
        this.queue = [];
      }
    });

    // Global Event Forwarder
    const syncEvents = ['round_started', 'leaderboard_updated', 'team_eliminated', 'round_status_updated'];
    syncEvents.forEach(event => {
      this.socket.on(event, (data) => {
        if (this.isStale(data)) return;
        
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach(cb => cb(data));
      });
    });

    this.socket.on('announcement', (data) => {
      if (this.isStale(data)) return;
      Notifier.toast(data.message, 'info', { duration: 10000 });
    });
  }

  updateStatus(newStatus) {
    this.status = newStatus;
    this.statusListeners.forEach(cb => cb(newStatus));
  }

  onStatusChange(callback) {
    this.statusListeners.push(callback);
    callback(this.status);
    return () => {
      this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
    };
  }

  isStale(data) {
    if (!data.eventId || !data.version) return false;
    const last = this.lastVersion.get(data.eventId) || 0;
    if (data.version <= last) return true;
    this.lastVersion.set(data.eventId, data.version);
    return false;
  }

  joinRoom(eventId, role = 'team') {
    if (!this.socket || !eventId) return;
    this.currentEventId = eventId;
    this.currentRole = role;
    this.isReady = false; // Reset readiness for new room join
    this.socket.emit('join_event', { eventId, role });
  }

  emit(event, data) {
    if (!this.socket) return;
    const user = getState('user');
    const targetEventId = data.eventId || this.currentEventId || user?.event_id;
    const payload = { ...data, eventId: targetEventId };
    
    if (!this.isReady) {
       console.log(`⏳ Buffering Pulse [${event}]... waiting for handshake.`);
       this.queue.push({ event, data: payload });
       return;
    }

    this.socket.emit(event, payload);
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const callbacks = this.listeners.get(event) || [];
    this.listeners.set(event, callbacks.filter(cb => cb !== callback));
  }
}

export const socketService = new SocketService();
