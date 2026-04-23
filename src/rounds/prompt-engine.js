import { supabase } from '../config/supabase.js';
import { getState } from '../services/state.js';
import { renderNavbar, bindNavbarEvents } from '../components/navbar.js';
import { Timer, renderPreRoundCountdown } from '../services/timer.js';
import { navigate } from '../router.js';
import { startAntiCheat, stopAntiCheat } from '../services/anti-cheat.js';
import { ActivityBroadcast } from '../services/activity-broadcast.js';
import { Ticker } from '../components/ticker.js';
import { Notifier } from '../services/notifier.js';
import { pauseFooterClock, resumeFooterClock } from '../components/footer.js';
import { timeSync } from '../services/timeSync.js';
import { socketService } from '../services/socket.js';

export async function renderPromptRound(container, params, search = {}) {
  // Eco-Mode: Pause background processing
  pauseFooterClock();
  const isPreview = search.mode === 'preview';
  const previewRoundId = search.roundId;
  const user = getState('user');
  
  Ticker.init(container);
  
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
      .eq('round_type', 'prompt')
      .in('status', ['active', 'paused'])
      .single();
    round = data;
  }

  if (!round) { 
    container.innerHTML = `${renderNavbar()}<div class="min-h-screen flex items-center justify-center p-6 text-center bg-surface"><div><span class="material-symbols-outlined text-6xl text-primary/20 mb-4">edit_note</span><p class="text-on-surface-variant text-lg">No active prompt round.</p></div></div>`; 
    bindNavbarEvents(); 
    return; 
  }

  // Instant Launch Protocol: Overlay disabled as per user request
  // if (!isPreview && renderPreRoundCountdown(round, container, renderPromptRound)) return;

  const { data: promptImage } = await supabase.from('prompt_images').select('*').eq('round_id', round.id).limit(1).maybeSingle();
  const { data: existing } = await supabase.from('submissions').select('*').eq('team_id', user.id).eq('round_id', round.id).maybeSingle();
  
  const isPaused = round.status === 'paused';
  const isLocked = existing?.is_final || false;

  if (!isLocked && !isPaused) startAntiCheat(round.id);

  container.innerHTML = `
    ${isPreview ? '<div class="fixed top-0 left-0 w-full bg-primary/80 backdrop-blur-md text-on-primary-fixed text-[10px] font-bold py-1 text-center uppercase tracking-widest z-[200]">PREVIEW MODE - DATA WILL NOT BE SAVED</div>' : ''}
    ${renderNavbar({ hideNavigation: isLocked })}
    <main class="min-h-[calc(100vh-76px)] pt-8 pb-24 px-4 md:px-8 max-w-6xl mx-auto relative">
      ${isPaused ? `
        <div class="fixed inset-0 z-[100] bg-white/60 backdrop-blur-xl flex items-center justify-center p-6 slide-in-bottom">
          <div class="glass-panel p-12 rounded-[40px] max-w-xl w-full text-center border-accent/20 bg-white shadow-2xl">
            <div class="w-20 h-20 bg-accent/10 rounded-3xl flex items-center justify-center mx-auto mb-8 animate-pulse">
              <span class="material-symbols-outlined text-4xl text-accent">lock_open</span>
            </div>
            <h2 class="text-4xl font-headline font-bold text-on-surface mb-4 tracking-tighter uppercase">Round Paused</h2>
            <p class="text-on-surface-variant text-lg leading-relaxed mb-8">The administrator has temporarily paused the round. All inputs are locked. Please wait for the round to resume — your progress is safe.</p>
            <div class="flex items-center justify-center gap-3 text-accent font-headline font-bold text-xs uppercase tracking-[0.3em]">
              <span class="w-2 h-2 bg-accent rounded-full animate-ping"></span>
              Awaiting Admin Signal
            </div>
          </div>
        </div>
      ` : ''}
      <div class="fixed top-1/4 -left-20 w-96 h-96 bg-primary/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>
      <div class="fixed bottom-1/4 -right-20 w-80 h-80 bg-secondary/10 blur-[100px] rounded-full pointer-events-none -z-10"></div>

      ${existing?.is_final ? `
        <div class="glass-panel p-8 lg:p-12 rounded-[3rem] mb-12 text-center border-accent/20 bg-accent/5 space-y-6 slide-in-top relative overflow-hidden">
          <div class="absolute -right-12 -top-12 w-32 h-32 bg-accent/10 blur-3xl rounded-full"></div>
          <div class="w-16 h-16 lg:w-20 lg:h-20 bg-accent/20 text-accent rounded-[1.5rem] flex items-center justify-center mx-auto mb-2 border border-accent/20 rotate-12">
            <span class="material-symbols-outlined text-4xl">beenhere</span>
          </div>
          <h2 class="text-2xl lg:text-3xl font-headline font-black text-on-surface uppercase tracking-tighter">Transmission Sealed</h2>
          <p class="text-on-surface-variant/60 max-w-md mx-auto leading-relaxed font-bold uppercase tracking-widest text-[11px] lg:text-sm">Your cognitive prompt has been recorded in the central hub. Standing by for neural evaluation.</p>
          <div class="pt-6">
            <button onclick="window.location.hash='#/dashboard'" class="w-full lg:w-fit px-10 py-5 bg-accent text-white rounded-[1.25rem] font-headline font-black text-[10px] uppercase tracking-[0.3em] hover:scale-105 transition-all shadow-xl">
              Return to Mission Control
            </button>
          </div>
        </div>
      ` : ''}

      <div class="flex flex-col items-center mb-8 lg:mb-12 ${existing?.is_final ? 'opacity-50 pointer-events-none' : ''}">
        <div class="glass-panel px-4 lg:px-8 py-3 rounded-2xl flex items-center gap-4 lg:gap-6 shadow-xl border border-primary/20 bg-white">
          <button id="terminate-session" class="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-primary/5 flex items-center justify-center text-on-surface-variant/60 hover:text-error transition-colors" title="Terminate Session">
            <span class="material-symbols-outlined text-sm lg:text-base">logout</span>
          </button>
          <div class="flex items-center gap-2 border-l border-primary/10 pl-4 lg:pl-6">
            <span class="material-symbols-outlined text-primary font-black animate-pulse">hourglass_top</span>
            <span id="prompt-timer" class="font-headline text-2xl lg:text-3xl font-black tracking-tighter text-on-surface tabular-nums">${Timer.formatTime(round.duration_minutes * 60 * 1000)}</span>
          </div>
        </div>
        <div class="mt-4 text-[9px] lg:text-xs text-on-surface-variant font-black tracking-[0.4em] uppercase opacity-60">Phase ${round.round_number}: ${round.title}</div>
        
        <div class="mt-4 glass-panel px-4 lg:px-6 py-2 rounded-xl flex items-center gap-3 border border-accent/20 bg-accent/10 shadow-sm">
          <span class="material-symbols-outlined text-accent text-base font-black">visibility</span>
          <span class="text-[8px] lg:text-[10px] text-accent font-black tracking-[0.2em] uppercase">Target Observer: <span id="obs-timer" class="font-bold">--</span></span>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div class="lg:col-span-7 space-y-6">
          <div class="relative group select-none">
            <div class="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
            <div class="relative bg-surface rounded-xl overflow-hidden aspect-video border border-primary/10 flex items-center justify-center shadow-lg">
              <!-- Observation Overlay / Blur -->
              <div id="prompt-blur-overlay" class="absolute inset-0 bg-black/40 backdrop-blur-3xl z-20 flex flex-col items-center justify-center opacity-0 transition-opacity duration-1000 pointer-events-none">
                <span class="material-symbols-outlined text-white/50 text-6xl mb-4">lock</span>
                <span class="font-headline text-white/70 tracking-widest uppercase text-sm">Observation Phase Concluded</span>
              </div>
              ${promptImage ? `<img id="prompt-rendered-img" alt="Target Reference Display" class="w-full h-full object-cover transition-all duration-1000" oncontextmenu="return false;" draggable="false" src="${promptImage.image_url}" />` : '<div class="w-full h-full flex items-center justify-center text-on-surface-variant font-headline tracking-widest uppercase text-sm">Projector Screen</div>'}
            </div>
          </div>
        </div>

        <div class="lg:col-span-5 flex flex-col gap-6 ${existing?.is_final ? 'opacity-50 pointer-events-none' : ''}">
          <div class="bg-white p-6 lg:p-8 rounded-[2rem] border border-primary/10 space-y-6 shadow-xl">
            <header>
              <h2 class="font-headline text-lg lg:text-2xl font-black text-on-surface mb-2 uppercase tracking-tighter leading-none">Capture Protocol</h2>
              <p class="text-on-surface-variant/60 text-[10px] lg:text-sm leading-relaxed font-bold uppercase tracking-widest">Architect a descriptive prompt from the source node to maximize neural accuracy.</p>
            </header>
            <div class="relative group">
              <div class="absolute -inset-1 bg-accent/10 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
              <textarea id="prompt-text" class="relative w-full h-48 lg:h-64 bg-primary/5 text-on-surface border-none rounded-2xl p-6 lg:p-8 focus:ring-1 focus:ring-accent/40 placeholder:text-on-surface-variant/20 font-body text-sm lg:text-base leading-relaxed transition-all shadow-inner resize-none" placeholder="Initiate description sequence..." ${existing?.is_final ? 'disabled' : ''}>${existing?.text_content || ''}</textarea>
              <div class="absolute bottom-4 right-4 glass-panel px-3 py-1.5 rounded-lg text-[9px] font-black text-accent tracking-[0.2em] border border-accent/20 shadow-lg bg-white">
                NODES: <span id="word-count" class="font-bold">0</span> / 150
              </div>
            </div>
            <div class="flex items-center gap-3 text-[8px] lg:text-[10px] text-on-surface-variant/40 font-black uppercase tracking-widest">
              <span class="material-symbols-outlined text-sm font-black">memory</span>
              Neural evaluating based on semantic Proximity Map.
            </div>
          </div>
          ${!existing?.is_final ? `
            <button id="submit-prompt" class="kinetic-gradient w-full py-5 lg:py-6 rounded-[1.5rem] font-headline font-black text-white uppercase tracking-[0.3em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-4 group text-xs lg:text-sm">
              <span>Transmit Prompt</span>
              <span class="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">send</span>
            </button>
          ` : ''}
        </div>
      </div>
    </main>
  `;

  bindNavbarEvents();

  // Word count
  const textarea = document.getElementById('prompt-text');
  const wordCount = document.getElementById('word-count');
  function updateWordCount() {
    const words = textarea.value.trim().split(/\s+/).filter(w => w).length;
    wordCount.textContent = words;
  }
  textarea?.addEventListener('input', updateWordCount);
  updateWordCount();

  // Auto-save every 5 seconds
  if (!isPreview) {
    setInterval(async () => {
      if (textarea.value.trim()) {
        await supabase.from('submissions').upsert({
          team_id: user.id, round_id: round.id, text_content: textarea.value, submission_time: new Date().toISOString()
        }, { onConflict: 'team_id,round_id' });
      }
    }, 5000);
  }

  // Submit
  document.getElementById('submit-prompt')?.addEventListener('click', async () => {
    const { Notifier } = await import('../services/notifier.js');
    if (!textarea.value.trim()) return Notifier.toast('Please write a prompt.', 'error');
    
    if (isPreview) {
      return Notifier.toast("Submission Disabled in Preview Mode", "info");
    }

    Notifier.modal({
      title: "Finalize Prompt?",
      body: "This will submit your creative description for AI evaluation. You cannot edit after this.",
      type: "warning",
      icon: "history_edu",
      showConfirm: true,
      confirmText: "Submit Prompt",
      onConfirm: async () => {
        // Calculate synchronized time taken safely
        const competitionStart = round.started_at ? new Date(round.started_at).getTime() : Date.now();
        let time_taken_ms = Math.max(0, timeSync.getSyncedTime() - competitionStart);
        if (isNaN(time_taken_ms) || !isFinite(time_taken_ms)) time_taken_ms = 0;

        await supabase.from('submissions').upsert({
          team_id: user.id, 
          round_id: round.id, 
          text_content: textarea.value, 
          is_final: true, 
          submission_time: new Date().toISOString(),
          time_taken_ms
        }, { onConflict: 'team_id,round_id' });
        
        // Push zero-score record so leaderboard picks up completion time immediately
        await supabase.from('scores').upsert({
          team_id: user.id,
          round_id: round.id,
          score: 0,
          max_score: 100,
          time_taken_ms
        }, { onConflict: 'team_id,round_id' });
        
        stopAntiCheat();
        ActivityBroadcast.push('activity', `Team "${user.team_name}" just submitted their AI Prompt for Round ${round.round_number}!`);
        Notifier.toast('Prompt submitted!', 'success');
        resumeFooterClock();
        navigate('/dashboard');
      }
    });
  });

  // Timer and Observer Logic
  const displayDuration = promptImage?.display_duration_seconds || 30;
  let timer;

  if (round.started_at) {
    const syncInterval = setInterval(() => {
      if (!document.getElementById('obs-timer')) {
        clearInterval(syncInterval);
        return;
      }
      if (isPaused) return;

      const startedAt = new Date(round.started_at).getTime();
      const elapsedSec = (timeSync.getSyncedTime() - startedAt) / 1000;
      const timeRem = Math.max(0, Math.ceil(displayDuration - elapsedSec));
      
      const obsTimer = document.getElementById('obs-timer');
      const imgEl = document.getElementById('prompt-rendered-img');
      const overlay = document.getElementById('prompt-blur-overlay');

      if (obsTimer) obsTimer.textContent = timeRem + 's';

      if (elapsedSec >= displayDuration && imgEl && !imgEl.classList.contains('blur-2xl')) {
        imgEl.classList.add('blur-2xl', 'scale-110');
        if (overlay) overlay.classList.remove('opacity-0');
      }
    }, 100);

    if (!isPaused) {
      timer = new Timer({
        onTick: (rem) => { const el = document.getElementById('prompt-timer'); if (el) el.textContent = Timer.formatTime(rem); },
        onComplete: async () => {
          clearInterval(syncInterval);
          if (!existing?.is_final) {
            // Calculate synchronized time taken safely
            const competitionStart = round.started_at ? new Date(round.started_at).getTime() : Date.now();
            let time_taken_ms = Math.max(0, timeSync.getSyncedTime() - competitionStart);
            if (isNaN(time_taken_ms) || !isFinite(time_taken_ms)) time_taken_ms = 0;

            await supabase.from('submissions').upsert({ 
              team_id: user.id, 
              round_id: round.id, 
              text_content: textarea.value, 
              is_final: true, 
              submission_time: new Date().toISOString(),
              time_taken_ms
            }, { onConflict: 'team_id,round_id' });
            
            await supabase.from('scores').upsert({
              team_id: user.id,
              round_id: round.id,
              score: 0,
              max_score: 100,
              time_taken_ms
            }, { onConflict: 'team_id,round_id' });
            
            stopAntiCheat();
            
            // Broadcast auto-submission
            ActivityBroadcast.push('activity', `Team "${user.team_name}" was auto-submitted as time expired for Round ${round.round_number}.`);

            alert('Time up! Auto-submitted.'); 
            navigate('/dashboard');
          }
        }
      }).startFromServer(round.started_at, round.duration_minutes);
    } else {
      const startedAt = new Date(round.started_at).getTime() + 10000;
      let pausedAt = Date.now();
      try {
        const cfg = typeof round.config === 'string' ? JSON.parse(round.config) : (round.config || {});
        if (cfg.paused_at) pausedAt = new Date(cfg.paused_at).getTime();
      } catch (e) {}
      const totalMs = round.duration_minutes * 60 * 1000;
      const elapsedSoFar = pausedAt - startedAt;
      const remaining = Math.max(0, totalMs - elapsedSoFar);
      const el = document.getElementById('prompt-timer');
      if (el) el.textContent = Timer.formatTime(remaining);
    }
  }

  // Socket Synchronization for Instant Launch
  const onRoundStart = ({ roundId, startedAt }) => {
    if (roundId === round.id) {
      round.started_at = startedAt;
      round.status = 'active';
      // Re-initialize timer and synchronization baseline
      if (timer) timer.stop();
      timer = new Timer({
        onTick: (rem) => {
          const el = document.getElementById('prompt-timer');
          if (el) el.textContent = Timer.formatTime(rem);
        },
        onComplete: async () => {
          if (!existing?.is_final) {
            const competitionStart = startedAt ? new Date(startedAt).getTime() : Date.now();
            let time_taken_ms = Math.max(0, timeSync.getSyncedTime() - competitionStart);
            if (isNaN(time_taken_ms) || !isFinite(time_taken_ms)) time_taken_ms = 0;
            await supabase.from('submissions').upsert({ 
              team_id: user.id, round_id: round.id, is_final: true, submission_time: new Date().toISOString(), time_taken_ms
            }, { onConflict: 'team_id,round_id' });
            
            await supabase.from('scores').upsert({
              team_id: user.id, round_id: round.id, score: 0, max_score: 100, time_taken_ms
            }, { onConflict: 'team_id,round_id' });
            Notifier.toast('Time is up! Prompt finalized.', 'warning');
            renderPromptRound(container, params, search);
          }
        }
      });
      timer.startFromServer(startedAt, round.duration_minutes);
      startAntiCheat(round.id);
    }
  };

  socketService.on('admin:round_start', onRoundStart);

  // Terminate session
  container.querySelector('#terminate-session')?.addEventListener('click', () => {
    Notifier.confirm(
      'Terminate Session',
      'Are you sure you want to exit? Your progress is auto-saved.',
      () => {
        socketService.off('admin:round_start', onRoundStart);
        resumeFooterClock();
        navigate('/dashboard');
      },
      { confirmText: 'Exit to Dashboard', type: 'warning' }
    );
  });
}
