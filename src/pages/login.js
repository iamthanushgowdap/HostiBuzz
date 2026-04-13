import { teamLogin } from '../services/auth.js';
import { renderNavbar, bindNavbarEvents } from '../components/navbar.js';
import { navigate } from '../router.js';

export async function renderLogin(container) {
  container.innerHTML = `
    ${renderNavbar()}
    <main class="min-h-[calc(100vh-76px)] flex items-center justify-center p-6 relative kinetic-bg">
      <div class="absolute top-1/4 -left-20 w-96 h-96 bg-primary/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div class="absolute bottom-1/4 -right-20 w-96 h-96 bg-secondary/10 blur-[120px] rounded-full pointer-events-none"></div>
      
      <div class="w-full max-w-md relative z-10">
        <div class="text-center mb-10">
          <div class="flex items-center justify-center gap-2 text-primary text-xs font-headline tracking-[0.2em] uppercase mb-4">
            <span class="material-symbols-outlined text-sm">shield_person</span>
            <span>Team Authentication</span>
          </div>
          <h1 class="text-4xl md:text-5xl font-headline font-bold tracking-tighter text-white">Team Login</h1>
        </div>
        
        <div class="glass-panel p-8 rounded-2xl space-y-6">
          <div id="login-error" class="hidden bg-error-container/20 border border-error/20 text-on-error-container px-4 py-3 rounded-xl text-sm font-medium"></div>
          
          <div class="space-y-2">
            <label class="text-xs font-bold uppercase tracking-widest text-on-surface-variant block">Team ID</label>
            <div class="relative group">
              <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-secondary transition-colors">badge</span>
              <input id="login-team-id" class="w-full bg-surface-container-lowest border-none rounded-xl py-4 pl-12 pr-4 text-white focus:ring-1 focus:ring-secondary/40 transition-all placeholder:text-slate-600 font-headline" placeholder="HB-001" type="text" />
            </div>
          </div>
          
          <div class="space-y-2">
            <label class="text-xs font-bold uppercase tracking-widest text-on-surface-variant block">Password</label>
            <div class="relative group">
              <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-secondary transition-colors">lock</span>
              <input id="login-password" class="w-full bg-surface-container-lowest border-none rounded-xl py-4 pl-12 pr-4 text-white focus:ring-1 focus:ring-secondary/40 transition-all placeholder:text-slate-600" placeholder="Enter password" type="password" />
            </div>
          </div>
          
          <button id="login-submit" class="kinetic-gradient w-full py-4 rounded-xl font-headline font-bold text-on-primary-fixed text-lg flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-[0_10px_30px_rgba(167,165,255,0.2)]">
            <span>Enter Platform</span>
            <span class="material-symbols-outlined">arrow_forward</span>
          </button>
          
          <div class="flex items-center gap-4 pt-2">
            <div class="h-px flex-1 bg-outline-variant/20"></div>
            <span class="text-xs text-on-surface-variant font-headline">OR</span>
            <div class="h-px flex-1 bg-outline-variant/20"></div>
          </div>
          
          <div class="flex gap-3">
            <a href="#/register" class="flex-1 text-center py-3 rounded-xl bg-surface-container-high border border-outline-variant/15 text-on-surface-variant font-headline text-sm hover:text-white hover:bg-surface-container-highest transition-colors">Register Team</a>
            <a href="#/admin/login" class="flex-1 text-center py-3 rounded-xl bg-surface-container-high border border-outline-variant/15 text-on-surface-variant font-headline text-sm hover:text-white hover:bg-surface-container-highest transition-colors">Admin Login</a>
          </div>
        </div>
      </div>
    </main>
  `;

  bindNavbarEvents();

  document.getElementById('login-submit').addEventListener('click', async () => {
    const teamId = document.getElementById('login-team-id').value.trim().toUpperCase();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-submit');

    if (!teamId || !password) {
      errorEl.textContent = 'Please enter both Team ID and Password';
      errorEl.classList.remove('hidden');
      return;
    }

    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span>';
    btn.disabled = true;

    try {
      const result = await teamLogin(teamId, password);
      if (result.eliminated) {
        navigate('/eliminated');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
      btn.innerHTML = '<span>Enter Platform</span><span class="material-symbols-outlined">arrow_forward</span>';
      btn.disabled = false;
    }
  });
  
  // Enter key support
  document.getElementById('login-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('login-submit').click();
  });
}
