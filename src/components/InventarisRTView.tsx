import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  Plus, 
  Pencil, 
  Trash2, 
  UserCheck, 
  Calendar, 
  Clock, 
  CheckCircle, 
  CheckCircle2,
  AlertTriangle, 
  Search, 
  Info, 
  RefreshCw,
  Database,
  ArrowRightLeft,
  X,
  User,
  Tags,
  Loader2,
  Phone,
  HelpCircle,
  Undo2,
  Copy,
  Check,
  Filter,
  LayoutList,
  LayoutGrid,
  Boxes,
  Layers,
  Building2,
  Sparkles
} from 'lucide-react';
import { InventarisItem, PeminjamanItem, DataWargaItem, SupabaseConnectionStatus } from '../types';
import { 
  fetchInventarisFromSupabase, 
  insertInventarisToSupabase, 
  updateInventarisInSupabase, 
  deleteInventarisFromSupabase,
  fetchPeminjamanFromSupabase,
  insertPeminjamanToSupabase,
  updatePeminjamanInSupabase,
  deletePeminjamanFromSupabase,
  fetchDataWargaFromSupabase
} from '../lib/supabase';
import { formatSimpleRupiah, formatDateIndo } from '../data/initialData';
import { useSekretariat } from '../context/SekretariatContext';

interface InventarisRTViewProps {
  connectionStatus?: SupabaseConnectionStatus;
  onTriggerToast: (msg: string, type?: 'success' | 'error' | 'info', title?: string) => void;
}

