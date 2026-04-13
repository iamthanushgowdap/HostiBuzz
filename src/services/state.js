// Global state management with pub/sub
const state = {
  user: null,        // { id, team_id, team_name, role, session_token }
  event: null,       // current event
  currentRound: null, // active round
  timer: null,       // { remaining, total }
  listeners: new Map()
};

export function getState(key) {
  return state[key];
}

export function setState(key, value) {
  state[key] = value;
  const listeners = state.listeners.get(key) || [];
  listeners.forEach(fn => fn(value));
}

export function subscribe(key, fn) {
  if (!state.listeners.has(key)) {
    state.listeners.set(key, []);
  }
  state.listeners.get(key).push(fn);
  return () => {
    const list = state.listeners.get(key);
    const idx = list.indexOf(fn);
    if (idx > -1) list.splice(idx, 1);
  };
}

// Persist auth to localStorage
export function saveAuth(userData) {
  localStorage.setItem('hb_auth', JSON.stringify(userData));
  // Clean up old key
  localStorage.removeItem('fh_auth');
  setState('user', userData);
}

export function loadAuth() {
  try {
    // Try new key first, then fall back to old key for migration
    let data = JSON.parse(localStorage.getItem('hb_auth'));
    if (!data) {
      data = JSON.parse(localStorage.getItem('fh_auth'));
      if (data) {
        // Migrate to new key
        localStorage.setItem('hb_auth', JSON.stringify(data));
        localStorage.removeItem('fh_auth');
      }
    }
    if (data) setState('user', data);
    return data;
  } catch { return null; }
}

export function clearAuth() {
  localStorage.removeItem('hb_auth');
  localStorage.removeItem('fh_auth');
  setState('user', null);
}

export function isLoggedIn() {
  return !!getState('user');
}

export function isAdmin() {
  const user = getState('user');
  return user && user.role === 'admin';
}
