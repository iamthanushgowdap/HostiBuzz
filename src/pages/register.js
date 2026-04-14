import { supabase } from '../config/supabase.js';
import { registerTeam } from '../services/auth.js';
import { renderNavbar, bindNavbarEvents } from '../components/navbar.js';

export async function renderRegister(container, params = {}) {
  // Fetch event by slug or fall back to any open event
  let event = null;
  if (params.eventSlug) {
    const { data } = await supabase.from('events').select('*').eq('slug', params.eventSlug).eq('registration_open', true).maybeSingle();
    event = data;
  }
  if (!event) {
    const { data: events } = await supabase.from('events').select('*').eq('registration_open', true);
    event = events?.[0];
  }

  if (!event) {
    container.innerHTML = `
      ${renderNavbar()}
      <main class="min-h-screen flex items-center justify-center p-6 text-center">
        <div class="glass-panel p-12 rounded-[40px] max-w-xl w-full border-error/20 bg-error/5">
          <span class="material-symbols-outlined text-6xl text-error mb-4">event_busy</span>
          <h2 class="text-3xl font-headline font-bold text-white mb-2">Registration Closed</h2>
          <p class="text-on-surface-variant">There are no events currently open for registration.</p>
          <a href="#/" class="inline-block mt-8 px-8 py-3 bg-white/5 text-white rounded-xl font-headline font-bold hover:bg-white/10 transition-all">Back to Home</a>
        </div>
      </main>
    `;
    bindNavbarEvents();
    return;
  }

  // Fetch current registered teams count
  const { count: registeredCount } = await supabase
    .from('teams')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', event.id);

  const maxTeams = event.max_teams || 0;
  const isFull = maxTeams > 0 && registeredCount >= maxTeams;
  const spotsLeft = maxTeams > 0 ? Math.max(0, maxTeams - registeredCount) : null;
  const occupancyPercent = maxTeams > 0 ? (registeredCount / maxTeams) * 100 : 0;

  // Parse registration config
  let cfg = {};
  if (event?.registration_config) {
    cfg = typeof event.registration_config === 'string'
      ? JSON.parse(event.registration_config)
      : event.registration_config;
  }
  const extraFields = Array.isArray(cfg.extra_fields) ? cfg.extra_fields : [];
  const bannerUrl = cfg.banner_url || null;
  const headline = cfg.headline || 'Join the Arena';
  const subheading = cfg.subheading || '';
  const maxTeamSize = event.max_team_size || 4;

  // Build extra field HTML
  function renderExtraField(f) {
    const baseClass = 'w-full bg-surface-container-lowest border-none rounded-2xl py-4 px-5 text-white focus:ring-2 focus:ring-secondary/40 placeholder:text-slate-600 text-sm transition-all focus:bg-surface-container-low';
    if (f.type === 'textarea') {
      return `<textarea id="ef_${f.id}" name="${f.id}" class="${baseClass} h-32 resize-none" placeholder="${f.label}${f.required ? ' *' : ''}" ${f.required ? 'required' : ''}></textarea>`;
    }
    if (f.type === 'select') {
      const opts = (f.options || []).map(o => `<option value="${o}">${o}</option>`).join('');
      return `<select id="ef_${f.id}" name="${f.id}" class="${baseClass}" ${f.required ? 'required' : ''}><option value="">Select ${f.label}...</option>${opts}</select>`;
    }
    return `<input id="ef_${f.id}" name="${f.id}" type="${f.type || 'text'}" class="${baseClass}" placeholder="${f.label}${f.required ? ' (required)' : ''}" ${f.required ? 'required' : ''} />`;
  }

  container.innerHTML = `
    ${renderNavbar()}
    <main class="min-h-[calc(100vh-76px)] flex flex-col items-center relative kinetic-bg pb-24 overflow-x-hidden">
      <!-- High-tech background elements -->
      <div class="fixed top-0 left-0 w-full h-full pointer-events-none -z-10">
        <div class="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-primary/10 blur-[150px] rounded-full animate-pulse-slow"></div>
        <div class="absolute bottom-1/4 -right-20 w-[500px] h-[500px] bg-secondary/10 blur-[150px] rounded-full animate-pulse"></div>
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] space-pattern"></div>
      </div>

      <!-- Back Button -->
      <div class="w-full max-w-3xl px-6 pt-8">
        <a href="#/events" class="inline-flex items-center gap-2 text-on-surface-variant/60 hover:text-primary transition-all group">
          <span class="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">arrow_back</span>
          <span class="text-[10px] font-headline font-bold uppercase tracking-[0.2em]">Back to Events</span>
        </a>
      </div>

      <!-- Banner Image -->
      ${bannerUrl ? `
        <div class="w-full h-48 md:h-[400px] overflow-hidden relative group">
          <img src="${bannerUrl}" class="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-1000" alt="Event Banner" />
          <div class="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0e19]/40 to-[#0a0e19]"></div>
          <div class="absolute bottom-6 lg:bottom-12 left-0 w-full px-6 flex justify-center">
             <div class="max-w-4xl w-full text-center slide-in-bottom">
               <h1 class="text-3xl lg:text-7xl font-headline font-black text-white tracking-tighter drop-shadow-2xl mb-2 lg:mb-4">${headline}</h1>
               <div class="flex items-center justify-center gap-3 lg:gap-4">
                 <span class="px-3 lg:px-4 py-1 lg:py-1.5 bg-white/10 backdrop-blur-md rounded-full text-[8px] lg:text-[10px] font-bold uppercase tracking-widest text-white border border-white/10">HostiBuzz Event</span>
                 <span class="px-3 lg:px-4 py-1 lg:py-1.5 bg-secondary/20 backdrop-blur-md rounded-full text-[8px] lg:text-[10px] font-bold uppercase tracking-widest text-secondary border border-secondary/20 uppercase tracking-widest">Reserving</span>
               </div>
             </div>
          </div>
        </div>
      ` : `
        <div class="pt-16 lg:pt-24 pb-6 lg:pb-12 px-6 text-center slide-in-bottom">
          <h1 class="text-3xl lg:text-5xl font-headline font-black text-white tracking-tighter mb-4">${headline}</h1>
          <p class="text-secondary font-headline font-bold text-[10px] lg:text-xs uppercase tracking-[0.4em]">Protocol Registration System</p>
        </div>
      `}

      <div class="w-full max-w-3xl relative z-10 px-6 ${bannerUrl ? '-mt-8' : ''}">
        
        <!-- Back Button -->
        <a href="#/events" class="inline-flex items-center gap-2 text-on-surface-variant/60 hover:text-primary transition-all mb-8 group">
          <span class="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">arrow_back</span>
          <span class="text-[10px] font-headline font-bold uppercase tracking-[0.2em]">Back to Events</span>
        </a>

        <!-- Occupancy HUD -->
        ${maxTeams > 0 ? `
          <div class="glass-panel p-5 lg:p-6 rounded-3xl mb-8 glow-accent border-secondary/20 slide-in-bottom stagger-1">
            <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
              <div>
                <p class="text-[9px] lg:text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant/60 flex items-center gap-2">
                  <span class="material-symbols-outlined text-sm">leaderboard</span>
                  Live Event Occupancy
                </p>
                <h3 class="text-xl lg:text-2xl font-headline font-black text-white mt-1">
                  ${registeredCount} <span class="text-[10px] lg:text-sm text-on-surface-variant/40">/ ${maxTeams} Slots Reserved</span>
                </h3>
              </div>
              <div class="text-left sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-end gap-2">
                ${spotsLeft <= 5 && spotsLeft > 0 ? `
                  <div class="text-error font-headline font-black text-[8px] lg:text-[10px] uppercase tracking-widest animate-pulse">Critical Availability</div>
                ` : ''}
                <div class="text-2xl lg:text-3xl font-headline font-black text-secondary tracking-tighter">${Math.round(occupancyPercent)}%</div>
              </div>
            </div>
            
            <div class="h-2.5 lg:h-3 bg-surface-container-highest rounded-full overflow-hidden p-0.5 border border-white/5">
              <div class="h-full bg-secondary rounded-full relative transition-all duration-1000 ease-out" style="width: ${occupancyPercent}%">
                <div class="absolute top-0 right-0 h-full w-8 bg-white/20 blur-md animate-shimmer"></div>
              </div>
            </div>
          </div>
        ` : ''}

        ${isFull ? `
          <div class="glass-panel p-12 rounded-[40px] text-center border-error/30 bg-error/10 slide-in-bottom stagger-2">
            <span class="material-symbols-outlined text-6xl text-error mb-6 bounce-in">lock_person</span>
            <h2 class="text-4xl font-headline font-black text-white mb-4">Registration Full</h2>
            <p class="text-on-surface-variant mb-8 max-w-md mx-auto">This event has reached its maximum capacity of <b>${maxTeams} teams</b>. Please contact the organizers if you believe this is an error or to join the waiting list.</p>
            <button onclick="window.history.back()" class="px-10 py-4 bg-white/5 text-white rounded-2xl font-headline font-bold hover:bg-white/10 transition-all border border-white/10 uppercase text-xs tracking-widest">Return</button>
          </div>
        ` : `
          <!-- Registration Form -->
          <form id="reg-form" class="space-y-8 slide-in-bottom stagger-2">
            <div id="reg-error" class="hidden glass-panel border-error/40 bg-error/10 text-error px-6 py-4 rounded-2xl text-sm font-bold flex items-center gap-3 slide-in-bottom">
              <span class="material-symbols-outlined shrink-0">report</span>
              <span id="error-text"></span>
            </div>

            <!-- Section 1: Identity -->
            <div class="glass-panel p-5 lg:p-8 rounded-3xl space-y-6 lg:space-y-8 border-white/5 hover:border-white/10 transition-colors">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 lg:w-12 lg:h-12 bg-primary/10 rounded-xl lg:rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <span class="material-symbols-outlined text-xl">badge</span>
                </div>
                <div>
                  <h3 class="text-lg lg:text-xl font-headline font-bold text-white">Team Identity</h3>
                  <p class="text-[9px] lg:text-[10px] text-on-surface-variant uppercase tracking-widest leading-none">Base credentials</p>
                </div>
              </div>

              <div class="space-y-6">
                <div class="space-y-2 group">
                  <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant group-focus-within:text-primary transition-colors pl-1">Team Designation *</label>
                  <div class="relative">
                    <span class="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-primary transition-colors pointer-events-none">groups</span>
                    <input id="reg-team-name" class="w-full bg-surface-container-lowest border-none rounded-2xl py-5 pl-14 pr-5 text-lg text-white font-headline focus:ring-2 focus:ring-primary/40 placeholder:text-slate-700 transition-all shadow-inner" placeholder="Neural Paradox" required />
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div class="space-y-2 group">
                    <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant group-focus-within:text-secondary transition-colors pl-1">Primary Email</label>
                    <div class="relative">
                      <span class="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-secondary transition-colors pointer-events-none">alternate_email</span>
                      <input id="reg-email" type="email" class="w-full bg-surface-container-lowest border-none rounded-2xl py-4 pl-14 pr-5 text-white focus:ring-2 focus:ring-secondary/40 placeholder:text-slate-700 transition-all shadow-inner" placeholder="leader@team.com" />
                    </div>
                  </div>
                  <div class="space-y-2 group">
                    <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant group-focus-within:text-secondary transition-colors pl-1">Secure Contact</label>
                    <div class="relative">
                      <span class="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-secondary transition-colors pointer-events-none">smartphone</span>
                      <input id="reg-phone" class="w-full bg-surface-container-lowest border-none rounded-2xl py-4 pl-14 pr-5 text-white focus:ring-2 focus:ring-secondary/40 placeholder:text-slate-700 transition-all shadow-inner" placeholder="+91 XXXX XXXX" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Section 2: Command Structure (Members) -->
            <div class="glass-panel p-6 lg:p-8 rounded-[40px] space-y-6 lg:space-y-8 border-white/5 hover:border-white/10 transition-colors">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                  <div class="w-10 h-10 lg:w-12 lg:h-12 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary">
                    <span class="material-symbols-outlined text-xl lg:text-2xl">diversity_3</span>
                  </div>
                  <div>
                    <h3 class="text-lg lg:text-xl font-headline font-bold text-white">Personnel Manifest</h3>
                    <p class="text-[9px] lg:text-[10px] text-on-surface-variant uppercase tracking-widest">Max ${maxTeamSize} Units</p>
                  </div>
                </div>
                <div class="px-3 py-1 bg-surface-container-low rounded-lg border border-white/10">
                  <div id="member-ratio" class="text-[10px] lg:text-xs font-headline font-black text-secondary">${1} / ${maxTeamSize}</div>
                </div>
              </div>

              <div id="members-container" class="space-y-4">
                <div class="flex flex-col lg:flex-row gap-4 p-5 bg-surface-container-lowest/50 rounded-3xl border border-white/5 relative overflow-hidden group/row ml-0">
                   <div class="absolute left-0 top-0 w-1 h-full bg-secondary opacity-20"></div>
                   <div class="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div class="relative flex-1">
                        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant/40 pointer-events-none">stars</span>
                        <input class="member-name w-full bg-surface-container border-none rounded-xl py-3 pl-12 pr-4 text-white text-sm focus:ring-1 focus:ring-secondary/40 placeholder:text-slate-600 font-headline" placeholder="Team Leader Name" required />
                      </div>
                      <div class="flex items-center px-4 py-3 bg-secondary/10 rounded-xl border border-secondary/20">
                         <span class="text-[9px] lg:text-[10px] font-black text-secondary uppercase tracking-[0.2em] w-full text-center">PROTOCOL: LEADER</span>
                         <input type="hidden" class="member-role" value="Leader" />
                      </div>
                   </div>
                </div>
                
                <div id="additional-members" class="space-y-4"></div>

                <button type="button" id="add-member-btn" class="w-full py-5 rounded-2xl border border-dashed border-white/10 text-on-surface-variant hover:border-secondary/40 hover:text-secondary hover:bg-secondary/5 font-headline font-black text-[9px] lg:text-[10px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3">
                  <span class="material-symbols-outlined text-sm lg:text-lg">person_add</span> Enlist New Unit
                </button>
                <div id="limit-msg" class="hidden text-center text-[9px] lg:text-[10px] text-on-surface-variant/40 uppercase font-black tracking-widest py-3 bg-surface-container-low/30 rounded-xl">Manifest Capacity Reached</div>
              </div>
            </div>

            <!-- Section 3: Extra Intel -->
            ${extraFields.length > 0 ? `
              <div class="glass-panel p-8 rounded-[40px] space-y-8 border-white/5 hover:border-white/10 transition-colors">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 bg-tertiary/10 rounded-2xl flex items-center justify-center text-tertiary">
                    <span class="material-symbols-outlined">genetics</span>
                  </div>
                  <div>
                    <h3 class="text-xl font-headline font-bold text-white">Event Intelligence</h3>
                    <p class="text-[10px] text-on-surface-variant uppercase tracking-widest">Custom parameters for ${event.name}</p>
                  </div>
                </div>

                <div class="space-y-6">
                  ${extraFields.map(f => `
                    <div class="space-y-2 group">
                      <label class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant group-focus-within:text-tertiary transition-colors pl-1">${f.label}${f.required ? ' *' : ''}</label>
                      <div class="relative">
                        ${renderExtraField(f)}
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <button id="reg-submit" type="submit" class="kinetic-gradient w-full py-5 rounded-2xl font-headline font-black text-on-primary-fixed text-lg flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_20px_60px_rgba(167,165,255,0.3)] group">
              <span class="uppercase tracking-[0.3em]">Initialize Team</span>
              <span class="material-symbols-outlined text-2xl group-hover:translate-x-1 transition-transform">bolt</span>
            </button>
            <p class="text-center text-[10px] text-on-surface-variant/40 uppercase tracking-[0.4em] pt-4 italic">Encrypted Secure Tunnel · HostiBuzz Infrastructure</p>
          </form>
        `}
      </div>
      <!-- Success HUD (Hidden by default) -->
      <div id="reg-success" class="hidden fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-6 bg-[#0a0e19]/95 backdrop-blur-2xl transition-all duration-500">
        <div class="glass-panel p-8 lg:p-12 rounded-[50px] max-w-xl w-full text-center space-y-6 lg:space-y-8 glow-accent border-secondary/20 shadow-2xl relative overflow-hidden">
          <div class="absolute -top-24 -left-24 w-64 h-64 bg-secondary/10 blur-[100px] rounded-full"></div>
          
          <div class="relative z-10 scale-in">
            <div class="w-20 h-20 lg:w-24 lg:h-24 bg-gradient-to-tr from-secondary to-primary rounded-[32px] flex items-center justify-center mx-auto mb-6 lg:mb-8 rotate-12 shadow-xl">
              <span class="material-symbols-outlined text-4xl lg:text-5xl text-white">verified</span>
            </div>
            <h2 class="text-3xl lg:text-5xl font-headline font-black text-white mb-2 tracking-tighter">Unit Authorized</h2>
            <p class="text-sm lg:text-lg text-on-surface-variant leading-relaxed">System synchronization complete. Maintain node designation keys:</p>
            
            <div class="bg-surface-container-lowest/50 p-6 lg:p-8 rounded-[32px] lg:rounded-[40px] space-y-4 lg:space-y-8 border border-white/5 my-6 lg:my-10 shadow-inner">
              <div class="space-y-2">
                <span class="text-[9px] lg:text-[10px] font-black tracking-[0.4em] text-on-surface-variant uppercase">Designation ID</span>
                <div id="result-team-id" class="text-3xl lg:text-4xl font-headline font-black text-primary tracking-widest animate-glow"></div>
              </div>
              <div class="text-[8px] lg:text-[9px] text-error font-bold uppercase tracking-widest mt-4">⚠️ Use this key for terminal authentication</div>
            </div>
            
            <button onclick="window.location.hash='#/login'" class="w-full kinetic-gradient py-4 lg:py-5 rounded-3xl font-headline font-black text-on-primary-fixed text-xs lg:text-sm uppercase tracking-widest hover:scale-[1.05] transition-transform">
              Enter Operations
            </button>
          </div>
        </div>
      </div>
div>
    </main>
  `;

  bindNavbarEvents();

  if (isFull) return;

  const membersContainer = document.getElementById('additional-members');
  const addBtn = document.getElementById('add-member-btn');
  const limitMsg = document.getElementById('limit-msg');
  const ratioEl = document.getElementById('member-ratio');

  function updateMemberState() {
    const currentCount = document.querySelectorAll('.member-name').length;
    ratioEl.textContent = `${currentCount} / ${maxTeamSize}`;
    
    if (currentCount >= maxTeamSize) {
      addBtn.classList.add('hidden');
      limitMsg.classList.remove('hidden');
    } else {
      addBtn.classList.remove('hidden');
      limitMsg.classList.add('hidden');
    }
  }

  addBtn?.addEventListener('click', () => {
    const currentCount = document.querySelectorAll('.member-name').length;
    if (currentCount >= maxTeamSize) return;

    const div = document.createElement('div');
    div.className = 'flex flex-col md:flex-row gap-4 p-5 bg-surface-container-lowest/50 rounded-3xl border border-white/5 relative group/row slide-in-bottom';
    div.innerHTML = `
      <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="relative flex-1">
          <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant/40 pointer-events-none">person</span>
          <input class="member-name w-full bg-surface-container border-none rounded-xl py-3 pl-12 pr-4 text-white text-sm focus:ring-1 focus:ring-secondary/40 placeholder:text-slate-600 font-headline" placeholder="Unit Member Name" required />
        </div>
        <div class="flex gap-2">
          <select class="member-role flex-1 bg-surface-container border-none rounded-xl py-3 px-4 text-white text-sm focus:ring-1 focus:ring-secondary/40">
            <option value="Member">Tactical Member</option>
            <option value="Leader">Co-Leader</option>
          </select>
          <button type="button" class="remove-member-btn w-12 h-11 rounded-xl bg-error/10 text-error flex items-center justify-center hover:bg-error/20 active:scale-90 transition-all shrink-0">
            <span class="material-symbols-outlined text-sm">person_remove</span>
          </button>
        </div>
      </div>
    `;
    membersContainer.appendChild(div);
    
    div.querySelector('.remove-member-btn').addEventListener('click', () => {
      div.remove();
      updateMemberState();
    });
    
    updateMemberState();
  });

  const regForm = document.getElementById('reg-form');
  regForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('reg-error');
    const errorText = document.getElementById('error-text');
    const btn = document.getElementById('reg-submit');

    const teamName = document.getElementById('reg-team-name').value.trim();
    const memberNames = document.querySelectorAll('.member-name');
    const memberRoles = document.querySelectorAll('.member-role');
    const members = [];

    memberNames.forEach((input, i) => {
      if (input.value.trim()) {
        members.push({ name: input.value.trim(), role: memberRoles[i].value });
      }
    });

    if (members.length > maxTeamSize) {
       errorText.textContent = `Security Violation: Maximum ${maxTeamSize} members allowed.`;
       errorEl.classList.remove('hidden');
       return;
    }

    // Collect custom field values
    const extraData = {};
    for (const f of extraFields) {
      const el = document.getElementById(`ef_${f.id}`);
      if (el) {
        const val = el.value?.trim();
        if (f.required && !val) {
          errorText.textContent = `Input Required: "${f.label}" field is empty.`;
          errorEl.classList.remove('hidden');
          return;
        }
        extraData[f.label] = val;
      }
    }

    errorEl.classList.add('hidden');
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin mr-3">progress_activity</span> Syncing Node...';
    btn.disabled = true;
    btn.classList.add('opacity-80', 'cursor-not-allowed');

    try {
      const result = await registerTeam({
        teamName,
        members,
        contactEmail: document.getElementById('reg-email').value.trim(),
        contactPhone: document.getElementById('reg-phone').value.trim(),
        eventId: event.id,
        extraData
      });

      document.getElementById('result-team-id').textContent = result.team_id;
      
      // Animations for success
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        document.getElementById('reg-success').classList.replace('hidden', 'flex');
      }, 500);
      
    } catch (err) {
      errorText.textContent = err.message || 'Node Synchronization Failure';
      errorEl.classList.remove('hidden');
      btn.innerHTML = '<span class="uppercase tracking-[0.3em]">Initialize Team</span><span class="material-symbols-outlined text-3xl">bolt</span>';
      btn.disabled = false;
      btn.classList.remove('opacity-80', 'cursor-not-allowed');
    }
  });
}
