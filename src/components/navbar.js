import { getState } from '../services/state.js';
import { logout } from '../services/auth.js';

export function renderNavbar(options = {}) {
  const user = getState('user');
  const { activeLink = '', hideNavigation = false, hideMobileMenu = false } = options;

  const navLinks = !hideNavigation ? [
    { id: 'events', label: 'Events', href: '#/events', icon: 'event' },
    { id: 'leaderboard', label: 'Leaderboard', href: '#/leaderboard', icon: 'leaderboard' },
    ...(user ? [{ 
      id: 'dashboard', 
      label: user.role === 'admin' ? 'Admin Panel' : 'Team Dashboard', 
      href: user.role === 'admin' ? '#/admin' : '#/dashboard', 
      icon: user.role === 'admin' ? 'admin_panel_settings' : 'dashboard' 
    }] : []),
  ] : [];

  return `
    <nav class="glow-nav sticky top-0 z-50 shadow-[0_4px_30px_rgba(20,83,45,0.08)] backdrop-blur-md border-b border-primary/10">
      <div class="flex flex-col lg:flex-row justify-between items-center w-full px-4 lg:px-6 py-2 lg:py-3 mx-auto gap-2 lg:gap-0">
        
        <div class="flex items-center justify-between w-full lg:w-auto lg:pr-12">
          <!-- Logo -->
          <div class="flex-shrink-0">
            ${hideNavigation
              ? `<span class="text-xl lg:text-xl font-bold tracking-tighter text-primary font-headline cursor-default">HostiBuzz</span>`
              : `<a href="#/" class="text-xl lg:text-xl font-bold tracking-tighter text-primary font-headline hover:text-secondary transition-colors">HostiBuzz</a>`
            }
          </div>

          <!-- Mobile Actions (Guest Mode) -->
          ${!user && !hideNavigation ? `
            <div class="lg:hidden flex items-center gap-3">
              <a href="#/login" class="text-[11px] font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors">Login</a>
              <div class="w-1 h-1 bg-primary/20 rounded-full"></div>
              <a href="#/events" class="text-[11px] font-black uppercase tracking-widest text-primary">Register</a>
            </div>
          ` : ''}
          
          <!-- Mobile Logout (Admin/Team) -->
          ${user && !hideNavigation ? `
            <button id="nav-logout-mobile" class="lg:hidden w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-on-surface-variant hover:text-error transition-colors">
              <span class="material-symbols-outlined text-sm">logout</span>
            </button>
          ` : ''}
        </div>

        <!-- Glowing Tab Nav Links (DESKTOP) -->
        ${!hideNavigation && navLinks.length > 0 ? `
          <div class="glow-nav-inner hidden lg:block flex-1 max-w-[420px]" id="glow-nav-inner">
            <ul class="glow-nav-list">
              ${navLinks.map(link => `
                <li class="glow-nav-item${activeLink === link.id ? ' active' : ''}" data-href="${link.href}">
                  <a href="${link.href}" data-nav-link="${link.id}">
                    <span class="material-symbols-outlined" style="font-size:16px">${link.icon}</span>
                    ${link.label}
                  </a>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        <!-- MOBILE NAVIGATION -->
        ${!hideNavigation && navLinks.length > 0 ? `
          <div class="lg:hidden w-full overflow-x-auto no-scrollbar pb-1">
            <div class="flex items-center justify-between gap-1 p-1 bg-primary/5 rounded-xl border border-primary/5">
              ${navLinks.map(link => `
                <a href="${link.href}" class="flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-all ${activeLink === link.id ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_4px_12px_rgba(20,83,45,0.1)]' : 'text-on-surface-variant hover:text-primary'}">
                  <span class="material-symbols-outlined text-[18px]">${link.icon}</span>
                  <span class="text-[7px] font-headline font-black uppercase tracking-[0.2em]">${link.label}</span>
                </a>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Right Side Actions (DESKTOP ONLY) -->
        <div class="hidden lg:flex items-center gap-3 ml-auto">
          ${user ? `
            <div class="flex items-center gap-2 bg-primary/5 px-3 py-1.5 rounded-full border border-primary/5">
              <span class="w-1.5 h-1.5 bg-secondary rounded-full animate-pulse"></span>
              <span class="text-[10px] font-headline font-bold text-on-surface-variant uppercase tracking-widest truncate max-w-[80px]">${user.role === 'admin' ? user.username : user.team_id}</span>
            </div>
            ${user.role === 'admin' ? `<a href="#/admin" class="inline-flex px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-secondary text-white font-headline font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-transform shadow-xl">Admin</a>` : ''}
            <button id="nav-logout" class="px-4 py-2 rounded-lg bg-primary/5 text-on-surface-variant font-headline font-bold text-[10px] uppercase tracking-widest hover:bg-primary/10 hover:text-on-surface transition-all border border-primary/5 active:scale-95">Sign Out</button>
          ` : `
            <a href="#/login" class="px-4 py-2 rounded-lg bg-primary/5 text-on-surface-variant font-headline text-sm hover:text-on-surface transition-colors hidden sm:inline-flex">Team Login</a>
            <button class="creepy-btn" id="nav-register-btn" onclick="location.hash='#/events'">
              <span class="creepy-btn__eyes" id="nav-creepy-eyes">
                <span class="creepy-btn__eye"><span class="creepy-btn__pupil" id="nav-pupil-1"></span></span>
                <span class="creepy-btn__eye"><span class="creepy-btn__pupil" id="nav-pupil-2"></span></span>
              </span>
              <span class="creepy-btn__cover">Register</span>
            </button>
          `}
        </div>
      </div>
    </nav>
  `;
}

export function bindNavbarEvents() {
  // Logout (Desktop & Mobile)
  const logoutBtn = document.getElementById('nav-logout');
  const logoutBtnMobile = document.getElementById('nav-logout-mobile');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  if (logoutBtnMobile) logoutBtnMobile.addEventListener('click', logout);

  // Glowing Tab Navigation
  const glowNavInner = document.getElementById('glow-nav-inner');
  if (glowNavInner) {
    initGlowNav(glowNavInner);
  }

  // Show "Back to Admin" button if previewing from admin
  if (sessionStorage.getItem('admin_return') === 'true') {
    // Only show if we're NOT on the admin page itself
    if (!window.location.hash.includes('/admin')) {
      const backBtnId = 'admin-return-path';
      if (!document.getElementById(backBtnId)) {
        const backBtn = document.createElement('button');
        backBtn.id = backBtnId;
        backBtn.innerHTML = '<span style="font-size:18px;">←</span> Back to Admin Panel';
        backBtn.style.cssText = 'position:fixed;top:16px;right:16px;z-index:9999;padding:10px 20px;border-radius:12px;background:rgba(16,185,129,0.1);color:#10b981;border:1px solid rgba(16,185,129,0.3);font-size:12px;font-weight:700;cursor:pointer;backdrop-filter:blur(12px);text-transform:uppercase;letter-spacing:1px;display:flex;align-items:center;gap:8px;transition:all 0.2s;';
        backBtn.onmouseenter = () => backBtn.style.background = 'rgba(16,185,129,0.2)';
        backBtn.onmouseleave = () => backBtn.style.background = 'rgba(16,185,129,0.1)';
        backBtn.addEventListener('click', () => {
          sessionStorage.removeItem('admin_return');
          window.location.hash = '/admin';
        });
        document.body.appendChild(backBtn);
      }
    }
  }

  // Creepy Eye Button on nav
  const navRegBtn = document.getElementById('nav-register-btn');
  if (navRegBtn) {
    const eyesEl = document.getElementById('nav-creepy-eyes');
    const pupils = [
      document.getElementById('nav-pupil-1'),
      document.getElementById('nav-pupil-2'),
    ];
    bindCreepyEyes(navRegBtn, eyesEl, pupils);
  }
}

/* ── Glowing Tab Nav Logic ─────────────────────────── */
function initGlowNav(wrapper) {
  const links = wrapper.querySelectorAll('.glow-nav-item a');
  if (!links.length) return;

  function handleGlowClick(event) {
    const target = event.currentTarget.parentNode;
    const width = target.offsetWidth;
    const { left } = target.getBoundingClientRect();
    const offsetLeft = left - wrapper.getBoundingClientRect().left;

    wrapper.querySelectorAll('.glow-nav-item').forEach(li => li.classList.remove('active'));
    target.classList.add('active');

    wrapper.style.setProperty('--after-bg-position', offsetLeft);
    wrapper.style.setProperty('--after-radial-bg-position', (left + width / 2) - wrapper.getBoundingClientRect().left);
    wrapper.style.setProperty('--after-bg-width', width);
    wrapper.style.setProperty('--after-bg-opacity', '100');
  }

  links.forEach(link => {
    link.addEventListener('click', handleGlowClick);
    link.addEventListener('mousemove', (e) => {
      const rect = e.target.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const tiltY = -((x - rect.width / 2) / 20) * 2;
      const tiltX = -((y - rect.height / 2) / 20) * 2;
      wrapper.style.setProperty('--tilt-bg-y', tiltY);
      wrapper.style.setProperty('--tilt-bg-x', tiltX);
    });
  });

  // Set active state from DOM on load
  const activeItem = wrapper.querySelector('.glow-nav-item.active');
  if (activeItem) {
    setTimeout(() => {
      const { width, left } = activeItem.getBoundingClientRect();
      const offsetLeft = left - wrapper.getBoundingClientRect().left;
      wrapper.style.setProperty('--after-bg-position', offsetLeft);
      wrapper.style.setProperty('--after-radial-bg-position', offsetLeft + width / 2);
      wrapper.style.setProperty('--after-bg-width', width);
      wrapper.style.setProperty('--after-bg-opacity', '100');
    }, 50);
  } else {
    // Force opacity to 0 if no item is active
    wrapper.style.setProperty('--after-bg-opacity', '0');
  }
}

/* ── Creepy Eye Button Logic ────────────────────────── */
export function bindCreepyEyes(btnEl, eyesEl, pupils) {
  if (!btnEl || !eyesEl || !pupils.every(Boolean)) return;

  function updateEyes(e) {
    const userEvent = 'touches' in e ? e.touches[0] : e;
    const eyesRect = eyesEl.getBoundingClientRect();
    const cx = eyesRect.left + eyesRect.width / 2;
    const cy = eyesRect.top + eyesRect.height / 2;
    const dx = userEvent.clientX - cx;
    const dy = userEvent.clientY - cy;
    const angle = Math.atan2(-dy, dx) + Math.PI / 2;
    const dist = Math.hypot(dx, dy);
    const x = Math.sin(angle) * dist / 180;
    const y = Math.cos(angle) * dist / 75;
    const tx = `${-50 + Math.max(-1, Math.min(1, x)) * 50}%`;
    const ty = `${-50 + Math.max(-1, Math.min(1, y)) * 50}%`;
    pupils.forEach(p => { p.style.transform = `translate(${tx}, ${ty})`; });
  }

  btnEl.addEventListener('mousemove', updateEyes);
  btnEl.addEventListener('touchmove', updateEyes, { passive: true });
}
