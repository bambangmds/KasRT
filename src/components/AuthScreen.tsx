import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  Lock, 
  Mail, 
  User, 
  UserCheck, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Loader2, 
  AlertCircle, 
  AlertTriangle,
  CheckCircle2, 
  Sparkles,
  Database,
  Shield,
  Zap,
  Check,
  X,
  Phone,
  LogOut,
  Search,
  Users,
  Home,
  FileText
} from 'lucide-react';
import { AppLogo } from './AppLogo';
import { UserProfile, PengurusRole, UserLevel, SupabaseConnectionStatus, DataWargaItem } from '../types';
import { 
  loginPengurus, 
  registerPengurus, 
  findPengurusInSupabaseTable,
  checkJabatanExistsInPengurus,
  getOccupiedJabatanFromSupabase,
  isJabatanMatching,
  resetSupabaseCredentials,
  fetchDataWargaFromSupabase,
  checkCitizenAlreadyHasAccount,
  fetchAllPengurusFromSupabase
} from '../lib/supabase';
import { SUSUNAN_PENGURUS_RT } from '../data/initialData';
import { useSekretariat } from '../context/SekretariatContext';

interface AuthModalProps {
  onLoginSuccess: (user: UserProfile) => void;
  connectionStatus: SupabaseConnectionStatus;
  onOpenSupabaseConfig?: () => void;
  isPreviewMode?: boolean;
  onExitPreview?: () => void;
  onExitApp?: () => void;
}

