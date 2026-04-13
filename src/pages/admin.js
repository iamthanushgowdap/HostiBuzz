import { supabase } from '../config/supabase.js';
import { getState } from '../services/state.js';
import { renderNavbar, bindNavbarEvents } from '../components/navbar.js';
import { navigate } from '../router.js';
import { Notifier } from '../services/notifier.js';
import { jsPDF } from 'jspdf';
import { renderDashboard } from './dashboard.js';
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

export async function renderAdmin(container) {
  const user = getState('user');
  let onlineTeams = new Set();
  
  // Initialize Presence
  const presenceChannel = supabase.channel('online-teams');
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

  function refreshSidebarPresence() {
    container.querySelectorAll('.presence-dot').forEach(dot => {
      const teamId = dot.dataset.teamId;
      if (onlineTeams.has(teamId)) {
        dot.classList.remove('bg-outline');
        dot.classList.add('bg-secondary', 'animate-pulse');
      } else {
        dot.classList.remove('bg-secondary', 'animate-pulse');
        dot.classList.add('bg-outline');
      }
    });
  }

  // Fetch all events
  const { data: events } = await supabase.from('events').select('*').order('created_at', { ascending: false });

  // Fetch all teams if an event is selected
  let teams = [];
  if (selectedEventId) {
    const { data } = await supabase.from('teams').select('*').eq('event_id', selectedEventId).order('team_name');
    teams = data || [];
  }

  container.innerHTML = `
    ${renderNavbar({ activeLink: 'dashboard' })}
    <div class="flex min-h-[calc(100vh-76px)]">
      <!-- Sidebar -->
      <aside class="hidden lg:flex flex-col w-72 bg-surface-container-low/80 backdrop-blur-lg border-r border-white/5">
        <div class="p-6">
          <h3 class="text-lg font-black text-white font-headline">Control Panel</h3>
          <p class="text-[10px] text-on-surface-variant uppercase tracking-widest">Administrator // ${user.username}</p>
        </div>

        <!-- NEW: Preview Engine -->
        <div class="px-6 mb-8 py-4 bg-primary/5 border-y border-white/5">
          <h4 class="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-sm">visibility</span>
            Preview Engine
          </h4>
          <div class="flex flex-col gap-2">
            <select id="preview-team-select" class="w-full bg-surface-container-lowest border-none rounded-lg py-2 px-3 text-[10px] text-white font-headline">
              <option value="">Select Team to Preview...</option>
              ${teams.map(t => `<option value="${t.id}">${t.team_name}</option>`).join('')}
            </select>
            <button id="launch-preview" class="w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white font-headline font-bold text-[10px] uppercase tracking-widest border border-white/10 transition-all">
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
        </nav>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 p-6 lg:p-10 overflow-y-auto relative">
        <div class="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none"></div>
        <div id="admin-content" class="max-w-6xl mx-auto relative z-10 w-full"></div>
        
        <!-- Global Notification Sender -->
        <div class="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3 pointer-events-none">
          <div id="broadcast-popup" class="hidden bg-surface-container-high/90 backdrop-blur-md p-4 rounded-2xl border border-white/10 w-72 shadow-2xl transition-all pointer-events-auto slide-in-bottom">
            <h4 class="text-xs font-headline font-bold text-primary uppercase tracking-widest mb-3 flex items-center gap-2"><span class="material-symbols-outlined text-sm">wifi_tethering</span> Global Broadcast</h4>
            <textarea id="broadcast-msg" class="w-full h-20 bg-surface-container-lowest text-white text-sm border-none rounded-xl p-3 resize-none focus:ring-1 focus:ring-primary mb-2 placeholder:text-slate-500" placeholder="Type a message to push to all teams instantly..."></textarea>
            <button id="send-broadcast" class="w-full py-2 bg-primary text-on-primary-fixed rounded-xl font-headline font-bold text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2">Send Now</button>
          </div>
          <button id="broadcast-toggle" class="w-14 h-14 bg-gradient-to-r from-primary to-secondary rounded-full shadow-[0_10px_30px_rgba(167,165,255,0.3)] flex items-center justify-center text-on-primary-fixed hover:scale-110 active:scale-95 transition-all pointer-events-auto shadow-primary/20">
            <span class="material-symbols-outlined text-2xl">campaign</span>
          </button>
        </div>
      </main>
    </div>

    <!-- Create Event Modal -->
    <div id="create-event-modal" class="hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div class="glass-panel p-8 rounded-3xl max-w-lg w-full border border-white/10 space-y-6">
        <div class="flex justify-between items-center">
          <h2 class="text-2xl font-headline font-bold text-white">Create New Event</h2>
          <button id="close-create-modal" class="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-white transition-colors">
            <span class="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        <div class="space-y-4">
          <div class="space-y-2">
            <label class="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Event Name *</label>
            <input id="new-event-name" class="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white focus:ring-1 focus:ring-secondary/40 placeholder:text-slate-600 font-headline" placeholder="e.g. HostiBuzz 2026, TechNova, HackFest" />
          </div>
          <div class="space-y-2">
            <label class="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Organizer</label>
            <input id="new-event-organizer" class="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white focus:ring-1 focus:ring-secondary/40 placeholder:text-slate-600" placeholder="e.g. CS Department, IEEE Chapter" />
          </div>
          <div class="space-y-2">
            <label class="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Description</label>
            <textarea id="new-event-desc" class="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white focus:ring-1 focus:ring-secondary/40 placeholder:text-slate-600 h-20 resize-none" placeholder="What's this event about?"></textarea>
          </div>
          <div class="space-y-2">
            <label class="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Event Date</label>
            <input id="new-event-date" type="datetime-local" style="color-scheme: dark" class="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white focus:ring-1 focus:ring-secondary/40" />
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
  // EVENT SIDEBAR: select an event
  // ========================================
  container.querySelectorAll('.event-select').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedEventId = btn.dataset.eventId;
      renderAdmin(container);
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
    renderAdmin(container);
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

  // Pre-initialize channel for faster sending
  const broadcastChannel = supabase.channel('global-system').subscribe();

  if (broadcastToggle && broadcastPopup) {
    broadcastToggle.addEventListener('click', () => {
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
        <h1 class="text-4xl font-headline font-bold text-white mb-3">Welcome to Admin Panel</h1>
        <p class="text-on-surface-variant max-w-lg mb-8">Create a new event or select an existing one from the sidebar to manage rounds, teams, and scores.</p>
        <button id="welcome-create-event" class="kinetic-gradient px-8 py-4 rounded-xl font-headline font-bold text-on-primary-fixed flex items-center gap-3 hover:scale-105 active:scale-95 transition-transform shadow-[0_10px_30px_rgba(167,165,255,0.3)]">
          <span class="material-symbols-outlined">add_circle</span> Create Your First Event
        </button>

        ${eventList?.length ? `
          <div class="mt-12 w-full max-w-2xl">
            <h3 class="text-sm font-headline font-bold text-on-surface-variant/60 tracking-widest uppercase mb-4">or select an event</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              ${eventList.map(ev => `
                <button data-pick-event="${ev.id}" class="pick-event bg-surface-container-low p-5 rounded-2xl text-left hover:bg-surface-container transition-all group">
                  <div class="flex items-center gap-3 mb-2">
                    <span class="w-2.5 h-2.5 rounded-full ${ev.status === 'active' ? 'bg-secondary animate-pulse' : ev.status === 'completed' ? 'bg-primary' : 'bg-outline'}"></span>
                    <h4 class="font-headline font-bold text-white group-hover:text-primary transition-colors">${ev.name}</h4>
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
      btn.addEventListener('click', () => {
        selectedEventId = btn.dataset.pickEvent;
        renderAdmin(container);
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
            <h2 class="text-3xl font-headline font-bold text-white tracking-tight">Export / Import Engine</h2>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Export Section -->
            <div class="glass-panel p-6 rounded-2xl space-y-4">
              <h3 class="font-headline font-bold text-white text-lg flex items-center gap-2">
                <span class="material-symbols-outlined text-primary">cloud_download</span>
                Export for AI Evaluation
              </h3>
              <p class="text-xs text-on-surface-variant leading-relaxed">Select a round to export all team submissions in an AI-ready JSON format. This file includes detailed evaluation instructions for the HostiBuzz AI scoring pipeline.</p>
              
              <div class="space-y-3 pt-2">
                <select id="export-round-select" class="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white focus:ring-1 focus:ring-primary/40 text-sm">
                  ${(rounds || []).filter(r => r.round_type !== 'elimination').map(r => `<option value="${r.id}">Round ${r.round_number}: ${r.title}</option>`).join('')}
                </select>
                <button id="download-round-json" class="w-full py-4 kinetic-gradient text-on-primary-fixed font-headline font-bold text-xs uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                  <span class="material-symbols-outlined text-sm">file_download</span> Prepare AI-Ready File
                </button>
              </div>
            </div>

            <!-- Import Section -->
            <div class="glass-panel p-6 rounded-2xl space-y-4">
              <h3 class="font-headline font-bold text-white text-lg flex items-center gap-2">
                <span class="material-symbols-outlined text-secondary">cloud_upload</span>
                Import AI Results
              </h3>
              <p class="text-xs text-on-surface-variant leading-relaxed">Paste the AI-generated JSON results or upload the file. You will see a data verification table before any changes are applied to the database.</p>
              
              <div class="space-y-4 pt-2">
                <textarea id="import-json-paste" class="w-full h-32 bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white focus:ring-1 focus:ring-secondary/40 text-xs font-mono placeholder:text-slate-600 resize-none" placeholder="Paste AI JSON here..."></textarea>
                
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
        } else if (round.round_type === 'debate') {
          const { data: topic } = await supabase.from('debate_topics').select('*').eq('round_id', roundId).maybeSingle();
          context.debate = topic || {};
        }

        const exportData = {
          event: { name: event.name, id: event.id },
          round: { title: round.title, type: round.round_type, number: round.round_number, id: round.id },
          context: context,
          instructions_for_ai: {
            role: "You are an expert evaluator",
            task: `Evaluate ${round.title}`,
            scoring_schema: { total: "<score>" }
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
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
          `;

          scoresArr.slice(0, 10).forEach(s => {
            tableHtml += `
              <tr>
                <td class="p-3 text-white font-headline">${s.team_name || 'Unknown'} <span class="text-[10px] text-on-surface-variant opacity-50">(${s.team_id})</span></td>
                <td class="p-3 text-primary font-bold text-center">${s.total || s.score || 0}</td>
              </tr>
            `;
          });

          if (scoresArr.length > 10) {
            tableHtml += `<tr><td colspan="2" class="p-3 text-center text-on-surface-variant italic">... and ${scoresArr.length - 10} more entries</td></tr>`;
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
                    max_score: s.max_score || 30,
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

    el.innerHTML = `
      <div class="flex items-start justify-between mb-8">
        <div>
          <div class="flex items-center gap-3 mb-2">
            <span class="w-3 h-3 rounded-full ${event.status === 'active' ? 'bg-secondary animate-pulse' : event.status === 'completed' ? 'bg-primary' : 'bg-outline'}"></span>
            <span class="text-xs font-bold tracking-widest text-on-surface-variant uppercase">${event.status}</span>
          </div>
          <h1 class="text-4xl md:text-5xl font-headline font-bold text-white tracking-tighter">${event.name}</h1>
          <p class="text-on-surface-variant mt-2">${event.organizer || ''} ${event.event_date ? '• ' + new Date(event.event_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : ''}</p>
          ${event.description ? `<p class="text-on-surface-variant/60 text-sm mt-1 max-w-2xl">${event.description}</p>` : ''}
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-surface-container-low p-5 rounded-2xl relative overflow-hidden group">
          <div class="relative z-10">
            <span class="text-[10px] font-headline tracking-widest text-on-surface-variant uppercase">Teams / Occupancy</span>
            <div class="text-3xl font-headline font-black text-white mt-1">
              ${totalTeams}${maxTeams > 0 ? `<span class="text-lg text-on-surface-variant/40"> / ${maxTeams}</span>` : ''}
            </div>
            <span class="text-[10px] text-secondary">${activeTeams} active</span>
          </div>
          ${maxTeams > 0 ? `
            <div class="absolute bottom-0 left-0 h-1 bg-secondary/20 w-full">
              <div class="h-full bg-secondary transition-all duration-1000" style="width: ${occupancyPercent}%"></div>
            </div>
          ` : ''}
        </div>
        <div class="bg-surface-container-low p-5 rounded-2xl">
          <span class="text-[10px] font-headline tracking-widest text-on-surface-variant uppercase">Rounds</span>
          <div class="text-3xl font-headline font-black text-white mt-1">${(rounds || []).length}</div>
          <span class="text-[10px] text-primary">${completedRounds} done</span>
        </div>
        <div class="bg-surface-container-low p-5 rounded-2xl">
          <span class="text-[10px] font-headline tracking-widest text-on-surface-variant uppercase">Active Round</span>
          <div class="text-3xl font-headline font-black text-white mt-1">${activeRounds || '—'}</div>
        </div>
        <div class="bg-surface-container-low p-5 rounded-2xl">
          <span class="text-[10px] font-headline tracking-widest text-on-surface-variant uppercase">Registration</span>
          <div class="text-xl font-headline font-black mt-1 ${event.registration_open ? (occupancyPercent >= 100 && maxTeams > 0 ? 'text-error' : 'text-secondary') : 'text-error'}">
            ${event.registration_open ? (occupancyPercent >= 100 && maxTeams > 0 ? 'FULL' : 'OPEN') : 'CLOSED'}
          </div>
        </div>
      </div>

      <!-- General Information & Registration Limits -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div class="glass-panel p-6 rounded-2xl space-y-4">
          <h3 class="font-headline font-bold text-white text-lg flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">edit_note</span>
            General Information
          </h3>
          <div class="space-y-3">
             <div class="space-y-1">
              <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Event Name</label>
              <input id="edit-event-name" value="${event.name || ''}" class="w-full bg-surface-container-lowest border-none rounded-xl py-2 px-3 text-white focus:ring-1 focus:ring-primary/40 text-sm" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Organizer</label>
                <input id="edit-event-organizer" value="${event.organizer || ''}" class="w-full bg-surface-container-lowest border-none rounded-xl py-2 px-3 text-white focus:ring-1 focus:ring-primary/40 text-sm" />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Event Date</label>
                <input id="edit-event-date" type="datetime-local" style="color-scheme: dark" value="${event.event_date ? new Date(new Date(event.event_date).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : ''}" class="w-full bg-surface-container-lowest border-none rounded-xl py-2 px-3 text-white focus:ring-1 focus:ring-primary/40 text-sm" />
              </div>
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Description</label>
              <textarea id="edit-event-desc" class="w-full bg-surface-container-lowest border-none rounded-xl py-2 px-3 text-white focus:ring-1 focus:ring-primary/40 text-sm h-16 resize-none">${event.description || ''}</textarea>
            </div>
          </div>
          <button id="save-event-info" class="w-full py-3 rounded-xl bg-primary/20 text-primary font-headline font-bold text-xs uppercase tracking-widest hover:bg-primary/30 transition-all flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-sm">save</span> Save General Info
          </button>
        </div>

        <div class="glass-panel p-6 rounded-2xl space-y-4">
          <h3 class="font-headline font-bold text-white text-lg flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">settings_input_component</span>
            Registration Limits
          </h3>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Max Teams</label>
              <input id="edit-max-teams" type="number" min="0" value="${event.max_teams || ''}" placeholder="Unlimited" class="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white focus:ring-1 focus:ring-primary/40" />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Max Team Size</label>
              <input id="edit-max-team-size" type="number" min="1" value="${event.max_team_size || 4}" class="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white focus:ring-1 focus:ring-primary/40" />
            </div>
          </div>
          <button id="save-event-limits" class="w-full py-3 rounded-xl bg-primary/20 text-primary font-headline font-bold text-xs uppercase tracking-widest hover:bg-primary/30 transition-all flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-sm">save</span> Update Limits
          </button>
        </div>

        <div class="glass-panel p-6 rounded-2xl space-y-4">
          <h3 class="font-headline font-bold text-white text-lg flex items-center gap-2">
            <span class="material-symbols-outlined text-secondary">bolt</span>
            Quick Actions
          </h3>
          <div class="flex flex-wrap gap-3">
            <button data-action="toggle-status" class="event-action flex-1 px-5 py-3 rounded-xl font-headline font-bold text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95 ${event.status === 'active' ? 'bg-error/20 text-error hover:bg-error/30' : 'bg-secondary/20 text-secondary hover:bg-secondary/30'}">
              ${event.status === 'active' ? '⬛ End Event' : event.status === 'draft' ? '▶ Activate Event' : '🔄 Reactivate'}
            </button>
            <button data-action="toggle-registration" class="event-action flex-1 px-5 py-3 rounded-xl font-headline font-bold text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95 ${event.registration_open ? 'bg-error/20 text-error hover:bg-error/30' : 'bg-primary/20 text-primary hover:bg-primary/30'}">
              ${event.registration_open ? '🔒 Close Registration' : '📝 Open Registration'}
            </button>
          </div>
        </div>
      </div>

      <!-- Registration Link (shown when registration is open) -->
      ${event.registration_open ? `
        <div class="glass-panel p-6 rounded-2xl mb-8 glow-accent">
          <div class="flex items-center gap-3 mb-3">
            <span class="material-symbols-outlined text-secondary">share</span>
            <h3 class="font-headline font-bold text-white text-lg">Registration Link</h3>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex-1 bg-surface-container-lowest rounded-xl py-3 px-4 font-mono text-sm text-primary truncate select-all" id="reg-link-display">
              ${window.location.origin}${window.location.pathname}#/register/${event.slug || generateSlug(event.name)}
            </div>
            <button id="copy-reg-link" class="px-5 py-3 rounded-xl bg-secondary/20 text-secondary font-headline font-bold text-sm hover:bg-secondary/30 transition-colors flex items-center gap-2 flex-shrink-0">
              <span class="material-symbols-outlined text-sm">content_copy</span> Copy
            </button>
          </div>
        </div>
      ` : ''}
    `;

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
  }

  // ========================================
  // ROUNDS TAB
  // ========================================
  function renderRoundsTab(el, event, rounds) {
    const roundTypes = [
      { value: 'quiz', label: 'Quiz (MCQ)', icon: 'quiz' },
      { value: 'logo', label: 'Logo Identification', icon: 'image_search' },
      { value: 'prompt', label: 'Prompt Writing', icon: 'edit_note' },
      { value: 'webdev', label: 'Web Dev Submission', icon: 'code' },
      { value: 'video', label: 'Video Submission', icon: 'videocam' },
      { value: 'debate', label: 'Tech Debate', icon: 'forum' }
    ];

    el.innerHTML = `
      <div class="flex items-end justify-between mb-8">
        <div>
          <h1 class="text-3xl font-headline font-bold text-white">Rounds</h1>
          <p class="text-on-surface-variant text-sm mt-1">${event.name} • ${rounds.length} rounds configured</p>
        </div>
      </div>

      <!-- Add Round -->
      <div class="glass-panel p-6 rounded-2xl mb-8 space-y-4">
        <h3 class="font-headline font-bold text-white">Add New Round</h3>
        <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div class="md:col-span-1">
            <label class="text-[10px] font-bold tracking-widest text-on-surface-variant uppercase block mb-1">Order</label>
            <input id="add-round-number" type="number" min="1" value="${rounds.length + 1}" class="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-3 text-white text-center font-headline font-bold" />
          </div>
          <div class="md:col-span-4">
            <label class="text-[10px] font-bold tracking-widest text-on-surface-variant uppercase block mb-1">Round Title</label>
            <input id="add-round-title" class="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white focus:ring-1 focus:ring-secondary/40 placeholder:text-slate-600 font-headline" placeholder="e.g. Logical Quiz, Speed Coding" />
          </div>
          <div class="md:col-span-3">
            <label class="text-[10px] font-bold tracking-widest text-on-surface-variant uppercase block mb-1">Type</label>
            <select id="add-round-type" class="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white">
              ${roundTypes.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
            </select>
          </div>
          <div class="md:col-span-2">
            <label class="text-[10px] font-bold tracking-widest text-on-surface-variant uppercase block mb-1">Duration (min)</label>
            <input id="add-round-duration" type="number" min="1" value="40" class="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white" />
          </div>
          <div class="md:col-span-2 flex items-end">
            <button id="confirm-add-round" class="w-full py-3 rounded-xl kinetic-gradient text-on-primary-fixed font-headline font-bold text-sm hover:scale-105 active:scale-95 transition-transform flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-sm">add</span> Add
            </button>
          </div>
        </div>
      </div>

      <!-- Existing Rounds -->
      <div class="space-y-3" id="rounds-list">
        ${rounds.length === 0 ? '<p class="text-center text-on-surface-variant/40 py-8 italic">No rounds added yet. Add your first round above.</p>' : rounds.map(r => {
          const typeInfo = roundTypes.find(t => t.value === r.round_type) || {};
          return `
            <div class="bg-surface-container-low p-5 rounded-2xl flex flex-col xl:flex-row xl:items-center justify-between gap-4 group hover:bg-surface-container transition-all">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-xl ${r.status === 'completed' ? 'bg-primary/20' : r.status === 'active' ? 'bg-secondary/20' : r.status === 'paused' ? 'bg-warning/20' : 'bg-surface-container-highest'} flex items-center justify-center">
                  <span class="material-symbols-outlined ${r.status === 'completed' ? 'text-primary' : r.status === 'active' ? 'text-secondary' : r.status === 'paused' ? 'text-warning' : 'text-on-surface-variant'}">${typeInfo.icon || 'extension'}</span>
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-on-surface-variant/40 font-headline">R${r.round_number}</span>
                    <h4 class="font-headline font-bold text-white">${r.title}</h4>
                  </div>
                  <div class="text-[10px] text-on-surface-variant capitalize">${typeInfo.label || r.round_type} • ${r.duration_minutes} min • ${r.status} ${r.status === 'active' && r.started_at ? `(Since: ${new Date(r.started_at).toLocaleTimeString()})` : ''} ${r.status === 'paused' ? '<span class="text-warning font-bold underline animate-pulse ml-2">LOCKED - NO TEAM ACTION ALLOWED</span>' : ''}</div>
                </div>
              </div>
                <div class="flex items-center flex-wrap gap-2">
                  ${r.status === 'pending' ? `<button data-round-action="start" data-round-id="${r.id}" class="round-ctrl px-3 py-1.5 rounded-lg bg-secondary/10 text-secondary font-headline font-bold text-xs border border-secondary/20 hover:bg-secondary/30 transition-colors">▶ START</button>` : ''}
                  ${r.status === 'active' ? `
                    <button data-round-action="pause" data-round-id="${r.id}" class="round-ctrl px-3 py-1.5 rounded-lg bg-warning/10 text-warning font-headline font-bold text-xs border border-warning/20 hover:bg-warning/20 transition-colors">⏸ PAUSE (LOCK)</button>
                    <button data-round-action="complete" data-round-id="${r.id}" class="round-ctrl px-3 py-1.5 rounded-lg bg-error/10 text-error font-headline font-bold text-xs border border-error/20 hover:bg-error/30 transition-colors">⬛ END</button>
                  ` : ''}
                  ${r.status === 'paused' ? `
                    <button data-round-action="resume" data-round-id="${r.id}" class="round-ctrl px-3 py-1.5 rounded-lg bg-secondary/10 text-secondary font-headline font-bold text-xs border border-secondary/20 hover:bg-secondary/30 transition-colors">▶ RESUME (UNLOCK)</button>
                    <button data-round-action="complete" data-round-id="${r.id}" class="round-ctrl px-3 py-1.5 rounded-lg bg-error/10 text-error font-headline font-bold text-xs border border-error/20 hover:bg-error/30 transition-colors">⬛ END</button>
                    <button data-round-action="restart" data-round-id="${r.id}" class="round-ctrl px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-headline font-bold text-xs border border-primary/20 hover:bg-primary/30 transition-colors">🔄 RESTART</button>
                  ` : ''}
                  ${r.status === 'completed' ? `
                    <button data-round-action="restart" data-round-id="${r.id}" class="round-ctrl px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-headline font-bold text-xs border border-primary/20 hover:bg-primary/30 transition-colors">🔄 RESTART FRESH</button>
                  ` : ''}

                  <div class="w-px h-6 bg-white/10 mx-2 hidden sm:block"></div>
                  <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${r.status === 'active' ? 'bg-secondary/10 text-secondary' : r.status === 'paused' ? 'bg-warning/10 text-warning' : r.status === 'completed' ? 'bg-primary/10 text-primary' : 'bg-surface-container-highest text-on-surface-variant'}">${r.status}</span>
                  <button data-round-action="preview" data-round-id="${r.id}" class="round-preview w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center hover:bg-secondary/20 transition-colors shrink-0" title="Preview Participant View"><span class="material-symbols-outlined text-sm">visibility</span></button>
                  <button data-edit-round="${r.id}" class="edit-round w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors shrink-0"><span class="material-symbols-outlined text-sm">edit</span></button>
                  <button data-del-round="${r.id}" class="del-round w-8 h-8 rounded-lg bg-error/10 text-error flex items-center justify-center hover:bg-error/20 transition-colors shrink-0"><span class="material-symbols-outlined text-sm">delete</span></button>
                </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Edit Round Modal -->
      <div id="edit-round-modal" class="hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
        <div class="glass-panel p-8 rounded-3xl max-w-lg w-full border border-white/10 space-y-6">
          <div class="flex justify-between items-center">
            <h2 class="text-2xl font-headline font-bold text-white">Edit Round</h2>
            <button id="close-edit-round" class="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-white transition-colors">
              <span class="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
          <input type="hidden" id="edit-round-id" />
          <div class="space-y-4">
            <div class="grid grid-cols-4 gap-4">
              <div>
                <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Order</label>
                <input id="edit-round-number" type="number" min="1" class="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-3 text-white text-center font-headline font-bold" />
              </div>
              <div class="col-span-3">
                <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Title</label>
                <input id="edit-round-title" class="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white focus:ring-1 focus:ring-secondary/40 font-headline" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Type</label>
                <select id="edit-round-type" class="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white">
                  ${roundTypes.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Duration (min)</label>
                <input id="edit-round-duration" type="number" min="1" class="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white" />
              </div>
            </div>
          </div>
          <button id="save-edit-round" class="kinetic-gradient w-full py-4 rounded-xl font-headline font-bold text-on-primary-fixed flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-transform">
            <span class="material-symbols-outlined">save</span> Save Changes
          </button>
        </div>
      </div>
    `;

    // Add round
    document.getElementById('confirm-add-round')?.addEventListener('click', async () => {
      const title = document.getElementById('add-round-title').value.trim();
      if (!title) return alert('Round title is required');

      const { error } = await supabase.from('rounds').insert({
        event_id: event.id,
        round_number: parseInt(document.getElementById('add-round-number').value) || (rounds.length + 1),
        round_type: document.getElementById('add-round-type').value,
        title,
        duration_minutes: parseInt(document.getElementById('add-round-duration').value) || 40
      });

      if (error) return alert('Error: ' + error.message);
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
        document.getElementById('edit-round-modal').classList.remove('hidden');
      });
    });

    document.getElementById('close-edit-round')?.addEventListener('click', () => {
      document.getElementById('edit-round-modal').classList.add('hidden');
    });

    document.getElementById('save-edit-round')?.addEventListener('click', async () => {
      const roundId = document.getElementById('edit-round-id').value;
      const title = document.getElementById('edit-round-title').value.trim();
      if (!title) return alert('Round title is required');

      const { error } = await supabase.from('rounds').update({
        round_number: parseInt(document.getElementById('edit-round-number').value),
        title,
        round_type: document.getElementById('edit-round-type').value,
        duration_minutes: parseInt(document.getElementById('edit-round-duration').value) || 40
      }).eq('id', roundId);

      if (error) return alert('Error: ' + error.message);
      document.getElementById('edit-round-modal').classList.add('hidden');
      renderAdmin(container);
    });

    // Delete round
    el.querySelectorAll('.del-round').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this round?')) return;
        await supabase.from('rounds').delete().eq('id', btn.dataset.delRound);
        renderAdmin(container);
      });
    });

    // Round Controls (Start, Pause, Resume, Complete)
    el.querySelectorAll('.round-ctrl').forEach(btn => {
      btn.addEventListener('click', async () => {
        const roundId = btn.dataset.roundId;
        const action = btn.dataset.roundAction;
        const round = rounds.find(r => r.id === roundId);
        if (!round) return;

        if (action === 'preview') {
          // Preview mode: Redirect to the round engine with a preview flag
          navigate(`/round/${round.round_type}?mode=preview&roundId=${round.id}`);
          return;
        }

        const updates = {};
        let currentConfig = round.config || {};
        if (typeof currentConfig === 'string') {
          try { currentConfig = JSON.parse(currentConfig); } catch (e) { currentConfig = {}; }
        }

        if (action === 'start') {
          updates.status = 'active';
          updates.started_at = new Date().toISOString();
          await supabase.from('events').update({ current_round_id: roundId }).eq('id', event.id);
        } else if (action === 'pause') {
          updates.status = 'paused';
          updates.config = { ...currentConfig, paused_at: new Date().toISOString() };
        } else if (action === 'resume') {
          updates.status = 'active';
          if (currentConfig.paused_at) {
            const pausedAtTime = new Date(currentConfig.paused_at).getTime();
            const nowTime = Date.now();
            const pausedDurationMs = nowTime - pausedAtTime;
            
            // Shift started_at forward mathematically to sustain timer accuracy
            if (round.started_at) {
              const staticStartTime = new Date(round.started_at).getTime();
              updates.started_at = new Date(staticStartTime + pausedDurationMs).toISOString();
            }
            updates.config = { ...currentConfig };
            delete updates.config.paused_at;
          }
        } else if (action === 'complete') {
          updates.status = 'completed';
          updates.ended_at = new Date().toISOString();
        } else if (action === 'restart') {
          if (!confirm('Are you sure you want to RESTART this round? This will DELETE ALL SCORES, SUBMISSIONS, and LOGS for this round.')) return;
          
          btn.innerHTML = 'Resetting...';
          btn.disabled = true;

          // Perform full wipe for this round
          const [scoreRes, subRes, logRes] = await Promise.all([
            supabase.from('scores').delete().eq('round_id', roundId),
            supabase.from('submissions').delete().eq('round_id', roundId),
            supabase.from('anti_cheat_logs').delete().eq('round_id', roundId)
          ]);

          if (scoreRes.error || subRes.error || logRes.error) {
            alert('Error during restart: ' + (scoreRes.error?.message || subRes.error?.message || logRes.error?.message));
            btn.innerHTML = 'Retry Restart';
            btn.disabled = false;
            return;
          }

          updates.status = 'pending';
          updates.started_at = null;
          updates.ended_at = null;
          updates.config = {};
        }

        await supabase.from('rounds').update(updates).eq('id', roundId);
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
          <h1 class="text-3xl font-headline font-bold text-white">Teams</h1>
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
            <input id="eliminate-n" type="number" min="1" max="${teams.length}" value="1" class="w-14 bg-surface-container-lowest border-none rounded-lg py-1 px-2 text-white text-center text-sm font-headline" />
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
                      <div class="font-headline font-bold text-white text-sm">${t.team_name}</div>
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
          <h3 class="text-2xl font-headline font-bold text-white uppercase tracking-tighter">Security Authorization</h3>
          <p class="text-on-surface-variant text-sm">Sensitive Operation: Re-enter your Administrator password to reveal team secrets.</p>
          
          <div class="space-y-4">
            <input id="admin-verify-pw" type="password" class="w-full bg-surface-container-lowest border-none rounded-2xl py-4 px-5 text-white focus:ring-2 focus:ring-secondary/40 placeholder:text-slate-600 text-center text-lg" placeholder="••••••••" />
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

  // ========================================
  // SCORES TAB
  // ========================================
  function renderScoresTab(el, event, rounds, teams, allScores) {
    const eventScores = allScores.filter(s => teams.some(t => t.id === s.team_id));

    el.innerHTML = `
      <div class="flex items-end justify-between mb-8">
        <div>
          <h1 class="text-3xl font-headline font-bold text-white">Scores</h1>
          <p class="text-on-surface-variant text-sm mt-1">${event.name} • Manual & auto-evaluated scores</p>
        </div>
      </div>

      <!-- Inline Score Matrix (Score Entry Form Removed) -->

      <div class="glass-panel rounded-2xl overflow-x-auto border border-outline-variant/10">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-surface-container-high/50 text-on-surface-variant font-headline text-[10px] uppercase tracking-widest">
              <th class="px-5 py-4 sticky left-0 bg-surface-container-high/50">Team</th>
              ${rounds.map(r => `<th class="px-5 py-4 text-center">R${r.round_number}</th>`).join('')}
              <th class="px-5 py-4 text-center">Review</th>
              <th class="px-5 py-4 text-center">Total</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-variant/10">
            ${teams.map(t => {
              let total = 0;
              return `
                <tr class="hover:bg-white/5 transition-all">
                  <td class="px-5 py-3 sticky left-0 bg-surface-container">
                    <span class="font-headline font-bold text-white text-sm">${t.team_id}</span>
                  </td>
                  ${rounds.map(r => {
                    const s = eventScores.find(sc => sc.team_id === t.id && sc.round_id === r.id);
                    if (s) total += Number(s.score);
                    return `
                      <td class="px-2 py-3 text-center">
                        <input type="number" data-team-id="${t.id}" data-round-id="${r.id}" class="inline-score-input w-20 bg-surface-container-lowest border border-transparent rounded-lg py-2 px-2 text-center text-sm font-headline text-white hover:border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all ${!s ? 'opacity-40' : ''}" value="${s ? s.score : ''}" placeholder="—" />
                      </td>
                    `;
                  }).join('')}
                  <td class="px-5 py-3 text-center">
                    <button data-review-team="${t.id}" class="review-submission-btn p-2 rounded-lg bg-white/5 text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all">
                      <span class="material-symbols-outlined text-sm">visibility</span>
                    </button>
                  </td>
                  <td class="px-5 py-3 text-center font-headline font-bold text-primary">${total}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    el.querySelectorAll('.inline-score-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        const teamId = e.target.dataset.teamId;
        const roundId = e.target.dataset.roundId;
        const rawValue = e.target.value.trim();
        
        if (rawValue === '') return;
        
        const score = parseFloat(rawValue);
        if (isNaN(score)) return Notifier.toast('Enter a valid numerical score', 'error');

        input.classList.add('animate-pulse', 'text-primary');
        
        const { error } = await supabase.from('scores').upsert({
          team_id: teamId, round_id: roundId, score, max_score: 100, evaluated_at: new Date().toISOString()
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

    // Review Submission logic
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

        let bodyHtml = `
          <div class="space-y-6 text-left max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar submission-intelligence">
            ${submissions.map(s => `
              <div class="p-6 rounded-3xl bg-white/5 border border-white/5 space-y-4 hover:border-primary/30 transition-all">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <span class="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <span class="material-symbols-outlined text-sm">
                        ${s.round.round_type === 'quiz' ? 'quiz' : s.round.round_type === 'webdev' ? 'code' : 'image'}
                      </span>
                    </span>
                    <div>
                      <span class="text-[10px] font-bold uppercase tracking-widest text-primary">Round ${s.round.round_number}: ${s.round.title}</span>
                      <div class="text-[10px] text-on-surface-variant font-mono">${new Date(s.submission_time).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
                
                ${s.text_content ? `
                  <div class="space-y-2">
                    <label class="text-[10px] uppercase text-on-surface-variant font-bold flex items-center gap-2">
                       <span class="material-symbols-outlined text-xs">notes</span> Submitted Content
                    </label>
                    <div class="bg-black/30 rounded-2xl overflow-hidden border border-white/5">
                      ${s.round.round_type === 'webdev' ? `
                        <pre class="p-4 text-xs font-mono !bg-transparent"><code class="language-javascript">${s.text_content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>
                      ` : `
                        <div class="p-4 text-sm text-white whitespace-pre-wrap leading-relaxed">${s.text_content}</div>
                      `}
                    </div>
                  </div>
                ` : ''}

                ${s.answers ? `
                   <div class="space-y-2">
                    <label class="text-[10px] uppercase text-on-surface-variant font-bold flex items-center gap-2">
                      <span class="material-symbols-outlined text-xs">analytics</span> Performance Data
                    </label>
                    <div class="bg-black/30 p-4 rounded-2xl border border-white/5 overflow-hidden">
                      ${(() => {
                        const a = s.answers;
                        if (a.imageUrl) {
                          return `<div class="mb-4 rounded-xl overflow-hidden border border-white/10 max-h-48 flex items-center justify-center bg-black/40"><img src="${a.imageUrl}" class="max-w-full max-h-full object-contain" /></div>`;
                        }
                        return `<pre class="text-[10px] font-mono text-secondary !bg-transparent">${JSON.stringify(a, null, 2)}</pre>`;
                      })()}
                    </div>
                  </div>
                ` : ''}

                <div class="flex flex-wrap gap-2 pt-2">
                  ${s.github_link ? `<a href="${s.github_link}" target="_blank" class="px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 text-[10px] text-white hover:bg-primary/20 transition-all flex items-center gap-2"><span class="material-symbols-outlined text-sm">code</span> Repository</a>` : ''}
                  ${s.live_link ? `<a href="${s.live_link}" target="_blank" class="px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 text-[10px] text-white hover:bg-secondary/20 transition-all flex items-center gap-2"><span class="material-symbols-outlined text-sm">language</span> Preview Link</a>` : ''}
                  ${s.drive_link ? `<a href="${s.drive_link}" target="_blank" class="px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 text-[10px] text-white hover:bg-tertiary/20 transition-all flex items-center gap-2"><span class="material-symbols-outlined text-sm">folder</span> Assets</a>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `;

        Notifier.modal({
          title: `Submission Intel: ${team.team_name}`,
          icon: 'intelligence',
          type: 'info',
          body: bodyHtml
        });

        // Trigger Syntax Highlighting
        setTimeout(() => Prism.highlightAll(), 100);
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
        const { data } = await supabase.from('prompt_images').select('*').eq('round_id', selectedRound.id);
        assets = data || [];
      } else if (selectedRound.round_type === 'debate') {
        const { data } = await supabase.from('debate_topics').select('*').eq('round_id', selectedRound.id).maybeSingle();
        assets = data ? [data] : [];
      }
    }

    el.innerHTML = `
      <div class="flex items-end justify-between mb-8">
        <div>
          <h1 class="text-3xl font-headline font-bold text-white">Round Assets</h1>
          <p class="text-on-surface-variant text-sm mt-1">${assetRounds.length} asset-based round(s) configured</p>
        </div>
      </div>

      ${assetRounds.length === 0 ? '<div class="text-center py-12"><p class="text-on-surface-variant">No asset-based rounds added yet.</p></div>' : `
        <!-- Round Selector -->
        <div class="glass-panel p-6 rounded-2xl mb-8">
          <label class="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-3">Select Round to Manage Configuration</label>
          <select id="bank-round-select" class="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white font-headline">
            ${assetRounds.map(r => `<option value="${r.id}" ${r.id === selectedBankRoundId ? 'selected' : ''}>R${r.round_number}: ${r.title} (${r.round_type})</option>`).join('')}
          </select>
        </div>

        ${selectedRound?.round_type === 'quiz' ? `
          <!-- QUIZ ADD UI -->
          <div class="glass-panel p-6 rounded-2xl mb-8 space-y-6">
            <div class="flex items-center justify-between">
              <h3 class="font-headline font-bold text-white">Add Individual Question</h3>
              <button id="toggle-bulk-mode" class="text-xs font-headline font-bold text-primary hover:underline uppercase tracking-widest">Switch to Bulk Import</button>
            </div>
            
            <div id="individual-add-form" class="space-y-3">
              <textarea id="q-text" class="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white h-20 resize-none placeholder:text-slate-600" placeholder="Enter question text..."></textarea>
              <div class="grid grid-cols-2 gap-3">
                <input id="q-opt-0" class="bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white placeholder:text-slate-600 text-sm" placeholder="Option A" />
                <input id="q-opt-1" class="bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white placeholder:text-slate-600 text-sm" placeholder="Option B" />
                <input id="q-opt-2" class="bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white placeholder:text-slate-600 text-sm" placeholder="Option C" />
                <input id="q-opt-3" class="bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white placeholder:text-slate-600 text-sm" placeholder="Option D" />
              </div>
              <div class="flex gap-3">
                <select id="q-correct" class="bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white text-sm flex-1">
                  <option value="0">Correct: A</option>
                  <option value="1">Correct: B</option>
                  <option value="2">Correct: C</option>
                  <option value="3">Correct: D</option>
                </select>
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
    "correct": 3
  }
]</pre>
              </div>
              <textarea id="q-json-input" class="w-full bg-surface-container-lowest border-none rounded-xl py-4 px-4 text-white h-48 font-mono text-xs resize-none focus:ring-1 focus:ring-primary/40" placeholder="Paste your question array here..."></textarea>
              <button id="import-q-json" class="w-full py-4 rounded-xl kinetic-gradient text-on-primary-fixed font-headline font-bold text-sm tracking-widest uppercase hover:scale-[1.02] active:scale-[0.98] transition-all">Import All Questions</button>
            </div>
          </div>

          <!-- QUIZ LIST -->
          <div class="space-y-3 mb-8">
            ${assets.length === 0 ? '<p class="text-on-surface-variant text-center py-4">No questions added yet.</p>' : assets.map((q, i) => `
              <div class="bg-surface-container-low p-4 rounded-xl group hover:bg-surface-container transition-colors">
                <div class="flex justify-between items-start">
                  <div>
                    <span class="text-[10px] text-on-surface-variant font-headline font-bold">Q${i + 1}</span>
                    <p class="text-sm text-white mt-1">${q.question_text}</p>
                    <div class="flex gap-2 mt-2 flex-wrap">
                      ${(() => {
                        const opts = typeof q.options === 'string' && q.options.startsWith('[') ? JSON.parse(q.options) : (q.options || []);
                        return opts.map((opt, j) => `
                          <span class="text-[10px] px-2 py-0.5 rounded ${j === q.correct_answer ? 'bg-secondary/20 text-secondary font-bold' : 'bg-surface-container-highest text-on-surface-variant'}">${String.fromCharCode(65 + j)}: ${opt}</span>
                        `).join('');
                      })()}
                    </div>
                  </div>
                  <button data-del-q="${q.id}" class="del-q w-7 h-7 rounded-lg bg-error/10 text-error flex items-center justify-center hover:bg-error/20 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span class="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- MANAGEMENT & BACKUPS -->
          <div class="pt-6 border-t border-white/5 space-y-6">
            <div class="flex items-center justify-between">
              <h3 class="font-headline font-bold text-white uppercase text-sm tracking-widest">Shuffled Sets & Backups</h3>
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
            <div class="flex max-md:flex-col gap-3 items-center">
              <input type="file" id="p-file" accept="image/*" class="flex-1 bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-on-primary-fixed hover:file:bg-primary/80" />
              <input id="p-duration" type="number" value="30" class="w-32 bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white text-center" placeholder="Time (s)" />
              <button id="add-prompt" class="px-6 py-3 rounded-xl kinetic-gradient text-on-primary-fixed font-headline font-bold text-sm hover:scale-105 active:scale-95 transition-transform flex-shrink-0 disabled:opacity-50 flex items-center gap-2">Add Image</button>
            </div>
          </div>

          <!-- PROMPT LIST -->
          <div class="space-y-3 mb-8">
            ${assets.length === 0 ? '<p class="text-on-surface-variant text-center py-4">No prompt images added yet.</p>' : assets.map((l, i) => `
              <div class="bg-surface-container-low p-4 rounded-xl group flex items-center justify-between border border-transparent">
                <div class="flex items-center gap-4">
                  ${l.image_url ? `<img src="${l.image_url}" class="w-20 h-12 rounded object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all"/>` : `<div class="w-20 h-12 rounded bg-surface-container-highest flex items-center justify-center"><span class="material-symbols-outlined text-on-surface-variant/40">image_not_supported</span></div>`}
                  <div>
                    <span class="text-xs text-on-surface-variant tracking-widest uppercase">Target Image</span>
                    <h4 class="font-headline font-bold text-white uppercase tracking-widest text-sm">Visible for: ${l.display_duration_seconds}s</h4>
                  </div>
                </div>
                <button data-del-prompt="${l.id}" class="del-prompt w-8 h-8 rounded-lg bg-error/10 text-error flex items-center justify-center hover:bg-error/20 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span class="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            `).join('')}
          </div>
        ` : selectedRound?.round_type === 'debate' ? `
          <!-- DEBATE ASSETS UI -->
          <div class="glass-panel p-8 rounded-2xl mb-8 space-y-6 glow-accent">
            <h3 class="font-headline font-bold text-white text-xl flex items-center gap-3">
              <span class="material-symbols-outlined text-tertiary">forum</span>
              Configure Debate for: <span class="text-tertiary">${selectedRound.title}</span>
            </h3>
            
            <div class="space-y-4">
              <div class="space-y-2">
                <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Debate Topic</label>
                <textarea id="d-topic" class="w-full bg-surface-container-lowest border-none rounded-xl py-4 px-4 text-white font-headline text-lg resize-none placeholder:text-outline/30" placeholder="Enter the main debate topic/motion...">${assets[0]?.topic || ''}</textarea>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Context / Description</label>
                  <textarea id="d-desc" class="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white h-32 resize-none placeholder:text-outline/30 text-sm" placeholder="Provide background information or guidelines...">${assets[0]?.description || ''}</textarea>
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Reference Image (Optional)</label>
                  <div class="bg-surface-container-lowest rounded-xl p-4 flex flex-col items-center justify-center border-2 border-dashed border-outline-variant/20 hover:border-tertiary/40 transition-colors cursor-pointer relative group h-32">
                    <input type="file" id="d-file" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer z-10" />
                    ${assets[0]?.image_url ? `
                      <img src="${assets[0].image_url}" class="absolute inset-0 w-full h-full object-cover rounded-xl opacity-40 group-hover:opacity-60 transition-opacity" />
                      <div class="relative z-20 text-white font-bold text-xs uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full">Change Image</div>
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
                  <input id="d-duration" type="number" value="${assets[0]?.duration_seconds || 60}" class="w-32 bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white font-headline text-center" />
                </div>
                <div class="flex-1 flex items-end">
                  <button id="save-debate-config" class="w-full py-3.5 rounded-xl bg-gradient-to-r from-tertiary to-primary text-on-primary-fixed font-headline font-bold text-sm tracking-widest uppercase hover:scale-[1.02] active:scale-[0.98] transition-transform">Save Debate Configuration</button>
                </div>
              </div>
            </div>
          </div>
        ` : (selectedRound?.round_type === 'video' || selectedRound?.round_type === 'webdev') ? `
          <!-- COMMON CONFIG UI FOR VIDEO/WEBDEV -->
          <div class="glass-panel p-8 rounded-2xl mb-8 space-y-6 glow-accent">
            <h3 class="font-headline font-bold text-white text-xl flex items-center gap-3">
              <span class="material-symbols-outlined text-secondary">${selectedRound.round_type === 'video' ? 'videocam' : 'code'}</span>
              Manage ${selectedRound.round_type === 'video' ? 'Video Prompt' : 'Web Dev Guidelines'}: <span class="text-secondary">${selectedRound.title}</span>
            </h3>
            
            <div class="space-y-4">
              <div class="space-y-2">
                <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Instructions & Guidelines</label>
                <textarea id="config-guidelines" class="w-full bg-surface-container-lowest border-none rounded-xl py-4 px-4 text-white h-48 resize-none placeholder:text-outline/30 text-sm leading-relaxed" placeholder="Enter detailed round instructions for the participants...">${(() => {
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
          <div class="glass-panel p-6 rounded-2xl mb-8 space-y-4 glow-accent">
            <h3 class="font-headline font-bold text-white">Add Logo Target to: <span class="text-primary">${selectedRound?.title}</span></h3>
            <p class="text-xs text-on-surface-variant">Provide the correct brand name. If you want players to see the image on their device, select an Image file to upload. Leave the file blank to run Projector-Only Mode.</p>
            <div class="flex max-md:flex-col gap-3 items-center">
              <input id="l-brand" class="flex-1 bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white placeholder:text-slate-600 font-headline uppercase" placeholder="Correct Brand Name (e.g. Tesla)" />
              <input type="file" id="l-file" accept="image/*" class="flex-1 bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-on-primary-fixed hover:file:bg-primary/80" />
              <button id="add-logo" class="px-6 py-3 rounded-xl kinetic-gradient text-on-primary-fixed font-headline font-bold text-sm hover:scale-105 active:scale-95 transition-transform flex-shrink-0 disabled:opacity-50 flex items-center gap-2">Add Logo Target</button>
            </div>
          </div>

          <!-- LOGO LIST -->
          <div class="space-y-3 mb-8">
            ${assets.length === 0 ? '<p class="text-on-surface-variant text-center py-4">No logos added yet.</p>' : assets.map((l, i) => `
              <div class="bg-surface-container-low p-4 rounded-xl group hover:border-primary/30 transition-colors flex items-center justify-between border border-transparent">
                <div class="flex items-center gap-4">
                  <span class="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center font-headline font-bold text-on-surface-variant">${i + 1}</span>
                  ${l.image_url ? `<img src="${l.image_url}" class="w-12 h-12 rounded object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all"/>` : `<div class="w-12 h-12 rounded bg-surface-container-highest flex items-center justify-center"><span class="material-symbols-outlined text-on-surface-variant/40">image_not_supported</span></div>`}
                  <div>
                    <span class="text-xs text-on-surface-variant tracking-widest uppercase">Target Brand</span>
                    <h4 class="font-headline font-bold text-white uppercase tracking-widest text-lg">${l.correct_answer}</h4>
                  </div>
                </div>
                <button data-del-logo="${l.id}" class="del-logo w-8 h-8 rounded-lg bg-error/10 text-error flex items-center justify-center hover:bg-error/20 opacity-0 group-hover:opacity-100 transition-opacity">
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
      if (!text) return alert('Question text required');
      const options = [0, 1, 2, 3].map(i => document.getElementById(`q-opt-${i}`).value.trim());
      if (options.some(o => !o)) return alert('All 4 options required');

      await supabase.from('questions').insert({
        round_id: selectedRound.id,
        question_text: text,
        options,
        correct_answer: parseInt(document.getElementById('q-correct').value),
        order_index: assets.length + 1
      });
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
      if (!jsonStr) return alert('Please paste JSON data first');

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
          order_index: assets.length + idx + 1
        }));

        const { error } = await supabase.from('questions').insert(mappedQuestions);
        if (error) throw error;

        alert(`Successfully imported ${mappedQuestions.length} questions!`);
        renderTabContent('assets');
      } catch (err) {
        alert('Bulk Import Error: ' + err.message);
        const btn = document.getElementById('import-q-json');
        btn.innerText = 'Import All Questions';
        btn.disabled = false;
      }
    });

    el.querySelectorAll('.del-q').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this question?')) return;
        const { error } = await supabase.from('questions').delete().eq('id', btn.dataset.delQ);
        if (error) alert('Error: ' + error.message);
        renderTabContent('assets');
      });
    });

    document.getElementById('gen-sets')?.addEventListener('click', async () => {
      if (!assets.length) return alert('Add questions first');
      if (!confirm('This will generate 5 shuffled sets for this round. OK?')) return;
      
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
      if (error) alert('Set Error: ' + error.message);
      else alert('5 Sets (A-E) generated successfully!');
      renderTabContent('assets');
    });

    document.getElementById('assign-sets')?.addEventListener('click', async () => {
      const { data: qSets } = await supabase.from('question_sets').select('*').eq('round_id', selectedRound.id);
      if (!qSets?.length) return alert('Generate sets first');

      const { data: teams } = await supabase.from('teams').select('id').eq('event_id', selectedRound.event_id);
      if (!teams?.length) return alert('No teams registered');

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
      if (error) alert('Assign Error: ' + error.message);
      else alert(`Assigned ${assignments.length} teams to sets in round-robin order!`);
      renderTabContent('assets');
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
         alert("Failed to upload image. " + error.message);
         throw error;
      }
      
      const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(fileName);
      return publicUrl;
    }

    // Handle Logo Addition
    document.getElementById('add-logo')?.addEventListener('click', async (e) => {
      const brand = document.getElementById('l-brand').value.trim();
      if (!brand) return alert('Brand name is required');
      
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
        if (!confirm('Delete this logo target?')) return;
        const { error } = await supabase.from('logo_assets').delete().eq('id', btn.dataset.delLogo);
        if (error) alert('Error: ' + error.message);
        renderTabContent('assets');
      });
    });

    // Handle Prompt Addition
    document.getElementById('add-prompt')?.addEventListener('click', async (e) => {
      let duration = parseInt(document.getElementById('p-duration').value.trim()) || 30;

      const btn = e.currentTarget;
      const originalText = btn.innerHTML;
      try {
        btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-sm">refresh</span> Uploading...`;
        btn.disabled = true;

        let url = await uploadAsset('p-file');

        await supabase.from('prompt_images').insert({
          round_id: selectedRound.id,
          image_url: url || null,
          display_duration_seconds: duration
        });
        renderTabContent('assets');
      } catch (err) {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });

    el.querySelectorAll('.del-prompt').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this prompt image?')) return;
        const { error } = await supabase.from('prompt_images').delete().eq('id', btn.dataset.delPrompt);
        if (error) alert('Error: ' + error.message);
        renderTabContent('assets');
      });
    });

    // Handle Debate Config Save
    document.getElementById('save-debate-config')?.addEventListener('click', async (e) => {
      const topic = document.getElementById('d-topic').value.trim();
      const desc = document.getElementById('d-desc').value.trim();
      const duration = parseInt(document.getElementById('d-duration').value) || 60;
      if (!topic) return alert('Debate topic is required');

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
        alert('Debate configuration saved!');
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
        alert('Round guidelines updated!');
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
          <h1 class="text-3xl font-headline font-bold text-white">Registration Page</h1>
          <p class="text-on-surface-variant text-sm mt-1">${event.name} · Customize what participants see when registering</p>
        </div>
        ${event.registration_open ? `
          <a href="#/register/${event.slug || ''}" target="_blank" class="px-4 py-2 rounded-xl bg-secondary/10 text-secondary font-headline font-bold text-xs border border-secondary/20 hover:bg-secondary/20 flex items-center gap-2">
            <span class="material-symbols-outlined text-sm">open_in_new</span> Preview Page
          </a>
        ` : ''}
      </div>

      <!-- Banner Section -->
      <div class="glass-panel p-6 rounded-2xl mb-6 space-y-4">
        <h3 class="font-headline font-bold text-white flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">image</span> Banner & Branding
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Banner Image</label>
            <div class="flex gap-3">
              <input id="reg-banner-file" type="file" accept="image/*" class="hidden" />
              <button id="reg-banner-pick" class="flex-1 py-3 px-4 rounded-xl border border-dashed border-white/20 text-on-surface-variant hover:border-primary/40 hover:text-primary transition-all font-headline text-sm flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-sm">upload</span> Upload Banner
              </button>
            </div>
            ${cfg.banner_url ? `
              <div class="relative rounded-xl overflow-hidden h-24 bg-surface-container-lowest">
                <img id="reg-banner-preview" src="${cfg.banner_url}" class="w-full h-full object-cover" />
                <button id="reg-banner-remove" class="absolute top-2 right-2 w-6 h-6 bg-error/80 text-white rounded-full text-xs flex items-center justify-center hover:bg-error">×</button>
              </div>
            ` : `<div id="reg-banner-preview-area" class="h-24 rounded-xl bg-surface-container-lowest flex items-center justify-center text-on-surface-variant/30 text-xs italic">No banner uploaded</div>`}
          </div>
          <div class="space-y-3">
            <div class="space-y-1">
              <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Page Headline</label>
              <input id="reg-headline" class="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white focus:ring-1 focus:ring-primary/40 placeholder:text-slate-600 font-headline" placeholder="e.g. Join the Arena · HostiBuzz 2026" value="${cfg.headline || ''}" />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Subheading / Instructions</label>
              <textarea id="reg-subheading" class="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-white focus:ring-1 focus:ring-primary/40 placeholder:text-slate-600 h-16 resize-none text-sm" placeholder="e.g. Register your team below. Each team may have up to 4 members.">${cfg.subheading || ''}</textarea>
            </div>
          </div>
        </div>
      </div>

      <!-- Custom Fields Builder -->
      <div class="glass-panel p-6 rounded-2xl mb-6 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-headline font-bold text-white flex items-center gap-2">
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
              <p class="text-xs font-bold text-white mb-2">These fields are <span class="text-primary">already included</span> by default — do NOT add them again:</p>
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
          ${extraFields.length === 0 ? '<p class="text-center text-on-surface-variant/30 italic text-sm py-4">No custom fields yet. Click "+ Add Field" to start.</p>' : extraFields.map((f, i) => `
            <div class="bg-surface-container-lowest rounded-xl p-4 flex flex-col md:flex-row gap-3 items-start md:items-center" data-field-idx="${i}">
              <div class="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                <input class="field-label bg-surface-container border-none rounded-lg py-2 px-3 text-white text-sm placeholder:text-slate-600" placeholder="Field Label" value="${f.label || ''}" />
                <select class="field-type bg-surface-container border-none rounded-lg py-2 px-3 text-white text-sm">
                  <option value="text" ${f.type === 'text' ? 'selected' : ''}>Text</option>
                  <option value="email" ${f.type === 'email' ? 'selected' : ''}>Email</option>
                  <option value="tel" ${f.type === 'tel' ? 'selected' : ''}>Phone</option>
                  <option value="textarea" ${f.type === 'textarea' ? 'selected' : ''}>Long Text</option>
                  <option value="select" ${f.type === 'select' ? 'selected' : ''}>Dropdown Select</option>
                </select>
                <input class="field-options bg-surface-container border-none rounded-lg py-2 px-3 text-white text-sm placeholder:text-slate-600 ${f.type === 'select' ? '' : 'opacity-40 pointer-events-none'}" placeholder="Options (comma-separated)" value="${(f.options || []).join(', ')}" title="Only for dropdown fields" />
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <label class="flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer">
                  <input type="checkbox" class="field-required rounded" ${f.required ? 'checked' : ''} />
                  Required
                </label>
                <button class="del-reg-field w-8 h-8 rounded-lg bg-error/10 text-error flex items-center justify-center hover:bg-error/20 transition-colors">
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

  // ========================================
  // PREVIEW ENGINE LOGIC
  // ========================================
  const launchBtn = document.getElementById('launch-preview');
  const teamSelect = document.getElementById('preview-team-select');

  if (launchBtn && teamSelect) {
    launchBtn.addEventListener('click', async () => {
      const teamId = teamSelect.value;
      if (!teamId) return Notifier.toast('Select a team first', 'error');

      const team = teams.find(t => t.id === teamId);
      if (!team) return;

      renderPreviewModal(team);
    });
  }

  function renderPreviewModal(team) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-surface z-[100] flex flex-col slide-in-bottom';
    modal.innerHTML = `
      <div class="bg-black text-white px-6 py-2 flex items-center justify-between border-b border-primary/20">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span class="text-[10px] font-bold uppercase tracking-widest text-secondary">Admin Live Preview</span>
          </div>
          <div class="h-4 w-px bg-white/10"></div>
          <div class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Viewing as: <span class="text-white">${team.team_name}</span></div>
        </div>
        <button id="close-preview" class="px-4 py-1.5 rounded-lg bg-error/20 text-error hover:bg-error/30 text-[10px] font-bold uppercase tracking-widest transition-all">Close Preview</button>
      </div>
      <div id="preview-viewport" class="flex-1 overflow-auto bg-surface">
        <div class="p-12 text-center text-on-surface-variant flex flex-col items-center justify-center h-full">
          <span class="material-symbols-outlined animate-spin text-4xl mb-4">refresh</span>
          <p class="font-headline tracking-widest uppercase text-xs">Simulating Neural Connection...</p>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const viewport = modal.querySelector('#preview-viewport');
    
    // Mock user object for dashboard
    const mockUser = {
      id: team.id,
      team_id: team.team_id,
      team_name: team.team_name,
      role: 'participant',
      event_id: team.event_id,
      members: team.members || []
    };

    // Render dashboard with mock user
    setTimeout(() => {
      renderDashboard(viewport, mockUser);
    }, 500);

    document.getElementById('close-preview').addEventListener('click', () => {
      modal.remove();
    });
  }
}
