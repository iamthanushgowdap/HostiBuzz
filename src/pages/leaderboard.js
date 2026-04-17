import { supabase } from '../config/supabase.js';
import { renderNavbar, bindNavbarEvents } from '../components/navbar.js';

import { getState } from '../services/state.js';

let selectedLeaderboardEvent = 'all';

export async function renderLeaderboard(container) {
  const user = getState('user');
  
  // If user is a team, force their event ID
  if (user && user.role !== 'admin' && user.event_id) {
    selectedLeaderboardEvent = user.event_id;
  }

  // Fetch data
  const { data: events } = await supabase.from('events').select('id, name').order('created_at', { ascending: false });
  const { data: teams } = await supabase.from('teams').select('id, team_id, team_name, status, members, event_id');
  const { data: allScores } = await supabase.from('scores').select('team_id, score, round_id, time_taken_ms, rounds(round_number, title)');
  const { data: submissions } = await supabase.from('submissions').select('team_id, round_id, submission_time, time_taken_ms');

  // Filter teams based on selected event
  const targetTeams = selectedLeaderboardEvent === 'all' 
    ? (teams || []) 
    : (teams || []).filter(t => t.event_id === selectedLeaderboardEvent);

  // Calculate total scores & earliest submission
  const teamScores = targetTeams.map(t => {
    const tScores = (allScores || []).filter(s => s.team_id === t.id);
    const total = tScores.reduce((sum, s) => sum + Number(s.score), 0);
    
    const roundScores = tScores.map(s => {
      // Prioritize time_taken_ms from score table, fallback to submission table
      const sub = (submissions || []).find(sub => sub.team_id === t.id && sub.round_id === s.round_id);
      const timeMs = s.time_taken_ms || sub?.time_taken_ms || 0;
      
      return { 
        round: s.rounds?.round_number, 
        score: s.score, 
        title: s.rounds?.title,
        timeTaken: timeMs > 0 ? (timeMs / 1000).toFixed(2) + 's' : '--',
        rawTimeTaken: timeMs
      };
    }).sort((a, b) => a.round - b.round);

    // Total Time taken = Sum of relative performance duration
    const totalTimeTaken = roundScores.reduce((sum, rs) => sum + rs.rawTimeTaken, 0);
    const eventName = (events || []).find(e => e.id === t.event_id)?.name || 'Unknown Event';
    
    return { ...t, total, roundScores, totalTimeTaken, eventName };
  });

  // Sort by score DESC, then by Total Time Taken ASC (faster is better)
  teamScores.sort((a, b) => b.total - a.total || (a.totalTimeTaken - b.totalTimeTaken));

  const top3 = teamScores.slice(0, 3);
  const rest = teamScores.slice(3);

  const medals = ['#FFD700', '#C0C0C0', '#CD7F32'];
  const medalLabels = ['WINNER', 'SILVER', 'BRONZE'];

  const eventTitle = selectedLeaderboardEvent === 'all' 
    ? 'Platform <span class="text-primary italic">Masters</span>' 
    : `${(events || []).find(e => e.id === selectedLeaderboardEvent)?.name || 'Event'} <span class="text-primary italic">Leaderboard</span>`;

  container.innerHTML = `
    ${renderNavbar({ activeLink: 'leaderboard', hideMobileMenu: true })}
    <main class="min-h-[calc(100vh-76px)] p-6 lg:p-12 max-w-6xl mx-auto relative">
      <!-- Back Button -->
      <a href="#/" class="inline-flex items-center gap-2 text-on-surface-variant/60 hover:text-primary transition-all mb-8 group">
        <span class="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">arrow_back</span>
        <span class="text-[10px] font-headline font-bold uppercase tracking-[0.2em]">Back to Project Hub</span>
      </a>

      <div class="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[150px] rounded-full z-[-1]"></div>
      <div class="fixed bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-secondary/10 blur-[150px] rounded-full z-[-1]"></div>

      <header class="mb-10 lg:mb-16">
        <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-6 lg:gap-8">
          <div>
            <h1 class="text-4xl lg:text-6xl font-bold font-headline tracking-tighter text-on-surface">${eventTitle}</h1>
            <p class="text-on-surface-variant max-w-xl text-sm lg:text-lg mt-2 lg:mt-4">Real-time performance metrics updated live in the arena.</p>
          </div>
          
          ${(!user || user.role === 'admin') ? `
            <div class="glass-panel p-2 rounded-2xl flex items-center min-w-[250px] bg-secondary/5 border border-primary/10">
              <span class="material-symbols-outlined text-on-surface-variant ml-3 mr-2 text-sm">filter_list</span>
              <select id="lb-event-filter" class="w-full bg-transparent border-none text-on-surface font-headline text-sm py-2 px-2 focus:ring-0 cursor-pointer outline-none shadow-none">
                <option value="all" class="bg-surface-container" ${selectedLeaderboardEvent === 'all' ? 'selected' : ''}>All Events (Overall)</option>
                ${(events || []).map(e => `
                  <option value="${e.id}" class="bg-surface-container" ${selectedLeaderboardEvent === e.id ? 'selected' : ''}>${e.name}</option>
                `).join('')}
              </select>
            </div>
          ` : ''}
        </div>
      </header>

      <!-- Top 3 Podium (Always Horizontal) -->
      ${top3.length >= 3 ? `
        <section class="grid grid-cols-3 gap-2 lg:gap-8 mb-12 lg:mb-20 items-end px-1">
          ${[1, 0, 2].map(idx => {
            const t = top3[idx];
            if (!t) return '';
            const isFirst = idx === 0;
            const color = medals[idx];
            return `
              <div class="relative group ${isFirst ? 'scale-100 lg:scale-105 z-10 order-2' : idx === 1 ? 'order-1 translate-y-4' : 'order-3 translate-y-6'}">
                <div class="glass-panel ${isFirst ? 'p-2 py-6 lg:p-10 rounded-xl lg:rounded-[3rem]' : 'p-2 py-4 lg:p-8 rounded-xl lg:rounded-[2.5rem]'} flex flex-col items-center text-center relative border border-primary/10 shadow-sm bg-surface-container-lowest">
                  <div class="absolute -top-${isFirst ? '6 lg:10' : '4 lg:8'} left-1/2 -translate-x-1/2">
                    <div class="w-8 h-8 lg:w-20 lg:h-20 bg-surface-container rounded-full flex items-center justify-center border-${isFirst ? '2 lg:4' : '1 lg:2'} glow-accent" style="border-color: ${color}">
                      <span class="text-[10px] lg:text-3xl font-bold font-headline" style="color: ${color}">${idx + 1}</span>
                    </div>
                  </div>
                  <div class="w-8 h-8 lg:w-16 lg:h-16 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mt-4 lg:mt-6 mb-2 lg:mb-4 border border-primary/5">
                    <span class="material-symbols-outlined text-lg lg:text-3xl text-on-surface">groups</span>
                  </div>
                  <h3 class="text-[10px] lg:text-3xl font-bold font-headline text-on-surface mb-0.5 lg:mb-1 truncate w-full px-1">${t.team_name}</h3>
                  <p class="hidden lg:block text-on-surface-variant text-sm mb-6">${t.team_id} ${selectedLeaderboardEvent === 'all' ? `• <span class="text-secondary">${t.eventName}</span>` : ''}</p>
                  <div class="text-xs lg:text-5xl font-black font-headline ${isFirst ? 'text-transparent bg-clip-text bg-gradient-to-br from-primary to-secondary' : ''}" style="${!isFirst ? `color: ${color}` : ''}">${t.total.toLocaleString()}</div>
                  <p class="text-[8px] lg:text-[10px] tracking-widest font-bold mt-1 uppercase" style="color: ${color}">${medalLabels[idx]}</p>
                </div>
              </div>
            `;
          }).join('')}
        </section>
      ` : teamScores.length > 0 ? `
        <div class="text-center py-12 mb-12 glass-panel rounded-3xl border border-dashed border-outline-variant/30 text-on-surface-variant">
          Not enough teams for the podium view.
        </div>
      ` : ''}

      <!-- Leaderboard Data -->
      ${teamScores.length === 0 ? `
        <div class="text-center py-20 px-6 glass-panel rounded-[2rem] border border-dashed border-outline-variant/30">
          <span class="material-symbols-outlined text-6xl text-on-surface-variant/30 mb-4 block">emoji_events</span>
          <h2 class="text-xl font-headline font-bold text-white mb-2">No Teams Found</h2>
          <p class="text-sm text-on-surface-variant">There are no teams or scores recorded for this view yet. Please check back later!</p>
        </div>
      ` : `
        <!-- DESKTOP TABLE VIEW -->
        <section class="hidden lg:block glass-panel rounded-[2rem] overflow-hidden border border-primary/10 mb-12 shadow-sm bg-surface-container-lowest">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-surface-container-high/50 text-on-surface-variant font-headline text-[10px] uppercase tracking-[0.2em]">
                <th class="px-8 py-6">Rank</th>
                <th class="px-8 py-6">Team</th>
                <th class="px-8 py-6">Round Scores</th>
                <th class="px-8 py-6 text-right">Total Score</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-primary/5">
              ${teamScores.map((t, i) => `
                <tr class="${t.status === 'eliminated' ? 'opacity-50 grayscale' : ''} hover:bg-secondary/5 transition-all group">
                  <td class="px-8 py-6">
                    <span class="text-xl font-black font-headline text-on-surface-variant group-hover:text-on-surface">#${String(i + 1).padStart(2, '0')}</span>
                  </td>
                  <td class="px-8 py-6">
                    <div>
                      <div class="text-on-surface font-bold font-headline flex items-center gap-2">
                        ${t.team_name}
                        ${t.status === 'eliminated' ? '<span class="px-2 py-0.5 rounded-sm bg-error/10 text-error text-[8px] uppercase font-black tracking-widest border border-error/10">Eliminated</span>' : ''}
                      </div>
                      <div class="text-[10px] text-on-surface-variant mt-1">${t.team_id} ${selectedLeaderboardEvent === 'all' ? `• <span class="text-secondary font-semibold">${t.eventName}</span>` : ''}</div>
                    </div>
                  </td>
                  <td class="px-8 py-6">
                    <div class="flex gap-2 flex-wrap">
                      ${t.roundScores.map(rs => `
                        <span class="px-2.5 py-1.5 bg-primary/5 text-primary text-[10px] font-black rounded-lg flex flex-col items-center border border-primary/10">
                          <span>R${rs.round}: ${rs.score}</span>
                          ${rs.timeTaken !== '--' ? `<span class="text-[8px] opacity-60 font-mono tracking-tighter mt-0.5">${rs.timeTaken}</span>` : ''}
                        </span>
                      `).join('') || '<span class="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Awaiting Pulse</span>'}
                    </div>
                  </td>
                  <td class="px-8 py-6 text-right">
                    <span class="text-2xl font-black font-headline text-on-surface">${t.total.toLocaleString()}</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </section>

        <!-- MOBILE CARD STACK VIEW -->
        <section class="lg:hidden space-y-4 mb-12 px-2">
          ${teamScores.map((t, i) => `
            <div class="${t.status === 'eliminated' ? 'opacity-60 grayscale' : ''} glass-panel p-5 rounded-3xl border border-primary/5 shadow-sm relative overflow-hidden bg-surface-container-lowest">
                <div class="flex items-center justify-between mb-4 pb-4 border-b border-primary/5">
                 <div class="flex items-center gap-3">
                   <div class="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center font-headline font-black text-primary text-lg border border-primary/5">
                      ${i + 1}
                   </div>
                   <div>
                     <h3 class="font-headline font-bold text-on-surface text-base">${t.team_name}</h3>
                     <p class="text-[9px] text-on-surface-variant uppercase tracking-[0.2em]">${t.team_id}</p>
                   </div>
                 </div>
                 <div class="text-right">
                    <div class="text-2xl font-black font-headline text-secondary tracking-tighter">${t.total.toLocaleString()}</div>
                    <div class="text-[8px] font-bold text-on-surface-variant uppercase tracking-widest">Total Pulse</div>
                 </div>
               </div>
               
               <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                  ${t.roundScores.map(rs => `
                    <div class="flex-shrink-0 bg-secondary/5 p-3 rounded-2xl border border-primary/5 text-center min-w-[70px]">
                       <div class="text-[8px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Round ${rs.round}</div>
                       <div class="text-sm font-black text-on-surface">${rs.score}</div>
                       ${rs.timeTaken !== '--' ? `<div class="text-[7px] text-primary font-mono mt-1">${rs.timeTaken}</div>` : ''}
                    </div>
                  `).join('') || '<div class="text-[9px] text-on-surface-variant font-bold italic py-2">No sequences recorded...</div>'}
               </div>
            </div>
          `).join('')}
        </section>
      `}

      <footer class="text-center text-on-surface-variant/40 text-xs tracking-widest uppercase py-8">
        Showing ${teamScores.length} teams • Auto-refreshing
      </footer>
    </main>
  `;

  bindNavbarEvents();

  document.getElementById('lb-event-filter')?.addEventListener('change', (e) => {
    selectedLeaderboardEvent = e.target.value;
    renderLeaderboard(container);
  });

  // Auto refresh every 10 seconds
  const interval = setInterval(async () => {
    if (window.location.hash !== '#/leaderboard') {
      clearInterval(interval);
      return;
    }
    // Only re-render if still on leaderboard
    await renderLeaderboard(container);
  }, 10000);
}
