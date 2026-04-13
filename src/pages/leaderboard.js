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
  const { data: allScores } = await supabase.from('scores').select('team_id, score, round_id, rounds(round_number, title)');
  const { data: submissions } = await supabase.from('submissions').select('team_id, round_id, submission_time');

  // Filter teams based on selected event
  const targetTeams = selectedLeaderboardEvent === 'all' 
    ? (teams || []) 
    : (teams || []).filter(t => t.event_id === selectedLeaderboardEvent);

  // Calculate total scores & earliest submission
  const teamScores = targetTeams.map(t => {
    const tScores = (allScores || []).filter(s => s.team_id === t.id);
    const total = tScores.reduce((sum, s) => sum + Number(s.score), 0);
    
    const roundScores = tScores.map(s => {
      const sub = (submissions || []).find(sub => sub.team_id === t.id && sub.round_id === s.round_id);
      return { 
        round: s.rounds?.round_number, 
        score: s.score, 
        title: s.rounds?.title,
        time: sub?.submission_time ? new Date(sub.submission_time).toLocaleTimeString([], { hour12: false }) : null,
        rawTime: sub?.submission_time ? new Date(sub.submission_time).getTime() : 0
      };
    }).sort((a, b) => a.round - b.round);

    // Completion Time = The maximum (latest) submission time of all scores recorded
    const completionTime = roundScores.length > 0 ? Math.max(...roundScores.map(rs => rs.rawTime)) : Infinity;
    const eventName = (events || []).find(e => e.id === t.event_id)?.name || 'Unknown Event';
    
    return { ...t, total, roundScores, completionTime, eventName };
  });

  // Sort by score DESC, then by completion time ASC (faster is better)
  teamScores.sort((a, b) => b.total - a.total || (a.completionTime - b.completionTime));

  const top3 = teamScores.slice(0, 3);
  const rest = teamScores.slice(3);

  const medals = ['#FFD700', '#C0C0C0', '#CD7F32'];
  const medalLabels = ['WINNER', 'SILVER', 'BRONZE'];

  const eventTitle = selectedLeaderboardEvent === 'all' 
    ? 'Platform <span class="text-primary italic">Masters</span>' 
    : `${(events || []).find(e => e.id === selectedLeaderboardEvent)?.name || 'Event'} <span class="text-primary italic">Leaderboard</span>`;

  container.innerHTML = `
    ${renderNavbar({ activeLink: 'leaderboard' })}
    <main class="min-h-[calc(100vh-76px)] p-6 lg:p-12 max-w-6xl mx-auto relative">
      <div class="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[150px] rounded-full z-[-1]"></div>
      <div class="fixed bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-secondary/10 blur-[150px] rounded-full z-[-1]"></div>

      <header class="mb-16">
        <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div>
            <h1 class="text-5xl lg:text-7xl font-bold font-headline tracking-tighter text-white">${eventTitle}</h1>
            <p class="text-on-surface-variant max-w-xl text-lg mt-4">Real-time performance metrics. Rankings update live as scores are submitted.</p>
          </div>
          
          ${(!user || user.role === 'admin') ? `
            <div class="glass-panel p-2 rounded-2xl flex items-center min-w-[250px]">
              <span class="material-symbols-outlined text-on-surface-variant ml-3 mr-2 text-sm">filter_list</span>
              <select id="lb-event-filter" class="w-full bg-transparent border-none text-white font-headline text-sm py-2 px-2 focus:ring-0 cursor-pointer outline-none shadow-none">
                <option value="all" class="bg-surface-container-high" ${selectedLeaderboardEvent === 'all' ? 'selected' : ''}>All Events (Overall)</option>
                ${(events || []).map(e => `
                  <option value="${e.id}" class="bg-surface-container-high" ${selectedLeaderboardEvent === e.id ? 'selected' : ''}>${e.name}</option>
                `).join('')}
              </select>
            </div>
          ` : ''}
        </div>
      </header>

      <!-- Top 3 Podium -->
      ${top3.length >= 3 ? `
        <section class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20 items-end">
          ${[1, 0, 2].map(idx => {
            const t = top3[idx];
            if (!t) return '';
            const isFirst = idx === 0;
            const color = medals[idx];
            return `
              <div class="relative group ${isFirst ? 'scale-105 z-10 order-1 md:order-2' : idx === 1 ? 'order-2 md:order-1 translate-y-4' : 'order-3 translate-y-6'}">
                <div class="glass-panel ${isFirst ? 'p-10 rounded-[3rem]' : 'p-8 rounded-[2.5rem]'} flex flex-col items-center text-center relative border border-white/10 shadow-lg">
                  <div class="absolute -top-${isFirst ? '10' : '8'} left-1/2 -translate-x-1/2">
                    <div class="w-${isFirst ? '20' : '16'} h-${isFirst ? '20' : '16'} bg-surface-container-highest rounded-full flex items-center justify-center border-${isFirst ? '4' : '2'} glow-accent" style="border-color: ${color}">
                      <span class="text-${isFirst ? '3' : '2'}xl font-bold font-headline" style="color: ${color}">${idx + 1}</span>
                    </div>
                  </div>
                  <div class="w-${isFirst ? '20' : '16'} h-${isFirst ? '20' : '16'} rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mt-6 mb-4">
                    <span class="material-symbols-outlined text-3xl text-white">groups</span>
                  </div>
                  <h3 class="text-${isFirst ? '3' : '2'}xl font-bold font-headline text-white mb-1">${t.team_name}</h3>
                  <p class="text-on-surface-variant text-sm mb-6">${t.team_id} ${selectedLeaderboardEvent === 'all' ? `• <span class="text-secondary">${t.eventName}</span>` : ''}</p>
                  <div class="text-${isFirst ? '5' : '3'}xl font-black font-headline ${isFirst ? 'text-transparent bg-clip-text bg-gradient-to-br from-primary to-secondary' : ''}" style="${!isFirst ? `color: ${color}` : ''}">${t.total.toLocaleString()}</div>
                  <p class="text-[10px] tracking-widest font-bold mt-1 uppercase" style="color: ${color}">${medalLabels[idx]}</p>
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

      <!-- Leaderboard Table -->
      ${teamScores.length === 0 ? `
        <div class="text-center py-20 px-6 glass-panel rounded-[2rem] border border-dashed border-outline-variant/30">
          <span class="material-symbols-outlined text-6xl text-on-surface-variant/30 mb-4 block">emoji_events</span>
          <h2 class="text-xl font-headline font-bold text-white mb-2">No Teams Found</h2>
          <p class="text-on-surface-variant">There are no teams or scores recorded for this view yet. Please check back later!</p>
        </div>
      ` : `
        <section class="glass-panel rounded-[2rem] overflow-hidden border border-outline-variant/10 mb-12">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-surface-container-high/50 text-on-surface-variant font-headline text-xs uppercase tracking-widest">
                <th class="px-8 py-6">Rank</th>
                <th class="px-8 py-6">Team</th>
                <th class="px-8 py-6">Round Scores</th>
                <th class="px-8 py-6 text-right">Total Score</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-variant/10">
              ${teamScores.map((t, i) => `
                <tr class="${t.status === 'eliminated' ? 'opacity-50 grayscale' : ''} hover:bg-white/5 transition-all group">
                  <td class="px-8 py-6">
                    <span class="text-xl font-bold font-headline text-on-surface-variant group-hover:text-white">#${String(i + 1).padStart(2, '0')}</span>
                  </td>
                  <td class="px-8 py-6">
                    <div>
                      <div class="text-white font-bold font-headline flex items-center gap-2">
                        ${t.team_name}
                        ${t.status === 'eliminated' ? '<span class="px-2 py-0.5 rounded-sm bg-error/20 text-error text-[10px] uppercase font-black uppercase">Eliminated</span>' : ''}
                      </div>
                      <div class="text-[10px] text-on-surface-variant mt-1">${t.team_id} ${selectedLeaderboardEvent === 'all' ? `• <span class="text-secondary">${t.eventName}</span>` : ''}</div>
                    </div>
                  </td>
                  <td class="px-8 py-6">
                    <div class="flex gap-2 flex-wrap">
                      ${t.roundScores.map(rs => `
                        <span class="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded flex flex-col items-center">
                          <span>R${rs.round}: ${rs.score}</span>
                          ${rs.time ? `<span class="text-[8px] opacity-60 font-mono tracking-tighter mt-0.5">${rs.time}</span>` : ''}
                        </span>
                      `).join('') || '<span class="text-xs text-on-surface-variant">No scores yet</span>'}
                    </div>
                  </td>
                  <td class="px-8 py-6 text-right">
                    <span class="text-xl font-bold font-headline text-white">${t.total.toLocaleString()}</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
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
