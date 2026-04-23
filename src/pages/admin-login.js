import { adminLogin } from '../services/auth.js';
import { renderNavbar, bindNavbarEvents } from '../components/navbar.js';
import { navigate } from '../router.js';

export async function renderAdminLogin(container) {
  container.innerHTML = `
    ${renderNavbar()}
    <main class="min-h-[calc(100vh-76px)] flex items-center justify-center p-6 relative kinetic-bg bg-background">
      <div class="absolute top-1/4 -left-20 w-96 h-96 bg-primary/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div class="absolute bottom-1/4 -right-20 w-96 h-96 bg-secondary/5 blur-[120px] rounded-full pointer-events-none"></div>
      
      <div class="w-full max-w-md relative z-10">
        <div class="text-center mb-10">
          <div class="flex items-center justify-center gap-2 text-primary text-xs font-headline tracking-[0.2em] uppercase mb-4">
            <span class="material-symbols-outlined text-sm">admin_panel_settings</span>
            <span>Administrator Access</span>
          </div>
          <h1 class="text-4xl md:text-5xl font-headline font-black tracking-tighter text-on-surface uppercase">Admin Login</h1>
        </div>
        
        <div class="glass-panel p-10 rounded-[40px] space-y-8 border border-primary/5 shadow-2x bg-white/50">
          <div id="admin-error" class="hidden bg-error/10 border border-error/20 text-error px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-3">
             <span class="material-symbols-outlined text-sm">report</span>
             <span id="error-text"></span>
          </div>
          
          <div class="space-y-3 group/field">
            <label class="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 block ml-1 group-focus-within/field:text-primary transition-colors">Tactical Username</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-on-surface/10 group-focus-within/field:text-primary transition-colors">person</span>
              <input id="admin-username" class="w-full bg-surface-container-low border border-outline rounded-2xl py-5 pl-14 pr-5 text-on-surface focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-on-surface-variant/20 font-headline font-bold text-lg" placeholder="admin" type="text" />
            </div>
          </div>
          
          <div class="space-y-3 group/field">
            <label class="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 block ml-1 group-focus-within/field:text-secondary transition-colors">Authorization Key</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-on-surface/10 group-focus-within/field:text-secondary transition-colors">lock</span>
              <input id="admin-password" class="w-full bg-surface-container-low border border-outline rounded-2xl py-5 pl-14 pr-5 text-on-surface focus:ring-4 focus:ring-secondary/10 transition-all placeholder:text-on-surface-variant/20 font-headline font-bold text-lg" placeholder="••••••••" type="password" />
            </div>
          </div>
          
          <button id="admin-submit" class="w-full py-6 rounded-[2.5rem] kinetic-gradient text-on-primary-fixed font-headline font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg">
            <span>Access Control Panel</span>
            <span class="material-symbols-outlined">shield_person</span>
          </button>
          
          <a href="#/login" class="block text-center text-[10px] text-on-surface-variant/60 hover:text-primary transition-colors font-headline font-black uppercase tracking-widest">← Back to Team Terminal</a>
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
