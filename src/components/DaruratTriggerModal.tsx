import React, { useState, useEffect } from 'react';
import { ShieldAlert, X, HeartPulse, ShieldAlert as BurglarIcon, Flame, AlertCircle, Loader2, ArrowLeft, ChevronDown, CheckCircle2, Copy, Check } from 'lucide-react';
import { UserProfile } from '../types';

interface DaruratTriggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeUser: UserProfile | null;
  onTriggerAlert: (tipe: string, desc: string) => Promise<void>;
}

export const DaruratTriggerModal: React.FC<DaruratTriggerModalProps> = ({
  isOpen,
  onClose,
  activeUser,
  onTriggerAlert,
}) => {
  const [selectedTipe, setSelectedTipe] = useState('Kesehatan/Medis');
  const [desc, setDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsConfirmed(false);
      setIsDropdownOpen(false);
      setIsSent(false);
      setCopied(false);
    }
  }, [isOpen]);

  // Support ESC key to safely dismiss modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const tipeList = [
    { id: 'Kesehatan/Medis', label: 'Medis / Kesehatan', icon: HeartPulse, color: 'from-rose-500 to-red-600', hover: 'hover:ring-rose-500 bg-rose-50/50 text-rose-700 border-rose-200' },
    { id: 'Keamanan/Maling', label: 'Keamanan / Maling', icon: BurglarIcon, color: 'from-slate-700 to-slate-900', hover: 'hover:ring-slate-800 bg-slate-50 text-slate-800 border-slate-300' },
    { id: 'Kebakaran', label: 'Kebakaran', icon: Flame, color: 'from-orange-500 to-amber-600', hover: 'hover:ring-orange-500 bg-orange-50/50 text-orange-700 border-orange-200' },
    { id: 'Bencana Alam', label: 'Bencana Alam / Gempa', icon: AlertCircle, color: 'from-blue-500 to-indigo-600', hover: 'hover:ring-blue-500 bg-blue-50/50 text-blue-700 border-blue-200' },
    { id: 'Lainnya', label: 'Lainnya (Genting)', icon: ShieldAlert, color: 'from-purple-500 to-pink-600', hover: 'hover:ring-purple-500 bg-purple-50 text-purple-700 border-purple-200' },
  ];

  const displayName = activeUser?.nama || 'Warga RT.002';
  const displayAddress = activeUser?.alamat_domisili || 'RT.002 RW.09, Kelurahan Pondok Rajeg';
  const displayPhone = activeUser?.noHp || '';

  const createWhatsAppText = () => {
    return (
      `🚨 *PANGGILAN DARURAT SOS RT.002 RW.09* 🚨\n\n` +
      `⚠️ *Kategori:* ${selectedTipe}\n` +
      `👤 *Pengirim:* ${displayName}\n` +
      `📍 *Lokasi TKP:* ${displayAddress}\n` +
      `📝 *Keterangan:* ${desc.trim() || '-'}\n\n` +
      `🚨 *MOHON BANTUAN SEGERA DARI WARGA SEKITAR!* 🚨`
    );
  };

  const openWhatsAppBroadcast = () => {
    const text = createWhatsAppText();
    const encoded = encodeURIComponent(text);
    const waUrl = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(waUrl, '_blank');
  };

  const copyWhatsAppText = () => {
    const text = createWhatsAppText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSubmitWithWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed) return;
    setIsSubmitting(true);
    try {
      await onTriggerAlert(selectedTipe, desc);
      setIsSent(true);
      // Automatically open WhatsApp with pre-filled message
      openWhatsAppBroadcast();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitSystemOnly = async () => {
    if (!isConfirmed) return;
    setIsSubmitting(true);
    try {
      await onTriggerAlert(selectedTipe, desc);
      setIsSent(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 flex flex-col max-h-[94vh] sm:max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150 relative text-left"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Fixed Header */}
        <div className="bg-red-600 px-4.5 py-3.5 text-white flex items-center justify-between shrink-0 shadow-xs z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4.5 h-4.5 animate-pulse" />
            </div>
            <div>
              <h4 className="font-black text-xs sm:text-sm tracking-wide">KIRIM SINYAL SOS DARURAT</h4>
              <p className="text-[10px] text-red-100 font-medium">Siaran sirene darurat & broadcast ke grup WhatsApp warga</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Tutup / Batal (ESC)"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form with Scrollable Content */}
        {isSent ? (
          <div className="p-5 sm:p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-150 overflow-y-auto">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-900 uppercase">Sinyal SOS Berhasil Dikirim!</h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Peringatan telah tersimpan di sistem dan sirene telah berbunyi di gawai warga yang sedang membuka aplikasi.
              </p>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-2 text-left shadow-2xs">
              <p className="text-[11px] font-extrabold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                Penyebaran Pesan ke Warga Lain:
              </p>
              <p className="text-[11px] text-emerald-900 leading-relaxed font-semibold">
                Agar seluruh warga di lingkungan RT yang sedang tidak membuka aplikasi / HP terkunci juga langsung mendapat peringatan darurat, pastikan pesan telah terkirim ke <strong>Grup WhatsApp RT.002 RW.09</strong>!
              </p>
            </div>

            <div className="space-y-2 pt-1 text-xs font-bold">
              <button
                type="button"
                onClick={openWhatsAppBroadcast}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-200 transition-all active:scale-95 text-xs"
              >
                <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.97C16.528 2.015 14.062.99 11.457.99 6.023.99 1.6 5.361 1.595 10.79c-.001 1.745.486 3.454 1.411 4.938l-.991 3.615 3.73-.974zm15.421-4.708c-.287-.144-1.702-.84-1.965-.936-.263-.096-.456-.144-.648.144-.192.288-.744.936-.912 1.128-.167.192-.335.216-.622.072-.287-.144-1.21-.447-2.307-1.427-.854-.762-1.43-1.702-1.598-1.99-.168-.288-.018-.444.126-.587.13-.13.287-.336.43-.504.144-.168.192-.288.287-.48.096-.192.048-.36-.024-.504-.072-.144-.648-1.56-.888-2.136-.234-.564-.473-.488-.648-.497-.168-.008-.36-.01-.552-.01s-.504.072-.768.36c-.264.288-1.008.984-1.008 2.4 0 1.416 1.032 2.784 1.176 2.976.144.192 2.031 3.1 4.921 4.35.687.297 1.224.474 1.643.607.69.219 1.319.188 1.815.114.553-.083 1.702-.696 1.942-1.368.24-.672.24-1.248.168-1.368-.072-.12-.264-.192-.552-.336z"/>
                </svg>
                <span>BUKA WHATSAPP SEKARANG</span>
              </button>

              <button
                type="button"
                onClick={copyWhatsAppText}
                className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 border border-slate-200 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copied ? 'Teks Darurat Berhasil Disalin!' : 'Salin Teks Pesan SOS'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  setSelectedTipe('Kesehatan/Medis');
                  setDesc('');
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl transition-all active:scale-95 border border-slate-200 cursor-pointer"
              >
                Tutup & Selesai
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitWithWhatsApp} className="flex flex-col flex-1 overflow-hidden">
          
          {/* Scrollable Content Body */}
          <div className="p-4 sm:p-5 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1 text-xs font-semibold">
            
            {/* User Location Review */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1 font-medium text-slate-500 leading-relaxed">
              <p className="text-[10px] font-black uppercase text-slate-400">Identitas Pengirim & Lokasi TKP:</p>
              <p className="text-slate-800 text-xs font-black">{displayName}</p>
              <p className="text-slate-600 text-[11px] font-bold">{displayAddress}</p>
              <p className="text-[10px] text-red-600 italic mt-0.5 font-bold">
                *Detail ini akan disiarkan ke gawai seluruh warga aktif dan disertakan di pesan WhatsApp RT.
              </p>
            </div>

            {/* Type Selection Dropdown / Combo */}
            <div className="space-y-1 relative">
              <label className="block text-slate-700 font-bold text-xs">
                Kategori Keadaan Darurat <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full flex items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400 text-left cursor-pointer transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none shadow-2xs"
                >
                  {(() => {
                    const currentItem = tipeList.find(item => item.id === selectedTipe) || tipeList[0];
                    const Icon = currentItem.icon;
                    return (
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg bg-gradient-to-tr ${currentItem.color} text-white flex items-center justify-center shrink-0 shadow-xs`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-900 text-xs">{currentItem.label}</p>
                          <p className="text-[10px] text-slate-400 font-medium">Klik untuk mengganti kategori</p>
                        </div>
                      </div>
                    );
                  })()}
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Floating Dropdown Menu */}
                {isDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                    
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-25 overflow-hidden max-h-52 overflow-y-auto animate-in fade-in duration-100">
                      <div className="p-1 space-y-1">
                        {tipeList.map(item => {
                          const isSelected = selectedTipe === item.id;
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setSelectedTipe(item.id);
                                setIsDropdownOpen(false);
                              }}
                              className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left cursor-pointer transition-all ${
                                isSelected 
                                  ? 'bg-red-50 text-red-950 font-black' 
                                  : 'hover:bg-slate-50 text-slate-700 hover:text-slate-900'
                              }`}
                            >
                              <div className={`w-6 h-6 rounded-md bg-gradient-to-tr ${item.color} text-white flex items-center justify-center shrink-0`}>
                                <Icon className="w-3 h-3" />
                              </div>
                              <div className="flex-1">
                                <p className="text-xs font-bold">{item.label}</p>
                              </div>
                              {isSelected && (
                                <div className="w-1.5 h-1.5 rounded-full bg-red-600 mr-1" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Emergency Description */}
            <div className="space-y-1">
              <label className="block text-slate-700 font-bold text-xs">
                Keterangan Tambahan / Situasi (Opsional)
              </label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={2}
                placeholder="Misal: Ada asap tebal di dapur, atau sesak nafas mendadak..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none resize-none text-xs leading-relaxed placeholder:text-slate-400"
              />
            </div>

            {/* Safety Notice Warning */}
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-2.5 text-[10.5px] leading-relaxed flex items-start gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Perhatian:</strong> Sinyal darurat ini akan membunyikan sirene di aplikasi dan menyebarkan info ke grup WhatsApp warga. Gunakan hanya pada kondisi darurat nyata.
              </span>
            </div>

            {/* Pengaman Ganda / Double Protection Checkbox */}
            <div className="bg-red-50/80 border border-red-200 rounded-xl p-3 flex items-start gap-2.5 shadow-2xs">
              <input
                type="checkbox"
                id="confirm-sos"
                checked={isConfirmed}
                onChange={(e) => setIsConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 text-red-600 focus:ring-red-500 border-slate-300 rounded cursor-pointer shrink-0 transition-all active:scale-95 accent-red-600"
              />
              <label htmlFor="confirm-sos" className="text-[11px] text-red-950 font-black cursor-pointer select-none leading-relaxed">
                Saya menyatakan kondisi ini DARURAT NYATA dan sadar akan membunyikan sirene warga.
              </label>
            </div>
          </div>

          {/* Fixed Sticky Footer with Actions */}
          <div className="p-3 sm:p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 z-10">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-xl font-bold cursor-pointer text-xs border border-slate-300 shadow-2xs transition-colors shrink-0 active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
              <span>Batal</span>
            </button>

            <div className="w-full sm:w-auto flex items-center gap-2 justify-end">
              <button
                type="button"
                disabled={isSubmitting || !isConfirmed}
                onClick={handleSubmitSystemOnly}
                className="flex-1 sm:flex-none px-3 py-2.5 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 rounded-xl font-bold text-xs disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400 transition-all cursor-pointer"
                title="Simpan sinyal ke sistem saja tanpa membuka WhatsApp"
              >
                Kirim ke Sistem Saja
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !isConfirmed}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-red-200 disabled:opacity-50 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none text-xs transition-all shrink-0 active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5 animate-bounce" />
                    <span>KIRIM SOS & WHATSAPP</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};
