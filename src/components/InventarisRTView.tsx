import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  Plus, 
  FileEdit, 
  Trash2, 
  UserCheck, 
  Calendar, 
  Clock, 
  CheckCircle, 
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
  Undo2
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
  const { wilayahShort } = useSekretariat();

  // Subtabs
  const [activeSubTab, setActiveSubTab] = useState<'daftar-aset' | 'log-peminjaman'>('daftar-aset');

  // Core States
  const [assets, setAssets] = useState<InventarisItem[]>([]);
  const [loans, setLoans] = useState<PeminjamanItem[]>([]);
  const [citizens, setCitizens] = useState<DataWargaItem[]>([]);
  
  const [isAssetsLoading, setIsAssetsLoading] = useState(false);
  const [isLoansLoading, setIsLoansLoading] = useState(false);
  const [isCitizensLoading, setIsCitizensLoading] = useState(false);
  
  const [searchAssetQuery, setSearchAssetQuery] = useState('');
  const [searchLoanQuery, setSearchLoanQuery] = useState('');
  const [tableNotCreated, setTableNotCreated] = useState(false);

  // Modal States
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<InventarisItem | null>(null);
  
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [selectedAssetForLoan, setSelectedAssetForLoan] = useState<InventarisItem | null>(null);

  // Custom Confirmation Modals States
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

  // Filter lists
  const filteredAssets = useMemo(() => {
    if (!searchAssetQuery.trim()) return assets;
    const q = searchAssetQuery.toLowerCase();
    return assets.filter(a => 
      a.nama_barang.toLowerCase().includes(q) ||
      (a.lokasi_penyimpanan || '').toLowerCase().includes(q) ||
      (a.catatan || '').toLowerCase().includes(q)
    );
  }, [assets, searchAssetQuery]);

  const filteredLoans = useMemo(() => {
    if (!searchLoanQuery.trim()) return mappedLoans;
    const q = searchLoanQuery.toLowerCase();
    return mappedLoans.filter(l => 
      (l.barang_nama || '').toLowerCase().includes(q) ||
      (l.warga_nama || '').toLowerCase().includes(q) ||
      (l.keperluan || '').toLowerCase().includes(q) ||
      (l.catatan || '').toLowerCase().includes(q)
    );
  }, [mappedLoans, searchLoanQuery]);

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
      // UPDATE
      const { data, error } = await updateInventarisInSupabase({
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
      // INSERT
      const { data, error } = await insertInventarisToSupabase(payload);
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
      loadLoans(); // Refresh loans too since Cascade is handled
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

    // Insert loan
    const payload = {
      id_barang: formLoanAssetId,
      id_warga: formWargaId,
      tanggal_pinjam: formTanggalPinjam,
      jumlah_pinjam: Number(formJumlahPinjam),
      keperluan: formKeperluan.trim() || undefined,
      status: 'Dipinjam' as const,
      catatan: formLoanCatatan.trim() || undefined,
    };

    const { data, error } = await insertPeminjamanToSupabase(payload);

    if (error) {
      onTriggerToast(`Gagal menyimpan log peminjaman: ${error}`, 'error');
    } else {
      // Deduct good amount from asset stock
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

    // Update loan status to 'Kembali'
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
        // Return qty to good asset stock
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
    <div className="space-y-6">
      {/* Top Brand Banner Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm sm:text-base">
              Manajemen Inventaris & Aset RT.002 RW.09
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola barang milik warga dan log peminjaman aset RT secara digital serta transparan.
            </p>
          </div>
        </div>

        <button 
          type="button"
          onClick={handleRefreshAll}
          disabled={isAssetsLoading || isLoansLoading}
          className="self-end sm:self-auto px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all shadow-2xs flex items-center gap-2 text-xs font-semibold disabled:opacity-50 cursor-pointer"
          title="Segarkan Data Inventaris"
        >
          <RefreshCw className={`w-4 h-4 ${(isAssetsLoading || isLoansLoading) ? 'animate-spin text-indigo-600' : ''}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* SQL Setup Helper for Supabase if tables not created yet */}
      {tableNotCreated && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 text-amber-900 shadow-2xs space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-amber-950">Skema SQL Inventaris & Peminjaman Belum Dibuat</h4>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                Tabel <code className="font-mono bg-amber-100 px-1 rounded font-bold">inventaris_rt</code> dan <code className="font-mono bg-amber-100 px-1 rounded font-bold">peminjaman_aset_rt</code> belum terdeteksi di database Supabase Anda. Aplikasi saat ini menggunakan <strong>Penyimpanan Lokal (Offline)</strong> agar penginputan tetap berjalan lancar.
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

      {/* Segmented Subtabs Control with Elegance Gradient Colors */}
      <div className="bg-slate-100 p-1 rounded-2xl flex text-xs font-bold text-slate-600 max-w-md">
        <button
          type="button"
          onClick={() => setActiveSubTab('daftar-aset')}
          className={`flex-1 py-3 rounded-xl text-center transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'daftar-aset'
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-1 ring-indigo-500/30 font-extrabold'
              : 'hover:text-slate-800 hover:bg-slate-50/50'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>1. Daftar Inventaris & Aset</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('log-peminjaman')}
          className={`flex-1 py-3 rounded-xl text-center transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'log-peminjaman'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-1 ring-indigo-500/30 font-extrabold'
              : 'hover:text-slate-800 hover:bg-slate-50/50'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>2. Log Peminjaman Aset</span>
        </button>
      </div>

      {/* TAB 1: DAFTAR INVENTARIS */}
      {activeSubTab === 'daftar-aset' && (
        <div className="space-y-4">
          {/* Controls toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchAssetQuery}
                onChange={(e) => setSearchAssetQuery(e.target.value)}
                placeholder="Cari nama aset, lokasi, atau catatan..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            
            <button
              type="button"
              onClick={handleOpenAddAsset}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 hover:from-violet-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Aset Inventaris</span>
            </button>
          </div>

          {/* Grid Cards of Assets */}
          {isAssetsLoading ? (
            <div className="bg-white p-12 text-center text-slate-400 rounded-2xl border border-slate-200 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
              <p className="text-xs font-semibold">Memuat daftar aset inventaris RT...</p>
            </div>
          ) : filteredAssets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredAssets.map(asset => (
                <div key={asset.id} className="bg-white rounded-2xl border border-slate-200 shadow-3xs hover:shadow-xs transition-all duration-300 p-5 flex flex-col justify-between space-y-4">
                  <div>
                    {/* Header bar within Card */}
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

                    {/* Stock status table in Card */}
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

                    {/* Metadata items */}
                    <div className="space-y-1.5 text-[11px] text-slate-500 mt-4 font-medium">
                      <div className="flex items-center gap-2">
                        <Database className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate"><strong>Lokasi:</strong> {asset.lokasi_penyimpanan || 'Gudang Kantor RT'}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2"><strong>Catatan:</strong> {asset.catatan || 'Milik warga RT.002 RW.09.'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions buttons inside Card */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditAsset(asset)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                        title="Edit Data Barang"
                      >
                        <FileEdit className="w-3.5 h-3.5" />
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
          ) : (
            <div className="bg-white p-12 text-center text-slate-400 rounded-2xl border border-slate-200 flex flex-col items-center justify-center">
              <Package className="w-12 h-12 text-slate-200 mb-2" />
              <p className="text-xs font-bold text-slate-500">Belum Ada Aset Terdata</p>
              <p className="text-[10px] text-slate-400 max-w-xs mt-1">
                Gunakan tombol "Tambah Aset Inventaris" di kanan atas untuk mendaftarkan barang baru seperti tenda, kursi, alat fogging dll.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LOG PEMINJAMAN */}
      {activeSubTab === 'log-peminjaman' && (
        <div className="space-y-4">
          {/* Controls toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchLoanQuery}
                onChange={(e) => setSearchLoanQuery(e.target.value)}
                placeholder="Cari peminjam, barang, keperluan..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            
            <button
              type="button"
              onClick={() => handleOpenAddLoan()}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Log Peminjaman Baru</span>
            </button>
          </div>

          {/* Log Table of Loans */}
          {isLoansLoading ? (
            <div className="bg-white p-12 text-center text-slate-400 rounded-2xl border border-slate-200 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
              <p className="text-xs font-semibold">Memuat log peminjaman aset...</p>
            </div>
          ) : filteredLoans.length > 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider text-[10px]">
                    <th className="p-3">Nama Barang</th>
                    <th className="p-3">Peminjam Warga</th>
                    <th className="p-3">Unit</th>
                    <th className="p-3">Tanggal Pinjam</th>
                    <th className="p-3">Tgl Pengembalian</th>
                    <th className="p-3">Keperluan / Keterangan</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredLoans.map(loan => (
                    <tr key={loan.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Name of asset */}
                      <td className="p-3 text-slate-800 font-bold whitespace-nowrap">
                        {loan.barang_nama}
                      </td>

                      {/* Name of citizen */}
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{loan.warga_nama}</div>
                        {loan.warga_hp && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                            <Phone className="w-2.5 h-2.5 shrink-0" />
                            <span>{loan.warga_hp}</span>
                          </div>
                        )}
                      </td>

                      {/* Quantity borrow */}
                      <td className="p-3 font-mono font-bold text-slate-800 text-center">
                        {loan.jumlah_pinjam} unit
                      </td>

                      {/* Date pinjam */}
                      <td className="p-3 text-slate-500 whitespace-nowrap">
                        {formatDateIndo(loan.tanggal_pinjam)}
                      </td>

                      {/* Date kembali */}
                      <td className="p-3 text-slate-500 whitespace-nowrap">
                        {loan.tanggal_kembali ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                            {formatDateIndo(loan.tanggal_kembali)}
                          </span>
                        ) : (
                          <span className="text-rose-500 font-bold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 animate-pulse" />
                            Masih Dipinjam
                          </span>
                        )}
                      </td>

                      {/* Reason/purpose & Notes */}
                      <td className="p-3 text-slate-600 max-w-[200px] truncate" title={loan.catatan}>
                        <div className="font-semibold text-slate-700">{loan.keperluan || 'Keperluan Umum'}</div>
                        {loan.catatan && <div className="text-[10px] text-slate-400 mt-0.5 italic">{loan.catatan}</div>}
                      </td>

                      {/* Status badge */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black border ${
                          loan.status === 'Kembali'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {loan.status === 'Kembali' ? 'Selesai' : 'Dipinjam'}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {loan.status === 'Dipinjam' && (
                            <button
                              type="button"
                              onClick={() => handleOpenReturnAssetModal(loan)}
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] shadow-2xs hover:shadow-sm cursor-pointer transition-all active:scale-95"
                              title="Konfirmasi Pengembalian Barang"
                            >
                              Kembalikan
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteLoanModal(loan)}
                            className="p-1 rounded border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-colors cursor-pointer"
                            title="Hapus Catatan Log"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white p-12 text-center text-slate-400 rounded-2xl border border-slate-200 flex flex-col items-center justify-center">
              <ArrowRightLeft className="w-12 h-12 text-slate-200 mb-2" />
              <p className="text-xs font-bold text-slate-500">Belum Ada Catatan Peminjaman</p>
              <p className="text-[10px] text-slate-400 max-w-xs mt-1">
                Gunakan tombol "Buat Log Peminjaman Baru" untuk mencatat warga yang meminjam inventaris milik RT.
              </p>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ASSET FORM MODAL */}
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
                  placeholder="Misal: Tenda Warga Biru, Kursi Plastik Hijau"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
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
                      <CheckCircle className="w-4 h-4" />
                      <span>Simpan Aset</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: LOAN FORM MODAL */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-400" />
                <h4 className="font-extrabold text-sm">Formulir Log Peminjaman Aset RT</h4>
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
                <label className="block text-slate-700">Pilih Barang / Aset <span className="text-rose-500">*</span></label>
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
                  <p className="text-[10px] text-slate-400 mt-1 font-medium">
                    Kondisi: {selectedAssetForLoan.kondisi} • Penyimpanan: {selectedAssetForLoan.lokasi_penyimpanan || 'Gudang'}
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
                  placeholder="Misal: Acara Hajatan Warga, Rapat Karang Taruna"
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
                      <CheckCircle className="w-4 h-4" />
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
                      <CheckCircle className="w-4 h-4" />
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
