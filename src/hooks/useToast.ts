import { useState, useCallback } from 'react';

// ============================================
// TYPES
// ============================================

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

interface UseToastReturn {
  /** Current toast to display (or null) */
  toast: Toast | null;
  /** Show a success toast */
  showSuccess: (message: string, duration?: number) => void;
  /** Show an error toast */
  showError: (message: string, duration?: number) => void;
  /** Show an info toast */
  showInfo: (message: string, duration?: number) => void;
  /** Dismiss the current toast */
  dismissToast: () => void;
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_DURATION_MS = 4000;

// ============================================
// HOOK
// ============================================

/**
 * Simple toast notification hook.
 * Shows one toast at a time with auto-dismiss.
 */
export function useToast(): UseToastReturn {
  const [toast, setToast] = useState<Toast | null>(null);
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setToast(null);
  }, [timeoutId]);

  const showToast = useCallback((message: string, type: Toast['type'], duration?: number) => {
    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const id = Date.now().toString();
    const toastDuration = duration ?? DEFAULT_DURATION_MS;

    setToast({ id, message, type, duration: toastDuration });

    // Auto-dismiss after duration
    const newTimeoutId = setTimeout(() => {
      setToast(null);
      setTimeoutId(null);
    }, toastDuration);

    setTimeoutId(newTimeoutId);
  }, [timeoutId]);

  const showSuccess = useCallback((message: string, duration?: number) => {
    showToast(message, 'success', duration);
  }, [showToast]);

  const showError = useCallback((message: string, duration?: number) => {
    showToast(message, 'error', duration);
  }, [showToast]);

  const showInfo = useCallback((message: string, duration?: number) => {
    showToast(message, 'info', duration);
  }, [showToast]);

  return {
    toast,
    showSuccess,
    showError,
    showInfo,
    dismissToast,
  };
}

