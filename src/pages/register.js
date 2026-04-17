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
      <main class="min-h-screen flex items-center justify-center p-6 text-center bg-white">
        <div class="glass-panel p-12 rounded-[40px] max-w-xl w-full border border-error/20 bg-error/5 shadow-sm">
          <span class="material-symbols-outlined text-6xl text-error mb-4">event_busy</span>
          <h2 class="text-3xl font-headline font-bold text-on-surface mb-2">Registration Closed</h2>
          <p class="text-on-surface-variant">There are no events currently open for registration.</p>
          <a href="#/" class="inline-block mt-8 px-8 py-3 bg-secondary/10 text-primary rounded-xl font-headline font-bold hover:bg-secondary/20 transition-all border border-secondary/20">Back to Home</a>
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
    const baseClass = 'w-full bg-surface-container-lowest border border-primary/5 rounded-2xl py-4 px-5 text-on-surface focus:ring-2 focus:ring-secondary/40 placeholder:text-slate-400 text-sm transition-all focus:bg-surface-container-low';
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
    <main class="min-h-[calc(100vh-76px)] flex flex-col items-center relative kinetic-bg pb-24 overflow-x-hidden bg-white">
      <!-- High-tech background elements -->
      <div class="fixed top-0 left-0 w-full h-full pointer-events-none -z-10">
        <div class="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-primary/5 blur-[150px] rounded-full animate-pulse-slow"></div>
        <div class="absolute bottom-1/4 -right-20 w-[500px] h-[500px] bg-secondary/5 blur-[150px] rounded-full animate-pulse"></div>
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] space-pattern"></div>
      </div>

      <!-- Header Content area -->
      <div class="w-full max-w-4xl px-6 pt-12 text-center slide-in-bottom">
         <div class="flex items-center justify-center gap-4 mb-4">
            <span class="h-px w-8 lg:w-16 bg-primary/20"></span>
            <p class="text-secondary font-headline font-bold text-[10px] lg:text-xs uppercase tracking-[0.4em]">Protocol Authorization Hub</p>
            <span class="h-px w-8 lg:w-16 bg-primary/20"></span>
         </div>
         <h1 class="text-4xl lg:text-7xl font-headline font-black text-on-surface tracking-tighter mb-4">${headline}</h1>
         <p class="text-on-surface-variant max-w-2xl mx-auto text-sm lg:text-lg mb-8">${subheading || 'Access the competition node by initializing your team credential below.'}</p>
      </div>

      <div class="w-full max-w-3xl relative z-10 px-6">
        
        <!-- Occupancy HUD -->
        ${maxTeams > 0 ? `
          <div class="glass-panel p-6 lg:p-10 rounded-3xl mb-12 glow-accent border border-primary/5 bg-surface-container shadow-sm slide-in-bottom stagger-1">
            <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-6">
              <div>
                <p class="text-[9px] lg:text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant/60 flex items-center gap-2 mb-2">
                  <span class="material-symbols-outlined text-sm">leaderboard</span>
                  Arena Occupancy
                </p>
                <div class="flex items-baseline gap-2">
                   <h3 class="text-4xl lg:text-6xl font-headline font-black text-on-surface tracking-tighter">
                     ${registeredCount}
                   </h3>
                   <span class="text-lg lg:text-xl text-on-surface-variant/30 font-headline font-bold tracking-widest">/ ${maxTeams} Teams</span>
                </div>
              </div>
              <div class="text-left sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-end gap-2">
                ${spotsLeft <= 5 && spotsLeft > 0 ? `
                  <div class="px-3 py-1 bg-error/10 text-error font-headline font-black text-[9px] uppercase tracking-widest rounded-lg border border-error/20 mb-2 animate-pulse">Critical Availability</div>
                ` : ''}
                <div class="text-3xl lg:text-5xl font-headline font-black text-secondary tracking-tighter tabular-nums">${Math.round(occupancyPercent)}% <span class="text-[10px] font-bold text-on-surface-variant/40 align-middle">LOAD</span></div>
              </div>
            </div>
            
            <div class="h-4 bg-secondary/5 rounded-full overflow-hidden p-1 border border-primary/10">
              <div class="h-full bg-gradient-to-r from-primary to-secondary rounded-full relative transition-all duration-1000 ease-out" style="width: ${occupancyPercent}%">
                <div class="absolute top-0 right-0 h-full w-32 bg-white/20 blur-md animate-shimmer"></div>
              </div>
            </div>
          </div>
        ` : ''}

        ${isFull ? `
          <div class="glass-panel p-12 rounded-[50px] text-center border border-error/20 bg-error/5 shadow-2xl slide-in-bottom">
            <span class="material-symbols-outlined text-7xl text-error/30 mb-8">lock_person</span>
            <h2 class="text-4xl font-headline font-black text-on-surface mb-4">Registration Full</h2>
            <p class="text-on-surface-variant mb-8 max-w-md mx-auto leading-relaxed text-lg font-medium">This event has reached its maximum capacity. Please contact the mission administrators for operational overrides.</p>
            <button onclick="window.history.back()" class="px-10 py-5 bg-secondary/10 text-primary rounded-2xl font-headline font-bold hover:bg-secondary/20 transition-all border border-secondary/20 uppercase text-xs tracking-widest">Return to Events Hub</button>
          </div>
        ` : `
          <!-- Registration Form -->
          <form id="reg-form" class="space-y-8 slide-in-bottom stagger-2 pb-20">
            <div id="reg-error" class="hidden glass-panel border-error/40 bg-error/5 text-error px-6 py-4 rounded-2xl text-sm font-bold flex items-center gap-3">
              <span class="material-symbols-outlined shrink-0">report</span>
              <span id="error-text"></span>
            </div>

            <!-- Identity Section -->
            <div class="glass-panel p-6 lg:p-12 rounded-[40px] space-y-8 lg:space-y-12 border border-primary/5 hover:border-primary/20 transition-all group bg-surface-container-low/50 shadow-sm relative overflow-hidden">
              <div class="flex items-center gap-6">
                <div class="w-12 h-12 lg:w-16 lg:h-16 bg-primary/10 rounded-3xl flex items-center justify-center text-primary border border-primary/20 group-hover:rotate-6 transition-transform">
                  <span class="material-symbols-outlined text-2xl lg:text-3xl">badge</span>
                </div>
                <div>
                  <h3 class="text-xl lg:text-3xl font-headline font-bold text-on-surface tracking-tight">Team Identity</h3>
                  <p class="text-[10px] lg:text-xs text-on-surface-variant uppercase font-bold tracking-widest mt-1 opacity-60">Base credentials for protocol entry</p>
                </div>
              </div>

              <div class="space-y-8 lg:space-y-10">
                <div class="space-y-3 group/field">
                  <label class="text-[10px] lg:text-[11px] font-black uppercase tracking-[0.2em] text-on-surface-variant/80 group-focus-within/field:text-primary transition-colors pl-1">Team Designation *</label>
                  <div class="relative">
                    <span class="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-2xl text-on-surface-variant/30 group-focus-within/field:text-primary transition-colors pointer-events-none">groups</span>
                    <input id="reg-team-name" class="w-full bg-surface-container-lowest border border-primary/5 rounded-[2rem] py-6 pl-16 pr-8 text-xl text-on-surface font-headline font-bold focus:ring-4 focus:ring-primary/5 placeholder:text-slate-300 transition-all shadow-sm" placeholder="Neural Paradox" required />
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div class="space-y-3 group/field">
                    <label class="text-[10px] lg:text-[11px] font-black uppercase tracking-[0.2em] text-on-surface-variant/80 group-focus-within/field:text-secondary transition-colors pl-1">Contact Email</label>
                    <div class="relative">
                      <span class="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-xl text-on-surface-variant/30 group-focus-within/field:text-secondary transition-colors pointer-events-none">alternate_email</span>
                      <input id="reg-email" type="email" class="w-full bg-surface-container-lowest border border-primary/5 rounded-2xl py-5 pl-16 pr-6 text-on-surface font-headline focus:ring-4 focus:ring-secondary/5 placeholder:text-slate-300 transition-all shadow-sm" placeholder="leader@domain.com" />
                    </div>
                  </div>
                  <div class="space-y-3 group/field">
                    <label class="text-[10px] lg:text-[11px] font-black uppercase tracking-[0.2em] text-on-surface-variant/80 group-focus-within/field:text-secondary transition-colors pl-1">Secure Contact</label>
                    <div class="relative">
                      <span class="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-xl text-on-surface-variant/30 group-focus-within/field:text-secondary transition-colors pointer-events-none">smartphone</span>
                      <input id="reg-phone" class="w-full bg-surface-container-lowest border border-primary/5 rounded-2xl py-5 pl-16 pr-6 text-on-surface font-headline focus:ring-4 focus:ring-secondary/5 placeholder:text-slate-300 transition-all shadow-sm" placeholder="+91 XXXX XXXX" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Personnel Manifest Section -->
            <div class="glass-panel p-6 lg:p-12 rounded-[40px] space-y-8 lg:space-y-12 border border-primary/5 hover:border-primary/20 transition-all bg-surface-container-high/30 shadow-sm relative overflow-hidden group">
               <div class="flex items-center justify-between relative z-10">
                <div class="flex items-center gap-6">
                  <div class="w-12 h-12 lg:w-16 lg:h-16 bg-secondary/10 rounded-3xl flex items-center justify-center text-secondary border border-secondary/20 group-hover:-rotate-6 transition-transform">
                    <span class="material-symbols-outlined text-2xl lg:text-3xl">diversity_3</span>
                  </div>
                  <div>
                    <h3 class="text-xl lg:text-3xl font-headline font-bold text-on-surface tracking-tight">Personnel Manifest</h3>
                    <p class="text-[10px] lg:text-xs text-on-surface-variant uppercase font-bold tracking-widest mt-1 opacity-60">System Units · Max ${maxTeamSize} Capacity</p>
                  </div>
                </div>
                <div class="px-5 py-2 bg-white rounded-2xl border border-primary/5 shadow-sm">
                  <div id="member-ratio" class="text-xs lg:text-sm font-headline font-black text-secondary tracking-widest">${1} / ${maxTeamSize}</div>
                </div>
              </div>

              <div id="members-container" class="space-y-6 relative z-10">
                <div class="flex flex-col lg:flex-row gap-6 p-6 lg:p-8 bg-white rounded-[2.5rem] border border-primary/10 shadow-sm relative overflow-hidden ml-0">
                   <div class="absolute left-0 top-0 w-1.5 h-full bg-secondary"></div>
                   <div class="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div class="relative flex-1">
                        <span class="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-2xl text-secondary pointer-events-none">stars</span>
                        <input class="member-name w-full bg-secondary/5 border-none rounded-2xl py-5 pl-16 pr-6 text-on-surface font-headline font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-secondary/20" placeholder="Commander Name" required />
                      </div>
                      <div class="flex items-center px-6 py-5 bg-secondary/10 rounded-2xl border border-secondary/10">
                         <span class="text-[10px] font-black text-secondary uppercase tracking-[0.3em] w-full text-center">PROTOCOL: LEADERSHIP</span>
                         <input type="hidden" class="member-role" value="Leader" />
                      </div>
                   </div>
                </div>
                
                <div id="additional-members" class="space-y-6"></div>

                <div class="pt-4">
                  <button type="button" id="add-member-btn" class="w-full py-6 rounded-3xl border-2 border-dashed border-primary/20 text-on-surface-variant hover:border-secondary hover:text-secondary hover:bg-secondary/5 font-headline font-black text-[11px] lg:text-xs uppercase tracking-[0.4em] transition-all flex items-center justify-center gap-4">
                    <span class="material-symbols-outlined">person_add</span> Enlist New Unit
                  </button>
                  <div id="limit-msg" class="hidden text-center text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.4em] py-6 bg-surface-container-low rounded-3xl border border-primary/5">Manifest Capacity Reached</div>
                </div>
              </div>
            </div>

            <!-- Extra Intel Section -->
            ${extraFields.length > 0 ? `
              <div class="glass-panel p-6 lg:p-12 rounded-[40px] space-y-10 lg:space-y-12 border border-primary/5 hover:border-primary/20 transition-all bg-surface-container/50 shadow-sm">
                <div class="flex items-center gap-6">
                  <div class="w-12 h-12 lg:w-16 lg:h-16 bg-primary/10 rounded-3xl flex items-center justify-center text-primary border border-primary/20">
                    <span class="material-symbols-outlined text-2xl lg:text-3xl">psychology</span>
                  </div>
                  <div>
                    <h3 class="text-xl lg:text-3xl font-headline font-bold text-on-surface tracking-tight">System Intel</h3>
                    <p class="text-[10px] lg:text-xs text-on-surface-variant uppercase font-bold tracking-widest mt-1 opacity-60">Event-Specific Data</p>
                  </div>
                </div>

                <div class="space-y-8 lg:space-y-10">
                  ${extraFields.map(f => `
                    <div class="space-y-3 group/field">
                      <label class="text-[10px] lg:text-[11px] font-black uppercase tracking-[0.2em] text-on-surface-variant/80 group-focus-within/field:text-primary transition-colors pl-1">${f.label}${f.required ? ' *' : ''}</label>
                      <div class="relative">
                        ${renderExtraField(f)}
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <div class="pt-10">
              <button id="reg-submit" type="submit" class="kinetic-gradient w-full py-6 rounded-[2.5rem] font-headline font-black text-white text-xl lg:text-2xl flex items-center justify-center gap-6 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl relative overflow-hidden group">
                <span class="uppercase tracking-[0.4em] z-10 relative">Initialize Team</span>
                <span class="material-symbols-outlined text-3xl group-hover:rotate-180 transition-transform duration-700 z-10 relative">bolt</span>
                <div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </button>
              <p class="text-center text-[10px] text-on-surface-variant/40 uppercase tracking-[0.5em] pt-8 font-bold italic">Encrypted Secure Tunnel · HostiBuzz SSL v4.2</p>
            </div>
          </form>
        `}
      </div>

      <!-- Success HUD -->
      <div id="reg-success" class="hidden fixed inset-0 z-[100] flex items-center justify-center p-6 bg-surface/90 backdrop-blur-3xl transition-all duration-700 opacity-0 scale-95 translate-y-10">
        <div class="glass-panel p-8 lg:p-16 rounded-[60px] max-w-2xl w-full text-center space-y-10 glow-accent border border-primary/20 shadow-2xl bg-white relative">
          <div class="relative z-10 space-y-10">
            <div class="w-24 h-24 lg:w-32 lg:h-32 bg-gradient-to-tr from-primary to-secondary rounded-[40px] flex items-center justify-center mx-auto mb-10 rotate-12 shadow-2xl border-4 border-white">
              <span class="material-symbols-outlined text-5xl lg:text-7xl text-white">verified</span>
            </div>
            
            <div>
              <h2 class="text-4xl lg:text-6xl font-headline font-black text-on-surface mb-4 tracking-tighter">Unit Authorized</h2>
              <p class="text-lg lg:text-xl text-on-surface-variant leading-relaxed">System synchronization complete. Maintain node designation key:</p>
            </div>
            
            <div class="bg-secondary/5 p-8 lg:p-12 rounded-[50px] space-y-6 border border-primary/10 shadow-sm relative overflow-hidden">
              <span class="text-[10px] lg:text-xs font-black tracking-[0.5em] text-secondary uppercase block mb-4">Protocol ID</span>
              <div id="result-team-id" class="text-4xl lg:text-6xl font-headline font-black text-primary tracking-[0.2em]"></div>
            </div>

            <p class="text-error font-bold uppercase tracking-widest text-xs">⚠️ Maintain this key for terminal authentication</p>
            
            <button onclick="window.location.hash='#/login'" class="w-full kinetic-gradient py-6 rounded-[3rem] font-headline font-black text-white text-lg uppercase tracking-[0.3em] hover:scale-[1.05] transition-transform shadow-xl">
              Launch Terminal
            </button>
          </div>
        </div>
      </div>
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
      addBtn.parentElement.classList.add('hidden');
      limitMsg.classList.remove('hidden');
    } else {
      addBtn.parentElement.classList.remove('hidden');
      limitMsg.classList.add('hidden');
    }
  }

  addBtn?.addEventListener('click', () => {
    const currentCount = document.querySelectorAll('.member-name').length;
    if (currentCount >= maxTeamSize) return;

    const div = document.createElement('div');
    div.className = 'flex flex-col md:flex-row gap-6 p-6 lg:p-8 bg-white rounded-[2.5rem] border border-primary/10 shadow-sm relative group/row slide-in-bottom';
    div.innerHTML = `
      <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="relative flex-1 group/field">
          <span class="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-2xl text-on-surface-variant/20 group-focus-within/field:text-primary transition-colors pointer-events-none">person</span>
          <input class="member-name w-full bg-surface-container-low/50 border-none rounded-2xl py-5 pl-16 pr-6 text-on-surface font-headline font-bold focus:ring-4 focus:ring-primary/5 placeholder:text-slate-400" placeholder="Unit Name" required />
        </div>
        <div class="flex gap-4">
          <select class="member-role flex-1 bg-surface-container-low/50 border-none rounded-2xl py-5 px-6 text-on-surface font-headline font-bold focus:ring-4 focus:ring-primary/5">
            <option value="Member">Tactical Member</option>
            <option value="Leader">Co-Commander</option>
          </select>
          <button type="button" class="remove-member-btn w-16 h-16 rounded-2xl bg-error/5 text-error flex items-center justify-center hover:bg-error/10 active:scale-90 transition-all shrink-0 border border-error/10">
            <span class="material-symbols-outlined text-2xl">person_remove</span>
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
       errorText.textContent = `Security Violation: Maximum ${maxTeamSize} personnel units allowed.`;
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
          errorText.textContent = `Node Sync Pending: "${f.label}" intelligence is required.`;
          errorEl.classList.remove('hidden');
          return;
        }
        extraData[f.label] = val;
      }
    }

    errorEl.classList.add('hidden');
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin mr-4 text-3xl">sync</span> SYNCING NODE...';
    btn.disabled = true;

    try {
      const result = await registerTeam({
        teamName,
        members,
        contactEmail: document.getElementById('reg-email').value.trim(),
        contactPhone: document.getElementById('reg-phone').value.trim(),
        eventId: event.id,
        extraData
      });

      const successHUD = document.getElementById('reg-success');
      successHUD.querySelector('#result-team-id').textContent = result.team_id;
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      successHUD.classList.remove('hidden');
      setTimeout(() => {
         successHUD.classList.remove('opacity-0', 'scale-95', 'translate-y-10');
      }, 100);
      
    } catch (err) {
      errorText.textContent = err.message || 'Authorization Failure';
      errorEl.classList.remove('hidden');
      btn.innerHTML = '<span class="uppercase tracking-[0.4em] z-10 relative">Initialize Team</span><span class="material-symbols-outlined text-3xl group-hover:rotate-180 transition-transform duration-700 z-10 relative">bolt</span>';
      btn.disabled = false;
    }
  });
}
