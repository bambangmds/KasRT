import React, { useState } from 'react';
import { usePWAInstall } from '../lib/usePWAInstall';
import { Download, Laptop, Smartphone, X, ArrowUpToLine } from 'lucide-react';

interface PWAInstallButtonProps {
  theme: 'sapphire' | 'indigo' | 'emerald';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ theme }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  const themeColors = {
    sapphire: 'bg-blue-600 hover:bg-blue-700 shadow-blue-100',
    indigo: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100',
    emerald: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100',
  };

  const btnColor = themeColors[theme] || themeColors.sapphire;

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer select-none ${btnColor}`}
        title="Pasang aplikasi Kas RT ke layar utama HP atau komputer Anda"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden xs:inline">Pasang Aplikasi</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer select-none"
          title="Petunjuk pasang aplikasi Kas RT di iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5 text-rose-500" />
          <span className="hidden xs:inline">Pasang PWA</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-150 text-xs font-semibold">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3.5">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-slate-800" />
                  <h3 className="text-sm font-extrabold text-slate-900">Pasang di iPhone / iPad</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3.5 text-slate-600 font-medium leading-relaxed">
                <p>
                  Aplikasi **Kas RT.002 RW.09** dapat diinstal di gawai iOS Anda (Safari) tanpa perlu App Store:
                </p>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 shrink-0 text-[10px]">
                      1
                    </div>
                    <p className="pt-0.5">
                      Ketuk tombol <strong className="text-slate-800 flex items-center gap-1 inline-flex bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">Bagikan <ArrowUpToLine className="w-3.5 h-3.5 text-blue-600 inline" /></strong> di bilah menu bawah Safari.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 shrink-0 text-[10px]">
                      2
                    </div>
                    <p className="pt-0.5">
                      Gulir ke bawah, lalu ketuk pilihan <strong className="text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">Tambahkan ke Layar Utama</strong>.
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-amber-600 italic">
                  *Setelah ditambahkan, aplikasi akan tampil di beranda HP Anda layaknya aplikasi asli dan siap menerima alarm darurat warga.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4.5 w-full rounded-xl bg-slate-900 hover:bg-slate-800 py-2.5 font-bold text-white text-xs cursor-pointer text-center"
              >
                Mengerti, Terima Kasih
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Desktop or un-installable fallback
  return null;
};
