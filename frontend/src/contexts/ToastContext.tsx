import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextData {
  showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextData>({} as ToastContextData);

const TOAST_STYLES: Record<
  ToastType,
  {
    container: string;
    icon: React.ReactNode;
    closeBtn: string;
  }
> = {
  success: {
    container: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
    closeBtn: 'hover:bg-emerald-200 text-emerald-700',
  },
  error: {
    container: 'bg-red-50 text-red-900 border-red-200',
    icon: <XCircle className="w-5 h-5 text-red-500 shrink-0" />,
    closeBtn: 'hover:bg-red-200 text-red-700',
  },
  info: {
    container: 'bg-blue-50 text-blue-900 border-blue-200',
    icon: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
    closeBtn: 'hover:bg-blue-200 text-blue-700',
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);

    // Remove o alerta automaticamente após 4 segundos
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Container fixo no canto inferior direito */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
        {toasts.map((toast) => {
          const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;

          return (
            <div
              key={toast.id}
              className={`flex items-center gap-3 min-w-[280px] max-w-sm p-4 rounded-xl shadow-xl border transition-all duration-300 ${style.container}`}
            >
              {style.icon}
              <p className="text-sm font-semibold flex-1">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className={`p-1 rounded-md transition cursor-pointer ${style.closeBtn}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);