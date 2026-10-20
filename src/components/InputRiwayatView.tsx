import React, { useState, useMemo, useEffect } from 'react';
import { 
  Check, 
  Loader2, 
  Wallet, 
  CreditCard, 
  ShieldCheck, 
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
  Users,
  Coins,
  ReceiptText,
  ShieldAlert
} from 'lucide-react';
import { Transaction, TransactionType, CategoryItem, SupabaseConnectionStatus } from '../types';
import { CATEGORIES_BY_TYPE, INITIAL_CATEGORIES, SUSUNAN_PENGURUS_RT, formatSimpleRupiah, formatDateIndo } from '../data/initialData';
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
  // Navigation Subtab State: Entri Kas Umum vs Setoran Iuran Warga
  const [activeSubTab, setActiveSubTab] = useState<'kas-umum' | 'iuran-warga'>('kas-umum');

  // Form States
  const { wilayahShort, wilayahLabel } = useSekretariat();
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

  // Deskripsi dinamis sesuai jenis & kategori yang dipilih untuk placeholder keterangan
  const selectedCategoryDescription = useMemo(() => {
    // 1. Cek dari daftar kategori props (database / custom)
    if (categories && categories.length > 0) {
      const matchExact = categories.find((c) => c.name === category && c.type === type);
      if (matchExact && matchExact.description && matchExact.description.trim()) {
        return matchExact.description.trim();
      }
      const matchName = categories.find((c) => c.name === category);
      if (matchName && matchName.description && matchName.description.trim()) {
        return matchName.description.trim();
      }
    }

    // 2. Cek dari INITIAL_CATEGORIES
    const initialExact = INITIAL_CATEGORIES.find((c) => c.name === category && c.type === type);
    if (initialExact && initialExact.description && initialExact.description.trim()) {
      return initialExact.description.trim();
    }
    const initialName = INITIAL_CATEGORIES.find((c) => c.name === category);
    if (initialName && initialName.description && initialName.description.trim()) {
      return initialName.description.trim();
    }

    // 3. Fallback jika kategori belum memiliki deskripsi spesifik
    return `Keterangan transaksi ${category} (${type === 'Masuk' ? 'Kas Masuk' : 'Kas Keluar'})`;
  }, [category, type, categories]);

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
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-full border border-emerald-300/80 shadow-2xs">
              Kas {wilayahShort}
            </span>
            <span className="text-xs font-medium text-slate-500 hidden sm:inline">• {wilayahLabel}</span>
          </div>
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

      {/* Subtab Navigation Bar: Entri Kas Umum vs Setoran Iuran Warga */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveSubTab('kas-umum')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === 'kas-umum'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20 ring-1 ring-emerald-500/30 font-extrabold'
              : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/60'
          }`}
        >
          <ReceiptText className={`w-3.5 h-3.5 transition-transform ${activeSubTab === 'kas-umum' ? 'text-emerald-100 scale-110' : 'text-slate-500'}`} />
          <span>1. Entri Kas Umum & Riwayat</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('iuran-warga')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === 'iuran-warga'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-1 ring-indigo-500/30 font-extrabold'
              : 'text-slate-600 hover:text-indigo-700 hover:bg-indigo-50/60'
          }`}
        >
          <Coins className={`w-3.5 h-3.5 transition-transform ${activeSubTab === 'iuran-warga' ? 'text-indigo-100 scale-110' : 'text-slate-500'}`} />
          <span>2. Setoran Iuran Warga</span>
        </button>
      </div>

      {/* Subtab 1: Entri Kas Umum & Riwayat */}
      {activeSubTab === 'kas-umum' && (
        <div className="space-y-4 sm:space-y-5 lg:space-y-6 animate-in fade-in duration-200">
          {/* Main Grid: Form & Quick Summary/Tips */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Form Section */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-4.5 sm:p-6 shadow-sm border border-slate-200 relative overflow-hidden">
          {/* Top accent gradient bar */}
          <div
            className={`absolute top-0 left-0 right-0 h-1.5 transition-all duration-300 ${
              type === 'Masuk'
                ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500'
                : 'bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500'
            }`}
          />

          {/* Subtle decorative glow */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-emerald-50 via-transparent to-transparent rounded-bl-full pointer-events-none" />

          {/* Form Header */}
          <div className="flex items-center justify-between mb-4 relative">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center text-white shadow-sm ring-1 ring-slate-800">
                <CreditCard className="w-4 h-4 text-emerald-400 shrink-0" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  Form Entri Kas {wilayahShort}
                </h2>
                <p className="text-[11px] text-slate-500">
                  Catat mutasi penerimaan atau pengeluaran kas
                </p>
              </div>
            </div>

            <span className="px-2.5 py-0.5 bg-emerald-50 rounded-full text-[11px] font-semibold text-emerald-700 flex items-center gap-1.5 border border-emerald-200/80 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Sinkron
            </span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 sm:gap-4 relative">
            {/* Segmented Type Toggle (Masuk vs Keluar) */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">
                Tipe Aliran Dana <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/90 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleTypeChange('Masuk')}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    type === 'Masuk'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/25 border-transparent'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <ArrowDownLeft className={`w-3.5 h-3.5 ${type === 'Masuk' ? 'text-emerald-100' : 'text-slate-400'}`} />
                  <span>Kas Masuk (Pemasukan)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('Keluar')}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    type === 'Keluar'
                      ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md shadow-rose-600/25 border-transparent'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <ArrowUpRight className={`w-3.5 h-3.5 ${type === 'Keluar' ? 'text-rose-100' : 'text-slate-400'}`} />
                  <span>Kas Keluar (Pengeluaran)</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tanggal */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Tanggal Transaksi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-400/30 border border-slate-200 focus:border-slate-400 transition-all text-xs font-medium"
                />
              </div>

              {/* Kategori */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Kategori Anggaran <span className="text-rose-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  disabled={activeCategoryList.length === 0}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-400/30 border border-slate-200 focus:border-slate-400 transition-all text-xs font-medium cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {activeCategoryList.length === 0 ? (
                    <option value="">-- (Kosong) Tidak Ada Kategori di Supabase --</option>
                  ) : (
                    activeCategoryList.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))
                  )}
                </select>
                {activeCategoryList.length === 0 && (
                  <p className="text-[11px] text-amber-700 font-medium mt-1 flex items-center gap-1.5 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Tabel kategori di Supabase masih kosong. Silakan tambahkan kategori di menu <b>Kelola Kategori</b>.</span>
                  </p>
                )}
              </div>
            </div>

            {/* Jumlah (Rp) & Quick Preset Pills */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>
                  Jumlah Transaksi (Nominal) <span className="text-rose-500">*</span>
                </span>
                {rawAmount && (
                  <span className="text-[11px] font-semibold text-emerald-700">
                    Rp {rawAmount}
                  </span>
                )}
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-slate-400 text-xs font-bold pointer-events-none">
                  Rp
                </span>
                <input
                  type="text"
                  required
                  placeholder="0"
                  value={rawAmount}
                  onChange={handleAmountChange}
                  className="w-full pl-11 pr-3.5 py-2.5 rounded-xl bg-slate-50 text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-400/30 border border-slate-200 focus:border-slate-400 transition-all text-sm font-bold tracking-wide"
                />
              </div>

              {/* Quick Nominal Presets */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] font-medium text-slate-400 flex items-center gap-0.5">
                  <Sparkles className="w-3 h-3 text-amber-500" /> Cepat:
                </span>
                {quickPresets.map((nominal) => (
                  <button
                    key={nominal}
                    type="button"
                    onClick={() => handlePresetAmount(nominal)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-200/80"
                  >
                    +{nominal.toLocaleString('id-ID')}
                  </button>
                ))}
              </div>
            </div>

            {/* Keterangan */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span>Keterangan / Uraian Transaksi</span>
                  <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  {selectedCategoryDescription && (
                    <button
                      type="button"
                      onClick={() => setDescription(selectedCategoryDescription)}
                      className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer flex items-center gap-1 transition-colors"
                      title="Gunakan deskripsi kategori ini sebagai isi keterangan"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-500" />
                      <span>Gunakan Deskripsi Kategori</span>
                    </button>
                  )}
                  <span className="text-[11px] font-normal text-slate-400 hidden sm:inline">
                    Bebas karakter
                  </span>
                </div>
              </div>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={selectedCategoryDescription}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-400/30 border border-slate-200 focus:border-slate-400 transition-all text-xs resize-y min-h-[90px] leading-relaxed placeholder:text-slate-400"
              />
              {selectedCategoryDescription && (
                <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50/80 px-3 py-1.5 rounded-lg border border-slate-200/60">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-semibold text-slate-600 shrink-0">Deskripsi Kategori:</span>
                    <span className="text-slate-500 truncate" title={selectedCategoryDescription}>
                      {selectedCategoryDescription}
                    </span>
                  </div>
                  {!description && (
                    <button
                      type="button"
                      onClick={() => setDescription(selectedCategoryDescription)}
                      className="text-emerald-700 hover:text-emerald-800 font-bold shrink-0 cursor-pointer ml-2 hover:underline text-[11px]"
                    >
                      Pakai Teks Ini
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Action Submit */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 gap-3 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Tersimpan otomatis ke database <code className="font-mono font-bold text-slate-800">kas_rt</code></span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 hover:from-slate-800 hover:to-indigo-900 text-white text-xs font-bold transition-all shadow-md shadow-slate-900/20 hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer active:scale-98 ring-1 ring-slate-700/50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" />
                ) : (
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <span>{isSubmitting ? 'Menyimpan ke Supabase...' : 'Simpan Transaksi'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Quick Stats / Instruction Panel */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Ringkasan Bulan Ini Card - Executive Luxury Gradient */}
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white rounded-2xl p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden shadow-xl border border-slate-700/80 ring-1 ring-emerald-500/20">
            {/* Ambient soft glow */}
            <div className="absolute -right-8 -bottom-8 w-60 h-60 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-8 -top-8 w-44 h-44 bg-teal-500/15 rounded-full blur-2xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse ring-4 ring-emerald-400/20" />
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                    Rekap Kas Bulan Berjalan
                  </span>
                </div>
                <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/15 shadow-inner">
                  <BarChart2 className="w-4 h-4 text-emerald-300 shrink-0" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 shadow-xs hover:border-emerald-500/30 transition-colors">
                  <span className="text-[11px] text-slate-300 font-medium">Total Kas Masuk</span>
                  <div className="text-lg sm:text-xl font-extrabold text-emerald-300 mt-1 tracking-tight">
                    {formatSimpleRupiah(currentMonthMasuk)}
                  </div>
                  <span className="text-[10px] text-emerald-200/90 flex items-center gap-1 mt-1.5 font-semibold">
                    <TrendingUp className="w-3 h-3 shrink-0" />
                    {countMasuk} penerimaan
                  </span>
                </div>

                <div className="p-4 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 shadow-xs hover:border-rose-500/30 transition-colors">
                  <span className="text-[11px] text-slate-300 font-medium">Total Kas Keluar</span>
                  <div className="text-lg sm:text-xl font-extrabold text-rose-300 mt-1 tracking-tight">
                    {formatSimpleRupiah(currentMonthKeluar)}
                  </div>
                  <span className="text-[10px] text-rose-200/90 flex items-center gap-1 mt-1.5 font-semibold">
                    <TrendingDown className="w-3 h-3 shrink-0" />
                    {countKeluar} pengeluaran
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/15 flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">Sisa Kas Berjalan:</span>
              <span className={`font-extrabold text-base sm:text-lg tracking-tight ${sisaAnggaran >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {formatSimpleRupiah(sisaAnggaran)}
              </span>
            </div>
          </div>

          {/* Panduan Pengisian Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col gap-3 flex-1 justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
                  <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Pedoman Entri Kas {wilayahShort}
                  </h3>
                  <p className="text-[11px] text-slate-500">Standar transparansi buku kas warga</p>
                </div>
              </div>
              <ul className="flex flex-col gap-2 text-xs text-slate-600 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                  <span>Sertakan nama warga atau nomor rumah pada kolom keterangan iuran.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                  <span>Pilih kategori yang tepat agar grafik dan laporan bulanan akurat.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                  <span>Data yang salah diinput dapat diperbaiki sewaktu-waktu di menu <strong>Koreksi & Hapus</strong>.</span>
                </li>
              </ul>

              {/* Susunan Pengurus {wilayahShort} */}
              <div className="mt-3.5 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span>Susunan Pengurus {wilayahShort}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">10 Bidang</span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10.5px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
                  {SUSUNAN_PENGURUS_RT.map((p) => (
                    <div key={p.no} className="truncate" title={`${p.label}: ${p.deskripsi}`}>
                      <span className="font-semibold text-slate-800">{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
              <span>Status Sistem: Siap</span>
              <span className="font-semibold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Terverifikasi
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Riwayat Transaksi Terbaru
              </h2>
              <span className="px-2.5 py-0.5 text-[11px] font-bold bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                {filteredTransactions.length} Data
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Daftar pencatatan mutasi kas warga yang tersimpan
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Search Input with Scope Selector & Clear Button */}
            <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
              {/* Toggle Scope: Semua vs Khusus Keterangan/Uraian */}
              <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setSearchScope('all');
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    searchScope === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
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
                  className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    searchScope === 'keterangan'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-emerald-700'
                  }`}
                  title="Khusus memfilter berdasarkan keterangan atau uraian transaksi"
                >
                  <span>Keterangan</span>
                  <span className="text-[9px] bg-emerald-800/40 px-1 py-0.2 rounded font-semibold hidden sm:inline">Uraian</span>
                </button>
              </div>

              {/* Input Pencarian */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
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
                  className="pl-9 pr-8 py-2 rounded-xl bg-slate-50 text-slate-900 outline-none text-xs w-full sm:w-64 border border-slate-200 focus:bg-white focus:border-slate-400 transition-all font-medium"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    title="Hapus pencarian"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Pill Toggle */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setTableFilterType('All');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  tableFilterType === 'All'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
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
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  tableFilterType === 'Masuk'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
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
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  tableFilterType === 'Keluar'
                    ? 'bg-white text-rose-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Keluar ({countKeluar})
              </button>
            </div>

            {/* Refresh from Supabase Button */}
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
                title="Segarkan data dari Supabase (kas_rt)"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
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
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 hover:from-slate-800 hover:to-indigo-900 text-white font-semibold text-xs transition-all cursor-pointer shadow-sm hover:shadow active:scale-98 ring-1 ring-slate-700/50"
                title="Ekspor & Unduh Data (.xlsx, PDF, CSV, JSON)"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Ekspor Data</span>
              </button>
            )}

            {/* Import Data Button */}
            {onOpenImport && (
              <button
                type="button"
                onClick={onOpenImport}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-xs transition-all cursor-pointer shadow-sm shadow-emerald-600/20 hover:shadow-md active:scale-98"
                title="Import Data Kas dari File Excel (.xlsx, .xls, .csv)"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-100" />
                <span className="hidden sm:inline">Import Data</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Search Chips Bar khusus pencarian Keterangan / Uraian */}
        <div className="px-5 py-2.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Search className="w-3 h-3 text-slate-400" />
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
                className={`px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer border ${
                  searchTerm === kw && searchScope === 'keterangan'
                    ? 'bg-emerald-700 text-white font-bold border-emerald-700 shadow-2xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                }`}
              >
                {kw}
              </button>
            ))}
          </div>

          {searchTerm && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                {filteredTransactions.length} hasil ditemukan
              </span>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Bersihkan
              </button>
            </div>
          )}
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200">
                <th className="py-2.5 px-3.5 sm:px-4">Tanggal</th>
                <th className="py-2.5 px-3.5 sm:px-4">Jenis</th>
                <th className="py-2.5 px-3.5 sm:px-4">Kategori</th>
                <th className="py-2.5 px-3.5 sm:px-4">Keterangan</th>
                <th className="py-2.5 px-3.5 sm:px-4 text-right">Jumlah</th>
                <th className="py-2.5 px-3.5 sm:px-4 text-center">Status DB</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Search className="w-4 h-4" />
                      </div>
                      <p className="font-semibold text-slate-800">Tidak ada transaksi yang cocok</p>
                      <p className="text-[11px] text-slate-400">Coba ubah kata kunci pencarian atau filter tipe kas.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx) => {
                  const isMasuk = tx.type === 'Masuk';
                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-2.5 px-3.5 sm:px-4 text-slate-900 whitespace-nowrap font-medium">
                        {formatDateIndo(tx.date)}
                      </td>
                      <td className="py-2.5 px-3.5 sm:px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            isMasuk
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                              : 'bg-rose-50 text-rose-800 border border-rose-200/80'
                          }`}
                        >
                          {isMasuk ? (
                            <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3 text-rose-600" />
                          )}
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 sm:px-4 text-slate-900 whitespace-nowrap font-semibold">
                        {tx.category}
                      </td>
                      <td
                        className="py-2.5 px-3.5 sm:px-4 text-slate-600 max-w-xs sm:max-w-md truncate"
                        title={tx.description}
                      >
                        {highlightText(tx.description, searchTerm)}
                      </td>
                      <td
                        className={`py-2.5 px-3.5 sm:px-4 text-right whitespace-nowrap font-bold text-xs sm:text-sm ${
                          isMasuk ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {isMasuk ? '+ ' : '- '}
                        {formatSimpleRupiah(tx.amount)}
                      </td>
                      <td className="py-2.5 px-3.5 sm:px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 text-[11px] font-semibold bg-emerald-50/80 px-2 py-0.5 rounded-md border border-emerald-200/60">
                          {tx.status === 'Syncing' ? (
                            <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          )}
                          {tx.status || 'Synced'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 bg-slate-50/50">
          <span className="text-xs text-slate-500">
            Menampilkan {paginatedTransactions.length} dari {filteredTransactions.length} total transaksi
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer shadow-2xs"
            >
              Sebelumnya
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
              <button
                key={pg}
                onClick={() => setCurrentPage(pg)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  currentPage === pg
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {pg}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer shadow-2xs"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>
    </div>
  )}

      {/* Subtab 2: Setoran Kas Warga / Transaksi Iuran */}
      {activeSubTab === 'iuran-warga' && (
        <div className="animate-in fade-in duration-200">
          <TransaksiIuranSection
            connectionStatus={connectionStatus}
            onTriggerToast={onTriggerToast || (() => {})}
            onRefreshTransactions={onRefresh}
            categories={categories}
          />
        </div>
      )}
    </div>
  );
};
