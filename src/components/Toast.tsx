import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { ToastInfo } from '../types';

interface ToastProps {
  toast: ToastInfo | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  if (!toast) return null;

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-white bg-slate-900 border border-slate-700/80 animate-in fade-in slide-in-from-bottom-5 duration-300"
      role="alert"
    >
      {isSuccess ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
      ) : isError ? (
        <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
      ) : (
        <Info className="w-5 h-5 text-sky-400 shrink-0" />
      )}
      <div className="flex flex-col">
        <span className="text-xs font-bold text-white">
          {toast.title || (isSuccess ? 'Berhasil' : 'Pemberitahuan')}
        </span>
        <span className="text-xs text-slate-300">{toast.message}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="ml-2 text-slate-400 hover:text-white transition-colors cursor-pointer p-1 rounded-md hover:bg-white/10"
        aria-label="Tutup notifikasi"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
