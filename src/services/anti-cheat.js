import { supabase } from '../config/supabase.js';
import { getState } from './state.js';

let antiCheatActive = false;
let tabSwitchCount = 0;

export function startAntiCheat(roundId) {
  if (antiCheatActive) return;
  antiCheatActive = true;
  tabSwitchCount = 0;

  // Tab switch detection
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Disable right-click
  document.addEventListener('contextmenu', handleContextMenu);
  
  // Disable copy/paste
  document.addEventListener('copy', handleCopyPaste);
  document.addEventListener('paste', handleCopyPaste);
  document.addEventListener('cut', handleCopyPaste);
}

export function stopAntiCheat() {
  antiCheatActive = false;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  document.removeEventListener('contextmenu', handleContextMenu);
  document.removeEventListener('copy', handleCopyPaste);
  document.removeEventListener('paste', handleCopyPaste);
  document.removeEventListener('cut', handleCopyPaste);
}

function handleVisibilityChange() {
  if (document.hidden) {
    const user = getState('user');
    if (!user) return;
    
    supabase.from('teams').select('tab_switch_count').eq('id', user.id).single().then(({data}) => {
      const dbCount = (data?.tab_switch_count || 0) + 1;
      tabSwitchCount = dbCount;
      
      logAntiCheatEvent('tab_switch', { count: dbCount });
      supabase.from('teams').update({ tab_switch_count: dbCount }).eq('id', user.id).then();
      
      showWarning(`Violation! Window Unfocused. (Flags: ${dbCount})`);
    });
  }
}

function handleContextMenu(e) {
  e.preventDefault();
  logAntiCheatEvent('right_click');
  showWarning('Right-click is disabled during this round.');
}

function handleCopyPaste(e) {
  e.preventDefault();
  logAntiCheatEvent('copy_attempt', { type: e.type });
  showWarning(`${e.type} is disabled during this round.`);
}

function showWarning(message) {
  const existing = document.getElementById('anti-cheat-warning');
  if (existing) existing.remove();
  
  const warning = document.createElement('div');
  warning.id = 'anti-cheat-warning';
  warning.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 bg-error-container/90 backdrop-blur-xl text-on-error-container rounded-xl font-headline font-bold text-sm shadow-2xl';
  warning.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="material-symbols-outlined">warning</span>
      <span>${message}</span>
    </div>
  `;
  document.body.appendChild(warning);
  setTimeout(() => warning.remove(), 3000);
}

async function logAntiCheatEvent(eventType, metadata = {}) {
  const user = getState('user');
  if (!user) return;
  
  await supabase.from('anti_cheat_logs').insert({
    team_id: user.id,
    event_type: eventType,
    metadata
  });
}

export function getTabSwitchCount() {
  return tabSwitchCount;
}
