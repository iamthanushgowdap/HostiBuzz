import { supabase } from '../config/supabase.js';
import { getState, setState, saveAuth, clearAuth, subscribe } from './state.js';
import { socketService } from './socket.js';
import { navigate } from '../router.js';

let isListening = false;

export function initGlobalListeners() {
  if (isListening) return;
  isListening = true;

  // Real-time Socket Bridge
  subscribe('user', (user) => {
    if (user && user.event_id) {
      socketService.joinRoom(user.event_id, user.role);
    }
  });

  // Render container for notifications
  const notifContainer = document.createElement('div');
  notifContainer.id = 'global-notifications';
  notifContainer.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none';
  document.body.appendChild(notifContainer);

  const channel = supabase.channel('global-system');

  // Broadcast messages
  channel.on('broadcast', { event: 'notification' }, (payload) => {
    const user = getState('user');
    // If targeted at a specific event, check membership
    if (payload.payload.event_id && user && user.event_id !== payload.payload.event_id) return;
    showNotification(payload.payload.message);
  });

  // Table listeners for auto-elimination
  channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams' }, (payload) => {
    const user = getState('user');
    if (!user || user.id !== payload.new.id) return;

    if (payload.new.status === 'eliminated' && user.status !== 'eliminated') {
      const updatedUser = { ...user, status: 'eliminated' };
      saveAuth(updatedUser);
      navigate('/eliminated');
    } else if (payload.new.status === 'active' && user.status === 'eliminated') {
      const updatedUser = { ...user, status: 'active' };
      saveAuth(updatedUser);
      navigate('/dashboard');
    }
  });

  channel.subscribe();
}

function showNotification(message) {
  const container = document.getElementById('global-notifications');
  if (!container) return;

  const notif = document.createElement('div');
  notif.className = 'glass-panel p-4 rounded-xl flex items-start gap-4 slide-in-top pointer-events-auto border-l-4 border-primary max-w-sm glow-accent bg-surface-container/95 backdrop-blur-xl shadow-2xl';
  notif.innerHTML = `
    <span class="material-symbols-outlined text-primary mt-0.5">campaign</span>
    <div class="flex-1">
      <h4 class="text-xs font-headline font-bold text-white uppercase tracking-widest mb-1 text-primary">Admin Announcement</h4>
      <p class="text-sm font-body text-white leading-relaxed font-semibold">${message}</p>
    </div>
    <button class="text-on-surface-variant hover:text-white transition-colors" onclick="this.parentElement.remove()">
      <span class="material-symbols-outlined text-sm">close</span>
    </button>
  `;

  container.appendChild(notif);
  setTimeout(() => {
    if (notif.parentElement) {
      notif.style.opacity = '0';
      notif.style.transform = 'translateY(-10px)';
      setTimeout(() => notif.remove(), 300);
    }
  }, 10000); // 10 seconds auto-dismiss
}
