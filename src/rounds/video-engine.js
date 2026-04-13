import { supabase } from '../config/supabase.js';
import { getState } from '../services/state.js';
import { renderNavbar, bindNavbarEvents } from '../components/navbar.js';
import { Timer, renderPreRoundCountdown } from '../services/timer.js';
import { navigate } from '../router.js';
import { startAntiCheat, stopAntiCheat } from '../services/anti-cheat.js';

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
      
      <div class="w-full max-w-4xl relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8">
        <!-- Left Side: Header & Guidelines -->
        <div class="flex flex-col justify-center">
          <div class="flex items-center gap-3 mb-6">
            <span class="px-3 py-1 bg-secondary/20 text-secondary rounded-full text-[10px] font-bold uppercase tracking-widest">Round ${round.round_number}</span>
            <span class="px-3 py-1 bg-surface-container-highest text-on-surface-variant rounded-full text-[10px] font-bold uppercase tracking-widest">Video Round</span>
          </div>
          
          <h1 class="text-4xl md:text-5xl font-headline font-bold tracking-tighter text-white mb-6">${round.title}</h1>
          
          <div class="glass-panel p-6 rounded-2xl border-white/5 bg-white/5 space-y-4">
            <h3 class="text-white font-headline font-bold text-sm flex items-center gap-2 uppercase tracking-wider">
              <span class="material-symbols-outlined text-secondary text-base">description</span>
              Instructions
            </h3>
            <div class="text-on-surface-variant text-sm leading-relaxed">
              ${guidelines ? guidelines.replace(/\n/g, '<br>') : 'Submit your final video link (Google Drive, YouTube, or Vimeo). Ensure permissions are set to public or anyone with the link.'}
            </div>
          </div>

          <div class="mt-8 flex items-center gap-4 bg-surface-container-low px-6 py-4 rounded-2xl border border-white/5 w-fit">
            <span class="material-symbols-outlined text-secondary animate-pulse">timer</span>
            <span id="video-timer" class="text-2xl font-headline font-bold text-white tabular-nums">${Timer.formatTime(round.duration_minutes * 60 * 1000)}</span>
          </div>
        </div>

        <!-- Right Side: Submission Form -->
        <div class="flex flex-col justify-center">
          ${isLocked ? `
            <div class="glass-panel p-10 rounded-3xl border-secondary/20 bg-secondary/5 text-center space-y-6">
              <div class="w-20 h-20 bg-secondary/20 text-secondary rounded-full flex items-center justify-center mx-auto mb-2">
                <span class="material-symbols-outlined text-4xl">beenhere</span>
              </div>
              <h2 class="text-2xl font-headline font-bold text-white">Video Submitted</h2>
              <p class="text-on-surface-variant text-sm px-4">Your submission has been finalized. Good luck!</p>
              <button onclick="window.location.hash='#/dashboard'" class="w-full py-4 bg-secondary text-on-secondary rounded-xl font-headline font-bold text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-lg">Return to Dashboard</button>
            </div>
          ` : `
            <div class="glass-panel p-8 rounded-3xl space-y-8 border-white/10 shadow-2xl">
              <div class="space-y-2">
                <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Video Access Link</label>
                <div class="relative group">
                  <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline/40 group-focus-within:text-secondary transition-colors">play_circle</span>
                  <input id="video-link" class="w-full bg-surface-container-lowest border-none rounded-xl py-5 pl-12 pr-4 text-white placeholder:text-outline/20 font-body transition-shadow focus:ring-1 focus:ring-secondary/40" placeholder="https://drive.google.com/..." value="${existing?.drive_link || ''}" />
                </div>
                <div class="mt-4 flex gap-3 p-4 rounded-xl bg-secondary/5 border border-secondary/10">
                  <span class="material-symbols-outlined text-secondary text-sm">info</span>
                  <p class="text-[10px] text-secondary font-bold uppercase tracking-wider leading-relaxed">Check sharing settings before submitting. Finalizing cannot be undone.</p>
                </div>
              </div>

              <button id="submit-video" class="kinetic-gradient w-full py-5 rounded-2xl font-headline font-bold text-on-primary-fixed flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-secondary/10">
                Confirm Submission
                <span class="material-symbols-outlined">upload</span>
              </button>
              
            </div>
          `}
        </div>
      </div>
    </main>
  `;

  bindNavbarEvents();

  async function save(isFinal) {
    const { Notifier } = await import('../services/notifier.js');
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
      const { Notifier } = await import('../services/notifier.js');
      Notifier.modal({
        title: "Finalize Submission?",
        body: "This will lock your video submission for judging. Ensure sharing settings are correct.",
        icon: "upload",
        type: "warning",
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
        alert('Time up! Submission closed.'); 
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
}
