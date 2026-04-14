import { supabase } from '../config/supabase.js';
import { renderNavbar, bindNavbarEvents, bindCreepyEyes } from '../components/navbar.js';

/* ── Creepy-Eye button HTML ─────────────────────────────
   Used for hero button and the navbar button.
────────────────────────────────────────────────────────── */
function creepyBtn({ id, eyesId, p1Id, p2Id, label, icon = '', onClick = '' }) {
  return `
    <button class="creepy-btn" id="${id}" ${onClick ? `onclick="${onClick}"` : ''}>
      <span class="creepy-btn__eyes" id="${eyesId}">
        <span class="creepy-btn__eye"><span class="creepy-btn__pupil" id="${p1Id}"></span></span>
        <span class="creepy-btn__eye"><span class="creepy-btn__pupil" id="${p2Id}"></span></span>
      </span>
      <span class="creepy-btn__cover">
        ${label}${icon ? `<span class="material-symbols-outlined" style="font-size:18px">${icon}</span>` : ''}
      </span>
    </button>
  `;
}

export async function renderLanding(container) {
  // Fetch stats only (events collection removed from landing)
  const [{ count: teamCount }, { count: eventCount }] = await Promise.all([
    supabase.from('teams').select('*', { count: 'exact', head: true }),
    supabase.from('events').select('*', { count: 'exact', head: true })
  ]);

  container.innerHTML = `
    ${renderNavbar({ activeLink: 'events' })}
    <main class="relative overflow-hidden">

      <!-- Ambient Glows -->
      <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[150px] rounded-full pointer-events-none"></div>
      <div class="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-secondary/10 blur-[150px] rounded-full pointer-events-none"></div>

      <!-- Hero Section -->
      <section class="min-h-[85vh] flex flex-col items-center justify-start pt-6 text-center px-6 relative">
        <div class="space-y-2 mb-6 mt-2">
          <div class="flex items-center justify-center gap-3 text-primary text-sm font-headline tracking-[0.2em] uppercase">
            <span class="material-symbols-outlined text-sm">rocket_launch</span>
            <span>Open Source Platform for Hosting Technical Events</span>
          </div>
        </div>
        <h1 class="text-6xl md:text-8xl lg:text-9xl font-headline font-bold tracking-tighter text-white mb-8 max-w-5xl leading-[0.9]">
          The Future of <span class="inline-block px-[0.15em] -mx-[0.15em] text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary italic">Technical</span> Events
        </h1>
        <div class="max-w-3xl mb-12 space-y-6 mx-auto">
          <p class="text-xl md:text-2xl text-on-surface font-headline font-bold tracking-tight">
            Create, manage, and run multi-round competitions with complete control.
          </p>
          <p class="text-lg text-on-surface-variant leading-relaxed">
            From registration to final leaderboard -> everything in one system.
          </p>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8 pt-4 max-w-2xl mx-auto text-left">
            <div class="flex items-center gap-2 text-on-surface-variant font-medium">
              <span class="material-symbols-outlined text-primary text-xl">check_circle</span>
              Modular round system
            </div>
            <div class="flex items-center gap-2 text-on-surface-variant font-medium">
              <span class="material-symbols-outlined text-primary text-xl">check_circle</span>
              Real-time leaderboard
            </div>
            <div class="flex items-center gap-2 text-on-surface-variant font-medium">
              <span class="material-symbols-outlined text-primary text-xl">check_circle</span>
              Manual + AI-assisted evaluation
            </div>
            <div class="flex items-center gap-2 text-on-surface-variant font-medium">
              <span class="material-symbols-outlined text-primary text-xl">check_circle</span>
              Fully customizable & open-source
            </div>
            <div class="flex items-center gap-2 text-on-surface-variant font-medium">
              <span class="material-symbols-outlined text-primary text-xl">check_circle</span>
              Makes platform feel alive
            </div>
            <div class="flex items-center gap-2 text-on-surface-variant font-medium">
              <span class="material-symbols-outlined text-primary text-xl">check_circle</span>
              Prevents mistakes & issues
            </div>
          </div>
        </div>

        <!-- CTA Buttons -->
        <div class="flex flex-col sm:flex-row gap-4 mb-16">
          ${creepyBtn({ 
            id: 'hero-register-btn', 
            eyesId: 'hero-creepy-eyes', 
            p1Id: 'hero-pupil-1', 
            p2Id: 'hero-pupil-2', 
            label: 'Register Team', 
            icon: 'arrow_forward',
            onClick: "location.hash='#/events'"
          })}
          <a href="#/login" class="px-8 py-4 rounded-xl bg-surface-container-high/80 border border-outline-variant/20 text-white font-headline font-bold text-lg hover:bg-surface-container-highest transition-colors flex items-center gap-2">
            Team Login
          </a>
        </div>

        <!-- Live Stats -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full">
          <div class="bg-surface-container-low/60 rounded-2xl p-6 text-left border-l-2 border-primary/30 hover:bg-surface-container transition-colors">
            <span class="text-xs font-headline font-bold tracking-widest text-on-surface-variant uppercase">Teams Registered</span>
            <div class="text-3xl font-headline font-black text-white mt-2">${teamCount || 0}</div>
          </div>
          <div class="bg-surface-container-low/60 rounded-2xl p-6 text-left border-l-2 border-secondary/30 hover:bg-surface-container transition-colors">
            <span class="text-xs font-headline font-bold tracking-widest text-on-surface-variant uppercase">Events Created</span>
            <div class="text-3xl font-headline font-black text-white mt-2">${eventCount || 0}</div>
          </div>
          <div class="bg-surface-container-low/60 rounded-2xl p-6 text-left border-l-2 border-tertiary/30 hover:bg-surface-container transition-colors">
            <span class="text-xs font-headline font-bold tracking-widest text-on-surface-variant uppercase">Platform Status</span>
            <div class="text-3xl font-headline font-black text-white mt-2 flex items-center gap-2">
              <span class="w-2.5 h-2.5 bg-secondary rounded-full animate-pulse"></span> Tactical
            </div>
          </div>
        </div>
      </section>

      <!-- Platform Features -->
      <section class="max-w-7xl mx-auto px-6 py-24 border-t border-outline-variant/5">
        <div class="text-left mb-16 max-w-3xl">
          <div class="text-primary text-xs font-headline font-bold tracking-[0.4em] uppercase mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-base">settings</span>
            Platform Features
          </div>
          <h2 class="text-4xl md:text-6xl font-headline font-bold tracking-tighter text-white">
            Built for Complete <span class="italic text-secondary">Event Control</span>
          </h2>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          ${[
            { icon: 'psychology',   title: 'Modular Round Engine', desc: 'Select and configure different round types for your event.' },
            { icon: 'bar_chart',    title: 'Real-Time Leaderboard', desc: 'Live scoring with ranking based on performance and timing.' },
            { icon: 'shield',       title: 'Anti-Cheat System',    desc: 'Tab switch detection, activity tracking, and secure submissions.' },
            { icon: 'input',        title: 'Export & Evaluation',  desc: 'Download submissions and evaluate using AI or manual scoring.' },
            { icon: 'description',  title: 'PDF Backup System',    desc: 'Generate printable question sets for offline fallback.' },
            { icon: 'notifications_active', title: 'Real-Time Notifications', desc: 'Submission success, Round started, Eliminated / Qualified.' },
            { icon: 'visibility', title: 'Round Preview Mode', desc: 'Admin Only: Preview exactly what users will see before starting a round.' },
          ].map(f => `
            <div class="bg-surface-container-low/40 rounded-3xl p-8 border border-outline-variant/10 hover:border-primary/20 transition-all">
              <span class="material-symbols-outlined text-4xl text-primary mb-6">${f.icon}</span>
              <h3 class="text-2xl font-headline font-bold text-white mb-3">${f.title}</h3>
              <p class="text-on-surface-variant leading-relaxed">${f.desc}</p>
            </div>
          `).join('')}
        </div>
      </section>

    </main>
  `;

  bindNavbarEvents();

  // Bind Creepy-Eye tracking on hero button
  const heroBtn = document.getElementById('hero-register-btn');
  if (heroBtn) {
    const heroEyes = document.getElementById('hero-creepy-eyes');
    const heroPupils = [document.getElementById('hero-pupil-1'), document.getElementById('hero-pupil-2')];
    bindCreepyEyes(heroBtn, heroEyes, heroPupils);
  }
}
