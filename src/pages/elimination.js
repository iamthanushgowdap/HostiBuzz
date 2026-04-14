import { supabase } from '../config/supabase.js';
import { getState } from '../services/state.js';

export async function renderElimination(container) {
  const user = getState('user');
  
  // Fetch team's scores and rank
  const { data: allTeams } = await supabase.from('teams').select('id, team_name').eq('event_id', user.event_id);
  const { data: allScores } = await supabase.from('scores').select('team_id, score');
  
  const rankings = (allTeams || []).map(t => {
    const total = (allScores || []).filter(s => s.team_id === t.id).reduce((sum, s) => sum + Number(s.score), 0);
    return { id: t.id, total };
  }).sort((a, b) => b.total - a.total);
  
  const rank = rankings.findIndex(r => r.id === user.id) + 1;
  const myScore = rankings.find(r => r.id === user.id)?.total || 0;

  container.innerHTML = `
    <main class="flex-grow flex items-center justify-center relative p-6 min-h-screen" style="background: radial-gradient(circle at 50% 50%, #1a1f2e 0%, #0a0e19 100%);">
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]"></div>
        <div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-error-dim/5 rounded-full blur-[150px]"></div>
      </div>
      <div class="max-w-4xl w-full relative z-10 px-6">
        <div class="text-center space-y-8 lg:space-y-12">
          <div class="flex items-center justify-center space-x-2 mb-8">
            <span class="text-white font-headline font-black text-xl tracking-tighter opacity-40">HostiBuzz</span>
          </div>
          <div class="space-y-4">
            <p class="text-on-surface-variant font-headline tracking-[0.3em] text-[10px] lg:text-sm font-medium">TERMINATION NOTICE</p>
            <h1 class="text-5xl md:text-9xl font-headline font-bold tracking-tighter text-white/90">ELIMINATED</h1>
            <div class="w-32 h-1 bg-gradient-to-r from-transparent via-error-dim to-transparent mx-auto mt-6"></div>
          </div>
          <div class="max-w-2xl mx-auto glass-panel p-6 md:p-12 rounded-2xl shadow-2xl space-y-4 lg:space-y-6">
            <h2 class="text-xl md:text-3xl font-headline font-semibold text-on-surface">${user.team_name}, your journey ends here.</h2>
            <p class="text-on-surface-variant leading-relaxed text-sm lg:text-lg max-w-lg mx-auto">
              While your active participation has concluded, your contributions remain part of the event's history. Thank you for pushing the boundaries.
            </p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto mt-12">
            <div class="bg-surface-container-low p-6 rounded-lg text-left hover:bg-surface-container transition-all border-l-2 border-outline-variant/20">
              <span class="text-xs text-on-surface-variant font-medium block mb-1">FINAL RANK</span>
              <span class="text-2xl font-headline font-bold text-white">#${rank}</span>
            </div>
            <div class="bg-surface-container-low p-6 rounded-lg text-left hover:bg-surface-container transition-all border-l-2 border-outline-variant/20">
              <span class="text-xs text-on-surface-variant font-medium block mb-1">TOTAL SCORE</span>
              <span class="text-2xl font-headline font-bold text-white">${myScore}</span>
            </div>
            <div class="bg-surface-container-low p-6 rounded-lg text-left hover:bg-surface-container transition-all border-l-2 border-outline-variant/20">
              <span class="text-xs text-on-surface-variant font-medium block mb-1">TEAM ID</span>
              <span class="text-2xl font-headline font-bold text-white">${user.team_id}</span>
            </div>
          </div>
          <div class="flex flex-col md:flex-row items-center justify-center gap-6 mt-12">
            <a href="#/leaderboard" class="group flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-primary to-secondary rounded-lg text-on-primary-fixed font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(167,165,255,0.3)]">
              <span class="material-symbols-outlined">leaderboard</span>
              <span>View Final Leaderboard</span>
            </a>
            <a href="#/" class="group flex items-center gap-3 px-8 py-4 bg-surface-container-high rounded-lg text-white font-semibold transition-all hover:bg-surface-container-highest active:scale-95 border border-outline-variant/15">
              <span class="material-symbols-outlined">home</span>
              <span>Back to Home</span>
            </a>
          </div>
        </div>
      </div>
    </main>
    <footer class="p-8 text-center text-on-surface-variant/40 text-xs font-medium tracking-widest uppercase">
      Digital Cockpit Protocol v2.6 // Session Concluded
    </footer>
  `;
}
