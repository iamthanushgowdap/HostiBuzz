// Timer utility synced with server time
export class Timer {
  constructor({ durationMs, onTick, onComplete }) {
    this.durationMs = durationMs;
    this.onTick = onTick;
    this.onComplete = onComplete;
    this.remaining = durationMs;
    this.interval = null;
    this.startTime = null;
  }

  start() {
    this.startTime = Date.now();
    this.interval = setInterval(() => {
      const elapsed = Date.now() - this.startTime;
      this.remaining = Math.max(0, this.durationMs - elapsed);
      
      if (this.onTick) this.onTick(this.remaining);
      
      if (this.remaining <= 0) {
        this.stop();
        if (this.onComplete) this.onComplete();
      }
    }, 100);
  }

  startFromServer(startedAt, durationMinutes) {
    const serverStart = new Date(startedAt).getTime() + 10000;
    const totalMs = durationMinutes * 60 * 1000;
    const elapsed = Date.now() - serverStart;
    this.durationMs = totalMs;
    this.remaining = Math.max(0, totalMs - elapsed);
    
    if (this.remaining <= 0) {
      if (this.onComplete) this.onComplete();
      return;
    }
    
    this.startTime = Date.now() - elapsed;
    this.interval = setInterval(() => {
      const e = Date.now() - this.startTime;
      this.remaining = Math.max(0, this.durationMs - e);
      if (this.onTick) this.onTick(this.remaining);
      if (this.remaining <= 0) {
        this.stop();
        if (this.onComplete) this.onComplete();
      }
    }, 100);
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
  
  const elapsed = Date.now() - new Date(round.started_at).getTime();
  const GRACE_MS = 10000; 
  
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
        const e = Date.now() - new Date(round.started_at).getTime();
        const rem = Math.ceil((GRACE_MS - e) / 1000);
        if (rem <= 0) {
          clearInterval(interval);
          overlay.remove();
          renderFn(container);
        } else {
          document.getElementById('pre-round-counter').textContent = rem;
        }
      }, 100);
    }
    return true; 
  }
  return false;
}
