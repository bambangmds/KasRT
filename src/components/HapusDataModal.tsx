import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Trash2,
  AlertTriangle,
  Loader2,
  ShieldAlert,
  Info,
  CheckCircle2,
  Database,
  Layers,
  Building2,
  Users,
  Tag,
  ChevronDown,
  RefreshCw,
  Siren,
  Package,
  ClipboardList,
} from 'lucide-react';
import { Transaction, CategoryItem } from '../types';
import { useSekretariat } from '../context/SekretariatContext';
import {
  deleteAllKasFromSupabase,
  deleteAllWargaFromSupabase,
  deleteAllCategoriesFromSupabase,
  deleteAllPenggunaFromSupabase,
  deleteAllSekretariatFromSupabase,
  clearInventarisInSupabase,
  clearPeminjamanInSupabase,
  clearDaruratInSupabase,
  fetchAllPengurusFromSupabase,
  fetchDataWargaFromSupabase,
  getSekretariatFromSupabase,
  fetchInventarisFromSupabase,
  fetchPeminjamanFromSupabase,
  fetchActiveEmergencyAlerts,
} from '../lib/supabase';

interface HapusDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  categories: CategoryItem[];
  connectionStatus: 'connected' | 'connecting' | 'error' | 'demo' | any;
  onDeleteComplete: () => Promise<void> | void;
  onTriggerToast?: (msg: string, type?: 'success' | 'error' | 'info', title?: string) => void;
}

type DeleteType = 'all_tables' | 'single_table';

