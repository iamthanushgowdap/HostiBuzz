import { supabase } from '../config/supabase.js';
import { renderNavbar, bindNavbarEvents, bindCreepyEyes } from '../components/navbar.js';

export async function renderEvents(container) {
  // Fetch all events
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<div class="p-10 text-destructive">Error loading events: ${error.message}</div>`;
    return;
  }

  // Categorization
  const now = new Date();
  const liveEvents = events.filter(e => e.status === 'active');
  const upcomingEvents = events.filter(e => e.status === 'draft' || (e.event_date && new Date(e.event_date) > now && e.status !== 'completed'));
  const pastEvents = events.filter(e => e.status === 'completed' || (e.event_date && new Date(e.event_date) < now));

  container.innerHTML = `
    ${renderNavbar({ activeLink: 'events' })}
    <main class="min-h-screen pt-24 pb-20 px-6 max-w-7xl mx-auto">
      
      <!-- Header -->
      <header class="mb-16 text-center">
        <div class="flex items-center justify-center gap-2 text-primary text-xs font-headline font-bold tracking-[0.3em] uppercase mb-4">
          <span class="w-8 h-[1px] bg-primary/30"></span>
          <span>Event Protocol</span>
          <span class="w-8 h-[1px] bg-primary/30"></span>
        </div>
        <h1 class="text-5xl md:text-7xl font-headline font-bold text-white tracking-tighter mb-4">
          Central <span class="inline-block px-[0.15em] -mx-[0.15em] text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary italic">Hub</span>
        </h1>
        <p class="text-on-surface-variant max-w-2xl mx-auto text-lg">
          Browse active competitions, upcoming hackathons, and archived event sequences.
        </p>
      </header>

      <!-- Sections -->
      <div class="space-y-24">
        
        <!-- Live Section -->
        ${renderSection('Live Events', 'Competitions currently in progress or open for registration.', liveEvents, 'secondary', true)}

        <!-- Upcoming Section -->
        ${renderSection('Coming Soon', 'Upcoming technical challenges currently in preparation.', upcomingEvents, 'primary')}

        <!-- Past Section -->
        ${renderSection('Archived Circuits', 'Historical event logs and final leaderboards.', pastEvents, 'outline')}

      </div>
    </main>
  `;

  bindNavbarEvents();
  
  // Bind Creepy-Eyes for all buttons on this page
  events.forEach(event => {
    const btn = document.getElementById(`reg-btn-${event.id}`);
    if (btn) {
      const eyes = btn.querySelector('.creepy-btn__eyes');
      const pupils = btn.querySelectorAll('.creepy-btn__pupil');
      bindCreepyEyes(btn, eyes, Array.from(pupils));
    }
  });
}

function renderSection(title, subtitle, list, colorClass, highlight = false) {
  if (list.length === 0) return '';
  
  return `
    <section>
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 pb-6 border-b border-outline-variant/10">
        <div>
          <h2 class="text-3xl font-headline font-bold text-white flex items-center gap-3">
            <span class="w-3 h-3 rounded-full bg-${colorClass}${highlight ? ' animate-pulse' : ''}"></span>
            ${title}
          </h2>
          <p class="text-on-surface-variant mt-1">${subtitle}</p>
        </div>
        <div class="text-xs font-headline font-bold text-on-surface-variant/40 uppercase tracking-widest">
          ${list.length} Records Found
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        ${list.map(event => renderEventCard(event)).join('')}
      </div>
    </section>
  `;
}

function renderEventCard(event) {
  const dateStr = event.event_date ? new Date(event.event_date).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  }) : 'TBD';

  const isRegistrationOpen = event.registration_open && event.status !== 'completed';

  return `
    <div class="group bg-surface-container-low/40 rounded-3xl p-8 border border-outline-variant/10 hover:border-primary/30 transition-all duration-500 flex flex-col hover:bg-surface-container-low hover:translate-y-[-4px]">
      <div class="flex justify-between items-start mb-6">
        <div class="px-3 py-1 bg-surface-container-high rounded-full text-[10px] font-bold tracking-widest text-on-surface-variant uppercase border border-outline-variant/10">
          ${event.slug || 'Global'}
        </div>
        <div class="text-xs text-on-surface-variant flex items-center gap-1.5 font-medium">
          <span class="material-symbols-outlined text-base">calendar_today</span>
          ${dateStr}
        </div>
      </div>

      <h3 class="text-2xl font-headline font-bold text-white mb-3 group-hover:text-primary transition-colors line-clamp-1">${event.name}</h3>
      <p class="text-on-surface-variant text-sm line-clamp-3 mb-8 flex-grow leading-relaxed">${event.description || 'No detailed system logs available for this event sequence.'}</p>

      <div class="mt-auto space-y-4">
        <div class="flex items-center justify-between text-xs text-on-surface-variant/60">
          <span class="flex items-center gap-1"><span class="material-symbols-outlined text-sm">groups</span> ${event.max_teams || 'Unlimited'} Teams</span>
          <span class="flex items-center gap-1"><span class="material-symbols-outlined text-sm">person</span> Max ${event.max_team_size || 4}/Team</span>
        </div>

        ${isRegistrationOpen ? `
          <button class="creepy-btn w-full justify-center" id="reg-btn-${event.id}" onclick="location.hash='/register/${event.slug}'">
            <span class="creepy-btn__eyes">
              <span class="creepy-btn__eye"><span class="creepy-btn__pupil" id="pupil-1-${event.id}"></span></span>
              <span class="creepy-btn__eye"><span class="creepy-btn__pupil" id="pupil-2-${event.id}"></span></span>
            </span>
            <span class="creepy-btn__cover">Access Protocol</span>
          </button>
        ` : `
          <div class="w-full py-4 text-center rounded-xl bg-surface-container-high/40 text-on-surface-variant/40 font-headline font-bold text-sm uppercase tracking-widest border border-outline-variant/5">
            ${event.status === 'completed' ? 'Circuit Closed' : 'Access Restricted'}
          </div>
        `}
      </div>
    </div>
  `;
}
