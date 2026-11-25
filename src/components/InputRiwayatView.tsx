import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  Check, 
  Loader2, 
  Wallet, 
  CreditCard, 
  BarChart2, 
  TrendingUp, 
  TrendingDown, 
  Info, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  X,
  Plus,
  Download,
  Upload,
  Coins,
  ReceiptText,
  ShieldAlert,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Transaction, TransactionType, CategoryItem, SupabaseConnectionStatus } from '../types';
import { CATEGORIES_BY_TYPE, INITIAL_CATEGORIES, formatSimpleRupiah, formatDateIndo } from '../data/initialData';
import { useSekretariat } from '../context/SekretariatContext';
import { TransaksiIuranSection } from './TransaksiIuranSection';

interface InputRiwayatViewProps {
  transactions: Transaction[];
  categories?: CategoryItem[];
  onAddTransaction: (newTx: Omit<Transaction, 'id' | 'createdAt' | 'status'>) => Promise<boolean | void> | void;
  activeBalance: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onOpenExport?: (filteredData?: Transaction[], filterLabel?: string) => void;
  onOpenImport?: () => void;
  connectionStatus?: SupabaseConnectionStatus;
  onTriggerToast?: (msg: string, type?: 'success' | 'error' | 'info', title?: string) => void;
  onTriggerSos?: () => void;
}

