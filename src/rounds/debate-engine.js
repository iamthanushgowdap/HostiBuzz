import { supabase } from '../config/supabase.js';
import { getState } from '../services/state.js';
import { renderNavbar, bindNavbarEvents } from '../components/navbar.js';
import { Timer, renderPreRoundCountdown } from '../services/timer.js';
import { navigate } from '../router.js';
import { startAntiCheat, stopAntiCheat } from '../services/anti-cheat.js';

export async function renderDebateRound(container, params, search = {}) {
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

  if (!isPreview && renderPreRoundCountdown(round, container, renderDebateRound)) return;

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
  if (isPaused && round.started_at) {
    const startedAt = new Date(round.started_at).getTime() + 10000;
    let pausedAt = Date.now();
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
      <div class="glass-panel overflow-hidden rounded-3xl glow-accent border-tertiary/20 mb-8 flex flex-col md:flex-row min-h-[200px]">
        ${topic?.image_url ? `
          <div class="md:w-1/4 h-48 md:h-auto overflow-hidden flex-shrink-0">
            <img src="${topic.image_url}" class="w-full h-full object-cover" alt="Debate Topic" />
          </div>
        ` : ''}
        <div class="flex-1 p-8 md:p-10 flex flex-col justify-center">
          <span class="text-[10px] font-headline tracking-[0.4em] text-tertiary uppercase block mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-sm">gavel</span>
            Text-Based Debate · Motion
          </span>
          <h2 class="text-2xl md:text-4xl font-headline font-bold text-white leading-tight mb-4">${topic?.topic || 'Topic yet to be assigned by admin'}</h2>
          ${topic?.description ? `<p class="text-on-surface-variant leading-relaxed max-w-2xl">${topic.description}</p>` : ''}
          <div class="mt-4 flex items-center gap-3">
            <span class="px-3 py-1 bg-tertiary/10 text-tertiary rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
              <span class="material-symbols-outlined text-xs">schedule</span>
              ${DEBATE_DURATION_SEC}s response window
            </span>
            <span class="px-3 py-1 bg-surface-container-highest text-on-surface-variant rounded-full text-[10px] font-bold uppercase tracking-widest">
              Type your argument below
            </span>
          </div>
        </div>
      </div>

      <!-- Timer Bar -->
      <div class="mb-6 glass-panel p-4 rounded-2xl flex items-center gap-6">
        <div class="flex items-center gap-3 shrink-0">
          <span class="material-symbols-outlined text-tertiary text-2xl" id="debate-timer-icon">timer</span>
          <div>
            <div class="text-[10px] text-on-surface-variant uppercase tracking-widest font-headline">Time Remaining</div>
            <div id="debate-timer" class="font-headline text-3xl font-black tabular-nums text-tertiary tracking-tight transition-colors">${initialDisplay}</div>
          </div>
        </div>
        <div class="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden">
          <div id="debate-timer-bar" class="h-full bg-gradient-to-r from-tertiary to-primary rounded-full transition-all duration-100" style="width:100%"></div>
        </div>
        <div class="text-[10px] text-on-surface-variant font-headline uppercase tracking-widest shrink-0 text-right">
          ${isLocked ? '<span class="text-secondary font-bold">SUBMITTED</span>' : isPaused ? '<span class="text-warning font-bold animate-pulse">PAUSED</span>' : '<span class="animate-pulse text-tertiary">LIVE</span>'}
        </div>
      </div>

      <!-- Response Area + tips -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-span-8 space-y-4">
          ${isLocked ? `
            <div class="glass-panel p-8 rounded-2xl border-secondary/20 bg-secondary/5">
              <div class="flex items-start gap-4">
                <span class="material-symbols-outlined text-secondary text-4xl">check_circle</span>
                <div>
                  <h3 class="text-xl font-headline font-bold text-white mb-2">Response Finalized</h3>
                  <p class="text-on-surface-variant text-sm leading-relaxed mb-6">Your typed argument has been securely recorded. Judges will evaluate all responses after the debate session ends.</p>
                  <button onclick="window.location.hash='#/dashboard'" class="px-6 py-3 bg-secondary text-on-secondary rounded-xl font-headline font-bold text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-lg">Back to Dashboard</button>
                </div>
              </div>
            </div>
          ` : ''}

          <div class="glass-panel p-6 rounded-3xl space-y-4 ${isLocked ? 'opacity-50 pointer-events-none' : ''}">
            <div class="flex items-center justify-between">
              <h3 class="font-headline text-lg font-bold text-white flex items-center gap-2">
                <span class="material-symbols-outlined text-tertiary">edit_note</span>
                Type Your Argument
              </h3>
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 bg-tertiary rounded-full ${isPaused ? '' : 'animate-pulse'}"></span>
                <span class="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Text-Based · No Voice</span>
              </div>
            </div>
            <textarea id="debate-text" 
              class="w-full bg-surface-container-lowest text-on-surface border-none rounded-2xl p-5 focus:ring-2 focus:ring-tertiary/40 placeholder:text-outline/30 resize-none font-body text-base leading-relaxed transition-all" 
              style="min-height: 260px"
              placeholder="State your position clearly. Provide supporting arguments, evidence, and rebuttals within the time limit..."
              ${isLocked || isPaused ? 'disabled' : ''}>${existing?.text_content || ''}</textarea>
            
            <div class="flex items-center justify-between text-xs text-on-surface-variant">
              <span id="char-count" class="font-headline">0 characters</span>
              <span class="italic opacity-60">Auto-saved · Auto-submitted on timeout</span>
            </div>

            ${!isLocked ? `
              <div class="flex gap-3">
                <button id="save-debate-draft" class="px-6 py-4 rounded-xl border border-outline-variant/30 text-on-surface hover:bg-white/5 transition-all font-headline font-bold uppercase text-xs tracking-widest">
                  <span class="flex items-center gap-2"><span class="material-symbols-outlined text-sm">save</span> Save Draft</span>
                </button>
                <button id="submit-debate" class="flex-1 py-4 rounded-xl bg-gradient-to-r from-tertiary to-primary text-on-primary-fixed font-headline font-bold uppercase tracking-[0.2em] shadow-[0_10px_40px_rgba(175,136,255,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                  Finalize & Submit <span class="material-symbols-outlined">send</span>
                </button>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Tips Sidebar -->
        <div class="lg:col-span-4">
          <div class="bg-surface-container-low rounded-3xl p-6 border border-white/5 space-y-6 sticky top-6">
            <h3 class="text-white font-headline font-bold flex items-center gap-2">
              <span class="material-symbols-outlined text-tertiary">lightbulb</span>
              Debate Tips
            </h3>
            <ul class="space-y-4">
              <li class="flex gap-3">
                <span class="w-6 h-6 rounded-lg bg-tertiary/20 text-tertiary flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <p class="text-xs text-on-surface-variant leading-relaxed">State your position in the first sentence — be direct.</p>
              </li>
              <li class="flex gap-3">
                <span class="w-6 h-6 rounded-lg bg-tertiary/20 text-tertiary flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <p class="text-xs text-on-surface-variant leading-relaxed">Give 2–3 strong supporting points backed by reasoning or examples.</p>
              </li>
              <li class="flex gap-3">
                <span class="w-6 h-6 rounded-lg bg-tertiary/20 text-tertiary flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <p class="text-xs text-on-surface-variant leading-relaxed">Address the opposing side preemptively. Acknowledge then refute.</p>
              </li>
              <li class="flex gap-3">
                <span class="w-6 h-6 rounded-lg bg-error/20 text-error flex items-center justify-center text-xs font-bold shrink-0">!</span>
                <p class="text-xs text-error/80 leading-relaxed font-bold">Timer runs out → auto-submit. Don't wait until the last second.</p>
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
      charCount.textContent = `${len} character${len !== 1 ? 's' : ''}`;
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
      const { error } = await supabase.from('submissions').upsert({
        team_id: user.id, 
        round_id: round.id, 
        text_content: text, 
        is_final: isFinal, 
        submission_time: new Date().toISOString()
      }, { onConflict: 'team_id,round_id' });

      if (error) throw error;

      if (isFinal) {
        stopAntiCheat();
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

  // Debate timer is based on topic.duration_seconds (NOT round.duration_minutes)
  // It starts counting from round.started_at + 10s grace
  if (round.started_at && !isLocked && !isPaused && !isPreview) {
    const startedAt = new Date(round.started_at).getTime() + 10000;
    const elapsed = Date.now() - startedAt;
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
}
