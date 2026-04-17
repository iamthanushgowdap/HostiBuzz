import { supabase } from '../config/supabase.js';
import { getState } from '../services/state.js';
import { renderNavbar, bindNavbarEvents } from '../components/navbar.js';
import { Timer } from '../services/timer.js';
import { navigate } from '../router.js';
import { Ticker } from '../components/ticker.js';
import { ActivityBroadcast } from '../services/activity-broadcast.js';
import { socketService } from '../services/socket.js';
import { Notifier } from '../services/notifier.js';

let roundTimer = null;

export async function renderDashboard(container, params = {}, search = {}, mockUser = null) {
  const user = mockUser || getState('user');
  Ticker.init(container);

  // Admin Redirection (Skip if mockUser is provided for preview)
  if (!mockUser && user.role === 'admin') {
    navigate('/admin');
    return;
  }

  // Re-fetch team from DB to get the latest event_id (in case localStorage is stale)
  const { data: freshTeam } = await supabase.from('teams').select('*').eq('id', user.id).single();
  const eventId = freshTeam?.event_id || user.event_id;

  // Fetch event & its rounds separately to avoid ambiguous FK error
  let event = null;
  if (eventId) {
    const { data, error } = await supabase.from('events').select('*').eq('id', eventId).single();
    if (error) console.error('Dashboard event fetch error:', error);

    const { data: roundsData } = await supabase.from('rounds').select('*').eq('event_id', eventId);

    event = data;
    if (event) event.rounds = roundsData || [];
  }
  const currentRound = event?.rounds?.find(r => r.status === 'active' || r.status === 'paused') || null;
  const rounds = (event?.rounds || []).sort((a, b) => a.round_number - b.round_number);

  // Fetch team scores
  const { data: scores } = await supabase.from('scores').select('*, rounds(title, round_number)').eq('team_id', user.id);
  const totalScore = scores?.reduce((sum, s) => sum + Number(s.score), 0) || 0;

  const roundTypeIcons = { quiz: 'quiz', logo: 'image_search', prompt: 'edit_note', webdev: 'code', video: 'videocam', debate: 'forum' };

  container.innerHTML = `
    ${renderNavbar({ activeLink: 'dashboard' })}
    ${mockUser ? `
      <div class="fixed top-[76px] left-0 right-0 bg-secondary/20 backdrop-blur-md border-b border-secondary/30 py-2 z-[60] flex items-center justify-center gap-3">
        <span class="material-symbols-outlined text-secondary animate-pulse text-sm">settings_input_composite</span>
        <span class="text-[10px] font-black text-secondary uppercase tracking-[0.3em]">Diagnostic Mode // Live Audit of ${user.team_name}</span>
      </div>
    ` : ''}
    <main class="min-h-[calc(100vh-76px)] p-5 lg:p-12 max-w-7xl mx-auto relative ${mockUser ? 'pt-20' : ''}">
      
      <!-- Back Button -->
      <a href="#/events" class="inline-flex items-center gap-2 text-on-surface-variant/60 hover:text-primary transition-all mb-8 group">
        <span class="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">arrow_back</span>
        <span class="text-[10px] font-headline font-bold uppercase tracking-[0.2em]">Back to Hub</span>
      </a>

      <div class="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none"></div>
      
      <!-- Header -->
      <div class="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-6 lg:mb-12">
        <div class="w-full lg:w-auto">
          <div class="flex items-center justify-between lg:justify-start gap-4 text-primary text-[10px] lg:text-xs font-headline tracking-[0.2em] uppercase mb-4">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-sm">satellite_alt</span>
              <span>Command Center</span>
            </div>
            <div id="socket-pulse-wrap" class="flex items-center gap-2 pl-4 border-l border-white/10">
               <div id="socket-pulse-dot" class="w-1.5 h-1.5 rounded-full bg-white/20"></div>
               <span id="socket-pulse-text" class="text-[8px] font-bold text-on-surface-variant/60 uppercase">Syncing...</span>
            </div>
          </div>
          <div class="flex flex-col md:flex-row md:items-center gap-4">
            <h1 class="text-2xl md:text-4xl font-headline font-bold tracking-tighter text-white">${user.team_name}</h1>
            ${(freshTeam?.tab_switch_count > 0) ? `
              <div class="flex bg-error/20 text-error px-4 py-1.5 rounded-full items-center gap-2 border border-error/30 animate-pulse w-max">
                <span class="material-symbols-outlined text-sm">warning</span>
                <span class="text-[10px] font-bold tracking-widest uppercase font-headline">Flags: ${freshTeam.tab_switch_count}</span>
              </div>
            ` : ''}
          </div>
          <div class="flex items-center mt-3">
            <p class="text-xs lg:text-sm text-on-surface-variant">ID: <span class="text-primary font-mono">${user.team_id}</span> • ${event?.name || 'No active event'}</p>
          </div>
        </div>
        <div class="w-full lg:w-auto flex justify-end">
          <div class="bg-surface-container-low p-4 rounded-2xl text-center w-full lg:w-32 border border-white/5 shadow-xl glass-panel">
            <span class="text-[10px] font-headline font-bold tracking-widest text-on-surface-variant uppercase block mb-1">Total Score</span>
            <span class="text-3xl font-headline font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">${totalScore}</span>
          </div>
        </div>
      </div>

      <!-- Current Round Card -->
      ${currentRound ? `
        <div class="glass-panel p-5 rounded-2xl mb-6 lg:mb-8 glow-accent relative overflow-hidden group">
          <div class="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[80px] rounded-full pointer-events-none group-hover:bg-primary/10 transition-colors"></div>
          <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 lg:gap-8 relative z-10">
            <div class="w-full">
              <div class="flex items-center gap-2 text-secondary text-[10px] lg:text-xs font-headline tracking-[0.2em] uppercase mb-2">
                <span class="w-1.5 h-1.5 bg-secondary rounded-full animate-pulse"></span>
                <span>Active Round ${currentRound.round_number}</span>
              </div>
              <h2 class="text-2xl lg:text-3xl font-headline font-bold text-white tracking-tight">${currentRound.title}</h2>
              <p class="text-xs lg:text-sm text-on-surface-variant mt-1 capitalize">${currentRound.round_type} Round • ${currentRound.duration_minutes} minutes</p>
            </div>
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 lg:gap-8 w-full lg:w-auto">
              <div class="text-left lg:text-right bg-white/5 lg:bg-transparent p-4 lg:p-0 rounded-2xl border border-white/5 lg:border-none">
                <span class="text-[9px] font-headline tracking-[0.2em] text-on-surface-variant uppercase block mb-1">Time Remaining</span>
                <div id="round-timer" class="text-3xl lg:text-4xl font-headline font-black tabular-nums tracking-tighter ${currentRound.status === 'paused' ? 'text-warning' : 'text-secondary'}">${currentRound.status === 'paused' ? 'PAUSED' : Timer.formatTime(currentRound.duration_minutes * 60 * 1000)}</div>
              </div>
              <button id="enter-round" class="w-full lg:w-auto px-8 py-4 rounded-2xl kinetic-gradient text-on-primary-fixed font-headline font-black text-sm lg:text-lg flex items-center justify-center gap-3 transition-all hover:scale-[1.03] active:scale-[0.97] shadow-xl disabled:opacity-30 disabled:grayscale disabled:scale-100" ${currentRound.status === 'paused' ? 'disabled' : ''}>
                <span>${currentRound.status === 'paused' ? 'LOCKED' : 'ENTER ROUND'}</span>
                <span class="material-symbols-outlined text-lg lg:text-2xl">${currentRound.status === 'paused' ? 'lock' : 'arrow_forward'}</span>
              </button>
            </div>
          </div>
        </div>
      ` : `
        <div class="bg-surface-container-low/50 backdrop-blur-sm p-8 lg:p-12 rounded-3xl mb-8 text-center border border-white/5">
          ${!event ? `
            <span class="material-symbols-outlined text-4xl lg:text-5xl text-error/40 mb-4 block">error_outline</span>
            <h2 class="text-xl lg:text-2xl font-headline font-bold text-white mb-2 tracking-tight">System Link Missing</h2>
            <p class="text-xs lg:text-sm text-on-surface-variant leading-relaxed">No active event synchronization detected. Contact protocol administrator.</p>
          ` : rounds.every(r => r.status === 'completed') && rounds.length > 0 ? `
            <span class="material-symbols-outlined text-4xl lg:text-5xl text-primary/40 mb-4 block">check_circle</span>
            <h2 class="text-xl lg:text-2xl font-headline font-bold text-white mb-2 tracking-tight">Mission Accomplished</h2>
            <p class="text-xs lg:text-sm text-on-surface-variant leading-relaxed">All ${rounds.length} operational phases complete. Monitor the <a href="#/leaderboard" class="text-primary hover:underline font-bold">Project Leaderboard</a> for final metrics.</p>
          ` : rounds.length === 0 ? `
            <span class="material-symbols-outlined text-4xl lg:text-5xl text-on-surface-variant/40 mb-4 block">event_upcoming</span>
            <h2 class="text-xl lg:text-2xl font-headline font-bold text-white mb-2 tracking-tight">Initialization Pending</h2>
            <p class="text-xs lg:text-sm text-on-surface-variant leading-relaxed">Event structure loading. Awaiting round deployment from command center.</p>
          ` : `
            <span class="material-symbols-outlined text-4xl lg:text-5xl text-on-surface-variant/40 mb-4 block">hourglass_empty</span>
            <h2 class="text-xl lg:text-2xl font-headline font-bold text-white mb-2 tracking-tight">Awaiting Sync...</h2>
            <p class="text-xs lg:text-sm text-on-surface-variant leading-relaxed">Protocol activation pending. The mission will resume automatically upon sync.</p>
          `}
        </div>
      `}

      <!-- Rounds Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        ${rounds.map(r => {
    const scoreData = scores?.find(s => s.round_id === r.id);
    const statusColor = r.status === 'completed' ? 'text-secondary' : r.status === 'active' ? 'text-primary' : 'text-on-surface-variant/40';
    const statusIcon = r.status === 'completed' ? 'check_circle' : r.status === 'active' ? 'radio_button_checked' : 'radio_button_unchecked';
    return `
            <div class="bg-surface-container-low rounded-2xl p-5 hover:bg-surface-container transition-colors">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-2xl ${statusColor}">${roundTypeIcons[r.round_type] || 'extension'}</span>
                  <div>
                    <h3 class="font-headline font-bold text-white text-sm">${r.title}</h3>
                    <span class="text-[10px] text-on-surface-variant uppercase tracking-widest">Round ${r.round_number}</span>
                  </div>
                </div>
                <span class="material-symbols-outlined ${statusColor}">${statusIcon}</span>
              </div>
              ${scoreData ? `
                <div class="space-y-3">
                  <div class="flex justify-between items-center bg-surface-container-lowest p-3 rounded-xl">
                    <span class="text-xs text-on-surface-variant font-headline">Score</span>
                    <span class="font-headline font-bold text-white text-lg">${scoreData.score}<span class="text-on-surface-variant font-normal text-[10px] ml-1">/ ${scoreData.max_score}</span></span>
                  </div>
                  ${scoreData.evaluator_notes ? `
                    <button data-feedback-id="${scoreData.id}" class="view-feedback-btn w-full py-2.5 rounded-xl bg-primary/10 text-primary font-headline font-bold text-[10px] uppercase tracking-widest border border-primary/20 hover:bg-primary/20 transition-all flex items-center justify-center gap-2">
                      <span class="material-symbols-outlined text-sm">analytics</span> View Evaluation
                    </button>
                  ` : ''}
                </div>
              ` : `
                <div class="bg-surface-container-lowest p-3 rounded-xl text-center text-xs text-on-surface-variant">
                  ${r.status === 'active' ? 'In progress...' : r.status === 'completed' ? 'Awaiting evaluation' : 'Not started'}
                </div>
              `}
            </div>
          `;
  }).join('')}
      </div>

      <!-- Team Members -->
      <div class="bg-surface-container-low rounded-2xl p-6">
        <h3 class="font-headline font-bold text-white mb-4">Team Composition</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          ${(user.members || []).map(m => `
            <div class="bg-surface-container p-4 rounded-xl flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span class="material-symbols-outlined text-primary">person</span>
              </div>
              <div>
                <div class="text-sm font-medium text-white">${m.name}</div>
                <div class="text-[10px] text-on-surface-variant uppercase tracking-widest">${m.role}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </main>
  `;

  bindNavbarEvents();

  // Start timer if round is active
  if (roundTimer) {
    roundTimer.stop();
    roundTimer = null;
  }

  if (currentRound?.started_at && currentRound.status !== 'completed') {
    const isPaused = currentRound.status === 'paused';
    let remaining = 0;

    if (isPaused) {
      const startedAt = new Date(currentRound.started_at).getTime() + 10000;
      let pausedAt = Date.now();
      try {
        const cfg = typeof currentRound.config === 'string' ? JSON.parse(currentRound.config) : (currentRound.config || {});
        if (cfg.paused_at) pausedAt = new Date(cfg.paused_at).getTime();
      } catch (e) { }

      const totalMs = currentRound.duration_minutes * 60 * 1000;
      const elapsedSoFar = pausedAt - startedAt;
      remaining = Math.max(0, totalMs - elapsedSoFar);

      const timerEl = document.getElementById('round-timer');
      if (timerEl) timerEl.textContent = Timer.formatTime(remaining);
    } else {
      roundTimer = new Timer({
        onTick: (rem) => {
          const timerEl = document.getElementById('round-timer');
          if (timerEl) timerEl.textContent = Timer.formatTime(rem);
        },
        onComplete: () => {
          const timerEl = document.getElementById('round-timer');
          if (timerEl) timerEl.textContent = '00:00';
        }
      });
      roundTimer.startFromServer(currentRound.started_at, currentRound.duration_minutes);
    }
  }

  // Enter round button
  const enterBtn = container.querySelector('#enter-round');
  if (enterBtn && currentRound) {
    enterBtn.addEventListener('click', () => {
      navigate(`/round/${currentRound.round_type}`);
    });
  }

  // Handle Feedback Modal
  container.querySelectorAll('.view-feedback-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fid = btn.dataset.feedbackId;
      const score = scores.find(s => s.id === fid);
      if (!score) return;

      let notes = {};
      try {
        notes = typeof score.evaluator_notes === 'string' ? JSON.parse(score.evaluator_notes) : (score.evaluator_notes || {});
      } catch (e) {
        notes = { feedback: score.evaluator_notes };
      }

      Notifier.modal({
        title: 'Performance Intelligence',
        icon: 'analytics',
        type: 'info',
        body: `
          <div class="space-y-6">
            <div class="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <span class="material-symbols-outlined text-sm">leaderboard</span>
                </div>
                <div>
                  <div class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Validated Score</div>
                  <div class="text-xl font-headline font-bold text-white">${score.score} <span class="text-xs font-normal text-on-surface-variant">/ ${score.max_score}</span></div>
                </div>
              </div>
              ${notes.ai ? `
                <div class="px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20 flex items-center gap-2">
                  <span class="material-symbols-outlined text-[10px] text-secondary">psychology</span>
                  <span class="text-[8px] font-bold uppercase tracking-widest text-secondary">Aura Intel</span>
                </div>
              ` : ''}
            </div>

            <div class="space-y-2">
              <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Technical Review</label>
              <div class="p-5 rounded-3xl bg-surface-container-highest border border-white/5 text-sm text-white italic leading-relaxed">
                "${notes.feedback || 'No detailed feedback provided yet.'}"
              </div>
            </div>

            <p class="text-[10px] text-on-surface-variant italic text-center">Evaluated at ${new Date(score.evaluated_at).toLocaleString()}</p>
          </div>
        `
      });
    });
  });

  const refresh = () => {
    setTimeout(() => {
      renderDashboard(container, params, search, mockUser);
    }, 500);
  };

  // HYBRID REAL-TIME ENGINE
  // 1. Supabase (Reliability Fallback)
  let channel = supabase.getChannels().find(c => c.topic === 'realtime:round-updates');
  if (!channel) {
    channel = supabase.channel('round-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds' }, refresh)
      .subscribe();
  }

  // 2. Socket.IO (Instant Trigger)
  const unsubs = [
    socketService.on('round_started', (data) => {
      const title = data.roundTitle || 'New Round';
      Notifier.toast(`🔥 ROUND STARTED: ${title}`, 'success', { duration: 5000 });
      Notifier.modal({
        title: 'Round Started!',
        body: `<p class="text-xl font-headline text-white mb-2">${title}</p><p class="text-sm text-on-surface-variant">Synchronizing round assets and starting the synchronized clock. Good luck, Team!</p>`,
        icon: 'rocket_launch',
        type: 'success'
      });
      refresh();
    }),
    socketService.on('leaderboard_updated', () => {
      Notifier.toast('🏆 Leaderboard Synchronized', 'info');
      refresh();
    }),
    socketService.on('round_status_updated', (data) => {
      const title = data.roundTitle || 'Round';
      const status = data.status === 'active' ? 'RESUMED' : data.status.toUpperCase();
      const type = data.status === 'completed' ? 'info' : 'warning';
      const verb = data.status === 'active' ? 'Resumed' : data.status === 'paused' ? 'Paused' : 'Completed';

      Notifier.toast(`📢 ${title} ${status}`, type, { duration: 5000 });

      if (data.status === 'paused' || data.status === 'completed') {
        Notifier.modal({
          title: `Round ${verb}`,
          body: `<p class="text-xl font-headline text-white mb-2">${title}</p><p class="text-sm text-on-surface-variant">The administration has ${verb.toLowerCase()} this round. Please standby for further instructions.</p>`,
          icon: data.status === 'paused' ? 'pause_circle' : 'task_alt',
          type: type
        });
      }
      refresh();
    }),
    socketService.on('team_eliminated', (data) => {
      if (data.teamIds.includes(user.id)) {
        navigate('/eliminated');
      } else {
        refresh();
      }
    })
  ];

  // 3. Pulse Status Monitor
  const updatePulseUI = (status) => {
    const dot = document.getElementById('socket-pulse-dot');
    const text = document.getElementById('socket-pulse-text');
    if (!dot || !text) return;

    const statusMap = {
      offline: { color: 'bg-red-500', label: 'Pulse Offline', glow: 'shadow-[0_0_8px_rgba(239,68,68,0.5)]' },
      connecting: { color: 'bg-blue-400', label: 'Pulse Localizing...', glow: 'shadow-[0_0_8px_rgba(96,165,250,0.5)]' },
      connected: { color: 'bg-yellow-400', label: 'Pulse Synced', glow: 'shadow-[0_0_8px_rgba(250,204,21,0.5)]' },
      joined: { color: 'bg-green-400', label: 'Pulse Live', glow: 'shadow-[0_0_12px_rgba(74,222,128,0.6)]' }
    };

    const config = statusMap[status] || statusMap.offline;
    dot.className = `w-1.5 h-1.5 rounded-full ${config.color} ${config.glow} transition-all duration-300`;
    text.innerText = config.label;
    text.className = `text-[8px] font-bold uppercase tracking-widest transition-colors duration-300 ${status === 'joined' ? 'text-green-400' : 'text-on-surface-variant/60'}`;
  };

  unsubs.push(socketService.onStatusChange(updatePulseUI));

  // Store cleanup on the container for subsequent renders
  if (container._cleanupRealtime) container._cleanupRealtime();
  container._cleanupRealtime = () => {
    unsubs.forEach(unsub => unsub());
  };

  // Feedback Modal (Event Delegation)
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.view-feedback-btn');
    if (!btn) return;

    const scoreId = btn.dataset.feedbackId;
    const score = scores?.find(s => s.id === scoreId);
    if (!score) return;

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6';
    modal.innerHTML = `
      <div class="glass-panel p-8 rounded-[40px] max-w-xl w-full border-primary/30 scale-in relative overflow-hidden">
        <div class="absolute -top-20 -right-20 w-40 h-40 bg-primary/10 blur-[60px] rounded-full"></div>
        
        <div class="flex justify-between items-center mb-6">
          <div>
            <h2 class="text-2xl font-headline font-bold text-white uppercase tracking-tighter">Performance Analysis</h2>
            <div class="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] mt-1">${score.rounds?.title} Evaluation</div>
          </div>
          <button id="close-feedback" class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-on-surface-variant hover:text-white hover:bg-white/10 transition-all">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="flex items-center gap-6 mb-8 p-4 bg-primary/5 rounded-2xl border border-primary/10">
          <div class="w-16 h-16 rounded-2xl bg-primary/20 flex flex-col items-center justify-center">
            <span class="text-2xl font-headline font-black text-primary">${score.score}</span>
            <span class="text-[8px] font-bold text-primary/60 uppercase">Points</span>
          </div>
          <div>
            <div class="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-1">Total Score</div>
            <h3 class="text-xl font-headline font-bold text-white">${score.rounds?.title}</h3>
            <p class="text-xs text-on-surface-variant mt-1">Evaluated on ${new Date(score.evaluated_at).toLocaleDateString()}</p>
          </div>
        </div>

        <div class="space-y-6 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar feedback-content text-left">
          ${(() => {
        const rawNotes = score.evaluator_notes || "No detailed feedback provided yet.";
        try {
          const data = JSON.parse(rawNotes);
          if (data.items && Array.isArray(data.items)) {
            if (data.summary && data.items.length === 0) return `<p class="text-sm text-on-surface-variant p-4 bg-primary/5 rounded-xl border border-primary/10 text-center">${data.summary}</p>`;

            return data.items.map(item => `
                  <div class="glass-panel p-5 rounded-3xl border-white/5 bg-white/5 space-y-4">
                    ${data.type === 'logo' && item.label ? `
                      <div class="w-full h-32 bg-white rounded-xl overflow-hidden p-2">
                        <img src="${item.label}" class="w-full h-full object-contain" />
                      </div>
                    ` : ''}
                    
                    <div>
                      <div class="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">${item.title || (data.type === 'quiz' ? 'Question Detail' : 'Correction')}</div>
                      ${data.type === 'quiz' ? `<p class="text-sm text-white font-headline font-bold mb-4 leading-relaxed">${item.question}</p>` : ''}
                      
                      <div class="grid grid-cols-2 gap-3">
                        <div class="bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                          <div class="text-[8px] uppercase font-bold text-red-400 mb-1">Your Answer</div>
                          <div class="text-xs text-white font-medium">${item.given || item.chosen || 'No Answer'}</div>
                        </div>
                        <div class="bg-primary/10 border border-primary/20 p-3 rounded-xl">
                          <div class="text-[8px] uppercase font-bold text-primary mb-1">Correct Answer</div>
                          <div class="text-xs text-white font-medium">${item.correct || 'Unknown'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                `).join('');
          }
        } catch (e) { /* Not JSON, use fallback below */ }

        return `
              <div class="space-y-4">
                <div class="p-6 rounded-3xl bg-surface-container-highest border border-white/5 text-on-surface-variant italic leading-relaxed relative overflow-hidden group">
                  <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <span class="material-symbols-outlined text-4xl">format_quote</span>
                  </div>
                  <div class="text-[10px] font-bold text-secondary uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span class="material-symbols-outlined text-sm">psychology</span>
                    Judge's Strategic Review
                  </div>
                  <div class="relative z-10 text-white selection:bg-primary/30">
                    ${rawNotes.replace(/\n/g, '<br>')}
                  </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                   <div class="p-4 rounded-2xl bg-white/5 border border-white/5">
                      <div class="text-[8px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Scoring Metric</div>
                      <div class="text-xs text-white font-headline">Audit-Based Manual Evaluation</div>
                   </div>
                   <div class="p-4 rounded-2xl bg-white/5 border border-white/5 text-right">
                      <div class="text-[8px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Status</div>
                      <div class="text-xs text-secondary font-headline flex items-center justify-end gap-1">
                        <span class="material-symbols-outlined text-sm">verified</span> Verified
                      </div>
                   </div>
                </div>
              </div>
            `;
      })()}
        </div>

        <div class="mt-8 pt-6 border-t border-outline-variant/10 text-center">
          <p class="text-[10px] text-on-surface-variant/40 uppercase tracking-widest leading-loose">
            This evaluation is based on technical performance and logical structure.<br/>
            Refers to specific round goals and judging guidelines.
          </p>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('close-feedback').addEventListener('click', () => modal.remove());
  });
}
