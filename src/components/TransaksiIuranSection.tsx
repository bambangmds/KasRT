import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  Loader2, 
  Phone, 
  Receipt, 
  Coins, 
  Calendar, 
  CreditCard, 
  Check, 
  Info, 
  CheckCircle, 
  XCircle, 
  X,
  Sparkles
} from 'lucide-react';
import { getSupabase, insertKasToSupabase } from '../lib/supabase';
import { SupabaseConnectionStatus, CategoryItem, Transaction } from '../types';
import { formatSimpleRupiah, formatDateIndo } from '../data/initialData';
import { useSekretariat } from '../context/SekretariatContext';
import { findMatchingIuranTx } from '../lib/iuranMatching';

interface TransaksiIuranSectionProps {
  transactions?: Transaction[];
  connectionStatus?: SupabaseConnectionStatus;
  onTriggerToast: (msg: string, type?: 'success' | 'error' | 'info', title?: string) => void;
  onRefreshTransactions?: () => void;
  categories?: CategoryItem[];
  refreshTrigger?: number;
  onLoadingChange?: (loading: boolean) => void;
}

const BULAN_LIST = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const TAHUN_LIST = ['2024', '2025', '2026', '2027', '2028'];

const CATEGORIES_IURAN = [
  'Iuran Warga',
  'Kebersihan',
  'Iuran Wajib',
  'Iuran Perbaikan Jalan',
  'Bantuan Pembangunan Masjid',
  'Biaya keRTan',
  'Sosial',
  'Lainnya'
];

const getStoredDefaultAmount = (category: string): number => {
  const stored = localStorage.getItem(`kas_rt_default_amount_${category}`);
  return stored ? parseInt(stored, 10) : 25000;
};

const setStoredDefaultAmount = (category: string, amount: number) => {
  localStorage.setItem(`kas_rt_default_amount_${category}`, amount.toString());
};

