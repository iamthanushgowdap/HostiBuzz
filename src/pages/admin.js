import { supabase } from '../config/supabase.js';
import { getState } from '../services/state.js';
import { socketService } from '../services/socket.js';
import { renderNavbar, bindNavbarEvents } from '../components/navbar.js';
import { navigate } from '../router.js';
import { Notifier } from '../services/notifier.js';
import { jsPDF } from 'jspdf';
import { renderDashboard } from './dashboard.js';
import { Ticker } from '../components/ticker.js';
import { ActivityBroadcast } from '../services/activity-broadcast.js';
import { AIEvaluator } from '../services/ai-evaluator.js';
import { timeSync } from '../services/timeSync.js';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css'; 
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup';

let selectedEventId = null;
let selectedBankRoundId = null;
let secretsRevealed = false;

function generateSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Global Singletons for Real-Time Services
let presenceChannel = null;
let broadcastChannel = null;
let socketStatusUnsubscribe = null;
let onlineTeams = new Set();
let currentAdminContainer = null;

/**
 * Global update for presence dots across any rendered container.
 */
function refreshSidebarPresence() {
  if (!currentAdminContainer) return;
  currentAdminContainer.querySelectorAll('.presence-dot').forEach(dot => {
    const teamId = dot.dataset.teamId;
    if (onlineTeams.has(teamId)) {
      dot.classList.add('bg-secondary', 'animate-pulse');
      dot.classList.remove('bg-outline');
    } else {
      dot.classList.remove('bg-secondary', 'animate-pulse');
      dot.classList.add('bg-outline');
    }
  });
}

