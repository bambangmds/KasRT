import React, { useState, useMemo } from 'react';
import { 
  Tag, 
  Plus, 
  Search, 
  X, 
  Pencil, 
  Trash2, 
  RefreshCw, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Check, 
  AlertTriangle, 
  Layers, 
  Info,
  CheckCircle2,
  Loader2,
  Sparkles,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Database,
  Copy,
  Users
} from 'lucide-react';
import { CategoryItem, Transaction, TransactionType, SupabaseConnectionStatus } from '../types';
import { formatSimpleRupiah } from '../data/initialData';
import { KATEGORI_SQL_SCHEMA } from '../lib/supabase';
import { useSekretariat } from '../context/SekretariatContext';
import { DataWargaSection } from './DataWargaSection';

interface KelolaKategoriViewProps {
  categories: CategoryItem[];
  transactions: Transaction[];
  onAddCategory?: (cat: Omit<CategoryItem, 'id'>) => Promise<boolean | void> | void;
  onCreateCategory?: (cat: Omit<CategoryItem, 'id'>) => Promise<boolean | void> | void;
  onUpdateCategory: (cat: CategoryItem, oldName?: string) => Promise<boolean | void> | void;
  onDeleteCategory: (id: string, name: string, type: TransactionType) => Promise<boolean | void> | void;
  onRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean;
  isConnectedToSupabase?: boolean;
  connectionStatus?: SupabaseConnectionStatus;
  onTriggerToast?: (msg: string, type?: 'success' | 'error' | 'info', title?: string) => void;
  onSeedDefaultCategories?: () => Promise<void> | void;
}

