import { supabase } from '../config/supabase.js';

class TimeSync {
  constructor() {
    this.offset = 0; // ServerTime - LocalTime
    this.isSynced = false;
  }

  async sync() {
    try {
      const t0 = Date.now();
      
      // Attempt to get server time via RPC
      const { data, error } = await supabase.rpc('get_server_time');
      
      if (error) {
        console.warn('TimeSync: RPC get_server_time not found. Falling back to local time.');
        return;
      }

      const t1 = Date.now();
      const serverTime = new Date(data).getTime();
      
      // Latency compensation (half of round-trip time)
      const latency = (t1 - t0) / 2;
      
      // Calculate offset
      this.offset = (serverTime + latency) - t1;
      this.isSynced = true;
      
      console.log(`TimeSync: Offset calculated as ${this.offset}ms (Latency: ${latency}ms)`);
    } catch (err) {
      console.error('TimeSync: Failed to sync clock.', err);
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
