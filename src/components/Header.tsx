import React, { useState, useRef, useEffect } from 'react';
import { Menu, Database, Loader2, Settings, User, Building2, ShieldCheck, ChevronDown, Palette, Check, LogOut, Sparkles, ArrowRight, Camera } from 'lucide-react';
import { SupabaseConnectionStatus, ThemeName, UserProfile } from '../types';
import { UserAvatar } from './UserAvatar';
import { useSekretariat } from '../context/SekretariatContext';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  onOpenMobileMenu: () => void;
  connectionStatus: SupabaseConnectionStatus;
  theme: ThemeName;
  onSelectTheme: (theme: ThemeName) => void;
  activeUser?: UserProfile | null;
  onLogout?: () => void;
  onPreviewLogin?: () => void;
  onOpenPhotoModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileMenu,
  connectionStatus,
  theme,
  onSelectTheme,
  activeUser,
  onLogout,
  onPreviewLogin,
  onOpenPhotoModal,
}) => {
  const [profileOpen, setProfileOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const themeDropdownRef = useRef<HTMLDivElement>(null);

  const { sekretariat, wilayahLabel, wilayahShort } = useSekretariat();

  const isConnected = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting';

  // Themes definition
  const themeList: { id: ThemeName; label: string; desc: string; dot: string; borderActive: string }[] = [
    {
      id: 'sapphire',
      label: 'Sapphire Blue',
      desc: 'Biru Modern & Finansial',
      dot: 'bg-blue-600',
      borderActive: 'border-blue-500 bg-blue-50/60',
    },
    {
      id: 'emerald',
      label: 'Emerald Mint',
      desc: 'Hijau Zamrud Asri',
      dot: 'bg-emerald-600',
      borderActive: 'border-emerald-500 bg-emerald-50/60',
    },
    {
      id: 'indigo',
      label: 'Royal Indigo',
      desc: 'Ungu Mewah & Berkelas',
      dot: 'bg-indigo-600',
      borderActive: 'border-indigo-500 bg-indigo-50/60',
    },
  ];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(event.target as Node)) {
        setThemeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeThemeObj = themeList.find((t) => t.id === theme) || themeList[0];

  return (
    <header className="fixed top-0 left-0 lg:left-72 right-0 h-16 bg-slate-200/95 backdrop-blur-md border-b border-slate-300/80 z-30 flex items-center justify-between px-4 sm:px-8 transition-all shadow-xs print:hidden">
      {/* Left side: Hamburger on mobile, civic tag on desktop */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Buka Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="lg:hidden font-black text-[#0f172a] text-lg tracking-tight">
            Kas {wilayahShort}
          </span>
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 border border-blue-500 rounded-full text-xs text-white shadow-xs">
            <Building2 className="w-3.5 h-3.5 text-white shrink-0" />
            <span className="font-black text-white">Kas {wilayahShort}</span>
            <span className="text-white/80 font-black">•</span>
            <span className="font-bold text-white">{wilayahLabel}</span>
          </div>
        </div>
      </div>

      {/* Right side: Theme Picker, DB status button & Profile Avatar */}
      <div className="flex items-center gap-2 sm:gap-2.5 relative">
        {/* PWA Install Button */}
        <PWAInstallButton theme={theme} />

        {/* Theme Picker Dropdown */}
        <div className="relative" ref={themeDropdownRef}>
          <button
            type="button"
            onClick={() => setThemeOpen(!themeOpen)}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full border border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer group"
            title="Klik untuk mengubah tema warna aplikasi"
          >
            <Palette className={`w-3.5 h-3.5 transition-transform group-hover:rotate-12 ${theme === 'sapphire' ? 'text-blue-600' : theme === 'indigo' ? 'text-indigo-600' : 'text-emerald-600'}`} />
            <span className="hidden sm:inline text-slate-500 font-normal">Tema:</span>
            <span className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${activeThemeObj.dot} shadow-xs`} />
              <span className="font-bold text-slate-900 hidden xs:inline">{activeThemeObj.label.split(' ')[0]}</span>
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400 group-hover:translate-y-0.5 transition-transform" />
          </button>

          {themeOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2 py-1.5 border-b border-slate-200 mb-1">
                <p className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">
                  Pilihan Warna Tampilan
                </p>
                <p className="text-[10px] text-slate-500">
                  Ganti suasana visual aplikasi secara instan
                </p>
              </div>

              <div className="space-y-1 mt-1">
                {themeList.map((t) => {
                  const isSelected = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onSelectTheme(t.id);
                        setThemeOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer border ${
                        isSelected
                          ? `${t.borderActive} shadow-xs font-bold text-slate-900`
                          : 'border-transparent hover:bg-slate-50 text-slate-700 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-3 h-3 rounded-full ${t.dot} shadow-xs shrink-0`} />
                        <div className="flex flex-col">
                          <span className="text-xs">{t.label}</span>
                          <span className="text-[10px] text-slate-500 font-normal">
                            {t.desc}
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-slate-900 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {onPreviewLogin && (
                <div className="mt-2.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setThemeOpen(false);
                      onPreviewLogin();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 border border-orange-200 text-orange-950 transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 shadow-xs shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold flex items-center gap-1.5">
                          <span>Layar Login Oranye Gelap</span>
                          <span className="text-[9px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-black">Aktif</span>
                        </span>
                        <span className="text-[10px] text-orange-700">
                          Lihat tampilan login tema oranye gelap
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-orange-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Interactive Supabase DB status badge */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-200 shadow-2xs ${
            isConnected
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : isConnecting
              ? 'bg-sky-50 text-sky-800 border-sky-200'
              : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}
          title="Status Database Supabase"
        >
          {isConnected ? (
            <Database className="w-3.5 h-3.5 text-emerald-600" />
          ) : isConnecting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
          ) : (
            <Database className="w-3.5 h-3.5 text-slate-500" />
          )}
          <span className="hidden xs:inline">
            {isConnected ? 'Supabase Terhubung' : isConnecting ? 'Menghubungkan...' : 'DB Belum Terhubung'}
          </span>
          <span className="relative flex h-2 w-2">
            {isConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isConnected
                  ? 'bg-emerald-600'
                  : isConnecting
                  ? 'bg-sky-600'
                  : 'bg-slate-400'
              }`}
            />
          </span>
        </div>



        {/* User profile avatar & menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full hover:bg-slate-100/80 border border-transparent hover:border-slate-200 transition-all cursor-pointer group"
            title={`Profil Pengurus Kas ${wilayahShort}`}
          >
            {/* User Avatar with photo or initials and camera badge */}
            <div className="relative group/avatar shrink-0">
              <UserAvatar
                user={activeUser}
                size="auto"
                shape="auto"
                className="shadow-xs ring-1 ring-slate-700/40 group-hover:scale-105 transition-transform"
              />
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPhotoModal?.();
                }}
                className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-orange-600 text-white flex items-center justify-center shadow-xs border border-white opacity-85 group-hover:opacity-100 hover:scale-110 transition-all cursor-pointer"
                title="Ganti Foto Pengguna"
              >
                <Camera className="w-2 h-2" />
              </span>
            </div>
            <div className="hidden md:flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[130px]">
                  {activeUser?.nama || 'Bendahara RT'}
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase shadow-2xs ${
                    activeUser?.levelAkses === 'Admin'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-blue-100 text-blue-900 border border-blue-300'
                  }`}
                >
                  {activeUser?.levelAkses || 'User'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 leading-tight">
                {activeUser?.role || 'Pengurus'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 transition-transform duration-200 group-hover:translate-y-0.5 ml-0.5" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2.5 w-72 bg-white rounded-xl shadow-lg border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-3.5 mb-3">
                <div
                  onClick={() => {
                    setProfileOpen(false);
                    onOpenPhotoModal?.();
                  }}
                  className="relative group/cardAvatar cursor-pointer shrink-0"
                  title="Klik untuk mengganti foto pengguna"
                >
                  <UserAvatar
                    user={activeUser}
                    size="lg"
                    shape="auto"
                    className="shadow-xs ring-1 ring-slate-700/50 group-hover/cardAvatar:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 rounded-full bg-black/45 text-white flex flex-col items-center justify-center opacity-0 group-hover/cardAvatar:opacity-100 transition-opacity backdrop-blur-[1px]">
                    <Camera className="w-4 h-4 drop-shadow-xs" />
                    <span className="text-[8px] font-bold tracking-tight">Ganti</span>
                  </div>
                </div>
                <div className="overflow-hidden">
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {activeUser?.nama || `Bendahara ${wilayahShort}`}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {activeUser?.role || 'Pengurus Keuangan Warga'}
                  </p>
                  {activeUser?.email && (
                    <p className="text-[10px] text-slate-400 truncate">
                      {activeUser.email}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-600 space-y-2 py-1">
                <div className="flex justify-between items-center py-1 px-2.5 rounded-lg bg-slate-50">
                  <span>Lingkungan:</span>
                  <span className="font-semibold text-slate-900">{wilayahShort}{sekretariat.kelurahan ? `, Kel. ${sekretariat.kelurahan}` : ''}</span>
                </div>
                <div className="flex justify-between items-center py-1 px-2.5 rounded-lg bg-slate-50">
                  <span>Jabatan:</span>
                  <span className="font-bold text-emerald-700 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> {activeUser?.role || 'Pengurus RT'}
                  </span>
                </div>
                {activeUser?.no_hp && (
                  <div className="flex justify-between items-center py-1 px-2.5 rounded-lg bg-slate-50">
                    <span>No. WhatsApp/HP:</span>
                    <span className="font-semibold text-slate-900 font-mono text-[11px]">{activeUser.no_hp}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-1 px-2.5 rounded-lg bg-slate-50">
                  <span>Hak Akses:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                      activeUser?.levelAkses === 'Admin'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-blue-100 text-blue-900 border border-blue-300'
                    }`}
                  >
                    {activeUser?.levelAkses === 'Admin' ? 'Admin (Semua Halaman)' : 'User (Hanya Laporan)'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 px-2.5 rounded-lg bg-slate-50">
                  <span>Status DB:</span>
                  <span
                    className={`font-semibold ${
                      isConnected ? 'text-emerald-700' : 'text-amber-600'
                    }`}
                  >
                    {isConnected ? 'Supabase Live' : 'Penyimpanan Lokal'}
                  </span>
                </div>
              </div>

              {/* Daftar Susunan Pengurus ${wilayahShort} */}
              <div className="mt-2.5 p-2 rounded-lg bg-slate-50 border border-slate-200/80">
                <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-slate-500" /> Susunan Pengurus RT:
                </p>
                <div className="flex flex-col gap-0.5 text-[10px] text-slate-700 max-h-40 overflow-y-auto pr-1">
                  <span>Ketua RT</span>
                  <span>Wakil Ketua RT</span>
                  <span>Sekretaris</span>
                  <span>Bendahara</span>
                  <span>Seksi Keamanan</span>
                  <span>Seksi Sarana & Prasarana</span>
                  <span>Seksi Humas</span>
                  <span>Seksi Kerohanian</span>
                  <span>Seksi Pemuda & Olahraga</span>
                  <span>Seksi Pemberdayaan Perempuan</span>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-200 flex flex-col gap-2">
                {onOpenPhotoModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      onOpenPhotoModal();
                    }}
                    className="w-full py-2 px-3 text-xs text-left font-bold text-slate-800 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 hover:from-orange-100 hover:to-amber-100 border border-orange-200/90 rounded-xl transition-all cursor-pointer flex items-center justify-between group shadow-2xs active:scale-98"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-orange-600 to-amber-600 text-white flex items-center justify-center shadow-xs">
                        <Camera className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="leading-tight text-orange-950 font-bold">Ganti Foto Pengguna</span>
                        <span className="text-[10px] text-orange-700 font-normal leading-tight">Sesuaikan ukuran & foto profil</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-200/80 text-orange-900 border border-orange-300/60">
                      Ubah
                    </span>
                  </button>
                )}


                {onPreviewLogin && (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      onPreviewLogin();
                    }}
                    className="w-full py-2 text-xs text-center font-bold text-orange-900 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                  >
                    <Palette className="w-3.5 h-3.5 text-orange-600" />
                    <span>Lihat Layar Login (Oranye Gelap)</span>
                  </button>
                )}

                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      onLogout();
                    }}
                    className="w-full py-2 text-xs text-center font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-600" />
                    <span>Keluar (Logout)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  className="w-full py-1.5 text-xs text-center font-medium text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};


