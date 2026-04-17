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
  if (round.status !== 'active' || !round.started_at) return false;
  
  const serverStart = new Date(round.started_at).getTime();
  const now = timeSync.getSyncedTime();
  const elapsed = now - serverStart;
  const GRACE_MS = 5000; // Synchronized with Admin Future-Start Buffer
  
  if (elapsed < GRACE_MS) {
    const remainingSeconds = Math.ceil((GRACE_MS - elapsed) / 1000);
    
    let overlay = document.getElementById('pre-round-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'pre-round-overlay';
      overlay.className = 'fixed inset-0 bg-black/90 backdrop-blur-md z-[99] flex flex-col items-center justify-center';
      overlay.innerHTML = `
        <h2 class="text-3xl md:text-5xl font-headline font-bold text-secondary tracking-widest uppercase mb-4 animate-[bounce_1s_infinite] text-center drop-shadow-md">Round Starting In</h2>
        <div id="pre-round-counter" class="text-[8rem] md:text-[12rem] font-headline font-black text-white tabular-nums drop-shadow-[0_0_40px_rgba(255,255,255,0.3)]">${remainingSeconds}</div>
        <p class="text-on-surface-variant text-sm md:text-base mt-2 tracking-widest uppercase font-bold text-center">Get ready! Do not switch tabs.</p>
      `;
      container.appendChild(overlay);
      
      const interval = setInterval(() => {
        const e = timeSync.getSyncedTime() - serverStart;
        const rem = Math.ceil((GRACE_MS - e) / 1000);
        if (rem <= 0) {
          clearInterval(interval);
          overlay.remove();
          renderFn(container);
        } else {
          const el = document.getElementById('pre-round-counter');
          if (el) el.textContent = rem;
        }
      }, 200);
    }
    return true; 
  }
  return false;
}