export async function renderAdmin(container, params = {}, search = {}, mockUser = null) {
  currentAdminContainer = container;
  const user = getState('user');
  
  // Initialize Global Services Once (Persistent Connection)
  if (!presenceChannel) {
    Ticker.init(); 
    presenceChannel = supabase.channel('online-teams');
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        onlineTeams.clear();
        Object.values(state).forEach(presences => {
          presences.forEach(p => {
            if (p.team_id) onlineTeams.add(p.team_id);
          });
        });
        refreshSidebarPresence();
      })
      .subscribe();
  }

  if (!broadcastChannel) {
    broadcastChannel = supabase.channel('global-system').subscribe();
  }

  // Fetch all events for the context
  const { data: events } = await supabase.from('events').select('*').order('created_at', { ascending: false });

  // Render Skeleton Shell
  let teams = [];
  if (selectedEventId) {
    const { data } = await supabase.from('teams').select('*').eq('event_id', selectedEventId).order('team_name');
    teams = data || [];
  }

  container.innerHTML = `
    ${renderNavbar({ activeLink: 'dashboard', hideMobileMenu: true })}
    <div class="flex flex-col lg:flex-row min-h-[calc(100vh-76px)]">
      <!-- Mobile Admin Header -->
      <div class="lg:hidden flex items-center justify-between px-4 py-2 bg-surface-container-high/90 backdrop-blur-md border-b border-primary/10 sticky top-[64px] z-30">
        <div class="flex items-center gap-3">
          <button id="admin-sidebar-toggle" class="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-primary group active:scale-95 transition-all outline outline-1 outline-primary/10">
            <span class="material-symbols-outlined">menu_open</span>
          </button>
          <span class="font-headline font-bold text-sm text-on-surface tracking-widest uppercase">Mission Control</span>
        </div>
        
        <!-- Quick Pulse Stats (Mobile) -->
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/10 border border-primary/20">
          <span class="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
          <span class="text-[9px] font-bold text-secondary uppercase tracking-widest">Live</span>
        </div>
      </div>

      <!-- Sidebar (Adaptive Drawer) -->
      <aside id="admin-sidebar" class="fixed lg:relative inset-y-0 left-0 z-50 w-72 bg-surface-container-low/95 backdrop-blur-xl border-r border-white/5 translate-x-[-100%] lg:translate-x-0 transition-transform duration-300 ease-in-out lg:flex flex-col h-screen overflow-y-auto">
        <!-- Close Button (Mobile Only) -->
        <button id="close-admin-sidebar" class="lg:hidden absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-on-surface-variant z-10">
          <span class="material-symbols-outlined text-sm">close</span>
        </button>

        <!-- Platform Sync (Quick Links for Mobile) -->
        <div class="lg:hidden px-4 py-4 bg-secondary/5 border-b border-white/5">
          <p class="text-[8px] font-black text-secondary/60 uppercase tracking-[0.3em] mb-3 px-2">Platform Sync</p>
          <div class="grid grid-cols-2 gap-2">
            <a href="#/" class="flex items-center gap-2 py-2 px-3 bg-white/5 rounded-lg text-[10px] text-white font-headline border border-white/5">
              <span class="material-symbols-outlined text-xs">home</span> Home
            </a>
            <a href="#/events" class="flex items-center gap-2 py-2 px-3 bg-white/5 rounded-lg text-[10px] text-white font-headline border border-white/5">
              <span class="material-symbols-outlined text-xs">event</span> Events
            </a>
            <a href="#/leaderboard" class="flex items-center gap-2 py-2 px-3 bg-white/5 rounded-lg text-[10px] text-white font-headline border border-white/5">
              <span class="material-symbols-outlined text-xs">leaderboard</span> Ranks
            </a>
            <button id="sidebar-logout" class="flex items-center gap-2 py-2 px-3 bg-error/10 rounded-lg text-[10px] text-error font-headline border border-error/20">
              <span class="material-symbols-outlined text-xs">logout</span> Exit
            </button>
          </div>
        </div>

        <div class="p-6 flex items-start justify-between">
          <div>
            <h3 class="text-lg font-black text-on-surface font-headline leading-tight">Control Panel</h3>
            <p class="text-[10px] text-on-surface-variant uppercase tracking-[0.2em]">ADMIN // ${user.username}</p>
          </div>
          
          <!-- ELITE: Pulse Monitor Indicator -->
          <div id="pulse-monitor" class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 glass-panel shadow-lg transition-all">
            <span id="pulse-dot" class="w-2 h-2 rounded-full bg-outline"></span>
            <span id="pulse-text" class="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Link Offline</span>
          </div>
        </div>

        <!-- NEW: Preview Engine -->
        <div class="px-6 mb-8 py-4 bg-primary/5 border-y border-white/5">
          <h4 class="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-sm">visibility</span>
            Preview Engine
          </h4>
          <div class="flex flex-col gap-2">
            <select id="preview-team-select" class="w-full bg-secondary/5 border border-primary/10 rounded-lg py-2 px-3 text-[10px] text-on-surface font-headline focus:ring-1 focus:ring-primary/40 appearance-none">
              <option value="">Select Team to Preview...</option>
              ${teams.map(t => `<option value="${t.id}">${t.team_name}</option>`).join('')}
            </select>
            <button id="launch-preview" class="w-full py-2 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary font-headline font-bold text-[10px] uppercase tracking-widest border border-primary/20 transition-all flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-sm">rocket_launch</span>
              Launch Live Preview
            </button>
          </div>
        </div>

        <!-- Events in sidebar -->
        <div class="px-4 mb-4">
          <div class="flex items-center justify-between mb-3 px-2">
            <span class="text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">Events</span>
            <button id="sidebar-create-event" class="w-6 h-6 rounded-md bg-primary/20 text-primary flex items-center justify-center hover:bg-primary/30 transition-colors">
              <span class="material-symbols-outlined text-sm">add</span>
            </button>
          </div>
          <div id="event-list-sidebar" class="space-y-1">
            ${(events || []).map(ev => `
              <button data-event-id="${ev.id}" class="event-select w-full flex items-center gap-3 py-3 px-3 rounded-xl text-left transition-all ${selectedEventId === ev.id ? 'bg-gradient-to-r from-primary/20 to-transparent border-l-4 border-primary text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}">
                <span class="w-2 h-2 rounded-full flex-shrink-0 ${ev.status === 'active' ? 'bg-secondary animate-pulse' : ev.status === 'completed' ? 'bg-primary' : 'bg-outline'}"></span>
                <div class="min-w-0">
                  <div class="font-headline font-medium text-sm truncate">${ev.name}</div>
                  <div class="text-[10px] text-on-surface-variant capitalize">${ev.status} ${ev.registration_open ? '• Reg Open' : ''}</div>
                </div>
              </button>
            `).join('')}
            ${(!events || events.length === 0) ? '<p class="px-3 py-4 text-xs text-on-surface-variant/40 text-center italic">No events yet. Create one!</p>' : ''}
          </div>
        </div>

        <div class="h-px bg-white/5 mx-4 my-2"></div>

        <!-- Tabs (only when event is selected) -->
        <nav id="nav-tabs" class="flex-1 px-2 space-y-1 ${!selectedEventId ? 'opacity-30 pointer-events-none' : ''}">
          <button data-tab="event-detail" class="admin-tab w-full flex items-center gap-3 bg-gradient-to-r from-primary/20 to-transparent border-l-4 border-primary text-white py-3 px-4 rounded-r-lg text-left">
            <span class="material-symbols-outlined">tune</span>
            <span class="font-headline font-medium text-sm">Event Settings</span>
          </button>
          <button data-tab="rounds" class="admin-tab w-full flex items-center gap-3 text-slate-500 py-3 px-4 hover:text-slate-300 hover:bg-white/5 rounded-lg text-left transition-all">
            <span class="material-symbols-outlined">view_timeline</span>
            <span class="font-headline font-medium text-sm">Rounds</span>
          </button>
          <button data-tab="teams" class="admin-tab w-full flex items-center gap-3 text-slate-500 py-3 px-4 hover:text-slate-300 hover:bg-white/5 rounded-lg text-left transition-all">
            <span class="material-symbols-outlined">groups</span>
            <span class="font-headline font-medium text-sm">Teams</span>
          </button>
          <button data-tab="scores" class="admin-tab w-full flex items-center gap-3 text-slate-500 py-3 px-4 hover:text-slate-300 hover:bg-white/5 rounded-lg text-left transition-all">
            <span class="material-symbols-outlined">scoreboard</span>
            <span class="font-headline font-medium text-sm">Scores</span>
          </button>
          <button data-tab="assets" class="admin-tab w-full flex items-center gap-3 text-slate-500 py-3 px-4 hover:text-slate-300 hover:bg-white/5 rounded-lg text-left transition-all">
            <span class="material-symbols-outlined">category</span>
            <span class="font-headline font-medium text-sm">Round Assets</span>
          </button>
          <button data-tab="export" class="admin-tab w-full flex items-center gap-3 text-slate-500 py-3 px-4 hover:text-slate-300 hover:bg-white/5 rounded-lg text-left transition-all">
            <span class="material-symbols-outlined">download</span>
            <span class="font-headline font-medium text-sm">Export / Import</span>
          </button>
          <button data-tab="reg-page" class="admin-tab w-full flex items-center gap-3 text-slate-500 py-3 px-4 hover:text-slate-300 hover:bg-white/5 rounded-lg text-left transition-all">
            <span class="material-symbols-outlined">how_to_reg</span>
            <span class="font-headline font-medium text-sm">Registration Page</span>
          </button>
          
          <!-- Sacrificial Spacer to push Registration Page up -->
          <button data-tab="blank" class="admin-tab w-full flex items-center gap-3 text-slate-500/0 py-3 px-4 rounded-lg text-left pointer-events-none opacity-0">
            <span class="material-symbols-outlined">blank</span>
            <span class="font-headline font-medium text-sm">Blank</span>
          </button>
        </nav>
      </aside>

      <!-- Sidebar Backdrop (Mobile Only) -->
      <div id="admin-sidebar-backdrop" class="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 hidden transition-opacity duration-300"></div>

      <!-- Main Content -->
      <main class="flex-1 p-4 lg:p-10 overflow-y-auto relative">
        <div class="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none"></div>
        <div id="admin-content" class="max-w-6xl mx-auto relative z-10 w-full"></div>
        
        <!-- Global Notification Sender -->
        <div class="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-3 pointer-events-none">
          <div id="broadcast-popup" class="hidden bg-surface-container-high border border-white/10 w-[280px] p-4 rounded-2xl shadow-2xl transition-all pointer-events-auto shadow-primary/20">
            <h4 class="text-[10px] font-headline font-bold text-primary uppercase tracking-widest mb-3 flex items-center gap-2"><span class="material-symbols-outlined text-sm">wifi_tethering</span> Mission Broadcast</h4>
            <textarea id="broadcast-msg" class="w-full h-24 bg-secondary/5 text-on-surface text-xs border border-primary/10 rounded-xl p-3 resize-none focus:ring-1 focus:ring-primary mb-2 placeholder:text-slate-400" placeholder="Push a tactical update to all team terminals..."></textarea>
            <button id="send-broadcast" class="w-full py-2.5 bg-primary text-on-primary-fixed rounded-xl font-headline font-black text-[10px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2">Execute Push</button>
          </div>
          <button id="broadcast-toggle" class="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-full shadow-lg flex items-center justify-center text-on-primary-fixed hover:scale-110 active:scale-95 transition-all pointer-events-auto border border-white/10">
            <span class="material-symbols-outlined text-xl">campaign</span>
          </button>
        </div>
      </main>
    </div>

    <!-- Real-Time Pulse Authorization -->
    ${selectedEventId ? (() => {
      socketService.joinRoom(selectedEventId, 'admin');
      return '';
    })() : ''}

    <!-- Create Event Modal -->
    <div id="create-event-modal" class="hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div class="glass-panel p-8 rounded-3xl max-w-lg w-full border border-white/10 space-y-6">
        <div class="flex justify-between items-center">
          <h2 class="text-2xl font-headline font-bold text-on-surface">Create New Event</h2>
          <button id="close-create-modal" class="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-white transition-colors">
            <span class="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        <div class="space-y-4">
          <div class="space-y-2">
            <label class="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Event Name *</label>
            <input id="new-event-name" class="w-full bg-secondary/5 border border-primary/10 rounded-xl py-3 px-4 text-on-surface focus:ring-1 focus:ring-secondary/40 placeholder:text-slate-400 font-headline" placeholder="e.g. HostiBuzz 2026, TechNova, HackFest" />
          </div>
          <div class="space-y-2">
            <label class="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Organizer</label>
            <input id="new-event-organizer" class="w-full bg-secondary/5 border border-primary/10 rounded-xl py-3 px-4 text-on-surface focus:ring-1 focus:ring-secondary/40 placeholder:text-slate-400" placeholder="e.g. CS Department, IEEE Chapter" />
          </div>
          <div class="space-y-2">
            <label class="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Description</label>
            <textarea id="new-event-desc" class="w-full bg-secondary/5 border border-primary/10 rounded-xl py-3 px-4 text-on-surface focus:ring-1 focus:ring-secondary/40 placeholder:text-slate-400 h-20 resize-none" placeholder="What's this event about?"></textarea>
          </div>
          <div class="space-y-2">
            <label class="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Event Date</label>
            <input id="new-event-date" type="datetime-local" class="w-full bg-secondary/5 border border-primary/10 rounded-xl py-3 px-4 text-on-surface focus:ring-1 focus:ring-secondary/40" />
          </div>
        </div>

        <button id="confirm-create-event" class="kinetic-gradient w-full py-4 rounded-xl font-headline font-bold text-on-primary-fixed flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-transform">
          <span class="material-symbols-outlined">add_circle</span> Create Event
        </button>
      </div>
    </div>
  `;

  bindNavbarEvents();

  // ========================================
  // PREVIEW ENGINE
  // ========================================
  const launchBtn = document.getElementById('launch-preview');
  if (launchBtn) {
    launchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const teamSelect = document.getElementById('preview-team-select');
      const teamId = teamSelect.value;
      if (!teamId) return Notifier.toast('Please select a team to preview', 'warning');
      
      console.log('[Admin] Previewing Team:', teamId);
      sessionStorage.setItem('admin_return', 'true');
      navigate(`/dashboard?preview_team_id=${teamId}`);
    });
  }

  // ========================================
  // EVENT SIDEBAR: select an event
  // ========================================
  container.querySelectorAll('.event-select').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      selectedEventId = btn.dataset.eventId;
      renderAdmin(currentAdminContainer, params, search, mockUser);
    });
  });

  // ========================================
  // CREATE EVENT MODAL
  // ========================================
  const openModal = () => document.getElementById('create-event-modal').classList.remove('hidden');
  const closeModal = () => document.getElementById('create-event-modal').classList.add('hidden');

  document.getElementById('sidebar-create-event')?.addEventListener('click', openModal);
  document.getElementById('close-create-modal')?.addEventListener('click', closeModal);

  document.getElementById('confirm-create-event')?.addEventListener('click', async () => {
    const name = document.getElementById('new-event-name').value.trim();
    if (!name) return Notifier.toast('Event name is required', 'error');

    const btn = document.getElementById('confirm-create-event');
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span>';
    btn.disabled = true;

    const slug = generateSlug(name);
    const { data, error } = await supabase.from('events').insert({
      name,
      slug,
      organizer: document.getElementById('new-event-organizer').value.trim(),
      description: document.getElementById('new-event-desc').value.trim(),
      event_date: document.getElementById('new-event-date').value || null,
      status: 'draft',
      registration_open: false
    }).select().single();

    if (error) {
      Notifier.toast('Error creating event: ' + error.message, 'error');
      btn.innerHTML = '<span class="material-symbols-outlined">add_circle</span> Create Event';
      btn.disabled = false;
      return;
    }

    selectedEventId = data.id;
    renderAdmin(container, params, search, mockUser);
  });

  // ========================================
  // PULSE MONITOR: Real-time Status Sync
  // ========================================
  const updatePulseUI = (status) => {
    const monitor = document.getElementById('pulse-monitor');
    const dot = document.getElementById('pulse-dot');
    const text = document.getElementById('pulse-text');
    if (!monitor || !dot || !text) return;

    // Reset animations
    dot.classList.remove('animate-pulse', 'bg-secondary', 'bg-primary', 'bg-error', 'bg-outline');
    monitor.classList.remove('border-secondary/30', 'border-primary/30', 'border-error/30');

    switch (status) {
      case 'joined':
        dot.classList.add('bg-secondary', 'animate-pulse');
        monitor.classList.add('border-secondary/30');
        text.innerText = 'Live Pulse';
        text.className = 'text-[9px] font-bold uppercase tracking-widest text-secondary';
        break;
      case 'connected':
      case 'connecting':
        dot.classList.add('bg-primary', 'animate-pulse');
        monitor.classList.add('border-primary/30');
        text.innerText = 'Syncing...';
        text.className = 'text-[9px] font-bold uppercase tracking-widest text-primary';
        break;
      case 'offline':
      default:
        dot.classList.add('bg-error');
        monitor.classList.add('border-error/30');
        text.innerText = 'Link Offline';
        text.className = 'text-[9px] font-bold uppercase tracking-widest text-error';
        break;
    }
  };

  // Subscribe to status changes
  if (socketStatusUnsubscribe) socketStatusUnsubscribe();
  socketStatusUnsubscribe = socketService.onStatusChange(updatePulseUI);

  // ========================================
  // MOBILE SIDEBAR TOGGLE
  // ========================================
  const sidebarToggle = document.getElementById('admin-sidebar-toggle');
  const adminSidebar = document.getElementById('admin-sidebar');
  const adminBackdrop = document.getElementById('admin-sidebar-backdrop');
  const closeSidebarBtn = document.getElementById('close-admin-sidebar');

  if (sidebarToggle && adminSidebar && adminBackdrop) {
    const openSidebar = () => {
      adminSidebar.classList.remove('translate-x-[-100%]');
      adminBackdrop.classList.remove('hidden');
      setTimeout(() => adminBackdrop.classList.add('opacity-100'), 10);
      document.body.style.overflow = 'hidden';
    };

    const closeSidebar = () => {
      adminSidebar.classList.add('translate-x-[-100%]');
      adminBackdrop.classList.remove('opacity-100');
      setTimeout(() => {
        adminBackdrop.classList.add('hidden');
        document.body.style.overflow = '';
      }, 300);
    };

    sidebarToggle.addEventListener('click', openSidebar);
    adminBackdrop.addEventListener('click', closeSidebar);
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);

    // Platform Sync: Logout
    document.getElementById('sidebar-logout')?.addEventListener('click', async () => {
      const { logout } = await import('../services/auth.js');
      logout();
    });

    // Auto-close when switching events/tabs on mobile
    adminSidebar.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.innerWidth < 1024) closeSidebar();
      });
    });
  }

  // ========================================
  // ROUND AUDITION
  // ========================================
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('#audition-round');
    if (!btn) return;
    
    const { roundId, roundType } = btn.dataset;
    const teamId = document.getElementById('preview-team-select').value;
    
    if (!teamId) {
      return Notifier.toast('Select a team in the Sidebar Preview Engine to use as a diagnostic vessel.', 'info');
    }
    
    // Launch audition: Dashboard -> Round
    sessionStorage.setItem('admin_return', 'true');
    window.location.hash = `/round/${roundType}?preview_team_id=${teamId}`;
  });

  // ========================================
  // TABS
  // ========================================
  const tabs = container.querySelectorAll('.admin-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.className = 'admin-tab w-full flex items-center gap-3 text-slate-500 py-3 px-4 hover:text-slate-300 hover:bg-white/5 rounded-lg text-left transition-all';
      });
      tab.className = 'admin-tab w-full flex items-center gap-3 bg-gradient-to-r from-primary/20 to-transparent border-l-4 border-primary text-white py-3 px-4 rounded-r-lg text-left';
      renderTabContent(tab.dataset.tab);
    });
  });

  // ========================================
  // RENDER CONTENT AREA & BROADCASTS
  // ========================================
  const broadcastToggle = document.getElementById('broadcast-toggle');
  const broadcastPopup = document.getElementById('broadcast-popup');
  const broadcastBtn = document.getElementById('send-broadcast');
  const broadcastInput = document.getElementById('broadcast-msg');

  // Channels are now managed at module level

  // Global Broadcast Handlers
  if (broadcastToggle && broadcastPopup) {
    broadcastToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      broadcastPopup.classList.toggle('hidden');
      if (!broadcastPopup.classList.contains('hidden')) {
        broadcastInput.focus();
      }
    });
  }

  if (broadcastBtn) {
    broadcastBtn.addEventListener('click', async () => {
      const msg = broadcastInput.value.trim();
      if (!msg) return;

      // Start loading
      broadcastBtn.disabled = true;
      const originalInner = broadcastBtn.innerHTML;
      broadcastBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">refresh</span>';
      
      // Safety timeout: Release button after 3s if no response
      const safetyTimeout = setTimeout(() => {
        if (broadcastBtn.disabled) {
          broadcastBtn.disabled = false;
          broadcastBtn.innerHTML = originalInner;
          Notifier.toast('Broadcast timed out, please try again.', 'error');
        }
      }, 3000);

      try {
        const { error } = await broadcastChannel.send({
          type: 'broadcast',
          event: 'notification',
          payload: { message: msg, event_id: selectedEventId }
        });

        if (error) throw error;

        // Success state
        clearTimeout(safetyTimeout);
        ActivityBroadcast.push('news', `BREAKING NEWS: ${msg}`);
        
        // Instant Socket Pulse
        socketService.emit('admin:announcement', { message: msg });
        
        broadcastInput.value = '';
        broadcastBtn.disabled = false;
        
        const prevClass = broadcastBtn.className;
        broadcastBtn.className = 'w-full py-2 bg-secondary text-surface rounded-xl font-headline font-bold text-xs uppercase tracking-widest transition-all text-center';
        broadcastBtn.innerHTML = 'Sent!';
        
        setTimeout(() => {
          broadcastBtn.className = prevClass;
          broadcastBtn.innerHTML = 'Send Now';
          broadcastPopup.classList.add('hidden');
        }, 2000);

      } catch (err) {
        console.error('Broadcast failed:', err);
        clearTimeout(safetyTimeout);
        broadcastBtn.disabled = false;
        broadcastBtn.innerHTML = originalInner;
        Notifier.toast('Failed to send broadcast.', 'error');
      }
    });
  }

  const content = document.getElementById('admin-content');

  if (!selectedEventId) {
    renderWelcome(content, events);
  } else {
    renderTabContent('event-detail');
  }

  // ========================================
  // WELCOME (no event selected)
  // ========================================
  function renderWelcome(el, eventList) {
    el.innerHTML = `
      <div class="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <span class="material-symbols-outlined text-6xl text-on-surface-variant/20 mb-6">event_note</span>
        <h1 class="text-4xl font-headline font-bold text-on-surface mb-3">Welcome to Admin Panel</h1>
        <p class="text-on-surface-variant max-w-lg mb-8">Create a new event or select an existing one from the sidebar to manage rounds, teams, and scores.</p>
        <button id="welcome-create-event" class="kinetic-gradient px-8 py-4 rounded-xl font-headline font-bold text-white flex items-center gap-3 hover:scale-105 active:scale-95 transition-transform shadow-lg">
          <span class="material-symbols-outlined">add_circle</span> Create Your First Event
        </button>

        ${eventList?.length ? `
          <div class="mt-12 w-full max-w-2xl">
            <h3 class="text-sm font-headline font-bold text-on-surface-variant/60 tracking-widest uppercase mb-4">or select an event</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              ${eventList.map(ev => `
                <button data-pick-event="${ev.id}" class="pick-event bg-surface-container-low p-5 rounded-2xl text-left hover:bg-surface-container-high transition-all group border border-primary/5">
                  <div class="flex items-center gap-3 mb-2">
                    <span class="w-2.5 h-2.5 rounded-full ${ev.status === 'active' ? 'bg-secondary animate-pulse' : ev.status === 'completed' ? 'bg-primary' : 'bg-outline'}"></span>
                    <h4 class="font-headline font-bold text-on-surface group-hover:text-primary transition-colors">${ev.name}</h4>
                  </div>
                  <p class="text-xs text-on-surface-variant">${ev.organizer || 'No organizer'} • ${ev.status} • ${ev.registration_open ? 'Registration Open' : 'Registration Closed'}</p>
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    document.getElementById('welcome-create-event')?.addEventListener('click', openModal);
    el.querySelectorAll('.pick-event').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        selectedEventId = btn.dataset.pickEvent;
        renderAdmin(currentAdminContainer, params, search, mockUser);
      });
    });
  }

  // ========================================
  // TAB CONTENT RENDERER
  // ========================================
  async function renderTabContent(tabName) {
    const content = document.getElementById('admin-content');
    if (!selectedEventId) return;

    // Fetch fresh data for the selected event
    const { data: event } = await supabase.from('events').select('*').eq('id', selectedEventId).single();
    const { data: rounds } = await supabase.from('rounds').select('*').eq('event_id', selectedEventId).order('round_number');
    const { data: teams } = await supabase.from('teams').select('*').eq('event_id', selectedEventId);
    
    // Fetch all scores for this event's teams
    const teamIds = teams.map(t => t.id);
    const { data: allScores } = await supabase.from('scores').select('*, rounds(title, round_number)').in('team_id', teamIds);
    
    // Fetch tab switches
    const { data: tabSwitchesData } = await supabase.from('teams').select('id, tab_switch_count').eq('event_id', selectedEventId);
    const tabSwitches = {};
    tabSwitchesData?.forEach(t => tabSwitches[t.id] = t.tab_switch_count || 0);

    content.innerHTML = '<div class="flex items-center justify-center p-12"><span class="material-symbols-outlined animate-spin text-4xl text-primary/40">refresh</span></div>';

    switch (tabName) {
      case 'event-detail':
        renderEventDetail(content, event, rounds, teams);
        break;
      case 'rounds':
        renderRoundsTab(content, event, rounds);
        break;
      case 'teams':
        renderTeamsTab(content, event, teams, tabSwitches);
        break;
      case 'scores':
        renderScoresTab(content, event, rounds, teams, allScores);
        break;
      case 'assets':
        renderAssetsTab(content, rounds);
        break;
      case 'export':
        renderExportTab(content, event, rounds, teams);
        break;
      case 'reg-page':
        renderRegistrationPageTab(content, event);
        break;
    }
  }

  function renderExportTab(el, event, rounds, teams) {
      el.innerHTML = `
        <div class="space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-3xl font-headline font-bold text-on-surface tracking-tight">Export / Import Engine</h2>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Export Section -->
            <div class="glass-panel p-6 rounded-2xl space-y-4">
              <h3 class="font-headline font-bold text-on-surface text-lg flex items-center gap-2">
                <span class="material-symbols-outlined text-primary">cloud_download</span>
                Export for AI Evaluation
              </h3>
              <p class="text-xs text-on-surface-variant leading-relaxed">Select a round to export all team submissions in an AI-ready JSON format. This file includes detailed evaluation instructions for the HostiBuzz AI scoring pipeline.</p>
              
              <div class="space-y-3 pt-2">
                <select id="export-round-select" class="w-full bg-secondary/5 border border-primary/10 rounded-xl py-3 px-4 text-on-surface focus:ring-1 focus:ring-primary/40 text-sm appearance-none cursor-pointer">
                  ${(rounds || []).filter(r => r.round_type !== 'elimination').map(r => `<option value="${r.id}">Round ${r.round_number}: ${r.title}</option>`).join('')}
                </select>
                <button id="download-round-json" class="w-full py-4 kinetic-gradient text-on-primary-fixed font-headline font-bold text-xs uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                  <span class="material-symbols-outlined text-sm">file_download</span> Prepare AI-Ready File
                </button>
              </div>
            </div>

            <!-- Import Section -->
            <div class="glass-panel p-6 rounded-2xl space-y-4">
              <h3 class="font-headline font-bold text-on-surface text-lg flex items-center gap-2">
                <span class="material-symbols-outlined text-secondary">cloud_upload</span>
                Import AI Results
              </h3>
              <p class="text-xs text-on-surface-variant leading-relaxed">Paste the AI-generated JSON results or upload the file. You will see a data verification table before any changes are applied to the database.</p>
              
              <div class="space-y-4 pt-2">
                <textarea id="import-json-paste" class="w-full h-32 bg-secondary/5 border border-primary/10 rounded-xl py-3 px-4 text-on-surface focus:ring-1 focus:ring-secondary/40 text-xs font-mono placeholder:text-slate-400 resize-none" placeholder="Paste AI JSON here..."></textarea>
                
                <div class="flex gap-2">
                  <button id="import-paste-btn" class="flex-1 py-3 bg-secondary/20 text-secondary font-headline font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-secondary/30 transition-all flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined text-sm">content_paste</span> Process Paste
                  </button>
                  <button id="import-round-json" class="flex-1 py-3 bg-white/5 text-on-surface-variant font-headline font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined text-sm">upload_file</span> Upload File
                  </button>
                </div>
                <input type="file" id="import-file-input" class="hidden" accept=".json" />
              </div>
            </div>
          </div>
        </div>
      `;

      // Export logic
      document.getElementById('download-round-json')?.addEventListener('click', async () => {
        const roundId = document.getElementById('export-round-select').value;
        const round = rounds.find(r => r.id === roundId);
        if (!round) return;

        const { data: subs } = await supabase.from('submissions').select('*').eq('round_id', roundId);
        const { data: sc } = await supabase.from('scores').select('*').eq('round_id', roundId);

        // Fetch Context Data
        let context = {};
        if (round.round_type === 'quiz') {
          const { data: qs } = await supabase.from('questions').select('*').eq('round_id', roundId).order('order_index');
          context.questions = qs || [];
        } else if (round.round_type === 'logo') {
          const { data: logos } = await supabase.from('logo_assets').select('*').eq('round_id', roundId).order('order_index');
          context.logos = logos || [];
        } else if (round.round_type === 'prompt') {
          const { data: prompts } = await supabase.from('prompt_images').select('*').eq('round_id', roundId).order('order_index');
          context.prompts = prompts || [];
        } else if (round.round_type === 'debate') {
          const { data: topic } = await supabase.from('debate_topics').select('*').eq('round_id', roundId).maybeSingle();
          context.debate = topic || {};
        }

        const exportData = {
          event: { name: event.name, id: event.id },
          round: { title: round.title, type: round.round_type, number: round.round_number, id: round.id },
          context: context,
          scoring_weights: {
            round_max_score: round.max_score || 100,
            asset_points: [
              ...(context.questions?.map(q => ({ label: `Q${q.order_index}`, id: q.id, points: q.points || 1 })) || []),
              ...(context.logos?.map(l => ({ label: `Logo ${l.order_index}`, id: l.id, points: l.points || 1 })) || []),
              ...(context.prompts?.map(p => ({ label: `Prompt ${p.order_index}`, id: p.id, points: p.points || 1, master_prompt: p.seed_description })) || []),
              ...(context.debate?.id ? [{ label: 'Debate Topic', id: context.debate.id, points: context.debate.points || 10 }] : [])
            ]
          },
          instructions_for_ai: {
            role: "You are an expert evaluator",
            task: `Evaluate ${round.title}`,
            evaluation_rules: {
              prompt_round: "For prompt rounds, you are provided with a 'master_prompt' for each image. Compare the team's' submission to this master prompt. Award higher marks for similar technical keywords, lighting descriptions, and visual elements.",
              quiz_round: "Check for exact matches against the master key.",
              logo_round: "Verify the team's brand identification against the correct_answer."
            },
            scoring_schema: { 
              total: round.max_score || 100,
              note: "Respect the specific marks/points defined for each individual question/logo."
            },
            required_output_format: {
              format: "JSON Object",
              structure: {
                scores: [
                  {
                    team_id: "Unique Team ID from the submission list",
                    team_name: "Name of the team",
                    score: "Numerical total score for the round",
                    max_score: round.max_score || 100,
                    reasoning: "Brief explanation of the score based on the context and weights provided"
                  }
                ]
              },
              important: "Return ONLY the JSON object. Do not include markdown code blocks or conversational text. This format is required for the automated score importer."
            }
          },
          submissions: (subs || []).map(s => {
            const team = teams.find(t => t.id === s.team_id);
            return {
              team_id: team?.team_id || s.team_id,
              team_name: team?.team_name || 'Unknown',
              answers: s.answers,
              text_content: s.text_content
            };
          })
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${event.name.replace(/\s+/g, '_')}-AI-READY-R${round.round_number}.json`;
        a.click();
      });

      // Unified Import Logic
      const processImport = async (rawJson) => {
        const roundId = document.getElementById('export-round-select').value;
        const round = rounds.find(r => r.id === roundId);
        if (!round) return;

        try {
          const data = JSON.parse(rawJson);
          let scoresArr = Array.isArray(data) ? data : (data.scores || data.results || []);
          if (scoresArr.length === 0) throw new Error("No scores found in JSON");

          // Build Verification Table
          let tableHtml = `
            <div class="max-h-64 overflow-y-auto mb-4 border border-white/10 rounded-xl">
              <table class="w-full text-left text-xs">
                <thead class="bg-white/5 sticky top-0">
                  <tr>
                    <th class="p-3 font-bold uppercase tracking-widest text-on-surface-variant">Team</th>
                    <th class="p-3 font-bold uppercase tracking-widest text-on-surface-variant text-center">Score</th>
                    <th class="p-3 font-bold uppercase tracking-widest text-on-surface-variant">Reasoning Snippet</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
          `;

          scoresArr.slice(0, 10).forEach(s => {
            tableHtml += `
              <tr>
                <td class="p-3 text-white font-headline">${s.team_name || 'Unknown'} <span class="text-[10px] text-on-surface-variant opacity-50">(${s.team_id})</span></td>
                <td class="p-3 text-primary font-bold text-center">${s.total || s.score || 0}</td>
                <td class="p-3 text-[10px] text-on-surface-variant italic truncate max-w-xs">${s.reasoning || 'No reasoning provided'}</td>
              </tr>
            `;
          });

          if (scoresArr.length > 10) {
            tableHtml += `<tr><td colspan="3" class="p-3 text-center text-on-surface-variant italic">... and ${scoresArr.length - 10} more entries</td></tr>`;
          }
          tableHtml += `</tbody></table></div>`;

          Notifier.modal({
            title: 'Verify Import Data',
            type: 'info',
            icon: 'verified_user',
            body: `
              <p class="mb-4">Found ${scoresArr.length} scores for <b>${round.title}</b>. Please verify the preview below before confirming.</p>
              ${tableHtml}
              <p class="text-xs text-on-surface-variant italic">Warning: This will overwrite any existing scores for these teams in this round.</p>
            `,
            showConfirm: true,
            confirmText: 'Import Now',
            onConfirm: async () => {
              // Final Ingestion Logic
              let imported = 0;
              for (const s of scoresArr) {
                const team = teams.find(t => t.team_id === s.team_id || t.id === s.team_id);
                if (team) {
                  const pointValue = s.total !== undefined ? s.total : (s.score !== undefined ? s.score : 0);
                  await supabase.from('scores').upsert({
                    team_id: team.id,
                    round_id: roundId,
                    score: pointValue,
                    max_score: round.max_score || 100,
                    evaluator_notes: s.reasoning || '',
                    evaluated_at: new Date().toISOString()
                  }, { onConflict: 'team_id,round_id' });
                  imported++;
                }
              }
              Notifier.toast(`${imported} scores imported successfully!`, 'success');
              renderTabContent('scores');
            }
          });
        } catch (e) {
          Notifier.toast("Validation Error: " + e.message, "error");
        }
      };

      document.getElementById('import-round-json')?.addEventListener('click', () => {
        document.getElementById('import-file-input').click();
      });

      document.getElementById('import-file-input')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) processImport(await file.text());
      });

      document.getElementById('import-paste-btn')?.addEventListener('click', () => {
        const paste = document.getElementById('import-json-paste').value.trim();
        if (paste) processImport(paste);
        else Notifier.toast("Please paste JSON first", "info");
      });
    }

  // ========================================
  // EVENT DETAIL TAB
  // ========================================
  function renderEventDetail(el, event, rounds, teams) {
    if (!event) return;
    const activeRounds = (rounds || []).filter(r => r.status === 'active').length;
    const completedRounds = (rounds || []).filter(r => r.status === 'completed').length;
    const activeTeams = (teams || []).filter(t => t.status === 'active').length;
    const totalTeams = (teams || []).length;
    const maxTeams = event.max_teams || 0;
    const occupancyPercent = maxTeams > 0 ? Math.min(100, (totalTeams / maxTeams) * 100) : 0;
    const eventConfig = typeof event.config === 'string' ? JSON.parse(event.config) : (event.config || {});

    el.innerHTML = `
      <div class="flex items-start justify-between mb-8">
        <div>
          <div class="flex items-center gap-3 mb-2">
            <span class="w-3 h-3 rounded-full ${event.status === 'active' ? 'bg-secondary animate-pulse' : event.status === 'completed' ? 'bg-primary' : 'bg-outline'}"></span>
            <span class="text-xs font-bold tracking-widest text-on-surface-variant uppercase">${event.status} Command</span>
          </div>
          <h1 class="text-4xl md:text-5xl font-headline font-bold text-on-surface tracking-tighter">${event.name}</h1>
          <p class="text-on-surface-variant mt-2 font-medium">${event.organizer || 'Unnamed Command'} • Operational Hub</p>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div class="glass-panel p-6 rounded-3xl border border-primary/10 bg-white shadow-sm">
          <div class="text-[10px] font-bold tracking-widest text-on-surface-variant uppercase mb-2">Teams / Occupancy</div>
          <div class="text-3xl font-headline font-black text-on-surface">
            ${totalTeams}<span class="text-lg text-on-surface-variant/30"> / ${maxTeams || 50}</span>
          </div>
          <div class="w-full h-1.5 bg-secondary/10 rounded-full mt-3 overflow-hidden">
            <div class="h-full bg-secondary transition-all" style="width: ${occupancyPercent}%"></div>
          </div>
        </div>
        <div class="glass-panel p-6 rounded-3xl border border-primary/10 bg-white shadow-sm">
          <div class="text-[10px] font-bold tracking-widest text-on-surface-variant uppercase mb-2">Total Payload</div>
          <div class="text-3xl font-headline font-black text-on-surface">${(rounds || []).length}</div>
          <div class="text-xs font-bold text-primary mt-1 uppercase">${completedRounds} Done</div>
        </div>
        <div class="glass-panel p-6 rounded-3xl border border-primary/10 bg-white shadow-sm">
          <div class="text-[10px] font-bold tracking-widest text-on-surface-variant uppercase mb-2">Current Sector</div>
          <div class="text-3xl font-headline font-black text-on-surface">${activeRounds || '—'}</div>
          <div class="text-xs font-bold text-secondary mt-1 uppercase">Active Round</div>
        </div>
        <div class="glass-panel p-6 rounded-3xl border border-primary/10 bg-white shadow-sm">
          <div class="text-[10px] font-bold tracking-widest text-on-surface-variant uppercase mb-2">Registration Status</div>
          <div class="text-xl font-headline font-black ${event.registration_open ? 'text-secondary' : 'text-error'} uppercase">
            ${event.registration_open ? 'Open' : 'Locked'}
          </div>
          <div class="text-xs font-bold text-on-surface-variant/40 mt-1 uppercase">${event.registration_open ? 'Accepting Squads' : 'Closed to Public'}</div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- Card 01: General Information -->
          <div class="glass-panel p-8 rounded-[32px] border border-primary/10 bg-white space-y-6">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <span class="material-symbols-outlined">edit_square</span>
              </div>
              <h3 class="font-headline font-bold text-on-surface uppercase tracking-tight">General Information</h3>
            </div>
            
            <div class="space-y-4">
              <div class="space-y-1">
                <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Event Tactical Name</label>
                <input id="edit-event-name" class="w-full bg-secondary/5 border border-primary/20 rounded-xl py-3 px-4 text-on-surface font-headline focus:ring-2 focus:ring-primary/20 transition-all font-bold" value="${event.name || ''}" />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Organizer / Command</label>
                <input id="edit-event-organizer" class="w-full bg-secondary/5 border border-primary/20 rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 transition-all" value="${event.organizer || ''}" />
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1">
                  <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Deployment Date</label>
                  <input id="edit-event-date" type="date" class="w-full bg-secondary/5 border border-primary/20 rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20" value="${event.event_date || ''}" />
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Event URL Slug</label>
                  <div class="w-full bg-slate-100 border border-primary/10 rounded-xl py-3 px-4 text-on-surface-variant font-mono text-xs flex items-center gap-2">
                    <span class="material-symbols-outlined text-xs">link</span> ${event.slug || 'no-slug-set'}
                  </div>
                </div>
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Mission Intelligence / Briefing</label>
                <textarea id="edit-event-desc" class="w-full bg-secondary/5 border border-primary/20 rounded-xl py-3 px-4 text-on-surface h-24 resize-none focus:ring-2 focus:ring-primary/20 text-sm leading-relaxed">${event.description || ''}</textarea>
              </div>
              <button id="save-event-info" class="w-full py-3.5 rounded-xl kinetic-gradient text-on-primary-fixed font-headline font-bold text-sm tracking-widest uppercase hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-sm">save</span> Commit Core Details
              </button>
            </div>
          </div>

          <div class="space-y-8">
            <!-- Card 02: Registration Limits -->
            <div class="glass-panel p-8 rounded-[32px] border border-secondary/10 bg-white">
              <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
                  <span class="material-symbols-outlined">group_add</span>
                </div>
                <h3 class="font-headline font-bold text-on-surface uppercase tracking-tight">Squadron Limits</h3>
              </div>
              <div class="grid grid-cols-2 gap-4 mb-4">
                <div class="space-y-1">
                  <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Max Teams</label>
                  <input id="edit-max-teams" type="number" class="w-full bg-secondary/5 border border-primary/20 rounded-xl py-3 px-4 text-on-surface font-headline font-bold focus:ring-2 focus:ring-primary/20" value="${event.max_teams || 50}" />
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Max Per Team</label>
                  <input id="edit-max-team-size" type="number" class="w-full bg-secondary/5 border border-primary/20 rounded-xl py-3 px-4 text-on-surface font-headline font-bold focus:ring-2 focus:ring-primary/20" value="${event.max_team_size || 4}" />
                </div>
              </div>
              <button id="save-event-limits" class="w-full py-3.5 rounded-xl border border-secondary/20 text-secondary font-headline font-bold text-xs tracking-widest uppercase hover:bg-secondary/5 transition-all">Save Tactical Capacity</button>
            </div>

            <!-- Card 03: System Intelligence -->
            <div class="glass-panel p-8 rounded-[32px] border border-tertiary/10 bg-white">
              <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 rounded-xl bg-tertiary/10 text-tertiary flex items-center justify-center">
                  <span class="material-symbols-outlined">psychology</span>
                </div>
                <h3 class="font-headline font-bold text-on-surface uppercase tracking-tight">AI Protocol Configuration</h3>
              </div>
              <div class="space-y-4">
                <div class="space-y-1">
                  <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Gemini AI Access Key</label>
                  <input id="edit-gemini-key" type="password" class="w-full bg-secondary/5 border border-primary/20 rounded-xl py-3 px-4 text-on-surface font-mono text-xs focus:ring-2 focus:ring-primary/20" placeholder="Enter API Key to enable AI evaluations..." value="${eventConfig.gemini_api_key || ''}" />
                </div>
                <button id="save-ai-config" class="w-full py-3.5 rounded-xl border border-tertiary/20 text-tertiary font-headline font-bold text-xs tracking-widest uppercase hover:bg-tertiary/5 transition-all">Enable Intelligence Engine</button>
              </div>
            </div>
          </div>
      </div>

      <!-- Module 04: Tactical Controls -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div class="glass-panel p-6 rounded-3xl border border-primary/10 bg-white flex flex-col justify-between shadow-sm">
          <div class="mb-4">
            <div class="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-1">Squadron Entry</div>
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full ${event.registration_open ? 'bg-secondary animate-pulse' : 'bg-error'}"></div>
              <span class="text-sm font-headline font-bold ${event.registration_open ? 'text-secondary' : 'text-error'} uppercase">${event.registration_open ? 'Open' : 'Locked'}</span>
            </div>
          </div>
          <button class="event-action w-full py-3 rounded-xl border border-primary/10 text-on-surface-variant font-headline font-bold text-[10px] uppercase tracking-widest hover:bg-secondary/5" data-action="toggle-registration">
            ${event.registration_open ? 'Close Registration' : 'Live Registration'}
          </button>
        </div>

        <div class="glass-panel p-6 rounded-3xl border border-primary/10 bg-white flex flex-col justify-between shadow-sm">
          <div class="mb-4">
            <div class="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-1">Event Readiness</div>
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full ${event.status === 'active' ? 'bg-primary' : 'bg-slate-300'}"></div>
              <span class="text-sm font-headline font-bold ${event.status === 'active' ? 'text-primary' : 'text-on-surface-variant'} uppercase">${event.status === 'active' ? 'Active' : 'Preparation'}</span>
            </div>
          </div>
          <button class="event-action w-full py-3 rounded-xl ${event.status === 'active' ? 'bg-error/10 text-error' : 'bg-primary/20 text-primary'} font-headline font-bold text-[10px] uppercase tracking-widest hover:scale-[1.02] transition-all" data-action="toggle-status">
            ${event.status === 'active' ? 'End Mission' : 'Activate Arena'}
          </button>
        </div>

        <div class="glass-panel p-6 rounded-3xl border border-primary/10 bg-white shadow-sm">
          <div class="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mb-3">Public Registration Link</div>
          <div class="flex items-center gap-2">
            <div class="flex-1 bg-slate-50 border border-primary/10 rounded-xl py-2 px-3 font-mono text-[10px] text-secondary truncate">
              /register/${event.slug}
            </div>
            <button class="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center hover:bg-secondary/20" onclick="navigator.clipboard.writeText(window.location.origin + '/#/register/${event.slug}')">
              <span class="material-symbols-outlined text-sm">content_copy</span>
            </button>
          </div>
          <button class="w-full mt-3 py-2.5 rounded-xl bg-secondary/10 text-secondary font-headline font-bold text-[10px] uppercase tracking-widest hover:bg-secondary/20" onclick="window.open('/#/register/${event.slug}', '_blank')">
            Launch Preview
          </button>
        </div>
      </div>
    `;
  }

    // Event limit save handler
    document.getElementById('save-event-limits')?.addEventListener('click', async () => {
      const maxTeams = parseInt(document.getElementById('edit-max-teams').value) || null;
      const maxTeamSize = parseInt(document.getElementById('edit-max-team-size').value) || 4;
      
      const btn = document.getElementById('save-event-limits');
      const originalHtml = btn.innerHTML;
      btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">progress_activity</span> Updating...';
      
      const { error } = await supabase.from('events').update({ 
        max_teams: maxTeams, 
        max_team_size: maxTeamSize 
      }).eq('id', event.id);
      
      if (error) {
        Notifier.toast('Error updating limits: ' + error.message, 'error');
        btn.innerHTML = originalHtml;
      } else {
        btn.innerHTML = '<span class="material-symbols-outlined text-sm">check_circle</span> Updated';
        setTimeout(() => renderAdmin(container), 1000);
      }
    });

    // Event action handlers
    el.querySelectorAll('.event-action').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        if (action === 'toggle-status') {
          const newStatus = event.status === 'active' ? 'completed' : 'active';
          await supabase.from('events').update({ status: newStatus }).eq('id', event.id);
        } else if (action === 'toggle-registration') {
          // Ensure slug exists when opening registration
          if (!event.slug) {
            await supabase.from('events').update({ slug: generateSlug(event.name) }).eq('id', event.id);
          }
          await supabase.from('events').update({ registration_open: !event.registration_open }).eq('id', event.id);
        }
        renderAdmin(container);
      });
    });

    // Save Event info
    document.getElementById('save-event-info')?.addEventListener('click', async () => {
      const btn = document.getElementById('save-event-info');
      const originalHtml = btn.innerHTML;
      btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">rotate_right</span> Saving...';
      btn.disabled = true;

      const updates = {
        name: document.getElementById('edit-event-name').value.trim(),
        organizer: document.getElementById('edit-event-organizer').value.trim(),
        description: document.getElementById('edit-event-desc').value.trim(),
        event_date: document.getElementById('edit-event-date').value || null
      };

      const { error } = await supabase.from('events').update(updates).eq('id', event.id);
      
      if (error) {
        alert('Error: ' + error.message);
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      } else {
        btn.innerHTML = 'Saved!';
        setTimeout(() => renderAdmin(container), 800);
      }
    });

    // Save AI Config
    document.getElementById('save-ai-config')?.addEventListener('click', async () => {
      const key = document.getElementById('edit-gemini-key').value.trim();
      const currentConfig = typeof event.config === 'string' ? JSON.parse(event.config) : (event.config || {});
      const newConfig = { ...currentConfig, gemini_api_key: key };
      
      const { error } = await supabase.from('events').update({ config: newConfig }).eq('id', event.id);
      if (error) Notifier.toast('Error saving AI key', 'error');
      else {
        Notifier.toast('AI Intelligence Activated', 'success');
        renderAdmin(container);
      }
    });
  }

  // ========================================
  // ROUNDS TAB
  // ========================================
  function renderRoundsTab(el, event, rounds, teams) {
    const roundTypes = [
      { value: 'quiz', label: 'Quiz (MCQ)', icon: 'quiz' },
      { value: 'logo', label: 'Logo Identification', icon: 'image_search' },
      { value: 'prompt', label: 'Prompt Writing', icon: 'edit_note' },
      { value: 'webdev', label: 'Web Dev Submission', icon: 'code' },
      { value: 'video', label: 'Video Submission', icon: 'videocam' },
      { value: 'debate', label: 'Tech Debate', icon: 'forum' }
    ];

    const activeRoundNum = rounds.find(r => r.status === 'active')?.round_number;

    el.innerHTML = `
      <div class="flex items-end justify-between mb-8">
        <div>
          <h1 class="text-3xl font-headline font-bold text-on-surface">Mission Protocol</h1>
          <p class="text-on-surface-variant text-sm mt-1">${event.name} • Round Parameters</p>
        </div>
        <div class="flex gap-4">
           <div class="bg-primary/5 px-6 py-3 rounded-2xl border border-primary/10 text-center">
             <div class="text-[9px] text-primary font-black uppercase tracking-widest leading-none mb-1">Teams In Arena</div>
             <div class="text-2xl font-headline font-bold text-on-surface">${teams.length}</div>
           </div>
           <div class="bg-secondary/5 px-6 py-3 rounded-2xl border border-secondary/10 text-center">
             <div class="text-[9px] text-secondary font-black uppercase tracking-widest leading-none mb-1">Total Payload</div>
             <div class="text-2xl font-headline font-bold text-on-surface">${rounds.length} Rounds</div>
           </div>
           <div class="bg-tertiary/5 px-6 py-3 rounded-2xl border border-tertiary/10 text-center">
             <div class="text-[9px] text-tertiary font-black uppercase tracking-widest leading-none mb-1">Active Sector</div>
             <div class="text-2xl font-headline font-bold text-on-surface">${activeRoundNum || '—'}</div>
           </div>
        </div>
      </div>

      <!-- Add New Round Module -->
      <div class="glass-panel p-8 rounded-[32px] border border-primary/10 bg-white mb-8">
        <div class="flex items-center gap-3 mb-8">
          <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <span class="material-symbols-outlined">add_task</span>
          </div>
          <h3 class="text-xl font-headline font-bold text-on-surface uppercase tracking-tight">Deploy New Round</h3>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
          <div class="space-y-2">
            <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Tactical Objective</label>
            <input id="round-title" class="w-full bg-secondary/5 border border-primary/20 rounded-2xl py-4 px-5 text-on-surface font-headline placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 transition-all font-bold" placeholder="e.g. Logic Blast" />
          </div>
          <div class="space-y-2">
            <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Protocol Type</label>
            <select id="round-type" class="w-full bg-secondary/5 border border-primary/20 rounded-2xl py-4 px-5 text-on-surface font-headline appearance-none cursor-pointer focus:ring-2 focus:ring-primary/20 transition-all">
              <optgroup label="Questionnaire" class="bg-white text-secondary">
                <option value="quiz">Quiz System (MCQ)</option>
              </optgroup>
              <optgroup label="Visual Intelligence" class="bg-white text-secondary">
                <option value="logo">Logo Mastery</option>
                <option value="prompt">Generative Prompt</option>
              </optgroup>
              <optgroup label="Development & Creative" class="bg-white text-secondary">
                <option value="webdev">Terminal Web Dev</option>
                <option value="video">Cinematic Engine</option>
              </optgroup>
              <optgroup label="Verbal Combat" class="bg-white text-secondary">
                <option value="debate">Tech Debate</option>
              </optgroup>
            </select>
          </div>
          <div class="space-y-2 text-center">
            <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Max Yield</label>
            <input id="round-max-score" type="number" class="w-full bg-secondary/5 border border-primary/10 rounded-2xl py-4 px-5 text-on-surface font-headline text-center placeholder:text-slate-400 font-bold" value="100" />
          </div>
          <button id="add-round" class="w-full h-[62px] rounded-2xl kinetic-gradient text-on-primary-fixed font-headline font-bold text-sm tracking-widest uppercase hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg">
            <span class="material-symbols-outlined">rocket_launch</span> Deploy Round
          </button>
        </div>
      </div>

      <!-- Active Deployment List -->
      <div class="space-y-6">
        <h3 class="font-headline font-bold text-on-surface-variant text-[10px] uppercase tracking-[0.3em] ml-2">Active Sequence Deployment</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${rounds.sort((a,b) => a.round_number - b.round_number).map(r => {
            const typeInfo = roundTypes.find(t => t.value === r.round_type) || { label: r.round_type, icon: 'extension' };
            return `
              <div class="glass-panel p-6 rounded-[28px] border border-primary/10 bg-white group hover:border-primary/30 transition-all shadow-sm">
                <div class="flex items-center justify-between mb-5">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl ${r.status === 'active' ? 'bg-secondary/10 text-secondary border border-secondary/20' : r.status === 'completed' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-slate-50 text-slate-400 border border-primary/5'} flex items-center justify-center transition-colors">
                      <span class="material-symbols-outlined">${typeInfo.icon}</span>
                    </div>
                    <div>
                      <div class="text-[8px] font-bold uppercase tracking-widest text-on-surface-variant/50">Round ${r.round_number} // ${r.round_type}</div>
                      <div class="font-headline font-bold text-on-surface text-sm uppercase truncate max-w-[120px]">${r.title}</div>
                    </div>
                  </div>
                  <div class="flex flex-col items-end">
                    <span class="text-[8px] font-bold uppercase tracking-widest ${r.status === 'active' ? 'text-secondary animate-pulse' : r.status === 'completed' ? 'text-primary' : 'text-on-surface-variant/30'}">${r.status}</span>
                    <span class="text-[10px] font-bold text-secondary">${r.max_score || 100} PTS</span>
                  </div>
                </div>
                
                <div class="grid grid-cols-2 gap-3">
                  <button class="round-action flex items-center justify-center gap-2 py-3 rounded-xl ${r.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'} font-headline font-bold text-[9px] uppercase tracking-widest hover:scale-[1.02] transition-all" data-id="${r.id}" data-action="toggle-status">
                    <span class="material-symbols-outlined text-xs">${r.status === 'active' ? 'done_all' : 'play_arrow'}</span>
                    ${r.status === 'active' ? 'Complete' : 'Activate'}
                  </button>
                  <div class="flex gap-2">
                    <button class="round-action flex-1 flex items-center justify-center rounded-xl border border-primary/10 text-on-surface-variant hover:bg-secondary/5 transition-colors" data-id="${r.id}" data-action="configure">
                      <span class="material-symbols-outlined text-[16px]">tune</span>
                    </button>
                    <button class="round-action flex-1 flex items-center justify-center rounded-xl bg-error/5 text-error/40 hover:bg-error/10 hover:text-error transition-colors" data-id="${r.id}" data-action="delete">
                      <span class="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

      <!-- Edit Round Modal -->
      <div id="edit-round-modal" class="hidden fixed inset-0 bg-surface/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
        <div class="glass-panel p-8 rounded-3xl max-w-lg w-full border border-primary/10 space-y-6 bg-surface-container shadow-2xl">
          <div class="flex justify-between items-center">
            <h2 class="text-2xl font-headline font-bold text-on-surface">Edit Round</h2>
            <button id="close-edit-round" class="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors">
              <span class="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
          <input type="hidden" id="edit-round-id" />
          <div class="space-y-4">
            <div class="grid grid-cols-4 gap-4">
              <div>
                <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Order</label>
                <input id="edit-round-number" type="number" min="1" class="w-full bg-surface-container-lowest border border-primary/5 rounded-xl py-3 px-3 text-on-surface text-center font-headline font-bold" />
              </div>
              <div class="col-span-3">
                <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Title</label>
                <input id="edit-round-title" class="w-full bg-surface-container-lowest border border-primary/5 rounded-xl py-3 px-4 text-on-surface focus:ring-1 focus:ring-secondary/40 font-headline" />
              </div>
            </div>
            <div class="grid grid-cols-3 gap-4">
              <div class="col-span-2">
                <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Type</label>
                <select id="edit-round-type" class="w-full bg-surface-container-lowest border border-primary/5 rounded-xl py-3 px-4 text-on-surface">
                  ${roundTypes.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Duration (min)</label>
                <input id="edit-round-duration" type="number" min="1" class="w-full bg-surface-container-lowest border border-primary/5 rounded-xl py-3 px-4 text-on-surface" />
              </div>
            </div>
            <div>
              <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Max Round Score (Marks)</label>
              <input id="edit-round-max-score" type="number" min="1" class="w-full bg-surface-container-lowest border border-primary/5 rounded-xl py-3 px-4 text-secondary font-headline font-black text-xl" />
            </div>
          </div>
          <button id="save-edit-round" class="kinetic-gradient w-full py-4 rounded-xl font-headline font-bold text-white flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg">
            <span class="material-symbols-outlined">save</span> Save Changes
          </button>
        </div>
      </div>
    `;

    // Add round
    document.getElementById('add-round')?.addEventListener('click', async () => {
      const title = document.getElementById('round-title').value.trim();
      if (!title) return alert('Round title is required');

      const { error } = await supabase.from('rounds').insert({
        event_id: event.id,
        round_number: rounds.length + 1,
        round_type: document.getElementById('round-type').value,
        title,
        duration_minutes: 40,
        max_score: parseInt(document.getElementById('round-max-score').value) || 100
      });

      if (error) return Notifier.toast('Error: ' + error.message, 'error');
      Notifier.toast('Round added successfully', 'success');
      renderAdmin(container);
    });

    // Edit round
    el.querySelectorAll('.edit-round').forEach(btn => {
      btn.addEventListener('click', () => {
        const roundId = btn.dataset.editRound;
        const round = rounds.find(r => r.id === roundId);
        if (!round) return;
        document.getElementById('edit-round-id').value = round.id;
        document.getElementById('edit-round-number').value = round.round_number;
        document.getElementById('edit-round-title').value = round.title;
        document.getElementById('edit-round-type').value = round.round_type;
        document.getElementById('edit-round-duration').value = round.duration_minutes;
        document.getElementById('edit-round-max-score').value = round.max_score || 100;
        document.getElementById('edit-round-modal').classList.remove('hidden');
      });
    });

    document.getElementById('close-edit-round')?.addEventListener('click', () => {
      document.getElementById('edit-round-modal').classList.add('hidden');
    });

    document.getElementById('save-edit-round')?.addEventListener('click', async () => {
      const roundId = document.getElementById('edit-round-id').value;
      const title = document.getElementById('edit-round-title').value.trim();
      if (!title) return Notifier.toast('Round title is required', 'warning');

      const { error } = await supabase.from('rounds').update({
        round_number: parseInt(document.getElementById('edit-round-number').value),
        title,
        round_type: document.getElementById('edit-round-type').value,
        duration_minutes: parseInt(document.getElementById('edit-round-duration').value) || 40,
        max_score: parseInt(document.getElementById('edit-round-max-score').value) || 100
      }).eq('id', roundId);

      if (error) return Notifier.toast('Error: ' + error.message, 'error');
      document.getElementById('edit-round-modal').classList.add('hidden');
      renderAdmin(container);
    });

    // Delete round
    el.querySelectorAll('.del-round').forEach(btn => {
      btn.addEventListener('click', () => {
        Notifier.confirm(
          'Delete Round',
          'Are you sure you want to PERMANENTLY delete this round? This cannot be undone.',
          async () => {
            await supabase.from('rounds').delete().eq('id', btn.dataset.delRound);
            Notifier.toast('Round deleted', 'info');
            renderAdmin(container);
          },
          { type: 'error', icon: 'delete_forever' }
        );
      });
    });

    // Round Controls (Start, Pause, Resume, Complete)
    el.querySelectorAll('.round-ctrl').forEach(btn => {
      btn.addEventListener('click', async () => {
        const roundId = btn.dataset.roundId;
        const action = btn.dataset.roundAction;
        const round = rounds.find(r => r.id === roundId);
        if (!round) return;

        if (action === 'manage-intel') {
          renderRoundIntelligence(el, event, round, teams);
          return;
        }

        if (action === 'preview') {
          // Use first team as a persona for the preview if no specific team is selected
          const teamPersona = teams[0] || { id: 'preview-team', team_name: 'Audit Mode' };
          renderPreviewModal('round', teamPersona, round);
          return;
        }

        const updates = {};
        let currentConfig = round.config || {};
        if (typeof currentConfig === 'string') {
          try { currentConfig = JSON.parse(currentConfig); } catch (e) { currentConfig = {}; }
        }

        if (action === 'start') {
          updates.status = 'active';
          // Instant-Start Protocol: No buffer, start exactly now
          updates.started_at = new Date(timeSync.getSyncedTime()).toISOString();
          await supabase.from('events').update({ current_round_id: roundId }).eq('id', event.id);
          
          // Instant Socket Trigger
          socketService.emit('admin:round_start', { 
            eventId: event.id, 
            roundId: roundId, 
            startedAt: updates.started_at,
            roundNumber: round.round_number,
            roundTitle: round.title
          });
        } else if (action === 'pause') {
          updates.status = 'paused';
          updates.config = { ...currentConfig, paused_at: new Date().toISOString() };
        } else if (action === 'resume') {
          updates.status = 'active';
          if (currentConfig.paused_at) {
            const pausedAtTime = new Date(currentConfig.paused_at).getTime();
            const nowTime = timeSync.getSyncedTime();
            const pausedDurationMs = nowTime - pausedAtTime;
            
            if (round.started_at) {
              const staticStartTime = new Date(round.started_at).getTime();
              // Standardize resume without the 5s grace buffer
              updates.started_at = new Date(staticStartTime + pausedDurationMs).toISOString();
            }
            updates.config = { ...currentConfig };
            delete updates.config.paused_at;
          }
        } else if (action === 'complete') {
          updates.status = 'completed';
          updates.ended_at = new Date().toISOString();
        } else if (action === 'restart') {
          Notifier.confirm(
            'High-Risk Action',
            'Are you sure you want to RESTART this round? This will PERMANENTLY DELETE all scores, submissions, and anti-cheat logs for this round.',
            async () => {
              btn.innerHTML = 'Resetting...';
              btn.disabled = true;

              const [scoreRes, subRes, logRes] = await Promise.all([
                supabase.from('scores').delete().eq('round_id', roundId),
                supabase.from('submissions').delete().eq('round_id', roundId),
                supabase.from('anti_cheat_logs').delete().eq('round_id', roundId)
              ]);

              if (scoreRes.error || subRes.error || logRes.error) {
                Notifier.toast('Error during restart: ' + (scoreRes.error?.message || subRes.error?.message || logRes.error?.message), 'error');
                btn.innerHTML = 'Retry Restart';
                btn.disabled = false;
                return;
              }

              await supabase.from('rounds').update({
                status: 'pending',
                started_at: null,
                ended_at: null,
                config: {}
              }).eq('id', roundId);
              
              Notifier.toast('Round restarted successfully', 'success');
              renderAdmin(container);
            },
            { type: 'error', confirmText: 'Reset Round Data', icon: 'restart_alt' }
          );
          return; // Exit early as the modal handles the rest
        }

        await supabase.from('rounds').update(updates).eq('id', roundId);
        
        // Instant Socket Trigger
        socketService.emit('admin:status_update', { 
           eventId: event.id, 
           roundId: roundId, 
           status: updates.status,
           action: action,
           roundTitle: round.title
        });
        
        // BROADCAST TO LIVE TICKER
        let tickerMsg = '';
        if (action === 'start') tickerMsg = `Round ${round.round_number}: ${round.title} is now LIVE!`;
        if (action === 'pause') tickerMsg = `Round ${round.round_number} HAS BEEN PAUSED BY ADMIN.`;
        if (action === 'resume') tickerMsg = `Round ${round.round_number} IS BACK ONLINE. Time resumed.`;
        if (action === 'complete') tickerMsg = `Round ${round.round_number} HAS ENDED. Submissions closed.`;
        if (action === 'restart') tickerMsg = `Round ${round.round_number} HAS BEEN RESET for a fresh start.`;
        
        if (tickerMsg) ActivityBroadcast.push('status', tickerMsg);

        renderTabContent('rounds');
      });
    });
  }

  // ========================================
  // TEAMS TAB
  // ========================================
  function renderTeamsTab(el, event, teams, tabSwitches) {
    el.innerHTML = `
      <div class="flex items-end justify-between mb-8">
        <div>
          <h1 class="text-3xl font-headline font-bold text-on-surface">Teams</h1>
          <p class="text-on-surface-variant text-sm mt-1">${event.name} • ${teams.length} teams</p>
        </div>
        <div class="flex items-center gap-3">
          <button id="reveal-secrets-btn" class="glass-panel px-4 py-2 rounded-xl flex items-center gap-3 ${secretsRevealed ? 'bg-secondary/20 text-secondary' : 'hover:bg-white/5 text-on-surface-variant'} transition-all">
            <span class="material-symbols-outlined text-sm">${secretsRevealed ? 'visibility' : 'visibility_off'}</span>
            <span class="text-xs font-headline font-bold uppercase tracking-widest">${secretsRevealed ? 'Secrets Revealed' : 'Reveal Credentials'}</span>
          </button>
          <div class="glass-panel px-4 py-2 rounded-xl flex items-center gap-3">
            <span class="material-symbols-outlined text-error text-sm">dangerous</span>
            <span class="text-xs font-headline text-on-surface-variant">Eliminate bottom</span>
            <input id="eliminate-n" type="number" min="1" max="${teams.length}" value="1" class="w-14 bg-surface-container-lowest border-none rounded-lg py-1 px-2 text-on-surface text-center text-sm font-headline" />
            <button id="eliminate-btn" class="px-3 py-1.5 rounded-lg bg-error/20 text-error font-headline font-bold text-xs hover:bg-error/30">Eliminate</button>
          </div>
        </div>
      </div>

      <div class="glass-panel rounded-2xl overflow-hidden border border-outline-variant/10">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-surface-container-high/50 text-on-surface-variant font-headline text-[10px] uppercase tracking-widest">
              <th class="px-5 py-4">#</th>
              <th class="px-5 py-4">Team</th>
              <th class="px-5 py-4">Event</th>
              <th class="px-5 py-4">Members</th>
              <th class="px-5 py-4">Contact</th>
              <th class="px-5 py-4">Tab Sw.</th>
              <th class="px-5 py-4">Status</th>
              ${secretsRevealed ? `<th class="px-5 py-4 text-secondary">Access Secret</th>` : ''}
              <th class="px-5 py-4">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-variant/10">
            ${teams.map((t, i) => `
              <tr class="${t.status === 'eliminated' ? 'opacity-40' : ''} hover:bg-white/5 transition-all">
                <td class="px-5 py-4 text-xs text-on-surface-variant font-headline">${i + 1}</td>
                <td class="px-5 py-4">
                  <div class="flex items-center gap-3">
                    <span data-team-id="${t.id}" class="presence-dot w-2 h-2 rounded-full ${onlineTeams.has(t.id) ? 'bg-secondary animate-pulse' : 'bg-outline'}"></span>
                    <div>
                      <div class="font-headline font-bold text-on-surface text-sm">${t.team_name}</div>
                      <div class="text-[10px] text-on-surface-variant font-mono">${t.team_id}</div>
                    </div>
                  </div>
                </td>
                <td class="px-5 py-4">
                  <span class="text-xs text-secondary font-headline font-medium">${event.name}</span>
                </td>
                <td class="px-5 py-4 text-xs text-on-surface-variant">${(t.members || []).map(m => m.name).join(', ') || '—'}</td>
                <td class="px-5 py-4 text-xs text-on-surface-variant">${t.contact_email || t.contact_phone || '—'}</td>
                <td class="px-5 py-4">
                  <span id="tab-switches-${t.id}" class="font-headline font-bold text-sm ${(tabSwitches[t.id] || 0) > 0 ? 'text-error animate-pulse' : 'text-on-surface-variant'}">${tabSwitches[t.id] || 0}</span>
                </td>
                <td class="px-5 py-4">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${t.status === 'eliminated' ? 'bg-error/10 text-error' : 'bg-secondary/10 text-secondary'}">${t.status}</span>
                </td>
                ${secretsRevealed ? `
                  <td class="px-5 py-4">
                    <div class="text-sm font-mono font-bold text-secondary tracking-widest bg-secondary/5 px-3 py-1 rounded-lg border border-secondary/10 w-max">${t.plaintext_password || '—'}</div>
                  </td>
                ` : ''}
                <td class="px-5 py-4">
                  <button data-team="${t.id}" data-set-status="${t.status === 'eliminated' ? 'active' : 'eliminated'}" class="toggle-team text-[10px] font-bold px-3 py-1 rounded-lg ${t.status === 'eliminated' ? 'bg-secondary/20 text-secondary' : 'bg-error/20 text-error'} hover:opacity-80">
                    ${t.status === 'eliminated' ? 'Reinstate' : 'Eliminate'}
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Individual toggle
    el.querySelectorAll('.toggle-team').forEach(btn => {
      btn.addEventListener('click', async () => {
        const newStatus = btn.dataset.setStatus;
        await supabase.from('teams').update({ status: newStatus }).eq('id', btn.dataset.team);
        if (newStatus === 'eliminated') {
          await supabase.from('eliminations').insert({ event_id: event.id, team_id: btn.dataset.team });
          // Instant Socket Trigger
          socketService.emit('admin:eliminate', { teamIds: [btn.dataset.team] });
        }
        renderAdmin(container);
      });
    });

    // Eliminate bottom N
    document.getElementById('eliminate-btn')?.addEventListener('click', async () => {
      const n = parseInt(document.getElementById('eliminate-n').value);
      if (!n || n < 1) return;

      const { data: sc } = await supabase.from('scores').select('team_id, score');
      const activeTeams = teams.filter(t => t.status === 'active');
      const teamTotals = activeTeams.map(t => ({
        id: t.id,
        total: (sc || []).filter(s => s.team_id === t.id).reduce((sum, s) => sum + Number(s.score), 0)
      })).sort((a, b) => a.total - b.total);

      const toEliminate = teamTotals.slice(0, n);
      for (const t of toEliminate) {
        await supabase.from('teams').update({ status: 'eliminated' }).eq('id', t.id);
        await supabase.from('eliminations').insert({ event_id: event.id, team_id: t.id });
      }
      alert(`${toEliminate.length} team(s) eliminated.`);
      
      // Instant Socket Trigger
      socketService.emit('admin:eliminate', { teamIds: toEliminate.map(t => t.id) });
      
      renderAdmin(container);
    });

    // Reveal Secrets logic
    document.getElementById('reveal-secrets-btn')?.addEventListener('click', () => {
      if (secretsRevealed) {
        secretsRevealed = false;
        renderAdmin(container);
      } else {
        openSecretModal();
      }
    });
  }

  // ========================================
  // SECRET MODAL FOR ADMIN VERIFICATION
  // ========================================
  function openSecretModal() {
    const modal = document.createElement('div');
    modal.id = 'secret-verify-modal';
    modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6';
    modal.innerHTML = `
      <div class="glass-panel p-8 rounded-[40px] max-w-md w-full border-secondary/30 scale-in relative overflow-hidden">
        <div class="absolute -top-20 -right-20 w-40 h-40 bg-secondary/10 blur-[60px] rounded-full"></div>
        <div class="text-center space-y-6 relative z-10">
          <div class="w-16 h-16 bg-secondary/20 rounded-2xl flex items-center justify-center text-secondary mx-auto mb-4">
            <span class="material-symbols-outlined text-3xl">enhanced_encryption</span>
          </div>
          <h3 class="text-2xl font-headline font-bold text-on-surface uppercase tracking-tighter">Security Authorization</h3>
          <p class="text-on-surface-variant text-sm">Sensitive Operation: Re-enter your Administrator password to reveal team secrets.</p>
          
          <div class="space-y-4">
            <input id="admin-verify-pw" type="password" class="w-full bg-secondary/5 border border-secondary/20 rounded-2xl py-4 px-5 text-on-surface focus:ring-2 focus:ring-secondary/40 placeholder:text-slate-400 text-center text-lg" placeholder="••••••••" />
            <div id="verify-error" class="hidden text-error text-xs font-bold uppercase tracking-widest animate-shake">Invalid Authorization Code</div>
          </div>

          <div class="flex gap-3">
             <button id="cancel-verify" class="flex-1 py-4 rounded-2xl bg-white/5 text-on-surface-variant font-headline font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all">Cancel</button>
             <button id="confirm-verify" class="flex-1 py-4 rounded-2xl bg-secondary text-on-secondary-fixed font-headline font-bold text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">Authorize</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('cancel-verify').addEventListener('click', close);

    const verify = async () => {
      const pw = document.getElementById('admin-verify-pw').value;
      const btn = document.getElementById('confirm-verify');
      const err = document.getElementById('verify-error');
      
      btn.disabled = true;
      btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">refresh</span>';
      err.classList.add('hidden');

      try {
        const { data: match, error } = await supabase.rpc('verify_password', {
          p_password: pw,
          p_hash: user.password_hash || (await supabase.from('admins').select('password_hash').eq('id', user.id).single()).data.password_hash
        });

        if (error || !match) throw new Error('Invalid');

        secretsRevealed = true;
        close();
        renderAdmin(container);
      } catch (e) {
        err.classList.remove('hidden');
        btn.disabled = false;
        btn.innerHTML = 'Authorize';
      }
    };

    document.getElementById('confirm-verify').addEventListener('click', verify);
    document.getElementById('admin-verify-pw').addEventListener('keypress', e => e.key === 'Enter' && verify());
  }

  async function fetchRoundAssets(roundId, type) {
    try {
      if (type === 'quiz') {
        const { data } = await supabase.from('questions').select('*').eq('round_id', roundId).order('order_index');
        return data;
      } else if (type === 'logo') {
        const { data } = await supabase.from('logo_assets').select('*').eq('round_id', roundId).order('order_index');
        return data;
      } else if (type === 'prompt') {
        const { data } = await supabase.from('prompt_images').select('*').eq('round_id', roundId);
        return data;
      } else if (type === 'debate') {
        const { data } = await supabase.from('debate_topics').select('*').eq('round_id', roundId).maybeSingle();
        return data;
      }
      return null;
    } catch (e) {
      console.error('Error fetching assets:', e);
      return null;
    }
  }

  // ========================================
  // ROUND INTELLIGENCE AUDITOR
  // ========================================
  async function renderRoundIntelligence(el, event, round, teams) {
    const apiKey = event.config?.gemini_api_key;
    
    // Fetch all submissions and reference assets for this round
    const { data: submissions } = await supabase.from('submissions').select('*').eq('round_id', round.id);
    const { data: existingScores } = await supabase.from('scores').select('*').eq('round_id', round.id);
    const assets = await fetchRoundAssets(round.id, round.round_type);
    
    // Local state for pending verified scores
    let pendingScores = submissions?.reduce((acc, sub) => {
      const existing = existingScores?.find(s => s.team_id === sub.team_id);
      acc[sub.team_id] = {
        score: existing ? existing.score : 0,
        feedback: existing ? (JSON.parse(existing.evaluator_notes || '{}').feedback || '') : '',
        subId: sub.id,
        status: existing ? 'final' : 'pending'
      };
      return acc;
    }, {}) || {};

    async function commitScoresToDb() {
       const btn = document.getElementById('batch-commit-scores');
       if (!btn) return;
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">refresh</span> Committing...';
        
        try {
          for (const tid in pendingScores) {
            const p = pendingScores[tid];
            await supabase.from('scores').upsert({
              team_id: tid,
              round_id: round.id,
              score: p.score,
              evaluator_notes: JSON.stringify({ ai: true, feedback: p.feedback }),
              evaluated_at: new Date().toISOString()
            }, { onConflict: 'team_id,round_id' });
          }
          Notifier.toast('Leaderboard Synchronized', 'success');
          
          // Instant Socket Trigger
          console.log(`🏆 Pulse: Leaderboard Sync -> Event: ${event.id}`);
          socketService.emit('admin:leaderboard_update', { eventId: event.id });
          
          renderTabContent('rounds');
        } catch (e) {
          Notifier.toast('Commit failed: ' + e.message, 'error');
          btn.disabled = false;
          btn.innerHTML = '<span class="material-symbols-outlined text-sm">cloud_upload</span> Commit All Scores';
        }
    }

    function renderAuditUI() {
      // Background operation to re-attach listeners after re-render
      setTimeout(() => {
        document.getElementById('back-to-rounds')?.addEventListener('click', () => renderTabContent('rounds'));
        
        el.querySelectorAll('.audit-score-input').forEach(inp => {
          inp.addEventListener('input', (e) => {
            pendingScores[e.target.dataset.team].score = e.target.value;
            pendingScores[e.target.dataset.team].status = 'verified';
          });
        });

        el.querySelectorAll('.audit-feedback-input').forEach(inp => {
          inp.addEventListener('input', (e) => {
            pendingScores[e.target.dataset.team].feedback = e.target.value;
            pendingScores[e.target.dataset.team].status = 'verified';
          });
        });

        document.getElementById('batch-commit-scores')?.addEventListener('click', commitScoresToDb);
      }, 50);

      el.innerHTML = `
        <div class="flex items-center justify-between mb-8">
          <div>
            <button id="back-to-rounds" class="flex items-center gap-2 text-on-surface-variant hover:text-white mb-2 transition-colors">
              <span class="material-symbols-outlined text-sm">arrow_back</span>
              <span class="text-xs font-bold uppercase tracking-widest">Back</span>
            </button>
            <h1 class="text-3xl font-headline font-bold text-on-surface">Round Review</h1>
            <p class="text-on-surface-variant text-sm mt-1">Audit Mode: ${round.title} (${submissions?.length || 0} Submissions)</p>
          </div>
            <div class="flex items-center gap-3">
             <button disabled class="px-6 py-3 rounded-2xl bg-white/5 text-on-surface-variant font-headline font-bold text-xs uppercase tracking-widest border border-white/5 cursor-not-allowed flex items-center gap-3">
              <span class="material-symbols-outlined text-sm opacity-50">psychology</span> AI Insights (Soon)
            </button>
            <button id="batch-commit-scores" class="px-6 py-3 rounded-2xl kinetic-gradient text-on-primary-fixed font-headline font-bold text-xs uppercase tracking-widest flex items-center gap-3">
              <span class="material-symbols-outlined text-sm">cloud_upload</span> Import Score
            </button>
          </div>
        </div>

        <div class="mb-8 p-6 rounded-3xl bg-primary/5 border border-primary/10">
          <div class="flex items-center gap-3 mb-4">
            <span class="material-symbols-outlined text-primary">fact_check</span>
            <h3 class="font-headline font-bold text-on-surface text-sm uppercase tracking-widest">Master Reference Key</h3>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-48 custom-scrollbar pr-2">
            ${assets ? assets.map(a => `
              <div class="p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/30 transition-all flex flex-col gap-2">
                ${a.image_url ? `
                  <div class="rounded-xl overflow-hidden border border-white/10 aspect-video bg-black/40 flex items-center justify-center">
                    <img src="${a.image_url}" class="max-w-full max-h-full object-contain" />
                  </div>
                ` : ''}
                <div>
                  <div class="text-[10px] text-on-surface-variant uppercase font-black tracking-widest mb-1">
                    ${round.round_type === 'quiz' ? `Question Reference` : round.round_type === 'logo' ? `Logo Mastery` : `Master Objective`}
                  </div>
                  ${round.round_type === 'quiz' ? `
                    <div class="text-[11px] text-on-surface font-medium mb-1">${a.question_text || 'Unknown Question'}</div>
                    <div class="text-xs text-primary font-bold flex items-center gap-1">
                      <span class="material-symbols-outlined text-sm">check_circle</span>
                      ${a.correct_answer || 'N/A'}
                    </div>
                  ` : round.round_type === 'logo' ? `
                    <div class="text-[11px] text-on-surface font-bold">${a.company_name || 'Generic Tech'}</div>
                    <div class="text-[10px] text-secondary/80 italic line-clamp-2">${a.requirements || 'Follow industry standards'}</div>
                  ` : `
                    <div class="text-[11px] text-on-surface font-bold">${a.title || a.company_name || 'Standard Asset'}</div>
                    <div class="text-[10px] text-on-surface-variant/70 italic line-clamp-2">${a.content || a.description || a.requirements || 'Verify accuracy'}</div>
                  `}
                </div>
              </div>
            `).join('') : '<p class="text-xs text-on-surface-variant">No reference assets uploaded for this round.</p>'}
          </div>
        </div>

        <div class="glass-panel rounded-3xl overflow-hidden border border-primary/10 bg-white">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-secondary/5 text-on-surface-variant font-headline text-[10px] uppercase tracking-widest border-b border-primary/10">
                <th class="px-6 py-4">Team</th>
                <th class="px-6 py-4">Submission Context</th>
                <th class="px-6 py-4 w-24 text-center">Score</th>
                <th class="px-6 py-4">AI Prediction / Feedback</th>
                <th class="px-6 py-4 w-20">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-primary/5">
              ${teams.map(t => {
                const sub = submissions?.find(s => s.team_id === t.id);
                if (!sub) return '';
                const p = pendingScores[t.id];
                
                // Formatted submission display
                let contextHtml = '';
                const answers = sub.answers ? (typeof sub.answers === 'string' ? JSON.parse(sub.answers) : sub.answers) : null;

                if (round.round_type === 'quiz' && answers) {
                  contextHtml = Object.entries(answers).map(([qid, ans]) => {
                    const quest = assets?.find(q => q.id === qid);
                    const isCorrect = quest && String(ans).toLowerCase().trim() === String(quest.correct_answer).toLowerCase().trim();
                    return `
                      <div class="mb-2 last:mb-0 p-2 rounded-xl bg-black/20 border ${isCorrect ? 'border-secondary/20' : 'border-error/20'}">
                        <div class="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">${quest?.question_text || 'Question ' + qid}</div>
                        <div class="flex items-center gap-2 mt-1">
                          <span class="text-xs font-bold ${isCorrect ? 'text-secondary' : 'text-error'}">${ans}</span>
                          ${!isCorrect ? `<span class="text-[10px] text-on-surface-variant italic opacity-60">Master: ${quest?.correct_answer || '?'}</span>` : ''}
                        </div>
                      </div>
                    `;
                  }).join('');
                } else {
                  // Non-quiz rich display
                  contextHtml = `
                    <div class="space-y-3">
                      ${sub.text_content ? `
                        <div class="p-3 rounded-xl bg-secondary/5 border border-primary/10 text-[11px] text-on-surface leading-relaxed whitespace-pre-wrap">
                          ${sub.text_content}
                        </div>
                      ` : ''}
                      
                      ${answers?.imageUrl ? `
                        <div class="rounded-xl overflow-hidden border border-white/10 bg-black/40 max-h-32 flex items-center justify-center group relative cursor-pointer" onclick="window.open('${answers.imageUrl}', '_blank')">
                          <img src="${answers.imageUrl}" class="max-w-full max-h-full object-contain" />
                          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span class="material-symbols-outlined text-white">zoom_in</span>
                          </div>
                        </div>
                      ` : ''}

                      <div class="flex flex-wrap gap-2">
                        ${sub.github_link ? `
                          <a href="${sub.github_link}" target="_blank" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high border border-white/5 text-[10px] text-on-surface hover:bg-white/10 transition-all">
                            <span class="material-symbols-outlined text-[14px]">code</span> GitHub
                          </a>
                        ` : ''}
                        ${sub.live_link ? `
                          <a href="${sub.live_link}" target="_blank" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/10 border border-secondary/20 text-[10px] text-secondary hover:bg-secondary/20 transition-all">
                            <span class="material-symbols-outlined text-[14px]">language</span> Live Link
                          </a>
                        ` : ''}
                        ${sub.drive_link ? `
                          <a href="${sub.drive_link}" target="_blank" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tertiary/10 border border-tertiary/20 text-[10px] text-tertiary hover:bg-tertiary/20 transition-all">
                            <span class="material-symbols-outlined text-[14px]">folder</span> Assets
                          </a>
                        ` : ''}
                      </div>

                      ${!sub.text_content && !answers?.imageUrl && !sub.github_link && !sub.live_link && !sub.drive_link ? `
                        <div class="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest opacity-40 px-2">No media detected</div>
                      ` : ''}
                    </div>
                  `;
                }

                return `
                  <tr class="hover:bg-secondary/5 transition-all">
                    <td class="px-6 py-5">
                      <div class="font-headline font-bold text-on-surface text-sm">${t.team_name}</div>
                    </td>
                    <td class="px-6 py-5">
                      <div class="max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        ${contextHtml}
                      </div>
                    </td>
                    <td class="px-6 py-5">
                      <input type="number" data-team="${t.id}" class="audit-score-input w-20 bg-secondary/5 border border-primary/20 rounded-xl py-2 px-2 text-center text-sm text-primary font-bold focus:ring-2 focus:ring-primary/20" value="${p.score}" />
                    </td>
                    <td class="px-6 py-5">
                      <textarea data-team="${t.id}" class="audit-feedback-input w-full bg-secondary/5 border border-primary/20 rounded-xl py-2 px-3 text-xs text-secondary h-12 resize-none placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20">${p.feedback}</textarea>
                    </td>
                    <td class="px-6 py-5 text-center">
                      <span class="text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg ${p.status === 'suggested' ? 'bg-secondary/20 text-secondary animate-pulse' : p.status === 'final' ? 'bg-primary/20 text-primary' : 'bg-slate-100 text-on-surface-variant'}">${p.status}</span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    renderAuditUI();
  }

  // ========================================
  // SCORES TAB
  // ========================================
  function renderScoresTab(el, event, rounds, teams, allScores) {
    el.innerHTML = `
      <div class="flex items-end justify-between mb-8">
        <div>
      <div class="glass-panel rounded-2xl overflow-x-auto border border-primary/10 bg-white">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-secondary/5 text-on-surface-variant font-headline text-[10px] uppercase tracking-widest border-b border-primary/10">
              <th class="px-5 py-4 sticky left-0 bg-slate-50 z-20">Team</th>
              ${rounds.map(r => `<th class="px-5 py-4 text-center">R${r.round_number}</th>`).join('')}
              <th class="px-5 py-4 text-center font-bold">Total</th>
              <th class="px-5 py-4 text-center w-10">Review</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-primary/5">
            ${teams.map(t => {
              let total = 0;
              return `
                <tr class="hover:bg-secondary/5 transition-all">
                  <td class="px-5 py-3 sticky left-0 bg-white z-10 border-r border-primary/5">
                    <span class="font-headline font-bold text-on-surface text-sm">${t.team_id}</span>
                  </td>
                  ${rounds.map(r => {
                    const s = eventScores.find(sc => sc.team_id === t.id && sc.round_id === r.id);
                    if (s) total += Number(s.score);
                    return `
                      <td class="px-2 py-3 text-center">
                        <input type="number" data-team-id="${t.id}" data-round-id="${r.id}" class="inline-score-input w-20 bg-secondary/5 border border-primary/10 rounded-lg py-2 px-2 text-center text-sm font-headline text-on-surface hover:border-primary/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all ${!s ? 'opacity-40' : ''}" value="${s ? s.score : ''}" placeholder="—" />
                      </td>
                    `;
                  }).join('')}
                  <td class="px-5 py-3 text-center font-headline font-bold text-primary">${total}</td>
                  <td class="px-5 py-3 text-center">
                    <button class="review-submission-btn w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center hover:bg-secondary/20 transition-all" 
                            data-review-team="${t.id}">
                      <span class="material-symbols-outlined text-sm">visibility</span>
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    el.querySelectorAll('.review-submission-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const teamId = btn.dataset.reviewTeam;
        const team = teams.find(t => t.id === teamId);
        
        // Fetch all submissions for this team in this event
        const roundIds = rounds.map(r => r.id);
        const { data: submissions } = await supabase.from('submissions')
          .select('*, round:rounds(*)')
          .eq('team_id', teamId)
          .in('round_id', roundIds);

        if (!submissions || submissions.length === 0) {
          return Notifier.toast("No submissions found for this team.", "info");
        }

        // Fetch all assets for these rounds to get labels
        const [qData, lData, pData] = await Promise.all([
          supabase.from('questions').select('*').in('round_id', roundIds).order('order_index'),
          supabase.from('logo_assets').select('*').in('round_id', roundIds).order('order_index'),
          supabase.from('prompt_images').select('*').in('round_id', roundIds).order('order_index')
        ]);
        const allAssets = [...(qData.data || []), ...(lData.data || []), ...(pData.data || [])];

        // Group by Round
        const sortedSubmissions = rounds.map(r => ({
          round: r,
          submission: submissions.find(s => s.round_id === r.id)
        })).filter(item => item.submission);

        let bodyHtml = `
          <div class="space-y-4 text-left max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar submission-intelligence">
            ${sortedSubmissions.map((item, sIdx) => {
              const s = item.submission;
              const r = item.round;
              const answers = s.answers ? (typeof s.answers === 'string' ? JSON.parse(s.answers) : s.answers) : null;
              const roundAssets = allAssets.filter(a => a.round_id === r.id);

              // Formatting
              let formattedContent = '';
              const isQuizLike = ['quiz', 'logo', 'prompt'].includes(r.round_type);
              
              if (isQuizLike && answers) {
                formattedContent = `
                  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                    ${roundAssets.map((asset, index) => {
                      const ans = answers[asset.id];
                      if (ans === undefined || ans === null) return ''; 
                      
                      const assetIdx = index + 1;
                      const typeLabel = r.round_type === 'quiz' ? 'Question' : r.round_type === 'logo' ? 'Logo Option' : 'Prompt';
                      const label = `${typeLabel} ${assetIdx}`;
                      
                      const rawMaster = asset.correct_answer !== undefined ? asset.correct_answer : asset.answer;
                      
                      // Helper to map 0,1,2 to a,b,c if it's a quiz
                      const formatScoreVal = (v) => {
                        if (v === undefined || v === null || v === '') return '—';
                        if (r.round_type === 'quiz') {
                          const n = parseInt(v);
                          if (!isNaN(n) && n >= 0 && n <= 25) return String.fromCharCode(97 + n).toUpperCase(); // UPPERCASE for clarity
                        }
                        return v;
                      };

                      const displayAns = formatScoreVal(ans);
                      const displayMaster = formatScoreVal(rawMaster);
                      const isCorrect = rawMaster !== undefined && String(ans).toLowerCase().trim() === String(rawMaster).toLowerCase().trim();
                      const pointsValue = asset.points || 1;

                      return `
                        <div class="p-3 bg-black/40 border ${isCorrect ? 'border-secondary/30' : 'border-white/5'} rounded-2xl space-y-2 group/asset hover:border-primary/30 transition-all">
                          <div class="flex justify-between items-start text-[10px] text-on-surface-variant">
                            <div>
                               <span class="font-bold uppercase tracking-tighter block">${label}:</span>
                               <span class="text-[8px] bg-secondary/10 text-secondary px-1.5 py-0.5 rounded border border-secondary/20 mt-1 inline-block uppercase font-black">${pointsValue} Marks</span>
                            </div>
                            <span class="text-white font-headline font-bold text-xs">${displayAns}</span>
                          </div>
                          ${rawMaster !== undefined && rawMaster !== null ? `
                            <div class="flex items-center gap-2 pt-2 border-t border-white/5">
                              <span class="text-[9px] font-black text-secondary uppercase tracking-widest">Master Key:</span>
                              <span class="text-[10px] text-secondary font-bold">${displayMaster}</span>
                              ${isCorrect ? `<span class="material-symbols-outlined text-[14px] text-secondary">check_circle</span>` : ''}
                            </div>
                          ` : ''}
                        </div>
                      `;
                    }).join('')}
                  </div>
                `;
              }

              formattedContent += `
                <div class="space-y-4">
                  ${s.text_content ? `
                    <div class="p-4 rounded-2xl bg-secondary/5 border border-primary/10 text-sm text-on-surface leading-relaxed italic">
                      "${s.text_content}"
                    </div>
                  ` : ''}
                  
                  ${answers?.imageUrl ? `
                    <div class="max-w-md rounded-2xl overflow-hidden border border-white/10 bg-black/40 group relative cursor-pointer" onclick="window.open('${answers.imageUrl}', '_blank')">
                      <img src="${answers.imageUrl}" class="w-full h-auto object-contain max-h-64" />
                      <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span class="material-symbols-outlined text-white text-3xl">zoom_in</span>
                      </div>
                    </div>
                  ` : ''}

                  <div class="flex flex-wrap gap-3">
                    ${s.github_link ? `<a href="${s.github_link}" target="_blank" class="px-4 py-2 bg-white/5 border border-white/5 rounded-xl text-xs text-on-surface flex items-center gap-2 hover:bg-white/10 transition-all font-bold"><span class="material-symbols-outlined text-sm">code</span> Repository</a>` : ''}
                    ${s.live_link ? `<a href="${s.live_link}" target="_blank" class="px-4 py-2 bg-secondary/10 border border-secondary/20 rounded-xl text-xs text-secondary flex items-center gap-2 hover:bg-secondary/20 transition-all font-bold"><span class="material-symbols-outlined text-sm">language</span> Live Site</a>` : ''}
                    ${s.drive_link ? `<a href="${s.drive_link}" target="_blank" class="px-4 py-2 bg-tertiary/10 border border-tertiary/20 rounded-xl text-xs text-tertiary flex items-center gap-2 hover:bg-tertiary/20 transition-all font-bold"><span class="material-symbols-outlined text-sm">folder</span> Assets</a>` : ''}
                  </div>
                </div>
              `;

              return `
                <details class="group bg-white/5 border border-white/5 rounded-[24px] overflow-hidden transition-all duration-300" ${sIdx === 0 ? 'open' : ''}>
                  <summary class="flex items-center justify-between p-5 list-none cursor-pointer hover:bg-white/10 transition-all group-open:bg-white/5">
                    <div class="flex items-center gap-4">
                      <div class="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-headline font-black text-sm border border-primary/20">
                        ${r.round_number}
                      </div>
                      <div>
                        <div class="text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em] mb-0.5">Round Data // ${r.round_type}</div>
                        <div class="text-sm font-headline font-black text-on-surface uppercase tracking-wider">${r.title}</div>
                      </div>
                    </div>
                    <div class="flex items-center gap-4">
                      <span class="text-[10px] text-on-surface-variant font-mono bg-black/20 px-3 py-1 rounded-full border border-white/5">
                        ${new Date(s.submission_time).toLocaleTimeString()}
                      </span>
                      <span class="material-symbols-outlined text-on-surface-variant group-open:rotate-180 transition-transform duration-300">expand_more</span>
                    </div>
                  </summary>
                  <div class="p-6 border-t border-white/5 bg-black/20">
                    ${formattedContent}
                  </div>
                </details>
              `;
            }).join('')}
          </div>
        `;

        Notifier.modal({
          title: team.team_name,
          icon: 'intelligence',
          type: 'info',
          body: bodyHtml,
          size: 'wide'
        });
      });
    });

    el.querySelectorAll('.inline-score-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        const teamId = e.target.dataset.teamId;
        const roundId = e.target.dataset.roundId;
        const rawValue = e.target.value.trim();
        
        if (rawValue === '') return;
        
        const score = parseFloat(rawValue);
        if (isNaN(score)) return Notifier.toast('Enter a valid numerical score', 'error');

        input.classList.add('animate-pulse', 'text-primary');
        
        const round = rounds.find(r => r.id === roundId);
        
        const { error } = await supabase.from('scores').upsert({
          team_id: teamId, 
          round_id: roundId, 
          score, 
          max_score: round?.max_score || 100, 
          evaluated_at: new Date().toISOString()
        }, { onConflict: 'team_id,round_id' });
        
        if (error) {
          Notifier.toast('Error saving score: ' + error.message, 'error');
          input.classList.remove('animate-pulse', 'text-primary');
        } else {
          renderTabContent('scores');
          Notifier.toast('Score saved', 'success');
        }
      });
    });
  }

  // ========================================
  // ASSETS TAB (Questions & Logos)
  // ========================================
  async function renderAssetsTab(el, rounds) {
    const assetRounds = rounds.filter(r => 
      ['quiz', 'logo', 'prompt', 'video', 'webdev', 'debate'].includes(r.round_type)
    );
    
    if (!selectedBankRoundId || !assetRounds.find(r => r.id === selectedBankRoundId)) {
      selectedBankRoundId = assetRounds[0]?.id || null;
    }
    
    const selectedRound = assetRounds.find(r => r.id === selectedBankRoundId);
    
    let assets = [];
    if (selectedRound) {
      if (selectedRound.round_type === 'quiz') {
        const { data } = await supabase.from('questions').select('*').eq('round_id', selectedRound.id).order('order_index');
        assets = data || [];
      } else if (selectedRound.round_type === 'logo') {
        const { data } = await supabase.from('logo_assets').select('*').eq('round_id', selectedRound.id).order('order_index');
        assets = data || [];
      } else if (selectedRound.round_type === 'prompt') {
        const { data } = await supabase.from('prompt_images').select('*').eq('round_id', selectedRound.id).order('order_index');
        assets = data || [];
      } else if (selectedRound.round_type === 'debate') {
        const { data } = await supabase.from('debate_topics').select('*').eq('round_id', selectedRound.id).maybeSingle();
        assets = data ? [data] : [];
      }
    }

    el.innerHTML = `
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-headline font-bold text-on-surface">Round Assets</h1>
          <p class="text-on-surface-variant text-sm mt-1">${assetRounds.length} asset-based round(s) configured</p>
        </div>
        ${selectedRound ? `
          <button id="audition-round" data-round-id="${selectedRound.id}" data-round-type="${selectedRound.round_type}" class="px-6 py-3 bg-primary/10 text-primary border border-primary/20 rounded-xl font-headline font-bold text-xs uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center gap-2">
            <span class="material-symbols-outlined text-sm">visibility</span>
            Audition Round Content
          </button>
        ` : ''}
      </div>

      ${assetRounds.length === 0 ? '<div class="text-center py-12"><p class="text-on-surface-variant">No asset-based rounds added yet.</p></div>' : `
        <div class="glass-panel p-6 rounded-2xl mb-8">
          <label class="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-3">Select Round to Manage Configuration</label>
          <select id="bank-round-select" class="w-full bg-secondary/5 border border-primary/10 rounded-xl py-3 px-4 text-on-surface font-headline focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer appearance-none">
            ${assetRounds.map(r => `<option value="${r.id}" ${r.id === selectedBankRoundId ? 'selected' : ''}>R${r.round_number}: ${r.title} (${r.round_type})</option>`).join('')}
          </select>
        </div>

        ${selectedRound?.round_type === 'quiz' ? `
          <!-- QUIZ ADD UI -->
          <div class="glass-panel p-6 rounded-2xl mb-8 space-y-6">
            <div class="flex items-center justify-between">
              <h3 class="font-headline font-bold text-on-surface">Add Individual Question</h3>
              <button id="toggle-bulk-mode" class="text-xs font-headline font-bold text-primary hover:underline uppercase tracking-widest">Switch to Bulk Import</button>
            </div>
            
            <div id="individual-add-form" class="space-y-4">
              <textarea id="q-text" class="w-full bg-secondary/5 border border-primary/20 rounded-xl py-3 px-4 text-on-surface h-20 resize-none placeholder:text-slate-500 focus:ring-2 focus:ring-primary/10" placeholder="Enter question text..."></textarea>
              <div class="grid grid-cols-2 gap-3">
                <input id="q-opt-0" class="bg-secondary/5 border border-primary/20 rounded-xl py-3 px-4 text-on-surface placeholder:text-slate-500 text-sm focus:ring-2 focus:ring-primary/10" placeholder="Option A" />
                <input id="q-opt-1" class="bg-secondary/5 border border-primary/20 rounded-xl py-3 px-4 text-on-surface placeholder:text-slate-500 text-sm focus:ring-2 focus:ring-primary/10" placeholder="Option B" />
                <input id="q-opt-2" class="bg-secondary/5 border border-primary/20 rounded-xl py-3 px-4 text-on-surface placeholder:text-slate-500 text-sm focus:ring-2 focus:ring-primary/10" placeholder="Option C" />
                <input id="q-opt-3" class="bg-secondary/5 border border-primary/20 rounded-xl py-3 px-4 text-on-surface placeholder:text-slate-500 text-sm focus:ring-2 focus:ring-primary/10" placeholder="Option D" />
              </div>
              <div class="flex gap-3">
                <select id="q-correct" class="bg-secondary/5 border border-primary/20 rounded-xl py-3 px-4 text-on-surface text-sm flex-1 cursor-pointer">
                  <option value="0">Correct: A</option>
                  <option value="1">Correct: B</option>
                  <option value="2">Correct: C</option>
                  <option value="3">Correct: D</option>
                </select>
                <div class="flex flex-col">
                  <label class="text-[8px] font-bold text-on-surface-variant uppercase ml-2 mb-1">Award Marks</label>
                  <input id="q-points" type="number" min="1" value="1" class="w-24 bg-secondary/5 border border-primary/20 rounded-xl py-3 px-4 text-primary text-center font-headline font-bold" />
                </div>
                <button id="add-q" class="px-6 py-3 rounded-xl kinetic-gradient text-on-primary-fixed font-headline font-bold text-sm hover:scale-105 active:scale-95 transition-transform">Add Question</button>
              </div>
            </div>

            <!-- BULK IMPORT FORM -->
            <div id="bulk-import-form" class="hidden space-y-4">
              <div class="bg-primary/5 rounded-xl p-4 border border-primary/20">
                <h4 class="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Required JSON Format</h4>
                <pre class="text-[10px] text-primary/70 font-mono whitespace-pre-wrap">
[
  {
    "question": "What is 2+2?",
    "options": ["1", "2", "3", "4"],
    "correct": 3,
    "points": 5
  }
]</pre>
              </div>
              <textarea id="q-json-input" class="w-full bg-slate-50 border border-primary/10 rounded-xl py-4 px-4 text-slate-900 h-48 font-mono text-xs resize-none focus:ring-1 focus:ring-primary/40 placeholder:text-slate-400" placeholder="Paste your question array here..."></textarea>
              <button id="import-q-json" class="w-full py-4 rounded-xl kinetic-gradient text-on-primary-fixed font-headline font-bold text-sm tracking-widest uppercase hover:scale-[1.02] active:scale-[0.98] transition-all">Import All Questions</button>
            </div>
          </div>

          <!-- QUIZ LIST -->
          <div class="space-y-3 mb-8">
            ${assets.length === 0 ? '<p class="text-on-surface-variant text-center py-4">No questions added yet.</p>' : assets.map((q, i) => `
              <div class="bg-surface-container-low p-4 rounded-xl group hover:bg-surface-container transition-colors flex items-center justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] text-on-surface-variant font-headline font-bold uppercase tracking-widest">Q${i + 1}</span>
                    <span class="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-[8px] font-black uppercase tracking-widest border border-secondary/20">${q.points || 1} Marks</span>
                  </div>
                  <p class="text-sm text-on-surface mt-1">${q.question_text}</p>
                  <div class="flex gap-2 mt-2 flex-wrap text-left">
                    ${(() => {
                      const opts = typeof q.options === 'string' && q.options.startsWith('[') ? JSON.parse(q.options) : (q.options || []);
                      return opts.map((opt, j) => `
                        <span class="text-[10px] px-2 py-0.5 rounded ${j === q.correct_answer ? 'bg-secondary/20 text-secondary font-bold border border-secondary/20' : 'bg-surface-container-highest text-on-surface-variant'}">${String.fromCharCode(65 + j)}: ${opt}</span>
                      `).join('');
                    })()}
                  </div>
                </div>
                <button data-del-q="${q.id}" class="del-q w-8 h-8 rounded-lg bg-error/10 text-error flex items-center justify-center hover:bg-error/20 transition-all flex-shrink-0 ml-4">
                  <span class="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            `).join('')}
          </div>

          <!-- MANAGEMENT & BACKUPS -->
          <div class="pt-6 border-t border-white/5 space-y-6">
            <div class="flex items-center justify-between">
              <h3 class="font-headline font-bold text-on-surface uppercase text-sm tracking-widest">Shuffled Sets & Backups</h3>
              <div class="flex gap-2">
                <button id="gen-sets" class="px-4 py-2 rounded-lg bg-secondary/10 text-secondary border border-secondary/20 hover:bg-secondary/20 transition-all font-headline font-bold text-[10px] uppercase tracking-widest">Generate 5 Shuffled Sets</button>
                <button id="assign-sets" class="px-4 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all font-headline font-bold text-[10px] uppercase tracking-widest">Auto round-robin Assign</button>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <button data-pdf-set="A" class="dl-pdf bg-surface-container-low p-4 rounded-xl border border-white/5 hover:border-primary/50 transition-all text-left">
                <span class="material-symbols-outlined text-primary mb-2">picture_as_pdf</span>
                <div class="text-xs font-bold text-white uppercase font-headline tracking-tighter">Download Set A</div>
                <div class="text-[10px] text-on-surface-variant">Backup Sheet</div>
              </button>
              <button data-pdf-set="B" class="dl-pdf bg-surface-container-low p-4 rounded-xl border border-white/5 hover:border-primary/50 transition-all text-left">
                 <span class="material-symbols-outlined text-primary mb-2">picture_as_pdf</span>
                <div class="text-xs font-bold text-white uppercase font-headline tracking-tighter">Download Set B</div>
                 <div class="text-[10px] text-on-surface-variant">Backup Sheet</div>
              </button>
              <button data-pdf-set="C" class="dl-pdf bg-surface-container-low p-4 rounded-xl border border-white/5 hover:border-primary/50 transition-all text-left">
                 <span class="material-symbols-outlined text-primary mb-2">picture_as_pdf</span>
                <div class="text-xs font-bold text-white uppercase font-headline tracking-tighter">Download Set C</div>
                 <div class="text-[10px] text-on-surface-variant">Backup Sheet</div>
              </button>
              <button data-pdf-set="D" class="dl-pdf bg-surface-container-low p-4 rounded-xl border border-white/5 hover:border-primary/50 transition-all text-left">
                 <span class="material-symbols-outlined text-primary mb-2">picture_as_pdf</span>
                <div class="text-xs font-bold text-white uppercase font-headline tracking-tighter">Download Set D</div>
                 <div class="text-[10px] text-on-surface-variant">Backup Sheet</div>
              </button>
              <button data-pdf-set="E" class="dl-pdf bg-surface-container-low p-4 rounded-xl border border-white/5 hover:border-primary/50 transition-all text-left">
                 <span class="material-symbols-outlined text-primary mb-2">picture_as_pdf</span>
                <div class="text-xs font-bold text-white uppercase font-headline tracking-tighter">Download Set E</div>
                 <div class="text-[10px] text-on-surface-variant">Backup Sheet</div>
              </button>
              <button data-pdf-set="KEY" class="dl-pdf bg-secondary/10 p-4 rounded-xl border border-secondary/20 hover:bg-secondary/20 transition-all text-left">
                 <span class="material-symbols-outlined text-secondary mb-2">vpn_key</span>
                <div class="text-xs font-bold text-secondary uppercase font-headline tracking-tighter">Master Answer Key</div>
                 <div class="text-[10px] text-secondary/70">For all sets A-E</div>
              </button>
            </div>
          </div>
        ` : selectedRound?.round_type === 'prompt' ? `
          <!-- PROMPT ADD UI -->
          <div class="glass-panel p-6 rounded-2xl mb-8 space-y-4 glow-accent">
            <h3 class="font-headline font-bold text-white">Add Prompt Target to: <span class="text-primary">${selectedRound?.title}</span></h3>
            <p class="text-xs text-on-surface-variant">Upload an Image file and enter how many seconds it should be clearly visible before applying a blur overlay. For projector mode, leave the file blank.</p>
            <div class="flex max-md:flex-col gap-3 items-start">
              <div class="flex-1 space-y-3 w-full">
                <input type="file" id="p-file" accept="image/*" class="w-full bg-secondary/5 border border-primary/20 rounded-xl py-3 px-4 text-on-surface text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-on-primary-fixed hover:file:bg-primary/80" />
                <textarea id="p-seed" class="w-full bg-secondary/5 border border-primary/20 rounded-xl py-3 px-4 text-on-surface text-sm placeholder:text-slate-500 font-mono h-24" placeholder="Enter Master Prompt (The exact description used to generate this image)..."></textarea>
              </div>
              <div class="flex flex-col gap-3 w-full md:w-auto">
                <input id="p-duration" type="number" value="30" class="w-full md:w-32 bg-secondary/5 border border-primary/20 rounded-xl py-3 px-4 text-on-surface text-center font-bold" placeholder="Time (s)" />
                <input id="p-marks" type="number" value="1" class="w-full md:w-32 bg-secondary/5 border border-primary/20 rounded-xl py-3 px-4 text-on-surface text-center font-bold text-secondary" placeholder="Marks" />
                <button id="add-prompt" class="px-6 py-3 rounded-xl kinetic-gradient text-on-primary-fixed font-headline font-bold text-sm hover:scale-105 active:scale-95 transition-transform flex-shrink-0 disabled:opacity-50 flex items-center justify-center gap-2">Add Image</button>
              </div>
            </div>
          </div>

          <!-- PROMPT LIST -->
          <div class="space-y-3 mb-8">
            ${assets.length === 0 ? '<p class="text-on-surface-variant text-center py-4">No prompt images added yet.</p>' : assets.map((l, i) => `
              <div class="bg-surface-container-low p-4 rounded-xl group flex items-center justify-between border border-transparent hover:border-white/5 transition-all">
                <div class="flex items-center gap-4">
                  ${l.image_url ? `<img src="${l.image_url}" class="w-20 h-12 rounded object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all border border-white/10"/>` : `<div class="w-20 h-12 rounded bg-surface-container-highest flex items-center justify-center"><span class="material-symbols-outlined text-on-surface-variant/40">image_not_supported</span></div>`}
                  <div>
                    <div class="flex items-center gap-2">
                       <span class="text-[10px] text-on-surface-variant font-headline font-bold uppercase tracking-widest">P${i + 1}</span>
                       <span class="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-[8px] font-black uppercase tracking-widest border border-secondary/20">${l.points || 1} Marks</span>
                    </div>
                    <h4 class="font-headline font-bold text-on-surface uppercase tracking-widest text-sm">Timer: ${l.display_duration_seconds}s</h4>
                    <p class="text-[10px] text-on-surface-variant mt-1 line-clamp-1 italic max-w-sm">${l.seed_description || 'No Master Prompt'}</p>
                  </div>
                </div>
                <button data-del-prompt="${l.id}" class="del-prompt w-8 h-8 rounded-lg bg-error/10 text-error flex items-center justify-center hover:bg-error/20 transition-all flex-shrink-0">
                  <span class="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            `).join('')}
          </div>
        ` : selectedRound?.round_type === 'debate' ? `
          <!-- DEBATE ASSETS UI -->
          <div class="glass-panel p-8 rounded-2xl mb-8 space-y-6 glow-accent">
            <h3 class="font-headline font-bold text-on-surface text-xl flex items-center gap-3">
              <span class="material-symbols-outlined text-tertiary">forum</span>
              Configure Debate for: <span class="text-tertiary">${selectedRound.title}</span>
            </h3>
            
            <div class="space-y-4">
              <div class="space-y-2">
                <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Debate Topic</label>
                <textarea id="d-topic" class="w-full bg-secondary/5 border border-primary/20 rounded-xl py-4 px-4 text-on-surface font-headline text-lg resize-none placeholder:text-slate-500">${assets[0]?.topic || ''}</textarea>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Context / Description</label>
                  <textarea id="d-desc" class="w-full bg-secondary/5 border border-primary/20 rounded-xl py-3 px-4 text-on-surface h-32 resize-none placeholder:text-slate-500 text-sm" placeholder="Provide background information or guidelines...">${assets[0]?.description || ''}</textarea>
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Reference Image (Optional)</label>
                  <div class="bg-secondary/5 rounded-xl p-4 flex flex-col items-center justify-center border-2 border-dashed border-primary/20 hover:border-tertiary/40 transition-colors cursor-pointer relative group h-32">
                    <input type="file" id="d-file" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer z-10" />
                    ${assets[0]?.image_url ? `
                      <img src="${assets[0].image_url}" class="absolute inset-0 w-full h-full object-cover rounded-xl opacity-40 group-hover:opacity-60 transition-opacity" />
                      <div class="relative z-20 text-on-surface font-bold text-xs uppercase tracking-widest bg-white/80 backdrop-blur-md px-3 py-1 rounded-full">Change Image</div>
                    ` : `
                      <span class="material-symbols-outlined text-on-surface-variant/40 mb-2">image</span>
                      <span class="text-[10px] text-on-surface-variant uppercase font-bold">Click to Upload</span>
                    `}
                  </div>
                </div>
              </div>

              <div class="flex gap-4">
                <div class="space-y-2">
                  <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Max Prep Time (s)</label>
                  <input id="d-duration" type="number" value="${assets[0]?.duration_seconds || 60}" class="w-32 bg-secondary/5 border border-primary/20 rounded-xl py-3 px-4 text-on-surface font-headline text-center" />
                </div>
                <div class="flex-1 flex items-end">
                  <button id="save-debate-config" class="w-full py-3.5 rounded-xl bg-gradient-to-r from-tertiary to-primary text-on-primary-fixed font-headline font-bold text-sm tracking-widest uppercase hover:scale-[1.02] active:scale-[0.98] transition-transform">Save Debate Configuration</button>
                </div>
              </div>
            </div>
          </div>
        ` : (selectedRound?.round_type === 'video' || selectedRound?.round_type === 'webdev') ? `
          <!-- COMMON CONFIG UI FOR VIDEO/WEBDEV -->
          <div class="glass-panel p-8 rounded-2xl mb-8 space-y-6 border border-primary/10">
            <h3 class="font-headline font-bold text-on-surface text-xl flex items-center gap-3">
              <span class="material-symbols-outlined text-secondary">${selectedRound.round_type === 'video' ? 'videocam' : 'code'}</span>
              Manage ${selectedRound.round_type === 'video' ? 'Video Prompt' : 'Web Dev Guidelines'}: <span class="text-secondary">${selectedRound.title}</span>
            </h3>
            
            <div class="space-y-4">
              <div class="space-y-2">
                <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Instructions & Guidelines</label>
                <textarea id="config-guidelines" class="w-full bg-secondary/5 border border-primary/20 rounded-xl py-4 px-4 text-on-surface h-48 resize-none placeholder:text-slate-500 text-sm leading-relaxed" placeholder="Enter detailed round instructions for the participants...">${(() => {
                  let cfg = selectedRound.config || {};
                  if (typeof cfg === 'string') try { cfg = JSON.parse(cfg); } catch(e) { cfg = {}; }
                  return cfg.guidelines || '';
                })()}</textarea>
              </div>
              
              <button id="save-round-guidelines" class="w-full py-4 rounded-xl kinetic-gradient text-on-primary-fixed font-headline font-bold text-sm tracking-widest uppercase hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-sm">save</span>
                Update Guidelines
              </button>
            </div>
          </div>
        ` : `
          <!-- LOGO ADD UI -->
          <div class="glass-panel p-6 rounded-2xl mb-8 space-y-4 border border-primary/10">
            <h3 class="font-headline font-bold text-on-surface">Add Logo Target to: <span class="text-primary">${selectedRound?.title}</span></h3>
            <p class="text-xs text-on-surface-variant">Provide the correct brand name. If you want players to see the image on their device, select an Image file to upload. Leave the file blank to run Projector-Only Mode.</p>
            <div class="flex max-md:flex-col gap-3 items-center">
              <input id="l-brand" class="flex-1 bg-secondary/5 border border-primary/20 rounded-xl py-3 px-4 text-on-surface placeholder:text-slate-500 font-headline uppercase" placeholder="Correct Brand Name (e.g. Tesla)" />
              <input type="file" id="l-file" accept="image/*" class="flex-1 bg-secondary/5 border border-primary/20 rounded-xl py-3 px-4 text-on-surface text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-on-primary-fixed hover:file:bg-primary/80" />
              <input id="l-marks" type="number" value="1" class="w-24 bg-secondary/5 border border-primary/20 rounded-xl py-3 px-4 text-primary text-center font-bold" placeholder="Marks" />
              <button id="add-logo" class="px-6 py-3 rounded-xl kinetic-gradient text-on-primary-fixed font-headline font-bold text-sm hover:scale-105 active:scale-95 transition-transform flex-shrink-0 disabled:opacity-50 flex items-center gap-2">Add Logo Target</button>
            </div>
          </div>

          <!-- LOGO LIST -->
          <div class="space-y-3 mb-8">
            ${assets.length === 0 ? '<p class="text-on-surface-variant text-center py-4">No logos added yet.</p>' : assets.map((l, i) => `
              <div class="bg-surface-container-low p-4 rounded-xl group hover:border-primary/30 transition-colors flex items-center justify-between border border-transparent">
                <div class="flex items-center gap-4">
                  ${l.image_url ? `<img src="${l.image_url}" class="w-12 h-12 rounded-lg object-contain bg-white/5 p-1 border border-white/5 group-hover:border-primary/50 transition-all"/>` : `<div class="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center"><span class="material-symbols-outlined text-on-surface-variant/40">image_not_supported</span></div>`}
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-[10px] text-primary font-black uppercase tracking-widest font-headline">${l.correct_answer}</span>
                      <span class="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-[8px] font-black uppercase tracking-widest border border-secondary/20">${l.points || 1} Marks</span>
                    </div>
                    <div class="text-[8px] text-on-surface-variant uppercase mt-0.5">Asset ID: ${l.id.slice(0,8)}...</div>
                  </div>
                </div>
                <button data-del-logo="${l.id}" class="del-logo w-8 h-8 rounded-lg bg-error/10 text-error flex items-center justify-center hover:bg-error/20 transition-all">
                  <span class="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            `).join('')}
          </div>
        `}
      `}
    `;

    document.getElementById('bank-round-select')?.addEventListener('change', (e) => {
      selectedBankRoundId = e.target.value;
      renderTabContent('assets');
    });

    // Handle Quiz Addition
    document.getElementById('add-q')?.addEventListener('click', async () => {
      const text = document.getElementById('q-text').value.trim();
      if (!text) return Notifier.toast('Question text required', 'warning');
      const options = [0, 1, 2, 3].map(i => document.getElementById(`q-opt-${i}`).value.trim());
      if (options.some(o => !o)) return Notifier.toast('All 4 options required', 'warning');
      
      await supabase.from('questions').insert({
        round_id: selectedRound.id,
        question_text: text,
        options,
        correct_answer: parseInt(document.getElementById('q-correct').value),
        points: parseInt(document.getElementById('q-points').value) || 1,
        order_index: assets.length + 1
      });
      Notifier.toast('Question added successfully', 'success');
      renderTabContent('assets');
    });

    // Handle Bulk JSON Import
    document.getElementById('toggle-bulk-mode')?.addEventListener('click', () => {
      const form = document.getElementById('individual-add-form');
      const bulk = document.getElementById('bulk-import-form');
      const btn = document.getElementById('toggle-bulk-mode');
      
      if (form.classList.contains('hidden')) {
        form.classList.remove('hidden');
        bulk.classList.add('hidden');
        btn.innerText = 'Switch to Bulk Import';
      } else {
        form.classList.add('hidden');
        bulk.classList.remove('hidden');
        btn.innerText = 'Switch to Manual Entry';
      }
    });

    document.getElementById('import-q-json')?.addEventListener('click', async () => {
      const jsonStr = document.getElementById('q-json-input').value.trim();
      if (!jsonStr) return Notifier.toast('Please paste JSON data first', 'info');
      
      try {
        const questionsArr = JSON.parse(jsonStr);
        if (!Array.isArray(questionsArr)) throw new Error('Root must be an array');

        const btn = document.getElementById('import-q-json');
        btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-sm">refresh</span> Importing...`;
        btn.disabled = true;

        const mappedQuestions = questionsArr.map((q, idx) => ({
          round_id: selectedRound.id,
          question_text: q.question,
          options: q.options,
          correct_answer: q.correct,
          points: q.points || 1,
          order_index: assets.length + idx + 1
        }));

        const { error } = await supabase.from('questions').insert(mappedQuestions);
        if (error) throw error;

        Notifier.toast(`Successfully imported ${mappedQuestions.length} questions!`, 'success');
        renderTabContent('assets');
      } catch (err) {
        Notifier.alert('Bulk Import Error', err.message, 'error');
        const btn = document.getElementById('import-q-json');
        btn.innerText = 'Import All Questions';
        btn.disabled = false;
      }
    });

    el.querySelectorAll('.del-q').forEach(btn => {
      btn.addEventListener('click', () => {
        Notifier.confirm(
          'Delete Question',
          'Are you sure you want to remove this question? This will affect all generated sets.',
          async () => {
            const { error } = await supabase.from('questions').delete().eq('id', btn.dataset.delQ);
            if (error) Notifier.toast('Error: ' + error.message, 'error');
            else Notifier.toast('Question deleted', 'info');
            renderTabContent('assets');
          },
          { type: 'error', icon: 'delete' }
        );
      });
    });

    document.getElementById('gen-sets')?.addEventListener('click', async () => {
      if (!assets.length) return Notifier.toast('Add questions first', 'warning');
      
      Notifier.confirm(
        'Generate Question Sets',
        'This will clear existing sets and generate 5 new shuffled variants (A-E) for this round. Proceed?',
        async () => {
          const btn = document.getElementById('gen-sets');
          btn.innerHTML = 'Shuffling...';
          btn.disabled = true;

          await supabase.from('question_sets').delete().eq('round_id', selectedRound.id);
          
          const setLabels = ['A', 'B', 'C', 'D', 'E'];
          const qIds = assets.map(q => q.id);
          
          const setRecords = setLabels.map(label => {
            const shuffled = [...qIds].sort(() => Math.random() - 0.5);
            return { round_id: selectedRound.id, set_label: label, question_order: shuffled };
          });

          const { error } = await supabase.from('question_sets').insert(setRecords);
          if (error) Notifier.toast('Set Error: ' + error.message, 'error');
          else Notifier.toast('5 Sets (A-E) generated successfully!', 'success');
          renderTabContent('assets');
        },
        { confirmText: 'Generate & Shuffle', icon: 'shuffle' }
      );
    });

    document.getElementById('assign-sets')?.addEventListener('click', async () => {
      const { data: qSets } = await supabase.from('question_sets').select('*').eq('round_id', selectedRound.id);
      if (!qSets?.length) return Notifier.toast('Generate sets first', 'warning');

      const { data: teams } = await supabase.from('teams').select('id').eq('event_id', selectedRound.event_id);
      if (!teams?.length) return Notifier.toast('No teams registered', 'warning');

      Notifier.confirm(
        'Assign Sets',
        `This will assign all ${teams.length} teams to the 5 generated question sets in round-robin order. Continue?`,
        async () => {
          const btn = document.getElementById('assign-sets');
          btn.innerHTML = 'Assigning...';
          btn.disabled = true;

          await supabase.from('team_set_assignments').delete().eq('round_id', selectedRound.id);

          const sortedSets = qSets.sort((a,b) => a.set_label.localeCompare(b.set_label));
          const assignments = teams.map((team, idx) => ({
            team_id: team.id,
            round_id: selectedRound.id,
            set_id: sortedSets[idx % sortedSets.length].id
          }));

          const { error } = await supabase.from('team_set_assignments').insert(assignments);
          if (error) Notifier.toast('Assign Error: ' + error.message, 'error');
          else Notifier.toast(`Assigned ${assignments.length} teams to sets!`, 'success');
          renderTabContent('assets');
        },
        { icon: 'group_add' }
      );
    });

    el.querySelectorAll('.dl-pdf').forEach(btn => {
      btn.addEventListener('click', async () => {
         const setLabel = btn.dataset.pdfSet;
         const originalInner = btn.innerHTML;
         
         // Start Loading
         btn.disabled = true;
         btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-[10px] mb-2">refresh</span><div class="text-[10px] font-bold uppercase tracking-widest">Generating...</div>`;
         
         try {
           const doc = new jsPDF();
           
           // Fetch event name with fallback
           const { data: eventData } = await supabase.from('events').select('name').eq('id', selectedRound.event_id).single();
           const eventName = eventData?.name || 'Technical Event';
           
           doc.setFontSize(22);
           doc.setTextColor(0,0,0);
           doc.text(eventName, 105, 20, { align: 'center'});
           doc.setFontSize(14);
           doc.text(`ROUND ${selectedRound.round_number}: ${selectedRound.title}`, 105, 30, { align: 'center'});
           
           if (setLabel === 'KEY') {
              doc.setFontSize(18);
              doc.text('MASTER ANSWER KEY', 105, 45, { align: 'center'});
              let y = 60;
              assets.forEach((q, i) => {
                if (y > 270) { doc.addPage(); y = 20; }
                const opts = typeof q.options === 'string' && q.options.startsWith('[') ? JSON.parse(q.options) : (q.options || []);
                doc.setFontSize(10);
                const qText = `${i+1}. ${q.question_text}`;
                const splitText = doc.splitTextToSize(qText, 170);
                doc.text(splitText, 20, y);
                y += (splitText.length * 6);
                
                doc.setFontSize(10);
                doc.setTextColor(40, 167, 69);
                doc.text(`[ANS: ${String.fromCharCode(65 + q.correct_answer)} - ${opts[q.correct_answer] || 'N/A'}]`, 20, y);
                doc.setTextColor(0,0,0);
                y += 12;
              });
              doc.save(`ANSWER_KEY_${selectedRound.title.replace(/\s/g,'_')}.pdf`);
           } else {
              const { data: setInfo } = await supabase.from('question_sets').select('*').eq('round_id', selectedRound.id).eq('set_label', setLabel).single();
              if (!setInfo) {
                Notifier.toast(`Set ${setLabel} not found. Please generate sets first.`, 'error');
                throw new Error('Set not found');
              }
              
              doc.setFontSize(18);
              doc.text(`QUESTION SET: ${setLabel}`, 105, 45, { align: 'center'});
              
              const orderedQIds = setInfo.question_order;
              const orderedQs = orderedQIds.map(id => assets.find(a => a.id === id)).filter(Boolean);
              
              let y = 65;
              orderedQs.forEach((q, i) => {
                 const qText = `${i+1}. ${q.question_text}`;
                 const splitTitle = doc.splitTextToSize(qText, 170);
                 
                 if (y + (splitTitle.length * 7) + 30 > 280) { doc.addPage(); y = 20; }
                 
                 doc.setFont('helvetica', 'bold');
                 doc.text(splitTitle, 20, y);
                 y += (splitTitle.length * 7);
                 
                 doc.setFont('helvetica', 'normal');
                 const opts = typeof q.options === 'string' && q.options.startsWith('[') ? JSON.parse(q.options) : (q.options || []);
                 opts.forEach((opt, oi) => {
                    doc.text(`(${String.fromCharCode(65+oi)}) ${opt}`, 30, y);
                    y += 7;
                 });
                 y += 8;
              });
              doc.save(`SET_${setLabel}_${selectedRound.title.replace(/\s/g,'_')}.pdf`);
           }
         } catch (err) {
           console.error('PDF Generation Error:', err);
           if (err.message !== 'Set not found') Notifier.toast('Failed to generate PDF', 'error');
         } finally {
            btn.disabled = false;
            btn.innerHTML = originalInner;
         }
      });
    });

    // Helper function to upload file to storage
    async function uploadAsset(fileInputId) {
      const fileEl = document.getElementById(fileInputId);
      if (!fileEl || !fileEl.files || !fileEl.files[0]) return null;
      
      const file = fileEl.files[0];
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\\-_]/g, '_')}`;
      
      const { data, error } = await supabase.storage.from('assets').upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });
      
      if (error) {
         console.error("Storage upload error:", error);
         Notifier.alert('Asset Upload Failed', error.message, 'error');
         throw error;
      }
      
      const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(fileName);
      return publicUrl;
    }

    // Handle Logo Addition
    document.getElementById('add-logo')?.addEventListener('click', async (e) => {
      const brand = document.getElementById('l-brand').value.trim();
      if (!brand) return Notifier.toast('Brand name is required', 'warning');
      
      const btn = e.currentTarget;
      const originalText = btn.innerHTML;
      
      try {
        btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-sm">refresh</span> Uploading...`;
        btn.disabled = true;
        
        let url = await uploadAsset('l-file');

        await supabase.from('logo_assets').insert({
          round_id: selectedRound.id,
          correct_answer: brand,
          image_url: url || null,
          points: parseInt(document.getElementById('l-marks')?.value) || 1,
          order_index: assets.length + 1
        });
        renderTabContent('assets');
      } catch (err) {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });
    el.querySelectorAll('.del-logo').forEach(btn => {
      btn.addEventListener('click', async () => {
        Notifier.confirm(
          'Remove Asset',
          'Delete this logo target? This will remove it from the round pool.',
          async () => {
            const { error } = await supabase.from('logo_assets').delete().eq('id', btn.dataset.delLogo);
            if (error) Notifier.toast('Error: ' + error.message, 'error');
            else Notifier.toast('Asset removed', 'info');
            renderTabContent('assets');
          },
          { type: 'error', icon: 'delete_sweep' }
        );
      });
    });

    document.getElementById('add-prompt')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const originalText = btn.innerHTML;
      try {
        btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-sm">refresh</span> Uploading...`;
        btn.disabled = true;

        const url = await uploadAsset('p-file');
        const duration = parseInt(document.getElementById('p-duration').value.trim()) || 30;
        const seedPrompt = document.getElementById('p-seed').value.trim();
        const marks = parseInt(document.getElementById('p-marks').value.trim()) || 1;
        
        const { error } = await supabase.from('prompt_images').insert({
          round_id: selectedRound.id,
          image_url: url || null,
          display_duration_seconds: duration,
          seed_description: seedPrompt,
          points: marks,
          order_index: assets.length + 1
        });
        
        if (error) throw error;
        
        renderTabContent('assets');
        Notifier.toast('Prompt asset added successfully', 'success');
      } catch (err) {
        console.error("Error adding prompt:", err);
        Notifier.toast("Failed to add prompt: " + (err.message || "Unknown error"), "error");
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });

    el.querySelectorAll('.del-prompt').forEach(btn => {
      btn.addEventListener('click', async () => {
        Notifier.confirm(
          'Remove Asset',
          'Delete this prompt image? This will remove it from the round requirements.',
          async () => {
            const { error } = await supabase.from('prompt_images').delete().eq('id', btn.dataset.delPrompt);
            if (error) Notifier.toast('Error: ' + error.message, 'error');
            else Notifier.toast('Asset removed', 'info');
            renderTabContent('assets');
          },
          { type: 'error', icon: 'delete_sweep' }
        );
      });
    });

    // Handle Debate Config Save
    document.getElementById('save-debate-config')?.addEventListener('click', async (e) => {
      const topic = document.getElementById('d-topic').value.trim();
      const desc = document.getElementById('d-desc').value.trim();
      const duration = parseInt(document.getElementById('d-duration').value) || 60;
      if (!topic) return Notifier.toast('Debate topic is required', 'warning');
      Notifier.toast('Saving topic configuration...', 'info');

      const btn = e.currentTarget;
      const originalText = btn.innerHTML;
      try {
        btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-sm">refresh</span> Saving...`;
        btn.disabled = true;

        let url = await uploadAsset('d-file');
        const updateData = { topic, description: desc, duration_seconds: duration };
        if (url) updateData.image_url = url;

        const { data: existing } = await supabase.from('debate_topics').select('id').eq('round_id', selectedRound.id).maybeSingle();
        if (existing) {
          await supabase.from('debate_topics').update(updateData).eq('id', existing.id);
        } else {
          await supabase.from('debate_topics').insert({ round_id: selectedRound.id, ...updateData });
        }
        Notifier.toast('Debate configuration saved!', 'success');
        renderTabContent('assets');
      } catch (err) {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });

    // Handle Generic Guidelines Save (Video/WebDev)
    document.getElementById('save-round-guidelines')?.addEventListener('click', async (e) => {
      const guidelines = document.getElementById('config-guidelines').value.trim();
      const btn = e.currentTarget;
      const originalText = btn.innerHTML;
      
      try {
        btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-sm">refresh</span> Updating...`;
        btn.disabled = true;

        let cfg = selectedRound.config || {};
        if (typeof cfg === 'string') try { cfg = JSON.parse(cfg); } catch(e) { cfg = {}; }
        cfg.guidelines = guidelines;

        await supabase.from('rounds').update({ config: cfg }).eq('id', selectedRound.id);
        Notifier.toast('Round guidelines updated!', 'success');
        renderTabContent('assets');
      } catch (err) {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });
  }




  // Live Auto-Refresh for Anti-Cheat Tab Switches
  if (window.adminPollInterval) clearInterval(window.adminPollInterval);
  window.adminPollInterval = setInterval(async () => {
    if (!selectedEventId) return;
    try {
      const { data: teamsData, error } = await supabase.from('teams').select('id, tab_switch_count').eq('event_id', selectedEventId);
      if (error || !teamsData) return;

      for (const t of teamsData) {
        const span = document.getElementById(`tab-switches-${t.id}`);
        if (span && parseInt(span.textContent || '0') !== (t.tab_switch_count || 0)) {
          span.textContent = t.tab_switch_count || 0;
          if ((t.tab_switch_count || 0) > 0) {
            span.className = 'font-headline font-bold text-sm text-error animate-pulse';
          }
        }
      }
    } catch (err) {
      console.error('Admin poll error:', err);
    }
  }, 2500);

  // ========================================
  // REGISTRATION PAGE EDITOR TAB
  // ========================================
  async function renderRegistrationPageTab(el, event) {
    if (!event) return;

    let cfg = event.registration_config || {};
    if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg); } catch(e) { cfg = {}; } }
    const extraFields = Array.isArray(cfg.extra_fields) ? cfg.extra_fields : [];

    el.innerHTML = `
      <div class="flex items-end justify-between mb-8">
        <div>
          <h1 class="text-3xl font-headline font-bold text-on-surface">Registration Page</h1>
          <p class="text-on-surface-variant text-sm mt-1">${event.name} · Customize what participants see when registering</p>
        </div>
        <button type="button" onclick="sessionStorage.setItem('admin_return','true');window.location.hash='/register/${event.slug || ''}'" class="px-4 py-2 rounded-xl bg-secondary/10 text-secondary font-headline font-bold text-xs border border-secondary/20 hover:bg-secondary/20 flex items-center gap-2">
          <span class="material-symbols-outlined text-sm">visibility</span> Preview Page
        </button>
      </div>

      <!-- Banner Section -->
      <div class="glass-panel p-6 rounded-2xl mb-6 space-y-4">
        <h3 class="font-headline font-bold text-on-surface flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">image</span> Banner & Branding
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Banner Image</label>
            <div class="flex gap-3">
              <input id="reg-banner-file" type="file" accept="image/*" class="hidden" />
              <button id="reg-banner-pick" class="flex-1 py-3 px-4 rounded-xl border border-dashed border-primary/30 text-on-surface-variant hover:border-primary/60 hover:text-primary transition-all font-headline text-sm flex items-center justify-center gap-2 bg-secondary/5">
                <span class="material-symbols-outlined text-sm">upload</span> Upload Banner
              </button>
            </div>
            ${cfg.banner_url ? `
              <div class="relative rounded-xl overflow-hidden h-24 bg-secondary/5 border border-primary/10">
                <img id="reg-banner-preview" src="${cfg.banner_url}" class="w-full h-full object-cover" />
                <button id="reg-banner-remove" class="absolute top-2 right-2 w-6 h-6 bg-error/90 text-white rounded-full text-xs flex items-center justify-center hover:bg-error shadow-lg">×</button>
              </div>
            ` : `<div id="reg-banner-preview-area" class="h-24 rounded-xl bg-secondary/5 border border-primary/10 flex items-center justify-center text-on-surface-variant/30 text-xs italic">No banner uploaded</div>`}
          </div>
          <div class="space-y-3">
            <div class="space-y-1">
              <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Page Headline</label>
              <input id="reg-headline" class="w-full bg-secondary/5 border border-primary/10 rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 placeholder:text-slate-500 font-headline font-bold" placeholder="e.g. Join the Arena · HostiBuzz 2026" value="${cfg.headline || ''}" />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Subheading / Instructions</label>
              <textarea id="reg-subheading" class="w-full bg-secondary/5 border border-primary/10 rounded-xl py-3 px-4 text-on-surface focus:ring-2 focus:ring-primary/20 placeholder:text-slate-500 h-16 resize-none text-sm leading-relaxed" placeholder="e.g. Register your team below. Each team may have up to 4 members.">${cfg.subheading || ''}</textarea>
            </div>
          </div>
        </div>
      </div>

      <!-- Custom Fields Builder -->
      <div class="glass-panel p-6 rounded-2xl mb-6 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-headline font-bold text-on-surface flex items-center gap-2">
            <span class="material-symbols-outlined text-secondary">dynamic_form</span> Custom Form Fields
          </h3>
          <button id="add-reg-field" class="px-4 py-2 rounded-xl bg-secondary/10 text-secondary font-headline font-bold text-xs border border-secondary/20 hover:bg-secondary/20 flex items-center gap-2">
            <span class="material-symbols-outlined text-sm">add</span> Add Field
          </button>
        </div>
        <!-- Already-included notice -->
        <div class="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/20">
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-primary text-lg shrink-0 mt-0.5">info</span>
            <div>
              <p class="text-xs font-bold text-on-surface mb-2">These fields are <span class="text-primary">already included</span> by default — do NOT add them again:</p>
              <div class="flex flex-wrap gap-2">
                ${['Team Name', 'Member 1 / 2 / 3 (+ Add more)', 'Contact Email', 'Contact Phone'].map(f => `
                  <span class="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <span class="material-symbols-outlined text-xs">check_circle</span> ${f}
                  </span>
                `).join('')}
              </div>
              <p class="text-[10px] text-on-surface-variant/50 mt-3">Use <span class="text-secondary font-bold">Custom Fields</span> only for extra info you need — e.g. Roll Number, Department, College Name, Year of Study, GitHub URL, etc.</p>
            </div>
          </div>
        </div>

        <div id="reg-fields-list" class="space-y-3">
          ${extraFields.length === 0 ? '<p class="text-center text-on-surface-variant/30 italic text-sm py-8">No custom fields configured. Click "+ Add Field" to start building your form.</p>' : extraFields.map((f, i) => `
            <div class="bg-secondary/5 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-start md:items-center border border-primary/10 shadow-sm" data-field-idx="${i}">
              <div class="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                <input class="field-label bg-white border border-primary/10 rounded-xl py-2.5 px-4 text-on-surface text-sm placeholder:text-slate-400 font-bold" placeholder="Field Label (e.g. Roll Number)" value="${f.label || ''}" />
                <select class="field-type bg-white border border-primary/10 rounded-xl py-2.5 px-4 text-on-surface text-sm font-headline cursor-pointer">
                  <option value="text" ${f.type === 'text' ? 'selected' : ''}>Text Field</option>
                  <option value="email" ${f.type === 'email' ? 'selected' : ''}>Email Address</option>
                  <option value="tel" ${f.type === 'tel' ? 'selected' : ''}>Phone Number</option>
                  <option value="textarea" ${f.type === 'textarea' ? 'selected' : ''}>Long Text Area</option>
                  <option value="select" ${f.type === 'select' ? 'selected' : ''}>Dropdown Select</option>
                </select>
                <input class="field-options bg-white border border-primary/10 rounded-xl py-2.5 px-4 text-on-surface text-sm placeholder:text-slate-400 ${f.type === 'select' ? '' : 'opacity-40 pointer-events-none'}" placeholder="Options (A, B, C...)" value="${(f.options || []).join(', ')}" title="Only for dropdown fields" />
              </div>
              <div class="flex items-center gap-4 shrink-0">
                <label class="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant cursor-pointer group">
                  <input type="checkbox" class="field-required w-4 h-4 rounded border-primary/20 text-primary focus:ring-primary/20" ${f.required ? 'checked' : ''} />
                  Required
                </label>
                <button class="del-reg-field w-10 h-10 rounded-xl bg-error/10 text-error flex items-center justify-center hover:bg-error/20 transition-all border border-error/10">
                  <span class="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Save Button -->
      <div class="flex justify-end">
        <button id="save-reg-config" class="kinetic-gradient px-10 py-4 rounded-xl font-headline font-bold text-on-primary-fixed flex items-center gap-3 hover:scale-105 active:scale-95 transition-transform shadow-[0_10px_30px_rgba(167,165,255,0.3)]">
          <span class="material-symbols-outlined">save</span> Save Registration Page
        </button>
      </div>
    `;

    // ---- Banner upload ----
    let bannerUrl = cfg.banner_url || null;
    document.getElementById('reg-banner-pick')?.addEventListener('click', () => {
      document.getElementById('reg-banner-file').click();
    });
    document.getElementById('reg-banner-file')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const btn = document.getElementById('reg-banner-pick');
      btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">progress_activity</span>';
      const path = `reg-banners/${event.id}-${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage.from('assets').upload(path, file, { upsert: true });
      if (error) { alert('Upload error: ' + error.message); btn.innerHTML = '<span class="material-symbols-outlined text-sm">upload</span> Upload Banner'; return; }
      const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path);
      bannerUrl = urlData.publicUrl;
      btn.innerHTML = '<span class="material-symbols-outlined text-sm">check_circle</span> Uploaded!';
      // Show preview
      const previewArea = document.getElementById('reg-banner-preview-area') || document.getElementById('reg-banner-preview');
      if (previewArea) {
        previewArea.outerHTML = `<div class="relative rounded-xl overflow-hidden h-24 bg-surface-container-lowest"><img id="reg-banner-preview" src="${bannerUrl}" class="w-full h-full object-cover" /><button id="reg-banner-remove" class="absolute top-2 right-2 w-6 h-6 bg-error/80 text-white rounded-full text-xs flex items-center justify-center hover:bg-error">×</button></div>`;
      }
    });
    el.querySelector('#reg-banner-remove')?.addEventListener('click', () => {
      bannerUrl = null;
      const img = document.getElementById('reg-banner-preview')?.parentElement;
      if (img) img.outerHTML = `<div id="reg-banner-preview-area" class="h-24 rounded-xl bg-surface-container-lowest flex items-center justify-center text-on-surface-variant/30 text-xs italic">No banner uploaded</div>`;
    });

    // ---- Add field ----
    document.getElementById('add-reg-field')?.addEventListener('click', () => {
      const list = document.getElementById('reg-fields-list');
      const emptyMsg = list.querySelector('p');
      if (emptyMsg) emptyMsg.remove();
      const idx = list.children.length;
      const div = document.createElement('div');
      div.className = 'bg-surface-container-lowest rounded-xl p-4 flex flex-col md:flex-row gap-3 items-start md:items-center';
      div.dataset.fieldIdx = idx;
      div.innerHTML = `
        <div class="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
          <input class="field-label bg-surface-container border-none rounded-lg py-2 px-3 text-white text-sm placeholder:text-slate-600" placeholder="Field Label e.g. Roll Number" value="" />
          <select class="field-type bg-surface-container border-none rounded-lg py-2 px-3 text-white text-sm">
            <option value="text">Text</option><option value="email">Email</option><option value="tel">Phone</option><option value="textarea">Long Text</option><option value="select">Dropdown Select</option>
          </select>
          <input class="field-options bg-surface-container border-none rounded-lg py-2 px-3 text-white text-sm placeholder:text-slate-600 opacity-40 pointer-events-none" placeholder="Options (comma-separated)" value="" title="Only for dropdown" />
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <label class="flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer">
            <input type="checkbox" class="field-required rounded" /> Required
          </label>
          <button class="del-reg-field w-8 h-8 rounded-lg bg-error/10 text-error flex items-center justify-center hover:bg-error/20"><span class="material-symbols-outlined text-sm">delete</span></button>
        </div>
      `;
      list.appendChild(div);
      // wire select → options visibility
      div.querySelector('.field-type').addEventListener('change', function() {
        div.querySelector('.field-options').classList.toggle('opacity-40', this.value !== 'select');
        div.querySelector('.field-options').classList.toggle('pointer-events-none', this.value !== 'select');
      });
      div.querySelector('.del-reg-field').addEventListener('click', () => div.remove());
    });

    // Wire selects for existing fields
    el.querySelectorAll('[data-field-idx] .field-type').forEach(sel => {
      sel.addEventListener('change', function() {
        const row = this.closest('[data-field-idx]');
        row.querySelector('.field-options').classList.toggle('opacity-40', this.value !== 'select');
        row.querySelector('.field-options').classList.toggle('pointer-events-none', this.value !== 'select');
      });
    });
    el.querySelectorAll('.del-reg-field').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('[data-field-idx]').remove());
    });

    // ---- Save ----
    document.getElementById('save-reg-config')?.addEventListener('click', async () => {
      const btn = document.getElementById('save-reg-config');
      btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span>';
      btn.disabled = true;

      const fields = [];
      el.querySelectorAll('[data-field-idx]').forEach((row, i) => {
        const label = row.querySelector('.field-label')?.value?.trim();
        const type = row.querySelector('.field-type')?.value || 'text';
        const required = row.querySelector('.field-required')?.checked || false;
        const optionsRaw = row.querySelector('.field-options')?.value?.trim() || '';
        const options = type === 'select' ? optionsRaw.split(',').map(o => o.trim()).filter(Boolean) : [];
        if (label) {
          fields.push({ id: `custom_${i}_${Date.now()}`, label, type, required, options });
        }
      });

      const newConfig = {
        banner_url: bannerUrl,
        headline: document.getElementById('reg-headline')?.value?.trim() || null,
        subheading: document.getElementById('reg-subheading')?.value?.trim() || null,
        extra_fields: fields
      };

      const { error } = await supabase.from('events').update({ registration_config: newConfig }).eq('id', event.id);
      if (error) {
        alert('Error saving: ' + error.message);
        btn.innerHTML = '<span class="material-symbols-outlined">save</span> Save Registration Page';
        btn.disabled = false;
      } else {
        btn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Saved!';
        btn.className = 'px-10 py-4 rounded-xl font-headline font-bold bg-secondary text-on-secondary flex items-center gap-3';
        setTimeout(() => renderTabContent('reg-page'), 1500);
      }
    });
  }
}

