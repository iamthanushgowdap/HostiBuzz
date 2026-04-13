import { supabase } from '../config/supabase.js';

/**
 * ActivityBroadcast: Handles system-wide real-time event broadcasting.
 * Used for the Live Ticker and Admin alerts.
 */
export const ActivityBroadcast = {
  channel: null,

  init() {
    if (this.channel) return;
    this.channel = supabase.channel('system-activity').subscribe();
  },

  /**
   * Pushes an event to the global ticker.
   * @param {string} type - 'news', 'activity', 'status'
   * @param {string} message - The message to display
   */
  async push(type, message) {
    if (!this.channel) this.init();
    
    await this.channel.send({
      type: 'broadcast',
      event: 'ticker-event',
      payload: {
        type,
        message,
        timestamp: new Date().toISOString()
      }
    });
  }
};
