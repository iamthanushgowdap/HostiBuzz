import { supabase } from '../config/supabase.js';
import { getState } from '../services/state.js';
import { renderNavbar, bindNavbarEvents } from '../components/navbar.js';
import { Timer, renderPreRoundCountdown } from '../services/timer.js';
import { startAntiCheat, stopAntiCheat } from '../services/anti-cheat.js';
import { navigate } from '../router.js';
import { ActivityBroadcast } from '../services/activity-broadcast.js';
import { Ticker } from '../components/ticker.js';
import { Notifier } from '../services/notifier.js';
import { pauseFooterClock, resumeFooterClock } from '../components/footer.js';
import { timeSync } from '../services/timeSync.js';
import { socketService } from '../services/socket-service.js';

let timer = null;

export async function renderQuizRound(container, params, search = {}, mockUser = null) {
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
      .eq('round_type', 'quiz')
      .in('status', ['active', 'paused'])
      .single();
    round = data;
  }

  if (!round) {
    container.innerHTML = `${renderNavbar()}<div class="min-h-screen flex items-center justify-center p-6 text-center"><div><span class="material-symbols-outlined text-6xl text-on-surface-variant/20 mb-4">quiz</span><p class="text-on-surface-variant text-lg">${isPreview ? 'Preview Round Not Found' : 'No active quiz round.'}</p></div></div>`;
    bindNavbarEvents();
    return;
  }

  // Instant Launch Protocol: Overlay disabled as per user request
  // if (!isPreview && renderPreRoundCountdown(round, container, renderQuizRound)) return;

  const isPaused = round.status === 'paused';
  
  // Get questions (raw)
  const { data: rawQuestions } = await supabase.from('questions').select('*').eq('round_id', round.id).order('order_index');
  
  // Check existing submission
  let existing = null;
  if (!isPreview) {
    const { data } = await supabase.from('submissions').select('*').eq('team_id', user.id).eq('round_id', round.id).maybeSingle();
    existing = data;
  }
  let isLocked = existing?.is_final || false;
  
  let currentQ = 0;
  let answers = existing?.answers || {};

  // Handle Set Assignment & Shuffling
  let questions = rawQuestions;
  if (!isPreview) {
    const { data: assignment } = await supabase.from('team_set_assignments').select('*, set:question_sets(*)').eq('team_id', user.id).eq('round_id', round.id).maybeSingle();
    if (assignment?.set?.question_order) {
      const order = assignment.set.question_order;
      questions = order.map(id => rawQuestions.find(q => q.id === id)).filter(Boolean);
    }
  }

  if (!isLocked && !isPaused && !isPreview) startAntiCheat(round.id);

  function renderQuestion() {
    if (!questions || questions.length === 0) {
      document.getElementById('quiz-content').innerHTML = `
        <div class="bg-surface-container-low p-12 rounded-3xl mt-8 text-center border border-dashed border-outline-variant/30">
          <span class="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-4 block">quiz</span>
          <h2 class="text-2xl font-headline font-bold text-white mb-2">No Questions Yet</h2>
          <p class="text-on-surface-variant max-w-md mx-auto">The event administrator hasn't added any questions to this round. Please check back later.</p>
        </div>
      `;
      return;
    }
    const q = questions[currentQ];
    const selectedAnswer = answers[q.id];
    
    document.getElementById('quiz-content').innerHTML = `
      <!-- Progress Bar (Compact) -->
      <div class="mb-10">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-headline tracking-[0.3em] text-primary uppercase font-bold">Progress</span>
            <span class="text-[10px] font-headline text-on-surface-variant/60">${currentQ + 1} of ${questions.length}</span>
          </div>
          <div class="text-[10px] font-headline text-on-surface-variant font-bold uppercase tracking-widest bg-white/5 px-2 py-1 rounded">
            Complexity Analysis
          </div>
        </div>
        <div class="h-1 w-full bg-white/5 rounded-full overflow-hidden">
          <div class="h-full kinetic-gradient transition-all duration-500" style="width: ${((currentQ + 1) / questions.length) * 100}%"></div>
        </div>
      </div>

      <!-- Question Text (Impactful) -->
      <div class="mb-8 lg:mb-12 text-center px-2">
        <h2 class="text-xl md:text-4xl font-headline font-bold text-white leading-tight lg:tracking-tighter">${q.question_text}</h2>
      </div>

      <!-- Options (Adaptive Grid) -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4 mb-10 lg:mb-12">
        ${(() => {
          const rawOpts = q.options;
          const opts = typeof rawOpts === 'string' && rawOpts.startsWith('[') ? JSON.parse(rawOpts) : (Array.isArray(rawOpts) ? rawOpts : []);
          return opts.map((opt, i) => {
            const parts = opt.includes(':') ? opt.split(':') : [opt, ''];
            return `
              <button data-answer="${i}" class="quiz-option group relative overflow-hidden text-left p-5 lg:p-6 rounded-2xl transition-all duration-300 ${selectedAnswer === i ? 'bg-primary/20 border-2 border-primary' : 'bg-surface-container-low hover:bg-surface-container border-2 border-white/5 hover:border-white/20'}">
                <div class="flex items-center gap-4 lg:gap-5">
                  <div class="w-8 h-8 lg:w-10 lg:h-10 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${selectedAnswer === i ? 'bg-primary text-on-primary-fixed' : 'bg-white/5 text-on-surface-variant group-hover:bg-white/10'} shadow-inner">
                    <div class="w-2.5 h-2.5 lg:w-3 lg:h-3 rounded-full border-2 ${selectedAnswer === i ? 'bg-white border-white' : 'border-on-surface-variant/30'}"></div>
                  </div>
                  <div class="flex flex-col">
                    <span class="text-lg lg:text-xl font-headline font-bold ${selectedAnswer === i ? 'text-white' : 'text-on-surface-variant group-hover:text-white'}">${parts[0].trim()}</span>
                    ${parts[1] ? `<span class="text-[8px] lg:text-[9px] uppercase tracking-widest font-black ${selectedAnswer === i ? 'text-primary' : 'text-on-surface-variant/40'}">${parts[1].trim()}</span>` : ''}
                  </div>
                </div>
              </button>
            `;
          }).join('');
        })()}
      </div>

      <!-- Navigation & Action -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-6 pt-8 border-t border-white/5">
        <button id="prev-q" class="order-3 sm:order-1 flex items-center gap-2 text-[10px] font-headline font-black text-on-surface-variant uppercase tracking-widest hover:text-white transition-colors ${currentQ === 0 ? 'opacity-20 pointer-events-none' : ''}">
          <span class="material-symbols-outlined text-sm">arrow_back</span> Previous
        </button>
        
        <div class="order-2 flex gap-1.5 lg:gap-2 px-4 py-2 bg-white/5 rounded-full">
          ${questions.map((_, i) => `
            <button data-goto="${i}" class="quiz-nav w-1.5 lg:w-2 h-1.5 lg:h-2 rounded-full transition-all ${i === currentQ ? 'w-4 lg:w-6 kinetic-gradient' : (answers[questions[i].id] !== undefined && answers[questions[i].id] !== null) ? 'bg-secondary' : 'bg-white/10 hover:bg-white/20'}"></button>
          `).join('')}
        </div>

        <div class="order-1 sm:order-3 w-full sm:w-auto">
          ${currentQ === questions.length - 1 ? `
            <button id="submit-quiz-btn" class="w-full sm:w-auto px-8 py-4 rounded-xl kinetic-gradient text-on-primary-fixed font-headline font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all">
              Initialize Submission
            </button>
          ` : `
            <button id="next-q" class="w-full sm:w-auto px-8 py-4 rounded-xl bg-primary/20 text-primary font-headline font-black text-xs uppercase tracking-[0.2em] border border-primary/30 hover:bg-primary/30 transition-all group flex items-center justify-center gap-3">
              Next Sequence <span class="material-symbols-outlined text-lg lg:text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>
          `}
        </div>
      </div>
    `;
  }

  // Handle Final Submission & Evaluation
  async function performEvaluation(finalAnswers) {
    if (isLocked) return;
    isLocked = true;
    
    let score = 0;
    let wrongItems = [];
    
    questions.forEach((q) => {
      const rawOpts = q.options;
      const opts = typeof rawOpts === 'string' && rawOpts.startsWith('[') ? JSON.parse(rawOpts) : (Array.isArray(rawOpts) ? rawOpts : []);
      
      const givenIdx = finalAnswers[q.id];
      const correctIdx = q.correct_answer;

      if (givenIdx === correctIdx && (givenIdx !== undefined && givenIdx !== null)) {
        score++;
      } else {
        wrongItems.push({
          question: q.question_text,
          given: (givenIdx !== undefined && givenIdx !== null && opts[givenIdx] !== undefined) ? opts[givenIdx] : 'No Answer',
          correct: (correctIdx !== undefined && correctIdx !== null && opts[correctIdx] !== undefined) ? opts[correctIdx] : 'Unknown'
        });
      }
    });

    const maxScore = questions.length;
    const richNotes = JSON.stringify({
      type: 'quiz',
      items: wrongItems,
      summary: wrongItems.length === 0 ? "Perfect Score: All questions answered correctly!" : null
    });

    // Calculate synchronized time taken based on Instant Launch (no offset)
    const competitionStart = new Date(round.started_at).getTime();
    const time_taken_ms = Math.max(0, timeSync.getSyncedTime() - competitionStart);

    // Save final state
    await supabase.from('submissions').upsert({
      team_id: user.id, 
      round_id: round.id, 
      answers: finalAnswers, 
      is_final: true, 
      submission_time: new Date().toISOString(),
      time_taken_ms
    }, { onConflict: 'team_id,round_id' });

    // Save score
    await supabase.from('scores').upsert({
      team_id: user.id, 
      round_id: round.id, 
      score, 
      max_score: maxScore, 
      auto_evaluated: true, 
      evaluator_notes: richNotes, 
      evaluated_at: new Date().toISOString(),
      time_taken_ms
    }, { onConflict: 'team_id,round_id' });

    stopAntiCheat();
    
    // Broadcast submission to ticker
    ActivityBroadcast.push('activity', `Team "${user.team_name}" just submitted for ${round.title}!`);
    
    Notifier.toast(`Quiz submitted! Result: ${score}/${maxScore}`, 'success');
    resumeFooterClock();
    navigate('/dashboard');
  }

  // Event Delegation for All Interactions
  container.addEventListener('click', async (e) => {
    if (isLocked || isPaused) return;

    // Option selection
    const optionBtn = e.target.closest('.quiz-option');
    if (optionBtn) {
      const q = questions[currentQ];
      answers[q.id] = parseInt(optionBtn.dataset.answer);
      renderQuestion();
      if (!isPreview) {
        // Auto-save
        await supabase.from('submissions').upsert({
          team_id: user.id, round_id: round.id, answers, submission_time: new Date().toISOString()
        }, { onConflict: 'team_id,round_id' });
      }
      return;
    }

    // Navigation
    const navBtn = e.target.closest('.quiz-nav');
    if (navBtn) {
      currentQ = parseInt(navBtn.dataset.goto);
      renderQuestion();
      return;
    }

    if (e.target.closest('#prev-q') && currentQ > 0) {
      currentQ--; renderQuestion();
      return;
    }

    if (e.target.closest('#next-q') && currentQ < questions.length - 1) {
      currentQ++; renderQuestion();
      return;
    }

    // Submit
    if (e.target.closest('#submit-quiz-btn')) {
      if (isPreview) {
        Notifier.toast("Submission Disabled in Preview Mode", "info");
        return;
      }
      const answeredCount = Object.keys(answers).filter(k => answers[k] !== undefined && answers[k] !== null).length;
      
      Notifier.confirm(
        'Final Submission',
        `Are you sure you want to submit the quiz? You've answered ${answeredCount} out of ${questions.length} questions.`,
        async () => {
          // Safety fetch
          const { data: latest } = await supabase.from('submissions').select('answers').eq('team_id', user.id).eq('round_id', round.id).maybeSingle();
          await performEvaluation(latest?.answers || answers);
        },
        { confirmText: 'Submit Quiz', icon: 'verified' }
      );
    }
  });

  // Main UI shell
  container.innerHTML = `
    ${isPreview ? '<div class="fixed top-0 left-0 w-full bg-secondary/80 backdrop-blur-md text-on-secondary-fixed text-[10px] font-bold py-1 text-center uppercase tracking-widest z-[200]">PREVIEW MODE - DATA WILL NOT BE SAVED</div>' : ''}
    ${renderNavbar({ hideNavigation: !isLocked })}
    <main class="min-h-[calc(100vh-76px)] p-6 md:p-12 max-w-4xl mx-auto relative">
      <div class="absolute top-1/4 -left-20 w-96 h-96 bg-primary/10 blur-[120px] rounded-full pointer-events-none"></div>
      
      <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 border-b border-white/5 pb-6">
        <div>
          <div class="flex items-center gap-3 text-primary text-[10px] lg:text-sm font-headline tracking-[0.3em] uppercase font-black">
            <span class="material-symbols-outlined text-sm">quiz</span>
            <span>Tactical Phase ${round.round_number}</span>
          </div>
          <h1 class="text-3xl lg:text-5xl font-headline font-black tracking-tighter text-white mt-1">${round.title}</h1>
        </div>
        <div class="glass-panel p-3 lg:p-4 rounded-2xl flex items-center justify-between lg:justify-end gap-6 border border-white/10">
          <button id="terminate-session" class="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-white/5 flex items-center justify-center text-on-surface-variant/60 hover:text-error transition-colors order-2 lg:order-1" title="Terminate Session">
            <span class="material-symbols-outlined text-sm lg:text-base">logout</span>
          </button>
          <div class="flex flex-col items-start lg:items-end order-1 lg:order-2">
            <span class="text-[9px] uppercase tracking-[0.2em] text-on-surface-variant font-black">Pulse Remaining</span>
            <div id="quiz-timer" class="text-2xl lg:text-3xl font-headline font-black tabular-nums text-secondary tracking-tighter">${Timer.formatTime(round.duration_minutes * 60 * 1000)}</div>
          </div>
        </div>
      </div>

      <div id="quiz-content">
        ${isLocked ? `
          <div class="glass-panel p-12 rounded-3xl mt-8 text-center border-secondary/20 bg-secondary/5 space-y-6">
            <span class="material-symbols-outlined text-6xl text-secondary animate-bounce">verified</span>
            <h2 class="text-3xl font-headline font-bold text-white uppercase tracking-tighter">Quiz Finalized</h2>
            <p class="text-on-surface-variant max-w-md mx-auto leading-relaxed">Your answers have been securely submitted and auto-evaluated. You can now return to the dashboard to wait for the next round.</p>
            <div class="pt-6">
              <button onclick="window.location.hash='#/dashboard'" class="px-10 py-4 bg-secondary text-on-secondary rounded-xl font-headline font-bold text-xs uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-[0_10px_30px_rgba(255,255,255,0.05)]">
                Back to Dashboard
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    </main>
  `;

  bindNavbarEvents();
  if (!isLocked) {
    renderQuestion();
  }

  // Timer Initialization
  if (round.started_at && !isPaused && !isPreview) {
    timer = new Timer({
      onTick: (rem) => {
        const el = document.getElementById('quiz-timer');
        if (el) el.textContent = Timer.formatTime(rem);
      },
      onComplete: async () => {
        // Auto-submit
        const { data: latest } = await supabase.from('submissions').select('answers').eq('team_id', user.id).eq('round_id', round.id).maybeSingle();
        await performEvaluation(latest?.answers || answers);
        Notifier.toast('Time is up! Quiz auto-submitted.', 'warning');
      }
    });
    timer.startFromServer(round.started_at, round.duration_minutes);
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
    const el = document.getElementById('quiz-timer');
    if (el) el.textContent = Timer.formatTime(remaining);
  }

  // Socket Synchronization for Instant Launch
  const onRoundStart = ({ roundId, startedAt }) => {
    if (roundId === round.id) {
      round.started_at = startedAt;
      round.status = 'active';
      // Re-initialize timer and refresh UI components
      if (timer) timer.stop();
      timer = new Timer({
        onTick: (rem) => {
          const el = document.getElementById('quiz-timer');
          if (el) el.textContent = Timer.formatTime(rem);
        },
        onComplete: async () => {
          const { data: latest } = await supabase.from('submissions').select('answers').eq('team_id', user.id).eq('round_id', round.id).maybeSingle();
          await performEvaluation(latest?.answers || answers);
          Notifier.toast('Time is up! Quiz auto-submitted.', 'warning');
        }
      });
      timer.startFromServer(startedAt, round.duration_minutes);
      
      // Force refresh of the ready state
      renderQuestion();
      startAntiCheat(round.id);
    }
  };

  socketService.on('admin:round_start', onRoundStart);

  // Terminate Session
  container.querySelector('#terminate-session')?.addEventListener('click', () => {
    Notifier.confirm(
      'Terminate Session',
      'Are you sure you want to exit the current round? Your progress is auto-saved, but you will leave the tactical terminal.',
      () => {
        socketService.off('admin:round_start', onRoundStart);
        resumeFooterClock();
        navigate('/dashboard');
      },
      { confirmText: 'Exit to Dashboard', type: 'warning' }
    );
  });
}
