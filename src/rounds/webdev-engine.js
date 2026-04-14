import { supabase } from '../config/supabase.js';
import { getState } from '../services/state.js';
import { renderNavbar, bindNavbarEvents } from '../components/navbar.js';
import { Timer, renderPreRoundCountdown } from '../services/timer.js';
import { navigate } from '../router.js';
import { startAntiCheat, stopAntiCheat } from '../services/anti-cheat.js';
import { ActivityBroadcast } from '../services/activity-broadcast.js';
import { Ticker } from '../components/ticker.js';

export async function renderWebdevRound(container, params, search = {}) {
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
      .eq('round_type', 'webdev')
      .in('status', ['active', 'paused'])
      .single();
    round = data;
  }
  
  if (!round) { 
    container.innerHTML = `${renderNavbar()}<div class="min-h-screen flex items-center justify-center p-12 text-center"><div><span class="material-symbols-outlined text-6xl text-on-surface-variant/20 mb-4">analytics</span><p class="text-on-surface-variant text-lg">${isPreview ? 'Preview Round Not Found' : 'No active web development round.'}</p></div></div>`; 
    bindNavbarEvents(); 
    return; 
  }

  if (!isPreview && renderPreRoundCountdown(round, container, renderWebdevRound)) return;

  const isPaused = round.status === 'paused';
  
  let existing = null;
  if (!isPreview) {
    const { data } = await supabase.from('submissions').select('*').eq('team_id', user.id).eq('round_id', round.id).maybeSingle();
    existing = data;
  }

  // Parse config for guidelines
  let cfg = round.config || {};
  if (typeof cfg === 'string') try { cfg = JSON.parse(cfg); } catch(e) { cfg = {}; }
  const guidelines = cfg.guidelines || '';

  const isLocked = existing?.is_final;
  if (!isLocked && !isPaused && !isPreview) startAntiCheat(round.id);

  container.innerHTML = `
    ${isPreview ? '<div class="fixed top-0 left-0 w-full bg-primary/80 backdrop-blur-md text-on-primary-fixed text-[10px] font-bold py-1 text-center uppercase tracking-widest z-[200]">PREVIEW MODE - DATA WILL NOT BE SAVED</div>' : ''}
    ${renderNavbar({ hideNavigation: !isLocked })}
    <main class="min-h-[calc(100vh-76px)] relative pb-24">
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
      <div class="fixed top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none -z-10"></div>
      
      <div class="max-w-5xl mx-auto lg:px-6 pt-8 lg:pt-12 relative z-10">
        <div class="mb-8 lg:mb-12 flex flex-col lg:flex-row justify-between lg:items-end gap-6 px-6 lg:px-0">
          <div class="space-y-2">
            <div class="flex items-center gap-3 mb-2">
              <span class="px-3 py-1 bg-primary/20 text-primary rounded-full text-[9px] lg:text-[10px] font-black uppercase tracking-widest border border-primary/20">Phase ${round.round_number} Tactics</span>
              ${isLocked ? `<span class="px-3 py-1 bg-secondary/20 text-secondary rounded-full text-[9px] lg:text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-secondary/20"><span class="material-symbols-outlined text-[14px]">beenhere</span> Finalized</span>` : ''}
            </div>
            <h1 class="text-3xl lg:text-5xl font-black font-headline tracking-tighter text-white">Project Protocol</h1>
            <p class="text-[11px] lg:text-base text-on-surface-variant max-w-md uppercase tracking-widest font-bold opacity-60">${round.title}</p>
          </div>
          
          <div class="flex flex-col lg:items-end gap-2">
            <span class="text-[9px] uppercase tracking-[0.2em] text-on-surface-variant/60 font-black">Sync Pulse Remaining</span>
            <div id="webdev-timer" class="flex items-center gap-4 bg-surface-container-low border border-white/5 px-4 lg:px-6 py-3 rounded-2xl shadow-xl justify-between lg:justify-end">
              <button id="terminate-session" class="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-white/5 flex items-center justify-center text-on-surface-variant/60 hover:text-error transition-colors" title="Terminate Session">
                <span class="material-symbols-outlined text-sm lg:text-base">logout</span>
              </button>
              <div class="flex items-center gap-4 border-l border-white/5 pl-4 lg:pl-6">
                <span class="material-symbols-outlined text-secondary text-xl font-black">timer</span>
                <span class="text-2xl lg:text-3xl font-headline font-black text-white tabular-nums tracking-tighter">${Timer.formatTime(round.duration_minutes * 60 * 1000)}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div class="md:col-span-12 lg:col-span-8 space-y-6">
            
            ${isLocked ? `
              <!-- SUCCESS STATE -->
              <div class="glass-panel p-8 rounded-2xl border-secondary/20 bg-secondary/5 mb-6">
                <div class="flex items-start gap-4">
                  <span class="material-symbols-outlined text-secondary text-4xl">verified</span>
                  <div>
                    <h3 class="text-xl font-headline font-bold text-white mb-2">Submission Confirmed</h3>
                    <div class="flex items-center gap-4 mb-4">
                      <span class="px-3 py-1 bg-secondary/10 text-secondary rounded-lg text-[10px] font-bold uppercase tracking-widest border border-secondary/20">
                        ${existing?.is_deployed ? 'Live Project' : 'Code Only / Manual Verification'}
                      </span>
                    </div>
                    <p class="text-on-surface-variant text-sm leading-relaxed mb-6">Your project has been successfully finalized. You can no longer edit your submission. Our judges will evaluate your work soon.</p>
                    <button onclick="window.location.hash='#/dashboard'" class="px-6 py-3 bg-secondary text-on-secondary rounded-xl font-headline font-bold text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-lg">Return to Dashboard</button>
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- INPUT FORM -->
            <div class="glass-panel p-6 lg:p-8 rounded-[2rem] space-y-8 ${isLocked ? 'opacity-50 pointer-events-none' : ''} border border-white/5">
              <div class="space-y-6">
                <h2 class="text-sm lg:text-lg font-headline font-black text-secondary flex items-center gap-3 uppercase tracking-widest">
                  <span class="material-symbols-outlined">rocket_launch</span> Deployment Node
                </h2>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                  <label class="relative flex items-center p-5 rounded-2xl bg-surface-container-lowest border border-white/5 cursor-pointer group hover:bg-white/5 transition-all">
                    <input type="radio" name="deployed" value="true" class="hidden peer" ${existing?.is_deployed ? 'checked' : ''}>
                    <div class="w-6 h-6 rounded-full border-2 border-outline-variant/30 mr-4 flex items-center justify-center peer-checked:border-secondary peer-checked:bg-secondary transition-all">
                      <div class="w-2 h-2 rounded-full bg-surface-container-lowest scale-0 peer-checked:scale-100 transition-transform"></div>
                    </div>
                    <div>
                      <span class="text-white font-black block text-sm lg:text-base">LIVE ENDPOINT</span>
                      <span class="text-[9px] text-on-surface-variant/60 uppercase font-bold tracking-widest leading-none">Deployed URL Ready</span>
                    </div>
                  </label>
                  
                  <label class="relative flex items-center p-5 rounded-2xl bg-surface-container-lowest border border-white/5 cursor-pointer group hover:bg-white/5 transition-all">
                    <input type="radio" name="deployed" value="false" class="hidden peer" ${existing?.is_deployed === false ? 'checked' : !existing ? 'checked' : ''}>
                    <div class="w-6 h-6 rounded-full border-2 border-outline-variant/30 mr-4 flex items-center justify-center peer-checked:border-secondary peer-checked:bg-secondary transition-all">
                      <div class="w-2 h-2 rounded-full bg-surface-container-lowest scale-0 peer-checked:scale-100 transition-transform"></div>
                    </div>
                    <div>
                      <span class="text-white font-black block text-sm lg:text-base">CODE ARCHIVE</span>
                      <span class="text-[9px] text-on-surface-variant/60 uppercase font-bold tracking-widest leading-none">Local Sources Only</span>
                    </div>
                  </label>
                </div>
              </div>

              <div id="submission-links-section" class="space-y-6 pt-8 border-t border-white/5 ${existing?.is_deployed ? '' : 'hidden'}">
                <h2 class="text-sm lg:text-lg font-headline font-black text-secondary flex items-center gap-3 uppercase tracking-widest">
                  <span class="material-symbols-outlined">link</span> Transmission Links
                </h2>
                
                <div class="space-y-6">
                  <div class="space-y-2">
                    <label class="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/60 block pl-1">Source Logic (GitHub/GitLab)</label>
                    <div class="relative">
                      <span class="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant/40">code</span>
                      <input id="github-link" class="w-full bg-surface-container-lowest border-none rounded-2xl py-4 lg:py-5 pl-14 pr-5 text-white placeholder:text-outline/20 font-body text-sm lg:text-base focus:ring-1 focus:ring-secondary/40 shadow-inner" placeholder="https://github.com/team/project" value="${existing?.github_link || ''}" />
                    </div>
                  </div>

                  <div id="live-url-container" class="space-y-2">
                    <label class="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/60 block pl-1">Live Deployment Node</label>
                    <div class="relative">
                      <span class="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant/40">public</span>
                      <input id="live-link" class="w-full bg-surface-container-lowest border-none rounded-2xl py-4 lg:py-5 pl-14 pr-5 text-white placeholder:text-outline/20 font-body text-sm lg:text-base focus:ring-1 focus:ring-secondary/40 shadow-inner" placeholder="https://project.vercel.app" value="${existing?.live_link || ''}" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            ${!isLocked ? `
              <div class="flex flex-col sm:flex-row items-center gap-4">
                <button id="submit-webdev" class="w-full sm:flex-1 h-16 rounded-2xl kinetic-gradient font-bold font-headline text-on-primary-fixed flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_10px_30px_rgba(100,255,100,0.1)]">
                  Finalize Submission
                  <span class="material-symbols-outlined">send</span>
                </button>
                <button id="save-draft-webdev" class="w-full sm:w-auto px-8 h-16 rounded-2xl border border-outline-variant/30 text-on-surface hover:bg-white/5 transition-all font-headline font-bold uppercase text-xs tracking-widest">
                  Save Draft
                </button>
              </div>
            ` : ''}
          </div>

          <div class="md:col-span-12 lg:col-span-4 space-y-6">
            <!-- INSTRUCTIONS CARD -->
            <div class="bg-surface-container-lowest rounded-[2rem] p-6 lg:p-8 border border-white/5 shadow-xl relative overflow-hidden group">
              <div class="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors"></div>
              <h3 class="text-white font-headline font-black text-base lg:text-lg mb-6 flex items-center gap-3 uppercase tracking-widest">
                <span class="material-symbols-outlined text-primary">description</span> 
                Protocol Specs
              </h3>
              
              <div class="prose prose-invert prose-sm max-w-none text-on-surface-variant/80 leading-relaxed font-medium">
                ${guidelines ? guidelines.replace(/\n/g, '<br>') : `
                  <ul class="space-y-4 list-none p-0">
                    <li class="flex items-start gap-3"><span class="material-symbols-outlined text-secondary text-sm shrink-0 mt-0.5">check_circle</span><p class="text-[11px] lg:text-sm uppercase tracking-wider font-bold">WORKING WEB APPLICATION INFRASTRUCTURE</p></li>
                    <li class="flex items-start gap-3"><span class="material-symbols-outlined text-secondary text-sm shrink-0 mt-0.5">check_circle</span><p class="text-[11px] lg:text-sm uppercase tracking-wider font-bold">PUBLICLY ACCESSIBLE SOURCE REPOSITORY</p></li>
                    <li class="flex items-start gap-3"><span class="material-symbols-outlined text-secondary text-sm shrink-0 mt-0.5">check_circle</span><p class="text-[11px] lg:text-sm uppercase tracking-wider font-bold">FINALIZE BEFORE PULSE EXPIRATION</p></li>
                  </ul>
                `}
              </div>

              ${!isLocked ? `
                <div class="mt-8 p-4 rounded-xl bg-error/5 border border-error/20">
                  <div class="flex gap-3">
                    <span class="material-symbols-outlined text-error text-sm">warning</span>
                    <p class="text-[8px] lg:text-[10px] text-error font-black uppercase tracking-[0.15em] leading-normal leading-relaxed">System Lock Notice: Finalization will permanently seal the submission node. No further logic updates allowed.</p>
                  </div>
                </div>
              ` : ''}
            </div>
            
            ${isLocked ? `
              <button onclick="window.location.hash='#/dashboard'" class="w-full py-4 rounded-xl bg-surface-container-low text-on-surface-variant font-headline font-bold text-xs uppercase tracking-widest hover:bg-surface-container hover:text-white transition-all flex items-center justify-center gap-2 border border-white/5">
                <span class="material-symbols-outlined text-sm">arrow_back</span>
                Back to Dashboard
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    </main>
  `;

  bindNavbarEvents();

  // Handle Radio Toggle
  const radioInputs = document.getElementsByName('deployed');
  const submissionSection = document.getElementById('submission-links-section');
  
  const updateVisibility = () => {
    const isDeployed = Array.from(radioInputs).find(r => r.checked)?.value === 'true';
    if (isDeployed) {
      submissionSection?.classList.remove('hidden');
    } else {
      submissionSection?.classList.add('hidden');
    }
  };

  radioInputs.forEach(r => r.addEventListener('change', updateVisibility));

  async function save(isFinal) {
    const isDeployed = Array.from(radioInputs).find(r => r.checked)?.value === 'true';
    const github = document.getElementById('github-link').value.trim();
    const live = document.getElementById('live-link').value.trim();
    
    const { Notifier } = await import('../services/notifier.js');
    if (isFinal && isDeployed) {
      if (!github) return Notifier.toast('GitHub link is required.', 'error');
      if (!live) return Notifier.toast('Live URL is required for deployed projects.', 'error');
    }

    if (isPreview) {
      if (isFinal) Notifier.toast("Submission Disabled in Preview Mode", "info");
      return;
    }

    try {
      const { error } = await supabase.from('submissions').upsert({
        team_id: user.id, 
        round_id: round.id, 
        github_link: isDeployed ? github : null, 
        live_link: isDeployed ? live : null, 
        is_deployed: isDeployed,
        is_final: isFinal, 
        submission_time: new Date().toISOString()
      }, { onConflict: 'team_id,round_id' });

      if (error) throw error;
      
      if (isFinal) {
        stopAntiCheat();
        
        // Broadcast submission
        ActivityBroadcast.push('activity', `Team "${user.team_name}" just finalized their Web Project for Round ${round.round_number}!`);

        const { Notifier } = await import('../services/notifier.js');
        Notifier.toast('Project Finalized Successfully!', 'success');
        renderWebdevRound(container, params, search); // Re-render to show locked state
      }
    } catch (err) {
      const { Notifier } = await import('../services/notifier.js');
      Notifier.toast('Error saving project: ' + err.message, 'error');
    }
  }

  const submitBtn = document.getElementById('submit-webdev');
  const saveBtn = document.getElementById('save-draft-webdev');
  
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const { Notifier } = await import('../services/notifier.js');
      Notifier.modal({
        title: "Finalize Submission?",
        body: "This will lock your project for judging. Ensure everything is correct.",
        icon: "rocket_launch",
        type: "warning",
        showConfirm: true,
        confirmText: "Finalize & Submit",
        onConfirm: async () => {
          await save(true);
        }
      });
    });
  }
  
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      await save(false);
      const { Notifier } = await import('../services/notifier.js');
      Notifier.toast('Draft saved!', 'success');
    });
  }

  if (round.started_at && !isLocked && !isPaused) {
    new Timer({
      onTick: (rem) => { 
        const el = document.getElementById('webdev-timer'); 
        if (el) el.querySelector('span:last-child').textContent = Timer.formatTime(rem); 
      },
      onComplete: async () => { 
        await save(true); 
        const { Notifier } = await import('../services/notifier.js');
        Notifier.toast('Time up! Project auto-finalized.', 'warning'); 
        renderWebdevRound(container, params, search);
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
    
    const el = document.getElementById('webdev-timer');
    if (el) el.querySelector('span:last-child').textContent = Timer.formatTime(remaining);
  }

  // Terminate Session
  container.querySelector('#terminate-session')?.addEventListener('click', async () => {
    const { Notifier } = await import('../services/notifier.js');
    Notifier.confirm(
      'Terminate Session',
      'Are you sure you want to exit the current round? Your progress is auto-saved, but you will leave the tactical terminal.',
      () => navigate('/dashboard'),
      { confirmText: 'Exit to Dashboard', type: 'warning' }
    );
  });
}
