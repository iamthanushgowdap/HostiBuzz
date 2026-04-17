import { timeSync } from './timeSync.js';

// Timer utility synced with absolute server time
export class Timer {
  constructor({ durationMs, onTick, onComplete }) {
    this.durationMs = durationMs;
    this.onTick = onTick;
    this.onComplete = onComplete;
    this.remaining = durationMs;
    this.interval = null;
    this.endTime = null;
  }

  start() {
    this.endTime = timeSync.getSyncedTime() + this.durationMs;
    this.interval = setInterval(() => {
      this.remaining = Math.max(0, this.endTime - timeSync.getSyncedTime());
      
      if (this.onTick) this.onTick(this.remaining);
      
      if (this.remaining <= 0) {
        this.stop();
        if (this.onComplete) this.onComplete();
      }
    }, 500); // Optimized for lower CPU load
  }

  startFromServer(startedAt, durationMinutes) {
    // Standardize round start with a server timestamp
    const serverStart = new Date(startedAt).getTime();
    this.durationMs = durationMinutes * 60 * 1000;
    this.endTime = serverStart + this.durationMs;
    
    this.remaining = Math.max(0, this.endTime - timeSync.getSyncedTime());
    
    if (this.remaining <= 0) {
      if (this.onComplete) this.onComplete();
      return;
    }
    
    this.interval = setInterval(() => {
      this.remaining = Math.max(0, this.endTime - timeSync.getSyncedTime());
      if (this.onTick) this.onTick(this.remaining);
      if (this.remaining <= 0) {
        this.stop();
        if (this.onComplete) this.onComplete();
      }
    }, 500);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  static formatTime(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}

export function renderPreRoundCountdown(round, container, renderFn) {
  // Instant Launch Protocol: Overlay disabled as per user request
  return false;
}
