import { supabase } from '../config/supabase.js';
import { getState } from '../services/state.js';
import { renderNavbar, bindNavbarEvents } from '../components/navbar.js';
import { Timer, renderPreRoundCountdown } from '../services/timer.js';
import { startAntiCheat, stopAntiCheat } from '../services/anti-cheat.js';
import { navigate } from '../router.js';
import { Ticker } from '../components/ticker.js';
import { timeSync } from '../services/timeSync.js';
import { Notifier } from '../services/notifier.js';
import { pauseFooterClock, resumeFooterClock } from '../components/footer.js';

export async function renderLogoRound(container, params, search = {}, mockUser = null) {
  // Eco-Mode: Pause background processing
  pauseFooterClock();
  const isPreview = search.mode === 'preview' || !!mockUser;
  const previewRoundId = search.roundId;
  const user = mockUser || getState('user');
  
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
      .eq('round_type', 'logo')
      .in('status', ['active', 'paused'])
      .single();
    round = data;
  }

  if (!round) { 
    container.innerHTML = `${renderNavbar()}<div class="min-h-screen flex items-center justify-center p-6 text-center"><div><span class="material-symbols-outlined text-6xl text-on-surface-variant/20 mb-4">image_search</span><p class="text-on-surface-variant">No active logo round.</p></div></div>`; 
    bindNavbarEvents(); 
    return; 
  }

  if (!isPreview && renderPreRoundCountdown(round, container, renderLogoRound)) return;

  const { data: logos } = await supabase.from('logo_assets')
    .select('*')
    .eq('round_id', round.id)
    .order('order_index');

  let existing = null;
  if (!isPreview) {
    const { data } = await supabase.from('submissions')
      .select('*')
      .eq('team_id', user.id)
      .eq('round_id', round.id)
      .maybeSingle();
    existing = data;
  }
  
  let answers = existing?.answers || {};
  let isFinal = existing?.is_final || false;
  const isPaused = round.status === 'paused';

  if (!isFinal && !isPaused && !isPreview) startAntiCheat(round.id);

  // Configuration
  const SECONDS_PER_LOGO = 5;
  const HAS_LOGOS = logos && logos.length > 0;

  // Base shell
  container.innerHTML = `
    ${isPreview ? '<div class="fixed top-0 left-0 w-full bg-secondary/80 backdrop-blur-md text-on-secondary-fixed text-[10px] font-bold py-1 text-center uppercase tracking-widest z-[200]">PREVIEW MODE - DATA WILL NOT BE SAVED</div>' : ''}
    ${renderNavbar({ hideNavigation: !isFinal })}
    <main class="min-h-[calc(100vh-76px)] flex flex-col items-center p-4 lg:p-6 relative overflow-hidden kinetic-bg">
      ${isPaused ? `
        <div class="fixed inset-0 z-[100] bg-[#0a0e19]/60 backdrop-blur-xl flex items-center justify-center p-6 slide-in-bottom">
          <div class="glass-panel p-10 rounded-[40px] max-w-lg w-full text-center border-warning/20 bg-warning/5 shadow-[0_20px_50px_rgba(245,158,11,0.1)]">
            <div class="w-16 h-16 bg-warning/10 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
              <span class="material-symbols-outlined text-3xl text-warning">lock_open</span>
            </div>
            <h2 class="text-3xl font-headline font-bold text-white mb-3 tracking-tighter uppercase">Round Paused</h2>
            <p class="text-on-surface-variant text-base leading-relaxed mb-6">The administrator has temporarily paused the round. All inputs are locked.</p>
            <div class="flex items-center justify-center gap-3 text-warning font-headline font-bold text-xs uppercase tracking-[0.3em]">
              <span class="w-2 h-2 bg-warning rounded-full animate-ping"></span>
              Awaiting Admin Signal
            </div>
          </div>
        </div>
      ` : ''}
      <div class="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div class="absolute bottom-0 left-0 w-[600px] h-[600px] bg-secondary/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div class="w-full max-w-7xl relative z-10 flex flex-col gap-6">
        <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-white/5 pb-6">
          <div class="space-y-1">
            <div class="flex items-center gap-3 mb-2 text-primary text-[10px] lg:text-sm font-headline tracking-[0.3em] uppercase font-black">
              <span class="material-symbols-outlined text-sm font-black">target</span>
              <span>Sequence: ${logos?.length || 0} Nodes</span>
            </div>
            <h1 class="text-3xl lg:text-5xl font-headline font-black tracking-tighter text-white uppercase leading-none">Identification Round</h1>
          </div>
          <div class="glass-panel p-3 lg:p-4 rounded-2xl flex items-center justify-between lg:justify-end gap-6 border border-white/5">
            <button id="terminate-session" class="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-white/5 flex items-center justify-center text-on-surface-variant/60 hover:text-error transition-colors order-2 lg:order-1" title="Terminate Session">
              <span class="material-symbols-outlined text-sm lg:text-base">logout</span>
            </button>
            <div class="flex flex-col items-start lg:items-end order-1 lg:order-2">
              <span class="text-[9px] uppercase tracking-[0.2em] text-on-surface-variant font-black">Sync Pulse</span>
              <div id="logo-timer" class="text-2xl lg:text-3xl font-headline font-black tabular-nums text-secondary tracking-tighter">--:--</div>
            </div>
            ${isFinal ? `<button onclick="window.location.hash='#/dashboard'" class="ml-2 w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-primary/20 flex items-center justify-center hover:bg-primary/30 transition-all border border-primary/20"><span class="material-symbols-outlined text-primary text-xl">dashboard</span></button>` : ''}
          </div>
        </div>

        <div id="logo-dynamic-content" class="w-full transition-all duration-300"></div>
      </div>
    </main>
  `;
  bindNavbarEvents();

  const dynamicContent = document.getElementById('logo-dynamic-content');

  // Submission handler
  async function submitRound() {
    if (isFinal) return;
    if (isPreview) {
      const { Notifier } = await import('../services/notifier.js');
      Notifier.toast("Submission Disabled in Preview Mode", "info");
      return;
    }

    const { Notifier } = await import('../services/notifier.js');
    Notifier.modal({
      title: "Finalize Logo Entry?",
      body: "This will lock your answers for evaluation. Ensure everything is matched correctly.",
      type: "warning",
      icon: "task_alt",
      showConfirm: true,
      confirmText: "Finalize & Submit",
      onConfirm: async () => {
        isFinal = true;
        
        // Calculate synchronized time taken
        const competitionStart = new Date(round.started_at).getTime() + 5000;
        const time_taken_ms = Math.max(0, timeSync.getSyncedTime() - competitionStart);

        await supabase.from('submissions').upsert({
          team_id: user.id, 
          round_id: round.id, 
          answers, 
          is_final: true, 
          submission_time: new Date().toISOString(),
          time_taken_ms
        }, { onConflict: 'team_id,round_id' });
        
        // Also update scores with time_taken_ms (if auto-evaluated or later)
        // Note: Logo rounds are usually human-evaluated later, but we store the speed truth now.
        
        stopAntiCheat();
        ActivityBroadcast.push('activity', `Team "${user.team_name}" just identified all brands in Round ${round.round_number}!`);
        Notifier.toast('Submission successful!', 'success');
        resumeFooterClock();
        renderPhase();
      }
    });
  }

  // Bind inputs mapping (used in both phases)
  function attachInputListeners() {
    const inputs = container.querySelectorAll('.logo-list-input');
    inputs.forEach(input => {
      // Avoid duplicate bindings if re-rendered
      input.removeEventListener('input', handleInputChange);
      input.addEventListener('input', handleInputChange);
    });
    
    document.getElementById('submit-logo-btn')?.addEventListener('click', submitRound);
  }

  async function handleInputChange(e) {
    const logoId = e.target.dataset.logoId;
    answers[logoId] = e.target.value.trim();
    if (!isFinal && !isPreview) {
      await supabase.from('submissions').upsert({
        team_id: user.id, round_id: round.id, answers, submission_time: new Date().toISOString()
      }, { onConflict: 'team_id,round_id' });
    }
  }

  let lastRenderedPhase = null;
  let lastSlideIndex = -1;
  let localStartTime = null;

  function renderPhase() {
    if (!HAS_LOGOS) {
      dynamicContent.innerHTML = `<p class="text-on-surface-variant text-center py-12">No logos configured for this round.</p>`;
      return;
    }

    if (isFinal) {
      if (lastRenderedPhase !== 'final') {
        dynamicContent.innerHTML = renderList(true);
        attachInputListeners();
        lastRenderedPhase = 'final';
      }
      return;
    }

    if (!round.started_at) {
      if (lastRenderedPhase !== 'waiting') {
        dynamicContent.innerHTML = `<p class="text-secondary text-center py-12 font-headline animate-pulse">Waiting for admin to start the round...</p>`;
        lastRenderedPhase = 'waiting';
      }
      return;
    }

    // SLIDESHOW CALIBRATION: Sync based on absolute server start + grace
    const syncStart = new Date(round.started_at).getTime() + 5000;
    const now = timeSync.getSyncedTime();
    const elapsedSec = (now - syncStart) / 1000;
    const slideIndex = Math.floor(elapsedSec / SECONDS_PER_LOGO);

    if (slideIndex >= logos.length) {
      // Review Phase
      if (lastRenderedPhase !== 'review') {
        dynamicContent.innerHTML = renderList(false);
        attachInputListeners();
        lastRenderedPhase = 'review';
      }
    } else {
      // Slideshow Phase
      if (lastRenderedPhase !== 'slideshow' || lastSlideIndex !== slideIndex) {
        dynamicContent.innerHTML = renderSlide(slideIndex);
        attachInputListeners();
        
        // Auto-focus the new slide's input!
        const input = document.getElementById('current-slide-input');
        if (input) input.focus();

        lastRenderedPhase = 'slideshow';
        lastSlideIndex = slideIndex;
      }
      // Only update slide timer
      const timeRem = Math.ceil(SECONDS_PER_LOGO - (elapsedSec % SECONDS_PER_LOGO));
      const secEl = document.getElementById('slide-sec');
      if (secEl) secEl.textContent = timeRem;
    }
  }

  function renderSlide(index) {
    const logo = logos[index];
    const val = answers[logo.id] || '';
    return `
      <div class="glass-panel p-6 lg:p-10 rounded-[2.5rem] flex flex-col items-center slide-in-bottom border border-white/5">
        <div class="w-full flex items-center justify-between mb-8 border-b border-white/5 pb-4">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 lg:w-12 lg:h-12 rounded-[1rem] bg-secondary/10 text-secondary border border-secondary/20 flex items-center justify-center font-headline font-black text-lg">${index + 1}</div>
            <div class="flex flex-col">
              <span class="text-on-surface-variant font-black text-[10px] uppercase tracking-[0.2em]">Identification Node</span>
              <span class="text-white text-[9px] uppercase tracking-[0.3em] font-black opacity-40">Phase: Acquisition</span>
            </div>
          </div>
          <div class="flex items-center gap-2 text-secondary bg-secondary/10 px-4 py-2 rounded-xl border border-secondary/20">
            <span class="material-symbols-outlined text-sm animate-pulse font-black">timer</span>
            <span class="font-headline font-black tracking-tighter text-xl tabular-nums" id="slide-sec"></span>
          </div>
        </div>

        ${logo.image_url ? `
          <div class="relative w-full max-w-[400px] aspect-square rounded-[2rem] overflow-hidden glass-panel p-4 mb-8 select-none bg-white shadow-2xl">
            <div class="absolute inset-0 z-20" oncontextmenu="return false;"></div>
            <img src="${logo.image_url}" draggable="false" oncontextmenu="return false;" class="w-full h-full object-contain transition-all duration-300" />
          </div>
        ` : `
          <div class="w-full max-w-[400px] aspect-square rounded-[2rem] glass-panel flex flex-col items-center justify-center mb-8 text-on-surface-variant/40 font-headline text-[10px] uppercase tracking-[0.4em] bg-white/5 border-dashed border-2 border-white/5">
            <span class="material-symbols-outlined text-4xl mb-3">image_not_supported</span>
            Acquiring Visuals...
          </div>
        `}
        
        <div class="w-full max-w-md">
          <input type="text" id="current-slide-input" data-logo-id="${logo.id}" class="logo-list-input w-full bg-surface-container-lowest border border-white/10 rounded-2xl py-4 lg:py-5 px-6 text-center text-white text-xl lg:text-2xl font-headline font-black uppercase tracking-widest focus:ring-2 focus:ring-secondary/40 focus:border-transparent placeholder:text-white/5 transition-all shadow-inner" placeholder="IDENTIFY..." value="${val}" autocomplete="off" spellcheck="false" />
        </div>
      </div>
    `;
  }

  function renderList(isFinalState) {
    let html = isFinalState ? `
      <div class="glass-panel p-5 mb-8 rounded-[1.5rem] bg-secondary/10 border border-secondary/20 flex flex-col items-center text-center gap-2 slide-in-top glow-accent">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shadow-lg"><span class="material-symbols-outlined text-xl text-on-secondary font-black">verified</span></div>
          <h3 class="font-headline font-black text-lg text-white uppercase tracking-tighter">Transmission Sealed</h3>
        </div>
        <p class="text-[9px] text-on-surface-variant/60 font-black uppercase tracking-[0.3em]">Manifest transmitted to tactical command center.</p>
      </div>
    ` : `
      <div class="glass-panel p-5 mb-8 rounded-[1.5rem] bg-primary/10 border border-primary/20 flex flex-col sm:flex-row items-center justify-center gap-4 text-primary slide-in-top">
        <span class="material-symbols-outlined text-2xl animate-pulse font-black">fact_check</span>
        <div class="text-center sm:text-left">
          <h3 class="font-headline font-black text-sm uppercase tracking-[0.2em] mb-1">Tactical Review Active</h3>
          <p class="text-[10px] text-white/50 uppercase tracking-widest font-black leading-none">Sync remaining identifications before pulse timeout</p>
        </div>
      </div>
    `;

    html += `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 lg:gap-4 px-1">`;
    logos.forEach((logo, index) => {
      const val = answers[logo.id] || '';
      html += `
        <div class="glass-panel p-3 lg:p-4 rounded-[1.5rem] flex flex-col items-center gap-4 group hover:border-secondary/30 transition-all border border-white/5">
          <div class="w-full flex justify-between items-center px-1">
            <span class="text-[9px] font-headline font-black text-on-surface-variant/40 group-hover:text-secondary transition-colors tracking-[0.3em]">NODE ${String(index + 1).padStart(2, '0')}</span>
            ${val ? '<span class="w-1.5 h-1.5 rounded-full bg-secondary shadow-lg shadow-secondary/40"></span>' : ''}
          </div>
          
          ${logo.image_url ? `
            <div class="relative w-full aspect-square rounded-xl overflow-hidden glass-panel flex-shrink-0 select-none bg-white p-3 shadow-inner">
              <div class="absolute inset-0 z-20" oncontextmenu="return false;"></div>
              <img src="${logo.image_url}" draggable="false" oncontextmenu="false;" class="w-full h-full object-contain transition-transform duration-700 group-hover:scale-110" />
            </div>
          ` : `
            <div class="w-full aspect-square rounded-xl flex items-center justify-center text-on-surface-variant/20 text-[8px] uppercase font-black tracking-widest glass-panel border border-dashed border-white/5">
              PENDING
            </div>
          `}
          
          <div class="w-full mt-auto">
            <input type="text" data-logo-id="${logo.id}" class="logo-list-input w-full bg-surface-container-lowest border-white/10 border rounded-xl py-2.5 px-3 text-center text-white text-[11px] lg:text-xs font-headline font-black uppercase tracking-widest focus:ring-1 focus:ring-secondary/40 focus:border-transparent placeholder:text-white/5 transition-all shadow-inner ${isFinalState ? 'opacity-40 cursor-not-allowed border-none' : ''}" placeholder="NAME..." value="${val}" autocomplete="off" spellcheck="false" ${isFinalState ? 'disabled' : ''} />
          </div>
        </div>
      `;
    });
    html += `</div>`;

    if (!isFinalState) {
      html += `
        <div class="flex justify-center pt-6 mt-6 border-t border-white/5">
          <button id="submit-logo-btn" class="px-10 py-3 rounded-xl kinetic-gradient text-on-primary-fixed font-headline font-bold flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform shadow-[0_10px_30px_rgba(167,165,255,0.3)] uppercase tracking-widest text-xs">
            <span>Submit Final Answers</span>
            <span class="material-symbols-outlined text-sm">publish</span>
          </button>
        </div>
      `;
    } else {
      html += `
        <div class="flex justify-center pt-6 mt-6 border-t border-white/5">
          <button onclick="window.location.hash='#/dashboard'" class="px-10 py-3 rounded-xl bg-white/5 text-white font-headline font-bold flex items-center gap-2 hover:bg-white/10 hover:scale-105 active:scale-95 transition-all border border-white/10 uppercase tracking-widest text-xs">
            <span class="material-symbols-outlined text-sm">dashboard</span>
            <span>Back to Dashboard</span>
          </button>
        </div>
      `;
    }

    return html;
  }

  // Animation Loop for synchronicity
  const syncInterval = setInterval(() => {
    if (!document.getElementById('logo-dynamic-content')) {
      clearInterval(syncInterval); // cleanup if navigated away
      return;
    }
    if (!isPaused) renderPhase();
  }, 100);

  // Overall Timer
  if (round.started_at && !isPaused && !isPreview) {
    const t = new Timer({
      onTick: (rem) => { 
        const el = document.getElementById('logo-timer'); 
        if (el) el.textContent = Timer.formatTime(rem); 
      },
      onComplete: async () => {
        if (!isFinal) await submitRound();
      }
    });
    t.startFromServer(round.started_at, round.duration_minutes);
  } else if (isPaused) {
    const startedAt = new Date(round.started_at).getTime() + 10000;
    let pausedAt = Date.now();
    try {
      const cfg = typeof round.config === 'string' ? JSON.parse(round.config) : (round.config || {});
      if (cfg.paused_at) pausedAt = new Date(cfg.paused_at).getTime();
    } catch (e) {}
    const totalMs = round.duration_minutes * 60 * 1000;
    const elapsedSoFar = pausedAt - startedAt;
    const remaining = Math.max(0, totalMs - elapsedSoFar);
    const el = document.getElementById('logo-timer');
    if (el) el.textContent = Timer.formatTime(remaining);
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
