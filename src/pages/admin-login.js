import { adminLogin } from '../services/auth.js';
import { renderNavbar, bindNavbarEvents } from '../components/navbar.js';
import { navigate } from '../router.js';

export async function renderAdminLogin(container) {
  container.innerHTML = `
    ${renderNavbar()}
    <main class="min-h-[calc(100vh-76px)] flex items-center justify-center p-6 relative kinetic-bg">
      <div class="absolute top-1/4 -left-20 w-96 h-96 bg-tertiary/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div class="absolute bottom-1/4 -right-20 w-96 h-96 bg-primary/10 blur-[120px] rounded-full pointer-events-none"></div>
      
      <div class="w-full max-w-md relative z-10">
        <div class="text-center mb-10">
          <div class="flex items-center justify-center gap-2 text-tertiary text-xs font-headline tracking-[0.2em] uppercase mb-4">
            <span class="material-symbols-outlined text-sm">admin_panel_settings</span>
            <span>Administrator Access</span>
          </div>
          <h1 class="text-4xl md:text-5xl font-headline font-bold tracking-tighter text-white">Admin Login</h1>
        </div>
        
        <div class="glass-panel p-8 rounded-2xl space-y-6">
          <div id="admin-error" class="hidden bg-error-container/20 border border-error/20 text-on-error-container px-4 py-3 rounded-xl text-sm font-medium"></div>
          
          <div class="space-y-2">
            <label class="text-xs font-bold uppercase tracking-widest text-on-surface-variant block">Username</label>
            <div class="relative group">
              <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-tertiary transition-colors">person</span>
              <input id="admin-username" class="w-full bg-surface-container-lowest border-none rounded-xl py-4 pl-12 pr-4 text-white focus:ring-1 focus:ring-tertiary/40 transition-all placeholder:text-slate-600 font-headline" placeholder="admin" type="text" />
            </div>
          </div>
          
          <div class="space-y-2">
            <label class="text-xs font-bold uppercase tracking-widest text-on-surface-variant block">Password</label>
            <div class="relative group">
              <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-tertiary transition-colors">lock</span>
              <input id="admin-password" class="w-full bg-surface-container-lowest border-none rounded-xl py-4 pl-12 pr-4 text-white focus:ring-1 focus:ring-tertiary/40 transition-all placeholder:text-slate-600" placeholder="Enter password" type="password" />
            </div>
          </div>
          
          <button id="admin-submit" class="w-full py-4 rounded-xl bg-gradient-to-r from-tertiary to-primary text-on-primary-fixed font-headline font-bold text-lg flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-[0_10px_30px_rgba(175,136,255,0.2)]">
            <span>Access Control Panel</span>
            <span class="material-symbols-outlined">arrow_forward</span>
          </button>
          
          <a href="#/login" class="block text-center text-sm text-on-surface-variant hover:text-white transition-colors font-headline">← Back to Team Login</a>
        </div>
      </div>
    </main>
  `;

  bindNavbarEvents();

  document.getElementById('admin-submit').addEventListener('click', async () => {
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value;
    const errorEl = document.getElementById('admin-error');
    const btn = document.getElementById('admin-submit');

    if (!username || !password) {
      errorEl.textContent = 'Please enter both username and password';
      errorEl.classList.remove('hidden');
      return;
    }

    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span>';
    btn.disabled = true;

    try {
      await adminLogin(username, password);
      navigate('/admin');
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
      btn.innerHTML = '<span>Access Control Panel</span><span class="material-symbols-outlined">arrow_forward</span>';
      btn.disabled = false;
    }
  });
  
  document.getElementById('admin-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('admin-submit').click();
  });
}