export const AuthScreen: React.FC<AuthModalProps> = ({
  onLoginSuccess,
  connectionStatus,
  onOpenSupabaseConfig,
  isPreviewMode,
  onExitPreview,
  onExitApp,
}) => {
  const { sekretariat, wilayahShort, wilayahLabel, kelurahanLabel } = useSekretariat();
  // Pilihan tab: 'register' (Register Akun) & 'login' (Login ke Dasbor)
  const [tab, setTab] = useState<'register' | 'login'>('login');
  
  // Developer Easter Egg clicks to reveal database settings
  const [devClicks, setDevClicks] = useState(0);

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nama, setNama] = useState('');
  const [role, setRole] = useState<PengurusRole>('Warga');
  const [levelAkses, setLevelAkses] = useState<UserLevel>('User');
  const [showPassword, setShowPassword] = useState(false);
  const [noHp, setNoHp] = useState('');

  // Data Warga States untuk Pendaftaran Warga
  const [dataWargaList, setDataWargaList] = useState<DataWargaItem[]>([]);
  const [registeredAccounts, setRegisteredAccounts] = useState<any[]>([]);
  const [isLoadingWargaList, setIsLoadingWargaList] = useState(false);
  const [selectedCitizen, setSelectedCitizen] = useState<DataWargaItem | null>(null);
  const [wargaSearchTerm, setWargaSearchTerm] = useState('');
  const [isWargaDropdownOpen, setIsWargaDropdownOpen] = useState(false);

  // Pemetaan jabatan yang sudah terisi di tabel pengurus Supabase
  const [occupiedJabatanMap, setOccupiedJabatanMap] = useState<Record<string, { nama: string; email?: string }>>({});

  // Muat data warga dan akun terdaftar saat komponen dimuat atau saat tab register aktif
  useEffect(() => {
    let isMounted = true;
    const loadWargaDanAkun = async () => {
      setIsLoadingWargaList(true);
      try {
        const [wargaData, accountsData] = await Promise.all([
          fetchDataWargaFromSupabase(),
          fetchAllPengurusFromSupabase()
        ]);
        if (isMounted) {
          if (wargaData) setDataWargaList(wargaData);
          if (accountsData) setRegisteredAccounts(accountsData);
        }
      } catch (err) {
        console.warn('[AuthScreen Load Warga & Akun]', err);
      } finally {
        if (isMounted) setIsLoadingWargaList(false);
      }
    };
    loadWargaDanAkun();
    return () => { isMounted = false; };
  }, [tab, connectionStatus]);

  // Cek warga mana saja yang sudah memiliki akun di database
  const hasAccountMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    dataWargaList.forEach((w) => {
      const hasAcc = registeredAccounts.some((acc) => {
        // Cek ID / wargaId relasi kependudukan
        if (acc.warga_id && String(acc.warga_id) === String(w.id)) return true;
        if (acc.wargaId && String(acc.wargaId) === String(w.id)) return true;
        if (acc.id && String(acc.id) === String(w.id)) return true;
        // Cek NIK kependudukan
        if (w.nik && acc.nik && String(acc.nik).trim() === String(w.nik).trim()) return true;
        // Cek No KK kependudukan
        if (w.no_kk && acc.no_kk && String(acc.no_kk).trim() === String(w.no_kk).trim()) return true;
        // Cek kesamaan nama lengkap case-insensitive
        if (w.nama_lengkap && acc.nama && w.nama_lengkap.trim().toLowerCase() === acc.nama.trim().toLowerCase()) return true;
        return false;
      });
      map[w.id] = hasAcc;
    });
    return map;
  }, [dataWargaList, registeredAccounts]);

  // Filter daftar warga berdasarkan kata kunci pencarian
  const filteredDataWarga = useMemo(() => {
    if (!wargaSearchTerm.trim()) return dataWargaList;
    const term = wargaSearchTerm.toLowerCase().trim();
    return dataWargaList.filter((w) => {
      const namaMatch = (w.nama_lengkap || '').toLowerCase().includes(term);
      const kkMatch = (w.no_kk || '').toLowerCase().includes(term);
      const nikMatch = (w.nik || '').toLowerCase().includes(term);
      const alamatMatch = (w.alamat_domisili || '').toLowerCase().includes(term);
      const noHpMatch = (w.no_hp || '').toLowerCase().includes(term);
      return namaMatch || kkMatch || nikMatch || alamatMatch || noHpMatch;
    });
  }, [dataWargaList, wargaSearchTerm]);

  useEffect(() => {
    // Sinkronkan data jabatan pengurus terdaftar dari Supabase & penyimpanan lokal
    getOccupiedJabatanFromSupabase()
      .then((map) => {
        setOccupiedJabatanMap(map);
      })
      .catch(console.warn);
  }, [tab, connectionStatus]);

  // Cek apakah jabatan yang dipilih adalah Pengurus Inti (Ketua RT, Wakil Ketua RT, Sekretaris, Bendahara)
  const isPengurusInti =
    role === 'Ketua RT' ||
    role === 'Wakil Ketua RT' ||
    role === 'Sekretaris' ||
    role === 'Bendahara';

  // Helper untuk memeriksa apakah suatu jabatan sudah terisi di tabel pengurus
  const getOccupiedInfo = (targetRole: string): { nama: string; email?: string } | undefined => {
    if (!targetRole || targetRole === 'Warga') return undefined;
    for (const [key, val] of Object.entries(occupiedJabatanMap)) {
      if (isJabatanMatching(key, targetRole)) {
        return val as { nama: string; email?: string };
      }
    }
    return undefined;
  };

  // Cek apakah jabatan saat ini sudah terisi oleh pengurus lain di database
  const currentOccupiedJabatan = getOccupiedInfo(role);

  // Status & Feedback States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isConnected = connectionStatus === 'connected';

  // Cek akun terdaftar di database secara reaktif
  const [existingAccountRegister, setExistingAccountRegister] = useState<{
    id: string;
    nama: string;
    email: string;
    role: string;
    no_kk?: string;
  } | null>(null);

  const [existingAccountLogin, setExistingAccountLogin] = useState<{
    id: string;
    nama: string;
    email: string;
    role: string;
    no_kk?: string;
  } | null>(null);

  const [isCheckingAccount, setIsCheckingAccount] = useState(false);

  // 1. Reactive check untuk pendaftaran (Register Tab)
  useEffect(() => {
    let active = true;
    const checkRegisterAcc = async () => {
      if (tab !== 'register') {
        setExistingAccountRegister(null);
        return;
      }

      const checkWargaId = selectedCitizen?.id;
      const checkNoKk = selectedCitizen?.no_kk;
      const checkNik = selectedCitizen?.nik;
      const checkEmail = email.trim();

      if (!checkWargaId && !checkEmail) {
        setExistingAccountRegister(null);
        return;
      }

      setIsCheckingAccount(true);
      try {
        const res = await checkCitizenAlreadyHasAccount({
          wargaId: checkWargaId,
          no_kk: checkNoKk,
          nik: checkNik,
          email: checkEmail || undefined,
        });
        if (active) {
          if (res.exists && res.account) {
            setExistingAccountRegister(res.account);
          } else {
            setExistingAccountRegister(null);
          }
        }
      } catch (err) {
        console.warn('[checkRegisterAcc Error]', err);
      } finally {
        if (active) setIsCheckingAccount(false);
      }
    };

    const timer = setTimeout(() => {
      checkRegisterAcc();
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedCitizen, email, role, tab, connectionStatus]);

  // 2. Reactive check untuk login (Login Tab)
  useEffect(() => {
    let active = true;
    const checkLoginAcc = async () => {
      if (tab !== 'login') {
        setExistingAccountLogin(null);
        return;
      }

      const checkEmail = email.trim();
      if (!checkEmail) {
        setExistingAccountLogin(null);
        return;
      }

      try {
        const res = await checkCitizenAlreadyHasAccount({
          email: checkEmail,
        });
        if (active) {
          if (res.exists && res.account) {
            setExistingAccountLogin(res.account);
          } else {
            setExistingAccountLogin(null);
          }
        }
      } catch (err) {
        console.warn('[checkLoginAcc Error]', err);
      }
    };

    const timer = setTimeout(() => {
      checkLoginAcc();
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [email, tab, connectionStatus]);

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Harap masukkan alamat email dan kata sandi Anda.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await loginPengurus(email, password);
      if (res.success && res.user) {
        setSuccessMessage(`Login berhasil! Selamat datang, ${res.user.nama} (${res.user.levelAkses || 'User'}). Mengalihkan ke dasbor...`);
        setTimeout(() => {
          onLoginSuccess(res.user!);
        }, 800);
      } else {
        setErrorMessage(
          res.error || 'Data login tidak sesuai dengan data di Supabase. Pastikan email & kata sandi benar, atau lakukan Registrasi terlebih dahulu.'
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem saat memverifikasi akun ke Supabase.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Register Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (existingAccountRegister) {
      setErrorMessage(
        `Registrasi Ditolak! Akun untuk "${existingAccountRegister.nama}" (${existingAccountRegister.role}) sudah terdaftar dengan email: ${existingAccountRegister.email}. Silakan langsung masuk lewat menu "Login ke Dasbor".`
      );
      return;
    }

    if (!nama.trim()) {
      setErrorMessage('Harap isi nama lengkap pengurus / warga.');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Harap isi alamat email yang valid.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Kata sandi harus terdiri dari minimal 6 karakter.');
      return;
    }
    if (isPengurusInti) {
      const cleanNoHp = noHp.trim();
      if (!cleanNoHp) {
        setErrorMessage('Pengurus Inti diwajibkan mengisi nomor WhatsApp / HP aktif.');
        return;
      }
      const digitsOnly = cleanNoHp.replace(/\D/g, '');
      if (digitsOnly.length < 9) {
        setErrorMessage('Nomor HP tidak valid. Masukkan minimal 9-13 digit nomor WhatsApp / HP yang aktif.');
        return;
      }
    }

    if (!selectedCitizen) {
      setErrorMessage(
        `Pendaftaran Ditolak! Anda belum terdaftar di Buku Data Warga ${wilayahShort}. Seluruh Pengurus maupun Warga wajib terdaftar di Data Warga terlebih dahulu sebelum dapat membuat akun. Silakan hubungi Pengurus RT untuk didaftarkan ke Data Warga.`
      );
      return;
    }

    // Proteksi Jabatan: Jika warga atau pendaftar lain memilih jabatan yang sudah ada di tabel pengurus, TOLAK!
    if (role !== 'Warga') {
      const jabatanCheck = await checkJabatanExistsInPengurus(role);
      if (jabatanCheck.exists) {
        setErrorMessage(
          `Pendaftaran Ditolak! Jabatan "${role}" sudah terisi di tabel pengurus ${wilayahShort} atas nama ${jabatanCheck.existingPengurusName || 'pengurus lain'}. Warga atau pendaftar lain tidak dapat memilih jabatan yang sudah terdaftar. Silakan pilih jabatan lain yang masih kosong atau daftar sebagai "Warga ${wilayahShort}".`
        );
        return;
      }
    }

    setIsLoading(true);
    try {
      const citizenData = selectedCitizen ? {
        wargaId: selectedCitizen.id,
        no_kk: selectedCitizen.no_kk,
        nik: selectedCitizen.nik,
        alamat_domisili: selectedCitizen.alamat_domisili,
      } : undefined;

      const res = await registerPengurus(email, password, nama, role, levelAkses, noHp.trim() || undefined, citizenData);
      if (res.success && res.user) {
        const registeredEmail = email;
        const registeredPassword = password;
        
        setSuccessMessage(
          `Registrasi berhasil! Data akun "${nama}" telah tersimpan di Supabase (Hak Akses: ${levelAkses}). Silakan lakukan Login untuk masuk ke dasbor.`
        );

        setTimeout(() => {
          setEmail(registeredEmail);
          setPassword(registeredPassword);
          setTab('login');
          setSuccessMessage(
            `Data akun telah tersimpan di Supabase! Email & kata sandi telah otomatis terisi. Klik "Login ke Dasbor" di bawah.`
          );
        }, 1500);
      } else {
        setErrorMessage(res.error || 'Gagal menyimpan data pendaftaran ke Supabase.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kendala saat registrasi ke Supabase.');
    } finally {
      setIsLoading(false);
    }
  };

  // Tema Latar Belakang Login: Oranye Gelap (Amber & Mewah - Pilihan Aktif)
  const currentTheme = {
    container: 'bg-gradient-to-br from-slate-950 via-neutral-950 to-orange-950 text-slate-100',
    orbs: (
      <>
        <div className="absolute top-1/4 -left-20 w-96 h-96 rounded-full bg-orange-600/30 blur-[130px] animate-pulse" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full bg-amber-500/25 blur-[140px] animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full bg-red-600/20 blur-[150px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#f97316_1px,transparent_1px)] [background-size:28px_28px] opacity-15" />
      </>
    ),
    title: 'text-white drop-shadow-md',
    subtitle: 'text-slate-300',
    emblemGlow: 'bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 opacity-75 blur-md',
    emblemBox: 'bg-gradient-to-br from-black via-amber-950 to-stone-900 text-white shadow-xl ring-2 ring-amber-500/30',
    emblemIconGrad: 'text-transparent bg-clip-text bg-gradient-to-tr from-amber-400 via-orange-300 to-yellow-300',
    badgeRt: 'bg-orange-500/20 text-orange-300 border border-orange-400/30 backdrop-blur-md shadow-sm',
    badgeKelurahan: 'bg-amber-500/20 text-amber-200 border border-amber-400/30 backdrop-blur-md',
    cardBorder: 'border-amber-500/30 shadow-2xl shadow-black/80',
    cardAccentBar: 'bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500',
    tabActiveLogin: 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md shadow-orange-600/30 ring-1 ring-orange-500',
    submitBtn: 'bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 hover:from-orange-500 hover:via-amber-500 shadow-orange-700/40 text-white',
    footerText: 'text-slate-400',
  };

  return (
    <div className={`min-h-screen ${currentTheme.container} flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden transition-colors duration-500`}>
      {/* Dynamic Colorful Ambient Lighting & Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden flex items-center justify-center -z-10">
        {currentTheme.orbs}
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Banner Khusus Mode Pratinjau Halaman Login */}
        {isPreviewMode && (
          <div className="mb-4 p-3 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-orange-300 text-slate-800 flex items-center justify-between gap-2.5 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping shrink-0" />
              <div>
                <span className="font-extrabold text-orange-950">Pratinjau Layar Login</span>
                <p className="text-[11px] text-slate-600 leading-tight">Tema Oranye Gelap Aktif</p>
              </div>
            </div>
            {onExitPreview && (
              <button
                type="button"
                onClick={onExitPreview}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shrink-0 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span>Kembali ke Dasbor</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Brand Card Header with Vibrant Colors */}
        <div 
          className="text-center mb-6 cursor-pointer select-none"
          onClick={() => {
            setDevClicks(prev => {
              const next = prev + 1;
              if (next === 5) {
                console.log("Developer Mode: Database configuration button unlocked!");
              }
              return next;
            });
          }}
          title="Klik 5x untuk memunculkan tombol Pengaturan Database jika sedang tersembunyi"
        >
          {/* Radiant Emblem Icon */}
          <div className="relative inline-block mb-3.5">
            <AppLogo className="w-20 h-20 drop-shadow-2xl relative z-10" />
            <div className="absolute -bottom-1 -right-1 z-20 w-6 h-6 rounded-full bg-emerald-500 ring-2 ring-slate-950 flex items-center justify-center text-white shadow-md">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mb-1.5">
            <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold ${currentTheme.badgeRt}`}>
              <Sparkles className="w-3 h-3 text-yellow-300" />
              <span>{wilayahShort}</span>
            </span>
            {sekretariat.kelurahan && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${currentTheme.badgeKelurahan}`}>
                <span>Kel. {sekretariat.kelurahan}</span>
              </span>
            )}
          </div>

          <h1 className={`text-2xl sm:text-3xl font-black tracking-tight ${currentTheme.title}`}>
            Buku Kas {wilayahShort}
          </h1>
          <p className={`text-xs sm:text-sm font-medium ${currentTheme.subtitle} mt-1`}>
            Sistem Pembukuan & Transparansi Keuangan Warga
          </p>
        </div>

        {/* Main Auth Container Card */}
        <div className={`bg-white rounded-2xl border ${currentTheme.cardBorder} overflow-hidden text-slate-900 relative`}>
          {/* Top Multi-Color Vibrant Accent Bar */}
          <div className={`h-1.5 w-full ${currentTheme.cardAccentBar}`} />

          {/* Top Switcher Tabs with Rich Colors */}
          <div className="flex border-b border-slate-200 bg-slate-50/80 p-1.5 gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (tab !== 'login') {
                  setEmail('');
                  setPassword('');
                  setNama('');
                  setSelectedCitizen(null);
                }
                setTab('login');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                tab === 'login'
                  ? currentTheme.tabActiveLogin
                  : 'text-slate-600 hover:text-orange-600 hover:bg-orange-50/60'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>Login ke Dasbor</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (tab !== 'register') {
                  setEmail('');
                  setPassword('');
                  setNama('');
                  setSelectedCitizen(null);
                  setRole('Warga');
                  setLevelAkses('User');
                }
                setTab('register');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                tab === 'register'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30 ring-1 ring-emerald-500'
                  : 'text-slate-600 hover:text-emerald-600 hover:bg-emerald-50/60'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Daftar Akun</span>
            </button>
          </div>

          <div className="p-6 sm:p-7">
            {/* Colorful Context Helper Banner */}
            <div className={`mb-4 px-3.5 py-2.5 rounded-xl border text-[11.5px] flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all ${
              tab === 'login'
                ? 'bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-blue-50/90 border-blue-200 text-blue-950'
                : 'bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-emerald-50/90 border-emerald-200 text-emerald-950'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 animate-ping ${
                  tab === 'login' ? 'bg-blue-500' : 'bg-emerald-500'
                }`} />
                <span>
                  {tab === 'login' ? (
                    <>
                      <strong>Langkah 1:</strong> Masuk dengan akun pengurus atau warga yang telah terdaftar di Supabase.
                    </>
                  ) : (
                    <>
                      <strong>Langkah 2:</strong> Daftarkan akun baru, data akan tersimpan aman di tabel Supabase.
                    </>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const targetTab = tab === 'register' ? 'login' : 'register';
                  setEmail('');
                  setPassword('');
                  setNama('');
                  setSelectedCitizen(null);
                  if (targetTab === 'register') {
                    setRole('Warga');
                    setLevelAkses('User');
                  }
                  setTab(targetTab);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`font-bold shrink-0 hover:underline cursor-pointer self-end sm:self-auto text-xs flex items-center gap-1 ${
                  tab === 'login' ? 'text-blue-700 hover:text-blue-900' : 'text-emerald-700 hover:text-emerald-900'
                }`}
              >
                <span>{tab === 'login' ? 'Belum daftar? Buat Akun' : 'Sudah punya akun? Login'}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Notification & Alerts with Colorful Styling */}
            {connectionStatus === 'error' && (
              <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 text-amber-900 text-xs flex flex-col gap-2 shadow-xs animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <div className="p-1 rounded-lg bg-amber-200/80 text-amber-800 shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-amber-950 mb-0.5">Koneksi Database Supabase Terputus / Project Dihapus</p>
                    <p className="leading-relaxed text-amber-800">
                      Sistem mendeteksi bahwa database Supabase kustom Anda tidak lagi dapat diakses (mungkin tabel dihapus atau project Supabase dinonaktifkan).
                    </p>
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenSupabaseConfig) onOpenSupabaseConfig();
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors cursor-pointer text-[11px]"
                  >
                    Atur Database Kustom Baru
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetSupabaseCredentials();
                      window.location.reload();
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold rounded-lg transition-colors cursor-pointer text-[11px]"
                  >
                    Bersihkan Cache & Reset Total
                  </button>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-rose-50 to-red-50 border border-rose-300 text-rose-800 text-xs flex items-start gap-2.5 shadow-sm animate-in fade-in">
                <div className="p-1 rounded-lg bg-rose-200/70 text-rose-700 shrink-0 mt-0.5">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <span className="font-semibold leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 text-emerald-900 text-xs flex flex-col gap-2.5 shadow-sm animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <div className="p-1 rounded-lg bg-emerald-200/70 text-emerald-800 shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="font-semibold leading-relaxed">{successMessage}</span>
                </div>
              </div>
            )}

            {/* TAB 1: LOGIN */}
            {tab === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                      <span>Alamat Email Terdaftar</span>
                    </span>
                    <span className="text-[10px] text-blue-600 font-semibold lowercase">pengurus/warga</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                        <Mail className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contoh: bendahara@rt02.id"
                      className="w-full pl-12 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all shadow-2xs"
                    />
                  </div>
                  {/* Indikator Jabatan Terkait Email yang diketik */}
                  {existingAccountLogin ? (
                    <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-[11px] flex items-start gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-emerald-900 block">Akun Terdaftar Aktif!</span>
                        <span className="text-[10.5px] text-emerald-800 block mt-0.5 leading-relaxed">
                          Selamat datang kembali, <strong>{existingAccountLogin.nama}</strong> ({existingAccountLogin.role}). Anda sudah memiliki akun. Silakan masukkan kata sandi Anda.
                        </span>
                      </div>
                    </div>
                  ) : (() => {
                    const clean = email.trim().toLowerCase();
                    if (!clean) return null;
                    const rolesToCheck = ['Ketua RT', 'Sekretaris', 'Bendahara', 'Wakil Ketua RT'];
                    for (const r of rolesToCheck) {
                      const matched = getOccupiedInfo(r);
                      if (matched && matched.email && matched.email.toLowerCase() === clean) {
                        return (
                          <p key={r} className="mt-1 text-[11px] text-emerald-700 font-medium flex items-center gap-1 animate-in fade-in">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Email ini cocok dengan jabatan <strong>{r}: Sudah Terisi ({matched.nama})</strong></span>
                          </p>
                        );
                      }
                    }
                    return null;
                  })()}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Kata Sandi</span>
                    </label>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-12 pr-10 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-indigo-600 cursor-pointer transition-colors"
                      title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit & Exit Buttons in a Flex Container */}
                <div className="flex gap-3 mt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`flex-[3] py-3 px-4 ${currentTheme.submitBtn} active:scale-[0.99] font-bold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Verifikasi...</span>
                      </>
                    ) : (
                      <>
                        <span>Login Dasbor</span>
                        <ArrowRight className="w-4.5 h-4.5" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (isPreviewMode && onExitPreview) {
                        onExitPreview();
                      } else if (onExitApp) {
                        onExitApp();
                      } else {
                        try {
                          window.open('', '_self', '');
                          window.close();
                        } catch (e) {
                          console.warn(e);
                        }
                      }
                    }}
                    className="flex-1 py-3 px-3 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 active:scale-[0.99] text-slate-700 font-bold text-sm rounded-xl border border-slate-200/80 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs hover:shadow-xs group"
                    title="Keluar / Tutup Aplikasi"
                  >
                    <LogOut className="w-4 h-4 text-slate-500 group-hover:text-rose-600 transition-colors" />
                    <span>Keluar</span>
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: REGISTER */}
            {tab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                {existingAccountRegister && (
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-orange-400 text-orange-950 text-xs flex items-start gap-2.5 shadow-sm animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      <span className="font-extrabold text-orange-900 block">Warga / Pengurus Ini Sudah Memiliki Akun!</span>
                      <span className="text-[11px] text-orange-850 block mt-1">
                        Nama: <strong>{existingAccountRegister.nama}</strong> ({existingAccountRegister.role}) sudah terdaftar dengan alamat email: <strong>{existingAccountRegister.email}</strong>. 
                      </span>
                      <span className="text-[11px] text-slate-700 block mt-1.5 font-medium">
                        Anda tidak perlu mendaftar ulang. Silakan klik tombol di bawah untuk langsung menuju halaman masuk (Login).
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEmail(existingAccountRegister.email);
                          setTab('login');
                          setErrorMessage(null);
                          setSuccessMessage(`Email "${existingAccountRegister.email}" otomatis terisi. Silakan masukkan kata sandi.`);
                        }}
                        className="mt-2.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg transition-all text-[11px] shadow-sm hover:shadow cursor-pointer flex items-center gap-1 font-semibold"
                      >
                        <span>Menuju Halaman Login</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                      <span>Jabatan / Amanah di {wilayahShort}</span>
                    </span>
                    <span className="text-[10px] text-amber-700 font-semibold">Warga & Pengurus RT</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <select
                      value={role}
                      onChange={(e) => {
                        const newRole = e.target.value as PengurusRole;
                        setRole(newRole);
                        if (newRole === 'Warga') {
                          setLevelAkses('User');
                        } else {
                          setLevelAkses('Admin');
                        }
                      }}
                      className="w-full pl-12 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent focus:bg-white transition-all cursor-pointer font-semibold shadow-2xs"
                    >
                      <option value="Warga">Warga {wilayahShort} (Terdaftar di Buku Data Warga)</option>
                      {SUSUNAN_PENGURUS_RT.map((p) => {
                        const isInti = ['Ketua RT', 'Wakil Ketua RT', 'Sekretaris', 'Bendahara'].includes(p.role);
                        const occupied = getOccupiedInfo(p.role);
                        return (
                          <option key={p.no} value={p.role}>
                            {p.role} {isInti ? '★ (Pengurus Inti)' : ''} {occupied ? `[Sudah Terisi: ${occupied.nama}]` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  {currentOccupiedJabatan && (
                    <div className="mt-2.5 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300/80 text-amber-950 text-xs flex items-start gap-2.5 shadow-xs animate-in fade-in">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <span className="font-bold text-amber-950 block">Perhatian: Jabatan Ini Sudah Terdaftar!</span>
                        <span className="text-[11px] text-amber-800 block mt-0.5">
                          Jabatan <strong>"{role}"</strong> sudah tercatat di tabel pengurus atas nama <strong>{currentOccupiedJabatan.nama}</strong>. Warga atau pendaftar lain yang memilih jabatan ini akan <strong>ditolak saat membuat akun</strong>. Silakan pilih jabatan lain yang masih kosong atau pilih <strong>Warga {wilayahShort}</strong>.
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* PEMILIHAN DATA WARGA / PENGURUS TERDAFTAR DARI DATA_WARGA */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        {role === 'Warga'
                          ? `Pilih Data Warga Terdaftar di ${wilayahShort}`
                          : `Pilih Nama Pengurus dari Data Warga ${wilayahShort}`}
                      </span>
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {dataWargaList.length} Warga Terdata
                    </span>
                  </label>

                  {!selectedCitizen ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                            <Search className="w-3.5 h-3.5" />
                          </div>
                        </div>
                        <input
                          type="text"
                          value={wargaSearchTerm}
                          onChange={(e) => {
                            setWargaSearchTerm(e.target.value);
                            setIsWargaDropdownOpen(true);
                          }}
                          onFocus={() => setIsWargaDropdownOpen(true)}
                          placeholder="Ketik Nama KK / NIK / No. KK / Alamat..."
                          className="w-full pl-12 pr-10 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:bg-white transition-all shadow-2xs"
                        />
                        {wargaSearchTerm && (
                          <button
                            type="button"
                            onClick={() => {
                              setWargaSearchTerm('');
                              setIsWargaDropdownOpen(true);
                            }}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Dropdown / List Hasil Pencarian Warga */}
                      <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
                        {isLoadingWargaList ? (
                          <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                            <span>Memuat daftar warga RT...</span>
                          </div>
                        ) : filteredDataWarga.length > 0 ? (
                          filteredDataWarga.map((w) => (
                            <button
                              key={w.id}
                              type="button"
                              onClick={() => {
                                setSelectedCitizen(w);
                                setNama(w.nama_lengkap);
                                if (w.no_hp) setNoHp(w.no_hp);
                                setIsWargaDropdownOpen(false);
                                setErrorMessage(null);
                              }}
                              className="w-full p-2.5 text-left hover:bg-emerald-50/80 active:bg-emerald-100/70 transition-colors flex items-start gap-2.5 group cursor-pointer"
                            >
                              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-emerald-600 group-hover:text-white flex items-center justify-center text-xs font-bold shrink-0 transition-colors mt-0.5">
                                {w.nama_lengkap.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-xs font-bold text-slate-900 group-hover:text-emerald-950 truncate">
                                    {w.nama_lengkap}
                                    {hasAccountMap[w.id] && (
                                      <span className="text-rose-600 font-extrabold text-[10px] ml-1"> (sudah terdaftar)</span>
                                    )}
                                  </span>
                                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                                    Pilih
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[10.5px] text-slate-500 mt-0.5 flex-wrap">
                                  {w.no_kk && <span>KK: <strong className="font-mono text-slate-700">{w.no_kk}</strong></span>}
                                  {w.nik && <span>• NIK: <span className="font-mono text-slate-600">{w.nik}</span></span>}
                                </div>
                                {w.alamat_domisili && (
                                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                    {w.alamat_domisili}
                                  </p>
                                )}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="p-4 text-center">
                            <p className="text-xs font-semibold text-slate-700">Warga tidak ditemukan</p>
                            <p className="text-[10.5px] text-slate-500 mt-1">
                              Tidak ada data warga yang sesuai dengan pencarian "{wargaSearchTerm}".
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-300 text-[11px] text-amber-950 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="leading-relaxed">
                          <strong>Nama Anda belum tercatat di data RT?</strong> Baik Pengurus maupun Warga wajib terdaftar di Buku Data Warga terlebih dahulu sebelum membuat akun. Silakan hubungi Pengurus RT (Ketua/Sekretaris) untuk didaftarkan ke Data Warga.
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* CARD WARGA / PENGURUS TERPILIH & TERVERIFIKASI */
                    <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white border-2 border-emerald-500 shadow-xs animate-in fade-in">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-800 block">
                              {role === 'Warga' ? 'Warga Terhubung (Terverifikasi)' : `Pengurus Terhubung: ${role}`}
                            </span>
                            <span className="text-sm font-bold text-slate-900 block">
                              {selectedCitizen.nama_lengkap}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCitizen(null);
                            setNama('');
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200 rounded-lg border border-emerald-300 cursor-pointer transition-colors"
                        >
                          Ganti Pilihan
                        </button>
                      </div>

                      <div className="mt-2.5 pt-2.5 border-t border-emerald-200/80 grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-500 text-[10px] block">No. KK (ID Kependudukan):</span>
                          <span className="font-mono font-bold text-emerald-950">
                            {selectedCitizen.no_kk || '(Belum ada No. KK)'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px] block">NIK Kependudukan:</span>
                          <span className="font-mono text-slate-700">
                            {selectedCitizen.nik || '-'}
                          </span>
                        </div>
                        {selectedCitizen.alamat_domisili && (
                          <div className="col-span-2 mt-0.5">
                            <span className="text-slate-500 text-[10px] block">Alamat Domisili:</span>
                            <span className="text-slate-700">
                              {selectedCitizen.alamat_domisili}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Pilihan Jenis Pengguna & Hak Akses dengan Warna Kontras */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Jenis Pengguna & Hak Akses
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLevelAkses('Admin')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                        levelAkses === 'Admin'
                          ? 'bg-gradient-to-br from-amber-500/10 via-amber-50 to-orange-50/80 border-amber-400 text-amber-950 ring-2 ring-amber-400/50 shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>Admin RT</span>
                        </span>
                        {levelAkses === 'Admin' && (
                          <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-600 mt-1 leading-tight font-medium">
                        Akses penuh (Input, Koreksi, Laporan & Kelola Kategori)
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLevelAkses('User')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                        levelAkses === 'User'
                          ? 'bg-gradient-to-br from-blue-500/10 via-blue-50 to-cyan-50/80 border-blue-400 text-blue-950 ring-2 ring-blue-400/50 shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span>User (Warga)</span>
                        </span>
                        {levelAkses === 'User' && (
                          <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-600 mt-1 leading-tight font-medium">
                        Hanya bisa membuka & melihat halaman <strong>Laporan Keuangan</strong>
                      </p>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Alamat Email Resmi</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                        <Mail className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contoh: pengurus@rt02.id"
                      className="w-full pl-12 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:bg-white transition-all shadow-2xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Kata Sandi (Minimal 6 Karakter)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full pl-12 pr-10 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:bg-white transition-all shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-emerald-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Teks Isian Khusus Nomor HP untuk Pengurus Inti */}
                {isPengurusInti && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-amber-600" />
                        <span>Nomor HP / WhatsApp Pengurus</span>
                      </span>
                      <span className="text-[10px] text-amber-700 font-bold bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-300">
                        Wajib Diisi Pengurus Inti
                      </span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                          <Phone className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <input
                        type="tel"
                        required
                        value={noHp}
                        onChange={(e) => setNoHp(e.target.value)}
                        placeholder="contoh: 081234567890 atau 0857..."
                        className="w-full pl-12 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent focus:bg-white transition-all shadow-2xs font-medium"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                      *Nomor WhatsApp ini digunakan untuk koordinasi kepengurusan RT.
                    </p>
                  </div>
                )}

                {/* Submit Register Button with Emerald Gradient */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:via-teal-500 hover:to-emerald-600 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Menyimpan Akun ke Supabase...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>Simpan ke Supabase & Siap Login</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Card Footer: Supabase Live Status with Vibrant Visual Badge */}
          <div className="px-6 py-3.5 bg-gradient-to-r from-slate-50 via-slate-100/70 to-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {isConnected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isConnected ? 'bg-emerald-500' : 'bg-amber-400'
                }`} />
              </span>
              <span className="font-semibold text-slate-700">
                {isConnected ? 'Database Supabase Online' : 'Penyimpanan Lokal Aktif'}
              </span>
            </div>

            {onOpenSupabaseConfig && (
              devClicks >= 5 || 
              window.location.search.includes('config=true') || 
              window.location.search.includes('dev=true') || 
              window.location.search.includes('setup=true')
            ) && (
              <button
                type="button"
                onClick={onOpenSupabaseConfig}
                className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 hover:underline cursor-pointer text-[11px]"
              >
                <Database className="w-3.5 h-3.5 text-blue-600" />
                <span>Pengaturan Database</span>
              </button>
            )}
          </div>
        </div>

        {/* Security & Confidentiality Footer */}
        <div className="text-center mt-4">
          <p className={`text-[11px] ${currentTheme.footerText} leading-relaxed flex items-center justify-center gap-1.5`}>
            <Shield className="w-3 h-3 text-emerald-400" />
            <span>Kas {wilayahShort}{sekretariat.kelurahan ? `, ${sekretariat.kelurahan}` : ''} • Terproteksi & Akuntabel</span>
          </p>
        </div>
      </div>
    </div>
  );
};
