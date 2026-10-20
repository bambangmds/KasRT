import React, { useState } from 'react';
import { ShieldAlert, Phone, MapPin, CheckCircle, VolumeX, Users, Navigation, Copy, Check } from 'lucide-react';
import { EmergencyAlertItem } from '../lib/supabase';

interface DaruratSirenModalProps {
  alerts: EmergencyAlertItem[];
  onDismissSiren: () => void;
  onResolveAlert: (id: string) => void;
  onConfirmComing: (alert: EmergencyAlertItem) => void;
  isAudioPlaying: boolean;
}

export const DaruratSirenModal: React.FC<DaruratSirenModalProps> = ({
  alerts,
  onDismissSiren,
  onResolveAlert,
  onConfirmComing,
  isAudioPlaying,
}) => {
  const [copied, setCopied] = useState(false);

  if (alerts.length === 0) return null;

  // Prioritize the latest alert
  const primaryAlert = alerts[0];

  const createWhatsAppText = (alert: EmergencyAlertItem) => {
    return (
      `🚨 *PANGGILAN DARURAT SOS RT.002 RW.09* 🚨\n\n` +
      `⚠️ *Kategori:* ${alert.tipe_darurat}\n` +
      `👤 *Pengirim:* ${alert.nama_warga}\n` +
      `📍 *Lokasi TKP:* ${alert.alamat}\n` +
      `📝 *Keterangan:* ${alert.keterangan || '-'}\n\n` +
      `🚨 *MOHON BANTUAN SEGERA DARI WARGA SEKITAR!* 🚨`
    );
  };

  const shareToWhatsApp = (alert: EmergencyAlertItem) => {
    const text = createWhatsAppText(alert);
    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const copyAlertInfo = (alert: EmergencyAlertItem) => {
    const text = createWhatsAppText(alert);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-red-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border-4 border-red-500 overflow-hidden flex flex-col relative max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Flashing Danger Stripe Header */}
        <div className="bg-gradient-to-r from-red-600 via-amber-500 to-red-600 h-3 animate-pulse shrink-0" />

        {/* Alarm Banner Section */}
        <div className="bg-red-600 px-5 py-5 text-white text-center space-y-2 shrink-0 relative">
          <div className="w-14 h-14 bg-white text-red-600 rounded-full flex items-center justify-center mx-auto shadow-lg relative z-10 animate-bounce">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-0.5">
            <h2 className="text-lg sm:text-xl font-black uppercase tracking-wider animate-pulse">
              🚨 ALARM DARURAT WARGA AKTIF! 🚨
            </h2>
            <p className="text-xs text-red-100 font-semibold max-w-sm mx-auto">
              Ada warga membutuhkan pertolongan darurat di lingkungan RT.002 RW.09!
            </p>
          </div>
        </div>

        {/* Primary Alert Details Card */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
          <div className="bg-red-50/90 border border-red-200 rounded-2xl p-4 space-y-3.5 shadow-2xs">
            
            {/* Tag Darurat */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-black uppercase tracking-wider text-red-800 bg-red-100 border border-red-300 px-3 py-1 rounded-full">
                Kategori: {primaryAlert.tipe_darurat}
              </span>
              <span className="text-[10px] font-bold text-slate-500">
                {primaryAlert.created_at ? new Date(primaryAlert.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Baru saja'}
              </span>
            </div>

            {/* Profile Info */}
            <div className="space-y-2.5 font-semibold text-xs sm:text-sm">
              <div className="flex items-start gap-2.5">
                <Users className="w-4.5 h-4.5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Nama Warga / Korban</p>
                  <p className="text-slate-900 text-sm font-black">
                    {primaryAlert.nama_warga}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <MapPin className="w-4.5 h-4.5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Lokasi Rumah / TKP</p>
                  <p className="text-slate-800 text-xs sm:text-sm font-extrabold leading-relaxed">
                    {primaryAlert.alamat}
                  </p>
                </div>
              </div>

              {primaryAlert.no_hp && (
                <div className="flex items-start gap-2.5">
                  <Phone className="w-4.5 h-4.5 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Kontak Telepon</p>
                      <a 
                        href={`tel:${primaryAlert.no_hp}`}
                        className="text-indigo-600 hover:text-indigo-800 text-xs sm:text-sm font-bold inline-block hover:underline"
                      >
                        {primaryAlert.no_hp}
                      </a>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`tel:${primaryAlert.no_hp}`}
                        className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-[11px] font-bold transition-colors inline-flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3 text-slate-600" />
                        <span>Telepon</span>
                      </a>
                      <a
                        href={`https://wa.me/${primaryAlert.no_hp.replace(/\D/g, '').replace(/^0/, '62')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-colors inline-flex items-center gap-1"
                      >
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {primaryAlert.keterangan && (
                <div className="pt-2 border-t border-red-200/60">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Keterangan Situasi</p>
                  <p className="text-slate-800 text-xs mt-1 bg-white p-2.5 rounded-xl border border-red-100 font-medium italic leading-relaxed">
                    "{primaryAlert.keterangan}"
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Broadcast Action to RT WhatsApp Group */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shareToWhatsApp(primaryAlert)}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all active:scale-95"
            >
              <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.97C16.528 2.015 14.062.99 11.457.99 6.023.99 1.6 5.361 1.595 10.79c-.001 1.745.486 3.454 1.411 4.938l-.991 3.615 3.73-.974zm15.421-4.708c-.287-.144-1.702-.84-1.965-.936-.263-.096-.456-.144-.648.144-.192.288-.744.936-.912 1.128-.167.192-.335.216-.622.072-.287-.144-1.21-.447-2.307-1.427-.854-.762-1.43-1.702-1.598-1.99-.168-.288-.018-.444.126-.587.13-.13.287-.336.43-.504.144-.168.192-.288.287-.48.096-.192.048-.36-.024-.504-.072-.144-.648-1.56-.888-2.136-.234-.564-.473-.488-.648-.497-.168-.008-.36-.01-.552-.01s-.504.072-.768.36c-.264.288-1.008.984-1.008 2.4 0 1.416 1.032 2.784 1.176 2.976.144.192 2.031 3.1 4.921 4.35.687.297 1.224.474 1.643.607.69.219 1.319.188 1.815.114.553-.083 1.702-.696 1.942-1.368.24-.672.24-1.248.168-1.368-.072-.12-.264-.192-.552-.336z"/>
              </svg>
              <span>Bagikan ke WhatsApp RT</span>
            </button>
            <button
              type="button"
              onClick={() => copyAlertInfo(primaryAlert)}
              className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 transition-colors cursor-pointer"
              title="Salin Teks Darurat"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
              <span className="hidden sm:inline">{copied ? 'Tersalin' : 'Salin'}</span>
            </button>
          </div>

          {/* Multiple Alerts Indicator if active */}
          {alerts.length > 1 && (
            <div className="space-y-1.5">
              <p className="text-[10.5px] text-slate-400 font-black uppercase tracking-wider">
                Sinyal Darurat Lain ({alerts.length - 1} Aktif):
              </p>
              <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                {alerts.slice(1).map(alt => (
                  <div key={alt.id} className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 p-2 rounded-xl font-bold">
                    <span className="truncate text-slate-700">{alt.nama_warga} ({alt.tipe_darurat})</span>
                    <button
                      type="button"
                      onClick={() => onResolveAlert(alt.id)}
                      className="text-emerald-600 hover:text-emerald-700 shrink-0 cursor-pointer ml-2"
                    >
                      Selesaikan
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-2 shrink-0">
          {isAudioPlaying && (
            <button
              type="button"
              onClick={onDismissSiren}
              className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <VolumeX className="w-4 h-4 text-slate-500" />
              <span>Matikan Suara</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onConfirmComing(primaryAlert)}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors"
          >
            <Navigation className="w-4 h-4" />
            <span>Saya Segera Datang!</span>
          </button>

          <button
            type="button"
            onClick={() => onResolveAlert(primaryAlert.id)}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Situasi Teratasi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
