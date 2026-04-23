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
    <main class="flex-grow flex items-center justify-center relative p-6 min-h-screen bg-background">
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]"></div>
        <div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-error/5 rounded-full blur-[150px]"></div>
      </div>
      <div class="max-w-4xl w-full relative z-10 px-6">
        <div class="text-center space-y-8 lg:space-y-12">
          <div class="flex items-center justify-center space-x-2 mb-8">
            <span class="text-on-surface font-headline font-black text-xl tracking-tighter opacity-20">HostiBuzz</span>
          </div>
          <div class="space-y-4">
            <p class="text-on-surface-variant font-headline tracking-[0.3em] text-[10px] lg:text-sm font-bold uppercase">TERMINATION NOTICE</p>
            <h1 class="text-5xl md:text-9xl font-headline font-black tracking-tighter text-on-surface uppercase opacity-90">ELIMINATED</h1>
            <div class="w-32 h-1 bg-gradient-to-r from-transparent via-error/30 to-transparent mx-auto mt-6"></div>
          </div>
          <div class="glass-panel p-6 md:p-12 rounded-[40px] shadow-2xl space-y-4 lg:space-y-6 border border-primary/5 bg-white/50">
            <h2 class="text-xl md:text-4xl font-headline font-black text-on-surface">${user.team_name}, your journey ends here.</h2>
            <p class="text-on-surface-variant leading-relaxed text-sm lg:text-lg max-w-lg mx-auto font-medium">
              While your active participation has concluded, your contributions remain part of the project's history. Thank you for pushing the boundaries in the arena.
            </p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto mt-12">
            <div class="bg-surface-container-low p-6 rounded-2xl text-left hover:bg-surface-container transition-all border border-primary/5 shadow-sm">
              <span class="text-[10px] text-primary font-black uppercase tracking-widest block mb-1">FINAL RANK</span>
              <span class="text-3xl font-headline font-black text-on-surface">#${rank}</span>
            </div>
            <div class="bg-surface-container-low p-6 rounded-2xl text-left hover:bg-surface-container transition-all border border-primary/5 shadow-sm">
              <span class="text-[10px] text-primary font-black uppercase tracking-widest block mb-1">TOTAL SCORE</span>
              <span class="text-3xl font-headline font-black text-on-surface">${myScore}</span>
            </div>
            <div class="bg-surface-container-low p-6 rounded-2xl text-left hover:bg-surface-container transition-all border border-primary/5 shadow-sm">
              <span class="text-[10px] text-primary font-black uppercase tracking-widest block mb-1">TEAM ID</span>
              <span class="text-3xl font-headline font-black text-on-surface font-mono tracking-tighter">${user.team_id}</span>
            </div>
          </div>
          <div class="flex flex-col md:flex-row items-center justify-center gap-6 mt-12">
            <a href="#/leaderboard" class="group flex items-center justify-center gap-3 px-10 py-5 kinetic-gradient rounded-[2rem] text-on-primary-fixed font-headline font-black uppercase text-xs tracking-widest transition-all hover:scale-105 active:scale-95 shadow-lg">
              <span class="material-symbols-outlined text-lg">leaderboard</span>
              <span>View Leaderboard</span>
            </a>
            <a href="#/" class="group flex items-center justify-center gap-3 px-10 py-5 bg-surface-container-high rounded-[2rem] text-on-surface font-headline font-black uppercase text-xs tracking-widest transition-all hover:bg-surface-container-highest active:scale-95 border border-primary/10">
              <span class="material-symbols-outlined text-lg">home</span>
              <span>Back to Home</span>
            </a>
          </div>
        </div>
      </div>
    </main>
    <footer class="p-8 text-center text-on-surface-variant/20 text-[10px] font-black tracking-widest uppercase">
      Tactical Intelligence Protocol v2.6 // Session Sync Terminated
    </footer>

  `;
}
