import { supabase } from '../config/supabase.js';
import { getState } from '../services/state.js';
import { renderNavbar, bindNavbarEvents } from '../components/navbar.js';
import { Timer } from '../services/timer.js';
import { navigate } from '../router.js';

let roundTimer = null;

export async function renderDashboard(container) {
  const user = getState('user');
  
  // Admin Redirection
  if (user.role === 'admin') {
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
    <main class="min-h-[calc(100vh-76px)] p-6 lg:p-12 max-w-7xl mx-auto relative">
      <div class="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none"></div>
      
      <!-- Header -->
      <div class="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-12">
        <div>
          <div class="flex items-center gap-2 text-primary text-xs font-headline tracking-[0.2em] uppercase mb-3">
            <span class="material-symbols-outlined text-sm">satellite_alt</span>
            <span>Event Command Center</span>
          </div>
          <div class="flex items-center gap-4">
            <h1 class="text-4xl md:text-5xl font-headline font-bold tracking-tighter text-white">${user.team_name}</h1>
            ${(freshTeam?.tab_switch_count > 0) ? `
              <div class="hidden md:flex bg-error/20 text-error px-4 py-1.5 rounded-full items-center gap-2 border border-error/30 animate-pulse mt-1">
                <span class="material-symbols-outlined text-sm">warning</span>
                <span class="text-[10px] font-bold tracking-widest uppercase font-headline">Anti-Cheat Flags: ${freshTeam.tab_switch_count}</span>
              </div>
            ` : ''}
          </div>
          <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-0 mt-2">
            <p class="text-on-surface-variant">ID: <span class="text-primary font-mono">${user.team_id}</span> • ${event?.name || 'No active event'}</p>
            ${(freshTeam?.tab_switch_count > 0) ? `
              <div class="md:hidden flex bg-error/20 text-error px-4 py-1.5 rounded-full items-center gap-2 border border-error/30 animate-pulse w-max">
                <span class="material-symbols-outlined text-sm">warning</span>
                <span class="text-[10px] font-bold tracking-widest uppercase font-headline">Anti-Cheat Flags: ${freshTeam.tab_switch_count}</span>
              </div>
            ` : ''}
          </div>
        </div>
        <div class="flex items-center gap-4">
          <div class="bg-surface-container-low p-4 rounded-2xl text-center">
            <span class="text-xs font-headline font-bold tracking-widest text-on-surface-variant uppercase block">Total Score</span>
            <span class="text-3xl font-headline font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">${totalScore}</span>
          </div>
        </div>
      </div>

      <!-- Current Round Card -->
      ${currentRound ? `
        <div class="glass-panel p-8 rounded-3xl mb-8 glow-accent relative overflow-hidden">
          <div class="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[80px] rounded-full pointer-events-none"></div>
          <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
            <div>
              <div class="flex items-center gap-2 text-secondary text-xs font-headline tracking-[0.2em] uppercase mb-2">
                <span class="w-2 h-2 bg-secondary rounded-full animate-pulse"></span>
                <span>Active Round ${currentRound.round_number}</span>
              </div>
              <h2 class="text-3xl font-headline font-bold text-white">${currentRound.title}</h2>
              <p class="text-on-surface-variant mt-1 capitalize">${currentRound.round_type} Round • ${currentRound.duration_minutes} minutes</p>
            </div>
            <div class="flex items-center gap-6">
              <div class="text-right">
                <span class="text-[10px] font-headline tracking-widest text-on-surface-variant uppercase">Time Remaining</span>
                <div id="round-timer" class="text-4xl font-headline font-bold tabular-nums tracking-tight ${currentRound.status === 'paused' ? 'text-warning' : 'text-secondary'}">${currentRound.status === 'paused' ? 'PAUSED' : Timer.formatTime(currentRound.duration_minutes * 60 * 1000)}</div>
              </div>
              <button id="enter-round" class="px-8 py-4 rounded-xl kinetic-gradient text-on-primary-fixed font-headline font-bold text-lg flex items-center gap-3 transition-transform shadow-[0_10px_30px_rgba(167,165,255,0.3)] disabled:opacity-50 disabled:grayscale disabled:scale-100 hover:scale-105 active:scale-95" ${currentRound.status === 'paused' ? 'disabled' : ''}>
                <span>${currentRound.status === 'paused' ? 'LOCKED' : 'ENTER ROUND'}</span>
                <span class="material-symbols-outlined">${currentRound.status === 'paused' ? 'lock' : 'arrow_forward'}</span>
              </button>
            </div>
          </div>
        </div>
      ` : `
        <div class="bg-surface-container-low p-12 rounded-3xl mb-8 text-center">
          ${!event ? `
            <span class="material-symbols-outlined text-5xl text-error/40 mb-4 block">error_outline</span>
            <h2 class="text-2xl font-headline font-bold text-white mb-2">No Event Found</h2>
            <p class="text-on-surface-variant">Your team is not linked to an active event. Contact the administrator.</p>
          ` : rounds.every(r => r.status === 'completed') && rounds.length > 0 ? `
            <span class="material-symbols-outlined text-5xl text-primary/40 mb-4 block">check_circle</span>
            <h2 class="text-2xl font-headline font-bold text-white mb-2">All Rounds Complete</h2>
            <p class="text-on-surface-variant">All ${rounds.length} rounds have been completed. Check the <a href="#/leaderboard" class="text-primary hover:underline">Leaderboard</a> for final standings.</p>
          ` : rounds.length === 0 ? `
            <span class="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-4 block">event_upcoming</span>
            <h2 class="text-2xl font-headline font-bold text-white mb-2">Event Not Started</h2>
            <p class="text-on-surface-variant">No rounds have been configured yet. The event organizer will set up rounds shortly.</p>
          ` : `
            <span class="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-4 block">hourglass_empty</span>
            <h2 class="text-2xl font-headline font-bold text-white mb-2">Waiting for Next Round</h2>
            <p class="text-on-surface-variant">The admin will start the next round shortly. Stay on this page — it will update automatically.</p>
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
            <div class="bg-surface-container-low rounded-2xl p-6 hover:bg-surface-container transition-colors">
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
      } catch (e) {}
      
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
  const enterBtn = document.getElementById('enter-round');
  if (enterBtn && currentRound) {
    enterBtn.addEventListener('click', () => {
      navigate(`/round/${currentRound.round_type}`);
    });
  }

  let channel = supabase.getChannels().find(c => c.topic === 'realtime:round-updates');
  if (!channel) {
    channel = supabase.channel('round-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds' }, () => {
        renderDashboard(container); // Re-render on round change
      })
      .subscribe();
  }

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
          <h2 class="text-2xl font-headline font-bold text-white uppercase tracking-tighter">Evaluation Breakdown</h2>
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
            } catch (e) { /* Not JSON, fallback to legacy */ }

            return rawNotes.split('\n\n').map(note => {
              let title = "", content = note;
              if (note.includes('\n')) {
                [title, ...content] = note.split('\n');
                content = content.join('\n');
              } else if (note.includes(': ')) {
                [title, ...content] = note.split(': ');
                content = content.join(': ');
              }

              if (title) {
                return `
                  <div class="space-y-2">
                    <div class="text-[10px] font-bold text-secondary uppercase tracking-widest">${title}</div>
                    <p class="text-sm text-on-surface-variant leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5 shadow-inner whitespace-pre-line">${content}</p>
                  </div>
                `;
              }
              return `<p class="text-sm text-on-surface-variant leading-relaxed p-4 bg-white/5 rounded-xl border border-white/5 whitespace-pre-line">${note}</p>`;
            }).join('');
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
