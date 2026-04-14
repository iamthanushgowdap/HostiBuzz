import { supabase } from '../config/supabase.js';
import { getState } from '../services/state.js';
import { renderNavbar, bindNavbarEvents } from '../components/navbar.js';
import { Timer, renderPreRoundCountdown } from '../services/timer.js';
import { navigate } from '../router.js';
import { startAntiCheat, stopAntiCheat } from '../services/anti-cheat.js';
import { Notifier } from '../services/notifier.js';

export async function renderVideoRound(container, params, search = {}) {
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
      .eq('round_type', 'video')
      .in('status', ['active', 'paused'])
      .single();
    round = data;
  }
  
  if (!round) { 
    container.innerHTML = `${renderNavbar()}<div class="min-h-screen flex items-center justify-center p-6 text-center"><div><span class="material-symbols-outlined text-6xl text-on-surface-variant/20 mb-4">video_file</span><p class="text-on-surface-variant text-lg">${isPreview ? 'Preview Round Not Found' : 'No active video round.'}</p></div></div>`; 
    bindNavbarEvents(); 
    return; 
  }

  if (!isPreview && renderPreRoundCountdown(round, container, renderVideoRound)) return;

  const isPaused = round.status === 'paused';
  
  // Check existing submission
  let existing = null;
  if (!isPreview) {
    const { data } = await supabase.from('submissions').select('*').eq('team_id', user.id).eq('round_id', round.id).maybeSingle();
    existing = data;
  }
  const isLocked = existing?.is_final || false;

  // Parse config for guidelines
  let cfg = round.config || {};
  if (typeof cfg === 'string') try { cfg = JSON.parse(cfg); } catch(e) { cfg = {}; }
  const guidelines = cfg.guidelines || '';

  if (!isLocked && !isPaused && !isPreview) startAntiCheat(round.id);

  container.innerHTML = `
    ${isPreview ? '<div class="fixed top-0 left-0 w-full bg-primary/80 backdrop-blur-md text-on-primary-fixed text-[10px] font-bold py-1 text-center uppercase tracking-widest z-[200]">PREVIEW MODE - DATA WILL NOT BE SAVED</div>' : ''}
    ${renderNavbar({ hideNavigation: !isLocked })}
    <main class="min-h-[calc(100vh-76px)] flex flex-col items-center justify-center p-6 relative kinetic-bg">
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
      <div class="fixed top-1/4 -left-20 w-96 h-96 bg-primary/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>
      <div class="fixed bottom-1/4 -right-20 w-96 h-96 bg-secondary/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>
      
      <div class="w-full max-w-4xl relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 px-2 lg:px-0">
        <!-- Left Side: Header & Guidelines -->
        <div class="flex flex-col justify-center">
          <div class="flex items-center gap-3 mb-4 lg:mb-6">
            <span class="px-3 py-1 bg-secondary/20 text-secondary border border-secondary/20 rounded-full text-[9px] lg:text-[10px] font-black uppercase tracking-widest">Phase ${round.round_number} Protocol</span>
            <span class="px-3 py-1 bg-surface-container-highest/50 text-on-surface-variant/60 rounded-full text-[9px] lg:text-[10px] font-black uppercase tracking-widest border border-white/5">Cinematic Round</span>
          </div>
          
          <h1 class="text-3xl lg:text-6xl font-headline font-black tracking-tighter text-white mb-4 lg:mb-6 leading-none uppercase">${round.title}</h1>
          
          <div class="glass-panel p-5 lg:p-6 rounded-[2rem] border-white/10 bg-white/5 space-y-4">
            <h3 class="text-white font-headline font-black text-xs lg:text-sm flex items-center gap-3 uppercase tracking-[0.2em]">
              <span class="material-symbols-outlined text-secondary text-sm lg:text-base">description</span>
              Transmission Logic
            </h3>
            <div class="text-on-surface-variant/80 text-[11px] lg:text-sm leading-relaxed font-medium">
              ${guidelines ? guidelines.replace(/\n/g, '<br>') : 'Submit your final cinematic transmission link (Google Drive, YouTube, or Vimeo). Ensure node permissions are set to PUBLIC or GLOBAL ACCESS.'}
            </div>
          </div>

          <div class="mt-8 flex items-center justify-between lg:justify-start gap-6 bg-surface-container-low/50 px-5 lg:px-6 py-4 rounded-2xl border border-white/5 w-full lg:w-fit shadow-xl">
            <button id="terminate-session" class="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-white/5 flex items-center justify-center text-on-surface-variant/60 hover:text-error transition-colors" title="Terminate Session">
              <span class="material-symbols-outlined text-sm lg:text-base">logout</span>
            </button>
            <div class="flex items-center gap-4 border-l border-white/5 pl-4 lg:pl-6">
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-secondary animate-pulse font-black">timer</span>
                <span class="text-[9px] uppercase tracking-[0.2em] font-black text-on-surface-variant/60">Sync Remaining</span>
              </div>
              <span id="video-timer" class="text-2xl lg:text-3xl font-headline font-black text-white tabular-nums tracking-tighter">${Timer.formatTime(round.duration_minutes * 60 * 1000)}</span>
            </div>
          </div>
        </div>

        <!-- Right Side: Submission Form -->
        <div class="flex flex-col justify-center">
          ${isLocked ? `
            <div class="glass-panel p-8 lg:p-10 rounded-[3rem] border-secondary/20 bg-secondary/5 text-center space-y-6 slide-in-bottom">
              <div class="w-16 h-16 lg:w-20 lg:h-20 bg-secondary/20 text-secondary rounded-[1.5rem] flex items-center justify-center mx-auto mb-2 border border-secondary/20 rotate-12">
                <span class="material-symbols-outlined text-3xl lg:text-4xl">beenhere</span>
              </div>
              <h2 class="text-xl lg:text-2xl font-headline font-black text-white uppercase tracking-widest">Transmission Sealed</h2>
              <p class="text-on-surface-variant/60 text-[11px] lg:text-sm px-4 font-bold uppercase tracking-widest leading-loose">Visual sequence has been locked in the hub. Standing by for evaluation.</p>
              <button onclick="window.location.hash='#/dashboard'" class="w-full py-5 bg-secondary text-on-secondary rounded-[1.25rem] font-headline font-black text-[10px] uppercase tracking-[0.3em] hover:scale-105 transition-all shadow-xl">Return to Control</button>
            </div>
          ` : `
            <div class="glass-panel p-6 lg:p-8 rounded-[3rem] space-y-8 border-white/10 shadow-2xl relative overflow-hidden">
               <div class="absolute -right-12 -top-12 w-32 h-32 bg-secondary/5 blur-3xl rounded-full"></div>
              <div class="space-y-4">
                <label class="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.4em] text-on-surface-variant/60 block pl-1">Video Access Endpoint</label>
                <div class="relative group">
                  <span class="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant/30 group-focus-within:text-secondary transition-colors font-black">play_circle</span>
                  <input id="video-link" class="w-full bg-surface-container-lowest border-none rounded-2xl py-4 lg:py-5 pl-14 pr-5 text-white placeholder:text-outline/20 font-body text-sm lg:text-base focus:ring-1 focus:ring-secondary/40 shadow-inner" placeholder="https://drive.google.com/..." value="${existing?.drive_link || ''}" />
                </div>
                <div class="mt-4 flex gap-3 p-4 rounded-xl bg-secondary/5 border border-secondary/10">
                  <span class="material-symbols-outlined text-secondary text-xs lg:text-sm font-black">info</span>
                  <p class="text-[8px] lg:text-[10px] text-on-surface-variant/60 font-black uppercase tracking-widest leading-relaxed">PROTOCOL NOTICE: Verify node sharing permissions before ignition. Manual override disabled after submission.</p>
                </div>
              </div>

              <button id="submit-video" class="kinetic-gradient w-full py-5 lg:py-6 rounded-[1.5rem] font-headline font-black text-on-primary-fixed text-xs lg:text-sm flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_20px_40px_rgba(167,165,255,0.2)] group">
                <span class="uppercase tracking-[0.3em]">Ignite Submission</span>
                <span class="material-symbols-outlined text-2xl lg:text-xl group-hover:translate-x-1 transition-transform">upload</span>
              </button>
            </div>
          `}
        </div>
      </div>
    </main>
  `;

  bindNavbarEvents();

  async function save(isFinal) {
    const link = document.getElementById('video-link').value.trim();
    if (isFinal && !link) return Notifier.toast('Please enter a video link.', 'error');

    if (isPreview) {
      if (isFinal) Notifier.toast("Submission Disabled in Preview Mode", "info");
      return;
    }

    try {
      const { error } = await supabase.from('submissions').upsert({
        team_id: user.id, 
        round_id: round.id, 
        drive_link: link, 
        is_final: isFinal, 
        submission_time: new Date().toISOString()
      }, { onConflict: 'team_id,round_id' });

      if (error) throw error;

      if (isFinal) {
        stopAntiCheat();
        Notifier.toast('Video Submitted Successfully!', 'success');
        renderVideoRound(container, params, search);
      }
    } catch (err) {
      Notifier.toast('Error: ' + err.message, 'error');
    }
  }

  const submitBtn = document.getElementById('submit-video');
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      Notifier.modal({
        title: "Finalize Submission?",
        body: "This will lock your video submission for judging. Ensure sharing settings are correct.",
        icon: "upload",
        type: "warning",
        showConfirm: true,
        confirmText: "Submit Video",
        onConfirm: async () => {
          await save(true);
        }
      });
    });
  }

  if (round.started_at && !isLocked && !isPaused) {
    new Timer({
      onTick: (rem) => { 
        const el = document.getElementById('video-timer'); 
        if (el) el.textContent = Timer.formatTime(rem); 
      },
      onComplete: async () => { 
        const link = document.getElementById('video-link').value.trim();
        if (link) await save(true); 
        Notifier.toast('Time is up! Video submission finalized.', 'warning'); 
        renderVideoRound(container);
      }
    }).startFromServer(round.started_at, round.duration_minutes);
  } else if (!isPreview && isPaused) {
    const startedAt = new Date(round.started_at).getTime() + 10000;
    let pausedAt = Date.now();
    try {
      const cfg = typeof round.config === 'string' ? JSON.parse(round.config) : (round.config || {});
      if (cfg.paused_at) pausedAt = new Date(cfg.paused_at).getTime();
    } catch (e) {}
    const totalMs = round.duration_minutes * 60 * 1000;
    const elapsedSoFar = pausedAt - startedAt;
    const remaining = Math.max(0, totalMs - elapsedSoFar);
    const el = document.getElementById('video-timer');
    if (el) el.textContent = Timer.formatTime(remaining);
  }

  // Terminate Session
  container.querySelector('#terminate-session')?.addEventListener('click', async () => {
    Notifier.confirm(
      'Terminate Session',
      'Are you sure you want to exit the current round? Your progress is auto-saved, but you will leave the tactical terminal.',
      () => navigate('/dashboard'),
      { confirmText: 'Exit to Dashboard', type: 'warning' }
    );
  });
}
