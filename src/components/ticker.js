import { supabase } from '../config/supabase.js';

/**
 * Ticker Component: A fixed-bottom marquee that displays live system activity.
 */
export const Ticker = {
  events: [],
  container: null,
  
  init(parent = document.body) {
    // Remove if already exists
    const existing = document.getElementById('system-ticker');
    if (existing) existing.remove();

    this.container = document.createElement('div');
    this.container.id = 'system-ticker';
    this.container.className = 'fixed bottom-0 left-0 right-0 h-10 bg-white border-t border-outline-variant/10 z-[999] flex items-center overflow-hidden';
    this.container.innerHTML = `
      <div class="ticker-label bg-[#00c853] text-white px-4 h-full flex items-center gap-2 font-headline font-black text-[10px] uppercase tracking-widest whitespace-nowrap z-20 shadow-[8px_0_20px_rgba(0,0,0,0.1)]">
        <span class="material-symbols-outlined text-sm animate-pulse">sensors</span>
        Live Pulse
      </div>
      <div class="ticker-content flex items-center gap-12 px-6 whitespace-nowrap animate-ticker z-10">
        <span class="ticker-item text-black/40 text-[10px] font-bold uppercase tracking-widest italic">Pulse synchronized. Awaiting live transmissions...</span>
      </div>
    `;
    
    parent.appendChild(this.container);
    this.subscribe();
  },

  subscribe() {
    supabase.channel('system-activity')
      .on('broadcast', { event: 'ticker-event' }, ({ payload }) => {
        this.addEvent(payload);
      })
      .subscribe();
  },

  addEvent({ type, message }) {
    const icon = type === 'news' ? '📢' : type === 'activity' ? '⚡' : '💠';
    const color = 'text-black';
    
    const eventEl = document.createElement('span');
    eventEl.className = `ticker-item ${color} text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 slide-in-bottom`;
    eventEl.innerHTML = `<span class="opacity-30">${icon}</span> ${message}`;

    const content = this.container.querySelector('.ticker-content');
    
    // Clear initial message if needed
    if (content.children.length === 1 && content.children[0].classList.contains('opacity-50')) {
      content.innerHTML = '';
    }

    content.prepend(eventEl);

    // Limit to 10 events for performance
    if (content.children.length > 10) {
      content.lastElementChild.remove();
    }
  }
};
