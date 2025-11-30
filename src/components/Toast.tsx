import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import type { Toast as ToastType } from '../hooks/useToast';

// ============================================
// TOAST COMPONENT
// ============================================

interface ToastProps {
  toast: ToastType;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const styles = {
    success: {
      bg: 'bg-green-500/95',
      icon: <CheckCircle size={20} className="text-white" />,
    },
    error: {
      bg: 'bg-red-500/95',
      icon: <XCircle size={20} className="text-white" />,
    },
    info: {
      bg: 'bg-blue-500/95',
      icon: <Info size={20} className="text-white" />,
    },
  };

  const style = styles[toast.type];

  return (
    <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-[9999] animate-slide-up">
      <div
        className={`${style.bg} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 min-w-[280px] max-w-[90vw]`}
      >
        {style.icon}
        <span className="flex-1 text-sm font-medium">{toast.message}</span>
        <button
          onClick={onDismiss}
          className="text-white/80 hover:text-white transition-colors p-1 -mr-1"
          aria-label="Lukk"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

// ============================================
// TOAST CONTAINER (for rendering in App)
// ============================================

interface ToastContainerProps {
  toast: ToastType | null;
  onDismiss: () => void;
}

export function ToastContainer({ toast, onDismiss }: ToastContainerProps) {
  if (!toast) return null;
  return <Toast toast={toast} onDismiss={onDismiss} />;
}