export const KelolaKategoriView: React.FC<KelolaKategoriViewProps> = ({
  categories,
  transactions,
  onAddCategory,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onRefresh,
  isRefreshing = false,
  isConnectedToSupabase = false,
  connectionStatus = 'connected',
  onTriggerToast = () => {},
  onSeedDefaultCategories,
}) => {
  const { sekretariat, wilayahShort } = useSekretariat();
  // Subtab State: Data Warga vs Pos Kategori Kas
  const [activeSubTab, setActiveSubTab] = useState<'data-warga' | 'kategori-kas'>('data-warga');

  // Filter & Search State for Categories
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Masuk' | 'Keluar'>('All');

  // Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<TransactionType>('Masuk');
  const [formDescription, setFormDescription] = useState('');
  const [formWajib, setFormWajib] = useState(false);
  const [formNominal, setFormNominal] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // SQL Guide Modal State
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Helper salin query SQL ke clipboard
  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(KATEGORI_SQL_SCHEMA);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = KATEGORI_SQL_SCHEMA;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    }
  };

  // Fungsi pembuat kategori (kompatibel onAddCategory / onCreateCategory)
  const executeCreateCategory = onAddCategory || onCreateCategory;

  // Hitung pemakaian kategori pada data transaksi kas
  const usageStats = useMemo(() => {
    const stats: Record<string, { count: number; totalAmount: number }> = {};
    for (const tx of transactions) {
      const key = `${tx.type}_${tx.category.trim()}`;
      if (!stats[key]) {
        stats[key] = { count: 0, totalAmount: 0 };
      }
      stats[key].count += 1;
      stats[key].totalAmount += Number(tx.amount) || 0;
    }
    return stats;
  }, [transactions]);

  // Statistik Ringkas Kategori
  const totalCount = categories.length;
  const masukCount = categories.filter((c) => c.type === 'Masuk').length;
  const keluarCount = categories.filter((c) => c.type === 'Keluar').length;

  // Filter List
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      // Filter Type
      if (filterType !== 'All' && cat.type !== filterType) {
        return false;
      }
      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = cat.name.toLowerCase().includes(query);
        const matchDesc = (cat.description || '').toLowerCase().includes(query);
        return matchName || matchDesc;
      }
      return true;
    });
  }, [categories, filterType, searchQuery]);

  // Handlers Buka Modal Tambah
  const handleOpenAdd = () => {
    setEditingCategory(null);
    setFormName('');
    setFormType(filterType === 'Keluar' ? 'Keluar' : 'Masuk');
    setFormDescription('');
    setFormWajib(false);
    setFormNominal(0);
    setFormError('');
    setIsFormModalOpen(true);
  };

  // Handlers Buka Modal Edit
  const handleOpenEdit = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormType(cat.type);
    setFormDescription(cat.description || '');
    setFormWajib(cat.wajib || false);
    setFormNominal(cat.nominal || 0);
    setFormError('');
    setIsFormModalOpen(true);
  };

  // Submit Form Tambah / Edit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim();
    if (!cleanName) {
      setFormError('Nama kategori tidak boleh kosong.');
      return;
    }

    // Cek duplikasi nama untuk jenis yang sama
    const isDuplicate = categories.some((c) => {
      if (editingCategory && c.id === editingCategory.id) return false;
      return (
        c.type === formType &&
        c.name.trim().toLowerCase() === cleanName.toLowerCase()
      );
    });

    if (isDuplicate) {
      setFormError(
        `Kategori "${cleanName}" untuk pos Kas ${formType} sudah terdaftar.`
      );
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      if (editingCategory) {
        const oldName = editingCategory.name;
        const res = await onUpdateCategory(
          {
            ...editingCategory,
            name: cleanName,
            type: formType,
            description: formDescription.trim(),
            wajib: formType === 'Masuk' ? formWajib : false,
            nominal: formNominal,
          },
          oldName
        );
        if (res === false) {
          setFormError('Gagal memperbarui kategori di database. Silakan periksa koneksi Supabase Anda.');
          return;
        }
      } else if (executeCreateCategory) {
        const res = await executeCreateCategory({
          name: cleanName,
          type: formType,
          description: formDescription.trim(),
          wajib: formType === 'Masuk' ? formWajib : false,
          nominal: formNominal,
        });
        if (res === false) {
          setFormError('Gagal menambahkan kategori ke database. Pastikan tabel kategori sudah ada di Supabase atau periksa izin policy.');
          return;
        }
      }
      setIsFormModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan kategori.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Eksekusi Hapus Kategori dengan Verifikasi Kategori Terpakai
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    // Verifikasi perlindungan: jangan hapus jika sedang digunakan
    const targetKey = `${deleteTarget.type}_${deleteTarget.name.trim()}`;
    const targetCount = usageStats[targetKey]?.count || 0;
    if (targetCount > 0) {
      alert(`Kategori "${deleteTarget.name}" tidak dapat dihapus karena sedang digunakan oleh ${targetCount} data transaksi di tabel kas_rt.`);
      setDeleteTarget(null);
      return;
    }

    setIsDeleting(true);
    try {
      await onDeleteCategory(deleteTarget.id, deleteTarget.name, deleteTarget.type);
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header Halaman (Warna Dasar Abu-abu Tebal & Ringkas Horizontal) */}
      <div className="bg-slate-200 p-3 sm:py-3 sm:px-4.5 rounded-2xl border border-slate-300 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 shrink-0">
            <Layers className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-700 shrink-0" />
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight whitespace-nowrap">
              Kelola Data Warga & Kategori
            </h1>
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-indigo-800 bg-white px-2 py-0.5 rounded-md border border-slate-300 shadow-2xs shrink-0">
              Master Data & Kategori RT
            </span>
          </div>
          <span className="hidden lg:inline text-slate-400 font-normal shrink-0">•</span>
          <p className="text-xs text-slate-700 font-medium whitespace-nowrap overflow-hidden text-ellipsis min-w-0">
            Pusat pengelolaan master data penduduk ({wilayahShort}) dan pos kategori kas penerimaan serta belanja RT.
          </p>
        </div>
      </div>

      {/* 2. Sub Menu Navigation (Warna Dasar Abu-abu / bg-slate-200) */}
      <div className="flex bg-slate-200 p-1.5 rounded-2xl border border-slate-300 shadow-xs print:hidden gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveSubTab('data-warga')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeSubTab === 'data-warga'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-1 ring-indigo-500/30 font-extrabold'
              : 'text-slate-700 hover:text-indigo-800 hover:bg-white/80'
          }`}
        >
          <Users className={`w-4 h-4 transition-transform ${activeSubTab === 'data-warga' ? 'text-blue-100 scale-110' : 'text-slate-600'}`} />
          <span>Kelola Data Warga</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('kategori-kas')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeSubTab === 'kategori-kas'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20 ring-1 ring-emerald-500/30 font-extrabold'
              : 'text-slate-700 hover:text-emerald-800 hover:bg-white/80'
          }`}
        >
          <Tag className={`w-4 h-4 transition-transform ${activeSubTab === 'kategori-kas' ? 'text-emerald-100 scale-110' : 'text-slate-600'}`} />
          <span>Pos Kategori Kas</span>
        </button>
      </div>

      {/* 3. TAB 1: DATA WARGA */}
      {activeSubTab === 'data-warga' && (
        <DataWargaSection
          connectionStatus={connectionStatus}
          onTriggerToast={onTriggerToast}
        />
      )}

      {/* 4. TAB 2: KATEGORI KAS */}
      {activeSubTab === 'kategori-kas' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Action Toolbar for Categories */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-600" />
                Daftar Pos Kategori Kas RT
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Atur nama pos penerimaan dan pos belanja pembukuan kas RT.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onRefresh && (
                <button
                  type="button"
                  onClick={() => onRefresh()}
                  disabled={isRefreshing}
                  className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer disabled:opacity-50"
                  title="Segarkan data dari database Supabase"
                >
                  <RefreshCw
                    className={`w-4 h-4 text-slate-500 ${
                      isRefreshing ? 'animate-spin text-emerald-600' : ''
                    }`}
                  />
                  <span>{isRefreshing ? 'Memuat...' : 'Segarkan'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsSqlModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer shadow-2xs"
                title="Lihat Skema SQL Tabel Kategori untuk Supabase"
              >
                <Database className="w-4 h-4 text-emerald-600" />
                <span>Skema SQL Kategori</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAdd}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm shadow-emerald-600/20 hover:shadow-md cursor-pointer active:scale-98"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Kategori</span>
              </button>
            </div>
          </div>

          {/* Kartu Statistik Ringkas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Kategori */}
            <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-indigo-500/30 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shrink-0">
                <Layers className="w-6 h-6 text-indigo-200" />
              </div>
              <div>
                <div className="text-xs font-semibold text-indigo-200 uppercase tracking-wider">Total Pos Kategori</div>
                <div className="text-2xl font-black text-white mt-0.5">{totalCount}</div>
                <div className="text-xs text-indigo-200/80 mt-0.5">Tersimpan di database</div>
              </div>
            </div>

            {/* Kategori Masuk */}
            <div className="bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 text-white p-5 rounded-2xl shadow-md border border-emerald-500/30 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shrink-0">
                <ArrowDownLeft className="w-6 h-6 text-emerald-200" />
              </div>
              <div>
                <div className="text-xs font-semibold text-emerald-200 uppercase tracking-wider">Kategori Kas Masuk</div>
                <div className="text-2xl font-black text-white mt-0.5">{masukCount}</div>
                <div className="text-xs text-emerald-200/80 mt-0.5">Pos iuran & donasi warga</div>
              </div>
            </div>

            {/* Kategori Keluar */}
            <div className="bg-gradient-to-br from-rose-600 via-pink-700 to-rose-900 text-white p-5 rounded-2xl shadow-md border border-rose-500/30 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-6 h-6 text-rose-200" />
              </div>
              <div>
                <div className="text-xs font-semibold text-rose-200 uppercase tracking-wider">Kategori Kas Keluar</div>
                <div className="text-2xl font-black text-white mt-0.5">{keluarCount}</div>
                <div className="text-xs text-rose-200/80 mt-0.5">Pos belanja & operasional</div>
              </div>
            </div>
          </div>

      {/* 3. Panel Filter & Pencarian */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Segmented Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setFilterType('All')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'All'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Semua ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('Masuk')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'Masuk'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Kas Masuk ({masukCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('Keluar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'Keluar'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Kas Keluar ({keluarCount})</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 sm:max-w-xs bg-slate-800 border border-slate-700 p-0.5 rounded-xl">
          <Search className="w-4 h-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama pos kategori..."
            className="w-full pl-9 pr-8 py-2 bg-slate-800 border-none rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-300 font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 4. Tabel Daftar Kategori */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-white uppercase tracking-wider">
                <th className="py-2.5 px-3 text-white font-bold bg-slate-950 w-10">No</th>
                <th className="py-2.5 px-3 text-white font-bold bg-slate-950">Pos Kategori</th>
                <th className="py-2.5 px-3 text-white font-bold bg-slate-950">Nominal Acuan</th>
                <th className="py-2.5 px-3 text-white font-bold bg-slate-950">Jenis Kas</th>
                <th className="py-2.5 px-3 text-white font-bold bg-slate-950">Deskripsi / Peruntukan</th>
                <th className="py-2.5 px-3 text-center text-white font-bold bg-slate-950">Pemakaian Transaksi</th>
                <th className="py-2.5 px-3 text-right text-white font-bold bg-slate-950">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Tag className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                      <p className="font-medium text-slate-600">Tidak ada kategori yang sesuai.</p>
                      <p className="text-xs text-slate-400">
                        {searchQuery ? 'Coba ubah kata kunci pencarian Anda.' : 'Silakan tambahkan kategori baru.'}
                      </p>
                      {categories.length === 0 && onSeedDefaultCategories && (
                        <button
                          type="button"
                          onClick={() => onSeedDefaultCategories()}
                          className="mt-2 flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-semibold border border-emerald-200 transition-all cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Tanamkan Kategori Bawaan RT</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCategories.map((cat, idx) => {
                  const isMasuk = cat.type === 'Masuk';
                  const usageKey = `${cat.type}_${cat.name.trim()}`;
                  const usage = usageStats[usageKey] || { count: 0, totalAmount: 0 };

                  return (
                    <tr key={cat.id || `${cat.type}-${cat.name}-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                      {/* No */}
                      <td className="py-2 px-3 text-slate-400 font-mono text-xs w-10">
                        {idx + 1}
                      </td>

                      {/* Pos Kategori */}
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-800 flex items-center gap-2">
                          <span>{cat.name}</span>
                          {cat.type === 'Masuk' && (
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                              cat.wajib 
                                ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              {cat.wajib ? 'Wajib (Y)' : 'Sukarela (N)'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Nominal Acuan */}
                      <td className="py-2 px-3 font-mono text-xs text-slate-800 font-semibold">
                        {cat.nominal && cat.nominal > 0 ? (
                          <span>{formatSimpleRupiah(cat.nominal)}</span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">- Sukarela -</span>
                        )}
                      </td>

                      {/* Jenis Kas */}
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isMasuk
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {isMasuk ? (
                            <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3 text-rose-600" />
                          )}
                          <span>Kas {cat.type}</span>
                        </span>
                      </td>

                      {/* Deskripsi */}
                      <td className="py-2 px-3 text-slate-600 max-w-xs sm:max-w-md">
                        {cat.description ? (
                          <span className="line-clamp-2">{cat.description}</span>
                        ) : (
                          <span className="text-slate-300 italic text-xs">- Tidak ada deskripsi -</span>
                        )}
                      </td>

                      {/* Pemakaian Transaksi */}
                      <td className="py-2 px-3 text-center">
                        {usage.count > 0 ? (
                          <div className="inline-flex flex-col items-center">
                            <span 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
                              title={`Kategori ini digunakan pada ${usage.count} transaksi di tabel kas_rt`}
                            >
                              <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>{usage.count} Transaksi</span>
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {formatSimpleRupiah(usage.totalAmount)}
                            </span>
                          </div>
                        ) : (
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                            title="Kategori belum pernah digunakan di kas_rt, aman dihapus"
                          >
                            <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>Belum Digunakan</span>
                          </span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Tombol Edit */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(cat)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title={`Koreksi kategori ${cat.name}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          {/* Tombol Hapus */}
                          {usage.count > 0 ? (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(cat)}
                              className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              title={`Kategori ${cat.name} sedang terpakai (${usage.count} transaksi di kas_rt) - Terkunci`}
                            >
                              <Lock className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(cat)}
                              className="p-1.5 text-rose-500 hover:text-white hover:bg-rose-600 rounded-lg transition-colors cursor-pointer"
                              title={`Hapus kategori ${cat.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Info footer table */}
        <div className="p-4 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              <span>Ikon gembok: Kategori terpakai di tabel kas_rt (Terproteksi dari penghapusan)</span>
            </span>
          </div>
          <div className="text-slate-400">
            Total {filteredCategories.length} kategori ditampilkan
          </div>
        </div>
      </div>
    </div>
  )}

      {/* 5. Modal Tambah / Koreksi Kategori */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    formType === 'Masuk'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  <Tag className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-800 text-base">
                  {editingCategory ? 'Koreksi Kategori Kas' : 'Tambah Kategori Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    <span className="leading-relaxed">{formError}</span>
                  </div>
                  {(formError.includes('Tabel') || formError.includes('SQL') || formError.includes('Supabase')) && (
                    <div className="pt-1.5 border-t border-rose-200/60 flex items-center justify-between">
                      <span className="text-[11px] text-rose-700">Tabel kategori perlu dibuat di SQL Editor?</span>
                      <button
                        type="button"
                        onClick={() => setIsSqlModalOpen(true)}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 underline flex items-center gap-1 cursor-pointer"
                      >
                        <Database className="w-3 h-3" />
                        <span>Salin Skema SQL</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Jenis Kas */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Jenis Kas
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType('Masuk')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      formType === 'Masuk'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                    <span>Kas Masuk</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType('Keluar')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      formType === 'Keluar'
                        ? 'bg-rose-50 border-rose-400 text-rose-800 ring-2 ring-rose-500/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 text-rose-600" />
                    <span>Kas Keluar</span>
                  </button>
                </div>
              </div>

              {/* Nama Kategori */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nama Pos Kategori <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={
                    formType === 'Masuk'
                      ? 'Contoh: Iuran Warga, Donasi, dsb.'
                      : 'Contoh: Keamanan, Kebersihan, Biaya keRTan, dsb.'
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Deskripsi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Deskripsi / Peruntukan (Opsional)
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  placeholder="Catatan mengenai peruntukan atau sumber pos kas ini..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
                />
              </div>

              {/* Nominal Ketetapan / Acuan (Rp) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex justify-between">
                  <span>Nominal Ketetapan / Iuran Acuan (Rp)</span>
                  <span className="text-[10px] text-slate-400 italic">Isi 0 jika sukarela / bervariasi</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-slate-400 text-xs font-bold pointer-events-none">Rp</span>
                  <input
                    type="number"
                    min="0"
                    value={formNominal || ''}
                    onChange={(e) => setFormNominal(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    placeholder="0"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Status Wajib (Khusus Kas Masuk) */}
              {formType === 'Masuk' && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-800 block">Iuran Wajib Warga?</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5 leading-relaxed">
                      Jika aktif (Y / Yes), iuran ini bersifat wajib bagi seluruh warga dan akan muncul di tab Setoran Kas Warga.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormWajib(!formWajib)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      formWajib ? 'bg-emerald-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        formWajib ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm shadow-emerald-600/20 hover:shadow-md cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingCategory ? 'Simpan Perubahan' : 'Tambah Kategori'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal Konfirmasi Hapus Kategori & Validasi Terpakai */}
      {deleteTarget && (() => {
        const key = `${deleteTarget.type}_${deleteTarget.name.trim()}`;
        const count = usageStats[key]?.count || 0;
        const totalAmount = usageStats[key]?.totalAmount || 0;
        const isUsed = count > 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 text-center">
                {isUsed ? (
                  <>
                    {/* Mode Kategori Terkunci / Terpakai */}
                    <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
                      <ShieldAlert className="w-7 h-7" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">
                      Kategori Tidak Dapat Dihapus
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 mb-4">
                      Kategori <span className="font-bold text-slate-900">"{deleteTarget.name}"</span> (Kas {deleteTarget.type}) saat ini sedang digunakan pada <span className="font-bold text-amber-700">{count} transaksi</span> di tabel <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">kas_rt</span> dengan total perputaran <span className="font-semibold text-slate-900">{formatSimpleRupiah(totalAmount)}</span>.
                    </p>

                    <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-xl text-left text-xs text-amber-950 mb-5 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-amber-900">
                        <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>Proteksi Keabsahan Pembukuan Kas RT</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed">
                        Sesuai kaidah akuntansi, kategori yang aktif terpakai tidak boleh dihapus dari database Supabase demi menjaga riwayat buku kas tetap teratur dan valid.
                      </p>
                      <p className="text-amber-800 font-medium pt-1.5 border-t border-amber-200/60">
                        💡 Jika Anda ingin menghapus kategori ini, silakan ubah terlebih dahulu kategori transaksi terkait atau hapus transaksinya di menu <strong>Koreksi & Hapus</strong>.
                      </p>
                    </div>

                    <div className="flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(null)}
                        className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-xs active:scale-98"
                      >
                        Mengerti & Tutup
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Mode Konfirmasi Hapus (Aman) */}
                    <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                      <Trash2 className="w-7 h-7" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">
                      Hapus Kategori Kas?
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 mb-4">
                      Apakah Anda yakin ingin menghapus kategori{' '}
                      <span className="font-bold text-slate-900">"{deleteTarget.name}"</span> (Kas {deleteTarget.type})?
                    </p>

                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-left text-xs text-emerald-900 mb-5 flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-emerald-900">Aman untuk Dihapus</p>
                        <p className="text-emerald-700 mt-0.5">
                          Kategori ini <strong>belum pernah digunakan</strong> pada transaksi kas mana pun di tabel <span className="font-mono">kas_rt</span>, sehingga aman untuk dihapus dari tabel <span className="font-mono">kategori</span> Supabase.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(null)}
                        disabled={isDeleting}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer disabled:opacity-50"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmDelete}
                        disabled={isDeleting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-xs cursor-pointer active:scale-98 disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Menghapus...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4" />
                            <span>Ya, Hapus Kategori</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 7. Modal Skema SQL Tabel Kategori Supabase */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/75">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    Skema SQL Tabel 'kategori' Supabase
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Jalankan script ini di Supabase SQL Editor jika tabel 'kategori' belum dibuat
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed">
                <strong>💡 Langkah Cepat Inisialisasi Tabel:</strong>
                <ol className="list-decimal list-inside mt-1.5 space-y-1 text-emerald-800">
                  <li>Klik tombol <strong>"Salin Script SQL"</strong> di bawah.</li>
                  <li>Buka dashboard Supabase project Anda &gt; menu <strong>SQL Editor</strong>.</li>
                  <li>Tempel (paste) script SQL tersebut, lalu klik <strong>Run</strong>.</li>
                  <li>Selesai! Seluruh kategori kas akan otomatis tersinkronkan ke Supabase.</li>
                </ol>
              </div>

              {/* Code Box */}
              <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900 text-slate-100 font-mono text-xs">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-800/90 border-b border-slate-700 text-[11px] text-slate-400">
                  <span>SQL Editor: PostgreSQL / Supabase</span>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[11px] font-sans font-semibold transition-all cursor-pointer active:scale-95"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span>Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Script SQL</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 overflow-x-auto text-[11px] leading-relaxed text-emerald-300">
                  {KATEGORI_SQL_SCHEMA}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 bg-slate-50/50">
              <span className="text-xs text-slate-500">
                Struktur kolom: <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">id</code>, <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">nama</code>, <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">jenis</code>, <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">deskripsi</code>
              </span>
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Tutup Panduan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
