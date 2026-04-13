/**
 * Singleton Notifier Service
 * Manages global dynamic UI components (Toasts & Modals)
 */

class NotifierService {
  constructor() {
    this.toasts = [];
    this.modalStack = [];
    this.initContainers();
  }

  initContainers() {
    if (document.getElementById('notifier-root')) return;

    const root = document.createElement('div');
    root.id = 'notifier-root';
    root.className = 'fixed inset-0 pointer-events-none z-[9999] overflow-hidden';
    root.innerHTML = `
      <div id="toast-container" class="fixed top-6 right-6 flex flex-col gap-3 items-end w-80 pointer-events-none"></div>
      <div id="modal-container" class="fixed inset-0 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm opacity-0 pointer-events-none transition-opacity duration-300 z-50"></div>
    `;
    document.body.appendChild(root);
  }

  /**
   * Show a temporary toast notification
   * @param {string} msg - Message to display
   * @param {'info'|'success'|'error'|'kinetic'} type - Type of toast
   * @param {number} duration - Time in ms before auto-dismiss (0 = manual)
   */
  toast(msg, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const id = 'toast-' + Math.random().toString(36).substr(2, 9);
    const toast = document.createElement('div');
    toast.id = id;
    toast.className = `
      group pointer-events-auto flex items-start gap-4 p-4 rounded-2xl glass-panel 
      border-l-4 shadow-2xl transition-all duration-500 translate-x-full opacity-0
      ${type === 'success' ? 'border-primary' : type === 'error' ? 'border-error' : type === 'kinetic' ? 'border-secondary' : 'border-outline'}
    `;

    const icon = type === 'success' ? 'verified' : type === 'error' ? 'report' : type === 'kinetic' ? 'bolt' : 'info';
    const iconColor = type === 'success' ? 'text-primary' : type === 'error' ? 'text-error' : type === 'kinetic' ? 'text-secondary' : 'text-on-surface-variant';

    toast.innerHTML = `
      <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
        <span class="material-symbols-outlined ${iconColor} text-xl">${icon}</span>
      </div>
      <div class="flex-1 pt-1">
        <p class="text-sm font-headline font-bold text-white leading-tight">${msg}</p>
      </div>
      <button class="toast-close opacity-0 group-hover:opacity-100 transition-opacity p-1 text-on-surface-variant hover:text-white">
        <span class="material-symbols-outlined text-sm">close</span>
      </button>
      <div class="absolute bottom-0 left-0 h-1 bg-white/10 w-full overflow-hidden rounded-full">
        <div class="h-full ${type === 'kinetic' ? 'kinetic-gradient' : 'bg-primary'} toast-timer-bar" style="width: 100%"></div>
      </div>
    `;

    container.appendChild(toast);

    // Trigger animate-in
    requestAnimationFrame(() => {
      toast.classList.remove('translate-x-full', 'opacity-0');
    });

    const closeBtn = toast.querySelector('.toast-close');
    const dismiss = () => {
      toast.classList.add('translate-x-full', 'opacity-0');
      setTimeout(() => toast.remove(), 500);
    };

    closeBtn.addEventListener('click', dismiss);

    if (duration > 0) {
      const bar = toast.querySelector('.toast-timer-bar');
      bar.style.transition = `width ${duration}ms linear`;
      requestAnimationFrame(() => {
        bar.style.width = '0%';
      });
      setTimeout(dismiss, duration);
    }
  }

  /**
   * Show a persistent modal dialog
   * @param {Object} options - Modal configuration
   */
  modal({ title, body, icon, type, showConfirm = false, confirmText = 'Confirm', onConfirm, onCancel }) {
    const container = document.getElementById('modal-container');
    if (!container) return;

    container.innerHTML = `
      <div class="glass-panel p-8 rounded-[32px] max-w-lg w-full border border-white/10 shadow-[0_30px_70px_rgba(0,0,0,0.5)] scale-95 opacity-0 transition-all duration-300">
        <div class="flex flex-col items-center text-center gap-6">
          <div class="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center relative glow-accent">
            <span class="material-symbols-outlined text-4xl ${type === 'error' ? 'text-error' : type === 'success' ? 'text-primary' : 'text-secondary'}">${icon || 'info'}</span>
          </div>
          <div>
            <h2 class="text-3xl font-headline font-bold text-white tracking-tighter mb-2">${title}</h2>
            <div class="text-on-surface-variant text-base leading-relaxed">${body}</div>
          </div>
          <div class="flex gap-4 w-full pt-4">
            ${showConfirm ? `
              <button id="modal-cancel-btn" class="flex-1 py-4 bg-white/5 text-white font-headline font-bold rounded-2xl hover:bg-white/10 transition-all">Cancel</button>
              <button id="modal-confirm-btn" class="flex-1 py-4 kinetic-gradient text-on-primary-fixed font-headline font-bold rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all">
                ${confirmText}
              </button>
            ` : `
              <button id="modal-close-btn" class="w-full py-4 kinetic-gradient text-on-primary-fixed font-headline font-bold rounded-2xl">Close</button>
            `}
          </div>
        </div>
      </div>
    `;

    const modalBox = container.querySelector('div');
    
    const show = () => {
      container.classList.remove('pointer-events-none');
      container.classList.add('pointer-events-auto');
      container.classList.add('opacity-100');
      requestAnimationFrame(() => {
        modalBox.classList.remove('scale-95', 'opacity-0');
      });
    };

    const close = () => {
      modalBox.classList.add('scale-95', 'opacity-0');
      container.classList.remove('opacity-100');
      setTimeout(() => {
        container.classList.add('pointer-events-none');
        container.classList.remove('pointer-events-auto');
        container.innerHTML = '';
      }, 300);
    };

    show();

    if (showConfirm) {
      container.querySelector('#modal-confirm-btn').addEventListener('click', async () => {
        if (onConfirm) await onConfirm();
        close();
      });
      container.querySelector('#modal-cancel-btn').addEventListener('click', () => {
        if (onCancel) onCancel();
        close();
      });
    } else {
      container.querySelector('#modal-close-btn').addEventListener('click', close);
    }
  }
}

export const Notifier = new NotifierService();
