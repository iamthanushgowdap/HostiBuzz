import { teamLogin } from '../services/auth.js';
import { renderNavbar, bindNavbarEvents } from '../components/navbar.js';
import { navigate } from '../router.js';

export async function renderLogin(container) {
  container.innerHTML = `
    ${renderNavbar({ activeLink: '' })}
    <main class="min-h-[calc(100vh-76px)] flex items-center justify-center p-6 relative overflow-hidden bg-background">
      <!-- Kinetic Background -->
      <div class="fixed top-0 left-0 w-full h-full pointer-events-none -z-10">
        <div class="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-primary/5 blur-[150px] rounded-full animate-pulse-slow"></div>
        <div class="absolute bottom-1/4 -right-20 w-[600px] h-[600px] bg-secondary/5 blur-[150px] rounded-full animate-pulse"></div>
      </div>

      <div class="w-full max-w-lg relative z-10 slide-in-bottom">
        <div class="bg-surface p-6 lg:p-8 rounded-[40px] border border-primary/10 shadow-2xl relative overflow-hidden group">
          <div class="absolute top-0 left-0 w-full h-1.5 bg-primary"></div>
          
          <div class="text-center space-y-2 mb-6">
            <div class="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-500">
               <span class="material-symbols-outlined text-3xl text-primary">login</span>
            </div>
            <h1 class="text-3xl lg:text-4xl font-headline font-black text-on-surface tracking-tighter">Team Login</h1>
            <p class="text-on-surface-variant text-xs font-bold opacity-70 uppercase tracking-widest px-4">Login to your dashboard</p>
          </div>
 
          <form id="login-form" class="space-y-4">
            <div id="login-error" class="hidden p-3 rounded-xl bg-error/10 border border-error/20 text-error text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
              <span class="material-symbols-outlined text-sm">report</span>
              <span id="error-text"></span>
            </div>
 
            <div class="space-y-1.5 group/field">
              <label class="text-[9px] font-black uppercase tracking-[0.3em] text-on-surface-variant/40 pl-4 group-focus-within/field:text-primary transition-colors">Team ID</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-xl text-on-surface/10 group-focus-within/field:text-primary transition-colors pointer-events-none">person</span>
                <input id="login-team-id" class="w-full bg-surface-container-low border border-outline rounded-[1.5rem] py-4 pl-16 pr-8 text-lg text-primary font-headline font-black placeholder:text-on-surface-variant/20 focus:ring-4 focus:ring-primary/10 transition-all text-center tracking-[0.1em] uppercase shadow-sm" placeholder="HB-000" required autofocus />
              </div>
            </div>
 
            <div class="space-y-1.5 group/field">
              <label class="text-[9px] font-black uppercase tracking-[0.3em] text-on-surface-variant/40 pl-4 group-focus-within/field:text-secondary transition-colors">Password</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-xl text-on-surface/10 group-focus-within/field:text-secondary transition-colors pointer-events-none">lock</span>
                <input id="login-password" type="password" class="w-full bg-surface-container-low border border-outline rounded-[1.5rem] py-4 pl-16 pr-8 text-lg text-secondary font-headline font-bold placeholder:text-on-surface-variant/20 focus:ring-4 focus:ring-secondary/10 transition-all text-center tracking-[0.2em] shadow-sm" placeholder="********" required />
              </div>
            </div>
 
            <button type="submit" id="login-submit" class="kinetic-gradient w-full py-5 rounded-[2rem] font-headline font-black text-white text-base lg:text-lg flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_15px_30px_rgba(16,185,129,0.2)] group">
              <span class="uppercase tracking-[0.2em]">Sign In</span>
              <span class="material-symbols-outlined text-xl group-hover:translate-x-2 transition-transform duration-500">arrow_forward</span>
            </button>
            
            <div class="pt-2 text-center">
              <div class="h-px w-full bg-outline/10 mb-4"></div>
              <p class="text-on-surface-variant text-[10px] font-bold">Don't have an ID? <a href="#/events" class="text-secondary font-black hover:underline px-2 py-1 bg-secondary/5 rounded-md">View Events</a></p>
            </div>
          </form>
        </div>
      </div>
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
    const password = document.getElementById('login-password').value.trim();
    
    if (!teamId || !password) return;

    errorEl.classList.add('hidden');
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin mr-3">progress_activity</span> Authenticating...';
    btn.disabled = true;

    try {
      const result = await teamLogin(teamId, password);
      if (result.eliminated) {
        navigate('/eliminated');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      errorText.textContent = err.message || 'Node Synchronization Failure';
      errorEl.classList.remove('hidden');
      btn.innerHTML = '<span class="uppercase tracking-[0.3em]">Access Operations</span><span class="material-symbols-outlined text-2xl">arrow_forward</span>';
      btn.disabled = false;
    }
  });
}