export const InventarisRTView: React.FC<InventarisRTViewProps> = ({
  connectionStatus = 'connected',
  onTriggerToast,
}) => {
  const { wilayahShort, wilayahLabel } = useSekretariat();

  // Subtabs state: 'daftar-aset' or 'log-peminjaman'
  const [activeSubTab, setActiveSubTab] = useState<'daftar-aset' | 'log-peminjaman'>('daftar-aset');

  // View Mode for assets: 'table' (default - baris rapi ke kanan) vs 'grid'
  const [assetViewMode, setAssetViewMode] = useState<'table' | 'grid'>('table');

  // Core Data States
  const [assets, setAssets] = useState<InventarisItem[]>([]);
  const [loans, setLoans] = useState<PeminjamanItem[]>([]);
  const [citizens, setCitizens] = useState<DataWargaItem[]>([]);
  
  const [isAssetsLoading, setIsAssetsLoading] = useState(false);
  const [isLoansLoading, setIsLoansLoading] = useState(false);
  const [isCitizensLoading, setIsCitizensLoading] = useState(false);
  
  // Filter States
  const [searchAssetQuery, setSearchAssetQuery] = useState('');
  const [filterAssetKondisi, setFilterAssetKondisi] = useState<string>('');
  const [searchLoanQuery, setSearchLoanQuery] = useState('');
  const [filterLoanStatus, setFilterLoanStatus] = useState<string>('');
  const [tableNotCreated, setTableNotCreated] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pagination States
  const [currentAssetPage, setCurrentAssetPage] = useState(1);
  const assetItemsPerPage = 8;

  const [currentLoanPage, setCurrentLoanPage] = useState(1);
  const loanItemsPerPage = 8;

  // Modal States
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<InventarisItem | null>(null);
  
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [selectedAssetForLoan, setSelectedAssetForLoan] = useState<InventarisItem | null>(null);

  // Confirmation Modals States
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedLoanForReturn, setSelectedLoanForReturn] = useState<PeminjamanItem | null>(null);
  const [formTanggalKembali, setFormTanggalKembali] = useState(() => new Date().toISOString().split('T')[0]);
  const [formNotesKembali, setFormNotesKembali] = useState('');
  const [isSavingReturn, setIsSavingReturn] = useState(false);

  const [isDeleteAssetModalOpen, setIsDeleteAssetModalOpen] = useState(false);
  const [selectedAssetForDelete, setSelectedAssetForDelete] = useState<InventarisItem | null>(null);
  const [isDeletingAsset, setIsDeletingAsset] = useState(false);

  const [isDeleteLoanModalOpen, setIsDeleteLoanModalOpen] = useState(false);
  const [selectedLoanForDelete, setSelectedLoanForDelete] = useState<PeminjamanItem | null>(null);
  const [isDeletingLoan, setIsDeletingLoan] = useState(false);

  // Asset Form State
  const [formNamaBarang, setFormNamaBarang] = useState('');
  const [formJumlahTotal, setFormJumlahTotal] = useState(1);
  const [formJumlahBaik, setFormJumlahBaik] = useState(1);
  const [formJumlahRusak, setFormJumlahRusak] = useState(0);
  const [formKondisi, setFormKondisi] = useState('Baik');
  const [formLokasi, setFormLokasi] = useState('');
  const [formCatatan, setFormCatatan] = useState('');

  // Loan Form State
  const [formWargaId, setFormWargaId] = useState('');
  const [formLoanAssetId, setFormLoanAssetId] = useState('');
  const [formJumlahPinjam, setFormJumlahPinjam] = useState(1);
  const [formTanggalPinjam, setFormLoanDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formKeperluan, setFormKeperluan] = useState('');
  const [formLoanCatatan, setFormLoanCatatan] = useState('');

  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [isSavingLoan, setIsSavingLoan] = useState(false);

  // Load Data functions
  const loadAssets = async () => {
    setIsAssetsLoading(true);
    const { data, error, tableNotCreated: notCreated } = await fetchInventarisFromSupabase();
    setIsAssetsLoading(false);
    
    if (notCreated) {
      setTableNotCreated(true);
    } else {
      setTableNotCreated(false);
    }

    if (error) {
      console.warn('[Assets Load Error]', error);
    } else if (data) {
      setAssets(data);
    }
  };

  const loadLoans = async () => {
    setIsLoansLoading(true);
    const { data, error } = await fetchPeminjamanFromSupabase();
    setIsLoansLoading(false);

    if (error) {
      console.warn('[Loans Load Error]', error);
    } else if (data) {
      setLoans(data);
    }
  };

  const loadCitizens = async () => {
    setIsCitizensLoading(true);
    const warga = await fetchDataWargaFromSupabase();
    setIsCitizensLoading(false);
    if (warga) {
      setCitizens(warga);
    }
  };

  const handleRefreshAll = async () => {
    await Promise.all([loadAssets(), loadLoans(), loadCitizens()]);
    onTriggerToast('Seluruh data inventaris & peminjaman berhasil disegarkan!', 'success', 'Data Diperbarui');
  };

  useEffect(() => {
    loadAssets();
    loadLoans();
    loadCitizens();
  }, [connectionStatus]);

  // Map Join fields for Loans
  const mappedLoans = useMemo(() => {
    return loans.map(loan => {
      const citizen = citizens.find(c => c.id === loan.id_warga);
      const asset = assets.find(a => a.id === loan.id_barang);
      return {
        ...loan,
        warga_nama: citizen ? citizen.nama_lengkap : 'Warga Terhapus',
        barang_nama: asset ? asset.nama_barang : 'Barang Terhapus',
        warga_hp: citizen ? citizen.no_hp : '',
      };
    });
  }, [loans, citizens, assets]);

  // Executive Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalJenisBarang = assets.length;
    const totalUnitStok = assets.reduce((sum, a) => sum + (Number(a.jumlah_total) || 0), 0);
    const totalUnitBaik = assets.reduce((sum, a) => sum + (Number(a.jumlah_baik) || 0), 0);
    const totalUnitRusak = assets.reduce((sum, a) => sum + (Number(a.jumlah_rusak) || 0), 0);
    const totalDipinjam = loans
      .filter(l => l.status === 'Dipinjam')
      .reduce((sum, l) => sum + (Number(l.jumlah_pinjam) || 0), 0);

    return {
      totalJenisBarang,
      totalUnitStok,
      totalUnitBaik,
      totalUnitRusak,
      totalDipinjam,
    };
  }, [assets, loans]);

  // Filter Assets
  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      const q = searchAssetQuery.toLowerCase().trim();
      const matchSearch = !q || (
        a.nama_barang.toLowerCase().includes(q) ||
        (a.lokasi_penyimpanan || '').toLowerCase().includes(q) ||
        (a.catatan || '').toLowerCase().includes(q) ||
        (a.kondisi || '').toLowerCase().includes(q) ||
        (a.id || '').toLowerCase().includes(q)
      );
      const matchKondisi = !filterAssetKondisi || (a.kondisi || 'Baik') === filterAssetKondisi;

      return matchSearch && matchKondisi;
    });
  }, [assets, searchAssetQuery, filterAssetKondisi]);

  // Paginated Assets
  const totalAssetPages = Math.ceil(filteredAssets.length / assetItemsPerPage) || 1;
  const paginatedAssets = useMemo(() => {
    const start = (currentAssetPage - 1) * assetItemsPerPage;
    return filteredAssets.slice(start, start + assetItemsPerPage);
  }, [filteredAssets, currentAssetPage]);

  // Filter Loans
  const filteredLoans = useMemo(() => {
    return mappedLoans.filter(l => {
      const q = searchLoanQuery.toLowerCase().trim();
      const matchSearch = !q || (
        (l.barang_nama || '').toLowerCase().includes(q) ||
        (l.warga_nama || '').toLowerCase().includes(q) ||
        (l.keperluan || '').toLowerCase().includes(q) ||
        (l.catatan || '').toLowerCase().includes(q) ||
        (l.id || '').toLowerCase().includes(q)
      );
      const matchStatus = !filterLoanStatus || l.status === filterLoanStatus;

      return matchSearch && matchStatus;
    });
  }, [mappedLoans, searchLoanQuery, filterLoanStatus]);

  // Paginated Loans
  const totalLoanPages = Math.ceil(filteredLoans.length / loanItemsPerPage) || 1;
  const paginatedLoans = useMemo(() => {
    const start = (currentLoanPage - 1) * loanItemsPerPage;
    return filteredLoans.slice(start, start + loanItemsPerPage);
  }, [filteredLoans, currentLoanPage]);

  // Copy ID Helper
  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Asset Form Helpers
  const handleOpenAddAsset = () => {
    setEditingAsset(null);
    setFormNamaBarang('');
    setFormJumlahTotal(1);
    setFormJumlahBaik(1);
    setFormJumlahRusak(0);
    setFormKondisi('Baik');
    setFormLokasi('');
    setFormCatatan('');
    setIsAssetModalOpen(true);
  };

  const handleOpenEditAsset = (asset: InventarisItem) => {
    setEditingAsset(asset);
    setFormNamaBarang(asset.nama_barang);
    setFormJumlahTotal(asset.jumlah_total);
    setFormJumlahBaik(asset.jumlah_baik);
    setFormJumlahRusak(asset.jumlah_rusak);
    setFormKondisi(asset.kondisi || 'Baik');
    setFormLokasi(asset.lokasi_penyimpanan || '');
    setFormCatatan(asset.catatan || '');
    setIsAssetModalOpen(true);
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNamaBarang.trim()) {
      onTriggerToast('Nama barang wajib diisi.', 'error', 'Form Tidak Valid');
      return;
    }

    if (formJumlahBaik + formJumlahRusak !== formJumlahTotal) {
      onTriggerToast('Jumlah Baik + Jumlah Rusak harus sama dengan Jumlah Total!', 'error', 'Perhitungan Salah');
      return;
    }

    setIsSavingAsset(true);
    const payload = {
      nama_barang: formNamaBarang.trim(),
      jumlah_total: Number(formJumlahTotal),
      jumlah_baik: Number(formJumlahBaik),
      jumlah_rusak: Number(formJumlahRusak),
      kondisi: formKondisi,
      lokasi_penyimpanan: formLokasi.trim() || undefined,
      catatan: formCatatan.trim() || undefined,
    };

    if (editingAsset) {
      const { error } = await updateInventarisInSupabase({
        ...editingAsset,
        ...payload,
      });

      if (error) {
        onTriggerToast(`Gagal memperbarui aset: ${error}`, 'error', 'Gagal Simpan');
      } else {
        onTriggerToast(`Aset "${formNamaBarang}" berhasil diperbarui!`, 'success', 'Perubahan Disimpan');
        setIsAssetModalOpen(false);
        loadAssets();
      }
    } else {
      const { error } = await insertInventarisToSupabase(payload);
      if (error) {
        onTriggerToast(`Gagal menyimpan aset: ${error}`, 'error', 'Gagal Simpan');
      } else {
        onTriggerToast(`Aset baru "${formNamaBarang}" berhasil ditambahkan!`, 'success', 'Berhasil Disimpan');
        setIsAssetModalOpen(false);
        loadAssets();
      }
    }
    setIsSavingAsset(false);
  };

  // Delete Asset custom modal helpers
  const handleOpenDeleteAssetModal = (asset: InventarisItem) => {
    const activeLoans = loans.filter(l => l.id_barang === asset.id && l.status === 'Dipinjam');
    if (activeLoans.length > 0) {
      onTriggerToast(
        `Aset "${asset.nama_barang}" tidak bisa dihapus karena masih sedang dipinjam oleh ${activeLoans.length} warga.`, 
        'error', 
        'Penghapusan Ditolak'
      );
      return;
    }
    setSelectedAssetForDelete(asset);
    setIsDeleteAssetModalOpen(true);
  };

  const handleConfirmDeleteAsset = async () => {
    if (!selectedAssetForDelete) return;
    setIsDeletingAsset(true);
    const asset = selectedAssetForDelete;

    const { success, error } = await deleteInventarisFromSupabase(asset.id);
    if (success) {
      onTriggerToast(`Aset "${asset.nama_barang}" berhasil dihapus dari inventaris.`, 'success', 'Aset Dihapus');
      setIsDeleteAssetModalOpen(false);
      setSelectedAssetForDelete(null);
      loadAssets();
      loadLoans();
    } else {
      onTriggerToast(`Gagal menghapus aset: ${error}`, 'error');
    }
    setIsDeletingAsset(false);
  };

  // Loan Form Helpers
  const handleOpenAddLoan = (asset?: InventarisItem) => {
    if (citizens.length === 0) {
      onTriggerToast('Tidak ada data warga di sistem. Harap tambahkan data warga terlebih dahulu.', 'error', 'Warga Kosong');
      return;
    }

    const defaultAsset = asset || (assets.length > 0 ? assets[0] : null);
    setSelectedAssetForLoan(defaultAsset);
    setFormLoanAssetId(defaultAsset ? defaultAsset.id : '');
    setFormWargaId(citizens.length > 0 ? (citizens[0].id || '') : '');
    setFormJumlahPinjam(1);
    setFormLoanDate(new Date().toISOString().split('T')[0]);
    setFormKeperluan('');
    setFormLoanCatatan('');
    setIsLoanModalOpen(true);
  };

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLoanAssetId) {
      onTriggerToast('Harap pilih aset/barang yang ingin dipinjam.', 'error', 'Form Tidak Valid');
      return;
    }
    if (!formWargaId) {
      onTriggerToast('Harap pilih warga peminjam.', 'error', 'Form Tidak Valid');
      return;
    }

    const asset = assets.find(a => a.id === formLoanAssetId);
    if (!asset) return;

    if (formJumlahPinjam <= 0) {
      onTriggerToast('Jumlah pinjam minimal harus 1 unit.', 'error');
      return;
    }

    if (formJumlahPinjam > asset.jumlah_baik) {
      onTriggerToast(`Stok barang baik yang tersedia hanya ada ${asset.jumlah_baik} unit.`, 'error', 'Unit Kurang');
      return;
    }

    setIsSavingLoan(true);

    const payload = {
      id_barang: formLoanAssetId,
      id_warga: formWargaId,
      tanggal_pinjam: formTanggalPinjam,
      jumlah_pinjam: Number(formJumlahPinjam),
      keperluan: formKeperluan.trim() || undefined,
      status: 'Dipinjam' as const,
      catatan: formLoanCatatan.trim() || undefined,
    };

    const { error } = await insertPeminjamanToSupabase(payload);

    if (error) {
      onTriggerToast(`Gagal menyimpan log peminjaman: ${error}`, 'error');
    } else {
      const updatedAsset: InventarisItem = {
        ...asset,
        jumlah_baik: asset.jumlah_baik - Number(formJumlahPinjam),
      };
      await updateInventarisInSupabase(updatedAsset);

      onTriggerToast(`Log peminjaman berhasil dicatat!`, 'success', 'Peminjaman Disimpan');
      setIsLoanModalOpen(false);
      loadAssets();
      loadLoans();
    }
    setIsSavingLoan(false);
  };

  // Return Asset custom modal helpers
  const handleOpenReturnAssetModal = (loan: PeminjamanItem) => {
    setSelectedLoanForReturn(loan);
    setFormTanggalKembali(new Date().toISOString().split('T')[0]);
    setFormNotesKembali(loan.catatan || '');
    setIsReturnModalOpen(true);
  };

  const handleConfirmReturnAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanForReturn) return;

    setIsSavingReturn(true);
    const loan = selectedLoanForReturn;
    const asset = assets.find(a => a.id === loan.id_barang);
    const returnQty = loan.jumlah_pinjam;

    const updatedLoan: PeminjamanItem = {
      ...loan,
      status: 'Kembali',
      tanggal_kembali: formTanggalKembali,
      catatan: formNotesKembali.trim() || undefined,
    };

    const { error } = await updatePeminjamanInSupabase(updatedLoan);

    if (error) {
      onTriggerToast(`Gagal memperbarui status pengembalian: ${error}`, 'error');
    } else {
      if (asset) {
        const updatedAsset: InventarisItem = {
          ...asset,
          jumlah_baik: asset.jumlah_baik + returnQty,
        };
        await updateInventarisInSupabase(updatedAsset);
      }

      onTriggerToast(`Barang berhasil dikembalikan ke inventaris RT!`, 'success', 'Aset Kembali');
      setIsReturnModalOpen(false);
      setSelectedLoanForReturn(null);
      loadAssets();
      loadLoans();
    }
    setIsSavingReturn(false);
  };

  // Delete Loan custom modal helpers
  const handleOpenDeleteLoanModal = (loan: PeminjamanItem) => {
    setSelectedLoanForDelete(loan);
    setIsDeleteLoanModalOpen(true);
  };

  const handleConfirmDeleteLoan = async () => {
    if (!selectedLoanForDelete) return;
    setIsDeletingLoan(true);
    const loan = selectedLoanForDelete;

    const { success, error } = await deletePeminjamanFromSupabase(loan.id);
    if (success) {
      onTriggerToast('Log peminjaman berhasil dihapus.', 'success');
      setIsDeleteLoanModalOpen(false);
      setSelectedLoanForDelete(null);
      loadLoans();
    } else {
      onTriggerToast(`Gagal menghapus log: ${error}`, 'error');
    }
    setIsDeletingLoan(false);
  };

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-slate-900 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
            <Package className="w-6 h-6 text-indigo-200" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                Aset & Peralatan Warga
              </span>
              <span className="text-xs text-slate-400 hidden sm:inline">• {wilayahLabel}</span>
            </div>
            <h1 className="font-extrabold text-slate-900 text-lg sm:text-2xl tracking-tight">
              Inventaris & Aset {wilayahShort}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Pencatatan sarana fisik, peralatan warga, serta log peminjaman aset RT secara akuntabel & rapi.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
          <button 
            type="button"
            onClick={handleRefreshAll}
            disabled={isAssetsLoading || isLoansLoading}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 transition-all shadow-2xs flex items-center gap-2 text-xs font-bold disabled:opacity-50 cursor-pointer active:scale-95"
            title="Segarkan Data Inventaris dari Database Supabase"
          >
            <RefreshCw className={`w-4 h-4 text-indigo-600 ${(isAssetsLoading || isLoansLoading) ? 'animate-spin' : ''}`} />
            <span>Segarkan Data</span>
          </button>
        </div>
      </div>

      {/* SQL Setup Helper for Supabase if tables not created yet */}
      {tableNotCreated && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 text-amber-900 shadow-2xs space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-amber-950">Skema SQL Inventaris & Peminjaman Belum Dibuat</h4>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                Tabel <code className="font-mono bg-amber-100 px-1 rounded font-bold">inventaris_rt</code> dan <code className="font-mono bg-amber-100 px-1 rounded font-bold">peminjaman_aset_rt</code> belum terdeteksi di database Supabase Anda.
              </p>
            </div>
          </div>
          <div className="bg-slate-900 text-slate-100 rounded-xl p-3 text-[11px] font-mono overflow-x-auto max-h-36">
{`CREATE TABLE IF NOT EXISTS inventaris_rt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_barang TEXT NOT NULL,
  jumlah_total INTEGER NOT NULL DEFAULT 1,
  jumlah_baik INTEGER NOT NULL DEFAULT 1,
  jumlah_rusak INTEGER NOT NULL DEFAULT 0,
  kondisi TEXT,
  lokasi_penyimpanan TEXT,
  catatan TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS peminjaman_aset_rt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_barang UUID NOT NULL REFERENCES inventaris_rt(id) ON DELETE CASCADE,
  id_warga UUID NOT NULL,
  tanggal_pinjam DATE NOT NULL,
  tanggal_kembali DATE,
  jumlah_pinjam INTEGER NOT NULL DEFAULT 1,
  keperluan TEXT,
  status TEXT NOT NULL CHECK (status IN ('Dipinjam', 'Kembali')),
  catatan TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);`}
          </div>
          <p className="text-[10px] text-amber-700">
            *Salin script SQL di atas dan jalankan pada <strong>Supabase SQL Editor</strong> proyek Anda, lalu segarkan halaman ini.
          </p>
        </div>
      )}

      {/* Executive Summary Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Metric 1: Total Jenis Barang */}
        <div className="p-4 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-2xl border border-indigo-800/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">Jenis Barang</span>
            <div className="text-lg sm:text-2xl font-extrabold text-white mt-0.5 tabular-nums">
              {summaryMetrics.totalJenisBarang} <span className="text-xs font-semibold text-indigo-300">Item</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-800/50 text-indigo-200 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2: Total Unit Stok */}
        <div className="p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl border border-slate-700/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Total Stok Unit</span>
            <div className="text-lg sm:text-2xl font-extrabold text-white mt-0.5 tabular-nums">
              {summaryMetrics.totalUnitStok} <span className="text-xs font-semibold text-slate-400">Unit</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-200 border border-slate-600/50 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3: Unit Baik / Tersedia */}
        <div className="p-4 bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-900 text-white rounded-2xl border border-emerald-800/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">Kondisi Baik</span>
            <div className="text-lg sm:text-2xl font-extrabold text-emerald-300 mt-0.5 tabular-nums">
              {summaryMetrics.totalUnitBaik} <span className="text-xs font-semibold text-emerald-400">Tersedia</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-800/50 text-emerald-200 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        {/* Metric 4: Unit Rusak / Perbaikan */}
        <div className="p-4 bg-gradient-to-br from-rose-950 via-slate-900 to-rose-900 text-white rounded-2xl border border-rose-800/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-200">Perlu Perbaikan</span>
            <div className="text-lg sm:text-2xl font-extrabold text-rose-300 mt-0.5 tabular-nums">
              {summaryMetrics.totalUnitRusak} <span className="text-xs font-semibold text-rose-400">Rusak</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-800/50 text-rose-200 border border-rose-500/30 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          </div>
        </div>

        {/* Metric 5: Unit Sedang Dipinjam Warga */}
        <div className="p-4 bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 text-white rounded-2xl border border-blue-800/80 shadow-xs flex items-center justify-between col-span-2 lg:col-span-1">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200">Sedang Dipinjam</span>
            <div className="text-lg sm:text-2xl font-extrabold text-blue-300 mt-0.5 tabular-nums">
              {summaryMetrics.totalDipinjam} <span className="text-xs font-semibold text-blue-400">Unit</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-800/50 text-blue-200 border border-blue-500/30 flex items-center justify-center shrink-0">
            <ArrowRightLeft className="w-5 h-5 text-blue-400" />
          </div>
        </div>
      </div>

      {/* Segmented Subtabs Navigation & View Mode Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-bold text-slate-600 max-w-md w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('daftar-aset');
              setCurrentAssetPage(1);
            }}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-lg text-center transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === 'daftar-aset'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-indigo-600/20 font-extrabold'
                : 'hover:text-slate-800 hover:bg-slate-200/60'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>1. Daftar Inventaris & Aset</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeSubTab === 'daftar-aset' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {assets.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('log-peminjaman');
              setCurrentLoanPage(1);
            }}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-lg text-center transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === 'log-peminjaman'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-600/20 font-extrabold'
                : 'hover:text-slate-800 hover:bg-slate-200/60'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>2. Log Peminjaman Aset</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeSubTab === 'log-peminjaman' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {loans.length}
            </span>
          </button>
        </div>

        {/* View Mode Switcher for Assets tab */}
        {activeSubTab === 'daftar-aset' && (
          <div className="flex items-center gap-1.5 self-end sm:self-auto bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setAssetViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                assetViewMode === 'table'
                  ? 'bg-white text-indigo-900 shadow-2xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Tampilan Tabel Baris Rapi ke Kanan"
            >
              <LayoutList className="w-3.5 h-3.5 text-indigo-600" />
              <span>Tabel Baris</span>
            </button>
            <button
              type="button"
              onClick={() => setAssetViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                assetViewMode === 'grid'
                  ? 'bg-white text-indigo-900 shadow-2xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Tampilan Kartu Grid"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
              <span>Kartu Grid</span>
            </button>
          </div>
        )}
      </div>

      {/* SUBTAB 1: DAFTAR INVENTARIS & ASET */}
      {activeSubTab === 'daftar-aset' && (
        <div className="space-y-4">
          {/* Filter & Action Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center flex-1">
              {/* Search Bar */}
              <div className="relative flex-1 bg-slate-800 border border-slate-700 p-0.5 rounded-xl">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                <input
                  type="text"
                  value={searchAssetQuery}
                  onChange={(e) => {
                    setSearchAssetQuery(e.target.value);
                    setCurrentAssetPage(1);
                  }}
                  placeholder="Cari nama aset, lokasi, atau catatan..."
                  className="w-full pl-10 pr-8 py-2 text-xs sm:text-sm bg-slate-800 border-none rounded-lg text-white placeholder-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
                {searchAssetQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchAssetQuery('');
                      setCurrentAssetPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Kondisi Filter */}
              <select
                value={filterAssetKondisi}
                onChange={(e) => {
                  setFilterAssetKondisi(e.target.value);
                  setCurrentAssetPage(1);
                }}
                className="px-3.5 py-2 bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-900 outline-none border border-slate-200 focus:border-indigo-500 font-medium cursor-pointer"
              >
                <option value="">Semua Kondisi</option>
                <option value="Baik">Sangat Baik / Layak</option>
                <option value="Rusak Sebagian">Rusak Sebagian</option>
                <option value="Rusak Berat">Rusak Berat</option>
              </select>

              {(searchAssetQuery || filterAssetKondisi) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchAssetQuery('');
                    setFilterAssetKondisi('');
                    setCurrentAssetPage(1);
                  }}
                  className="px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition-colors cursor-pointer shrink-0"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Action Add Asset Button */}
            <button
              type="button"
              onClick={handleOpenAddAsset}
              className="px-4 py-2.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-slate-900 hover:from-violet-700 hover:to-indigo-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 shrink-0"
            >
              <Plus className="w-4 h-4 text-indigo-200" />
              <span>Tambah Aset Inventaris Baru</span>
            </button>
          </div>

          {/* MAIN DATA DISPLAY (TABLE MODE - BARIS RAPI KE KANAN) */}
          {isAssetsLoading ? (
            <div className="bg-white p-12 text-center text-slate-400 rounded-2xl border border-slate-200 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
              <p className="text-xs font-semibold">Memuat data inventaris & aset RT...</p>
            </div>
          ) : assetViewMode === 'table' ? (
            /* TABEL BARIS RAPI KE KANAN */
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase tracking-wider text-white font-black">
                      <th className="py-2.5 px-3 text-white font-bold bg-slate-950">Nama Barang / Aset</th>
                      <th className="py-2.5 px-3 text-center text-white font-bold bg-slate-950">Kondisi</th>
                      <th className="py-2.5 px-3 text-center text-white font-bold bg-slate-950">Total Unit</th>
                      <th className="py-2.5 px-3 text-center text-white font-bold bg-slate-950">Tersedia (Baik)</th>
                      <th className="py-2.5 px-3 text-center text-white font-bold bg-slate-950">Rusak</th>
                      <th className="py-2.5 px-3 text-white font-bold bg-slate-950">Lokasi Penyimpanan</th>
                      <th className="py-2.5 px-3 text-center text-white font-bold bg-slate-950">Aksi & Peminjaman</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {paginatedAssets.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Package className="w-10 h-10 text-slate-300" />
                            <p className="font-bold text-slate-600 text-sm">Tidak ada aset inventaris yang ditemukan</p>
                            <p className="text-xs text-slate-400">Coba ubah kata kunci pencarian atau tambah data aset baru.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedAssets.map((asset) => {
                        const isFullyBaik = asset.jumlah_baik === asset.jumlah_total;
                        const hasGoodStock = asset.jumlah_baik > 0;
                        return (
                          <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                            {/* Nama Barang */}
                            <td className="py-2 px-3 font-extrabold text-slate-900 text-xs sm:text-sm capitalize whitespace-nowrap">
                              {asset.nama_barang}
                            </td>

                            {/* Kondisi Badge */}
                            <td className="py-2 px-3 text-center whitespace-nowrap">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border inline-block ${
                                isFullyBaik 
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                                  : hasGoodStock 
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}>
                                {asset.kondisi || 'Baik'}
                              </span>
                            </td>

                            {/* Total Unit */}
                            <td className="py-2 px-3 text-center font-mono font-extrabold text-slate-800 text-xs tabular-nums">
                              {asset.jumlah_total}
                            </td>

                            {/* Unit Baik / Tersedia */}
                            <td className="py-2 px-3 text-center whitespace-nowrap">
                              <span className={`font-mono font-black text-xs tabular-nums px-2 py-0.5 rounded ${
                                asset.jumlah_baik > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400'
                              }`}>
                                {asset.jumlah_baik} unit
                              </span>
                            </td>

                            {/* Unit Rusak */}
                            <td className="py-2 px-3 text-center whitespace-nowrap">
                              <span className={`font-mono font-bold text-xs tabular-nums px-2 py-0.5 rounded ${
                                asset.jumlah_rusak > 0 ? 'bg-rose-50 text-rose-700 border border-rose-200 font-extrabold' : 'text-slate-400'
                              }`}>
                                {asset.jumlah_rusak}
                              </span>
                            </td>

                            {/* Lokasi Penyimpanan */}
                            <td className="py-2 px-3 text-slate-700 font-medium whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Database className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{asset.lokasi_penyimpanan || 'Gudang Kantor RT'}</span>
                              </div>
                            </td>

                            {/* Actions Column */}
                            <td className="py-2 px-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditAsset(asset)}
                                  className="p-1 rounded-lg text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-all cursor-pointer"
                                  title="Edit Data Barang"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDeleteAssetModal(asset)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                                  title="Hapus Barang Permanen"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenAddLoan(asset)}
                                  disabled={asset.jumlah_baik <= 0}
                                  className="px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-600 hover:text-white text-indigo-700 font-extrabold text-[11px] transition-all cursor-pointer flex items-center gap-1 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                                  title="Pinjamkan Aset ke Warga"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>Pinjamkan</span>
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
              <div className="p-4 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 border-t border-slate-200">
                <span>
                  Menampilkan {paginatedAssets.length > 0 ? (currentAssetPage - 1) * assetItemsPerPage + 1 : 0}-
                  {Math.min(currentAssetPage * assetItemsPerPage, filteredAssets.length)} dari {filteredAssets.length} data aset
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentAssetPage((p) => Math.max(p - 1, 1))}
                    disabled={currentAssetPage === 1}
                    className="px-3 py-1.5 bg-white rounded-lg shadow-2xs border border-slate-200 font-semibold text-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer hover:bg-slate-50"
                  >
                    Sebelumnya
                  </button>

                  {Array.from({ length: totalAssetPages }, (_, i) => i + 1).map((pg) => (
                    <button
                      key={pg}
                      onClick={() => setCurrentAssetPage(pg)}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                        currentAssetPage === pg
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {pg}
                    </button>
                  ))}

                  <button
                    onClick={() => setCurrentAssetPage((p) => Math.min(p + 1, totalAssetPages))}
                    disabled={currentAssetPage === totalAssetPages}
                    className="px-3 py-1.5 bg-white rounded-lg shadow-2xs border border-slate-200 font-semibold text-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer hover:bg-slate-50"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* TAMPILAN KARTU GRID (OPSIONAL) */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredAssets.map(asset => (
                <div key={asset.id} className="bg-white rounded-2xl border border-slate-200 shadow-3xs hover:shadow-xs transition-all duration-300 p-5 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-extrabold text-slate-800 text-sm sm:text-base capitalize">
                        {asset.nama_barang}
                      </h4>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${
                        asset.jumlah_baik === asset.jumlah_total 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : asset.jumlah_baik > 0 
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {asset.kondisi || 'Baik'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center text-xs mt-3">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Total</span>
                        <span className="font-extrabold text-slate-800 block text-sm mt-0.5">{asset.jumlah_total}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-500 block font-bold uppercase">Tersedia</span>
                        <span className="font-extrabold text-emerald-600 block text-sm mt-0.5">{asset.jumlah_baik}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-rose-400 block font-bold uppercase">Rusak</span>
                        <span className="font-extrabold text-rose-600 block text-sm mt-0.5">{asset.jumlah_rusak}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-[11px] text-slate-500 mt-4 font-medium">
                      <div className="flex items-center gap-2">
                        <Database className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate"><strong>Lokasi:</strong> {asset.lokasi_penyimpanan || 'Gudang Kantor RT'}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2"><strong>Catatan:</strong> {asset.catatan || `Milik warga ${wilayahShort}.`}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditAsset(asset)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                        title="Edit Data Barang"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDeleteAssetModal(asset)}
                        className="p-1.5 rounded-lg border border-rose-100 hover:bg-rose-50 text-rose-500 hover:text-rose-700 transition-colors cursor-pointer"
                        title="Hapus Barang Permanen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenAddLoan(asset)}
                      disabled={asset.jumlah_baik <= 0}
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-600 hover:text-white text-indigo-700 font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Pinjamkan Aset</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: LOG PEMINJAMAN ASET */}
      {activeSubTab === 'log-peminjaman' && (
        <div className="space-y-4">
          {/* Controls toolbar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center flex-1">
              <div className="relative flex-1 bg-slate-800 border border-slate-700 p-0.5 rounded-xl">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                <input
                  type="text"
                  value={searchLoanQuery}
                  onChange={(e) => {
                    setSearchLoanQuery(e.target.value);
                    setCurrentLoanPage(1);
                  }}
                  placeholder="Cari peminjam, barang, keperluan..."
                  className="w-full pl-10 pr-8 py-2 text-xs sm:text-sm bg-slate-800 border-none rounded-lg text-white placeholder-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
                {searchLoanQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchLoanQuery('');
                      setCurrentLoanPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <select
                value={filterLoanStatus}
                onChange={(e) => {
                  setFilterLoanStatus(e.target.value);
                  setCurrentLoanPage(1);
                }}
                className="px-3.5 py-2 bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-900 outline-none border border-slate-200 focus:border-indigo-500 font-medium cursor-pointer"
              >
                <option value="">Semua Status Log</option>
                <option value="Dipinjam">Sedang Dipinjam</option>
                <option value="Kembali">Sudah Dikembalikan</option>
              </select>

              {(searchLoanQuery || filterLoanStatus) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchLoanQuery('');
                    setFilterLoanStatus('');
                    setCurrentLoanPage(1);
                  }}
                  className="px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition-colors cursor-pointer shrink-0"
                >
                  Reset Filter
                </button>
              )}
            </div>
            
            <button
              type="button"
              onClick={() => handleOpenAddLoan()}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 shrink-0"
            >
              <Plus className="w-4 h-4 text-blue-200" />
              <span>Buat Log Peminjaman Baru</span>
            </button>
          </div>

          {/* Log Table of Loans - BARIS RAPI KE KANAN */}
          {isLoansLoading ? (
            <div className="bg-white p-12 text-center text-slate-400 rounded-2xl border border-slate-200 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
              <p className="text-xs font-semibold">Memuat log peminjaman aset...</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-white font-black border-b border-slate-800 uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-3 text-white font-bold bg-slate-950">Nama Barang</th>
                      <th className="py-2.5 px-3 text-white font-bold bg-slate-950">Peminjam (Warga RT)</th>
                      <th className="py-2.5 px-3 text-center text-white font-bold bg-slate-950">Jumlah Unit</th>
                      <th className="py-2.5 px-3 text-white font-bold bg-slate-950">Tanggal Pinjam</th>
                      <th className="py-2.5 px-3 text-white font-bold bg-slate-950">Tgl Pengembalian</th>
                      <th className="py-2.5 px-3 text-white font-bold bg-slate-950">Keperluan / Catatan</th>
                      <th className="py-2.5 px-3 text-center text-white font-bold bg-slate-950">Status Log</th>
                      <th className="py-2.5 px-3 text-center text-white font-bold bg-slate-950">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {paginatedLoans.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <ArrowRightLeft className="w-10 h-10 text-slate-300" />
                            <p className="font-bold text-slate-600 text-sm">Belum ada catatan peminjaman</p>
                            <p className="text-xs text-slate-400">Gunakan tombol "Buat Log Peminjaman Baru" untuk mencatat warga yang meminjam aset RT.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedLoans.map(loan => (
                        <tr key={loan.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-3 text-slate-900 font-extrabold text-xs sm:text-sm whitespace-nowrap">
                            {loan.barang_nama}
                          </td>

                          <td className="py-2 px-3 whitespace-nowrap">
                            <div className="font-bold text-slate-800 text-xs sm:text-sm">{loan.warga_nama}</div>
                            {loan.warga_hp && (
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                                <span>{loan.warga_hp}</span>
                              </div>
                            )}
                          </td>

                          <td className="py-2 px-3 font-mono font-extrabold text-slate-800 text-center text-xs sm:text-sm tabular-nums">
                            {loan.jumlah_pinjam} unit
                          </td>

                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap font-medium">
                            {formatDateIndo(loan.tanggal_pinjam)}
                          </td>

                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap font-medium">
                            {loan.tanggal_kembali ? (
                              <span className="text-emerald-700 font-bold flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                {formatDateIndo(loan.tanggal_kembali)}
                              </span>
                            ) : (
                              <span className="text-rose-600 font-extrabold flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                <Clock className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                                Masih Dipinjam
                              </span>
                            )}
                          </td>

                          <td className="py-2 px-3 text-slate-600 max-w-xs truncate" title={loan.catatan}>
                            <div className="font-bold text-slate-800">{loan.keperluan || 'Keperluan Umum Warga'}</div>
                            {loan.catatan && <div className="text-[10px] text-slate-400 mt-0.5 italic">{loan.catatan}</div>}
                          </td>

                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                              loan.status === 'Kembali'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}>
                              {loan.status === 'Kembali' ? 'Selesai / Kembali' : 'Dipinjam'}
                            </span>
                          </td>

                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {loan.status === 'Dipinjam' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReturnAssetModal(loan)}
                                  className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] shadow-2xs hover:shadow-xs cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                                  title="Konfirmasi Pengembalian Barang"
                                >
                                  <Undo2 className="w-3.5 h-3.5" />
                                  <span>Kembalikan</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenDeleteLoanModal(loan)}
                                className="p-1 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-colors cursor-pointer"
                                title="Hapus Catatan Log"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer / Pagination */}
              <div className="p-4 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 border-t border-slate-200">
                <span>
                  Menampilkan {paginatedLoans.length > 0 ? (currentLoanPage - 1) * loanItemsPerPage + 1 : 0}-
                  {Math.min(currentLoanPage * loanItemsPerPage, filteredLoans.length)} dari {filteredLoans.length} log peminjaman
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentLoanPage((p) => Math.max(p - 1, 1))}
                    disabled={currentLoanPage === 1}
                    className="px-3 py-1.5 bg-white rounded-lg shadow-2xs border border-slate-200 font-semibold text-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer hover:bg-slate-50"
                  >
                    Sebelumnya
                  </button>

                  {Array.from({ length: totalLoanPages }, (_, i) => i + 1).map((pg) => (
                    <button
                      key={pg}
                      onClick={() => setCurrentLoanPage(pg)}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                        currentLoanPage === pg
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {pg}
                    </button>
                  ))}

                  <button
                    onClick={() => setCurrentLoanPage((p) => Math.min(p + 1, totalLoanPages))}
                    disabled={currentLoanPage === totalLoanPages}
                    className="px-3 py-1.5 bg-white rounded-lg shadow-2xs border border-slate-200 font-semibold text-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer hover:bg-slate-50"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ASSET FORM MODAL (TAMBAH / EDIT ASET) */}
      {isAssetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-400" />
                <h4 className="font-extrabold text-sm">{editingAsset ? 'Koreksi Data Aset RT' : 'Tambah Aset Inventaris Baru'}</h4>
              </div>
              <button 
                type="button" 
                onClick={() => setIsAssetModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveAsset} className="p-5 space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="block text-slate-700">Nama Barang / Aset <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formNamaBarang}
                  onChange={(e) => setFormNamaBarang(e.target.value)}
                  placeholder="Misal: Tenda Warga Biru, Kursi Plastik Hijau, Sound System"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-slate-900"
                />
              </div>

              {/* Quantities stock controls */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-700">Total Unit</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formJumlahTotal}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFormJumlahTotal(val);
                      setFormJumlahBaik(val - formJumlahRusak);
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-center font-bold text-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-emerald-600">Unit Baik</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formJumlahBaik}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFormJumlahBaik(val);
                      setFormJumlahRusak(formJumlahTotal - val);
                    }}
                    className="w-full p-2 bg-emerald-50/50 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-center font-bold text-emerald-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-rose-600">Unit Rusak</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formJumlahRusak}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFormJumlahRusak(val);
                      setFormJumlahBaik(formJumlahTotal - val);
                    }}
                    className="w-full p-2 bg-rose-50/50 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-center font-bold text-rose-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-700">Kondisi Umum</label>
                  <select
                    value={formKondisi}
                    onChange={(e) => setFormKondisi(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none cursor-pointer font-bold text-indigo-900"
                  >
                    <option value="Baik">Sangat Baik / Layak</option>
                    <option value="Rusak Sebagian">Rusak Sebagian</option>
                    <option value="Rusak Berat">Rusak Berat</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-700">Lokasi Penyimpanan</label>
                  <input
                    type="text"
                    value={formLokasi}
                    onChange={(e) => setFormLokasi(e.target.value)}
                    placeholder="Gudang RT, Pos Ronda"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-700">Uraian / Catatan Tambahan</label>
                <textarea
                  value={formCatatan}
                  onChange={(e) => setFormCatatan(e.target.value)}
                  rows={2}
                  placeholder="Keterangan asal-usul, donatur, atau spek barang..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none"
                />
              </div>

              {/* Action Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAssetModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingAsset}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingAsset ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span>Simpan Aset</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: LOAN FORM MODAL (CATAT PEMINJAMAN BARU) */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-400" />
                <h4 className="font-extrabold text-sm">Catat Peminjaman Aset Baru</h4>
              </div>
              <button 
                type="button" 
                onClick={() => setIsLoanModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveLoan} className="p-5 space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="block text-slate-700">Pilih Barang / Aset RT <span className="text-rose-500">*</span></label>
                <select
                  value={formLoanAssetId}
                  onChange={(e) => {
                    const matchedAsset = assets.find(a => a.id === e.target.value);
                    setFormLoanAssetId(e.target.value);
                    if (matchedAsset) setSelectedAssetForLoan(matchedAsset);
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none cursor-pointer font-bold text-indigo-900"
                >
                  <option value="" disabled>-- Pilih Barang Aset --</option>
                  {assets.map(asset => (
                    <option key={asset.id} value={asset.id} disabled={asset.jumlah_baik <= 0}>
                      {asset.nama_barang} (Tersedia: {asset.jumlah_baik} unit)
                    </option>
                  ))}
                </select>
                {selectedAssetForLoan && (
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">
                    Kondisi: <strong className="text-slate-800">{selectedAssetForLoan.kondisi}</strong> • Penyimpanan: <strong className="text-slate-800">{selectedAssetForLoan.lokasi_penyimpanan || 'Gudang RT'}</strong>
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-slate-700">Nama Peminjam (Warga RT) <span className="text-rose-500">*</span></label>
                <select
                  value={formWargaId}
                  onChange={(e) => setFormWargaId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none cursor-pointer font-bold text-slate-800"
                >
                  <option value="" disabled>-- Pilih Warga --</option>
                  {citizens.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nama_lengkap} (KK: {c.no_kk || '-'}) {c.no_hp ? `• ${c.no_hp}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-700">Jumlah Pinjam (Unit) <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formJumlahPinjam}
                    onChange={(e) => setFormJumlahPinjam(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-center font-black text-slate-800 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-700">Tanggal Pinjam</label>
                  <input
                    type="date"
                    required
                    value={formTanggalPinjam}
                    onChange={(e) => setFormLoanDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-700">Keperluan Peminjaman</label>
                <input
                  type="text"
                  required
                  value={formKeperluan}
                  onChange={(e) => setFormKeperluan(e.target.value)}
                  placeholder="Misal: Acara Hajatan Warga, Kerja Bakti, Rapat Karang Taruna"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-700">Catatan Tambahan / Log</label>
                <textarea
                  value={formLoanCatatan}
                  onChange={(e) => setFormLoanCatatan(e.target.value)}
                  rows={2}
                  placeholder="Isi catatan jaminan atau info barang cadangan..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none"
                />
              </div>

              {/* Action Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsLoanModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingLoan}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingLoan ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span>Catat Pinjam</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRM RETURN ASSET MODAL */}
      {isReturnModalOpen && selectedLoanForReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-emerald-950 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Undo2 className="w-5 h-5 text-emerald-400" />
                <h4 className="font-extrabold text-sm">Konfirmasi Pengembalian Barang</h4>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setIsReturnModalOpen(false);
                  setSelectedLoanForReturn(null);
                }}
                className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConfirmReturnAsset} className="p-5 space-y-4 text-xs font-semibold">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 space-y-2 text-emerald-950">
                <p className="font-medium text-slate-500">Detail peminjaman aktif:</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-semibold text-slate-700 text-xs">
                  <div>Nama Barang:</div>
                  <div className="text-slate-900 font-extrabold">{selectedLoanForReturn.barang_nama}</div>
                  <div>Peminjam:</div>
                  <div className="text-slate-900 font-extrabold">{selectedLoanForReturn.warga_nama}</div>
                  <div>Jumlah:</div>
                  <div className="text-slate-900 font-extrabold">{selectedLoanForReturn.jumlah_pinjam} unit</div>
                  <div>Tgl Pinjam:</div>
                  <div className="text-slate-900 font-extrabold">{formatDateIndo(selectedLoanForReturn.tanggal_pinjam)}</div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-700">Tanggal Pengembalian <span className="text-rose-500">*</span></label>
                <input
                  type="date"
                  required
                  value={formTanggalKembali}
                  onChange={(e) => setFormTanggalKembali(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-700">Catatan Pengembalian / Kondisi Barang (Opsional)</label>
                <textarea
                  value={formNotesKembali}
                  onChange={(e) => setFormNotesKembali(e.target.value)}
                  rows={2}
                  placeholder="Misal: Barang kembali lengkap dan dalam kondisi baik."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none"
                />
              </div>

              {/* Action Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsReturnModalOpen(false);
                    setSelectedLoanForReturn(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingReturn}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingReturn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-100" />
                      <span>Konfirmasi Pengembalian</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CONFIRM DELETE ASSET */}
      {isDeleteAssetModalOpen && selectedAssetForDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 text-center space-y-4">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-800 text-base">Hapus Aset Inventaris?</h4>
                <p className="text-slate-500 text-xs">
                  Apakah Anda yakin ingin menghapus aset <strong className="text-slate-800">"{selectedAssetForDelete.nama_barang}"</strong> secara permanen? Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
              
              <div className="bg-slate-50 p-2.5 rounded-xl text-slate-500 text-[10px] text-left border border-slate-100 space-y-0.5 font-medium">
                <div>• Nama: <strong className="text-slate-700">{selectedAssetForDelete.nama_barang}</strong></div>
                <div>• Jumlah Unit: <strong className="text-slate-700">{selectedAssetForDelete.jumlah_total} unit</strong></div>
                <div>• Lokasi: <strong className="text-slate-700">{selectedAssetForDelete.lokasi_penyimpanan || '-'}</strong></div>
              </div>

              <div className="flex items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteAssetModalOpen(false);
                    setSelectedAssetForDelete(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer text-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isDeletingAsset}
                  onClick={handleConfirmDeleteAsset}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer text-xs disabled:opacity-50"
                >
                  {isDeletingAsset ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>Hapus Permanen</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: CONFIRM DELETE LOAN LOG */}
      {isDeleteLoanModalOpen && selectedLoanForDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 text-center space-y-4">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto border border-amber-100">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-800 text-base">Hapus Catatan Log Peminjaman?</h4>
                <p className="text-slate-500 text-xs">
                  Anda akan menghapus log peminjaman barang <strong className="text-slate-800">"{selectedLoanForDelete.barang_nama}"</strong> oleh <strong className="text-slate-800">{selectedLoanForDelete.warga_nama}</strong>.
                </p>
              </div>
              
              {selectedLoanForDelete.status === 'Dipinjam' && (
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-rose-900 text-[10px] text-left leading-relaxed">
                  <strong>Peringatan Penting:</strong> Status peminjaman ini masih <strong>"Dipinjam"</strong>. Menghapus catatan ini secara paksa <strong>TIDAK</strong> akan mengembalikan unit stok secara otomatis. Pastikan barang sudah dikembalikan terlebih dahulu jika ingin stok bertambah kembali.
                </div>
              )}

              <div className="flex items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteLoanModalOpen(false);
                    setSelectedLoanForDelete(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer text-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isDeletingLoan}
                  onClick={handleConfirmDeleteLoan}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer text-xs disabled:opacity-50"
                >
                  {isDeletingLoan ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>Hapus Log</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
