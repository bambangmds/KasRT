import React from 'react';
import { 
  LogOut, 
  Power, 
  RotateCcw, 
  ShieldCheck, 
  Sparkles, 
  XCircle,
  ExternalLink,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { AppLogo } from './AppLogo';
import { useSekretariat } from '../context/SekretariatContext';

interface AppExitScreenProps {
  onReopenApp: () => void;
}

export const AppExitScreen: React.FC<AppExitScreenProps> = ({ onReopenApp }) => {
  const { wilayahShort, sekretariat } = useSekretariat();
  const exitTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const exitDate = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const handleCloseWindow = () => {
    try {
      // Coba berbagai metode penutupan jendela browser yang didukung
      window.open('', '_self', '');
      window.close();
      if (typeof window !== 'undefined' && !window.closed) {
        // Jika browser memblokir window.close() karena alasan keamanan tab reguler
        // Beri umpan balik bahwa tab siap ditutup secara manual
        alert('Browser Anda membatasi penutupan tab otomatis. Silakan tutup tab/jendela ini secara manual.');
      }
    } catch (e) {
      console.warn('Window close prevented by browser security:', e);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-neutral-950 to-orange-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden select-none">
      {/* Dynamic Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden flex items-center justify-center -z-10">
        <div className="absolute top-1/3 -left-20 w-80 h-80 rounded-full bg-orange-600/20 blur-[120px]" />
        <div className="absolute bottom-1/3 -right-20 w-80 h-80 rounded-full bg-red-600/20 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#f97316_1px,transparent_1px)] [background-size:28px_28px] opacity-10" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-300">
        {/* Header Identitas RT */}
        <div className="text-center mb-6">
          <div className="relative inline-block mb-3.5">
            <AppLogo className="w-16 h-16 drop-shadow-2xl relative z-10 opacity-90 grayscale-[20%]" />
            <div className="absolute -bottom-1 -right-1 z-20 w-6 h-6 rounded-full bg-slate-800 ring-2 ring-slate-950 flex items-center justify-center text-slate-400 shadow-md">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold bg-orange-500/20 text-orange-300 border border-orange-400/30 backdrop-blur-md">
              <Sparkles className="w-3 h-3 text-yellow-300" />
              <span>{wilayahShort}</span>
            </span>
            {sekretariat.kelurahan && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/20 text-amber-200 border border-amber-400/30 backdrop-blur-md">
                <span>Kel. {sekretariat.kelurahan}</span>
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-md">
            Sistem Telah Ditutup
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-300 mt-1">
            Anda telah keluar dari Buku Kas {wilayahShort}
          </p>
        </div>

        {/* Card Status Penutupan */}
        <div className="bg-white rounded-2xl border border-amber-500/30 shadow-2xl shadow-black/80 overflow-hidden text-slate-900 relative p-6 sm:p-7">
          <div className="h-1.5 w-full bg-gradient-to-r from-slate-400 via-orange-400 to-amber-500 absolute top-0 left-0" />

          {/* Status Badge */}
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Power className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
                <span className="font-extrabold text-xs text-slate-900">Sesi Telah Selesai</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Halaman login dinonaktifkan demi keamanan akun
              </p>
            </div>
          </div>

          {/* Info Details */}
          <div className="space-y-2.5 text-xs text-slate-600 mb-6 bg-slate-50/60 p-3.5 rounded-xl border border-slate-100">
            <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Status Aplikasi:</span>
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Berhasil Keluar</span>
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Waktu Keluar:</span>
              <span className="font-semibold text-slate-700">{exitTime} WIB</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Tanggal:</span>
              <span className="font-semibold text-slate-700">{exitDate}</span>
            </div>
          </div>

          <p className="text-xs text-slate-600 text-center mb-5 leading-relaxed">
            Anda dapat menutup tab / jendela browser ini sekarang, atau membuka kembali aplikasi di bawah.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={handleCloseWindow}
              className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>Tutup Tab / Keluar</span>
            </button>

            <button
              type="button"
              onClick={onReopenApp}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 hover:from-orange-100 hover:to-amber-100 border border-orange-200 text-orange-950 active:scale-[0.99] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-orange-600" />
              <span>Buka Kembali Halaman Login</span>
            </button>
          </div>
        </div>

        {/* Security Footer */}
        <div className="text-center mt-4">
          <p className="text-[11px] text-slate-400 leading-relaxed flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Kas {wilayahShort}{sekretariat.kelurahan ? `, ${sekretariat.kelurahan}` : ''} • Terproteksi & Akuntabel</span>
          </p>
        </div>
      </div>
    </div>
  );
};