export const HapusDataModal: React.FC<HapusDataModalProps> = ({
  isOpen,
  onClose,
  transactions,
  categories,
  connectionStatus,
  onDeleteComplete,
  onTriggerToast,
}) => {
  const [deleteType, setDeleteType] = useState<DeleteType>('single_table');
  const [selectedTable, setSelectedTable] = useState<string>('kas_rt');
  const [isConfirmChecked, setIsConfirmChecked] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live row counts state for all 8 tables
  const [kasCount, setKasCount] = useState(transactions.length);
  const [wargaCount, setWargaCount] = useState(0);
  const [kategoriCount, setKategoriCount] = useState(categories.length);
  const [penggunaCount, setPenggunaCount] = useState(0);
  const [sekretariatCount, setSekretariatCount] = useState(0);
  const [inventarisCount, setInventarisCount] = useState(0);
  const [peminjamanCount, setPeminjamanCount] = useState(0);
  const [daruratCount, setDaruratCount] = useState(0);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);

  const isConnected = connectionStatus === 'connected';

  // Fetch live counts for all 8 tables
  const fetchLiveCounts = async () => {
    if (!isOpen) return;
    setIsLoadingCounts(true);
    try {
      setKasCount(transactions.length);
      setKategoriCount(categories.length);

      if (isConnected) {
        const [wData, pData, sData, invData, pinjamData, daruratData] = await Promise.all([
          fetchDataWargaFromSupabase().catch(() => []),
          fetchAllPengurusFromSupabase().catch(() => []),
          getSekretariatFromSupabase().catch(() => ({ data: null, isDbEmpty: true })),
          fetchInventarisFromSupabase().catch(() => ({ data: [] })),
          fetchPeminjamanFromSupabase().catch(() => ({ data: [] })),
          fetchActiveEmergencyAlerts().catch(() => ({ data: [] })),
        ]);

        setWargaCount(wData?.length || 0);
        setPenggunaCount(pData?.length || 0);
        setSekretariatCount(sData?.data && !sData.isDbEmpty ? 1 : 0);
        setInventarisCount(invData?.data?.length || 0);
        setPeminjamanCount(pinjamData?.data?.length || 0);
        setDaruratCount(daruratData?.data?.length || 0);
      } else {
        // Local storage fallbacks
        try {
          const wRaw = localStorage.getItem('kas_rt_data_warga');
          setWargaCount(wRaw ? JSON.parse(wRaw).length : 0);

          const pRaw = localStorage.getItem('kas_rt_registered_users');
          setPenggunaCount(pRaw ? JSON.parse(pRaw).length : 0);

          const sRaw = localStorage.getItem('kas_rt_sekretariat');
          setSekretariatCount(sRaw ? 1 : 0);

          const invRaw = localStorage.getItem('kas_rt_inventaris');
          setInventarisCount(invRaw ? JSON.parse(invRaw).length : 0);

          const pinjamRaw = localStorage.getItem('kas_rt_peminjaman_aset');
          setPeminjamanCount(pinjamRaw ? JSON.parse(pinjamRaw).length : 0);

          const daruratRaw = localStorage.getItem('kas_rt_emergency_alerts');
          setDaruratCount(daruratRaw ? JSON.parse(daruratRaw).length : 0);
        } catch {
          // Ignore
        }
      }
    } catch (err) {
      console.error('Gagal mengambil baris live 8 tabel', err);
    } finally {
      setIsLoadingCounts(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLiveCounts();
      setIsConfirmChecked(false);
      setConfirmText('');
      setErrorMessage(null);
    }
  }, [isOpen, connectionStatus, transactions.length, categories.length]);

  // Table options config for all 8 tables:
  // darurat_rt, data_warga, inventaris_rt, kas_rt, kategori, peminjaman_aset_rt, pengguna, sekretariat
  const TABLES = useMemo(() => {
    return [
      {
        id: 'darurat_rt',
        name: 'darurat_rt',
        label: '1. Tabel Peringatan Darurat SOS (darurat_rt)',
        icon: Siren,
        color: 'text-rose-600 bg-rose-50 border-rose-200',
        description: 'Menampung catatan riwayat sinyal sirene SOS darurat medis, keamanan, kebakaran, dan bencana alam warga RT.',
        warning: 'Seluruh riwayat sinyal darurat SOS warga akan dihapus permanen dari server database.',
        confirmWord: 'HAPUS TABEL DARURAT_RT',
        count: daruratCount,
        unit: 'sinyal darurat',
      },
      {
        id: 'data_warga',
        name: 'data_warga',
        label: '2. Tabel Master Data Warga (data_warga)',
        icon: Users,
        color: 'text-blue-600 bg-blue-50 border-blue-200',
        description: 'Menampung master data kependudukan warga RT, nama Kepala Keluarga, NIK, No. KK, No HP, serta alamat domisili.',
        warning: 'Daftar data warga RT akan dikosongkan secara permanen. Catatan transaksi kas yang merujuk pada nama warga tertentu di masa lalu akan kehilangan keterkaitannya.',
        confirmWord: 'HAPUS TABEL DATA_WARGA',
        count: wargaCount,
        unit: 'KK warga',
      },
      {
        id: 'inventaris_rt',
        name: 'inventaris_rt',
        label: '3. Tabel Inventaris & Aset RT (inventaris_rt)',
        icon: Package,
        color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
        description: 'Menampung daftar inventaris, aset, barang modal lingkungan, lokasi penyimpanan, dan kondisi fisik barang.',
        warning: 'Seluruh catatan inventaris barang milik RT akan dikosongkan secara permanen dari basis data.',
        confirmWord: 'HAPUS TABEL INVENTARIS_RT',
        count: inventarisCount,
        unit: 'unit barang',
      },
      {
        id: 'kas_rt',
        name: 'kas_rt',
        label: '4. Tabel Buku Kas & Transaksi (kas_rt)',
        icon: Trash2,
        color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
        description: 'Menampung catatan mutasi kas masuk (iuran warga, donasi, bantuan masjid) dan kas keluar (kebersihan, keamanan, perbaikan jalan, biaya keRTan).',
        warning: 'Seluruh nominal saldo pembukuan dan rincian transaksi akan direset ke nol secara permanen. Sangat direkomendasikan untuk mengekspor data atau mendownload backup terlebih dahulu!',
        confirmWord: 'HAPUS TABEL KAS_RT',
        count: kasCount,
        unit: 'catatan transaksi',
      },
      {
        id: 'kategori',
        name: 'kategori',
        label: '5. Tabel Kategori Pos Anggaran (kategori)',
        icon: Tag,
        color: 'text-purple-600 bg-purple-50 border-purple-200',
        description: 'Menampung master daftar nama pos pemasukan dan pos pengeluaran anggaran keuangan RT yang dinamis.',
        warning: 'Semua kategori kustom pos anggaran akan terhapus dari basis data.',
        confirmWord: 'HAPUS TABEL KATEGORI',
        count: kategoriCount,
        unit: 'pos anggaran',
      },
      {
        id: 'peminjaman_aset_rt',
        name: 'peminjaman_aset_rt',
        label: '6. Tabel Log Peminjaman Aset (peminjaman_aset_rt)',
        icon: ClipboardList,
        color: 'text-orange-600 bg-orange-50 border-orange-200',
        description: 'Menampung riwayat transaksi peminjaman dan pengembalian barang inventaris oleh warga RT.',
        warning: 'Seluruh log riwayat peminjaman barang inventaris akan dikosongkan permanen.',
        confirmWord: 'HAPUS TABEL PEMINJAMAN_ASET_RT',
        count: peminjamanCount,
        unit: 'peminjaman',
      },
      {
        id: 'pengguna',
        name: 'pengguna',
        label: '7. Tabel Akun Pengguna / Pengurus (pengguna)',
        icon: ShieldAlert,
        color: 'text-amber-600 bg-amber-50 border-amber-200',
        description: 'Menampung data kredensial akun login pengurus RT (Ketua RT, Sekretaris, Bendahara, Warga, dll).',
        warning: 'Seluruh akun pengurus akan dihapus permanen. Sesi masuk Anda saat ini akan segera kedaluwarsa secara paksa dan Anda harus melakukan pendaftaran akun baru!',
        confirmWord: 'HAPUS TABEL PENGGUNA',
        count: penggunaCount,
        unit: 'akun pengurus',
      },
      {
        id: 'sekretariat',
        name: 'sekretariat',
        label: '8. Tabel Profil & Wilayah RT (sekretariat)',
        icon: Building2,
        color: 'text-teal-600 bg-teal-50 border-teal-200',
        description: 'Menampung profil identitas RT, RW, Kelurahan, Kecamatan, Kota, nama Ketua RT aktif, serta alamat fisik sekretariat.',
        warning: 'Profil identitas RT akan dikosongkan. Aplikasi akan mendeteksi status database kosong dan otomatis mengarahkan Anda ke halaman pengaturan awal wilayah sebelum menu lainnya dapat diakses.',
        confirmWord: 'HAPUS TABEL SEKRETARIAT',
        count: sekretariatCount,
        unit: 'data wilayah',
      },
    ];
  }, [kasCount, wargaCount, kategoriCount, penggunaCount, sekretariatCount, inventarisCount, peminjamanCount, daruratCount]);

  const activeTableInfo = useMemo(() => {
    return TABLES.find((t) => t.id === selectedTable) || TABLES[0];
  }, [TABLES, selectedTable]);

  // Check delete criteria
  const isDeleteEnabled = useMemo(() => {
    if (isDeleting) return false;
    if (!isConfirmChecked) return false;

    if (deleteType === 'all_tables') {
      return confirmText.trim().toUpperCase() === 'HAPUS SEMUA TABEL';
    } else {
      return confirmText.trim().toUpperCase() === activeTableInfo.confirmWord;
    }
  }, [isDeleting, isConfirmChecked, deleteType, confirmText, activeTableInfo]);

  const handleClose = () => {
    if (isDeleting) return;
    onClose();
  };

  // Perform single table deletion logic for all 8 tables
  const executeSingleTableDelete = async (tableId: string) => {
    if (tableId === 'kas_rt') {
      if (isConnected) {
        const res = await deleteAllKasFromSupabase();
        if (!res.success) throw new Error(res.error || 'Gagal menghapus kas_rt di Supabase');
      }
      localStorage.setItem('kas_rt_transactions', JSON.stringify([]));
    } else if (tableId === 'data_warga') {
      if (isConnected) {
        const res = await deleteAllWargaFromSupabase();
        if (!res.success) throw new Error(res.error || 'Gagal menghapus data_warga di Supabase');
      }
      localStorage.setItem('kas_rt_data_warga', JSON.stringify([]));
    } else if (tableId === 'kategori') {
      if (isConnected) {
        const res = await deleteAllCategoriesFromSupabase();
        if (!res.success) throw new Error(res.error || 'Gagal menghapus kategori di Supabase');
      }
      localStorage.setItem('kas_rt_categories', JSON.stringify([]));
    } else if (tableId === 'inventaris_rt') {
      if (isConnected) {
        const res = await clearInventarisInSupabase();
        if (!res.success) throw new Error(res.error || 'Gagal menghapus inventaris_rt di Supabase');
      }
      localStorage.setItem('kas_rt_inventaris', JSON.stringify([]));
    } else if (tableId === 'peminjaman_aset_rt') {
      if (isConnected) {
        const res = await clearPeminjamanInSupabase();
        if (!res.success) throw new Error(res.error || 'Gagal menghapus peminjaman_aset_rt di Supabase');
      }
      localStorage.setItem('kas_rt_peminjaman_aset', JSON.stringify([]));
    } else if (tableId === 'darurat_rt') {
      if (isConnected) {
        const res = await clearDaruratInSupabase();
        if (!res.success) throw new Error(res.error || 'Gagal menghapus darurat_rt di Supabase');
      }
      localStorage.setItem('kas_rt_emergency_alerts', JSON.stringify([]));
    } else if (tableId === 'pengguna') {
      if (isConnected) {
        const res = await deleteAllPenggunaFromSupabase();
        if (!res.success) throw new Error(res.error || 'Gagal menghapus pengguna di Supabase');
      }
      localStorage.removeItem('kas_rt_registered_users');
      sessionStorage.removeItem('kas_rt_active_user');
    } else if (tableId === 'sekretariat') {
      if (isConnected) {
        const res = await deleteAllSekretariatFromSupabase();
        if (!res.success) throw new Error(res.error || 'Gagal menghapus sekretariat di Supabase');
      }
      localStorage.removeItem('kas_rt_sekretariat');
    }
  };

  const handleExecuteDelete = async () => {
    if (!isDeleteEnabled) return;
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      if (deleteType === 'all_tables') {
        // Delete all 8 tables sequentially
        const errors: string[] = [];

        const tableOrder = [
          'darurat_rt',
          'peminjaman_aset_rt',
          'inventaris_rt',
          'kas_rt',
          'data_warga',
          'kategori',
          'sekretariat',
          'pengguna', // delete last because it logs out active user
        ];

        for (const tbl of tableOrder) {
          try {
            await executeSingleTableDelete(tbl);
          } catch (e: any) {
            errors.push(`${tbl}: ${e.message}`);
          }
        }

        if (errors.length > 0) {
          throw new Error(`Selesai dengan beberapa galat:\n${errors.join('\n')}`);
        }

        if (onTriggerToast) {
          onTriggerToast(
            'Seluruh data sistem pada 8 tabel telah dikosongkan secara total.',
            'success',
            'Sistem Direset Total (8 Tabel)'
          );
        }

        // Triggers refresh & reload page to start configuration fresh
        await onDeleteComplete();
        onClose();
        setTimeout(() => {
          window.location.reload();
        }, 1500);

      } else {
        // Single table delete
        await executeSingleTableDelete(selectedTable);

        if (onTriggerToast) {
          onTriggerToast(
            `Data pada tabel "${activeTableInfo.name}" berhasil dihapus bersih secara permanen.`,
            'success',
            'Tabel Berhasil Dikosongkan'
          );
        }

        await onDeleteComplete();

        // Specific reloads if core tables are affected
        if (selectedTable === 'pengguna' || selectedTable === 'sekretariat') {
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          fetchLiveCounts();
          setConfirmText('');
          setIsConfirmChecked(false);
          onClose();
        }
      }
    } catch (err: any) {
      console.error('[Hapus Data Error]', err);
      setErrorMessage(err.message || 'Terjadi kesalahan sistem saat menghapus data.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="modal-hapus-data"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="bg-rose-950 px-6 py-4 flex items-center justify-between border-b border-rose-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-900/60 border border-rose-700/50 flex items-center justify-center text-rose-200 shrink-0">
              <Trash2 className="w-5 h-5 text-rose-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                  Penghapusan Data Permanen (8 Tabel Database)
                </h3>
                <span className="text-[10px] font-bold bg-rose-500/20 text-rose-200 px-2 py-0.5 rounded-full border border-rose-400/20 shrink-0">
                  {isConnected ? 'Supabase Live' : 'Offline Mode'}
                </span>
              </div>
              <p className="text-xs text-rose-200/80 mt-0.5 leading-tight">
                Hapus bersih data spesifik atau reset total seluruh 8 tabel database RT
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting}
            className="text-rose-300 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
            title="Tutup dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Peringatan Bahaya Keamanan */}
          <div className="p-4 bg-rose-50 rounded-xl border border-rose-200/80 text-xs text-rose-900 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block text-rose-950">
                Peringatan Keras Keamanan: Operasi Tidak Dapat Dibatalkan!
              </span>
              <p className="text-rose-800/90 leading-relaxed text-[11px]">
                Tindakan ini akan menghapus data secara fisik dari server Supabase secara permanen. Pastikan Anda telah mengunduh <strong>File Backup (.json / .sql)</strong> terlebih dahulu untuk berjaga-jaga jika ingin memulihkannya kembali.
              </p>
            </div>
          </div>

          {/* Tab Selector Pilihan Jenis Penghapusan */}
          <div>
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2">
              Pilih Alur Penghapusan:
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => {
                  setDeleteType('single_table');
                  setConfirmText('');
                  setIsConfirmChecked(false);
                }}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  deleteType === 'single_table'
                    ? 'bg-white text-rose-700 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Database className="w-3.5 h-3.5" />
                  <span>1. Hapus Tabel Tertentu</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDeleteType('all_tables');
                  setConfirmText('');
                  setIsConfirmChecked(false);
                }}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  deleteType === 'all_tables'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-rose-700'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Layers className="w-3.5 h-3.5" />
                  <span>2. Reset Total (8 Tabel)</span>
                </div>
              </button>
            </div>
          </div>

          {/* OPSI 1: Hapus Data Tabel Tertentu */}
          {deleteType === 'single_table' && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              {/* Dropdown Pemilih Tabel */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Pilih Tabel yang Ingin Dikosongkan (Total 8 Tabel):
                </label>
                <div className="relative">
                  <select
                    value={selectedTable}
                    onChange={(e) => {
                      setSelectedTable(e.target.value);
                      setConfirmText('');
                      setIsConfirmChecked(false);
                    }}
                    className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3.5 py-3 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 appearance-none cursor-pointer"
                  >
                    {TABLES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label} {isLoadingCounts ? '(memuat...)' : `— ${t.count} ${t.unit}`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Detail Tabel Aktif yang Dipilih */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${activeTableInfo.color}`}>
                      <activeTableInfo.icon className="w-4 h-4" />
                    </div>
                    <span className="font-extrabold text-xs sm:text-sm text-slate-900 block">
                      {activeTableInfo.label}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={fetchLiveCounts}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                      title="Segarkan Jumlah Baris Live"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCounts ? 'animate-spin text-indigo-600' : ''}`} />
                    </button>
                    <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      {isLoadingCounts ? '...' : activeTableInfo.count} {activeTableInfo.unit}
                    </span>
                  </div>
                </div>

                <div className="text-slate-600 leading-relaxed text-[11px] space-y-2">
                  <p>{activeTableInfo.description}</p>
                  
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span className="font-semibold text-[10px] leading-relaxed">
                      {activeTableInfo.warning}
                    </span>
                  </div>
                </div>

                {/* Form Ketik Konfirmasi Spesifik */}
                <div className="pt-2 border-t border-slate-200">
                  <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1.5">
                    Ketik kata kunci untuk mengonfirmasi penghapusan tabel ini:
                  </label>
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder={`Ketik: ${activeTableInfo.confirmWord}`}
                      className="w-full text-xs font-mono bg-white border border-rose-200 rounded-lg px-3 py-2 text-rose-950 placeholder:text-rose-300 focus:outline-hidden focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 uppercase"
                    />
                    <p className="text-[10px] text-slate-400 font-medium">
                      Masukkan teks <span className="font-mono text-rose-700 bg-rose-50 px-1 py-0.5 rounded">{activeTableInfo.confirmWord}</span> dengan huruf kapital.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* OPSI 2: Hapus Data Semua 8 Tabel (Reset Total) */}
          {deleteType === 'all_tables' && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              <div className="bg-rose-50 border border-rose-300 p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-extrabold text-rose-950 uppercase tracking-wider block">
                  Cakupan Penghapusan Bersih Seluruh 8 Tabel Database:
                </h4>

                {/* Daftar Kedelapan Tabel yang akan Dikosongkan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {TABLES.map((t) => (
                    <div key={t.id} className="bg-white p-2.5 rounded-lg border border-rose-200/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate pr-1">
                        <t.icon className="w-4 h-4 text-rose-600 shrink-0" />
                        <span className="font-bold text-slate-800 truncate">{t.name}</span>
                      </div>
                      <span className="font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded text-[10px] shrink-0 border border-rose-100">
                        {isLoadingCounts ? '...' : t.count} {t.unit}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-rose-100 rounded-lg border border-rose-200 text-[11px] text-rose-900 leading-relaxed">
                  <strong>PENTING:</strong> Reset total ini akan membersihkan data dari kedelapan tabel: sinyal darurat SOS (<strong>darurat_rt</strong>), kependudukan (<strong>data_warga</strong>), barang (<strong>inventaris_rt</strong>), transaksi keuangan (<strong>kas_rt</strong>), pos anggaran (<strong>kategori</strong>), peminjaman (<strong>peminjaman_aset_rt</strong>), profil wilayah (<strong>sekretariat</strong>), dan akun pengurus (<strong>pengguna</strong>). Sistem akan dikembalikan ke kondisi awal.
                </div>

                {/* Form Ketik Konfirmasi Semua Tabel */}
                <div className="pt-2 border-t border-rose-200">
                  <label className="text-[10px] font-bold text-rose-950 uppercase block mb-1.5">
                    Ketik kata kunci untuk mengonfirmasi reset total 8 tabel:
                  </label>
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="Ketik: HAPUS SEMUA TABEL"
                      className="w-full text-xs font-mono bg-white border border-rose-400 rounded-lg px-3 py-2 text-rose-950 placeholder:text-rose-300 focus:outline-hidden focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 uppercase"
                    />
                    <p className="text-[10px] text-rose-800/80 font-medium">
                      Masukkan teks <span className="font-mono text-rose-950 bg-rose-200/50 px-1.5 py-0.5 rounded">HAPUS SEMUA TABEL</span> dengan huruf kapital.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Checkbox Konfirmasi Akhir */}
          <div className="pt-3 border-t border-slate-200">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isConfirmChecked}
                onChange={(e) => setIsConfirmChecked(e.target.checked)}
                className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 mt-0.5 cursor-pointer"
              />
              <span className="text-xs text-slate-700 font-medium leading-relaxed">
                {deleteType === 'all_tables' ? (
                  <>
                    Saya mengerti dan menyetujui bahwa <strong>seluruh isi 8 tabel sistem</strong> akan dihapus permanen. Saya memahami ini akan menghapus akun login saya dan mereset sistem ke kondisi awal.
                  </>
                ) : (
                  <>
                    Saya yakin ingin mengosongkan <strong>{activeTableInfo.label}</strong> ({activeTableInfo.count} {activeTableInfo.unit}) secara permanen dari server database.
                  </>
                )}
              </span>
            </label>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleExecuteDelete}
            disabled={!isDeleteEnabled}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Memproses Penghapusan...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 text-white" />
                <span>
                  {deleteType === 'all_tables'
                    ? 'Hapus Semua Data (Reset Total 8 Tabel)'
                    : `Hapus Bersih Tabel ${activeTableInfo.name.toUpperCase()}`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
