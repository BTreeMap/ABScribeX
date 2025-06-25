/**
 * Modern Dialog Component Library for ABScribeX
 * Provides fancy UI/UX dialogs that work across different browser contexts
 * 
 * Features:
 * - Modern, accessible design
 * - Animation and transitions
 * - Keyboard navigation
 * - Focus management
 * - Backdrop blur effects
 * - Responsive design
 * - TypeScript support
 */

import { BrowserContext } from './domUtils';

export interface DialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'error' | 'success' | 'question';
  showCancel?: boolean;
  timeout?: number; // Auto-close after N milliseconds
  onShow?: () => void;
  onHide?: () => void;
}

export interface DialogResult {
  confirmed: boolean;
  cancelled: boolean;
  timedOut: boolean;
}

/**
 * Factory function to create dialog utilities with injected browser context
 */
export function createDialogUtils(context?: BrowserContext) {
  // Capture browser context once using closure
  const doc = context?.document || (typeof document !== 'undefined' ? document : null);
  const win = context?.window || (typeof window !== 'undefined' ? window : null);

  if (!doc || !win) {
    throw new Error('Dialog utilities can only be created in browser context');
  }

  // Unique ID counter for multiple dialogs
  let dialogCounter = 0;

  /**
   * Create and inject CSS styles for the dialog
   */
  const injectStyles = (): void => {
    const styleId = 'abscribe-dialog-styles';

    // Check if styles already exist
    if (doc.getElementById(styleId)) {
      return;
    }

    const style = doc.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* ABScribeX Dialog Styles */
      .abscribe-dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 999999;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        box-sizing: border-box;
        opacity: 0;
        transition: opacity 0.3s ease;
        animation: abscribe-fade-in 0.3s ease forwards;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', sans-serif;
      }

      .abscribe-dialog {
        background: #ffffff;
        border-radius: 16px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        max-width: 480px;
        width: 100%;
        max-height: calc(100vh - 40px);
        overflow: hidden;
        transform: scale(0.9) translateY(20px);
        transition: transform 0.3s ease;
        animation: abscribe-scale-in 0.3s ease forwards;
        border: 1px solid #e5e7eb;
        margin: auto;
        display: flex;
        flex-direction: column;
      }

      .abscribe-dialog-header {
        padding: 24px 24px 16px 24px;
        display: flex;
        align-items: flex-start;
        gap: 16px;
        flex-shrink: 0;
      }

      .abscribe-dialog-icon {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        flex-shrink: 0;
      }

      .abscribe-dialog-icon.info {
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        color: white;
      }

      .abscribe-dialog-icon.warning {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: white;
      }

      .abscribe-dialog-icon.error {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: white;
      }

      .abscribe-dialog-icon.success {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
      }

      .abscribe-dialog-icon.question {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .abscribe-dialog-content {
        flex: 1;
        min-width: 0;
      }

      .abscribe-dialog-title {
        margin: 0 0 8px 0;
        font-size: 20px;
        font-weight: 600;
        color: #111827;
        line-height: 1.3;
        word-wrap: break-word;
      }

      .abscribe-dialog-message {
        margin: 0;
        font-size: 14px;
        color: #6b7280;
        line-height: 1.5;
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow-wrap: break-word;
      }

      .abscribe-dialog-footer {
        padding: 16px 24px 24px 24px;
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        align-items: center;
        flex-wrap: wrap;
        flex-shrink: 0;
        border-top: 1px solid #f3f4f6;
        margin-top: auto;
      }

      .abscribe-dialog-button {
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 2px solid transparent;
        outline: none;
        min-width: 100px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        text-align: center;
        white-space: nowrap;
      }

      .abscribe-dialog-button:focus {
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      .abscribe-dialog-button.primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-color: transparent;
      }

      .abscribe-dialog-button.primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      }

      .abscribe-dialog-button.primary:active {
        transform: translateY(0);
      }

      .abscribe-dialog-button.secondary {
        background: transparent;
        color: #6b7280;
        border-color: #d1d5db;
      }

      .abscribe-dialog-button.secondary:hover {
        background: #f9fafb;
        border-color: #9ca3af;
        color: #374151;
      }

      .abscribe-dialog-loading {
        width: 16px;
        height: 16px;
        border: 2px solid currentColor;
        border-top: 2px solid transparent;
        border-radius: 50%;
        animation: abscribe-spin 1s linear infinite;
      }

      /* Animations */
      @keyframes abscribe-fade-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes abscribe-scale-in {
        from {
          transform: scale(0.9) translateY(20px);
        }
        to {
          transform: scale(1) translateY(0);
        }
      }

      @keyframes abscribe-scale-out {
        from {
          transform: scale(1) translateY(0);
        }
        to {
          transform: scale(0.9) translateY(20px);
        }
      }

      @keyframes abscribe-spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      /* Responsive design */
      @media (max-width: 640px) {
        .abscribe-dialog-overlay {
          padding: 16px;
        }

        .abscribe-dialog {
          width: 100%;
          max-width: none;
          max-height: calc(100vh - 32px);
        }

        .abscribe-dialog-header {
          padding: 20px 20px 16px 20px;
          gap: 12px;
        }

        .abscribe-dialog-icon {
          width: 40px;
          height: 40px;
          font-size: 20px;
        }

        .abscribe-dialog-title {
          font-size: 18px;
        }

        .abscribe-dialog-footer {
          padding: 16px 20px 20px 20px;
          flex-direction: column-reverse;
          gap: 8px;
        }

        .abscribe-dialog-button {
          width: 100%;
          min-width: unset;
        }
      }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .abscribe-dialog {
          background: #1f2937;
          border-color: #374151;
        }

        .abscribe-dialog-title {
          color: #f9fafb;
        }

        .abscribe-dialog-message {
          color: #d1d5db;
        }

        .abscribe-dialog-footer {
          border-top-color: #374151;
        }

        .abscribe-dialog-button.secondary {
          color: #d1d5db;
          border-color: #4b5563;
        }

        .abscribe-dialog-button.secondary:hover {
          background: #374151;
          border-color: #6b7280;
          color: #f3f4f6;
        }
      }
    `;

    doc.head.appendChild(style);
  };

  /**
   * Get icon for dialog type
   */
  const getIconForType = (type: DialogOptions['type']): string => {
    switch (type) {
      case 'info': return 'ℹ️';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'success': return '✅';
      case 'question': return '❓';
      default: return 'ℹ️';
    }
  };

  /**
   * Create and show a modern dialog
   */
  const showDialog = (options: DialogOptions): Promise<DialogResult> => {
    return new Promise((resolve) => {
      // Inject styles
      injectStyles();

      // Generate unique dialog ID
      const dialogId = `abscribe-dialog-${++dialogCounter}`;

      // Create dialog elements
      const overlay = doc.createElement('div');
      overlay.className = 'abscribe-dialog-overlay';
      overlay.id = dialogId;

      const dialog = doc.createElement('div');
      dialog.className = 'abscribe-dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', `${dialogId}-title`);
      dialog.setAttribute('aria-describedby', `${dialogId}-message`);

      const header = doc.createElement('div');
      header.className = 'abscribe-dialog-header';

      const icon = doc.createElement('div');
      icon.className = `abscribe-dialog-icon ${options.type || 'info'}`;
      icon.textContent = getIconForType(options.type);

      const content = doc.createElement('div');
      content.className = 'abscribe-dialog-content';

      const title = doc.createElement('h2');
      title.className = 'abscribe-dialog-title';
      title.id = `${dialogId}-title`;
      title.textContent = options.title;

      const message = doc.createElement('p');
      message.className = 'abscribe-dialog-message';
      message.id = `${dialogId}-message`;
      message.textContent = options.message;

      const footer = doc.createElement('div');
      footer.className = 'abscribe-dialog-footer';

      // Build dialog structure
      content.appendChild(title);
      content.appendChild(message);
      header.appendChild(icon);
      header.appendChild(content);
      dialog.appendChild(header);

      // Timeout handling
      let timeoutId: number | null = null;
      let isResolved = false;

      // Store current focus to restore later
      const previousActiveElement = doc.activeElement as HTMLElement;

      // Cleanup function to restore focus
      const originalResolve = resolve;
      const cleanupAndResolve = (result: DialogResult) => {
        doc.removeEventListener('keydown', handleKeyDown);
        if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
          try {
            previousActiveElement.focus();
          } catch (e) {
            // Ignore focus errors
          }
        }
        originalResolve(result);
      };

      // Override the resolve calls to use cleanup function
      const resolveWithCleanup = (result: DialogResult) => {
        if (isResolved) return;
        isResolved = true;

        if (timeoutId) {
          win.clearTimeout(timeoutId);
        }

        options.onHide?.();

        // Animate out
        overlay.style.animation = 'abscribe-fade-in 0.2s ease reverse forwards';
        dialog.style.animation = 'abscribe-scale-out 0.2s ease forwards';

        setTimeout(() => {
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
          cleanupAndResolve(result);
        }, 200);
      };

      const resolveDialog = resolveWithCleanup;

      // Create buttons
      if (options.showCancel !== false) {
        const cancelButton = doc.createElement('button');
        cancelButton.className = 'abscribe-dialog-button secondary';
        cancelButton.textContent = options.cancelText || 'Cancel';
        cancelButton.addEventListener('click', () => {
          resolveDialog({ confirmed: false, cancelled: true, timedOut: false });
        });
        footer.appendChild(cancelButton);
      }

      const confirmButton = doc.createElement('button');
      confirmButton.className = 'abscribe-dialog-button primary';
      confirmButton.textContent = options.confirmText || 'OK';
      confirmButton.addEventListener('click', () => {
        resolveDialog({ confirmed: true, cancelled: false, timedOut: false });
      });
      footer.appendChild(confirmButton);

      dialog.appendChild(footer);
      overlay.appendChild(dialog);

      // Keyboard handling
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && options.showCancel !== false) {
          e.preventDefault();
          resolveDialog({ confirmed: false, cancelled: true, timedOut: false });
        } else if (e.key === 'Enter') {
          e.preventDefault();
          resolveDialog({ confirmed: true, cancelled: false, timedOut: false });
        }
      };

      // Click outside to close (if cancel is allowed)
      const handleOverlayClick = (e: MouseEvent) => {
        if (e.target === overlay && options.showCancel !== false) {
          resolveDialog({ confirmed: false, cancelled: true, timedOut: false });
        }
      };

      // Set up event listeners
      doc.addEventListener('keydown', handleKeyDown);
      overlay.addEventListener('click', handleOverlayClick);

      // Setup timeout
      if (options.timeout && options.timeout > 0) {
        timeoutId = win.setTimeout(() => {
          resolveDialog({ confirmed: false, cancelled: false, timedOut: true });
        }, options.timeout);
      }

      // Add to DOM and focus
      doc.body.appendChild(overlay);

      // Focus management
      setTimeout(() => {
        confirmButton.focus();
        options.onShow?.();
      }, 100);
    });
  };

  /**
   * Show a confirmation dialog (like the original showChoiceDialog)
   */
  const showConfirmDialog = async (title: string, message: string, options?: Partial<DialogOptions>): Promise<boolean> => {
    const result = await showDialog({
      title,
      message,
      type: 'question',
      confirmText: 'OK',
      cancelText: 'Cancel',
      showCancel: true,
      ...options
    });
    return result.confirmed;
  };

  /**
   * Show an alert dialog
   */
  const showAlert = async (title: string, message: string, options?: Partial<DialogOptions>): Promise<void> => {
    await showDialog({
      title,
      message,
      type: 'info',
      confirmText: 'OK',
      showCancel: false,
      ...options
    });
    return;
  };

  /**
   * Show a choice dialog specifically for document overwrite scenarios
   */
  const showDocumentOverwriteDialog = (documentId: string): Promise<boolean> => {
    console.log(`Showing document overwrite dialog for document ID: ${documentId}`);
    return showConfirmDialog(
      'Content Conflict Detected',
      `The content in ABScribe differs from what's currently on the webpage.\n\nChoose which version to keep:`,
      {
        type: 'warning',
        confirmText: 'Use Webpage Content',
        cancelText: 'Keep ABScribe Content',
        timeout: 30000 // 30 second timeout
      }
    );
  };

  return {
    showDialog,
    showConfirmDialog,
    showAlert,
    showDocumentOverwriteDialog,
    injectStyles
  };
}

// Default export for use in browser context
export const DialogUtils = createDialogUtils();
