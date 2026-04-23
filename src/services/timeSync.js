import { supabase } from '../config/supabase.js';

class TimeSync {
  constructor() {
    this.offset = 0; // ServerTime - LocalTime
    this.isSynced = false;
  }

  async sync() {
    try {
      const t0 = Date.now();
      let serverTime = null;
      let latency = 0;
      
      // Attempt 1: get server time via RPC
      const { data, error } = await supabase.rpc('get_server_time');
      
      if (!error && data) {
        const t1 = Date.now();
        serverTime = new Date(data).getTime();
        latency = (t1 - t0) / 2;
      } else {
        console.warn('TimeSync: RPC get_server_time failed. Falling back to HTTP Date Header.');
        // Attempt 2: get server time via HTTP Date header (1-second precision, but better than local drift)
        try {
          const tHead0 = Date.now();
          const res = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' });
          const dateHeader = res.headers.get('Date');
          if (dateHeader) {
            const tHead1 = Date.now();
            serverTime = new Date(dateHeader).getTime();
            latency = (tHead1 - tHead0) / 2;
          }
        } catch (httpErr) {
          console.warn('TimeSync: HTTP Date fetch failed.', httpErr);
        }
      }

      if (serverTime) {
        const tFinal = Date.now();
        // Calculate offset
        this.offset = (serverTime + latency) - tFinal;
        this.isSynced = true;
        console.log(`TimeSync: Offset calculated as ${this.offset}ms (Latency: ${latency}ms)`);
      } else {
        console.warn('TimeSync: All sync methods failed. Falling back to default local time.');
        this.offset = 0;
        this.isSynced = false;
      }
    } catch (err) {
      console.error('TimeSync: Failed to sync clock.', err);
      this.offset = 0;
    }
  }

  getSyncedTime() {
    return Date.now() + this.offset;
  }

  getOffset() {
    return this.offset;
  }
}

export const timeSync = new TimeSync();
