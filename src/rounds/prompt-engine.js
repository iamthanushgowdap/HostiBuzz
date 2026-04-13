import { supabase } from '../config/supabase.js';
import { getState } from '../services/state.js';
import { renderNavbar, bindNavbarEvents } from '../components/navbar.js';
import { Timer, renderPreRoundCountdown } from '../services/timer.js';
import { navigate } from '../router.js';
import { startAntiCheat, stopAntiCheat } from '../services/anti-cheat.js';

export async function renderPromptRound(container, params, search = {}) {
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
      .eq('round_type', 'prompt')
      .in('status', ['active', 'paused'])
      .single();
    round = data;
  }

  if (!round) { 
    container.innerHTML = `${renderNavbar()}<div class="min-h-screen flex items-center justify-center p-6 text-center"><div><span class="material-symbols-outlined text-6xl text-on-surface-variant/20 mb-4">edit_note</span><p class="text-on-surface-variant text-lg">No active prompt round.</p></div></div>`; 
    bindNavbarEvents(); 
    return; 
  }

  if (!isPreview && renderPreRoundCountdown(round, container, renderPromptRound)) return;

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
      <div class="fixed bottom-1/4 -right-20 w-80 h-80 bg-secondary/10 blur-[100px] rounded-full pointer-events-none -z-10"></div>

      ${existing?.is_final ? `
        <div class="glass-panel p-12 rounded-3xl mb-12 text-center border-secondary/20 bg-secondary/5 space-y-6 slide-in-top">
          <span class="material-symbols-outlined text-6xl text-secondary animate-pulse">verified</span>
          <h2 class="text-3xl font-headline font-bold text-white uppercase tracking-tighter">Prompt Submitted</h2>
          <p class="text-on-surface-variant max-w-md mx-auto leading-relaxed">Your creative prompt has been securely recorded. You can now return to the dashboard to wait for evaluation.</p>
          <div class="pt-6">
            <button onclick="window.location.hash='#/dashboard'" class="px-10 py-4 bg-secondary text-on-secondary rounded-xl font-headline font-bold text-xs uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-lg">
              Return to Dashboard
            </button>
          </div>
        </div>
      ` : ''}

      <div class="flex flex-col items-center mb-12 ${existing?.is_final ? 'opacity-50 pointer-events-none' : ''}">
        <div class="glass-panel px-8 py-3 rounded-full flex items-center gap-4 shadow-lg border border-primary/20">
          <span class="material-symbols-outlined text-primary">hourglass_top</span>
          <span id="prompt-timer" class="font-headline text-3xl font-bold tracking-widest text-white">${Timer.formatTime(round.duration_minutes * 60 * 1000)}</span>
        </div>
        <div class="mt-4 text-on-surface-variant font-label text-sm tracking-widest uppercase">Round ${round.round_number}: ${round.title}</div>
        
        <div class="mt-4 glass-panel px-6 py-2 rounded-xl flex items-center gap-3 border border-secondary/20">
          <span class="material-symbols-outlined text-secondary text-sm">visibility</span>
          <span class="text-xs text-secondary font-headline tracking-widest uppercase">Target Observer: <span id="obs-timer" class="font-bold">--</span></span>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div class="lg:col-span-7 space-y-6">
          <div class="relative group select-none">
            <div class="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
            <div class="relative bg-surface-container-lowest rounded-xl overflow-hidden aspect-video border border-white/5 flex items-center justify-center">
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
          <div class="bg-surface-container-low p-8 rounded-xl border border-white/5 space-y-6">
            <header>
              <h2 class="font-headline text-2xl font-bold text-white mb-2">Write a descriptive prompt for this image</h2>
              <p class="text-on-surface-variant text-sm leading-relaxed">Describe the textures, lighting, and composition to earn maximum accuracy points.</p>
            </header>
            <div class="relative">
              <textarea id="prompt-text" class="w-full h-64 bg-surface-container-lowest text-on-surface border-none rounded-lg p-6 focus:ring-1 focus:ring-secondary/40 placeholder:text-outline/50 resize-none font-body leading-relaxed transition-all" placeholder="Begin your description here..." ${existing?.is_final ? 'disabled' : ''}>${existing?.text_content || ''}</textarea>
              <div class="absolute bottom-4 right-4 glass-panel px-3 py-1 rounded-md text-xs font-label text-secondary tracking-wider">
                WORDS: <span id="word-count" class="font-bold">0</span> / 150
              </div>
            </div>
            <div class="flex items-center gap-3 text-xs text-on-surface-variant/60 font-label italic">
              <span class="material-symbols-outlined text-sm">info</span>
              AI evaluates based on semantic proximity to the original seed.
            </div>
          </div>
          ${!existing?.is_final ? `
            <button id="submit-prompt" class="kinetic-gradient w-full py-5 rounded-lg font-headline font-bold text-on-primary-fixed uppercase tracking-widest shadow-[0_10px_30px_rgba(167,165,255,0.2)] hover:shadow-[0_10px_40px_rgba(167,165,255,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group">
              Submit Prompt
              <span class="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>
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
  textarea.addEventListener('input', updateWordCount);
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
  document.getElementById('submit-prompt').addEventListener('click', async () => {
    const { Notifier } = await import('../services/notifier.js');
    if (!textarea.value.trim()) return Notifier.toast('Please write a prompt.', 'error');
    
    if (isPreview) {
      return Notifier.toast("Submission Disabled in Preview Mode", "info");
    }

    await supabase.from('submissions').upsert({
      team_id: user.id, round_id: round.id, text_content: textarea.value, is_final: true, submission_time: new Date().toISOString()
    }, { onConflict: 'team_id,round_id' });
    stopAntiCheat();
    Notifier.toast('Prompt submitted!', 'success');
    navigate('/dashboard');
  });

  // Timer and Observer Logic
  const displayDuration = promptImage?.display_duration_seconds || 30;

  if (round.started_at) {
    const syncInterval = setInterval(() => {
      if (!document.getElementById('obs-timer')) {
        clearInterval(syncInterval);
        return;
      }
      if (isPaused) return;

      const startedAt = new Date(round.started_at).getTime() + 10000;
      const elapsedSec = (Date.now() - startedAt) / 1000;
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
      new Timer({
        onTick: (rem) => { const el = document.getElementById('prompt-timer'); if (el) el.textContent = Timer.formatTime(rem); },
        onComplete: async () => {
          clearInterval(syncInterval);
          if (!existing?.is_final) {
            await supabase.from('submissions').upsert({ team_id: user.id, round_id: round.id, text_content: textarea.value, is_final: true, submission_time: new Date().toISOString() }, { onConflict: 'team_id,round_id' });
            stopAntiCheat();
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
}
