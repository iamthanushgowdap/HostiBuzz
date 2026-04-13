import { supabase } from './config/supabase.js';
import { getState, isAdmin, isLoggedIn } from './services/state.js';
import { renderFooter, initFooterClock } from './components/footer.js';


const routes = {};

export function registerRoute(path, handler) {
  routes[path] = handler;
}

export function navigate(path) {
  window.location.hash = path;
}

export function getCurrentRoute() {
  return window.location.hash.slice(1) || '/';
}

function matchRoute(hash) {
  const parts = hash.slice(1).split('?');
  const path = parts[0] || '/';
  const queryString = parts[1] || '';
  
  const searchParams = new URLSearchParams(queryString);
  const search = Object.fromEntries(searchParams.entries());
  
  // Exact match
  if (routes[path]) return { handler: routes[path], params: {}, search };
  
  // Pattern match (e.g., /round/:type)
  for (const [pattern, handler] of Object.entries(routes)) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    if (patternParts.length !== pathParts.length) continue;
    
    const params = {};
    let match = true;
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        match = false;
        break;
      }
    }
    if (match) return { handler, params, search };
  }
  
  return null;
}

// Auth guards
const publicRoutes = ['/', '/login', '/admin/login', '/register', '/leaderboard'];

function checkAuth(path) {
  if (publicRoutes.includes(path)) return true;
  // Allow /register/:slug routes
  if (path.startsWith('/register/')) return true;
  if (!isLoggedIn()) {
    navigate('/login');
    return false;
  }
  if (path.startsWith('/admin') && !isAdmin()) {
    navigate('/login');
    return false;
  }
  // If team is eliminated, redirect to elimination screen
  const user = getState('user');
  if (user?.status === 'eliminated' && !path.startsWith('/eliminated') && !path.startsWith('/leaderboard')) {
    navigate('/eliminated');
    return false;
  }
  return true;
}

export async function handleRoute() {
  const hash = window.location.hash || '#/';
  const fullPath = hash.slice(1) || '/';
  const parts = fullPath.split('?');
  const path = parts[0] || '/';
  
  if (!checkAuth(path)) return;
  
  const result = matchRoute(hash);
  const app = document.getElementById('app');
  
  if (result) {
    app.innerHTML = '';
    app.className = 'page-enter';

    let mockUser = null;
    const teamId = result.search?.preview_team_id;
    if (teamId && teamId !== 'undefined' && teamId !== 'null') {
      try {
        console.log('[Router] Preview Mode - Fetching team:', teamId);
        const { data, error } = await supabase.from('teams').select('*').eq('id', teamId).single();
        if (error) {
          console.error('[Router] Team fetch error:', error.message);
        } else if (data) {
          mockUser = data;
          console.log('[Router] Preview data injected for:', data.team_name);
        }
      } catch (err) {
        console.error('[Router] Unexpected error in preview fetch:', err);
      }
    }

    try {
      await result.handler(app, result.params, result.search, mockUser);
    } catch (handlerErr) {
      console.error('[Router] Handler execution failed:', handlerErr);
      app.innerHTML = `<div class="p-10 text-red-400">Error rendering page: ${handlerErr.message}</div>`;
    }
    // Inject global footer after every page
    const footerEl = document.createElement('div');
    footerEl.innerHTML = renderFooter();
    app.appendChild(footerEl.firstElementChild);
    // tiny delay so SVG defs are painted first
    setTimeout(initFooterClock, 100);
  } else {
    app.innerHTML = `
      <div class="min-h-screen flex items-center justify-center kinetic-bg">
        <div class="text-center space-y-4">
          <h1 class="text-6xl font-headline font-bold text-white">404</h1>
          <p class="text-on-surface-variant">Page not found</p>
          <a href="#/" class="inline-block px-6 py-3 kinetic-gradient rounded-lg text-on-primary-fixed font-bold font-headline">Go Home</a>
        </div>
      </div>
    `;
  }
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