export const InputRiwayatView: React.FC<InputRiwayatViewProps> = ({
  transactions,
  categories,
  onAddTransaction,
  activeBalance,
  onRefresh,
  isRefreshing = false,
  onOpenExport,
  onOpenImport,
  connectionStatus = 'connected',
  onTriggerToast,
  onTriggerSos,
}) => {
  // Navigation Subtab State: Setoran Iuran Warga vs Entri Kas Umum
  const [activeSubTab, setActiveSubTab] = useState<'iuran-warga' | 'kas-umum'>('iuran-warga');
  const [iuranRefreshTrigger, setIuranRefreshTrigger] = useState(0);
  const [isIuranRefreshing, setIsIuranRefreshing] = useState(false);

  const handleRefreshAll = () => {
    if (activeSubTab === 'iuran-warga') {
      setIuranRefreshTrigger((prev) => prev + 1);
    }
    if (onRefresh) {
      onRefresh();
    }
  };

  // Form States
  const { wilayahShort } = useSekretariat();
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);
  const [type, setType] = useState<TransactionType>('Masuk');

  // List kategori aktif sesuai jenis transaksi (Kas Masuk / Kas Keluar)
  const activeCategoryList = useMemo(() => {
    if (categories) {
      const filtered = categories.filter((c) => c.type === type);
      return filtered.map((c) => ({ value: c.name, label: c.name }));
    }
    return [];
  }, [categories, type]);

  const [category, setCategory] = useState(() => {
    if (categories && categories.length > 0) {
      const first = categories.find((c) => c.type === 'Masuk');
      if (first) return first.name;
    }
    return '';
  });

  // Pastikan kategori yang dipilih selalu valid saat list berubah
  useEffect(() => {
    if (activeCategoryList.length > 0) {
      const exists = activeCategoryList.some((c) => c.value === category);
      if (!exists) {
        setCategory(activeCategoryList[0].value);
      }
    } else {
      setCategory('');
    }
  }, [activeCategoryList, category]);

  // Memberikan fokus ke container utama saat halaman Input & Riwayat terbuka agar tombol panah atas/bawah langsung aktif
  useEffect(() => {
    window.focus();
    const el = document.getElementById('input-riwayat-view-container');
    if (el) {
      el.focus({ preventScroll: true });
    }
  }, []);

  const [rawAmount, setRawAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);

  // Bersihkan awalan otomatis seperti "Keterangan transaksi Penerimaan :" dari teks deskripsi
  const cleanCategoryDescriptionText = useCallback((raw: string): string => {
    if (!raw) return '';
    return raw
      .replace(/^\s*keterangan\s+transaksi\s*:?\s*/i, '')
      .replace(/^\s*penerimaan\s*:\s*/i, '')
      .replace(/\s*\((Kas Masuk|Kas Keluar)\)\s*$/i, '')
      .trim();
  }, []);

  // Ambil deskripsi bersih berdasarkan nama kategori dan jenis transaksi
  const getCategoryDescriptionText = useCallback((catName: string, txType: TransactionType): string => {
    if (!catName || !catName.trim()) return '';

    // 1. Cek dari daftar kategori props (database / custom)
    if (categories && categories.length > 0) {
      const matchExact = categories.find((c) => c.name === catName && c.type === txType);
      if (matchExact && matchExact.description && matchExact.description.trim()) {
        return cleanCategoryDescriptionText(matchExact.description);
      }
      const matchName = categories.find((c) => c.name === catName);
      if (matchName && matchName.description && matchName.description.trim()) {
        return cleanCategoryDescriptionText(matchName.description);
      }
    }

    // 2. Cek dari INITIAL_CATEGORIES
    const initialExact = INITIAL_CATEGORIES.find((c) => c.name === catName && c.type === txType);
    if (initialExact && initialExact.description && initialExact.description.trim()) {
      return cleanCategoryDescriptionText(initialExact.description);
    }
    const initialName = INITIAL_CATEGORIES.find((c) => c.name === catName);
    if (initialName && initialName.description && initialName.description.trim()) {
      return cleanCategoryDescriptionText(initialName.description);
    }

    // 3. Fallback bersih menggunakan nama kategori tanpa awalan "Keterangan transaksi Penerimaan :"
    return cleanCategoryDescriptionText(catName);
  }, [categories, cleanCategoryDescriptionText]);

  // Fokuskan kursor ke input Jumlah Transaksi (sebelah kanan Rp)
  const focusAmountInput = useCallback(() => {
    setTimeout(() => {
      const el = amountInputRef.current;
      if (el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    }, 10);
  }, []);

  // Fokuskan kursor ke bagian paling kanan teks pada textarea Keterangan / Uraian Transaksi
  const focusDescriptionAtEnd = useCallback((text: string) => {
    setTimeout(() => {
      const el = descriptionRef.current;
      if (el) {
        el.focus();
        const len = text.length;
        el.setSelectionRange(len, len);
        el.scrollTop = el.scrollHeight;
      }
    }, 10);
  }, []);

  // Deskripsi dinamis sesuai jenis & kategori yang dipilih untuk placeholder keterangan
  const selectedCategoryDescription = useMemo(() => {
    return getCategoryDescriptionText(category, type);
  }, [category, type, getCategoryDescriptionText]);

  // Table Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchScope, setSearchScope] = useState<'all' | 'keterangan'>('all');
  const [tableFilterType, setTableFilterType] = useState<'All' | 'Masuk' | 'Keluar'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Helper untuk menyorot kata kunci pencarian keterangan/uraian
  const highlightText = (text: string, query: string) => {
    if (!query || !query.trim() || !text) return text;
    const q = query.trim();
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    if (parts.length === 1) return text;
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={i} className="bg-amber-200 text-amber-950 font-bold px-1 py-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Preset kata kunci pencarian keterangan/uraian warga
  const quickKeteranganKeywords = [
    'Iuran Warga',
    'Perbaikan Jalan',
    'Pembangunan Masjid',
    'Biaya keRTan',
    'Lampu Jalan',
    'Kebersihan',
    'Santunan',
    'Pos Ronda',
    'Konsumsi Rapat',
  ];

  // Handle Type Change
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    if (categories && categories.length > 0) {
      const filtered = categories.filter((c) => c.type === newType);
      if (filtered.length > 0) {
        setCategory(filtered[0].name);
        return;
      }
    }
    setCategory('');
  };

  // Format currency as user types
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, '');
    if (!rawVal) {
      setRawAmount('');
      return;
    }
    const formatted = Number(rawVal).toLocaleString('id-ID');
    setRawAmount(formatted);
  };

  // Quick preset nominal click
  const handlePresetAmount = (nominal: number) => {
    setRawAmount(nominal.toLocaleString('id-ID'));
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !category.trim()) {
      if (onTriggerToast) {
        onTriggerToast(
          'Tabel kategori di Supabase masih kosong. Silakan tambahkan kategori terlebih dahulu di menu Kelola Kategori.',
          'error',
          'Kategori Kosong'
        );
      }
      return;
    }
    const cleanNumber = parseInt(rawAmount.replace(/\./g, ''), 10);
    if (!cleanNumber || cleanNumber <= 0) return;
    if (!description.trim()) return;

    setIsSubmitting(true);

    try {
      await onAddTransaction({
        date,
        type,
        category,
        amount: cleanNumber,
        description: description.trim(),
      });

      // Reset Form on success
      setRawAmount('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter Transactions (Termasuk fitur pencarian khusus keterangan atau uraian)
  const filteredTransactions = transactions.filter((tx) => {
    const term = searchTerm.toLowerCase().trim();
    let matchesSearch = true;

    if (term) {
      if (searchScope === 'keterangan') {
        matchesSearch = (tx.description || '').toLowerCase().includes(term);
      } else {
        matchesSearch =
          (tx.description || '').toLowerCase().includes(term) ||
          (tx.category || '').toLowerCase().includes(term) ||
          (tx.id || '').toLowerCase().includes(term);
      }
    }

    const matchesType = tableFilterType === 'All' || tx.type === tableFilterType;

    return matchesSearch && matchesType;
  });

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage) || 1;
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Counts for tabs
  const countMasuk = transactions.filter((t) => t.type === 'Masuk').length;
  const countKeluar = transactions.filter((t) => t.type === 'Keluar').length;

  // Calculate dynamic monthly summaries for current view
  const currentMonthMasuk = transactions
    .filter((t) => t.type === 'Masuk')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const currentMonthKeluar = transactions
    .filter((t) => t.type === 'Keluar')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const sisaAnggaran = currentMonthMasuk - currentMonthKeluar;

  // Preset buttons
  const quickPresets = [25000, 50000, 100000, 200000, 500000];

  return (
    <div 
      id="input-riwayat-view-container" 
      tabIndex={-1} 
      className="flex flex-col w-full space-y-4 sm:space-y-5 lg:space-y-6 outline-none"
    >
      {/* Top Banner / Header Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
            Input & Riwayat Transaksi
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pencatatan mutasi kas umum, iuran warga, dan buku kas akuntabel
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-3 px-3.5 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-white via-white to-emerald-50/50 rounded-xl shadow-xs border border-emerald-200/80 ring-1 ring-emerald-500/10">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 ring-1 ring-emerald-200/60">
              <Wallet className="w-4.5 h-4.5 shrink-0" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Saldo Kas Bersih {wilayahShort}</span>
              <span className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                {formatSimpleRupiah(activeBalance)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Subtab Navigation Bar: Setoran Iuran Warga vs Entri Kas Umum + Segarkan Data */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 bg-slate-100 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSubTab('iuran-warga')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeSubTab === 'iuran-warga'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-1 ring-indigo-500/30 font-extrabold'
                : 'text-slate-600 hover:text-indigo-700 hover:bg-indigo-50/60'
            }`}
          >
            <Coins className={`w-3.5 h-3.5 transition-transform ${activeSubTab === 'iuran-warga' ? 'text-indigo-100 scale-110' : 'text-slate-500'}`} />
            <span>1. Setoran Iuran Warga</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('kas-umum')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeSubTab === 'kas-umum'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-1 ring-indigo-500/30 font-extrabold'
                : 'text-slate-600 hover:text-indigo-700 hover:bg-indigo-50/60'
            }`}
          >
            <ReceiptText className={`w-3.5 h-3.5 transition-transform ${activeSubTab === 'kas-umum' ? 'text-indigo-100 scale-110' : 'text-slate-500'}`} />
            <span>2. Entri Kas Umum & Riwayat</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleRefreshAll}
          disabled={isRefreshing || isIuranRefreshing || (activeSubTab === 'iuran-warga' && connectionStatus !== 'connected')}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-all duration-150 shadow-xs flex items-center gap-2 text-xs font-semibold disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
          title="Segarkan Data Transaksi, Iuran & Warga"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${(isRefreshing || isIuranRefreshing) ? 'animate-spin text-emerald-400' : 'text-slate-300'}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* Subtab 1: Entri Kas Umum & Riwayat */}
      {activeSubTab === 'kas-umum' && (() => {
        const isMasukForm = type === 'Masuk';
        const numericRawAmount = parseInt(rawAmount.replace(/\./g, ''), 10) || 0;

        return (
        <div className="space-y-4 sm:space-y-5 lg:space-y-6 animate-in fade-in duration-200">
          {/* Main Grid: Form & Quick Summary/Tips */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* Form Section - Adaptive Modern Sapphire/Cyan (Masuk) & Warm Amber/Orange (Keluar) Card */}
        <div
          className={`lg:col-span-7 rounded-2xl shadow-xl overflow-hidden border transition-colors duration-200 flex flex-col ${
            isMasukForm
              ? 'bg-gradient-to-br from-indigo-50/95 via-blue-50/75 to-sky-100/70 border-indigo-300/80 shadow-indigo-900/10'
              : 'bg-gradient-to-br from-amber-50/95 via-orange-50/75 to-rose-100/60 border-amber-300/80 shadow-orange-900/10'
          }`}
        >
          {/* Vibrant Modern Colored Card Header */}
          <div
            className={`relative overflow-hidden px-5 sm:px-6 py-3.5 min-h-[72px] flex items-center transition-colors duration-200 ${
              isMasukForm
                ? 'bg-gradient-to-r from-indigo-950 via-blue-900 to-cyan-900 text-white'
                : 'bg-gradient-to-r from-stone-950 via-amber-900 to-orange-800 text-white'
            }`}
          >
            <div
              className={`absolute -right-8 -top-8 w-36 h-36 rounded-full blur-2xl pointer-events-none ${
                isMasukForm ? 'bg-cyan-400/25' : 'bg-amber-400/25'
              }`}
            />
            <div
              className={`absolute left-1/3 -bottom-10 w-32 h-24 rounded-full blur-2xl pointer-events-none ${
                isMasukForm ? 'bg-indigo-400/20' : 'bg-rose-400/20'
              }`}
            />
            <div className="relative w-full flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-md ring-1 ring-white/25 ${
                    isMasukForm
                      ? 'bg-gradient-to-br from-sky-400 to-indigo-500 text-white'
                      : 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
                  }`}
                >
                  <CreditCard className="w-4.5 h-4.5 shrink-0" />
                </div>
                <div>
                  <h2 className="font-bold text-white text-sm sm:text-base tracking-tight leading-tight">
                    Form Entri Kas {wilayahShort}
                  </h2>
                  <p className={`text-[11px] mt-0.5 ${isMasukForm ? 'text-sky-200/85' : 'text-amber-200/85'}`}>
                    Catat mutasi penerimaan atau pengeluaran kas
                  </p>
                </div>
              </div>

              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-bold whitespace-nowrap shrink-0 ${
                  isMasukForm ? 'text-cyan-300' : 'text-amber-300'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isMasukForm ? 'bg-cyan-300' : 'bg-amber-300'}`} />
                Sinkron
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-4.5 sm:p-5 flex flex-col gap-3.5 relative">
            {/* Segmented Type Toggle (Masuk vs Keluar) */}
            <div className="flex flex-col gap-1.5">
              <div
                className={`p-1 rounded-xl grid grid-cols-2 gap-1 text-xs font-bold border shadow-2xs backdrop-blur-sm ${
                  isMasukForm
                    ? 'bg-white/85 border-indigo-200/90 text-slate-600'
                    : 'bg-white/85 border-amber-200/90 text-slate-600'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleTypeChange('Masuk')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs transition-all duration-150 cursor-pointer ${
                    isMasukForm
                      ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                      : 'text-slate-600 hover:text-indigo-700 hover:bg-indigo-50/80 font-semibold'
                  }`}
                >
                  <ArrowDownLeft className={`w-3.5 h-3.5 ${isMasukForm ? 'text-cyan-100' : 'text-slate-400'}`} />
                  <span>Kas Masuk (Pemasukan)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('Keluar')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs transition-all duration-150 cursor-pointer ${
                    !isMasukForm
                      ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-md shadow-orange-500/30 font-bold'
                      : 'text-slate-600 hover:text-orange-700 hover:bg-orange-50/80 font-semibold'
                  }`}
                >
                  <ArrowUpRight className={`w-3.5 h-3.5 ${!isMasukForm ? 'text-amber-100' : 'text-slate-400'}`} />
                  <span>Kas Keluar (Pengeluaran)</span>
                </button>
              </div>
            </div>

            {/* Tanggal & Pos Kategori - Modern Jewel-Toned Panel */}
            <div
              className={`p-3.5 rounded-xl border space-y-3 shadow-sm transition-colors duration-200 ${
                isMasukForm
                  ? 'bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 border-indigo-700/70 text-white'
                  : 'bg-gradient-to-br from-stone-900 via-amber-950 to-orange-950 border-amber-700/70 text-white'
              }`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Tanggal */}
                <div className="flex flex-col gap-1">
                  <label className={`text-[11px] font-semibold tracking-wide ${isMasukForm ? 'text-sky-300' : 'text-amber-300'}`}>
                    Tanggal Transaksi <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border text-white outline-none font-semibold tabular-nums transition-all text-xs [color-scheme:dark] ${
                      isMasukForm
                        ? 'border-indigo-400/35 focus:ring-2 focus:ring-cyan-400/35 focus:border-cyan-400'
                        : 'border-amber-400/35 focus:ring-2 focus:ring-amber-400/35 focus:border-amber-400'
                    }`}
                  />
                </div>

                {/* Kategori */}
                <div className="flex flex-col gap-1">
                  <label className={`text-[11px] font-semibold tracking-wide ${isMasukForm ? 'text-sky-300' : 'text-amber-300'}`}>
                    Kategori Anggaran <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => {
                      const newCategory = e.target.value;
                      setCategory(newCategory);
                      const cleanText = getCategoryDescriptionText(newCategory, type);
                      setDescription(cleanText);
                      focusAmountInput();
                    }}
                    required
                    disabled={activeCategoryList.length === 0}
                    className={`w-full px-3 py-2 rounded-lg outline-none font-bold cursor-pointer border transition-all text-xs disabled:opacity-75 disabled:cursor-not-allowed ${
                      isMasukForm
                        ? 'bg-cyan-500/15 hover:bg-cyan-500/20 border-cyan-400/40 text-cyan-100 focus:ring-2 focus:ring-cyan-400/35 focus:border-cyan-300'
                        : 'bg-amber-500/15 hover:bg-amber-500/20 border-amber-400/40 text-amber-100 focus:ring-2 focus:ring-amber-400/35 focus:border-amber-300'
                    }`}
                  >
                    {activeCategoryList.length === 0 ? (
                      <option value="" className="bg-slate-900 text-white">-- (Kosong) Tidak Ada Kategori di Supabase --</option>
                    ) : (
                      activeCategoryList.map((cat) => (
                        <option key={cat.value} value={cat.value} className="bg-slate-900 text-white font-medium">
                          {cat.label}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
              {activeCategoryList.length === 0 && (
                <p className="text-[11px] text-amber-200 font-medium flex items-center gap-1.5 bg-amber-500/15 p-2 rounded-lg border border-amber-400/35">
                  <ShieldAlert className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>Tabel kategori di Supabase masih kosong. Silakan tambahkan kategori di menu <b>Kelola Kategori</b>.</span>
                </p>
              )}
            </div>

            {/* Jumlah (Rp) & Quick Preset Pills - Rich Deep Emerald-Teal & Warm Gold Monetary Card */}
            <div className="p-3.5 bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-950 rounded-xl border border-emerald-500/45 space-y-2.5 shadow-md">
              <label className="text-xs font-bold text-emerald-200 flex items-center justify-between tracking-wide">
                <span>
                  Jumlah Transaksi (Nominal) <span className="text-rose-400">*</span>
                </span>
                {rawAmount && (
                  <span className="font-extrabold text-sm font-mono tabular-nums text-amber-300">
                    Rp {rawAmount}
                  </span>
                )}
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-0 top-0 bottom-0 px-3.5 flex items-center text-xs font-black pointer-events-none rounded-l-xl bg-gradient-to-b from-emerald-400 to-teal-500 text-slate-950">
                  Rp
                </span>
                <input
                  ref={amountInputRef}
                  type="text"
                  required
                  placeholder="0"
                  value={rawAmount}
                  onChange={handleAmountChange}
                  className="w-full pl-12 pr-4 py-2 text-xs sm:text-sm bg-black/60 border border-emerald-400/45 rounded-xl focus:bg-black/80 focus:ring-2 focus:ring-amber-400/30 focus:border-amber-300 transition-all outline-none font-extrabold font-mono tabular-nums text-amber-300 placeholder:text-emerald-400/40"
                />
              </div>

              {/* Quick Nominal Presets */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[11px] font-semibold text-emerald-200/80 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-300" /> Nominal cepat:
                </span>
                {quickPresets.map((nominal) => (
                  <button
                    key={nominal}
                    type="button"
                    onClick={() => handlePresetAmount(nominal)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono tabular-nums border transition-all duration-150 cursor-pointer whitespace-nowrap ${
                      numericRawAmount === nominal
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 border-amber-300 shadow-sm'
                        : 'bg-emerald-900/60 text-emerald-100 border-emerald-500/35 hover:border-emerald-300 hover:bg-emerald-800/80 hover:text-white'
                    }`}
                  >
                    +{nominal.toLocaleString('id-ID')}
                  </button>
                ))}
              </div>
            </div>

            {/* Keterangan - Rich Deep Violet/Rose-Slate Panel */}
            <div
              className={`p-3.5 rounded-xl border space-y-2 shadow-md transition-colors duration-200 ${
                isMasukForm
                  ? 'bg-gradient-to-br from-slate-900 via-violet-950/90 to-indigo-950 border-violet-500/40'
                  : 'bg-gradient-to-br from-stone-900 via-rose-950/80 to-amber-950 border-rose-500/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className={`text-xs font-bold tracking-wide flex items-center gap-1.5 ${isMasukForm ? 'text-violet-200' : 'text-rose-200'}`}>
                  <span>Keterangan / Uraian Transaksi</span>
                  <span className="text-rose-400">*</span>
                </label>
                <div className="flex items-center gap-2">
                  {selectedCategoryDescription && (
                    <button
                      type="button"
                      onClick={() => {
                        setDescription(selectedCategoryDescription);
                        focusDescriptionAtEnd(selectedCategoryDescription);
                      }}
                      className={`text-[11px] font-semibold hover:underline cursor-pointer flex items-center gap-1 transition-colors ${
                        isMasukForm ? 'text-cyan-300 hover:text-white' : 'text-amber-300 hover:text-white'
                      }`}
                      title="Gunakan deskripsi kategori ini sebagai isi keterangan"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Gunakan Deskripsi Kategori</span>
                    </button>
                  )}
                  <span className="text-[11px] font-normal text-slate-400 hidden sm:inline">
                    Bebas karakter
                  </span>
                </div>
              </div>
              <textarea
                ref={descriptionRef}
                required
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={selectedCategoryDescription || 'Tulis keterangan / uraian transaksi...'}
                className={`w-full px-2.5 py-2 rounded-xl bg-black/55 border text-white outline-none transition-all text-xs resize-y min-h-[48px] leading-snug placeholder:text-slate-400 ${
                  isMasukForm
                    ? 'border-violet-400/40 focus:bg-black/75 focus:ring-2 focus:ring-cyan-400/30 focus:border-cyan-300'
                    : 'border-rose-400/40 focus:bg-black/75 focus:ring-2 focus:ring-amber-400/30 focus:border-amber-300'
                }`}
              />
              {selectedCategoryDescription && (
                <div className="flex items-center justify-between text-[11px] text-slate-300 bg-black/45 px-3 py-1.5 rounded-lg border border-white/10">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className={`font-semibold shrink-0 ${isMasukForm ? 'text-violet-200' : 'text-rose-200'}`}>Deskripsi Kategori:</span>
                    <span className="text-slate-300 truncate" title={selectedCategoryDescription}>
                      {selectedCategoryDescription}
                    </span>
                  </div>
                  {!description && (
                    <button
                      type="button"
                      onClick={() => {
                        setDescription(selectedCategoryDescription);
                        focusDescriptionAtEnd(selectedCategoryDescription);
                      }}
                      className="text-amber-300 hover:text-amber-200 font-bold shrink-0 cursor-pointer ml-2 hover:underline text-[11px]"
                    >
                      Pakai Teks Ini
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Action Submit */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-3 px-4 rounded-xl text-white text-xs sm:text-sm font-bold transition-all duration-150 shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer active:scale-[0.99] ring-1 ring-white/20 ${
                  isMasukForm
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-700 hover:via-indigo-700 hover:to-cyan-700 shadow-indigo-600/30'
                    : 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:via-orange-600 hover:to-rose-600 shadow-orange-500/30'
                }`}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" />
                ) : (
                  <Check className="w-4 h-4 text-white shrink-0" />
                )}
                <span>{isSubmitting ? 'Menyimpan ke Supabase...' : 'Simpan Transaksi'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Quick Stats / Instruction Panel */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Ringkasan Bulan Ini Card - Deep Emerald-Teal & Gold Monetary Card */}
          <div className="bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-950 text-white rounded-2xl p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden shadow-xl border border-emerald-500/45">
            {/* Ambient soft glow */}
            <div className="absolute -right-8 -bottom-8 w-56 h-56 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-8 -top-8 w-44 h-44 bg-teal-400/15 rounded-full blur-2xl pointer-events-none" />

            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse ring-4 ring-emerald-400/20" />
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                    Rekap Kas Bulan Berjalan
                  </span>
                </div>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/35 flex items-center justify-center shadow-sm">
                  <BarChart2 className="w-4 h-4 text-emerald-300 shrink-0" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5 mb-5">
                <div className="p-3.5 bg-black/50 backdrop-blur-md rounded-xl border border-emerald-400/30 shadow-xs hover:border-emerald-400/55 transition-colors">
                  <span className="text-[11px] text-emerald-200/85 font-semibold">Total Kas Masuk</span>
                  <div className="text-base sm:text-lg font-extrabold font-mono tabular-nums text-emerald-300 mt-1 tracking-tight">
                    {formatSimpleRupiah(currentMonthMasuk)}
                  </div>
                  <span className="text-[10px] text-emerald-200/90 flex items-center gap-1 mt-1.5 font-semibold">
                    <TrendingUp className="w-3 h-3 shrink-0" />
                    {countMasuk} penerimaan
                  </span>
                </div>

                <div className="p-3.5 bg-black/50 backdrop-blur-md rounded-xl border border-rose-400/30 shadow-xs hover:border-rose-400/55 transition-colors">
                  <span className="text-[11px] text-rose-200/85 font-semibold">Total Kas Keluar</span>
                  <div className="text-base sm:text-lg font-extrabold font-mono tabular-nums text-rose-300 mt-1 tracking-tight">
                    {formatSimpleRupiah(currentMonthKeluar)}
                  </div>
                  <span className="text-[10px] text-rose-200/90 flex items-center gap-1 mt-1.5 font-semibold">
                    <TrendingDown className="w-3 h-3 shrink-0" />
                    {countKeluar} pengeluaran
                  </span>
                </div>
              </div>
            </div>

            <div className="relative px-3.5 py-2.5 rounded-xl bg-black/70 border border-amber-400/40 flex items-center justify-between text-xs shadow-xs">
              <span className="text-zinc-200 font-semibold">Sisa Kas Berjalan:</span>
              <span className={`font-extrabold font-mono tabular-nums text-base sm:text-lg tracking-tight ${sisaAnggaran >= 0 ? 'text-amber-300' : 'text-rose-300'}`}>
                {formatSimpleRupiah(sisaAnggaran)}
              </span>
            </div>
          </div>

          {/* Panduan Pengisian Card - Matching Emerald-Teal Header & Dark Sapphire Panel */}
          <div className="rounded-2xl shadow-lg border border-indigo-300/80 bg-gradient-to-br from-indigo-50/95 via-blue-50/75 to-sky-100/70 overflow-hidden flex flex-col flex-1 justify-between">
            <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-950 text-white px-5 py-3.5 flex items-center gap-3">
              <div className="absolute -right-8 -top-8 w-28 h-28 bg-emerald-400/15 rounded-full blur-2xl pointer-events-none" />
              <div className="relative w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/35 flex items-center justify-center text-emerald-300 shrink-0">
                <Info className="w-4 h-4 shrink-0" />
              </div>
              <div className="relative">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Pedoman Entri Kas {wilayahShort}
                </h3>
                <p className="text-[11px] text-emerald-200/85">Standar transparansi buku kas warga</p>
              </div>
            </div>

            <div className="p-4 space-y-3.5 flex-1">
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 border border-indigo-500/40 shadow-sm">
                <ul className="flex flex-col gap-2 text-xs text-slate-200 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                    <span>Sertakan nama warga atau nomor rumah pada kolom keterangan iuran.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                    <span>Pilih kategori yang tepat agar grafik dan laporan bulanan akurat.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                    <span>Data yang salah diinput dapat diperbaiki sewaktu-waktu di menu <strong className="text-amber-300">Koreksi & Hapus</strong>.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="px-5 py-2.5 bg-black border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400">
              <span>Status Sistem: <span className="text-white font-semibold">Siap</span></span>
              <span className="font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Terverifikasi
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions Table Section - Modern Emerald / Teal Ledger & Obsidian Black Table */}
      <div className="bg-gradient-to-b from-white via-white to-emerald-50/25 rounded-2xl shadow-lg shadow-emerald-950/[0.05] border border-emerald-200/80 overflow-hidden">
        {/* Rich Modern Emerald-Teal Card Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-950 text-white px-5 sm:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-400/15 rounded-full blur-2xl pointer-events-none" />
          <div className="relative flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/35 text-emerald-300 flex items-center justify-center shrink-0 shadow-sm">
              <ReceiptText className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Riwayat Transaksi Terbaru
                </h2>
                <span className="px-2.5 py-0.5 text-[11px] font-bold bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-400/35 tabular-nums">
                  {filteredTransactions.length} Data
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/85 mt-0.5">
                Daftar pencatatan mutasi kas warga yang tersimpan di tabel kas_rt
              </p>
            </div>
          </div>

          <div className="relative flex items-center gap-2 flex-wrap">
            {/* Refresh from Supabase Button */}
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-200 hover:text-white border border-emerald-400/30 transition-all cursor-pointer disabled:opacity-50"
                title="Segarkan data dari Supabase (kas_rt)"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-300' : ''}`} />
              </button>
            )}

            {/* Ekspor Data Button */}
            {onOpenExport && (
              <button
                type="button"
                onClick={() => {
                  const isFiltered = Boolean(searchTerm.trim() || tableFilterType !== 'All');
                  const label = isFiltered
                    ? `${tableFilterType !== 'All' ? `Jenis: ${tableFilterType}` : ''}${searchTerm ? ` • Pencarian: "${searchTerm}"` : ''}`.trim()
                    : undefined;
                  onOpenExport(filteredTransactions, label);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold text-xs transition-all cursor-pointer shadow-sm active:scale-98 ring-1 ring-white/20"
                title="Ekspor & Unduh Data (.xlsx, PDF, CSV, JSON)"
              >
                <Download className="w-3.5 h-3.5 text-cyan-100" />
                <span className="hidden sm:inline">Ekspor Data</span>
              </button>
            )}

            {/* Import Data Button */}
            {onOpenImport && (
              <button
                type="button"
                onClick={onOpenImport}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-sm active:scale-98"
                title="Import Data Kas dari File Excel (.xlsx, .xls, .csv)"
              >
                <Upload className="w-3.5 h-3.5 text-slate-950" />
                <span className="hidden sm:inline">Import Data</span>
              </button>
            )}
          </div>
        </div>

        {/* Rich Emerald-Teal Search & Filter Toolbar */}
        <div className="px-5 sm:px-6 py-3.5 bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-950 border-t border-emerald-500/30 space-y-2.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            {/* Search Input with Scope Selector & Clear Button */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap flex-1">
              {/* Toggle Scope: Semua vs Khusus Keterangan/Uraian */}
              <div className="flex items-center bg-black/45 rounded-xl p-1 border border-emerald-500/30 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSearchScope('all');
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                    searchScope === 'all'
                      ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-bold shadow-sm'
                      : 'text-emerald-200/85 hover:text-white hover:bg-emerald-900/60'
                  }`}
                  title="Cari di seluruh kolom (ID, Kategori, dan Keterangan)"
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchScope('keterangan');
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    searchScope === 'keterangan'
                      ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-bold shadow-sm'
                      : 'text-emerald-200/85 hover:text-white hover:bg-emerald-900/60'
                  }`}
                  title="Khusus memfilter berdasarkan keterangan atau uraian transaksi"
                >
                  <span>Keterangan</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded font-semibold hidden sm:inline ${searchScope === 'keterangan' ? 'bg-slate-950/20 text-slate-950' : 'bg-emerald-900/70 text-emerald-200'}`}>Uraian</span>
                </button>
              </div>

              {/* Input Pencarian */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder={
                    searchScope === 'keterangan'
                      ? 'Cari keterangan/uraian (cth: Budi, lampu, pos)...'
                      : 'Cari ID, kategori, keterangan...'
                  }
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="block w-full pl-10 pr-9 py-2 rounded-xl bg-gradient-to-r from-slate-900/95 via-emerald-950/90 to-teal-950/95 border border-emerald-400/45 focus:ring-2 focus:ring-amber-400/30 focus:border-amber-300 text-white placeholder:text-emerald-200/65 shadow-inner outline-none text-xs transition-all"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-300 hover:text-white cursor-pointer transition-colors"
                    title="Hapus pencarian"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Pill Toggle */}
            <div className="flex items-center bg-black/45 rounded-xl p-1 border border-emerald-500/30 shrink-0 self-start lg:self-auto">
              <button
                type="button"
                onClick={() => {
                  setTableFilterType('All');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  tableFilterType === 'All'
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-bold shadow-sm'
                    : 'text-emerald-200/85 hover:text-white hover:bg-emerald-900/60'
                }`}
              >
                Semua ({transactions.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setTableFilterType('Masuk');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  tableFilterType === 'Masuk'
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-bold shadow-sm'
                    : 'text-emerald-200/85 hover:text-white hover:bg-emerald-900/60'
                }`}
              >
                Masuk ({countMasuk})
              </button>
              <button
                type="button"
                onClick={() => {
                  setTableFilterType('Keluar');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  tableFilterType === 'Keluar'
                    ? 'bg-gradient-to-r from-amber-400 to-rose-500 text-slate-950 font-bold shadow-sm'
                    : 'text-emerald-200/85 hover:text-white hover:bg-emerald-900/60'
                }`}
              >
                Keluar ({countKeluar})
              </button>
            </div>
          </div>

          {/* Quick Search Chips Bar khusus pencarian Keterangan / Uraian */}
          <div className="flex items-center justify-between gap-2.5 flex-wrap pt-0.5">
            <div className="flex items-center gap-1.5 flex-wrap p-1 bg-black/45 border border-emerald-500/30 rounded-xl w-full">
              <span className="text-[10.5px] font-bold text-emerald-300/90 uppercase tracking-wider flex items-center gap-1 px-2">
                <Search className="w-3 h-3 text-emerald-400" />
                <span>Pencarian Uraian:</span>
              </span>
              {quickKeteranganKeywords.map((kw) => (
                <button
                  key={kw}
                  type="button"
                  onClick={() => {
                    setSearchScope('keterangan');
                    setSearchTerm(kw);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                    searchTerm === kw && searchScope === 'keterangan'
                      ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-bold shadow-sm'
                      : 'text-emerald-200/85 hover:text-white hover:bg-emerald-900/60'
                  }`}
                >
                  {kw}
                </button>
              ))}

              {searchTerm && (
                <div className="flex items-center gap-2 ml-auto pr-1.5">
                  <span className="text-[11px] font-semibold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-400/30">
                    {filteredTransactions.length} hasil
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setCurrentPage(1);
                    }}
                    className="text-[11px] font-bold text-rose-300 hover:text-rose-200 cursor-pointer flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Bersihkan
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table Container - Modern Obsidian Black Theme */}
        <div className="overflow-x-auto bg-neutral-950 custom-scrollbar-dark border-t border-zinc-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-black text-zinc-300 font-semibold border-b border-zinc-800 text-[11px] tracking-wide">
                <th className="py-2.5 px-2 sm:px-2.5 w-px whitespace-nowrap">Tanggal</th>
                <th className="py-2.5 px-2 sm:px-2.5 w-px whitespace-nowrap">Jenis</th>
                <th className="py-2.5 px-2 sm:px-2.5 w-px whitespace-nowrap">Kategori</th>
                <th className="py-2.5 px-2.5 sm:px-3">Keterangan</th>
                <th className="py-2.5 px-2.5 sm:px-3 w-px text-right whitespace-nowrap bg-amber-500/15 text-amber-300 border-l border-amber-400/20">
                  Jumlah (Rp)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 text-xs">
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-zinc-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400/80">
                        <Search className="w-5 h-5" />
                      </div>
                      <p className="font-bold text-zinc-100">Tidak ada transaksi yang cocok</p>
                      <p className="text-[11px] text-zinc-400">Coba ubah kata kunci pencarian atau filter tipe kas.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx) => {
                  const isMasuk = tx.type === 'Masuk';
                  return (
                    <tr
                      key={tx.id}
                      className="group odd:bg-neutral-950 even:bg-zinc-900/75 hover:bg-zinc-800/85 transition-colors duration-150"
                    >
                      <td className="py-2 px-2 sm:px-2.5 w-px align-top text-zinc-300 font-mono tabular-nums text-[11px] whitespace-nowrap tracking-wide">
                        {formatDateIndo(tx.date)}
                      </td>
                      <td className="py-2 px-2 sm:px-2.5 w-px align-top whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-bold ${
                            isMasuk
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
                              : 'bg-rose-500/15 text-rose-300 border border-rose-400/30'
                          }`}
                        >
                          {isMasuk ? (
                            <ArrowDownLeft className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3 text-rose-400" />
                          )}
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-2 px-2 sm:px-2.5 w-px align-top whitespace-nowrap">
                        <span className="text-[11px] font-semibold text-emerald-400 tracking-wide">
                          {tx.category}
                        </span>
                      </td>
                      <td
                        className="py-2 px-2.5 sm:px-3 align-top text-zinc-100 font-medium tracking-[0.01em] whitespace-pre-wrap break-words leading-relaxed min-w-[200px]"
                        title={tx.description}
                      >
                        {highlightText(tx.description, searchTerm)}
                      </td>
                      <td
                        className={`py-2 px-2.5 sm:px-3 w-px align-top text-right whitespace-nowrap font-bold font-mono tabular-nums text-xs sm:text-sm bg-amber-500/[0.08] group-hover:bg-amber-500/15 border-l border-amber-400/15 transition-colors duration-150 ${
                          isMasuk ? 'text-amber-300' : 'text-rose-300'
                        }`}
                      >
                        <span className={isMasuk ? 'text-amber-400/90' : 'text-rose-400/90'}>
                          {isMasuk ? '+' : '-'}
                        </span>{' '}
                        {formatSimpleRupiah(tx.amount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Clean Modern Black Summary & Pagination Footer */}
        <div className="px-5 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-zinc-800 bg-black text-xs">
          <span className="text-zinc-400 font-medium tabular-nums">
            Menampilkan <span className="font-bold text-white">{paginatedTransactions.length}</span> dari <span className="font-bold text-white">{filteredTransactions.length}</span> total transaksi
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Halaman sebelumnya"
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
              <span>Hal.</span>
              <select
                value={currentPage}
                onChange={(e) => setCurrentPage(Number(e.target.value))}
                aria-label="Pilih halaman"
                className="bg-zinc-950 text-emerald-300 font-bold font-mono tabular-nums px-1.5 py-0.5 rounded border border-zinc-700 focus:outline-none focus:border-emerald-400 cursor-pointer"
              >
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                  <option key={pg} value={pg} className="bg-zinc-950 text-white">
                    {pg}
                  </option>
                ))}
              </select>
              <span className="font-mono tabular-nums text-zinc-400">/ {totalPages}</span>
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Halaman berikutnya"
              aria-label="Halaman berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
        );
      })()}

      {/* Subtab 2: Setoran Kas Warga / Transaksi Iuran */}
      {activeSubTab === 'iuran-warga' && (
        <div className="animate-in fade-in duration-200">
          <TransaksiIuranSection
            transactions={transactions}
            connectionStatus={connectionStatus}
            onTriggerToast={onTriggerToast || (() => {})}
            onRefreshTransactions={onRefresh}
            categories={categories}
            refreshTrigger={iuranRefreshTrigger}
            onLoadingChange={setIsIuranRefreshing}
          />
        </div>
      )}
    </div>
  );
};
