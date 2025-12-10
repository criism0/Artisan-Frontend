// Custom toast system to replace react-toastify for React 19 compatibility
class ToastManager {
  constructor() {
    this.toasts = new Map();
    this.container = null;
    this.init();
  }

  init() {
    // Create toast container if it doesn't exist
    if (!document.getElementById('toast-container')) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        pointer-events: none;
      `;
      document.body.appendChild(this.container);
    } else {
      this.container = document.getElementById('toast-container');
    }
  }

  createToast(message, type = 'info', duration = 5000) {
    const toastId = Date.now() + Math.random();
    const toast = document.createElement('div');
    
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };

    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    toast.style.cssText = `
      background: ${colors[type]};
      color: white;
      padding: 12px 16px;
      margin-bottom: 8px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      pointer-events: auto;
      cursor: pointer;
      max-width: 400px;
      word-wrap: break-word;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    toast.innerHTML = `
      <span style="font-size: 16px;">${icons[type]}</span>
      <span style="flex: 1;">${message}</span>
      <button style="
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        margin-left: 8px;
      " onclick="this.parentElement.remove()">×</button>
    `;

    // Add click to close
    toast.addEventListener('click', () => {
      this.removeToast(toastId);
    });

    this.container.appendChild(toast);
    this.toasts.set(toastId, toast);

    // Animate in
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    }, 10);

    // Auto remove
    if (duration > 0) {
      setTimeout(() => {
        this.removeToast(toastId);
      }, duration);
    }

    return toastId;
  }

  removeToast(toastId) {
    const toast = this.toasts.get(toastId);
    if (toast) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (toast.parentElement) {
          toast.parentElement.removeChild(toast);
        }
        this.toasts.delete(toastId);
      }, 300);
    }
  }

  success(message, options = {}) {
    return this.createToast(message, 'success', options.autoClose || 5000);
  }

  error(message, options = {}) {
    return this.createToast(message, 'error', options.autoClose || 7000);
  }

  info(message, options = {}) {
    return this.createToast(message, 'info', options.autoClose || 5000);
  }

  warning(message, options = {}) {
    return this.createToast(message, 'warning', options.autoClose || 6000);
  }

  dismiss(toastId) {
    this.removeToast(toastId);
  }
}

// Create global instance
const toastManager = new ToastManager();

// Export toast functions
export const toast = {
  success: (message, options = {}) => toastManager.success(message, options),
  error: (message, options = {}) => toastManager.error(message, options),
  info: (message, options = {}) => toastManager.info(message, options),
  warning: (message, options = {}) => toastManager.warning(message, options),
  dismiss: (toastId) => toastManager.dismiss(toastId)
};

export default toast;
