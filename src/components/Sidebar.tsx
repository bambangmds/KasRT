import React, { useState } from 'react';
import { 
  ReceiptText, 
  FileEdit, 
  BarChart3, 
  Tag, 
  Database, 
  Settings, 
  Shield, 
  ChevronRight, 
  ChevronDown, 
  LogOut, 
  UserCheck, 
  Lock, 
  ShieldAlert, 
  Camera, 
  Users, 
  Megaphone, 
  Coins, 
  Layers, 
  FolderTree, 
  FolderCog,
  SlidersHorizontal,
  Package
} from 'lucide-react';
import { ActiveTab, SupabaseConnectionStatus, ThemeName, UserProfile } from '../types';
import { AppLogo } from './AppLogo';
import { UserAvatar } from './UserAvatar';
import { useSekretariat } from '../context/SekretariatContext';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  connectionStatus: SupabaseConnectionStatus;
  theme?: ThemeName;
  activeUser?: UserProfile | null;
  onLogout?: () => void;
  onOpenPhotoModal?: () => void;
  onTriggerSos?: () => void;
  onOpenSupabaseModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
  connectionStatus,
  theme = 'sapphire',
  activeUser,
  onLogout,
  onOpenPhotoModal,
  onTriggerSos,
  onOpenSupabaseModal,
}) => {
  const { wilayahShort, kelurahanLabel } = useSekretariat();
  const isAdmin = (activeUser?.levelAkses || 'Admin') === 'Admin';

  // State untuk collapsible Sub Menu "Kelola Data & Master"
  const isMasterSubActive = activeTab === 'kelola-kategori' || activeTab === 'kelola-data';
  const [isMasterMenuOpen, setIsMasterMenuOpen] = useState(false);

  const isConnected = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting';

  // Dynamic Theme Styling
  const getActiveNavClass = () => {
    switch (theme) {
      case 'emerald':
        return 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-400/50';
      case 'indigo':
        return 'bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-700 text-white shadow-lg shadow-indigo-950/50 ring-1 ring-indigo-400/50';
      case 'sapphire':
      default:
        return 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 text-white shadow-lg shadow-blue-950/50 ring-1 ring-blue-400/50';
    }
  };

  const getActiveSubNavClass = () => {
    switch (theme) {
      case 'emerald':
        return 'bg-emerald-600/30 text-emerald-200 border border-emerald-500/50 font-bold shadow-inner shadow-emerald-950/40';
      case 'indigo':
        return 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/50 font-bold shadow-inner shadow-indigo-950/40';
      case 'sapphire':
      default:
        return 'bg-blue-600/30 text-blue-200 border border-blue-500/50 font-bold shadow-inner shadow-blue-950/40';
    }
  };

  const getThemeBadgeClass = () => {
    switch (theme) {
      case 'emerald':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'indigo':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'sapphire':
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
  };

  const getThemeShieldColor = () => {
    switch (theme) {
      case 'emerald':
        return 'text-emerald-400';
      case 'indigo':
        return 'text-indigo-400';
      case 'sapphire':
      default:
        return 'text-blue-400';
    }
  };

  // Daftar Menu Utama Standar
  const primaryNavItems = [
    {
      id: 'input-riwayat-transaksi' as ActiveTab,
      label: 'Input & Riwayat',
      sublabel: 'Catat kas umum & iuran warga',
      icon: ReceiptText,
      adminOnly: true,
    },
    {
      id: 'koreksi-hapus' as ActiveTab,
      label: 'Koreksi & Hapus',
      sublabel: 'Perubahan & audit data',
      icon: FileEdit,
      adminOnly: true,
    },
    {
      id: 'inventaris-rt' as ActiveTab,
      label: 'Inventaris & Aset RT',
      sublabel: 'Kelola barang & log pinjam',
      icon: Package,
      adminOnly: true,
    },
    {
      id: 'laporan-keuangan' as ActiveTab,
      label: 'Laporan Keuangan',
      sublabel: 'Statistik & rekap periode',
      icon: BarChart3,
      adminOnly: false, // Terbuka untuk semua (Admin & User)
    },
  ];

  // Sub Menu di bawah Menu Baru "Kelola Data & Master"
  const masterSubNavItems = [
    {
      id: 'kelola-kategori' as ActiveTab,
      label: 'Kelola Data Warga & Kategori',
      sublabel: 'Master penduduk & pos kas',
      icon: Users,
    },
    {
      id: 'kelola-data' as ActiveTab,
      label: 'Kelola Data',
      sublabel: 'Backup, restore & reset',
      icon: Database,
    },
  ];

  const sidebarContent = (
    <div className="relative h-full flex flex-col bg-gradient-to-b from-slate-800/95 via-slate-900 to-slate-950 text-slate-100 overflow-hidden">
      {/* Subtle ambient lighting orbs in background */}
      <div className="absolute -top-12 -left-12 w-40 h-40 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-16 w-36 h-36 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 left-10 w-44 h-44 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Community Brand Header (Fixed / Pinned di Atas) */}
      <div className="relative z-10 px-4 h-16 shrink-0 border-b border-slate-800/90 bg-black flex items-center">
        <div className="flex items-center gap-3 w-full">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black p-1 shadow-md border-2 border-yellow-400 flex items-center justify-center shrink-0">
            <AppLogo className="w-8 h-8 sm:w-9 sm:h-9" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-sm sm:text-base font-black text-blue-400 tracking-tight leading-tight">
                Kas {wilayahShort}
              </span>
            </div>
            <span className="text-[11px] text-yellow-400 font-bold flex items-center gap-1.5 mt-0.5">
              <Shield className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
              {kelurahanLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Links (Bisa Digulir / Scrollable) */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-3.5 space-y-1.5 min-h-0 custom-scrollbar-dark overscroll-contain">
        <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
          Menu Utama
        </p>
        <nav className="flex flex-col gap-1.5">
          {/* Primary Nav Items */}
          {primaryNavItems
              .filter((item) => isAdmin || !item.adminOnly)
              .map((item) => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectTab(item.id);
                      onCloseMobile();
                    }}
                    className={`group relative flex items-center justify-between w-full px-3.5 py-3 rounded-xl transition-all duration-200 text-left cursor-pointer ${
                      isActive
                        ? getActiveNavClass()
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                          isActive
                            ? 'bg-white/25 text-white shadow-inner'
                            : 'bg-slate-800/90 text-slate-400 group-hover:text-white group-hover:bg-slate-800 group-hover:shadow-sm'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold leading-tight">
                          {item.label}
                        </span>
                        <span
                          className={`text-[10px] leading-tight mt-0.5 ${
                            isActive ? 'text-white/90 font-medium' : 'text-slate-400'
                          }`}
                        >
                          {item.sublabel}
                        </span>
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isActive
                          ? 'text-white translate-x-0.5'
                          : 'text-transparent group-hover:text-slate-400'
                      }`}
                    />
                  </button>
                );
              })}

            {/* Menu Baru dengan 2 Sub Menu (Khusus Admin) */}
            {isAdmin && (
              <div className="pt-1">
                {/* Induk Menu Baru */}
                <button
                  type="button"
                  onClick={() => setIsMasterMenuOpen(!isMasterMenuOpen)}
                  className={`group relative flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl transition-all duration-200 text-left cursor-pointer ${
                    isMasterSubActive
                      ? 'bg-slate-800/90 text-white ring-1 ring-slate-700/80 shadow-xs'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                        isMasterSubActive
                          ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30'
                          : 'bg-slate-800/90 text-slate-400 group-hover:text-white'
                      }`}
                    >
                      <FolderTree className="w-4 h-4 shrink-0" />
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold leading-tight">
                          Kelola Data & Master
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          2 Sub Menu
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 leading-tight mt-0.5">
                        Warga, kategori & database
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center">
                    {isMasterMenuOpen ? (
                      <ChevronDown className="w-4 h-4 text-slate-400 transition-transform" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 transition-transform" />
                    )}
                  </div>
                </button>

                {/* Container 2 Sub Menu */}
                {isMasterMenuOpen && (
                  <div className="mt-1 ml-4 pl-3 border-l-2 border-slate-800/90 space-y-1 py-1">
                    {masterSubNavItems.map((subItem, index) => {
                      const isSubActive = activeTab === subItem.id;
                      const SubIcon = subItem.icon;
                      return (
                        <button
                          key={subItem.id}
                          type="button"
                          onClick={() => {
                            onSelectTab(subItem.id);
                            onCloseMobile();
                          }}
                          className={`group relative flex items-center justify-between w-full px-3 py-2.5 rounded-xl transition-all duration-200 text-left cursor-pointer ${
                            isSubActive
                              ? getActiveSubNavClass()
                              : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                                isSubActive
                                  ? 'bg-indigo-500/30 text-white'
                                  : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
                              }`}
                            >
                              <SubIcon className="w-3.5 h-3.5 shrink-0" />
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold leading-tight">
                                  {index + 1}. {subItem.label}
                                </span>
                              </div>
                              <span
                                className={`text-[9.5px] leading-tight mt-0.5 ${
                                  isSubActive ? 'text-slate-200' : 'text-slate-400'
                                }`}
                              >
                                {subItem.sublabel}
                              </span>
                            </div>
                          </div>
                          <ChevronRight
                            className={`w-3 h-3 transition-transform duration-200 ${
                              isSubActive
                                ? 'text-white translate-x-0.5'
                                : 'text-transparent group-hover:text-slate-400'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Menu Siaran Pengumuman (Khusus Admin) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  onSelectTab('siaran-pengumuman');
                  onCloseMobile();
                }}
                className={`group relative flex items-center justify-between w-full px-3.5 py-3 rounded-xl transition-all duration-200 text-left cursor-pointer ${
                  activeTab === 'siaran-pengumuman'
                    ? getActiveNavClass()
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                      activeTab === 'siaran-pengumuman'
                        ? 'bg-white/25 text-white shadow-inner'
                        : 'bg-slate-800/90 text-slate-400 group-hover:text-white group-hover:bg-slate-800 group-hover:shadow-sm'
                    }`}
                  >
                    <Megaphone className="w-4 h-4 shrink-0" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold leading-tight">
                      Siaran Pengumuman
                    </span>
                    <span
                      className={`text-[10px] leading-tight mt-0.5 ${
                        activeTab === 'siaran-pengumuman' ? 'text-white/90 font-medium' : 'text-slate-400'
                      }`}
                    >
                      Kirim info & siaran WA
                    </span>
                  </div>
                </div>
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    activeTab === 'siaran-pengumuman'
                      ? 'text-white translate-x-0.5'
                      : 'text-transparent group-hover:text-slate-400'
                  }`}
                />
              </button>
            )}
          </nav>

          {/* Banner Informasi Hak Akses Terbatas untuk User */}
          {!isAdmin && (
            <div className="mt-4 p-3 rounded-xl bg-gradient-to-br from-slate-800/70 to-slate-900/80 border border-amber-500/30 text-slate-300 shadow-md">
              <div className="flex items-center gap-2 mb-1">
                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[11px] font-bold text-amber-300">Akses Terbatas (User)</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Akun Anda berstatus <strong>User</strong>. Sesuai kebijakan RT, Anda memiliki izin melihat <strong>Laporan Keuangan</strong> kas warga. Menu entri & administrasi kas dikhususkan untuk <strong>Admin</strong>.
              </p>
            </div>
          )}
        </div>

      {/* Database Connection Status & User Profile Footer (Fixed / Docked di Bawah) */}
      <div className="relative z-10 shrink-0 p-3.5 sm:p-4 border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-xs space-y-2">
        {/* Tombol SOS Darurat Warga (Tunggal & Utama di Sidebar) */}
        {activeUser && onTriggerSos && (
          <button
            type="button"
            onClick={() => {
              onTriggerSos();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:from-red-700 active:to-rose-700 text-white text-xs font-black border border-red-400/40 shadow-md shadow-red-950/40 transition-all cursor-pointer group active:scale-98"
            title="Klik untuk memicu sinyal darurat (SOS) & broadcast ke grup WhatsApp warga"
          >
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-white animate-bounce shrink-0" />
              <div className="flex flex-col text-left">
                <span className="text-xs font-extrabold tracking-wide">🚨 Sinyal Darurat (SOS)</span>
                <span className="text-[9.5px] text-red-100 font-medium">Kirim alarm & broadcast WA</span>
              </div>
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-white text-red-700 shadow-xs">
              SOS
            </span>
          </button>
        )}

        {/* Active User Card */}
        {activeUser && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/70 backdrop-blur-sm border border-slate-700/70 text-left shadow-sm">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div
                onClick={() => {
                  onOpenPhotoModal?.();
                  onCloseMobile();
                }}
                className="relative group/sideAvatar cursor-pointer shrink-0"
                title="Klik untuk mengganti foto pengguna"
              >
                <UserAvatar
                  user={activeUser}
                  size="sm"
                  shape="auto"
                  className="shadow-xs ring-1 ring-slate-600/60 group-hover/sideAvatar:scale-105 transition-transform"
                />
                <div className="absolute inset-0 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover/sideAvatar:opacity-100 transition-opacity">
                  <Camera className="w-2.5 h-2.5" />
                </div>
              </div>
              <div className="flex flex-col overflow-hidden">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white truncate">
                    {activeUser.nama}
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                      activeUser.levelAkses === 'Admin'
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                        : 'bg-blue-400/20 text-blue-300 border border-blue-400/30'
                    }`}
                  >
                    {activeUser.levelAkses || 'User'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium truncate">
                  {activeUser.role}
                </span>
              </div>
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  onCloseMobile();
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700/80 transition-colors cursor-pointer"
                title="Keluar (Logout)"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        <div
          onClick={onOpenSupabaseModal}
          className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all duration-200 text-left shadow-md group cursor-pointer hover:border-slate-500 hover:scale-[1.02] active:scale-98 ${
            isConnected
              ? 'bg-gradient-to-r from-slate-800/90 to-emerald-950/40 border-emerald-500/40 text-white'
              : isConnecting
              ? 'bg-gradient-to-r from-slate-800/90 to-sky-950/40 border-sky-500/40 text-white'
              : 'bg-slate-800/90 border-slate-700/80 text-slate-200'
          }`}
          title="Klik untuk membuka Konfigurasi Database Supabase & URL Cron-Job"
        >
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected
                    ? 'bg-emerald-400 shadow-sm shadow-emerald-400'
                    : isConnecting
                    ? 'bg-sky-400'
                    : 'bg-amber-400'
                }`}
              />
              {isConnected && (
                <span className="absolute w-3.5 h-3.5 rounded-full bg-emerald-500/40 animate-ping" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-white leading-tight">
                {isConnected
                  ? 'Supabase: kas_rt (Live)'
                  : isConnecting
                  ? 'Menghubungkan...'
                  : 'Aktifkan Supabase'}
              </span>
              <span className="text-[10px] text-slate-400 leading-tight">
                {isConnected ? 'Database tersambung' : 'Klik konfigurasi'}
              </span>
            </div>
          </div>
          <div className="w-5 h-5 rounded-md bg-slate-700/60 flex items-center justify-center transition-colors">
            <Database className="w-3 h-3 text-slate-300" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block fixed left-0 top-0 h-full w-72 bg-slate-900 z-40 border-r border-slate-800 shadow-xl print:hidden">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex print:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[80vw] h-full bg-slate-900 shadow-2xl z-50 flex flex-col border-r border-slate-800">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

