import React, { useState, useEffect, useCallback } from 'react';
import {
  CloudOff,
  Database,
  CheckCircle2,
  Upload,
  Loader2,
  RefreshCw,
  KeyRound,
  Link2,
  Settings,
} from 'lucide-react';
import {
  ActiveTab,
  Transaction,
  TransactionType,
  CategoryItem,
  ToastInfo,
  SupabaseConnectionStatus,
  ThemeName,
  UserProfile,
} from './types';
import { INITIAL_TRANSACTIONS, INITIAL_CATEGORIES, formatSimpleRupiah, formatDateIndo } from './data/initialData';

/**
 * Format tanggal ke format standar Indonesia: dd/mm/yyyy
 * Menggunakan toLocaleDateString('id-ID') dengan penguncian urutan dd/mm/yyyy
 * agar tampilan di browser lokal tidak berubah menjadi format Amerika (mm/dd/yyyy).
 */
export function formatTanggalIndonesia(dateStr: string): string {
  return formatDateIndo(dateStr);
}
import { AppLogo } from './components/AppLogo';
import { AppExitScreen } from './components/AppExitScreen';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { AuthScreen } from './components/AuthScreen';
import { InputRiwayatView } from './components/InputRiwayatView';
import { KoreksiHapusView } from './components/KoreksiHapusView';
import { LaporanKeuanganView } from './components/LaporanKeuanganView';
import { KelolaKategoriView } from './components/KelolaKategoriView';
import { KelolaDataView } from './components/KelolaDataView';
import { SiaranWargaView } from './components/SiaranWargaView';
import { InventarisRTView } from './components/InventarisRTView';
import { Toast } from './components/Toast';
import { ExportModal } from './components/ExportModal';
import { ImportModal } from './components/ImportModal';
import { SupabaseModal } from './components/SupabaseModal';
import { UserPhotoModal } from './components/UserPhotoModal';
import { useSekretariat } from './context/SekretariatContext';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SekretariatSetupScreen } from './components/SekretariatSetupScreen';
import { DaruratSirenModal } from './components/DaruratSirenModal';
import { DaruratTriggerModal } from './components/DaruratTriggerModal';
import { startSirenAlarm, stopSirenAlarm } from './lib/siren';
import {
  triggerSOSBackgroundAlert,
  dismissSOSBackgroundAlert,
} from './lib/alarmNotification';
import {
  getActiveSupabaseConfig,
  fetchKasFromSupabase,
  insertKasToSupabase,
  updateKasInSupabase,
  deleteKasFromSupabase,
  seedInitialTransactionsToSupabase,
  insertMultipleKasToSupabase,
  cleanSupabaseUrl,
  cleanAnonKey,
  testSupabaseConnection,
  setSupabaseCredentials,
  fetchCategoriesFromSupabase,
  createCategoryInSupabase,
  updateCategoryInSupabase,
  deleteCategoryFromSupabase,
  seedInitialCategoriesToSupabase,
  getCurrentPengurusSession,
  logoutPengurus,
  updateUserProfileInStorage,
  initializeSystemWithCorePengurus,
  fetchActiveEmergencyAlerts,
  insertEmergencyAlertToSupabase,
  resolveEmergencyAlertInSupabase,
  getSupabase,
  EmergencyAlertItem,
} from './lib/supabase';

