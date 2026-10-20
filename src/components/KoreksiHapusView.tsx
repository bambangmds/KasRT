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
  Copy,
  Calendar,
  Sparkles
} from 'lucide-react';
import { Transaction, TransactionType, CategoryItem } from '../types';
import { CATEGORIES_BY_TYPE, INITIAL_CATEGORIES, formatSimpleRupiah, formatDateIndo } from '../data/initialData';
import { useSekretariat } from '../context/SekretariatContext';

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
  const { wilayahShort, wilayahLabel } = useSekretariat();
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [searchScope, setSearchScope] = useState<'all' | 'keterangan'>('all');
  const [filterType, setFilterType] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
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
    } else {
      CATEGORIES_BY_TYPE.Masuk.forEach((c) => cats.add(c.value));
      CATEGORIES_BY_TYPE.Keluar.forEach((c) => cats.add(c.value));
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
  const itemsPerPage = 7;

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
    if (categories && categories.length > 0) {
      const filtered = categories.filter((c) => c.type === editType);
      if (filtered.length > 0) {
        return filtered.map((c) => ({ value: c.name, label: c.name }));
      }
    }
    return CATEGORIES_BY_TYPE[editType] || [];
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

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Quick stats
  const totalMasukNominal = transactions
    .filter((t) => t.type === 'Masuk')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalKeluarNominal = transactions
    .filter((t) => t.type === 'Keluar')
    .reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Top Section / Title & Action Toolbar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
              Audit & Koreksi Data
            </span>
            <span className="text-xs text-slate-500 hidden sm:inline">• {wilayahLabel}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Koreksi & Hapus Data Transaksi
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Perbaiki kesalahan input nominal, tanggal, kategori, atau hapus transaksi kas warga.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {onRefresh && (
            <button
              type="button"
              onClick={() => onRefresh()}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200 transition-all shadow-2xs cursor-pointer disabled:opacity-50 active:scale-98"
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
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 hover:from-slate-800 hover:to-indigo-900 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm ring-1 ring-slate-700/50 cursor-pointer active:scale-98"
            title="Ekspor & Unduh Data (.xlsx, PDF, CSV, JSON)"
          >
            <Download className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Ekspor Data</span>
          </button>

          {onOpenImport && (
            <button
              type="button"
              onClick={onOpenImport}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm shadow-emerald-600/20 hover:shadow-md cursor-pointer active:scale-98"
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
        <div className="p-4.5 bg-gradient-to-br from-white via-white to-slate-50 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Seluruh Catatan</span>
            <div className="text-xl font-extrabold text-slate-900 mt-1">
              {transactions.length} <span className="text-xs font-semibold text-slate-500 font-sans">Transaksi</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md shadow-slate-900/20 ring-2 ring-slate-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        <div className="p-4.5 bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/40 rounded-2xl border border-emerald-200/90 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Kas Masuk Tercatat</span>
            <div className="text-xl font-extrabold text-emerald-800 mt-1">
              {formatSimpleRupiah(totalMasukNominal)}
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 ring-2 ring-emerald-200/60">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4.5 bg-gradient-to-br from-white via-rose-50/20 to-pink-50/40 rounded-2xl border border-rose-200/90 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Kas Keluar Tercatat</span>
            <div className="text-xl font-extrabold text-rose-700 mt-1">
              {formatSimpleRupiah(totalKeluarNominal)}
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-600 text-white flex items-center justify-center shadow-md shadow-rose-600/30 ring-2 ring-rose-200/60">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex items-center gap-2 flex-1 max-w-xl">
            {/* Scope selector: Semua vs Khusus Keterangan/Uraian */}
            <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSearchScope('all');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  searchScope === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Cari di semua kolom (ID, Keterangan, dan Kategori)"
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchScope('keterangan');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
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

            {/* Input Pencarian */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder={
                  searchScope === 'keterangan'
                    ? 'Cari keterangan/uraian transaksi (cth: lampu, iuran, rapat)...'
                    : 'Cari ID, keterangan, atau kategori...'
                }
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-8 py-2.5 bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 border border-slate-200 focus:border-slate-400 transition-all font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="Hapus pencarian"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Tipe Filter Pill */}
            <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setFilterType('');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
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
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
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
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  filterType === 'Keluar'
                    ? 'bg-white text-rose-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Keluar
              </button>
            </div>

            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 border border-slate-200 focus:border-slate-400 cursor-pointer font-medium"
            >
              <option value="">Semua Kategori</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={filterDate}
              onChange={(e) => {
                setFilterDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 border border-slate-200 focus:border-slate-400 font-medium"
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
                className="px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer border border-rose-200"
              >
                Reset Filter
              </button>
            )}
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
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200">
                <th className="py-2.5 px-3.5 sm:px-4">ID Transaksi</th>
                <th className="py-2.5 px-3.5 sm:px-4">Tanggal</th>
                <th className="py-2.5 px-3.5 sm:px-4">Tipe</th>
                <th className="py-2.5 px-3.5 sm:px-4">Kategori</th>
                <th className="py-2.5 px-3.5 sm:px-4 text-right">Jumlah (Rp)</th>
                <th className="py-2.5 px-3.5 sm:px-4">Keterangan</th>
                <th className="py-2.5 px-3.5 sm:px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Filter className="w-4 h-4" />
                      </div>
                      <p className="font-semibold text-slate-800">Tidak ada catatan transaksi yang sesuai</p>
                      <p className="text-[11px] text-slate-400">Periksa kembali filter atau kata kunci pencarian Anda.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((tx) => {
                  const isMasuk = tx.type === 'Masuk';
                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-2.5 px-3.5 sm:px-4 font-semibold text-slate-900 whitespace-nowrap font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <span
                            title={tx.id}
                            className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 border border-slate-200 inline-block font-mono text-[11px]"
                          >
                            {tx.id.length > 12 && tx.id.includes('-') ? `${tx.id.substring(0, 8)}...` : tx.id}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyId(tx.id)}
                            className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                            title="Salin ID Transaksi"
                          >
                            {copiedId === tx.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 sm:px-4 text-slate-600 whitespace-nowrap font-medium">
                        {formatDateIndo(tx.date)}
                      </td>
                      <td className="py-2.5 px-3.5 sm:px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${
                            isMasuk
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isMasuk ? 'bg-emerald-600' : 'bg-rose-500'
                            }`}
                          />
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 sm:px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {tx.category}
                      </td>
                      <td
                        className={`py-2.5 px-3.5 sm:px-4 text-right whitespace-nowrap font-bold text-xs sm:text-sm ${
                          isMasuk ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {formatSimpleRupiah(tx.amount)}
                      </td>
                      <td
                        className="py-2.5 px-3.5 sm:px-4 text-slate-600 max-w-xs sm:max-w-md truncate"
                        title={tx.description}
                      >
                        {highlightText(tx.description, searchTerm)}
                      </td>
                      <td className="py-2.5 px-3.5 sm:px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(tx)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-all cursor-pointer"
                            title="Edit Transaksi Ini"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteModal(tx.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                            title="Hapus Transaksi Ini"
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
        <div className="p-4 sm:p-5 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 border-t border-slate-200">
          <span>
            Menampilkan {paginated.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-
            {Math.min(currentPage * itemsPerPage, filtered.length)} dari {filtered.length} data transaksi
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-white rounded-lg shadow-2xs border border-slate-200 font-semibold text-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer hover:bg-slate-50"
            >
              Sebelumnya
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
              <button
                key={pg}
                onClick={() => setCurrentPage(pg)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  currentPage === pg
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {pg}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-white rounded-lg shadow-2xs border border-slate-200 font-semibold text-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer hover:bg-slate-50"
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
                      setEditCategory(CATEGORIES_BY_TYPE[newType][0].value);
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
                    className="px-4 py-2.5 bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 border border-slate-200 focus:border-slate-400 cursor-pointer font-medium"
                  >
                    {editCategoriesList.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
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
