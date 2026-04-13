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
    this.container.className = 'fixed bottom-0 left-0 right-0 h-10 bg-black/90 backdrop-blur-xl border-t border-primary/20 z-[999] flex items-center overflow-hidden';
    this.container.innerHTML = `
      <div class="ticker-label bg-primary text-on-primary-fixed px-3 h-full flex items-center font-headline font-black text-[10px] uppercase tracking-widest whitespace-nowrap z-10 shadow-[5px_0_15px_rgba(0,0,0,0.5)]">
        Live Pulse
      </div>
      <div class="ticker-content flex items-center gap-12 px-6 whitespace-nowrap animate-ticker">
        <span class="ticker-item text-on-surface-variant text-[10px] font-bold uppercase tracking-widest italic opacity-50">Pulse synchronized. Awaiting live transmissions...</span>
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
    const color = type === 'news' ? 'text-secondary' : type === 'activity' ? 'text-primary' : 'text-on-surface-variant';
    
    const eventEl = document.createElement('span');
    eventEl.className = `ticker-item ${color} text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 slide-in-bottom`;
    eventEl.innerHTML = `<span class="opacity-50">${icon}</span> ${message}`;

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