export default function App() {
  const { 
    sekretariat, 
    wilayahShort, 
    wilayahLabel, 
    isDbEmpty, 
    updateSekretariat, 
    reloadSekretariat,
    isLoading: isSekretariatLoading, 
    error: sekretariatError 
  } = useSekretariat();
  const [activeTab, setActiveTab] = useState<ActiveTab>('input-riwayat-transaksi');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Authentication State
  const [activeUser, setActiveUser] = useState<UserProfile | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isPreviewingLogin, setIsPreviewingLogin] = useState(false);
  const [isAppClosed, setIsAppClosed] = useState(false);
  const [isUserPhotoModalOpen, setIsUserPhotoModalOpen] = useState(false);
  const [exportModalState, setExportModalState] = useState<{
    isOpen: boolean;
    filteredTransactions?: Transaction[];
    filterLabel?: string;
  }>({
    isOpen: false,
  });
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<SupabaseConnectionStatus>('connecting');
  const [isFetchingSupabase, setIsFetchingSupabase] = useState(false);
  const [toast, setToast] = useState<ToastInfo | null>(null);

  // Emergency Siren Realtime States
  const [activeEmergencies, setActiveEmergencyAlerts] = useState<EmergencyAlertItem[]>([]);
  const [isAudioSirenPlaying, setIsAudioSirenPlaying] = useState(false);
  const [isTriggerSosModalOpen, setIsTriggerSosModalOpen] = useState(false);

  const handleSaveUserPhoto = async (updated: UserProfile) => {
    setActiveUser(updated);
    await updateUserProfileInStorage(updated);
    showToast(
      updated.fotoUrl
        ? 'Foto profil dan ukuran tampilan berhasil disimpan!'
        : 'Foto profil dinonaktifkan, kembali menggunakan inisial 2 huruf.',
      'success',
      'Profil Pengguna Diperbarui'
    );
  };

  const handleOpenExport = (filtered?: Transaction[], label?: string) => {
    setExportModalState({
      isOpen: true,
      filteredTransactions: filtered,
      filterLabel: label,
    });
  };

  const handleCloseExport = () => {
    setExportModalState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleOpenImport = () => {
    setIsImportModalOpen(true);
  };

  const handleCloseImport = () => {
    setIsImportModalOpen(false);
  };

  // Theme State with localStorage persistence
  const [theme, setTheme] = useState<ThemeName>(() => {
    const saved = localStorage.getItem('kas_rt_theme');
    return (saved === 'sapphire' || saved === 'indigo' || saved === 'emerald') ? (saved as ThemeName) : 'sapphire';
  });

  const handleSelectTheme = (newTheme: ThemeName) => {
    setTheme(newTheme);
    localStorage.setItem('kas_rt_theme', newTheme);
    const themeLabels: Record<ThemeName, string> = {
      sapphire: 'Sapphire Blue (Biru Modern)',
      emerald: 'Emerald Mint (Hijau Zamrud Asri)',
      indigo: 'Royal Indigo (Ungu Mewah)',
    };
    showToast(`Tema visual diubah menjadi ${themeLabels[newTheme]}.`, 'info', 'Tema Diperbarui');
  };

  // Transactions State
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('kas_rt_transactions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse cached transactions', e);
      }
    }
    return INITIAL_TRANSACTIONS;
  });

  // Categories State
  const [categories, setCategories] = useState<CategoryItem[]>(() => {
    const saved = localStorage.getItem('kas_rt_categories');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Failed to parse cached categories', e);
      }
    }
    return [];
  });
  const [isFetchingCategories, setIsFetchingCategories] = useState(false);

  // Toast Helper
  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success', title?: string) => {
      const id = Date.now().toString();
      setToast({ id, message, type, title });
      setTimeout(() => {
        setToast((curr) => (curr?.id === id ? null : curr));
      }, 3500);
    },
    []
  );

  // Supabase Quick Connect Form State
  const [quickUrl, setQuickUrl] = useState(() => getActiveSupabaseConfig().url);
  const [quickAnonKey, setQuickAnonKey] = useState(() => getActiveSupabaseConfig().anonKey);
  const [isQuickConnecting, setIsQuickConnecting] = useState(false);

  // Quick Connect Handler directly from banner
  const handleQuickConnect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const sanitizedUrl = cleanSupabaseUrl(quickUrl);
    const sanitizedKey = cleanAnonKey(quickAnonKey);

    if (!sanitizedUrl || !sanitizedKey) {
      showToast('Harap masukkan Project URL dan Anon Key Supabase.', 'error', 'Form Belum Lengkap');
      setIsSupabaseModalOpen(true);
      return;
    }

    setIsQuickConnecting(true);
    setConnectionStatus('connecting');

    const res = await testSupabaseConnection(sanitizedUrl, sanitizedKey);
    setIsQuickConnecting(false);

    if (res.success) {
      setSupabaseCredentials(sanitizedUrl, sanitizedKey);
      showToast('Koneksi Supabase berhasil diaktifkan dan terhubung ke tabel kas_rt!', 'success', 'Supabase Live Aktif');
      loadTransactions(true);
      loadCategories(true);
    } else {
      setSupabaseCredentials(sanitizedUrl, sanitizedKey);
      setConnectionStatus('error');
      showToast(res.message, 'error', 'Koneksi Gagal');
      setIsSupabaseModalOpen(true);
    }
  };

  // 1. Fetch data from Supabase (Tabel: kas_rt) or fallback to local
  const loadTransactions = useCallback(
    async (forceNotice = false) => {
      const config = getActiveSupabaseConfig();

      if (!config.isConfigured) {
        setConnectionStatus('demo');
        const saved = localStorage.getItem('kas_rt_transactions');
        if (saved) {
          try {
            setTransactions(JSON.parse(saved));
          } catch {
            setTransactions(INITIAL_TRANSACTIONS);
          }
        } else {
          setTransactions(INITIAL_TRANSACTIONS);
        }
        if (forceNotice) {
          showToast(
            'Koneksi Supabase belum aktif. Silakan masukkan URL & Anon Key untuk menghubungkan ke database live.',
            'info',
            'Aktivasi Supabase'
          );
          setIsSupabaseModalOpen(true);
        }
        return;
      }

      setConnectionStatus('connecting');
      setIsFetchingSupabase(true);

      const { data, error } = await fetchKasFromSupabase();
      setIsFetchingSupabase(false);

      if (error) {
        setConnectionStatus('error');
        showToast(`Gagal memuat dari Supabase: ${error}`, 'error', 'Supabase Error');
        // Fallback to local storage cache
        const saved = localStorage.getItem('kas_rt_transactions');
        if (saved) {
          try {
            setTransactions(JSON.parse(saved));
          } catch {}
        }
        return;
      }

      if (data) {
        setConnectionStatus('connected');
        setTransactions(data);
        localStorage.setItem('kas_rt_transactions', JSON.stringify(data));

        if (forceNotice) {
          showToast(
            `Berhasil memuat ${data.length} transaksi dari tabel 'kas_rt' Supabase.`,
            'success',
            'Supabase Live'
          );
        }
      }
    },
    [showToast]
  );

  // 2. Fetch kategori dari Supabase (Tabel: kategori) or fallback to local
  const loadCategories = useCallback(
    async (forceNotice = false) => {
      const config = getActiveSupabaseConfig();

      if (!config.isConfigured) {
        const saved = localStorage.getItem('kas_rt_categories');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              setCategories(parsed);
              return;
            }
          } catch {}
        }
        setCategories([]);
        return;
      }

      setIsFetchingCategories(true);
      const { data, error } = await fetchCategoriesFromSupabase();
      setIsFetchingCategories(false);

      if (error) {
        console.warn('Supabase categories error, fallback to cache:', error);
        const saved = localStorage.getItem('kas_rt_categories');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) setCategories(parsed);
          } catch {}
        }
        return;
      }

      if (data) {
        setCategories(data);
        localStorage.setItem('kas_rt_categories', JSON.stringify(data));

        if (forceNotice) {
          showToast(
            `Berhasil memuat ${data.length} kategori dari tabel Supabase.`,
            'success',
            'Kategori Live'
          );
        }
      }
    },
    [showToast]
  );

  // Poll & Load active emergencies
  const loadActiveEmergencies = useCallback(async () => {
    const { data } = await fetchActiveEmergencyAlerts();
    if (data) {
      setActiveEmergencyAlerts(data);
    }
  }, []);

  // Sync Audio playing and background notifications with state
  useEffect(() => {
    if (activeEmergencies.length > 0) {
      setIsAudioSirenPlaying(true);
      startSirenAlarm();
      // Trigger background audio & push notifications
      triggerSOSBackgroundAlert(activeEmergencies[0]);
    } else {
      setIsAudioSirenPlaying(false);
      stopSirenAlarm();
      dismissSOSBackgroundAlert();
    }
    // Safety cleanup when component unmounts
    return () => {
      stopSirenAlarm();
      dismissSOSBackgroundAlert();
    };
  }, [activeEmergencies]);

  // Realtime Supabase Subscription & Fallback Poller
  useEffect(() => {
    loadActiveEmergencies();

    // Poll every 6 seconds as a robust fail-safe fallback
    const pollInterval = setInterval(() => {
      loadActiveEmergencies();
    }, 6000);

    // Setup real-time postgres changes and broadcast channels
    const client = getSupabase();
    let channel: any = null;

    if (client) {
      try {
        channel = client.channel('darurat-realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'darurat_rt' }, (payload) => {
            console.log('[REALTIME SOS CHANGE EVENT]', payload);
            loadActiveEmergencies();
          })
          .on('broadcast', { event: 'sos-alert' }, (payload) => {
            console.log('[REALTIME SOS BROADCAST EVENT]', payload);
            loadActiveEmergencies();
          })
          .subscribe((status) => {
            console.log('[REALTIME SOS STATUS]', status);
          });
      } catch (err) {
        console.warn('Failed to subscribe to realtime emergency:', err);
      }
    }

    return () => {
      clearInterval(pollInterval);
      if (channel && client) {
        try {
          client.removeChannel(channel);
        } catch {}
      }
    };
  }, [loadActiveEmergencies]);

  // Dismiss siren audio only (local)
  const handleDismissSirenAudio = () => {
    setIsAudioSirenPlaying(false);
    stopSirenAlarm();
    dismissSOSBackgroundAlert();
  };

  // Trigger global SOS alert dispatch
  const handleTriggerEmergencyAlert = async (tipe: string, desc: string) => {
    if (!activeUser) {
      showToast('Anda harus masuk log terlebih dahulu untuk mengirim SOS.', 'error', 'Sesi Kosong');
      return;
    }

    const { data, error } = await insertEmergencyAlertToSupabase({
      id_warga: activeUser.wargaId || activeUser.id,
      nama_warga: activeUser.nama,
      alamat: activeUser.alamat_domisili || 'RT.002 RW.09, Kelurahan Pondok Rajeg',
      no_hp: activeUser.no_hp || undefined,
      tipe_darurat: tipe,
      status: 'Aktif',
      keterangan: desc.trim() || undefined,
    });

    if (error) {
      showToast(`Gagal memicu alarm darurat: ${error}`, 'error');
    } else {
      showToast('ALARM DARURAT BERHASIL DISIARKAN! Seluruh warga telah diberitahu.', 'success', 'Sinyal Disiarkan');
      loadActiveEmergencies();

      // Trigger instant realtime broadcast to other connected tabs
      const client = getSupabase();
      if (client) {
        try {
          client.channel('darurat-realtime').send({
            type: 'broadcast',
            event: 'sos-alert',
            payload: { message: 'SOS triggered!' }
          });
        } catch {}
      }
    }
  };

  // Resolve alert globally (marking status = Selesai in Supabase)
  const handleResolveEmergencyAlert = async (id: string) => {
    const { success, error } = await resolveEmergencyAlertInSupabase(id);
    if (success) {
      showToast('Situasi darurat berhasil ditandai Selesai. Sirene dimatikan.', 'success', 'Situasi Teratasi');
      loadActiveEmergencies();

      // Broadcast update instantly
      const client = getSupabase();
      if (client) {
        try {
          client.channel('darurat-realtime').send({
            type: 'broadcast',
            event: 'sos-alert',
            payload: { message: 'SOS resolved!' }
          });
        } catch {}
      }
    } else {
      showToast(`Gagal menutup situasi darurat: ${error}`, 'error');
    }
  };

  // "Saya Segera Datang" citizen response
  const handleConfirmComing = (alert: any) => {
    showToast(`Terima kasih atas kepedulian Anda! Respons datang dikonfirmasi untuk warga "${alert.nama_warga}". Harap berhati-hati saat memberikan pertolongan.`, 'success', 'Respons Tercatat');
    // Locally mute the sound so they don't have a wailing alarm in their hand while running to help,
    // but keep the modal open so they can see location details.
    setIsAudioSirenPlaying(false);
    stopSirenAlarm();
  };

  // Check pengurus login session on startup
  useEffect(() => {
    const checkSession = async () => {
      try {
        const user = await getCurrentPengurusSession();
        if (user) {
          setActiveUser(user);
        }
      } catch (err) {
        console.warn('Check session error:', err);
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkSession();
  }, []);

  const handleLoginSuccess = (user: UserProfile) => {
    setActiveUser(user);
    // Jika user berlevel 'User', otomatis arahkan ke halaman Laporan Keuangan, jika Admin arahkan ke Input & Riwayat
    if (user.levelAkses === 'User') {
      setActiveTab('laporan-keuangan');
    } else {
      setActiveTab('input-riwayat-transaksi');
    }
    showToast(`Selamat datang, ${user.nama} (${user.role} - Akses: ${user.levelAkses || 'User'})!`, 'success', 'Berhasil Masuk');
    loadTransactions(false);
    loadCategories(false);
  };

  const handleLogout = async () => {
    await logoutPengurus();
    setActiveUser(null);
    showToast('Anda telah keluar dari aplikasi kas RT.', 'info', 'Logout Berhasil');
  };

  // Initial load
  useEffect(() => {
    loadTransactions();
    loadCategories();
  }, [loadTransactions, loadCategories]);

  // Sync to local storage as offline cache
  useEffect(() => {
    if (transactions.length > 0) {
      localStorage.setItem('kas_rt_transactions', JSON.stringify(transactions));
    }
  }, [transactions]);

  useEffect(() => {
    if (categories.length > 0) {
      localStorage.setItem('kas_rt_categories', JSON.stringify(categories));
    }
  }, [categories]);

  // Auto focus window and active view container when dashboard is open or tab changes
  useEffect(() => {
    if (activeUser && !isPreviewingLogin) {
      window.focus();
      const mainEl = document.getElementById('main-content-scroll');
      if (mainEl) {
        mainEl.focus({ preventScroll: true });
      }
    }
  }, [activeUser, activeTab, isPreviewingLogin]);

  // Global Keyboard Navigation (ArrowUp / ArrowDown / PageUp / PageDown / Home / End)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is interacting with form controls or content editable
      const activeEl = document.activeElement;
      const tagName = activeEl?.tagName?.toUpperCase();
      const isContentEditable = activeEl?.getAttribute('contenteditable') === 'true';
      const isInputActive = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || isContentEditable;

      if (isInputActive) {
        return;
      }

      // Check if modal dialog is currently open
      if (exportModalState.isOpen || isImportModalOpen || isSupabaseModalOpen || isUserPhotoModalOpen) {
        return;
      }

      const SCROLL_STEP = 90;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        window.scrollBy({ top: SCROLL_STEP, behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        window.scrollBy({ top: -SCROLL_STEP, behavior: 'smooth' });
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        window.scrollBy({ top: window.innerHeight * 0.75, behavior: 'smooth' });
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        window.scrollBy({ top: -window.innerHeight * 0.75, behavior: 'smooth' });
      } else if (e.key === 'Home' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (e.key === 'End' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [exportModalState.isOpen, isImportModalOpen, isSupabaseModalOpen, isUserPhotoModalOpen]);

  // Compute live active balance safely
  const activeBalance = React.useMemo(() => {
    if (!Array.isArray(transactions)) return 0;
    return transactions.reduce((acc, curr) => {
      if (!curr) return acc;
      const amt = typeof curr.amount === 'number' ? curr.amount : (Number(curr.amount) || 0);
      return curr.type === 'Masuk' ? acc + amt : acc - amt;
    }, 0);
  }, [transactions]);

  // Helper to generate sequential ID (e.g. TRX-013)
  const generateNextId = useCallback((): string => {
    if (!Array.isArray(transactions)) return 'TRX-013';
    const maxNumber = transactions.reduce((max, t) => {
      if (!t || !t.id) return max;
      const match = t.id.match(/TRX-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 12);
    return `TRX-${String(maxNumber + 1).padStart(3, '0')}`;
  }, [transactions]);

  // 2. INSERT Data: saat formulir input kas disubmit
  const handleAddTransaction = async (
    newTxData: Omit<Transaction, 'id' | 'createdAt' | 'status'>
  ) => {
    const nextId = generateNextId();

    const optimisticTx: Transaction = {
      ...newTxData,
      id: nextId,
      status: 'Syncing',
      createdAt: Date.now(),
    };

    // Optimistic UI update
    setTransactions((prev) => [optimisticTx, ...prev]);

    if (connectionStatus === 'connected') {
      const { data, error } = await insertKasToSupabase({
        id: nextId,
        date: newTxData.date,
        type: newTxData.type,
        category: newTxData.category,
        amount: newTxData.amount,
        description: newTxData.description,
      });

      if (error) {
        // Mark as error
        setTransactions((prev) =>
          prev.map((t) => (t.id === nextId ? { ...t, status: 'Error' } : t))
        );
        showToast(
          `Gagal menyimpan ke Supabase: ${error}`,
          'error',
          'Gagal Insert Supabase'
        );
        return;
      }

      if (data) {
        setTransactions((prev) =>
          prev.map((t) => (t.id === nextId ? { ...data, status: 'Synced' } : t))
        );
        showToast(
          `Transaksi ${data.category} (${formatSimpleRupiah(data.amount)}) berhasil disimpan ke tabel kas_rt Supabase!`,
          'success',
          'Data Tersimpan di Supabase'
        );
      }
    } else {
      // Local storage cache until Supabase credentials activated
      setTimeout(() => {
        setTransactions((prev) =>
          prev.map((t) => (t.id === nextId ? { ...t, status: 'Synced' } : t))
        );
      }, 600);

      showToast(
        `Transaksi ${optimisticTx.category} (${formatSimpleRupiah(optimisticTx.amount)}) tersimpan di penyimpanan lokal. Silakan aktifkan Supabase untuk sinkronisasi live.`,
        'success',
        'Tersimpan di Penyimpanan Lokal'
      );
    }
  };

  // 3. UPDATE Data: saat modal/popup edit disimpan
  const handleUpdateTransaction = async (updatedTx: Transaction) => {
    // Optimistic UI update
    setTransactions((prev) =>
      prev.map((t) => (t.id === updatedTx.id ? { ...updatedTx, status: 'Syncing' } : t))
    );

    if (connectionStatus === 'connected') {
      const { data, error } = await updateKasInSupabase(updatedTx);

      if (error) {
        showToast(`Gagal update di Supabase: ${error}`, 'error', 'Gagal Update');
        // Revert status
        setTransactions((prev) =>
          prev.map((t) => (t.id === updatedTx.id ? { ...t, status: 'Error' } : t))
        );
        return;
      }

      if (data) {
        setTransactions((prev) =>
          prev.map((t) => (t.id === updatedTx.id ? { ...data, status: 'Synced' } : t))
        );
        showToast(
          `Transaksi ${updatedTx.id} berhasil diperbarui di tabel kas_rt Supabase!`,
          'success',
          'Perubahan Tersimpan'
        );
        loadTransactions(false);
      }
    } else {
      // Local storage
      setTransactions((prev) =>
        prev.map((t) => (t.id === updatedTx.id ? { ...updatedTx, status: 'Synced' } : t))
      );
      showToast(
        `Data transaksi ${updatedTx.id} berhasil diperbarui di penyimpanan lokal.`,
        'success',
        'Perubahan Tersimpan'
      );
    }
  };

  // 4. DELETE Data: saat tombol hapus diklik
  const handleDeleteTransaction = async (id: string) => {
    if (connectionStatus === 'connected') {
      const { success, error } = await deleteKasFromSupabase(id);

      if (!success || error) {
        showToast(
          `Gagal menghapus dari Supabase: ${error}`,
          'error',
          'Gagal Hapus'
        );
        return;
      }

      setTransactions((prev) => prev.filter((t) => t.id !== id));
      showToast(
        `Catatan transaksi ${id} telah dihapus permanen dari Supabase.`,
        'success',
        'Data Dihapus'
      );
      loadTransactions(false);
    } else {
      // Local storage
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      showToast(`Catatan ${id} telah dihapus dari basis data lokal.`, 'success', 'Data Dihapus');
    }
  };

  // Optional: Seed initial demo data into Supabase
  const handleSeedSupabase = async () => {
    if (connectionStatus !== 'connected') {
      showToast(
        'Hubungkan ke Supabase terlebih dahulu sebelum memuat data awal.',
        'info'
      );
      setIsSupabaseModalOpen(true);
      return;
    }

    const res = await seedInitialTransactionsToSupabase(INITIAL_TRANSACTIONS);
    if (res.success) {
      showToast(
        `${res.count} data transaksi awal berhasil dimasukkan ke tabel kas_rt Supabase!`,
        'success',
        'Inisialisasi Berhasil'
      );
      loadTransactions(false);
    } else {
      showToast(`Gagal mengisi data awal: ${res.error}`, 'error');
    }
  };

  // Import Data dari File Excel (.xlsx / .xls / .csv)
  const handleImportTransactions = async (
    importedTxs: Transaction[],
    mode: 'append' | 'replace'
  ) => {
    if (connectionStatus === 'connected') {
      if (mode === 'replace') {
        // Hapus data lama di Supabase jika memilih mode replace
        for (const t of transactions) {
          await deleteKasFromSupabase(t.id);
        }
      }

      const res = await insertMultipleKasToSupabase(importedTxs);
      if (!res.success) {
        showToast(
          `Gagal menyimpan ke Supabase: ${res.error}`,
          'error',
          'Gagal Import'
        );
        return;
      }

      showToast(
        `Berhasil mengimpor ${res.insertedCount} transaksi ke tabel kas_rt Supabase!`,
        'success',
        'Import Berhasil'
      );
      await loadTransactions(false);
    } else {
      // Penyimpanan lokal
      if (mode === 'replace') {
        setTransactions(importedTxs);
        localStorage.setItem('kas_rt_transactions', JSON.stringify(importedTxs));
      } else {
        const merged = [...importedTxs, ...transactions];
        setTransactions(merged);
        localStorage.setItem('kas_rt_transactions', JSON.stringify(merged));
      }

      showToast(
        `Berhasil mengimpor ${importedTxs.length} transaksi dari file Excel ke buku kas!`,
        'success',
        'Import Berhasil'
      );
    }
  };

  // Category Handlers (Tabel: kategori di Supabase)
  const handleAddCategory = async (newCat: Omit<CategoryItem, 'id'>): Promise<boolean> => {
    if (connectionStatus === 'connected') {
      const res = await createCategoryInSupabase(newCat);
      if (res.error || !res.data) {
        if (res.tableNotCreated) {
          // Tabel kategori belum dibuat di database Supabase pengurus
          // Simpan secara lokal agar operasional kas tetap berjalan lancar tanpa macet
          const item: CategoryItem = {
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cat-${Date.now()}`,
            ...newCat,
          };
          setCategories((prev) => {
            const updated = [...prev, item];
            localStorage.setItem('kas_rt_categories', JSON.stringify(updated));
            return updated;
          });
          showToast(
            `Kategori "${newCat.name}" tersimpan di penyimpanan lokal. Catatan: Tabel 'kategori' belum dibuat di Supabase (silakan salin skema SQL di menu Kelola Kategori).`,
            'info',
            'Tersimpan Lokal'
          );
          return true;
        }

        showToast(res.error || 'Gagal menambahkan kategori', 'error', 'Gagal Simpan');
        return false;
      }

      showToast(
        `Kategori "${newCat.name}" (${newCat.type === 'Masuk' ? 'Kas Masuk' : 'Kas Keluar'}) berhasil disimpan ke tabel kategori Supabase.`,
        'success',
        'Kategori Ditambahkan'
      );
      await loadCategories(false);
      return true;
    } else {
      const item: CategoryItem = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cat-${Date.now()}`,
        ...newCat,
      };
      setCategories((prev) => {
        const updated = [...prev, item];
        localStorage.setItem('kas_rt_categories', JSON.stringify(updated));
        return updated;
      });
      showToast(`Kategori "${newCat.name}" berhasil ditambahkan secara lokal.`, 'success', 'Kategori Ditambahkan');
      return true;
    }
  };

  const handleUpdateCategory = async (cat: CategoryItem, oldName?: string): Promise<boolean> => {
    if (connectionStatus === 'connected') {
      const res = await updateCategoryInSupabase(cat, oldName);
      if (res.error || !res.data) {
        showToast(res.error || 'Gagal memperbarui kategori', 'error', 'Gagal Update');
        return false;
      }
      showToast(
        `Kategori "${cat.name}" berhasil diperbarui di database Supabase!`,
        'success',
        'Kategori Diperbarui'
      );
      await loadCategories(false);
      if (oldName && oldName !== cat.name) {
        await loadTransactions(false);
      }
      return true;
    } else {
      setCategories((prev) => {
        const updated = prev.map((c) => (c.id === cat.id ? cat : c));
        localStorage.setItem('kas_rt_categories', JSON.stringify(updated));
        return updated;
      });
      if (oldName && oldName !== cat.name) {
        setTransactions((prev) =>
          prev.map((t) => (t.category === oldName ? { ...t, category: cat.name } : t))
        );
      }
      showToast(`Kategori "${cat.name}" berhasil diperbarui.`, 'success', 'Kategori Diperbarui');
      return true;
    }
  };

  const handleDeleteCategory = async (
    id: string,
    name: string,
    type: TransactionType
  ): Promise<boolean> => {
    // 1. Verifikasi lokal terhadap riwayat transaksi
    const matchingTxCount = transactions.filter(
      (t) => t.category.trim().toLowerCase() === name.trim().toLowerCase() && t.type === type
    ).length;

    if (matchingTxCount > 0) {
      showToast(
        `Kategori "${name}" (Kas ${type}) tidak dapat dihapus karena sedang digunakan oleh ${matchingTxCount} transaksi kas_rt.`,
        'error',
        'Penghapusan Ditolak'
      );
      return false;
    }

    // 2. Verifikasi & eksekusi database Supabase
    if (connectionStatus === 'connected') {
      const res = await deleteCategoryFromSupabase(id, name, type);
      if (!res.success) {
        showToast(res.error || 'Gagal menghapus kategori', 'error', 'Penghapusan Ditolak');
        return false;
      }
      showToast(
        `Kategori "${name}" (Kas ${type}) berhasil dihapus dari tabel kategori Supabase.`,
        'success',
        'Kategori Dihapus'
      );
      await loadCategories(false);
      return true;
    } else {
      setCategories((prev) => {
        const updated = prev.filter((c) => c.id !== id);
        localStorage.setItem('kas_rt_categories', JSON.stringify(updated));
        return updated;
      });
      showToast(`Kategori "${name}" berhasil dihapus.`, 'success', 'Kategori Dihapus');
      return true;
    }
  };

  const handleSeedDefaultCategories = async () => {
    if (connectionStatus === 'connected') {
      const res = await seedInitialCategoriesToSupabase(INITIAL_CATEGORIES);
      if (!res.success) {
        showToast(res.error || 'Gagal memuat kategori default', 'error', 'Gagal Inisialisasi');
        return;
      }
      showToast(
        `${res.count} kategori default berhasil dimuat ke tabel kategori Supabase!`,
        'success',
        'Inisialisasi Kategori'
      );
      await loadCategories(false);
    } else {
      setCategories(INITIAL_CATEGORIES);
      localStorage.setItem('kas_rt_categories', JSON.stringify(INITIAL_CATEGORIES));
      showToast('Kategori default berhasil dimuat kembali.', 'success', 'Reset Kategori');
    }
  };

  // Tampilkan loader halus saat memeriksa sesi login pengurus atau profil wilayah
  if (isCheckingSession || isSekretariatLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-900/20 mb-4 animate-bounce">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        </div>
        <p className="text-sm font-bold text-slate-800">Pengelolaan Kas RT Digital</p>
        <p className="text-xs text-slate-500 mt-1">
          {isCheckingSession ? 'Memeriksa sesi pengurus...' : 'Memuat konfigurasi wilayah...'}
        </p>
      </div>
    );
  }

  // Jika data sekretariat masih kosong di database, tampilkan layar inisialisasi wajib 2-Langkah
  if (isDbEmpty) {
    return (
      <>
        <SekretariatSetupScreen
          onInitialize={async (payload) => {
            const res = await initializeSystemWithCorePengurus(payload);
            if (res.success && res.user) {
              await reloadSekretariat();
              handleLoginSuccess(res.user);
              showToast(
                `Wilayah RT.${payload.sekretariat.rt} RW.${payload.sekretariat.rw} & Akun ${res.user.nama} (${res.user.role}) berhasil diaktifkan!`,
                'success',
                'Inisialisasi Berhasil'
              );
              return { success: true, error: null, user: res.user };
            } else {
              showToast(res.error || 'Gagal menginisialisasi sistem', 'error', 'Error');
              return { success: false, error: res.error || 'Gagal menyimpan data' };
            }
          }}
          isLoading={isSekretariatLoading}
          error={sekretariatError}
        />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  // Jika user memilih keluar/menutup sistem, tampilkan layar AppExitScreen (Halaman Login hilang)
  if (isAppClosed) {
    return (
      <>
        <AppExitScreen
          onReopenApp={() => {
            setIsAppClosed(false);
          }}
        />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  // Jika dalam mode pratinjau halaman login atau belum login, tampilkan layar Gerbang Autentikasi
  if (!activeUser || isPreviewingLogin) {
    return (
      <>
        <AuthScreen
          onLoginSuccess={(user) => {
            setIsPreviewingLogin(false);
            setIsAppClosed(false);
            handleLoginSuccess(user);
          }}
          connectionStatus={connectionStatus}
          onOpenSupabaseConfig={() => setIsSupabaseModalOpen(true)}
          isPreviewMode={isPreviewingLogin}
          onExitPreview={() => {
            if (isPreviewingLogin) {
              setIsPreviewingLogin(false);
            } else {
              handleLogout();
            }
          }}
          onExitApp={() => {
            // Langsung keluar sistem dan hilangkan form login
            setIsAppClosed(true);
            try {
              window.open('', '_self', '');
              window.close();
            } catch (e) {
              console.warn(e);
            }
          }}
        />
        {/* Supabase Configuration Modal juga bisa diakses dari AuthScreen */}
        <SupabaseModal
          isOpen={isSupabaseModalOpen}
          onClose={() => setIsSupabaseModalOpen(false)}
          connectionStatus={connectionStatus}
          onRefreshData={() => loadTransactions(true)}
          onTriggerToast={showToast}
        />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Responsive Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        connectionStatus={connectionStatus}
        theme={theme}
        activeUser={activeUser}
        onLogout={handleLogout}
        onOpenPhotoModal={() => setIsUserPhotoModalOpen(true)}
        onTriggerSos={() => setIsTriggerSosModalOpen(true)}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="lg:pl-72 flex flex-col min-h-screen print:pl-0">
        {/* Top Header */}
        <Header
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          connectionStatus={connectionStatus}
          theme={theme}
          onSelectTheme={handleSelectTheme}
          activeUser={activeUser}
          onLogout={handleLogout}
          onPreviewLogin={() => setIsPreviewingLogin(true)}
          onOpenPhotoModal={() => setIsUserPhotoModalOpen(true)}
          onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        />

        {/* View Main Container */}
        <main 
          id="main-content-scroll" 
          tabIndex={-1} 
          className="flex-1 pt-16 sm:pt-18 lg:pt-18 px-3.5 sm:px-6 lg:px-7 pb-10 max-w-7xl w-full mx-auto space-y-4 sm:space-y-5 lg:space-y-6 print:pt-0 print:px-0 print:pb-0 print:max-w-none outline-none"
        >
          {/* Connected banner */}
          {connectionStatus === 'connected' && transactions.length > 0 && (
            <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl px-3.5 sm:px-4.5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-xs print:hidden">
              <div className="flex items-center gap-2 text-emerald-900 truncate">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-bold text-emerald-950 shrink-0">Supabase Live:</span>
                <span className="text-emerald-800 text-[11.5px] truncate">
                  Terhubung ke{' '}
                  <code className="font-mono font-bold bg-white/80 px-1.5 py-0.5 rounded border border-emerald-200 text-emerald-950">
                    kas_rt
                  </code>{' '}
                  ({transactions.length} transaksi online).
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => loadTransactions(true)}
                  disabled={isFetchingSupabase}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-emerald-100/60 border border-emerald-300 text-emerald-800 font-semibold rounded-lg text-xs transition-all cursor-pointer shadow-2xs"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-emerald-600 ${
                      isFetchingSupabase ? 'animate-spin' : ''
                    }`}
                  />
                  <span>Segarkan Data</span>
                </button>
              </div>
            </div>
          )}



          {/* Active Tab Views (Enforce RBAC: Non-admin users are strictly restricted to 'laporan-keuangan') */}
          {(activeTab === 'input-riwayat-transaksi' || activeTab === 'data-warga') && activeUser?.levelAkses === 'Admin' && (
            <InputRiwayatView
              transactions={transactions}
              categories={categories}
              onAddTransaction={handleAddTransaction}
              activeBalance={activeBalance}
              onRefresh={() => loadTransactions(true)}
              isRefreshing={isFetchingSupabase}
              onOpenExport={handleOpenExport}
              onOpenImport={handleOpenImport}
              connectionStatus={connectionStatus}
              onTriggerToast={showToast}
              onTriggerSos={() => setIsTriggerSosModalOpen(true)}
            />
          )}

          {activeTab === 'koreksi-hapus' && activeUser?.levelAkses === 'Admin' && (
            <KoreksiHapusView
              transactions={transactions}
              categories={categories}
              onUpdateTransaction={handleUpdateTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onExport={handleOpenExport}
              onOpenImport={handleOpenImport}
              onRefresh={() => loadTransactions(false)}
              isRefreshing={isFetchingSupabase}
            />
          )}

          {(activeTab === 'laporan-keuangan' || activeUser?.levelAkses === 'User') && (
            <LaporanKeuanganView
              transactions={transactions}
              categories={categories}
              connectionStatus={connectionStatus}
              onTriggerToast={showToast}
              onRefresh={() => loadTransactions(false)}
              isRefreshing={isFetchingSupabase}
              onOpenExport={handleOpenExport}
              onOpenImport={activeUser?.levelAkses === 'Admin' ? handleOpenImport : undefined}
              onNavigateToKelolaData={activeUser?.levelAkses === 'Admin' ? () => setActiveTab('kelola-data') : undefined}
              activeUser={activeUser}
            />
          )}

          {activeTab === 'kelola-kategori' && activeUser?.levelAkses === 'Admin' && (
            <KelolaKategoriView
              categories={categories}
              transactions={transactions}
              onAddCategory={handleAddCategory}
              onUpdateCategory={handleUpdateCategory}
              onDeleteCategory={handleDeleteCategory}
              onRefresh={() => loadCategories(true)}
              isRefreshing={isFetchingCategories}
              isConnectedToSupabase={connectionStatus === 'connected'}
              connectionStatus={connectionStatus}
              onTriggerToast={showToast}
              onSeedDefaultCategories={handleSeedDefaultCategories}
            />
          )}

          {activeTab === 'kelola-data' && activeUser?.levelAkses === 'Admin' && (
            <KelolaDataView
              transactions={transactions}
              categories={categories}
              connectionStatus={connectionStatus}
              onRefresh={() => loadTransactions(false)}
              isRefreshing={isFetchingSupabase}
              onOpenImport={handleOpenImport}
              onTriggerToast={showToast}
              onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
            />
          )}

          {activeTab === 'siaran-pengumuman' && activeUser?.levelAkses === 'Admin' && (
            <SiaranWargaView
              onTriggerToast={showToast}
              activeBalance={activeBalance}
            />
          )}

          {activeTab === 'inventaris-rt' && activeUser?.levelAkses === 'Admin' && (
            <InventarisRTView
              connectionStatus={connectionStatus}
              onTriggerToast={showToast}
            />
          )}
        </main>
      </div>

      {/* Floating Notifications */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Export Dialog */}
      <ExportModal
        isOpen={exportModalState.isOpen}
        onClose={handleCloseExport}
        transactions={transactions}
        filteredTransactions={exportModalState.filteredTransactions}
        filterLabel={exportModalState.filterLabel}
        onTriggerToast={showToast}
      />

      {/* Import Excel Dialog */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={handleCloseImport}
        onImport={handleImportTransactions}
        onTriggerToast={showToast}
        existingCount={transactions.length}
      />

      {/* Supabase Configuration & Status Modal */}
      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        connectionStatus={connectionStatus}
        onRefreshData={async () => {
          await reloadSekretariat();
          loadTransactions(true);
          loadCategories(true);
        }}
        onTriggerToast={showToast}
      />

      {/* User Photo & Avatar Customization Modal */}
      <UserPhotoModal
        isOpen={isUserPhotoModalOpen}
        onClose={() => setIsUserPhotoModalOpen(false)}
        user={activeUser}
        onSaveUser={handleSaveUserPhoto}
      />

      {/* Real-time Emergency SOS Siren Overlay */}
      <DaruratSirenModal
        alerts={activeEmergencies}
        onDismissSiren={handleDismissSirenAudio}
        onResolveAlert={handleResolveEmergencyAlert}
        onConfirmComing={handleConfirmComing}
        isAudioPlaying={isAudioSirenPlaying}
      />

      {/* SOS Panic Trigger Modal */}
      <DaruratTriggerModal
        isOpen={isTriggerSosModalOpen}
        onClose={() => setIsTriggerSosModalOpen(false)}
        activeUser={activeUser}
        onTriggerAlert={handleTriggerEmergencyAlert}
      />

      {/* Non-intrusive Offline Connectivity Indicator Banner */}
      <OfflineIndicator />
    </div>
  );
}
