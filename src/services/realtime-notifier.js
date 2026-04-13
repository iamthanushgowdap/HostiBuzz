import { supabase } from '../config/supabase.js';
import { getState } from './state.js';
import { Notifier } from './notifier.js';
import { navigate } from '../router.js';

/**
 * Real-time Notifier Service
 * Listens for Supabase broadcast and DB events to trigger global UI feedback.
 */

export function initRealtimeNotifier() {
  const user = getState('user');
  if (!user || user.role === 'admin') return;

  // 1. Listen for Round Status Changes
  supabase
    .channel('round-status')
    .on('postgres_changes', { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'rounds',
      filter: `event_id=eq.${user.event_id}`
    }, (payload) => {
      const { new: round } = payload;
      
      if (round.status === 'active') {
        Notifier.modal({
          title: 'Round Started!',
          body: `<b>${round.title}</b> is now live. Good luck, team!`,
          icon: 'bolt',
          type: 'kinetic',
          confirmText: 'Enter Round',
          showConfirm: true,
          onConfirm: () => {
            navigate(`/round/${round.round_type}`);
          }
        });
        Notifier.toast(`NEW ROUND: ${round.title}`, 'kinetic');
      } else if (round.status === 'completed') {
        Notifier.toast(`Round ${round.round_number} has ended.`, 'info');
      }
    })
    .subscribe();

  // 2. Listen for Personal Scoring Updates
  supabase
    .channel('score-updates')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'scores'
    }, (payload) => {
      const { new: score } = payload;
      if (score.team_id === user.id) {
        Notifier.toast('Evaluation Received! Check your dashboard for details.', 'success');
      }
    })
    .subscribe();

  // 3. Listen for Global Broadcasts (Admin Campaign)
  supabase
    .channel('global-system')
    .on('broadcast', { event: 'notification' }, (response) => {
      console.log('⚡ Received Broadcast:', response);
      
      // Support both flat and nested structures in Supabase Realtime v2
      const data = response.payload || response;
      const { message, event_id } = data;
      
      // Success check: display if ID matches or if it's a true global broadcast
      if (message && (!event_id || event_id === user.event_id)) {
        Notifier.modal({
          title: 'Broadcast from Admin',
          body: message,
          icon: 'campaign',
          type: 'info'
        });
      } else if (!message) {
        console.error('🛑 Received malformed broadcast (missing message):', response);
      } else {
        console.warn(`🛑 Broadcast filtered: Target ${event_id} != User ${user.event_id}`);
      }
    })
    .subscribe((status) => {
      console.log(`📡 Broadcast channel status: ${status}`);
    });
}