export const TransaksiIuranSection: React.FC<TransaksiIuranSectionProps> = ({ 
  transactions = [],
  connectionStatus = 'connected', 
  onTriggerToast,
  onRefreshTransactions,
  categories = [],
  refreshTrigger = 0,
  onLoadingChange
}) => {
  const { wilayahShort } = useSekretariat();

  // Helper to format Indonesian phone numbers for WhatsApp API
  const formatPhoneForWa = (phone?: string): string => {
    if (!phone) return '';
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    }
    return clean;
  };

  // Helper to get citizen phone number
  const getCitizenPhone = (wId?: string, description?: string): string => {
    if (wId) {
      const match = dataWarga.find(w => w.id === wId);
      if (match?.no_hp) return match.no_hp;
    }
    if (description) {
      const lowerDesc = description.toLowerCase();
      const match = dataWarga.find(w => {
        if (!w.nama_lengkap) return false;
        const cleanName = w.nama_lengkap.toLowerCase()
          .replace(/^(bpk\.?|bapak\.?|ibu\.?|ibuk\.?|pak\.?|h\.?|hj\.?|sdr\.?|sdri\.?)\s+/i, '')
          .trim();
        return cleanName.length >= 3 && lowerDesc.includes(cleanName);
      });
      if (match?.no_hp) return match.no_hp;
    }
    return '';
  };

  // Helper to generate the WhatsApp receipt message Link
  const handleGetWaReceiptLink = (t: any) => {
    const phone = getCitizenPhone(t.warga_id, t.keterangan);
    if (!phone) return '';
    
    let citizenName = 'Warga';
    if (t.warga_id) {
      const w = dataWarga.find(item => item.id === t.warga_id);
      if (w?.nama_lengkap) citizenName = w.nama_lengkap;
    } else {
      const parts = (t.keterangan || '').split(' - ');
      if (parts.length > 1) {
        citizenName = parts[parts.length - 1];
      }
    }
    
    const formattedPhone = formatPhoneForWa(phone);
    const message = `Bukti Penerimaan Pembayaran Kas Resmi\n*RT.002 RW.09, Kelurahan Pondok Rajeg*\n\n` +
      `Telah diterima setoran iuran warga dengan rincian berikut:\n` +
      `• *Nama Penyetor*: ${citizenName}\n` +
      `• *Pos Kategori*: ${t.kategori}\n` +
      `• *Keterangan*: ${t.keterangan}\n` +
      `• *Tanggal Setor*: ${formatDateIndo(t.tanggal)}\n` +
      `• *Jumlah Nominal*: ${formatSimpleRupiah(t.jumlah)}\n` +
      `• *Status*: Lunas (Tercatat di Database RT)\n\n` +
      `Terima kasih atas partisipasi aktif Anda dalam membangun lingkungan yang asri, aman, dan kondusif.\n\n` +
      `*Salam hangat,*\n` +
      `*Bendahara RT.002 RW.09*`;
      
    return `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`;
  };

  // Get dynamic categories from Supabase
  const availableCategories = useMemo(() => {
    const list = categories
      .filter(c => c.type === 'Masuk' && (c.wajib === true || String(c.wajib) === 'Y' || String(c.wajib) === 'Yes' || String(c.wajib).toLowerCase() === 'true'))
      .map(c => c.name);
    if (list.length > 0) return list;
    return categories.filter(c => c.type === 'Masuk').map(c => c.name);
  }, [categories]);

  // Common Citizen State
  const [dataWarga, setDataWarga] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Transaksi Iuran Form State
  const [paymentMode, setPaymentMode] = useState<'serempak' | 'tunggal'>('serempak');
  const [selectedWargaIds, setSelectedWargaIds] = useState<string[]>([]);
  const [selectedWargaId, setSelectedWargaId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Iuran Warga');
  const [paymentAmount, setPaymentAmount] = useState<number>(() => getStoredDefaultAmount('Iuran Warga'));

  // Pastikan selectedCategory selalu sinkron jika availableCategories berubah
  useEffect(() => {
    if (availableCategories.length > 0 && !availableCategories.includes(selectedCategory)) {
      setSelectedCategory(availableCategories[0]);
    }
  }, [availableCategories, selectedCategory]);

  // Sinkronisasi paymentAmount dengan nominal kategori dari database jika ada
  useEffect(() => {
    if (selectedCategory) {
      const matchedCat = categories.find(c => c.name === selectedCategory && c.type === 'Masuk');
      if (matchedCat && matchedCat.nominal !== undefined && matchedCat.nominal > 0) {
        setPaymentAmount(matchedCat.nominal);
      } else {
        setPaymentAmount(getStoredDefaultAmount(selectedCategory));
      }
    }
  }, [selectedCategory, categories]);

  // Helper untuk mendapatkan tanggal ISO (YYYY-MM-DD) yang sesuai dengan bulan & tahun tagihan
  const getIsoDateForPeriod = (monthName: string, yearStr: string, baseDateStr?: string): string => {
    const monthIdx = BULAN_LIST.indexOf(monthName);
    const mm = monthIdx >= 0 ? String(monthIdx + 1).padStart(2, '0') : '01';
    const yyyy = yearStr || String(new Date().getFullYear());
    let day = '10';
    if (baseDateStr && baseDateStr.includes('-')) {
      const parts = baseDateStr.split('-');
      if (parts.length === 3 && parts[2]) {
        const dNum = parseInt(parts[2], 10);
        if (!isNaN(dNum) && dNum >= 1 && dNum <= 28) {
          day = String(dNum).padStart(2, '0');
        }
      }
    }
    return `${yyyy}-${mm}-${day}`;
  };

  const [paymentMonth, setPaymentMonth] = useState<string>(() => BULAN_LIST[new Date().getMonth()]);
  const [paymentYear, setPaymentYear] = useState<string>(() => String(new Date().getFullYear()));
  const [paymentDate, setPaymentDate] = useState<string>(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${today.getFullYear()}-${mm}-${dd}`;
  });
  const [paymentDescription, setPaymentDescription] = useState<string>('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [searchWargaTerm, setSearchWargaTerm] = useState('');
  const [onlyUnpaidSerempak, setOnlyUnpaidSerempak] = useState(false);

  // Transaksi Iuran History State
  const [iuranHistory, setIuranHistory] = useState<any[]>([]);
  const [allSupabaseMasuk, setAllSupabaseMasuk] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [searchHistoryTerm, setSearchHistoryTerm] = useState('');
  const [selectedHistoryCategory, setSelectedHistoryCategory] = useState<string>('Semua');

  // Gabungan seluruh transaksi Kas Masuk (Supabase + props transactions) agar 100% sinkron dengan Laporan Kepatuhan Iuran
  const allKasMasuk = useMemo(() => {
    const list: any[] = [];
    const seenIds = new Set<string>();

    if (Array.isArray(allSupabaseMasuk)) {
      allSupabaseMasuk.forEach((t) => {
        if (t && t.id) {
          seenIds.add(String(t.id));
          list.push(t);
        }
      });
    }

    if (Array.isArray(transactions)) {
      transactions.forEach((t) => {
        if (t && t.type === 'Masuk' && !seenIds.has(String(t.id))) {
          seenIds.add(String(t.id));
          list.push({
            id: t.id,
            tanggal: t.date,
            jenis: t.type,
            kategori: t.category,
            jumlah: t.amount,
            keterangan: t.description,
            warga_id: t.wargaId,
          });
        }
      });
    }

    return list;
  }, [allSupabaseMasuk, transactions]);

  // Handler pergantian bulan tagihan
  const handlePaymentMonthChange = (newMonth: string) => {
    setPaymentMonth(newMonth);
    setPaymentDate(prev => getIsoDateForPeriod(newMonth, paymentYear, prev));
  };

  // Handler pergantian tahun tagihan
  const handlePaymentYearChange = (newYear: string) => {
    setPaymentYear(newYear);
    setPaymentDate(prev => getIsoDateForPeriod(paymentMonth, newYear, prev));
  };

  const loadDataWarga = async () => {
    setIsLoading(true);
    const client = getSupabase();
    if (!client) {
      try {
        const saved = localStorage.getItem('kas_rt_data_warga');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setDataWarga(parsed);
        }
      } catch {}
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await client
        .from('data_warga')
        .select('*')
        .order('nama_lengkap', { ascending: true });

      if (error) {
        if (error.code === '42P01') {
          onTriggerToast('Tabel data_warga belum tersedia di Supabase. Silakan jalankan script SQL Anda.', 'warning', 'Tabel Belum Dibuat');
        } else {
          onTriggerToast(error.message, 'error', 'Gagal Memuat Data');
        }
      } else if (data && data.length > 0) {
        setDataWarga(data);
      } else {
        const saved = localStorage.getItem('kas_rt_data_warga');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setDataWarga(parsed);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      onTriggerToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadIuranHistory = async () => {
    setIsHistoryLoading(true);
    const client = getSupabase();
    if (!client) {
      setIsHistoryLoading(false);
      return;
    }
    try {
      const { data, error } = await client
        .from('kas_rt')
        .select('*')
        .eq('jenis', 'Masuk')
        .order('tanggal', { ascending: false });

      if (error) {
        console.error('Error loading iuran history:', error);
      } else if (data) {
        setAllSupabaseMasuk(data);
        const incomeCategoryNames = categories.filter(c => c.type === 'Masuk').map(c => c.name);
        const activeCategoriesFilter = incomeCategoryNames.length > 0 ? incomeCategoryNames : CATEGORIES_IURAN;
        const filtered = data.filter((t: any) => 
          activeCategoriesFilter.includes(t.kategori) ||
          t.keterangan?.toLowerCase().includes('iuran') ||
          t.keterangan?.toLowerCase().includes('kk:') ||
          t.keterangan?.toLowerCase().includes('warga')
        );
        setIuranHistory(filtered);
      }
    } catch (err) {
      console.error('Exception loading iuran history:', err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadDataWarga();
    if (connectionStatus === 'connected') {
      loadIuranHistory();
    }
  }, [connectionStatus, categories, refreshTrigger]);

  useEffect(() => {
    onLoadingChange?.(isLoading || isHistoryLoading);
  }, [isLoading, isHistoryLoading, onLoadingChange]);

  // Update dynamic description automatically
  useEffect(() => {
    const label = selectedCategory;
    const cleanLabel = label.replace(/^iuran\s*/i, '');
    const prefix = cleanLabel ? `${cleanLabel} ` : '';
    
    if (paymentMode === 'tunggal') {
      if (selectedWargaId) {
        const selectedWarga = dataWarga.find(w => w.id === selectedWargaId);
        if (selectedWarga) {
          setPaymentDescription(`${prefix}(${paymentMonth} ${paymentYear}) - ${selectedWarga.nama_lengkap}`);
        }
      } else {
        setPaymentDescription('');
      }
    } else {
      if (selectedWargaIds.length > 0) {
        setPaymentDescription(`${prefix}(${paymentMonth} ${paymentYear}) - Serempak (${selectedWargaIds.length} Warga)`);
      } else {
        setPaymentDescription('');
      }
    }
  }, [selectedWargaId, selectedWargaIds, paymentMode, selectedCategory, paymentMonth, paymentYear, dataWarga]);

  // Helper: Cek apakah warga sudah membayar iuran tertentu di bulan dan tahun yang sama
  // Menggunakan Single Source of Truth yang sama persis dengan Laporan Kepatuhan Iuran
  const checkIfWargaAlreadyPaid = useCallback(
    (warga: any, category: string, month: string, year: string) => {
      return Boolean(findMatchingIuranTx(warga, allKasMasuk, category, month, year));
    },
    [allKasMasuk]
  );

  // Sinkronkan pilihan warga otomatis jika mode filter "Pilih Belum Lunas" aktif dan periode/kategori berubah
  useEffect(() => {
    if (onlyUnpaidSerempak) {
      const unpaidIds = dataWarga
        .filter((w) => !checkIfWargaAlreadyPaid(w, selectedCategory, paymentMonth, paymentYear))
        .map((w) => w.id);
      setSelectedWargaIds(unpaidIds);
    }
  }, [onlyUnpaidSerempak, dataWarga, selectedCategory, paymentMonth, paymentYear, checkIfWargaAlreadyPaid]);

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentAmount <= 0) {
      onTriggerToast('Jumlah pembayaran harus lebih dari Rp 0.', 'error', 'Jumlah Salah');
      return;
    }

    setIsSavingPayment(true);
    
    try {
      if (paymentMode === 'tunggal') {
        if (!selectedWargaId) {
          onTriggerToast('Silakan pilih warga terlebih dahulu.', 'error', 'Warga Belum Terpilih');
          setIsSavingPayment(false);
          return;
        }

        const selectedWarga = dataWarga.find(w => w.id === selectedWargaId);
        if (!selectedWarga) {
          setIsSavingPayment(false);
          return;
        }

        if (checkIfWargaAlreadyPaid(selectedWarga, selectedCategory, paymentMonth, paymentYear)) {
          onTriggerToast(
            `${selectedWarga.nama_lengkap} sudah membayar iuran ${selectedCategory} untuk Bulan ${paymentMonth} ${paymentYear}.`, 
            'error', 
            'Iuran Sudah Lunas'
          );
          setIsSavingPayment(false);
          return;
        }

        const effectiveDate = getIsoDateForPeriod(paymentMonth, paymentYear, paymentDate);
        const nextId = crypto.randomUUID();
        const cleanCatLabel = selectedCategory.replace(/^iuran\s*/i, '');
        const catPrefix = cleanCatLabel ? `${cleanCatLabel} ` : '';
        const fallbackDesc = `${catPrefix}(${paymentMonth} ${paymentYear}) - ${selectedWarga.nama_lengkap}`;
        
        const txPayload = {
          id: nextId,
          date: effectiveDate,
          type: 'Masuk' as const,
          category: selectedCategory,
          amount: paymentAmount,
          description: paymentDescription || fallbackDesc,
          wargaId: selectedWargaId,
        };

        const { error } = await insertKasToSupabase(txPayload);

        // Selalu simpan ke localStorage sebagai pertahanan cadangan agar input warga 100% tersimpan
        try {
          const rawLocal = localStorage.getItem('kas_rt_transactions');
          const currentLocal = rawLocal ? JSON.parse(rawLocal) : [];
          const newTxItem = {
            ...txPayload,
            status: error ? 'Error' : 'Synced',
            createdAt: Date.now(),
          };
          const updatedLocal = [newTxItem, ...currentLocal.filter((t: any) => t.id !== nextId)];
          localStorage.setItem('kas_rt_transactions', JSON.stringify(updatedLocal));
        } catch (e) {
          console.error('Failed fallback write to localStorage', e);
        }

        if (error) {
          onTriggerToast(`Pembayaran iuran tersimpan di penyimpanan perangkat. (Catatan Supabase: ${error})`, 'info', 'Tersimpan di Perangkat');
        } else {
          onTriggerToast(`Pembayaran iuran ${selectedWarga.nama_lengkap} sebesar ${formatSimpleRupiah(paymentAmount)} berhasil dicatat!`, 'success', 'Iuran Berhasil');
        }
        
        setSelectedWargaId('');
        setSearchWargaTerm('');
        loadIuranHistory();
        
        if (onRefreshTransactions) {
          onRefreshTransactions();
        }
      } else {
        // Serempak mode
        if (selectedWargaIds.length === 0) {
          onTriggerToast('Silakan pilih minimal satu warga.', 'error', 'Warga Belum Terpilih');
          setIsSavingPayment(false);
          return;
        }

        const validWargaIds = selectedWargaIds.filter(wId => {
          const warga = dataWarga.find(w => w.id === wId);
          if (!warga) return false;
          return !checkIfWargaAlreadyPaid(warga, selectedCategory, paymentMonth, paymentYear);
        });

        if (validWargaIds.length === 0) {
          onTriggerToast('Seluruh warga yang dipilih sudah lunas untuk periode dan kategori ini.', 'error', 'Iuran Sudah Lunas');
          setIsSavingPayment(false);
          return;
        }

        const skippedCount = selectedWargaIds.length - validWargaIds.length;
        const effectiveDate = getIsoDateForPeriod(paymentMonth, paymentYear, paymentDate);
        const cleanCatLabel = selectedCategory.replace(/^iuran\s*/i, '');
        const catPrefix = cleanCatLabel ? `${cleanCatLabel} ` : '';
        
        const bulkPayloads = validWargaIds.map(wId => {
          const warga = dataWarga.find(w => w.id === wId);
          const customDesc = `${catPrefix}(Bulan ${paymentMonth} ${paymentYear}) - ${warga?.nama_lengkap || 'Warga'}`;
          return {
            id: crypto.randomUUID(),
            date: effectiveDate,
            type: 'Masuk' as const,
            category: selectedCategory,
            amount: paymentAmount,
            description: customDesc,
            wargaId: wId,
          };
        });

        const promises = bulkPayloads.map(p => insertKasToSupabase(p));
        const results = await Promise.all(promises);
        const errors = results.filter(r => r.error).map(r => r.error);

        // Selalu simpan seluruh baris serempak ke localStorage agar tidak hilang
        try {
          const rawLocal = localStorage.getItem('kas_rt_transactions');
          const currentLocal = rawLocal ? JSON.parse(rawLocal) : [];
          const newItems = bulkPayloads.map(p => ({
            ...p,
            status: 'Synced',
            createdAt: Date.now(),
          }));
          const updatedLocal = [...newItems, ...currentLocal];
          localStorage.setItem('kas_rt_transactions', JSON.stringify(updatedLocal));
        } catch (e) {
          console.error('Failed bulk fallback write', e);
        }

        if (errors.length > 0) {
          onTriggerToast(`Pembayaran serempak tersimpan di penyimpanan perangkat. (${errors.length} item memerlukan sync Supabase)`, 'info', 'Tersimpan di Perangkat');
        } else {
          let successMessage = `Pembayaran iuran serempak untuk ${validWargaIds.length} warga sebesar ${formatSimpleRupiah(paymentAmount)}/warga berhasil dicatat!`;
          if (skippedCount > 0) {
            successMessage += ` (${skippedCount} warga dilewati karena sudah lunas)`;
          }
          onTriggerToast(successMessage, 'success', 'Iuran Serempak Berhasil');
        }
        
        setSelectedWargaIds([]);
        setSearchWargaTerm('');
        setOnlyUnpaidSerempak(false);
        loadIuranHistory();
        
        if (onRefreshTransactions) {
          onRefreshTransactions();
        }
      }
    } catch (err: any) {
      onTriggerToast(err.message, 'error', 'Gagal Menambahkan');
    } finally {
      setIsSavingPayment(false);
    }
  };

  // Filter citizens for selection list in "Transaksi Iuran"
  const filteredWargaForSelect = dataWarga.filter(w =>
    w.nama_lengkap?.toLowerCase().includes(searchWargaTerm.toLowerCase()) ||
    w.nik?.includes(searchWargaTerm) ||
    w.no_kk?.includes(searchWargaTerm) ||
    w.alamat_domisili?.toLowerCase().includes(searchWargaTerm.toLowerCase())
  );

  // Daftar warga khusus mode Bayar Serempak (hanya tampilkan belum lunas jika filter aktif)
  const serempakWargaList = useMemo(() => {
    if (!onlyUnpaidSerempak) return filteredWargaForSelect;
    return filteredWargaForSelect.filter(
      (w) => !checkIfWargaAlreadyPaid(w, selectedCategory, paymentMonth, paymentYear)
    );
  }, [
    filteredWargaForSelect,
    onlyUnpaidSerempak,
    checkIfWargaAlreadyPaid,
    selectedCategory,
    paymentMonth,
    paymentYear,
  ]);

  // Unique categories found in iuran history for quick filter tabs
  const historyCategories = useMemo(() => {
    const unique = Array.from(
      new Set(iuranHistory.map((t) => t.kategori).filter(Boolean))
    ) as string[];
    return ['Semua', ...unique];
  }, [iuranHistory]);

  // Filter iuran history
  const filteredHistory = useMemo(() => {
    const term = searchHistoryTerm.toLowerCase().trim();
    return iuranHistory.filter((t) => {
      const matchesCat =
        selectedHistoryCategory === 'Semua' || t.kategori === selectedHistoryCategory;
      const matchesTerm =
        !term ||
        t.keterangan?.toLowerCase().includes(term) ||
        t.kategori?.toLowerCase().includes(term);
      return matchesCat && matchesTerm;
    });
  }, [iuranHistory, searchHistoryTerm, selectedHistoryCategory]);

  // Total nominal iuran tersaring
  const filteredHistoryTotal = useMemo(
    () => filteredHistory.reduce((acc, item) => acc + (Number(item.jumlah) || 0), 0),
    [filteredHistory]
  );

  // Total estimasi setoran yang sedang diinput
  const totalEstimatedPayment = useMemo(() => {
    if (paymentMode === 'serempak') {
      return paymentAmount * selectedWargaIds.length;
    }
    return selectedWargaId ? paymentAmount : 0;
  }, [paymentMode, paymentAmount, selectedWargaIds.length, selectedWargaId]);

  const isSerempak = paymentMode === 'serempak';

  return (
    <div className="space-y-6">
      {/* Main Grid: Form & History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Column 1: Formulir Entri Iuran Warga - Rich Modern Sapphire/Cyan & Warm Amber Adaptive Card */}
        <div
          className={`lg:col-span-5 rounded-2xl shadow-xl overflow-hidden border transition-colors duration-200 flex flex-col ${
            isSerempak
              ? 'bg-gradient-to-br from-indigo-50/95 via-blue-50/75 to-sky-100/70 border-indigo-300/80 shadow-indigo-900/10'
              : 'bg-gradient-to-br from-amber-50/95 via-orange-50/75 to-rose-100/60 border-amber-300/80 shadow-orange-900/10'
          }`}
        >
          {/* Vibrant Modern Colored Card Header */}
          <div
            className={`relative overflow-hidden px-5 sm:px-6 py-3.5 min-h-[72px] flex items-center transition-colors duration-200 ${
              isSerempak
                ? 'bg-gradient-to-r from-indigo-950 via-blue-900 to-cyan-900 text-white'
                : 'bg-gradient-to-r from-stone-950 via-amber-900 to-orange-800 text-white'
            }`}
          >
            <div
              className={`absolute -right-8 -top-8 w-36 h-36 rounded-full blur-2xl pointer-events-none ${
                isSerempak ? 'bg-cyan-400/25' : 'bg-amber-400/25'
              }`}
            />
            <div
              className={`absolute left-1/3 -bottom-10 w-32 h-24 rounded-full blur-2xl pointer-events-none ${
                isSerempak ? 'bg-indigo-400/20' : 'bg-rose-400/20'
              }`}
            />
            <div className="relative w-full flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-md ring-1 ring-white/25 ${
                    isSerempak
                      ? 'bg-gradient-to-br from-sky-400 to-indigo-500 text-white'
                      : 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
                  }`}
                >
                  <CreditCard className="w-4.5 h-4.5" />
                </div>
                <h4 className="font-bold text-white text-sm tracking-tight">
                  Formulir Entri Iuran Warga
                </h4>
              </div>
              <span
                className={`text-[11px] font-bold whitespace-nowrap shrink-0 ${
                  isSerempak ? 'text-cyan-300' : 'text-amber-300'
                }`}
              >
                {isSerempak ? 'Mode Serempak' : 'Mode Tunggal'}
              </span>
            </div>
          </div>

          <form onSubmit={handleSavePayment} className="p-4.5 sm:p-5 space-y-3.5">
            {/* Payment Mode Selection Toggle */}
            <div
              className={`p-1 rounded-xl flex text-xs font-bold border shadow-2xs backdrop-blur-sm ${
                isSerempak
                  ? 'bg-white/85 border-indigo-200/90 text-slate-600'
                  : 'bg-white/85 border-amber-200/90 text-slate-600'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setPaymentMode('serempak');
                  setSelectedWargaId('');
                  setSearchWargaTerm('');
                }}
                className={`flex-1 py-2.5 px-2 rounded-lg text-center transition-all duration-150 cursor-pointer whitespace-nowrap ${
                  isSerempak
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                    : 'text-slate-600 hover:text-indigo-700 hover:bg-indigo-50/80 font-semibold'
                }`}
              >
                1. Bayar Serempak
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentMode('tunggal');
                  setSelectedWargaIds([]);
                  setSearchWargaTerm('');
                }}
                className={`flex-1 py-2.5 px-2 rounded-lg text-center transition-all duration-150 cursor-pointer whitespace-nowrap ${
                  !isSerempak
                    ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-md shadow-orange-500/30 font-bold'
                    : 'text-slate-600 hover:text-orange-700 hover:bg-orange-50/80 font-semibold'
                }`}
              >
                2. Bayar PerOrangan
              </button>
            </div>

            {/* Periode Tagihan, Tanggal Pencatatan & Pos Kategori - Modern Jewel-Toned Panel */}
            <div
              className={`p-3.5 rounded-xl border space-y-3 shadow-sm transition-colors duration-200 ${
                isSerempak
                  ? 'bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 border-indigo-700/70 text-white'
                  : 'bg-gradient-to-br from-stone-900 via-amber-950 to-orange-950 border-amber-700/70 text-white'
              }`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                {/* Bulan Tagihan */}
                <div className="space-y-1 sm:col-span-4">
                  <label className={`block text-[11px] font-semibold tracking-wide ${isSerempak ? 'text-sky-300' : 'text-amber-300'}`}>
                    Bulan Tagihan
                  </label>
                  <select
                    value={paymentMonth}
                    onChange={(e) => handlePaymentMonthChange(e.target.value)}
                    className={`w-full px-2.5 py-2 text-xs bg-white/10 hover:bg-white/15 border text-white rounded-lg outline-none cursor-pointer font-semibold transition-all ${
                      isSerempak
                        ? 'border-indigo-400/35 focus:ring-2 focus:ring-cyan-400/35 focus:border-cyan-400'
                        : 'border-amber-400/35 focus:ring-2 focus:ring-amber-400/35 focus:border-amber-400'
                    }`}
                  >
                    {BULAN_LIST.map((b) => (
                      <option key={b} value={b} className="bg-slate-900 text-white font-medium">{b}</option>
                    ))}
                  </select>
                </div>

                {/* Tahun */}
                <div className="space-y-1 sm:col-span-3">
                  <label className={`block text-[11px] font-semibold tracking-wide ${isSerempak ? 'text-sky-300' : 'text-amber-300'}`}>
                    Tahun
                  </label>
                  <select
                    value={paymentYear}
                    onChange={(e) => handlePaymentYearChange(e.target.value)}
                    className={`w-full px-2.5 py-2 text-xs bg-white/10 hover:bg-white/15 border text-white rounded-lg outline-none cursor-pointer font-semibold tabular-nums transition-all ${
                      isSerempak
                        ? 'border-indigo-400/35 focus:ring-2 focus:ring-cyan-400/35 focus:border-cyan-400'
                        : 'border-amber-400/35 focus:ring-2 focus:ring-amber-400/35 focus:border-amber-400'
                    }`}
                  >
                    {TAHUN_LIST.map((y) => (
                      <option key={y} value={y} className="bg-slate-900 text-white font-medium">{y}</option>
                    ))}
                  </select>
                </div>

                {/* Tanggal Pencatatan */}
                <div className="space-y-1 sm:col-span-5">
                  <label className={`block text-[11px] font-semibold tracking-wide ${isSerempak ? 'text-sky-300' : 'text-amber-300'}`}>
                    Tanggal Pencatatan
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className={`w-full px-2.5 py-2 text-xs bg-white/10 hover:bg-white/15 border text-white rounded-lg outline-none font-semibold tabular-nums transition-all [color-scheme:dark] ${
                      isSerempak
                        ? 'border-indigo-400/35 focus:ring-2 focus:ring-cyan-400/35 focus:border-cyan-400'
                        : 'border-amber-400/35 focus:ring-2 focus:ring-amber-400/35 focus:border-amber-400'
                    }`}
                  />
                </div>
              </div>

              {/* Pos Kategori */}
              <div className="space-y-1">
                <label className={`block text-[11px] font-semibold tracking-wide ${isSerempak ? 'text-sky-300' : 'text-amber-300'}`}>
                  Pos Kategori Iuran
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    const catName = e.target.value;
                    setSelectedCategory(catName);
                    const matchedCat = categories.find((c) => c.name === catName && c.type === 'Masuk');
                    if (matchedCat && matchedCat.nominal !== undefined && matchedCat.nominal > 0) {
                      setPaymentAmount(matchedCat.nominal);
                    } else {
                      setPaymentAmount(getStoredDefaultAmount(catName));
                    }
                  }}
                  className={`w-full px-3 py-2 text-xs rounded-lg outline-none font-bold cursor-pointer border transition-all ${
                    isSerempak
                      ? 'bg-cyan-500/15 hover:bg-cyan-500/20 border-cyan-400/40 text-cyan-100 focus:ring-2 focus:ring-cyan-400/35 focus:border-cyan-300'
                      : 'bg-amber-500/15 hover:bg-amber-500/20 border-amber-400/40 text-amber-100 focus:ring-2 focus:ring-amber-400/35 focus:border-amber-300'
                  }`}
                >
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat} className="bg-slate-900 text-white font-medium">{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Mode 1: Tunggal Selector - Deep Warm Amber-Obsidian Panel */}
            {paymentMode === 'tunggal' && (
              <div className="rounded-xl border border-amber-500/45 bg-gradient-to-br from-stone-950 via-amber-950/90 to-stone-900 overflow-hidden shadow-md">
                <div className="px-3.5 py-2.5 bg-amber-900/50 border-b border-amber-500/30 flex justify-between items-center gap-2">
                  <label className="text-xs font-bold text-amber-100 tracking-wide">
                    Pilih Warga Penyetor <span className="text-rose-400">*</span>
                  </label>
                  {selectedWargaId && (
                    <span className="text-emerald-300 font-bold text-[11px] tracking-wide">
                      1 Warga Terpilih
                    </span>
                  )}
                </div>

                <div className="p-3 space-y-2.5">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-amber-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Ketik untuk mencari nama warga / NIK..."
                      value={searchWargaTerm}
                      onChange={(e) => setSearchWargaTerm(e.target.value)}
                      className="block w-full pl-8 pr-8 py-2 text-xs bg-black/55 border border-amber-400/40 rounded-lg focus:bg-black/75 focus:ring-2 focus:ring-amber-400/30 focus:border-amber-300 text-white placeholder:text-amber-200/55 transition-all outline-none"
                    />
                    {searchWargaTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchWargaTerm('')}
                        className="absolute right-2.5 top-2.5 text-amber-300 hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="max-h-48 overflow-y-auto custom-scrollbar-dark border border-amber-500/30 rounded-xl divide-y divide-amber-900/60 bg-stone-950/90">
                    {isLoading ? (
                      <div className="p-4 text-center text-xs text-amber-200 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> Memuat data warga...
                      </div>
                    ) : filteredWargaForSelect.length > 0 ? (
                      filteredWargaForSelect.map(w => {
                        const isSelected = selectedWargaId === w.id;
                        const isPaid = checkIfWargaAlreadyPaid(w, selectedCategory, paymentMonth, paymentYear);
                        return (
                          <div
                            key={w.id}
                            onClick={() => {
                              setSelectedWargaId(w.id);
                            }}
                            className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-all duration-150 text-xs ${
                              isSelected
                                ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white font-semibold shadow-inner'
                                : isPaid
                                  ? 'bg-emerald-950/75 text-emerald-100 hover:bg-emerald-900/75'
                                  : 'odd:bg-stone-950/90 even:bg-amber-950/45 hover:bg-amber-900/55 text-zinc-100'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <div className="font-bold flex items-center gap-2 tracking-[0.01em]">
                                <span className="truncate">{w.nama_lengkap}</span>
                                {isPaid && (
                                  <span className={`text-[10px] font-bold shrink-0 ${isSelected ? 'text-amber-100' : 'text-emerald-400'}`}>
                                    · Lunas ({paymentMonth})
                                  </span>
                                )}
                              </div>
                              <div className={`text-[10px] font-mono tabular-nums mt-0.5 ${isSelected ? 'text-amber-100' : 'text-amber-200/70'}`}>
                                NIK: {w.nik} · KK: {w.no_kk}
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-xs text-amber-200/70">
                        Warga tidak ditemukan
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Mode 2: Serempak Multi-Selector - Deep Royal Sapphire & Cyan Panel */}
            {paymentMode === 'serempak' && (
              <div className="rounded-xl border border-indigo-500/45 bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-950 overflow-hidden shadow-md">
                <div className="px-3.5 py-2.5 bg-indigo-900/55 border-b border-indigo-500/35 flex items-center justify-between gap-2">
                  <label className="block text-xs font-bold text-white tracking-wide">
                    Pilih Warga{' '}
                    <span className="text-cyan-300 font-extrabold tabular-nums">
                      ({selectedWargaIds.length} Terpilih)
                    </span>{' '}
                    <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const unpaidIds = dataWarga
                          .filter(w => !checkIfWargaAlreadyPaid(w, selectedCategory, paymentMonth, paymentYear))
                          .map(w => w.id);
                        setSelectedWargaIds(unpaidIds);
                        setOnlyUnpaidSerempak(true);
                      }}
                      className={`text-[11px] font-bold cursor-pointer whitespace-nowrap transition-all ${
                        onlyUnpaidSerempak
                          ? 'px-2 py-0.5 rounded-md bg-cyan-400 text-slate-950 shadow-xs'
                          : 'text-cyan-300 hover:text-white hover:underline'
                      }`}
                    >
                      Pilih Belum Lunas
                    </button>
                    <span className="text-indigo-400/60" aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedWargaIds([]);
                        setOnlyUnpaidSerempak(false);
                      }}
                      className="text-[11px] text-rose-300 hover:text-rose-200 hover:underline font-semibold cursor-pointer whitespace-nowrap transition-colors"
                    >
                      Batal Pilih
                    </button>
                  </div>
                </div>

                <div className="p-3 space-y-2.5">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-cyan-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Saring nama warga, alamat, atau NIK..."
                      value={searchWargaTerm}
                      onChange={(e) => setSearchWargaTerm(e.target.value)}
                      className="block w-full pl-8 pr-8 py-2 text-xs bg-black/55 border border-indigo-400/40 rounded-lg focus:bg-black/75 focus:ring-2 focus:ring-cyan-400/30 focus:border-cyan-300 text-white placeholder:text-indigo-200/55 transition-all outline-none"
                    />
                    {searchWargaTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchWargaTerm('')}
                        className="absolute right-2.5 top-2.5 text-indigo-300 hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="max-h-48 overflow-y-auto custom-scrollbar-dark border border-indigo-500/35 rounded-xl divide-y divide-indigo-900/70 bg-slate-950/90">
                    {isLoading ? (
                      <div className="p-4 text-center text-xs text-sky-200 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-cyan-400" /> Memuat data warga...
                      </div>
                    ) : serempakWargaList.length > 0 ? (
                      serempakWargaList.map(w => {
                        const isSelected = selectedWargaIds.includes(w.id);
                        const isPaid = checkIfWargaAlreadyPaid(w, selectedCategory, paymentMonth, paymentYear);
                        return (
                          <div
                            key={w.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedWargaIds(prev => prev.filter(id => id !== w.id));
                              } else {
                                setSelectedWargaIds(prev => [...prev, w.id]);
                              }
                            }}
                            className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-all duration-150 text-xs ${
                              isSelected
                                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 text-white font-semibold shadow-inner'
                                : isPaid
                                  ? 'bg-emerald-950/75 text-emerald-100 hover:bg-emerald-900/75'
                                  : 'odd:bg-slate-950/90 even:bg-indigo-950/55 hover:bg-indigo-900/65 text-zinc-100'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate pr-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="rounded border-cyan-400/60 bg-slate-900 text-cyan-500 focus:ring-cyan-400 cursor-pointer pointer-events-none"
                              />
                              <div className="truncate">
                                <div className="font-bold flex items-center gap-2 tracking-[0.01em]">
                                  <span className="truncate">{w.nama_lengkap}</span>
                                  {isPaid && (
                                    <span className={`text-[10px] font-bold shrink-0 ${isSelected ? 'text-cyan-100' : 'text-emerald-400'}`}>
                                      · Lunas
                                    </span>
                                  )}
                                </div>
                                <div className={`text-[10px] font-mono mt-0.5 truncate ${isSelected ? 'text-sky-100' : 'text-indigo-200/75'}`}>
                                  {w.alamat_domisili || 'Warga'}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-xs text-indigo-200/70">
                        {onlyUnpaidSerempak && !searchWargaTerm
                          ? `Semua warga sudah lunas untuk ${selectedCategory} (${paymentMonth} ${paymentYear})`
                          : 'Warga tidak ditemukan'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Nominal Form - Rich Deep Emerald-Teal & Warm Gold Monetary Card */}
            <div className="p-3.5 bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-950 rounded-xl border border-emerald-500/45 space-y-2.5 shadow-md">
              <label className="block text-xs font-bold text-emerald-200 flex justify-between items-center tracking-wide">
                <span>Nominal Pembayaran per Warga <span className="text-rose-400">*</span></span>
                <span className="font-extrabold text-sm font-mono tabular-nums text-amber-300">
                  {formatSimpleRupiah(paymentAmount)}
                </span>
              </label>

              <div className="relative flex items-center">
                <span className="absolute left-0 top-0 bottom-0 px-3.5 flex items-center text-xs font-black pointer-events-none rounded-l-xl bg-gradient-to-b from-emerald-400 to-teal-500 text-slate-950">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={paymentAmount || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 0;
                    setPaymentAmount(val);
                    setStoredDefaultAmount(selectedCategory, val);
                  }}
                  placeholder="25000"
                  className="w-full pl-12 pr-4 py-2 text-xs sm:text-sm bg-black/60 border border-emerald-400/45 rounded-xl focus:bg-black/80 focus:ring-2 focus:ring-amber-400/30 focus:border-amber-300 transition-all outline-none font-extrabold font-mono tabular-nums text-amber-300 placeholder:text-emerald-400/40"
                />
              </div>

              {/* Quick Nominal Presets */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[11px] text-emerald-200/80 font-semibold">
                  Nominal cepat:
                </span>
                {[10000, 20000, 25000, 50000, 100000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setPaymentAmount(amt);
                      setStoredDefaultAmount(selectedCategory, amt);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono tabular-nums border transition-all duration-150 cursor-pointer whitespace-nowrap ${
                      paymentAmount === amt
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 border-amber-300 shadow-sm'
                        : 'bg-emerald-900/60 text-emerald-100 border-emerald-500/35 hover:border-emerald-300 hover:bg-emerald-800/80 hover:text-white'
                    }`}
                  >
                    {amt / 1000}k
                  </button>
                ))}
              </div>

              {/* Live Estimated Total Strip - Obsidian & Warm Gold matching table Jumlah column */}
              {totalEstimatedPayment > 0 && (
                <div className="mt-1.5 px-3 py-2 rounded-lg bg-black/75 border border-amber-400/40 flex items-center justify-between text-xs shadow-xs">
                  <span className="font-medium text-zinc-200">
                    {isSerempak
                      ? `Total Estimasi (${selectedWargaIds.length} warga × ${formatSimpleRupiah(paymentAmount)})`
                      : 'Total Setoran Tunggal'}
                  </span>
                  <span className="font-extrabold font-mono tabular-nums text-amber-300 text-sm">
                    {formatSimpleRupiah(totalEstimatedPayment)}
                  </span>
                </div>
              )}
            </div>

            {/* Uraian Keterangan Transaksi - Rich Deep Violet/Rose-Slate Panel */}
            <div
              className={`p-3.5 rounded-xl border space-y-2 shadow-md transition-colors duration-200 ${
                isSerempak
                  ? 'bg-gradient-to-br from-slate-900 via-violet-950/90 to-indigo-950 border-violet-500/40'
                  : 'bg-gradient-to-br from-stone-900 via-rose-950/80 to-amber-950 border-rose-500/40'
              }`}
            >
              <label className={`block text-xs font-bold tracking-wide ${isSerempak ? 'text-violet-200' : 'text-rose-200'}`}>
                Uraian / Keterangan Transaksi
              </label>
              <textarea
                value={paymentDescription}
                onChange={(e) => setPaymentDescription(e.target.value)}
                rows={2}
                placeholder="Keterangan transaksi iuran..."
                className={`block w-full p-2.5 text-xs bg-black/55 border rounded-xl transition-all outline-none resize-y min-h-[60px] text-white placeholder:text-slate-400 ${
                  isSerempak
                    ? 'border-violet-400/40 focus:bg-black/75 focus:ring-2 focus:ring-cyan-400/30 focus:border-cyan-300'
                    : 'border-rose-400/40 focus:bg-black/75 focus:ring-2 focus:ring-amber-400/30 focus:border-amber-300'
                }`}
                disabled={connectionStatus !== 'connected'}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={
                isSavingPayment ||
                connectionStatus !== 'connected' ||
                (paymentMode === 'tunggal' ? !selectedWargaId : selectedWargaIds.length === 0)
              }
              className={`w-full py-3 px-4 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg transition-all duration-150 flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ring-1 ring-white/20 ${
                paymentMode === 'tunggal'
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:via-orange-600 hover:to-rose-600 shadow-orange-500/30'
                  : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-700 hover:via-indigo-700 hover:to-cyan-700 shadow-indigo-600/30'
              }`}
            >
              {isSavingPayment ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Merekam Pembayaran...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Catat & Simpan Setoran Iuran ({paymentMode === 'tunggal' ? 'Tunggal' : 'Serempak'})</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Column 2: Riwayat Pembayaran Iuran Terbaru - Modern Emerald / Teal Ledger Card */}
        <div className="lg:col-span-7 bg-gradient-to-b from-white via-white to-emerald-50/25 rounded-2xl shadow-lg shadow-emerald-950/[0.05] border border-emerald-200/80 overflow-hidden flex flex-col min-h-[540px]">
          {/* Rich Modern Emerald-Teal Card Header */}
          <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-950 text-white px-5 sm:px-6 py-3.5 min-h-[72px] flex items-center">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-400/15 rounded-full blur-2xl pointer-events-none" />
            <div className="relative w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/35 text-emerald-300 flex items-center justify-center shrink-0 shadow-sm">
                  <Receipt className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm tracking-tight">
                    Riwayat Pembayaran Iuran Terbaru
                  </h4>
                  <p className="text-[11px] text-emerald-200/85 mt-0.5">
                    Daftar transaksi setoran iuran terdaftar di tabel kas_rt
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs self-end sm:self-auto">
                <div className="text-right">
                  <div className="text-[10px] text-emerald-200/80 font-medium">
                    {filteredHistory.length} Transaksi
                  </div>
                  <div className="font-extrabold text-emerald-300 font-mono tabular-nums text-sm">
                    {formatSimpleRupiah(filteredHistoryTotal)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Rich Emerald-Teal Search & Category Filter Toolbar */}
          <div className="px-5 sm:px-6 py-3.5 bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-950 border-t border-emerald-500/30 space-y-2.5">
            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-emerald-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari riwayat (nama warga, kategori, keterangan)..."
                value={searchHistoryTerm}
                onChange={(e) => setSearchHistoryTerm(e.target.value)}
                className="block w-full pl-10 pr-9 py-2 text-xs bg-gradient-to-r from-slate-900/95 via-emerald-950/90 to-teal-950/95 border border-emerald-400/45 rounded-xl focus:ring-2 focus:ring-amber-400/30 focus:border-amber-300 text-white placeholder:text-emerald-200/65 shadow-inner transition-all outline-none"
              />
              {searchHistoryTerm && (
                <button
                  type="button"
                  onClick={() => setSearchHistoryTerm('')}
                  className="absolute right-3 top-2.5 text-emerald-300 hover:text-white cursor-pointer transition-colors"
                  title="Bersihkan pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {historyCategories.length > 2 && (
              <div className="flex items-center gap-1 p-1 bg-black/45 border border-emerald-500/30 rounded-xl overflow-x-auto custom-scrollbar-dark">
                {historyCategories.map((cat) => {
                  const isActive = selectedHistoryCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedHistoryCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                        isActive
                          ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-bold shadow-sm'
                          : 'text-emerald-200/85 hover:text-white hover:bg-emerald-900/60'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* History Table - Modern Obsidian Black Theme */}
          <div className="flex-1 overflow-x-auto max-h-[460px] bg-neutral-950 custom-scrollbar-dark border-t border-zinc-800">
            {isHistoryLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-zinc-400">
                <RefreshCw className="w-6 h-6 animate-spin mb-3 text-emerald-400" />
                <p className="text-xs font-medium tracking-wide text-zinc-300">Memuat riwayat iuran...</p>
              </div>
            ) : filteredHistory.length > 0 ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-black text-zinc-300 font-semibold border-b border-zinc-800 text-[11px] tracking-wide">
                    <th className="py-2.5 px-3 whitespace-nowrap">Tanggal</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Kategori</th>
                    <th className="py-2.5 px-3">Uraian / Keterangan</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap bg-amber-500/15 text-amber-300 border-x border-amber-400/20">
                      Jumlah (Rp)
                    </th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Kwitansi WA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {filteredHistory.map((t) => (
                    <tr
                      key={t.id}
                      className="group odd:bg-neutral-950 even:bg-zinc-900/75 hover:bg-zinc-800/85 transition-colors duration-150"
                    >
                      <td className="py-1.5 px-3 text-zinc-300 font-mono tabular-nums text-[11px] whitespace-nowrap tracking-wide">
                        {formatDateIndo(t.tanggal)}
                      </td>
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <span className="text-[11px] font-semibold text-emerald-400 tracking-wide">
                          {t.kategori}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-zinc-100 font-medium tracking-[0.01em] truncate max-w-[210px]" title={t.keterangan}>
                        {t.keterangan}
                      </td>
                      <td className="py-1.5 px-3 text-right font-bold font-mono tabular-nums text-amber-300 bg-amber-500/[0.08] group-hover:bg-amber-500/15 border-x border-amber-400/15 whitespace-nowrap transition-colors duration-150">
                        <span className="text-amber-400/90">+</span> {formatSimpleRupiah(t.jumlah)}
                      </td>
                      <td className="py-1.5 px-3 text-center whitespace-nowrap">
                        {getCitizenPhone(t.warga_id, t.keterangan) ? (
                          <a
                            href={handleGetWaReceiptLink(t)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[10.5px] font-semibold border border-emerald-400/25 shadow-sm shadow-black/40 transition-all duration-150 cursor-pointer whitespace-nowrap"
                            title="Kirim bukti kwitansi via WhatsApp"
                          >
                            <svg className="w-3 h-3 fill-current text-emerald-100 shrink-0" viewBox="0 0 24 24">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.436 0 9.851-4.38 9.854-9.762.001-2.607-1.012-5.059-2.853-6.902C16.392 2.096 13.946 1.08 11.336 1.08c-5.44 0-9.857 4.379-9.86 9.762-.001 1.902.5 3.744 1.447 5.354L1.874 22.1l6.104-1.601c1.533.835 3.1 1.255 4.669 1.255zm11.302-7.14c-.302-.152-1.791-.883-2.073-.984-.282-.102-.487-.152-.69.152-.204.304-.79.984-.968 1.186-.179.203-.357.228-.659.076-.302-.152-1.274-.469-2.427-1.496-.897-.8-1.502-1.787-1.679-2.09-.178-.303-.019-.467.132-.618.136-.135.302-.354.453-.532.152-.178.203-.304.304-.507.102-.203.051-.38-.025-.532-.076-.152-.69-1.66-.945-2.272-.248-.598-.5-.516-.69-.526-.178-.01-.383-.01-.587-.01-.204 0-.538.076-.82.38-.282.304-1.077 1.052-1.077 2.563 0 1.511 1.096 2.969 1.248 3.172.152.203 2.158 3.297 5.228 4.618.729.314 1.3.502 1.745.643.733.232 1.399.2 1.925.122.587-.087 1.791-.733 2.046-1.439.255-.705.255-1.312.179-1.439-.076-.127-.282-.203-.585-.355z"/>
                            </svg>
                            <span>Kirim</span>
                          </a>
                        ) : (
                          <span
                            className="text-zinc-500 text-[10.5px] font-medium select-none"
                            title="Nomor HP warga belum terdaftar"
                          >
                            Belum Ada WA
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-zinc-400 flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
                  <Coins className="w-7 h-7 text-emerald-400/80" />
                </div>
                <p className="text-xs font-bold text-zinc-100">Belum Ada Riwayat Iuran</p>
                <p className="text-[11px] text-zinc-400 max-w-xs mt-1">
                  Belum ditemukan data transaksi iuran yang cocok. Silakan catat iuran baru melalui formulir di samping.
                </p>
              </div>
            )}
          </div>

          {/* Clean Modern Black Summary Footer */}
          <div className="px-5 sm:px-6 py-3 bg-black border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-zinc-400 font-medium tabular-nums">
              Menampilkan <span className="font-bold text-white">{filteredHistory.length}</span> dari <span className="font-bold text-white">{iuranHistory.length}</span> catatan iuran
            </span>
            <span className="text-zinc-400 font-medium">
              Total Tercatat:{' '}
              <span className="font-extrabold font-mono tabular-nums text-emerald-400">
                {formatSimpleRupiah(filteredHistoryTotal)}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
