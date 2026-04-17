import { loginTeam } from '../services/auth.js';
import { renderNavbar, bindNavbarEvents } from '../components/navbar.js';
import { navigate } from '../router.js';

export async function renderLogin(container) {
  container.innerHTML = `
    ${renderNavbar()}
    <main class="min-h-[calc(100vh-76px)] flex items-center justify-center p-6 relative overflow-hidden bg-white">
      <!-- Kinetic Background -->
      <div class="fixed top-0 left-0 w-full h-full pointer-events-none -z-10">
        <div class="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-primary/10 blur-[150px] rounded-full animate-pulse-slow"></div>
        <div class="absolute bottom-1/4 -right-20 w-[600px] h-[600px] bg-secondary/10 blur-[150px] rounded-full animate-pulse"></div>
      </div>

      <div class="w-full max-w-lg relative z-10 slide-in-bottom">
        <div class="glass-panel p-8 lg:p-12 rounded-[50px] border border-primary/10 bg-white shadow-2xl relative overflow-hidden group">
          <div class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-secondary to-primary"></div>
          
          <div class="text-center space-y-4 mb-10">
            <div class="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
               <span class="material-symbols-outlined text-4xl text-primary">key</span>
            </div>
            <h1 class="text-4xl lg:text-5xl font-headline font-black text-on-surface tracking-tighter">Ops Terminal</h1>
            <p class="text-on-surface-variant text-sm lg:text-base px-4">Initialize synchronization by entering your protocol designation.</p>
          </div>

          <form id="login-form" class="space-y-8">
            <div id="login-error" class="hidden p-4 rounded-2xl bg-error/10 border border-error/20 text-error text-[11px] font-black uppercase tracking-widest flex items-center gap-3">
              <span class="material-symbols-outlined text-sm">report</span>
              <span id="error-text"></span>
            </div>

            <div class="space-y-4 group">
              <label class="text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant pl-1 group-focus-within:text-primary transition-colors">Protocol Node ID</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-2xl text-on-surface-variant/30 group-focus-within:text-primary transition-colors pointer-events-none">terminal</span>
                <input id="login-team-id" class="w-full bg-secondary/5 border border-primary/5 rounded-[2rem] py-6 pl-16 pr-8 text-2xl text-primary font-headline font-black placeholder:text-slate-300 focus:ring-4 focus:ring-primary/5 transition-all text-center tracking-[0.2em] uppercase" placeholder="XXXX-XXXX" required autofocus />
              </div>
            </div>

            <button type="submit" id="login-submit" class="kinetic-gradient w-full py-6 rounded-[2.5rem] font-headline font-black text-white text-lg lg:text-xl flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl group">
              <span class="uppercase tracking-[0.3em]">Access Operations</span>
              <span class="material-symbols-outlined text-2xl group-hover:translate-x-2 transition-transform duration-500">arrow_forward</span>
            </button>
            
            <div class="pt-4 text-center">
              <p class="text-[10px] text-on-surface-variant/40 uppercase tracking-[0.4em] font-medium italic mb-6">Encrypted Pipeline Active</p>
              <div class="h-px w-full bg-primary/10 mb-6"></div>
              <p class="text-on-surface-variant text-xs">Awaiting designation? <a href="#/events" class="text-secondary font-bold hover:underline">Locate Mission Node</a></p>
            </div>
          </form>
        </div>
      </div>
    </main>
  `;

  bindNavbarEvents();

  const loginForm = document.getElementById('login-form');
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('login-error');
    const errorText = document.getElementById('error-text');
    const btn = document.getElementById('login-submit');

    const teamId = document.getElementById('login-team-id').value.trim();
    if (!teamId) return;

    errorEl.classList.add('hidden');
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin mr-3">progress_activity</span> Authenticating...';
    btn.disabled = true;

    try {
      await loginTeam(teamId);
      navigate('/dashboard');
    } catch (err) {
      errorText.textContent = err.message || 'Node Synchronization Failure';
      errorEl.classList.remove('hidden');
      btn.innerHTML = '<span class="uppercase tracking-[0.3em]">Access Operations</span><span class="material-symbols-outlined text-2xl">arrow_forward</span>';
      btn.disabled = false;
    }
  });
}
