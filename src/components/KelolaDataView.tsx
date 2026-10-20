import React, { useState, useMemo } from 'react';
import {
  Database,
  RotateCcw,
  Upload,
  Trash2,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  FileSpreadsheet,
  FileJson,
  FileCode2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  HardDrive,
  DownloadCloud,
  ChevronRight,
  Sparkles,
  Building2,
} from 'lucide-react';
import { Transaction, CategoryItem, SupabaseConnectionStatus } from '../types';
import { BackupModal } from './BackupModal';
import { RestoreModal } from './RestoreModal';
import { HapusDataModal } from './HapusDataModal';
import { SekretariatModal } from './SekretariatModal';
import { useSekretariat } from '../context/SekretariatContext';

interface KelolaDataViewProps {
  transactions: Transaction[];
  categories: CategoryItem[];
  connectionStatus: SupabaseConnectionStatus;
  onRefresh: () => Promise<void> | void;
  isRefreshing: boolean;
  onOpenImport: () => void;
  onTriggerToast: (msg: string, type?: 'success' | 'error' | 'info', title?: string) => void;
}

export const KelolaDataView: React.FC<KelolaDataViewProps> = ({
  transactions,
  categories,
  connectionStatus,
  onRefresh,
  isRefreshing,
  onOpenImport,
  onTriggerToast,
}) => {
  const { sekretariat, wilayahShort, kelurahanLabel } = useSekretariat();

  // Modal dialog states
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isHapusModalOpen, setIsHapusModalOpen] = useState(false);
  const [isSekretariatModalOpen, setIsSekretariatModalOpen] = useState(false);
  const [sekretariatModalMode, setSekretariatModalMode] = useState<'edit' | 'delete'>('edit');

  // Statistics calculation for kas_rt
  const stats = useMemo(() => {
    let totalMasuk = 0;
    let totalKeluar = 0;
    transactions.forEach((t) => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'Masuk') {
        totalMasuk += amt;
      } else {
        totalKeluar += amt;
      }
    });
    return {
      totalCount: transactions.length,
      totalMasuk,
      totalKeluar,
      netSaldo: totalMasuk - totalKeluar,
    };
  }, [transactions]);

  const isConnected = connectionStatus === 'connected';

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* 1. Header Halaman Kelola Data */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
              Sistem Basis Data {wilayahShort}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold text-slate-500">
              {kelurahanLabel}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Database className="w-6 h-6 text-indigo-600 shrink-0" />
            <span>Kelola Data & Cadangan Database</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Pusat administrasi dan pemeliharaan tabel kas: pencadangan (backup), pemulihan (restore), profil sekretariat wilayah, import transaksi Excel, serta reset data kas_rt secara aman.
          </p>
        </div>

        {/* Action Buttons: Status & Segarkan */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsSekretariatModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-xs active:scale-95 cursor-pointer"
            title="Ubah nomor RT, RW, Kelurahan, dan Alamat Sekretariat"
          >
            <Building2 className="w-4 h-4 text-emerald-100" />
            <span>Identitas Wilayah ({wilayahShort})</span>
          </button>

          <div
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all shadow-2xs ${
              isConnected
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}
            title="Status Database Supabase"
          >
            <span className="relative flex h-2 w-2">
              {isConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isConnected ? 'bg-emerald-600' : 'bg-amber-500'
                }`}
              />
            </span>
            <span>{isConnected ? 'Supabase Live Aktif' : 'Penyimpanan Lokal'}</span>
            <Database className="w-3.5 h-3.5 ml-0.5 opacity-70" />
          </div>

          <button
            type="button"
            onClick={() => onRefresh()}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-all border border-slate-300 shadow-2xs cursor-pointer disabled:opacity-50"
            title="Segarkan Data dari Database"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            <span>{isRefreshing ? 'Memuat...' : 'Segarkan Data'}</span>
          </button>
        </div>
      </div>

      {/* 2. Kartu Ringkasan Isi Database kas_rt */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Transaksi */}
        <div className="bg-gradient-to-br from-white via-white to-indigo-50/40 rounded-xl p-4 sm:p-5 border border-indigo-200/70 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Total Catatan Kas
            </span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">
              {stats.totalCount.toLocaleString('id-ID')}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Baris mutasi di tabel <code className="font-mono text-indigo-700 font-bold">kas_rt</code>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/20 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Total Kas Masuk */}
        <div className="bg-gradient-to-br from-white via-white to-emerald-50/40 rounded-xl p-4 sm:p-5 border border-emerald-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">
              Total Kas Masuk
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-700 mt-1 block">
              Rp {stats.totalMasuk.toLocaleString('id-ID')}
            </span>
            <span className="text-[11px] text-emerald-600/80 mt-0.5 block">
              Penerimaan iuran & bantuan warga
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20 flex items-center justify-center shrink-0">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </div>

        {/* Total Kas Keluar */}
        <div className="bg-gradient-to-br from-white via-white to-rose-50/40 rounded-xl p-4 sm:p-5 border border-rose-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider block">
              Total Kas Keluar
            </span>
            <span className="text-xl sm:text-2xl font-black text-rose-700 mt-1 block">
              Rp {stats.totalKeluar.toLocaleString('id-ID')}
            </span>
            <span className="text-[11px] text-rose-600/80 mt-0.5 block">
              Pengeluaran & operasional RT
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-600 text-white shadow-md shadow-rose-600/20 flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        {/* Saldo Bersih */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 rounded-xl p-4 sm:p-5 border border-slate-700/60 shadow-md flex items-center justify-between text-white relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-emerald-500/15 rounded-full blur-xl pointer-events-none" />
          <div className="relative">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Saldo Buku Kas Saat Ini
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 block tracking-tight">
              Rp {stats.netSaldo.toLocaleString('id-ID')}
            </span>
            <span className="text-[11px] text-slate-300 mt-0.5 block">
              Posisi kas siap pakai kas RT
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 flex items-center justify-center text-emerald-300 shrink-0 shadow-xs relative">
            <Wallet className="w-6 h-6 text-emerald-300" />
          </div>
        </div>
      </div>

      {/* 3. Grid 4 Modul Aksi Utama */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <span>Pilihan Tindakan Pemeliharaan Basis Data</span>
          </h2>
          <span className="text-xs text-slate-500">5 Modul Tersedia</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {/* Modul 1: Backup Database */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform">
                  <Database className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                  Semua 8 Tabel
                </span>
              </div>

              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 group-hover:text-indigo-900 transition-colors">
                  Backup Database Penuh (8 Tabel)
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                  Pencadangan komprehensif seluruh 8 tabel: <strong>kas_rt</strong>, <strong>kategori</strong>, <strong>pengguna</strong>, <strong>data_warga</strong>, <strong>sekretariat</strong>, <strong>inventaris_rt</strong>, <strong>peminjaman_aset_rt</strong>, dan <strong>darurat_rt</strong> ke dalam snapshot <strong>JSON (.json)</strong> atau script <strong>SQL PostgreSQL / Supabase (.sql)</strong>.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                  kas_rt
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 px-1.5 py-0.5 rounded-md">
                  kategori
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-md">
                  pengguna
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded-md">
                  data_warga
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-teal-50 text-teal-800 border border-teal-200 px-1.5 py-0.5 rounded-md">
                  sekretariat
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-cyan-50 text-cyan-800 border border-cyan-200 px-1.5 py-0.5 rounded-md">
                  inventaris_rt
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-purple-50 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded-md">
                  peminjaman
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200 px-1.5 py-0.5 rounded-md">
                  darurat_rt
                </span>
              </div>
            </div>

            <div className="pt-5 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsBackupModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-700 hover:from-indigo-700 hover:to-blue-800 active:scale-98 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm shadow-indigo-600/20 hover:shadow-md transition-all cursor-pointer"
              >
                <DownloadCloud className="w-4 h-4 text-indigo-200" />
                <span>Buka Backup 8 Tabel</span>
                <ChevronRight className="w-4 h-4 ml-auto text-indigo-200" />
              </button>
            </div>
          </div>

          {/* Modul 2: Restore Data */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-amber-300 transition-all flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-600/20 group-hover:scale-105 transition-transform">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                  Pemulihan
                </span>
              </div>

              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 group-hover:text-amber-900 transition-colors">
                  Restore Data Kas (Pemulihan)
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                  Pulihkan kembali catatan kas dari file cadangan <strong>JSON (.json)</strong> atau berkas dump <strong>SQL (.sql)</strong>. Mendukung mode <em>Gabungkan Data (Merge)</em> atau <em>Timpa Bersih (Replace)</em>.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                  Mendukung .json & .sql
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                  Mode Gabung (Merge)
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                  Mode Timpa (Replace)
                </span>
              </div>
            </div>

            <div className="pt-5 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsRestoreModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 via-amber-700 to-orange-600 hover:from-amber-700 hover:to-orange-700 active:scale-98 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm shadow-amber-600/20 hover:shadow-md transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-amber-200" />
                <span>Buka Restore Data</span>
                <ChevronRight className="w-4 h-4 ml-auto text-amber-200" />
              </button>
            </div>
          </div>

          {/* Modul 3: Import Data Excel / CSV */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Excel & CSV
                </span>
              </div>

              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 group-hover:text-emerald-900 transition-colors">
                  Import Data Transaksi (Excel / CSV)
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                  Unggah mutasi kas sekaligus dari file spreadsheet Excel (<strong>.xlsx</strong>, <strong>.xls</strong>) atau <strong>.csv</strong>. Dilengkapi fitur unduh template resmi dan deteksi cerdas baris ringkasan.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                  Format Excel & CSV
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                  Unduh Template Siap Pakai
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                  Pratinjau Data Otomatis
                </span>
              </div>
            </div>

            <div className="pt-5 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onOpenImport}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 active:scale-98 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm shadow-emerald-600/20 hover:shadow-md transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4 text-emerald-200" />
                <span>Buka Import Data Excel</span>
                <ChevronRight className="w-4 h-4 ml-auto text-emerald-200" />
              </button>
            </div>
          </div>

          {/* Modul 4: Hapus / Reset Data */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-rose-300 transition-all flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-600 text-white flex items-center justify-center shadow-md shadow-rose-600/20 group-hover:scale-105 transition-transform">
                  <Trash2 className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                  Tindakan Destruktif
                </span>
              </div>

              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 group-hover:text-rose-900 transition-colors">
                  Hapus / Reset Data Database (8 Tabel)
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                  Kosongkan tabel spesifik atau bersihkan seluruh 8 tabel: <strong>darurat_rt</strong>, <strong>data_warga</strong>, <strong>inventaris_rt</strong>, <strong>kas_rt</strong>, <strong>kategori</strong>, <strong>peminjaman_aset_rt</strong>, <strong>pengguna</strong>, dan <strong>sekretariat</strong> dengan proteksi ketik konfirmasi keamanan.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <span className="inline-flex items-center gap-1 text-[11px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-md border border-rose-200/60 font-medium">
                  Pilih 1 Tabel Spesifik
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-md border border-rose-200/60 font-medium">
                  Reset Total 8 Tabel
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-md border border-rose-200/60 font-medium">
                  Proteksi Kata Kunci
                </span>
              </div>
            </div>

            <div className="pt-5 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsHapusModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-600 via-rose-700 to-pink-700 hover:from-rose-700 hover:to-pink-800 active:scale-98 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm shadow-rose-600/20 hover:shadow-md transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-200" />
                <span>Buka Menu Hapus Data</span>
                <ChevronRight className="w-4 h-4 ml-auto text-rose-200" />
              </button>
            </div>
          </div>

          {/* Modul 5: Profil Sekretariat & Wilayah */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-teal-300 transition-all flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20 group-hover:scale-105 transition-transform">
                  <Building2 className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                  Tabel sekretariat
                </span>
              </div>

              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 group-hover:text-teal-900 transition-colors">
                  Profil Sekretariat & Wilayah
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                  Konfigurasi nomor <strong>RT</strong>, <strong>RW</strong>, <strong>Kelurahan</strong>, dan <strong>Alamat</strong> resmi yang tersimpan di tabel <strong>sekretariat</strong>. Perubahan otomatis memperbarui kop surat, judul laporan, dan tanda tangan cetak.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                  RT: {sekretariat.rt || '-'}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                  RW: {sekretariat.rw || '-'}
                </span>
                {sekretariat.kelurahan && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                    {sekretariat.kelurahan}
                  </span>
                )}
                {sekretariat.nama_ketua_rt && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
                    Ketua: {sekretariat.nama_ketua_rt}
                  </span>
                )}
              </div>
            </div>

            <div className="pt-5 mt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => {
                  setSekretariatModalMode('edit');
                  setIsSekretariatModalOpen(true);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-700 hover:from-teal-700 hover:to-emerald-800 active:scale-98 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm shadow-teal-600/20 hover:shadow-md transition-all cursor-pointer"
              >
                <Building2 className="w-4 h-4 text-teal-200" />
                <span>Koreksi Data Wilayah</span>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setSekretariatModalMode('delete');
                  setIsSekretariatModalOpen(true);
                }}
                className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 active:scale-98 border border-rose-200 text-rose-700 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                title="Hapus / Kosongkan data tabel sekretariat"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Hapus</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Panduan Praktis Pemeliharaan & Keamanan Data */}
      <div className="bg-slate-50 rounded-2xl p-5 sm:p-6 border border-slate-200 text-xs text-slate-600 space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Panduan Pengamanan & Pemeliharaan Pembukuan Kas RT</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5">
            <span className="font-bold text-slate-900 block flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" /> 1. Rutin Backup Bulanan
            </span>
            <p className="leading-relaxed text-slate-500 text-[11px]">
              Lakukan pencadangan (Backup) setiap akhir bulan atau setelah penutupan buku kas untuk mencegah kehilangan data bila terjadi masalah koneksi atau ganti perangkat.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5">
            <span className="font-bold text-slate-900 block flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 2. Gunakan Format JSON
            </span>
            <p className="leading-relaxed text-slate-500 text-[11px]">
              Format file snapshot <strong>.json</strong> direkomendasikan karena menyimpan struktur data lengkap beserta master pos kategori kas dan tanggal arsip.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5">
            <span className="font-bold text-slate-900 block flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> 3. Backup Sebelum Hapus
            </span>
            <p className="leading-relaxed text-slate-500 text-[11px]">
              Sebelum menjalankan operasi <strong>Hapus Data</strong> atau <strong>Restore Timpa Bersih</strong>, pastikan file backup data terbaru sudah tersimpan aman di komputer Anda.
            </p>
          </div>
        </div>
      </div>

      {/* Modal Dialogs */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        transactions={transactions}
        categories={categories}
        onTriggerToast={onTriggerToast}
      />

      <RestoreModal
        isOpen={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        connectionStatus={connectionStatus}
        onRestoreComplete={async () => {
          await onRefresh();
        }}
        onTriggerToast={onTriggerToast}
      />

      <HapusDataModal
        isOpen={isHapusModalOpen}
        onClose={() => setIsHapusModalOpen(false)}
        transactions={transactions}
        categories={categories}
        connectionStatus={connectionStatus}
        onDeleteComplete={async () => {
          await onRefresh();
        }}
        onTriggerToast={onTriggerToast}
      />

      <SekretariatModal
        isOpen={isSekretariatModalOpen}
        onClose={() => setIsSekretariatModalOpen(false)}
        onTriggerToast={onTriggerToast}
        initialMode={sekretariatModalMode}
      />
    </div>
  );
};
