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
      <main class="min-h-screen flex items-center justify-center p-6 text-center bg-background">
        <div class="bg-surface p-12 rounded-[40px] max-w-xl w-full border border-error/20 shadow-sm">
          <span class="material-symbols-outlined text-6xl text-error mb-4">event_busy</span>
          <h2 class="text-3xl font-headline font-bold text-on-surface mb-2 tracking-tighter">Registration Closed</h2>
          <p class="text-on-surface-variant/60">There are no events currently open for registration.</p>
          <a href="#/" class="inline-block mt-8 px-8 py-3 bg-primary/10 text-primary rounded-xl font-headline font-bold hover:bg-primary/20 transition-all border border-primary/20">Back to Home</a>
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
    const baseClass = 'w-full bg-surface-container-low border border-outline rounded-2xl py-4 px-5 text-on-surface focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant/20 text-sm transition-all focus:bg-surface font-bold';
    if (f.type === 'textarea') {
      return `<textarea id="ef_${f.id}" name="${f.id}" class="${baseClass} h-32 resize-none" placeholder="${f.label}${f.required ? ' *' : ''}" ${f.required ? 'required' : ''}></textarea>`;
    }
    if (f.type === 'select') {
      const opts = (f.options || []).map(o => `<option value="${o}" class="bg-white text-on-surface">${o}</option>`).join('');
      return `<select id="ef_${f.id}" name="${f.id}" class="${baseClass}" ${f.required ? 'required' : ''}><option value="" class="bg-white text-on-surface">Select ${f.label}...</option>${opts}</select>`;
    }
    return `<input id="ef_${f.id}" name="${f.id}" type="${f.type || 'text'}" class="${baseClass}" placeholder="${f.label}${f.required ? ' (required)' : ''}" ${f.required ? 'required' : ''} />`;
  }

  container.innerHTML = `
    ${renderNavbar({ activeLink: 'events' })}
    <main class="min-h-[calc(100vh-76px)] flex flex-col items-center relative kinetic-bg pb-24 overflow-x-hidden bg-background">
      <!-- High-tech background elements -->
      <div class="fixed top-0 left-0 w-full h-full pointer-events-none -z-10">
        <div class="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-primary/5 blur-[150px] rounded-full animate-pulse-slow"></div>
        <div class="absolute bottom-1/4 -right-20 w-[500px] h-[500px] bg-secondary/5 blur-[150px] rounded-full animate-pulse"></div>
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.02] space-pattern grayscale"></div>
      </div>

      <!-- Header Content area -->
      <div class="w-full max-w-4xl px-6 pt-8 text-center slide-in-bottom">
         ${bannerUrl ? `
           <div class="w-full h-40 lg:h-56 rounded-[2.5rem] overflow-hidden mb-8 border border-primary/20 shadow-2xl relative group">
             <img src="${bannerUrl}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Event Banner" />
             <div class="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60"></div>
             <div class="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-[2.5rem]"></div>
           </div>
         ` : ''}
         <div class="flex items-center justify-center gap-4 mb-3">
            <span class="h-px w-8 lg:w-16 bg-primary/20"></span>
            <p class="text-primary font-headline font-black text-[9px] lg:text-[10px] uppercase tracking-[0.4em]">Event Registration</p>
            <span class="h-px w-8 lg:w-16 bg-primary/20"></span>
         </div>
         <h1 class="text-3xl lg:text-5xl font-headline font-black text-on-surface tracking-tighter mb-3">${headline}</h1>
         <p class="text-on-surface-variant max-w-2xl mx-auto text-xs lg:text-base mb-6 font-bold opacity-80">${subheading || 'Please fill in the details below to register your team for the event.'}</p>
      </div>

      <div class="w-full max-w-3xl relative z-10 px-6">
        
        <!-- Occupancy HUD -->
        ${maxTeams > 0 ? `
          <div class="bg-surface p-5 lg:p-8 rounded-3xl mb-8 border border-primary/10 shadow-2xl slide-in-bottom stagger-1 relative overflow-hidden group">
            <div class="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full"></div>
            <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
              <div>
                <p class="text-[9px] font-headline font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2 mb-1.5">
                  <span class="material-symbols-outlined text-sm text-primary">groups</span>
                  Registration Status
                </p>
                <div class="flex items-baseline gap-2">
                   <h3 class="text-3xl lg:text-5xl font-headline font-black text-on-surface tracking-tighter">
                     ${registeredCount}
                   </h3>
                   <span class="text-base lg:text-lg text-on-surface-variant/40 font-headline font-bold tracking-widest">/ ${maxTeams} Teams</span>
                </div>
              </div>
              <div class="text-left sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-end gap-2">
                ${spotsLeft <= 5 && spotsLeft > 0 ? `
                  <div class="px-2 py-0.5 bg-error/10 text-error font-headline font-black text-[8px] uppercase tracking-widest rounded-lg border border-error/20 mb-1 animate-pulse">Critical</div>
                ` : ''}
                <div class="text-2xl lg:text-4xl font-headline font-black text-primary tracking-tighter tabular-nums">${Math.round(occupancyPercent)}% <span class="text-[9px] font-bold text-on-surface-variant/40 align-middle">LOAD</span></div>
              </div>
            </div>
            
            <div class="h-3 bg-surface-container rounded-full overflow-hidden p-0.5 border border-outline/30">
              <div class="h-full bg-primary rounded-full relative transition-all duration-1000 ease-out shadow-lg" style="width: ${occupancyPercent}%">
                <div class="absolute top-0 right-0 h-full w-32 bg-white/20 blur-md animate-shimmer"></div>
              </div>
            </div>
          </div>
        ` : ''}

        ${isFull ? `
          <div class="glass-panel p-12 rounded-[50px] text-center border border-error/20 bg-error/5 shadow-2xl slide-in-bottom">
            <span class="material-symbols-outlined text-7xl text-error/30 mb-8">lock_person</span>
            <h2 class="text-4xl font-headline font-black text-white mb-4">Registration Full</h2>
            <p class="text-slate-400 mb-8 max-w-md mx-auto leading-relaxed text-lg font-medium">This event has reached its maximum capacity. Please contact the mission administrators for operational overrides.</p>
            <button onclick="window.history.back()" class="px-10 py-5 bg-secondary/10 text-primary rounded-2xl font-headline font-bold hover:bg-secondary/20 transition-all border border-secondary/20 uppercase text-xs tracking-widest">Return to Events Hub</button>
          </div>
        ` : `
          <!-- Registration Form -->
          <form id="reg-form" class="space-y-6 slide-in-bottom stagger-2 pb-20">
            <div id="reg-error" class="hidden glass-panel border-error/40 bg-error/10 text-error px-5 py-3 rounded-2xl text-sm font-bold flex items-center gap-3">
              <span class="material-symbols-outlined shrink-0">report</span>
              <span id="error-text"></span>
            </div>

            <!-- Identity Section -->
            <div class="bg-surface p-5 lg:p-8 rounded-[35px] space-y-6 lg:space-y-8 border border-primary/10 hover:border-primary/30 transition-all group shadow-2xl relative overflow-hidden">
              <div class="flex items-center gap-5">
                <div class="w-10 h-10 lg:w-14 lg:h-14 bg-primary/5 rounded-2xl flex items-center justify-center text-primary border border-primary/10 group-hover:rotate-6 transition-transform">
                  <span class="material-symbols-outlined text-xl lg:text-2xl">badge</span>
                </div>
                <div>
                  <h3 class="text-lg lg:text-2xl font-headline font-bold text-on-surface tracking-tight">Team Information</h3>
                  <p class="text-[9px] lg:text-[10px] text-on-surface-variant font-black uppercase tracking-widest mt-0.5 opacity-60">Enter your basic team details</p>
                </div>
              </div>

              <div class="space-y-6 lg:space-y-8">
                <div class="space-y-2.5 group/field">
                  <label class="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 group-focus-within/field:text-primary transition-colors pl-1">Team Name *</label>
                  <div class="relative">
                    <span class="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-2xl text-on-surface/10 group-focus-within/field:text-primary transition-colors pointer-events-none">groups</span>
                    <input id="reg-team-name" class="w-full bg-surface-container-low border border-outline rounded-[1.5rem] py-4 pl-16 pr-8 text-lg text-on-surface font-headline font-black focus:ring-4 focus:ring-primary/10 placeholder:text-on-surface-variant/20 transition-all shadow-sm" placeholder="e.g. Code Warriors" required />
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div class="space-y-2.5 group/field">
                    <label class="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 group-focus-within/field:text-primary transition-colors pl-1">Contact Email</label>
                    <div class="relative">
                      <span class="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-xl text-on-surface/10 group-focus-within/field:text-primary transition-colors pointer-events-none">alternate_email</span>
                      <input id="reg-email" type="email" class="w-full bg-surface-container-low border border-outline rounded-xl py-3.5 pl-16 pr-6 text-on-surface font-headline font-bold focus:ring-4 focus:ring-primary/10 placeholder:text-on-surface-variant/20 transition-all shadow-sm" placeholder="leader@domain.com" />
                    </div>
                  </div>
                  <div class="space-y-2.5 group/field">
                    <label class="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 group-focus-within/field:text-primary transition-colors pl-1">Secure Contact</label>
                    <div class="relative">
                      <span class="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-xl text-on-surface/10 group-focus-within/field:text-primary transition-colors pointer-events-none">smartphone</span>
                      <input id="reg-phone" class="w-full bg-surface-container-low border border-outline rounded-xl py-3.5 pl-16 pr-6 text-on-surface font-headline font-bold focus:ring-4 focus:ring-primary/10 placeholder:text-on-surface-variant/20 transition-all shadow-sm" placeholder="+91 XXXX XXXX" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Personnel Manifest Section -->
            <div class="bg-surface p-5 lg:p-8 rounded-[35px] space-y-6 lg:space-y-8 border border-primary/10 hover:border-primary/30 transition-all shadow-2xl relative overflow-hidden group">
               <div class="flex items-center justify-between relative z-10">
                <div class="flex items-center gap-5">
                  <div class="w-10 h-10 lg:w-14 lg:h-14 bg-primary/5 rounded-2xl flex items-center justify-center text-primary border border-primary/10 group-hover:-rotate-6 transition-transform">
                    <span class="material-symbols-outlined text-xl lg:text-2xl">diversity_3</span>
                  </div>
                  <div>
                    <h3 class="text-lg lg:text-2xl font-headline font-bold text-on-surface tracking-tight">Team Members</h3>
                    <p class="text-[9px] lg:text-[10px] text-on-surface-variant font-black uppercase tracking-widest mt-0.5 opacity-60">Add your members · Max ${maxTeamSize}</p>
                  </div>
                </div>
                <div class="px-4 py-1.5 bg-surface-container rounded-xl border border-outline/20">
                  <div id="member-ratio" class="text-xs font-headline font-black text-primary tracking-widest">${1} / ${maxTeamSize}</div>
                </div>
              </div>

              <div id="members-container" class="space-y-4 relative z-10">
                <div class="flex flex-col lg:flex-row gap-4 p-5 lg:p-6 bg-surface-container-low rounded-[2rem] border border-outline transition-all relative overflow-hidden ml-0">
                   <div class="absolute left-0 top-0 w-1.5 h-full bg-primary"></div>
                   <div class="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div class="relative flex-1 group/field">
                        <span class="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-xl text-primary/30 group-focus-within/field:text-primary pointer-events-none transition-colors">person</span>
                        <input class="member-name w-full bg-surface border border-outline rounded-2xl py-4 pl-16 pr-6 text-on-surface font-headline font-bold placeholder:text-on-surface-variant/20 focus:ring-2 focus:ring-primary/20" placeholder="Leader Name" required />
                      </div>
                      <div class="flex items-center px-6 py-4 bg-primary/10 rounded-2xl border border-primary/10">
                         <span class="text-[9px] font-black text-primary uppercase tracking-[0.3em] w-full text-center">Team Leader</span>
                         <input type="hidden" class="member-role" value="Leader" />
                      </div>
                   </div>
                </div>
                
                <div id="additional-members" class="space-y-4"></div>

                <div class="pt-2">
                  <button type="button" id="add-member-btn" class="w-full py-5 rounded-2xl border-2 border-dashed border-outline text-on-surface-variant/40 hover:border-primary hover:text-primary hover:bg-primary/5 font-headline font-black text-[10px] uppercase tracking-[0.4em] transition-all flex items-center justify-center gap-4">
                    <span class="material-symbols-outlined">person_add</span> Add Team Member
                  </button>
                  <div id="limit-msg" class="hidden text-center text-[9px] font-black text-on-surface-variant/40 uppercase tracking-[0.4em] py-5 bg-surface-container rounded-2xl border border-outline">Team Limit Reached</div>
                </div>
              </div>
            </div>

            <!-- Extra Intel Section -->
            ${extraFields.length > 0 ? `
              <div class="bg-surface p-5 lg:p-8 rounded-[35px] space-y-6 lg:space-y-8 border border-primary/10 hover:border-primary/30 transition-all shadow-2xl relative overflow-hidden">
                <div class="flex items-center gap-5">
                  <div class="w-10 h-10 lg:w-14 lg:h-14 bg-primary/5 rounded-2xl flex items-center justify-center text-primary border border-primary/10">
                    <span class="material-symbols-outlined text-xl lg:text-2xl">info</span>
                  </div>
                  <div>
                    <h3 class="text-lg lg:text-2xl font-headline font-bold text-on-surface tracking-tight">Additional Details</h3>
                    <p class="text-[9px] lg:text-[10px] text-on-surface-variant font-black uppercase tracking-widest mt-0.5 opacity-60">Extra Information Required</p>
                  </div>
                </div>

                <div class="space-y-6 lg:space-y-8">
                  ${extraFields.map(f => `
                    <div class="space-y-3 group/field">
                      <label class="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 group-focus-within/field:text-primary transition-colors pl-1">${f.label}${f.required ? ' *' : ''}</label>
                      <div class="relative">
                        ${renderExtraField(f)}
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <div class="pt-6">
              <button id="reg-submit" type="submit" class="kinetic-gradient w-full py-5 rounded-[2rem] font-headline font-black text-white text-lg lg:text-xl flex items-center justify-center gap-6 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl relative overflow-hidden group">
                <span class="uppercase tracking-[0.3em] z-10 relative">Register Team</span>
                <span class="material-symbols-outlined text-2xl group-hover:rotate-180 transition-transform duration-700 z-10 relative">bolt</span>
                <div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </button>
              <p class="text-center text-[9px] text-slate-700 uppercase tracking-[0.4em] pt-6 font-bold italic">Secure Data Transmission Active</p>
            </div>
          </form>
        `}
      </div>

      <!-- Success HUD -->
      <div id="reg-success" class="hidden fixed inset-0 z-[100] flex items-center justify-center p-6 bg-surface/90 backdrop-blur-3xl transition-all duration-700 opacity-0 scale-95 translate-y-10">
        <div class="bg-surface p-8 lg:p-16 rounded-[60px] max-w-2xl w-full text-center space-y-10 border border-primary/20 shadow-2xl relative">
          <div class="relative z-10 space-y-10">
            <div class="w-24 h-24 lg:w-32 lg:h-32 bg-primary rounded-[40px] flex items-center justify-center mx-auto mb-10 rotate-12 shadow-2xl border-4 border-surface">
              <span class="material-symbols-outlined text-5xl lg:text-7xl text-white">check_circle</span>
            </div>
            
            <div>
              <h2 class="text-4xl lg:text-6xl font-headline font-black text-on-surface mb-4 tracking-tighter">Registration Successful</h2>
              <p class="text-lg lg:text-xl text-on-surface-variant leading-relaxed">You have been registered for the event. Please note down your Team ID:</p>
            </div>
            
            <div class="bg-primary/5 p-8 lg:p-12 rounded-[50px] space-y-6 border border-primary/10 shadow-inner relative overflow-hidden">
              <span class="text-[10px] lg:text-xs font-black tracking-[0.5em] text-primary uppercase block mb-4">Your Team ID</span>
              <div id="result-team-id" class="text-4xl lg:text-6xl font-headline font-black text-primary tracking-[0.2em]"></div>
            </div>

            <p class="text-error font-headline font-black uppercase tracking-widest text-xs">⚠️ Secure this key for terminal authentication</p>
            
            <button onclick="window.location.hash='#/login'" class="w-full bg-primary py-6 rounded-[3rem] font-headline font-black text-white text-lg uppercase tracking-[0.3em] hover:scale-[1.05] transition-transform shadow-xl">
              Go to Login
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
    div.className = 'flex flex-col md:flex-row gap-6 p-6 lg:p-8 bg-surface-container-low rounded-[2.5rem] border border-outline relative group/row slide-in-bottom';
    div.innerHTML = `
      <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="relative flex-1 group/field">
          <span class="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-2xl text-on-surface/10 group-focus-within/field:text-primary transition-colors pointer-events-none">person</span>
          <input class="member-name w-full bg-surface border border-outline rounded-2xl py-4 pl-16 pr-6 text-on-surface font-headline font-bold focus:ring-4 focus:ring-primary/10 placeholder:text-on-surface-variant/20" placeholder="Member Name" required />
        </div>
        <div class="flex gap-4">
          <select class="member-role flex-1 bg-surface border border-outline rounded-2xl py-5 px-6 text-on-surface font-headline font-bold focus:ring-4 focus:ring-primary/10">
            <option value="Member" class="bg-white">Team Member</option>
            <option value="Leader" class="bg-white">Co-Leader</option>
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
    btn.innerHTML = '<div class="loader mr-4 text-3xl"></div> REGISTERING...';
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
