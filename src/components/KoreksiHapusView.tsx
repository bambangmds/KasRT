import React, { useState, useEffect, useMemo } from 'react';
import { 
  Pencil, 
  Trash2, 
  Check, 
  Loader2, 
  X, 
  RefreshCw, 
  Download, 
  Upload,
  Search, 
  CheckCircle2, 
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  Calendar,
  Sparkles
} from 'lucide-react';
import { Transaction, TransactionType, CategoryItem } from '../types';
import { CATEGORIES_BY_TYPE, INITIAL_CATEGORIES, formatSimpleRupiah, formatDateIndo } from '../data/initialData';

interface KoreksiHapusViewProps {
  transactions: Transaction[];
  categories?: CategoryItem[];
  onUpdateTransaction: (updatedTx: Transaction) => Promise<boolean | void> | void;
  onDeleteTransaction: (id: string) => Promise<boolean | void> | void;
  onExport: (filteredData?: Transaction[], filterLabel?: string) => void;
  onOpenImport?: () => void;
  onRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean;
}

export const KoreksiHapusView: React.FC<KoreksiHapusViewProps> = ({
  transactions,
  categories,
  onUpdateTransaction,
  onDeleteTransaction,
  onExport,
  onOpenImport,
  onRefresh,
  isRefreshing = false,
}) => {
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [searchScope, setSearchScope] = useState<'all' | 'keterangan'>('all');
  const [filterType, setFilterType] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [isAutoFixing, setIsAutoFixing] = useState(false);

  // Deteksi transaksi iuran yang nama bulannya di kolom keterangan berbeda dengan tanggal catat
  const MONTH_MAP: Record<string, string> = {
    januari: '01', jan: '01',
    februari: '02', feb: '02',
    maret: '03', mar: '03',
    april: '04', apr: '04',
    mei: '05',
    juni: '06', jun: '06',
    juli: '07', jul: '07',
    agustus: '08', agu: '08', agt: '08',
    september: '09', sep: '09',
    oktober: '10', okt: '10',
    november: '11', nov: '11',
    desember: '12', des: '12',
  };

  const misalignedTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (!tx.description || !tx.date) return false;
      const desc = tx.description.toLowerCase();
      const monthMatch = desc.match(/bulan\s+([a-z]+|\d{1,2})/i);
      const yearMatch = desc.match(/(202\d)/);

      if (monthMatch && monthMatch[1]) {
        const rawMonth = monthMatch[1].toLowerCase();
        const targetMonthCode =
          MONTH_MAP[rawMonth] ||
          (parseInt(rawMonth, 10) >= 1 && parseInt(rawMonth, 10) <= 12
            ? String(parseInt(rawMonth, 10)).padStart(2, '0')
            : null);

        const targetYear = yearMatch ? yearMatch[1] : tx.date.split('-')[0];
        const [currentYear, currentMonth] = tx.date.split('-');

        if (
          targetMonthCode &&
          (currentMonth !== targetMonthCode || (yearMatch && currentYear !== targetYear))
        ) {
          return true;
        }
      }
      return false;
    });
  }, [transactions]);

  const handleAutoFixMisalignedDates = async () => {
    if (misalignedTransactions.length === 0) return;
    setIsAutoFixing(true);
    let fixedCount = 0;

    try {
      for (const tx of misalignedTransactions) {
        const desc = (tx.description || '').toLowerCase();
        const monthMatch = desc.match(/bulan\s+([a-z]+|\d{1,2})/i);
        const yearMatch = desc.match(/(202\d)/);

        if (monthMatch && monthMatch[1]) {
          const rawMonth = monthMatch[1].toLowerCase();
          const targetMonthCode =
            MONTH_MAP[rawMonth] ||
            (parseInt(rawMonth, 10) >= 1 && parseInt(rawMonth, 10) <= 12
              ? String(parseInt(rawMonth, 10)).padStart(2, '0')
              : '01');
          const targetYear = yearMatch ? yearMatch[1] : tx.date.split('-')[0];
          const fixedDate = `${targetYear}-${targetMonthCode}-10`;

          await onUpdateTransaction({
            ...tx,
            date: fixedDate,
            status: 'Synced',
          });
          fixedCount++;
        }
      }
      if (onRefresh) {
        await onRefresh();
      }
    } finally {
      setIsAutoFixing(false);
    }
  };

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

  // Preset pencarian cepat keterangan / uraian
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

  // Daftar lengkap kategori dinamis untuk dropdown filter
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    if (categories && categories.length > 0) {
      categories.forEach((c) => cats.add(c.name));
    }
    transactions.forEach((tx) => {
      if (tx.category) cats.add(tx.category);
    });
    return Array.from(cats).sort();
  }, [transactions, categories]);

  // Auto-fetch data terbaru dari tabel 'kas_rt' saat halaman Koreksi dibuka
  useEffect(() => {
    if (onRefresh) {
      onRefresh();
    }
  }, []);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Edit Modal State
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editType, setEditType] = useState<TransactionType>('Masuk');
  const [editCategory, setEditCategory] = useState('');
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDesc, setEditDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Daftar opsi kategori untuk modal edit sesuai editType
  const editCategoriesList = useMemo(() => {
    if (categories) {
      const filtered = categories.filter((c) => c.type === editType);
      return filtered.map((c) => ({ value: c.name, label: c.name }));
    }
    return [];
  }, [categories, editType]);

  // Deskripsi kategori terpilih pada modal edit
  const editCategoryDescription = useMemo(() => {
    if (categories && categories.length > 0) {
      const matchExact = categories.find((c) => c.name === editCategory && c.type === editType);
      if (matchExact && matchExact.description && matchExact.description.trim()) {
        return matchExact.description.trim();
      }
      const matchName = categories.find((c) => c.name === editCategory);
      if (matchName && matchName.description && matchName.description.trim()) {
        return matchName.description.trim();
      }
    }

    const initialExact = INITIAL_CATEGORIES.find((c) => c.name === editCategory && c.type === editType);
    if (initialExact && initialExact.description && initialExact.description.trim()) {
      return initialExact.description.trim();
    }
    const initialName = INITIAL_CATEGORIES.find((c) => c.name === editCategory);
    if (initialName && initialName.description && initialName.description.trim()) {
      return initialName.description.trim();
    }

    return `Keterangan transaksi ${editCategory} (${editType === 'Masuk' ? 'Kas Masuk' : 'Kas Keluar'})`;
  }, [editCategory, editType, categories]);

  // Delete Modal State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Open Edit Modal
  const openEditModal = (tx: Transaction) => {
    setEditingTx(tx);
    setEditDate(tx.date);
    setEditType(tx.type);
    setEditCategory(tx.category);
    setEditAmount(tx.amount);
    setEditDesc(tx.description);
  };

  const closeEditModal = () => {
    setEditingTx(null);
    setIsSaving(false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;

    setIsSaving(true);
    try {
      await onUpdateTransaction({
        ...editingTx,
        date: editDate,
        type: editType,
        category: editCategory,
        amount: Number(editAmount),
        description: editDesc.trim(),
        status: 'Synced',
      });
      closeEditModal();
      if (onRefresh) {
        await onRefresh();
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Open Delete Modal
  const openDeleteModal = (id: string) => {
    setDeletingId(id);
  };

  const closeDeleteModal = () => {
    setDeletingId(null);
    setIsDeleting(false);
  };

  const handleConfirmDelete = async () => {
    if (deletingId) {
      setIsDeleting(true);
      try {
        await onDeleteTransaction(deletingId);
        closeDeleteModal();
        if (onRefresh) {
          await onRefresh();
        }
      } finally {
        setIsDeleting(false);
      }
    }
  };

  // Filter logic (Mendukung pencarian keterangan/uraian secara spesifik)
  const filtered = transactions.filter((tx) => {
    const term = searchTerm.toLowerCase().trim();
    let matchSearch = true;

    if (term) {
      if (searchScope === 'keterangan') {
        matchSearch = (tx.description || '').toLowerCase().includes(term);
      } else {
        matchSearch =
          (tx.id || '').toLowerCase().includes(term) ||
          (tx.description || '').toLowerCase().includes(term) ||
          (tx.category || '').toLowerCase().includes(term);
      }
    }

    const matchType = !filterType || tx.type === filterType;
    const matchCat = !filterCategory || tx.category === filterCategory;
    const matchDate = !filterDate || tx.date === filterDate;

    return matchSearch && matchType && matchCat && matchDate;
  });

  const totalPages =
    itemsPerPage === 0 ? 1 : Math.ceil(filtered.length / itemsPerPage) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginated =
    itemsPerPage === 0
      ? filtered
      : filtered.slice(
          (safeCurrentPage - 1) * itemsPerPage,
          safeCurrentPage * itemsPerPage
        );

  // Filtered totals for table summary bar
  const filteredMasukNominal = useMemo(
    () =>
      filtered
        .filter((t) => t.type === 'Masuk')
        .reduce((acc, curr) => acc + curr.amount, 0),
    [filtered]
  );

  const filteredKeluarNominal = useMemo(
    () =>
      filtered
        .filter((t) => t.type === 'Keluar')
        .reduce((acc, curr) => acc + curr.amount, 0),
    [filtered]
  );

  // Quick stats
  const totalMasukNominal = transactions
    .filter((t) => t.type === 'Masuk')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalKeluarNominal = transactions
    .filter((t) => t.type === 'Keluar')
    .reduce((acc, curr) => acc + curr.amount, 0);

  // Smart pagination page numbers (supports many pages cleanly without overflow)
  const visiblePageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = [1];
    const start = Math.max(2, safeCurrentPage - 1);
    const end = Math.min(totalPages - 1, safeCurrentPage + 1);
    if (start > 2) pages.push('ellipsis-start');
    for (let p = start; p <= end; p++) pages.push(p);
    if (end < totalPages - 1) pages.push('ellipsis-end');
    pages.push(totalPages);
    return pages;
  }, [totalPages, safeCurrentPage]);

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Top Section / Title & Action Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          Koreksi & Hapus Data Transaksi
        </h1>

        <div className="flex items-center gap-2 flex-nowrap shrink-0 overflow-x-auto max-w-full">
          {onRefresh && (
            <button
              type="button"
              onClick={() => onRefresh()}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200 transition-all shadow-2xs cursor-pointer disabled:opacity-50 active:scale-98 whitespace-nowrap shrink-0"
              title="Tarik data terbaru dari Supabase (kas_rt)"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-600 shrink-0 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Menyinkronkan...' : 'Segarkan Data'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const hasFilter = Boolean(searchTerm.trim() || filterType || filterCategory || filterDate);
              const label = hasFilter ? `Filter Koreksi (${filtered.length} Data)` : undefined;
              onExport(filtered, label);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 hover:from-slate-800 hover:to-indigo-900 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm ring-1 ring-slate-700/50 cursor-pointer active:scale-98 whitespace-nowrap shrink-0"
            title="Ekspor & Unduh Data (.xlsx, PDF, CSV, JSON)"
          >
            <Download className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Ekspor Data</span>
          </button>

          {onOpenImport && (
            <button
              type="button"
              onClick={onOpenImport}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm shadow-emerald-600/20 hover:shadow-md cursor-pointer active:scale-98 whitespace-nowrap shrink-0"
              title="Import Data Kas dari File Excel (.xlsx, .xls, .csv)"
            >
              <Upload className="w-4 h-4 text-emerald-100 shrink-0" />
              <span>Import Data</span>
            </button>
          )}
        </div>
      </div>

      {/* Alert Banner: Deteksi Tanggal Tidak Sinkron dengan Keterangan Bulan */}
      {misalignedTransactions.length > 0 && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-amber-950 text-sm">
                Ditemukan {misalignedTransactions.length} Transaksi dengan Tanggal Belum Sinkron
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Terdapat catatan kas yang keterangan bulannya (contoh: Bulan Januari s/d Agustus) tersimpan di tanggal lain (September).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAutoFixMisalignedDates}
            disabled={isAutoFixing}
            className="w-full sm:w-auto px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
          >
            {isAutoFixing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyinkronkan Tanggal...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Perbaiki Tanggal Otomatis (1-Klik)</span>
              </>
            )}
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* TOTAL SELURUH CATATAN - Royal Indigo */}
        <div className="p-4.5 bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 text-white rounded-2xl border border-indigo-700/80 shadow-md flex items-center justify-between group hover:shadow-lg transition-all">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">Total Seluruh Catatan</span>
            <div className="text-xl font-extrabold text-white mt-1">
              {transactions.length} <span className="text-xs font-semibold text-indigo-200 font-sans">Transaksi</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-600/50 text-indigo-100 border border-indigo-400/30 flex items-center justify-center shadow-xs shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        {/* KAS MASUK TERCATAT - Emerald Green */}
        <div className="p-4.5 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 text-white rounded-2xl border border-emerald-700/80 shadow-md flex items-center justify-between group hover:shadow-lg transition-all">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-200">Kas Masuk Tercatat</span>
            <div className="text-xl font-extrabold text-white mt-1">
              {formatSimpleRupiah(totalMasukNominal)}
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-600/50 text-emerald-100 border border-emerald-400/30 flex items-center justify-center shadow-xs shrink-0">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        {/* KAS KELUAR TERCATAT - Warm Rose / Pink */}
        <div className="p-4.5 bg-gradient-to-br from-rose-950 via-rose-900 to-slate-900 text-white rounded-2xl border border-rose-700/80 shadow-md flex items-center justify-between group hover:shadow-lg transition-all">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-200">Kas Keluar Tercatat</span>
            <div className="text-xl font-extrabold text-white mt-1">
              {formatSimpleRupiah(totalKeluarNominal)}
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-600/50 text-rose-100 border border-rose-400/30 flex items-center justify-center shadow-xs shrink-0">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-3">
        <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0 xl:max-w-md">
            {/* Scope selector: Semua vs Khusus Keterangan/Uraian */}
            <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSearchScope('all');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  searchScope === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Cari di semua kolom (Keterangan dan Kategori)"
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchScope('keterangan');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                  searchScope === 'keterangan'
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-emerald-700'
                }`}
                title="Khusus memfilter berdasarkan uraian atau keterangan transaksi"
              >
                <span>Keterangan</span>
                <span className="text-[10px] bg-emerald-800/40 px-1 py-0.2 rounded font-semibold hidden sm:inline">Uraian</span>
              </button>
            </div>

            {/* Input Pencarian dengan warna abu-abu tebal (bg-slate-800 border-slate-700) */}
            <div className="relative flex-1 min-w-[160px] bg-slate-800 border border-slate-700 p-0.5 rounded-xl">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
              <input
                type="text"
                placeholder={
                  searchScope === 'keterangan'
                    ? 'Cari keterangan/uraian transaksi (cth: lampu, iuran, rapat)...'
                    : 'Cari kategori atau keterangan...'
                }
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-8 py-2 bg-slate-800 rounded-lg text-xs sm:text-sm text-white placeholder-slate-300 outline-none font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white cursor-pointer"
                  title="Hapus pencarian"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 flex-wrap xl:flex-nowrap flex-1">
            {/* Tipe Filter Pill */}
            <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setFilterType('');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  filterType === ''
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Tipe
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterType('Masuk');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  filterType === 'Masuk'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterType('Keluar');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  filterType === 'Keluar'
                    ? 'bg-white text-rose-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Keluar
              </button>
            </div>

            <input
              type="date"
              value={filterDate}
              onChange={(e) => {
                setFilterDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 border border-slate-200 focus:border-slate-400 font-medium shrink-0"
            />

            {(searchTerm || filterType || filterCategory || filterDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setFilterType('');
                  setFilterCategory('');
                  setFilterDate('');
                  setCurrentPage(1);
                }}
                className="px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer border border-rose-200 whitespace-nowrap shrink-0"
              >
                Reset Filter
              </button>
            )}

            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="ml-auto sm:ml-0 px-3 py-2 bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 border border-slate-200 focus:border-slate-400 cursor-pointer font-medium max-w-[220px] shrink-0"
            >
              <option value="">Semua Kategori</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Keterangan/Uraian Chips Bar */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Search className="w-3 h-3 text-slate-400" />
              <span>Cari Uraian Cepat:</span>
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
                className={`px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer border ${
                  searchTerm === kw && searchScope === 'keterangan'
                    ? 'bg-emerald-700 text-white font-bold border-emerald-700 shadow-2xs'
                    : 'bg-slate-100/80 text-slate-700 hover:bg-slate-200/80 border-slate-200'
                }`}
              >
                {kw}
              </button>
            ))}
          </div>

          {searchTerm && (
            <span className="text-[11px] font-semibold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
              {filtered.length} data ditemukan
            </span>
          )}
        </div>
      </div>

      {/* Transactions Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-indigo-200/70 overflow-hidden">
        {/* Table Top Summary Bar */}
        <div className="px-4 py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-200">
            <span className="font-bold text-white tracking-tight text-sm">
              Daftar Transaksi Kas
            </span>
            <span aria-hidden="true" className="text-indigo-400">·</span>
            <span className="font-mono tabular-nums text-indigo-200 font-semibold">
              {filtered.length} catatan
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap text-[11px] font-mono tabular-nums">
            <span className="text-emerald-300 font-semibold">
              Masuk: {formatSimpleRupiah(filteredMasukNominal)}
            </span>
            <span aria-hidden="true" className="text-slate-600">|</span>
            <span className="text-rose-300 font-semibold">
              Keluar: {formatSimpleRupiah(filteredKeluarNominal)}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b-2 border-indigo-500/40 text-[11px] tracking-wide text-indigo-100 font-semibold">
                <th className="py-2.5 px-2.5 text-center w-[1%] whitespace-nowrap text-indigo-300">
                  No
                </th>
                <th className="py-2.5 px-3 w-[1%] whitespace-nowrap text-slate-200">
                  Tanggal
                </th>
                <th className="py-2.5 px-2.5 text-center w-[1%] whitespace-nowrap text-slate-200">
                  Tipe
                </th>
                <th className="py-2.5 px-3 min-w-[140px] max-w-[200px] text-indigo-200">
                  Kategori
                </th>
                <th className="py-2.5 px-3 text-right w-[1%] whitespace-nowrap text-emerald-300">
                  Jumlah (Rp)
                </th>
                <th className="py-2.5 px-3 min-w-[220px] text-slate-200">
                  Keterangan
                </th>
                <th className="py-2.5 px-3 text-center w-[1%] whitespace-nowrap text-slate-200">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-xs">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 bg-slate-50/40">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500">
                        <Filter className="w-4 h-4" />
                      </div>
                      <p className="font-semibold text-slate-800 text-sm">
                        Tidak ada catatan transaksi yang sesuai
                      </p>
                      <p className="text-xs text-slate-500">
                        Periksa kembali filter atau kata kunci pencarian Anda.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((tx, idx) => {
                  const isMasuk = tx.type === 'Masuk';
                  const rowNum =
                    (itemsPerPage === 0 ? 0 : (safeCurrentPage - 1) * itemsPerPage) +
                    idx +
                    1;
                  return (
                    <tr
                      key={tx.id}
                      className={`transition-colors duration-150 ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/75'
                      } ${
                        isMasuk
                          ? 'hover:bg-emerald-50/55'
                          : 'hover:bg-rose-50/50'
                      }`}
                    >
                      {/* No */}
                      <td className="py-2.5 px-2.5 align-top text-center w-[1%] whitespace-nowrap font-mono tabular-nums text-[11px] font-bold text-indigo-600/90">
                        {String(rowNum).padStart(2, '0')}
                      </td>

                      {/* Tanggal */}
                      <td className="py-2.5 px-3 align-top w-[1%] whitespace-nowrap text-slate-700 font-medium tabular-nums">
                        {formatDateIndo(tx.date)}
                      </td>

                      {/* Tipe */}
                      <td className="py-2.5 px-2.5 align-top text-center w-[1%] whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                            isMasuk
                              ? 'bg-emerald-50/90 text-emerald-800 border-emerald-200/90'
                              : 'bg-rose-50/90 text-rose-800 border-rose-200/90'
                          }`}
                        >
                          {isMasuk ? (
                            <ArrowDownLeft className="w-3 h-3 text-emerald-600 shrink-0" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3 text-rose-600 shrink-0" />
                          )}
                          <span>{tx.type}</span>
                        </span>
                      </td>

                      {/* Kategori — otomatis turun ke bawah jika panjang */}
                      <td className="py-2.5 px-3 align-top min-w-[140px] max-w-[200px] whitespace-normal break-words leading-snug">
                        <span className="font-semibold text-slate-900 block">
                          {highlightText(tx.category, searchScope === 'all' ? searchTerm : '')}
                        </span>
                      </td>

                      {/* Jumlah (Rp) */}
                      <td className="py-2.5 px-3 align-top text-right w-[1%] whitespace-nowrap">
                        <span
                          className={`inline-block font-mono tabular-nums font-bold text-xs sm:text-[13px] px-2 py-0.5 rounded-md ${
                            isMasuk
                              ? 'bg-emerald-50/80 text-emerald-800'
                              : 'bg-rose-50/80 text-rose-700'
                          }`}
                        >
                          {isMasuk ? '+' : '-'} {formatSimpleRupiah(tx.amount)}
                        </span>
                      </td>

                      {/* Keterangan — otomatis tampil penuh turun ke bawah sesuai kebutuhan */}
                      <td className="py-2.5 px-3 align-top min-w-[220px] max-w-[380px] whitespace-normal break-words leading-relaxed text-slate-700">
                        {tx.description ? (
                          highlightText(tx.description, searchTerm)
                        ) : (
                          <span className="text-slate-400 italic">Tidak ada keterangan</span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-2.5 px-3 align-top text-center w-[1%] whitespace-nowrap">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(tx)}
                            className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 hover:border-blue-700 shadow-2xs transition-colors duration-150 cursor-pointer"
                            title="Edit Transaksi Ini"
                            aria-label="Edit Transaksi"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteModal(tx.id)}
                            className="p-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white border border-red-600 hover:border-red-700 shadow-2xs transition-colors duration-150 cursor-pointer"
                            title="Hapus Transaksi Ini"
                            aria-label="Hapus Transaksi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        <div className="px-4 py-3 bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-300 border-t border-indigo-500/30">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="tabular-nums">
              Menampilkan{' '}
              <strong className="text-white">
                {paginated.length > 0
                  ? itemsPerPage === 0
                    ? 1
                    : (safeCurrentPage - 1) * itemsPerPage + 1
                  : 0}
                -
                {itemsPerPage === 0
                  ? filtered.length
                  : Math.min(safeCurrentPage * itemsPerPage, filtered.length)}
              </strong>{' '}
              dari <strong className="text-indigo-300">{filtered.length}</strong> data transaksi
            </span>

            <div className="flex items-center gap-1.5">
              <label htmlFor="koreksi-rows-per-page" className="text-[11px] text-slate-400">
                Baris:
              </label>
              <select
                id="koreksi-rows-per-page"
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 bg-slate-800 text-white border border-slate-700 rounded-lg text-[11px] font-semibold focus:outline-none focus:border-indigo-400 cursor-pointer"
              >
                <option value={10}>10 / hal</option>
                <option value={20}>20 / hal</option>
                <option value={50}>50 / hal</option>
                <option value={0}>Semua</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={safeCurrentPage === 1}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 font-semibold text-slate-200 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer text-[11px] whitespace-nowrap"
            >
              Sebelumnya
            </button>

            {visiblePageNumbers.map((item) =>
              typeof item === 'number' ? (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCurrentPage(item)}
                  className={`min-w-[30px] px-2.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer text-[11px] tabular-nums ${
                    safeCurrentPage === item
                      ? 'bg-indigo-600 text-white shadow-xs border border-indigo-500'
                      : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {item}
                </button>
              ) : (
                <span key={item} className="px-1 text-slate-500 select-none">
                  ...
                </span>
              )
            )}

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={safeCurrentPage === totalPages}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 font-semibold text-slate-200 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer text-[11px] whitespace-nowrap"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingTx && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-emerald-400">
                  <Pencil className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">
                  Koreksi Data Transaksi
                </h3>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Tutup"
                aria-label="Tutup modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Tanggal Transaksi
                </label>
                <input
                  type="date"
                  required
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="px-4 py-2.5 bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 border border-slate-200 focus:border-slate-400 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Tipe Transaksi
                  </label>
                  <select
                    value={editType}
                    onChange={(e) => {
                      const newType = e.target.value as TransactionType;
                      setEditType(newType);
                      if (categories && categories.length > 0) {
                        const filtered = categories.filter((c) => c.type === newType);
                        if (filtered.length > 0) {
                          setEditCategory(filtered[0].name);
                          return;
                        }
                      }
                      setEditCategory('');
                    }}
                    required
                    className="px-4 py-2.5 bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 border border-slate-200 focus:border-slate-400 cursor-pointer font-medium"
                  >
                    <option value="Masuk">Kas Masuk (Pemasukan)</option>
                    <option value="Keluar">Kas Keluar (Pengeluaran)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Kategori Anggaran
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    required
                    disabled={editCategoriesList.length === 0}
                    className="px-4 py-2.5 bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 border border-slate-200 focus:border-slate-400 cursor-pointer font-medium disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    {editCategoriesList.length === 0 ? (
                      <option value="">-- (Kosong) Tidak ada kategori di Supabase --</option>
                    ) : (
                      editCategoriesList.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Jumlah (Nominal Rp)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-slate-500 text-xs font-bold pointer-events-none">
                    Rp
                  </span>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editAmount}
                    onChange={(e) => setEditAmount(Number(e.target.value))}
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 border border-slate-200 focus:border-slate-400 font-bold"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span>Keterangan / Uraian</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {editCategoryDescription && (
                      <button
                        type="button"
                        onClick={() => setEditDesc(editCategoryDescription)}
                        className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer flex items-center gap-1"
                        title="Gunakan deskripsi kategori ini sebagai isi keterangan"
                      >
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        <span>Gunakan Deskripsi Kategori</span>
                      </button>
                    )}
                    <span className="text-[11px] font-normal text-slate-400">
                      Bebas karakter
                    </span>
                  </div>
                </div>
                <textarea
                  required
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder={editCategoryDescription}
                  className="px-4 py-2.5 bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 border border-slate-200 focus:border-slate-400 resize-y min-h-[90px] leading-relaxed placeholder:text-slate-400"
                />
                {editCategoryDescription && (
                  <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50/80 px-3 py-1.5 rounded-lg border border-slate-200/60">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-semibold text-slate-600 shrink-0">Deskripsi Kategori:</span>
                      <span className="text-slate-500 truncate" title={editCategoryDescription}>
                        {editCategoryDescription}
                      </span>
                    </div>
                    {editDesc !== editCategoryDescription && (
                      <button
                        type="button"
                        onClick={() => setEditDesc(editCategoryDescription)}
                        className="text-emerald-700 hover:text-emerald-800 font-bold shrink-0 cursor-pointer ml-2 hover:underline text-[11px]"
                      >
                        Pakai Teks Ini
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={closeEditModal}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" />
                  ) : (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (() => {
        const deletingTx = transactions.find((t) => t.id === deletingId);
        return (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-xl shadow-xl p-6 text-center animate-in fade-in zoom-in-95 border border-slate-200">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2 leading-snug">
                Hapus Catatan Transaksi?
              </h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Tindakan ini akan menghapus data ini secara permanen dari basis data Supabase (<code className="bg-slate-100 px-1 py-0.5 rounded text-rose-600 font-mono">kas_rt</code>).
              </p>

              {deletingTx && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-left text-xs space-y-1 mb-5">
                  <div className="flex justify-between font-semibold text-slate-900">
                    <span>{deletingTx.category} ({deletingTx.type})</span>
                    <span className={deletingTx.type === 'Masuk' ? 'text-emerald-700' : 'text-rose-600'}>
                      {formatSimpleRupiah(deletingTx.amount)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 truncate">
                    {deletingTx.description}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Tanggal: {formatDateIndo(deletingTx.date)}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={closeDeleteModal}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Trash2 className="w-4 h-4 text-white" />
                  )}
                  <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
