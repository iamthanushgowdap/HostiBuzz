import { supabase } from '../config/supabase.js';
import { getState } from '../services/state.js';
import { renderNavbar, bindNavbarEvents } from '../components/navbar.js';
import { Timer, renderPreRoundCountdown } from '../services/timer.js';
import { navigate } from '../router.js';
import { startAntiCheat, stopAntiCheat } from '../services/anti-cheat.js';
import { timeSync } from '../services/timeSync.js';
import { pauseFooterClock, resumeFooterClock } from '../components/footer.js';

export async function renderDebateRound(container, params, search = {}) {
  // Eco-Mode: Pause background processing
  pauseFooterClock();
  const isPreview = search.mode === 'preview';
  const previewRoundId = search.roundId;
  const user = getState('user');
  
  if (!user && !isPreview) {
    navigate('/login');
    return;
  }

  // Get round
  let round;
  if (isPreview && previewRoundId) {
    const { data } = await supabase.from('rounds').select('*').eq('id', previewRoundId).single();
    round = data;
  } else {
    const { data } = await supabase.from('rounds')
      .select('*')
      .eq('event_id', user.event_id)
      .eq('round_type', 'debate')
      .in('status', ['active', 'paused'])
      .single();
    round = data;
  }
  
  if (!round) { 
    container.innerHTML = `${renderNavbar()}<div class="min-h-screen flex items-center justify-center p-6 text-center"><div><span class="material-symbols-outlined text-6xl text-on-surface-variant/20 mb-4">forum</span><p class="text-on-surface-variant text-lg">${isPreview ? 'Preview Round Not Found' : 'No active debate round.'}</p></div></div>`; 
    bindNavbarEvents(); 
    return; 
  }

  // Instant Launch Protocol: Overlay disabled as per user request
  // if (!isPreview && renderPreRoundCountdown(round, container, renderDebateRound)) return;

  const isPaused = round.status === 'paused';
  
  const { data: topic } = await supabase.from('debate_topics').select('*').eq('round_id', round.id).maybeSingle();
  const { data: existing } = await supabase.from('submissions').select('*').eq('team_id', user.id).eq('round_id', round.id).maybeSingle();

  const isLocked = existing?.is_final;
  if (!isLocked && !isPaused && !isPreview) startAntiCheat(round.id);

  // Debate uses topic.duration_seconds — the specific time limit the admin set for THIS topic
  const DEBATE_DURATION_SEC = topic?.duration_seconds || 60;
  const DEBATE_DURATION_MS = DEBATE_DURATION_SEC * 1000;

  // Compute remaining time for paused state
  let pausedRemaining = DEBATE_DURATION_MS;
  if (!isPreview && isPaused && round.started_at) {
    const startedAt = new Date(round.started_at).getTime();
    let pausedAt = timeSync.getSyncedTime();
    try {
      const cfg = typeof round.config === 'string' ? JSON.parse(round.config) : (round.config || {});
      if (cfg.paused_at) pausedAt = new Date(cfg.paused_at).getTime();
    } catch (e) {}
    pausedRemaining = Math.max(0, DEBATE_DURATION_MS - (pausedAt - startedAt));
  }

  const initialDisplay = isPaused ? Timer.formatTime(pausedRemaining) : Timer.formatTime(DEBATE_DURATION_MS);

  // Urgency color: red when under 20% time
  const urgencyThresholdMs = DEBATE_DURATION_MS * 0.2;

  container.innerHTML = `
    ${isPreview ? '<div class="fixed top-0 left-0 w-full bg-tertiary/80 backdrop-blur-md text-on-tertiary-fixed text-[10px] font-bold py-1 text-center uppercase tracking-widest z-[200]">PREVIEW MODE - DATA WILL NOT BE SAVED</div>' : ''}
    ${renderNavbar({ hideNavigation: !isLocked })}
    <main class="min-h-[calc(100vh-76px)] pt-6 pb-24 px-4 md:px-8 max-w-5xl mx-auto relative">
      ${isPaused ? `
        <div class="fixed inset-0 z-[100] bg-[#0a0e19]/60 backdrop-blur-xl flex items-center justify-center p-6 slide-in-bottom">
          <div class="glass-panel p-12 rounded-[40px] max-w-xl w-full text-center border-warning/20 bg-warning/5 shadow-[0_20px_50px_rgba(245,158,11,0.1)]">
            <div class="w-20 h-20 bg-warning/10 rounded-3xl flex items-center justify-center mx-auto mb-8 animate-pulse">
              <span class="material-symbols-outlined text-4xl text-warning">lock_open</span>
            </div>
            <h2 class="text-4xl font-headline font-bold text-white mb-4 tracking-tighter uppercase">Round Paused</h2>
            <p class="text-on-surface-variant text-lg leading-relaxed mb-8">The administrator has temporarily paused the round. All inputs are locked. Please wait for the round to resume — your progress is safe.</p>
            <div class="flex items-center justify-center gap-3 text-warning font-headline font-bold text-xs uppercase tracking-[0.3em]">
              <span class="w-2 h-2 bg-warning rounded-full animate-ping"></span>
              Awaiting Admin Signal
            </div>
          </div>
        </div>
      ` : ''}
      <div class="fixed top-1/4 -left-20 w-96 h-96 bg-tertiary/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>
      
      <!-- Topic Card -->
      <div class="glass-panel overflow-hidden rounded-[2.5rem] border-tertiary/20 mb-8 flex flex-col lg:flex-row min-h-[200px] border border-white/5 shadow-2xl relative group">
        <div class="absolute -right-12 -top-12 w-32 h-32 bg-tertiary/5 blur-3xl rounded-full"></div>
        ${topic?.image_url ? `
          <div class="lg:w-1/4 h-56 lg:h-auto overflow-hidden flex-shrink-0 relative">
             <div class="absolute inset-0 bg-gradient-to-t from-[#0a0e19] to-transparent lg:hidden z-10"></div>
            <img src="${topic.image_url}" class="w-full h-full object-cover lg:scale-110 group-hover:scale-100 transition-transform duration-1000" alt="Debate Topic" />
          </div>
        ` : ''}
        <div class="flex-1 p-6 lg:p-10 flex flex-col justify-center relative z-20">
          <span class="text-[9px] lg:text-[10px] font-headline tracking-[0.4em] text-tertiary uppercase block mb-3 flex items-center gap-3 font-black">
            <span class="material-symbols-outlined text-sm font-black">gavel</span>
            Neural Response Node · Protocol
          </span>
          <h2 class="text-2xl lg:text-4xl font-headline font-black text-white leading-tight mb-4 uppercase tracking-tighter">${topic?.topic || 'Topic Node Pending...'}</h2>
          ${topic?.description ? `<p class="text-on-surface-variant/70 leading-relaxed max-w-2xl text-[11px] lg:text-sm font-medium uppercase tracking-widest">${topic.description}</p>` : ''}
          <div class="mt-6 flex flex-wrap items-center gap-3">
            <span class="px-3 py-1.5 bg-tertiary/20 text-tertiary border border-tertiary/20 rounded-full text-[9px] lg:text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <span class="material-symbols-outlined text-xs font-black">schedule</span>
              ${DEBATE_DURATION_SEC}s Acquisition
            </span>
            <span class="px-3 py-1.5 bg-surface-container-highest/50 text-on-surface-variant/60 rounded-full text-[9px] lg:text-[10px] font-black uppercase tracking-widest border border-white/5">
              Rhetorical Mode Active
            </span>
          </div>
        </div>
      </div>

      <!-- Timer Bar -->
      <div class="mb-8 glass-panel p-4 lg:p-5 rounded-2xl flex flex-col sm:flex-row items-center gap-4 lg:gap-8 border border-white/5 shadow-xl">
        <div class="flex items-center gap-4 shrink-0 w-full sm:w-auto">
          <button id="terminate-session" class="w-10 h-10 lg:w-12 lg:h-12 rounded-lg bg-white/5 flex items-center justify-center text-on-surface-variant/60 hover:text-error transition-colors" title="Terminate Session">
            <span class="material-symbols-outlined text-sm lg:text-base">logout</span>
          </button>
          <div class="w-12 h-12 lg:w-14 lg:h-14 rounded-xl bg-tertiary/10 flex items-center justify-center border border-tertiary/20">
            <span class="material-symbols-outlined text-tertiary text-2xl lg:text-3xl font-black" id="debate-timer-icon">timer</span>
          </div>
          <div>
            <div class="text-[9px] text-on-surface-variant/60 uppercase tracking-[0.3em] font-black">Sync Pulse Remaining</div>
            <div id="debate-timer" class="font-headline text-2xl lg:text-3xl font-black tabular-nums text-tertiary tracking-tighter transition-colors leading-none">${initialDisplay}</div>
          </div>
        </div>
        <div class="flex-1 h-3 lg:h-4 bg-surface-container-highest/30 rounded-full overflow-hidden w-full border border-white/5 p-0.5">
          <div id="debate-timer-bar" class="h-full bg-gradient-to-r from-tertiary to-primary rounded-full transition-all duration-100 shadow-[0_0_20px_rgba(175,136,255,0.4)]" style="width:100%"></div>
        </div>
        <div class="text-[9px] text-on-surface-variant font-black uppercase tracking-[0.3em] shrink-0 text-right opacity-60">
          ${isLocked ? '<span class="text-secondary font-black">SEALED</span>' : isPaused ? '<span class="text-warning font-black animate-pulse">LOCKED</span>' : '<span class="animate-pulse text-tertiary">TRANSMITTING</span>'}
        </div>
      </div>

      <!-- Response Area + tips -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-span-8 space-y          ${isLocked ? `
            <div class="glass-panel p-6 lg:p-8 rounded-[2rem] border-secondary/20 bg-secondary/5 slide-in-bottom relative overflow-hidden">
              <div class="absolute -right-12 -top-12 w-32 h-32 bg-secondary/10 blur-3xl rounded-full"></div>
              <div class="flex flex-col lg:flex-row items-center lg:items-start gap-6">
                <div class="w-16 h-16 bg-secondary/20 text-secondary rounded-2xl flex items-center justify-center shrink-0 border border-secondary/20 rotate-12">
                  <span class="material-symbols-outlined text-3xl">beenhere</span>
                </div>
                <div class="text-center lg:text-left">
                  <h3 class="text-xl lg:text-2xl font-headline font-black text-white mb-2 uppercase tracking-tighter">Response Locked</h3>
                  <p class="text-on-surface-variant/60 text-[11px] lg:text-sm leading-relaxed mb-6 font-bold uppercase tracking-widest">Rhetorical sequence has been recorded in the tactical hub. Standing by for orbital judging.</p>
                  <button onclick="window.location.hash='#/dashboard'" class="w-full lg:w-fit px-8 py-4 bg-secondary text-on-secondary rounded-xl font-headline font-black text-[10px] uppercase tracking-[0.3em] hover:scale-105 transition-all shadow-xl">Return to Control</button>
                </div>
              </div>
            </div>
          ` : ''}

          <div class="glass-panel p-6 lg:p-8 rounded-[2rem] space-y-6 ${isLocked ? 'hidden' : ''} border border-white/5 shadow-2xl relative overflow-hidden">
            <div class="absolute -right-12 -bottom-12 w-48 h-48 bg-tertiary/5 blur-3xl rounded-full"></div>
            <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
              <h3 class="font-headline text-base lg:text-xl font-black text-white flex items-center gap-3 uppercase tracking-widest relative z-10">
                <span class="material-symbols-outlined text-tertiary text-xl font-black">edit_note</span>
                Architect Statement
              </h3>
              <div class="flex items-center gap-2 bg-surface-container-highest/30 px-3 py-1.5 rounded-full border border-white/5 relative z-10">
                <span class="w-2 h-2 bg-tertiary rounded-full ${isPaused ? '' : 'animate-pulse'}"></span>
                <span class="text-[9px] text-on-surface-variant/60 uppercase font-black tracking-widest">Neural Uplink Active</span>
              </div>
            </div>
            
            <div class="relative group">
              <div class="absolute -inset-1 bg-tertiary/10 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
              <textarea id="debate-text" 
                class="relative w-full bg-surface-container-lowest text-on-surface border-none rounded-2xl p-6 lg:p-8 focus:ring-1 focus:ring-tertiary/40 placeholder:text-outline/10 resize-none font-body text-sm lg:text-base leading-relaxed transition-all shadow-inner" 
                style="min-height: 280px"
                placeholder="Declare your position with maximum tactical clarity. Supply evidence and counter-logic within the pulse window..."
                ${isLocked || isPaused ? 'disabled' : ''}>${existing?.text_content || ''}</textarea>
            </div>
            
            <div class="flex items-center justify-between text-[9px] text-on-surface-variant font-black uppercase tracking-[0.2em] opacity-40">
              <span id="char-count">0 NODES ACCESSED</span>
              <span class="italic">AUTO-SYNC ACTIVE</span>
            </div>

            ${!isLocked ? `
              <div class="flex flex-col sm:flex-row gap-3 pt-4">
                <button id="save-debate-draft" class="w-full sm:w-auto px-8 py-4 rounded-xl border border-white/10 text-on-surface transition-all font-headline font-black uppercase text-[10px] tracking-[0.3em] bg-white/5 hover:bg-white/10">
                  <span class="flex items-center justify-center gap-2"><span class="material-symbols-outlined text-sm font-black">save</span> Sync Draft</span>
                </button>
                <button id="submit-debate" class="flex-1 py-4 lg:py-5 rounded-xl bg-gradient-to-r from-tertiary to-primary text-on-primary-fixed font-headline font-black uppercase tracking-[0.3em] shadow-[0_20px_40px_rgba(175,136,255,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group text-xs">
                  <span>Finalize & Transmit</span>
                  <span class="material-symbols-outlined font-black group-hover:translate-x-1 transition-transform">send</span>
                </button>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Tips Sidebar -->
        <div class="lg:col-span-4">
          <div class="bg-surface-container-low rounded-3xl p-6 border border-white/5 space-y-6 sticky top-6">
            <h3 class="text-white font-headline font-black text-xs lg:text-sm flex items-center gap-3 uppercase tracking-widest">
              <span class="material-symbols-outlined text-tertiary text-base font-black">lightbulb</span>
              Rhetorical Specs
            </h3>
            <ul class="space-y-5">
              <li class="flex items-start gap-4 group">
                <span class="w-8 h-8 rounded-lg bg-tertiary/20 text-tertiary flex items-center justify-center text-[10px] font-black shrink-0 border border-tertiary/20 group-hover:bg-tertiary/40 transition-colors">01</span>
                <p class="text-[10px] lg:text-xs text-on-surface-variant/80 leading-relaxed font-bold uppercase tracking-wider">State position within the first sequence node — be direct.</p>
              </li>
              <li class="flex items-start gap-4 group">
                <span class="w-8 h-8 rounded-lg bg-tertiary/20 text-tertiary flex items-center justify-center text-[10px] font-black shrink-0 border border-tertiary/20 group-hover:bg-tertiary/40 transition-colors">02</span>
                <p class="text-[10px] lg:text-xs text-on-surface-variant/80 leading-relaxed font-bold uppercase tracking-wider">Supply 2-3 logical support stacks with high-fidelity reasoning.</p>
              </li>
              <li class="flex items-start gap-4 group">
                <span class="w-8 h-8 rounded-lg bg-tertiary/20 text-tertiary flex items-center justify-center text-[10px] font-black shrink-0 border border-tertiary/20 group-hover:bg-tertiary/40 transition-colors">03</span>
                <p class="text-[10px] lg:text-xs text-on-surface-variant/80 leading-relaxed font-bold uppercase tracking-wider">Anticipate opposing logic. Address node and refute immediately.</p>
              </li>
              <li class="flex items-start gap-4 p-4 rounded-xl bg-error/5 border border-error/20">
                <span class="material-symbols-outlined text-error text-xl font-black shrink-0">emergency_home</span>
                <p class="text-[9px] text-error font-black uppercase tracking-[0.2em] leading-relaxed">Pulse Expiration → Forced Transmission node lock.</p>
              </li>
            </ul>

            ${isLocked ? `
              <button onclick="window.location.hash='#/dashboard'" class="w-full mt-4 py-3 rounded-2xl border border-white/5 bg-white/5 text-on-surface-variant font-headline font-bold text-[10px] uppercase tracking-[0.2em] hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-sm">arrow_back</span>
                Return to Dashboard
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    </main>
  `;

  bindNavbarEvents();

  // Character counter
  const textarea = document.getElementById('debate-text');
  const charCount = document.getElementById('char-count');
  if (textarea && charCount) {
    const update = () => {
      const len = textarea.value.length;
      charCount.textContent = `${len} NODES ACCESSED`;
    };
    textarea.addEventListener('input', update);
    update();
  }

  async function save(isFinal) {
    if (isPreview) {
      const { Notifier } = await import('../services/notifier.js');
      if (isFinal) Notifier.toast("Submission Disabled in Preview Mode", "info");
      return;
    }
    const text = document.getElementById('debate-text')?.value?.trim() || '';
    
    try {
      // Calculate synchronized time taken based on Instant Launch
      const competitionStart = new Date(round.started_at).getTime();
      const time_taken_ms = Math.max(0, timeSync.getSyncedTime() - competitionStart);

      const { error } = await supabase.from('submissions').upsert({
        team_id: user.id, 
        round_id: round.id, 
        text_content: text, 
        is_final: isFinal, 
        submission_time: new Date().toISOString(),
        time_taken_ms
      }, { onConflict: 'team_id,round_id' });

      if (error) throw error;

      if (isFinal) {
        // Also save to scores table for ranking
        await supabase.from('scores').upsert({
          team_id: user.id,
          round_id: round.id,
          score: 0,
          max_score: 100,
          time_taken_ms,
          evaluated_at: new Date().toISOString()
        }, { onConflict: 'team_id,round_id' });

        stopAntiCheat();
        resumeFooterClock();
        renderDebateRound(container, params, search);
      }
    } catch (err) {
      console.error('Save error:', err);
    }
  }

  document.getElementById('save-debate-draft')?.addEventListener('click', async () => {
    await save(false);
    const btn = document.getElementById('save-debate-draft');
    if (btn) { btn.textContent = '✓ Saved!'; setTimeout(() => btn.innerHTML = '<span class="flex items-center gap-2"><span class="material-symbols-outlined text-sm">save</span> Save Draft</span>', 1500); }
  });

  document.getElementById('submit-debate')?.addEventListener('click', async () => {
    const { Notifier } = await import('../services/notifier.js');
    Notifier.modal({
      title: "Finalize Response?",
      body: "This will lock your argument for judging. You cannot edit after submission.",
      type: "warning",
      icon: "gavel",
      showConfirm: true,
      confirmText: "Submit Now",
      onConfirm: async () => {
        await save(true);
      }
    });
  });

  // Auto-save every 3 seconds
  let autoSaveInterval;
  if (!isLocked && !isPaused && !isPreview) {
    autoSaveInterval = setInterval(async () => {
      const text = document.getElementById('debate-text')?.value;
      if (text !== undefined) {
        await supabase.from('submissions').upsert({
          team_id: user.id, round_id: round.id, text_content: text, submission_time: new Date().toISOString()
        }, { onConflict: 'team_id,round_id' });
      }
    }, 3000);
  }

  // It starts counting from round.started_at exactly
  if (round.started_at && !isLocked && !isPaused && !isPreview) {
    const startedAt = new Date(round.started_at).getTime();
    const elapsed = timeSync.getSyncedTime() - startedAt;
    const remaining = Math.max(0, DEBATE_DURATION_MS - elapsed);

    if (remaining <= 0) {
      // Already expired — auto-submit immediately
      clearInterval(autoSaveInterval);
      await save(true);
      return;
    }

    const timerEl = document.getElementById('debate-timer');
    const barEl = document.getElementById('debate-timer-bar');
    const iconEl = document.getElementById('debate-timer-icon');

    const debateTimer = new Timer({
      durationMs: remaining,
      onTick: (rem) => {
        if (timerEl) timerEl.textContent = Timer.formatTime(rem);
        if (barEl) barEl.style.width = `${(rem / DEBATE_DURATION_MS) * 100}%`;

        // Color shift: urgent when < 20%
        const isUrgent = rem < urgencyThresholdMs;
        if (timerEl) timerEl.className = `font-headline text-3xl font-black tabular-nums tracking-tight transition-colors ${isUrgent ? 'text-error animate-pulse' : 'text-tertiary'}`;
        if (barEl) barEl.className = `h-full rounded-full transition-all duration-100 ${isUrgent ? 'bg-error' : 'bg-gradient-to-r from-tertiary to-primary'}`;
        if (iconEl) iconEl.className = `material-symbols-outlined text-2xl ${isUrgent ? 'text-error animate-bounce' : 'text-tertiary'}`;
      },
      onComplete: async () => {
        clearInterval(autoSaveInterval);
        if (timerEl) timerEl.textContent = '00:00';
        if (barEl) { barEl.style.width = '0%'; barEl.className = 'h-full rounded-full bg-error'; }
        await save(true);
        const { Notifier } = await import('../services/notifier.js');
        Notifier.toast('Time is up! Response auto-submitted.', 'warning');
      }
    });
    debateTimer.start();
  }

  // Terminate Session
  container.querySelector('#terminate-session')?.addEventListener('click', async () => {
    const { Notifier } = await import('../services/notifier.js');
    Notifier.confirm(
      'Terminate Session',
      'Are you sure you want to exit the current round? Your progress is auto-saved, but you will leave the tactical terminal.',
      () => {
        resumeFooterClock();
        navigate('/dashboard');
      },
      { confirmText: 'Exit to Dashboard', type: 'warning' }
    );
  });
}
