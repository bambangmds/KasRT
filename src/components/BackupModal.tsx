import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Database,
  Calendar,
  Layers,
  FileCode2,
  FileJson,
  Download,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  ShieldCheck,
  Info,
  Sparkles,
  Users,
  UserCheck,
  TableProperties,
  Loader2,
  Package,
  ClipboardList,
  AlertTriangle,
  Building2,
  Tag
} from 'lucide-react';
import { 
  Transaction, 
  CategoryItem, 
  SupabasePengurusRow, 
  DataWargaItem, 
  SekretariatItem,
  InventarisItem,
  PeminjamanItem
} from '../types';
import {
  BackupScope,
  BackupFormat,
  filterTransactionsForBackup,
  generateBackupJSON,
  generateSupabaseSQLDump,
  downloadFile
} from '../lib/backupUtils';
import {
  fetchAllPengurusFromSupabase,
  fetchDataWargaFromSupabase,
  getSekretariatFromSupabase,
  fetchInventarisFromSupabase,
  fetchPeminjamanFromSupabase,
  fetchActiveEmergencyAlerts,
  getLocalInventaris,
  getLocalPeminjaman,
  getLocalEmergencyAlerts,
  EmergencyAlertItem
} from '../lib/supabase';
import { useSekretariat } from '../context/SekretariatContext';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  categories?: CategoryItem[];
  defaultMonth?: string;
  defaultYear?: string;
  onTriggerToast: (msg: string, type?: 'success' | 'error' | 'info', title?: string) => void;
}

const MONTH_NAMES = [
  { value: '01', label: 'Januari' },
  { value: '02', label: 'Februari' },
  { value: '03', label: 'Maret' },
  { value: '04', label: 'April' },
  { value: '05', label: 'Mei' },
  { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' },
  { value: '08', label: 'Agustus' },
  { value: '09', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' },
];

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  transactions,
  categories = [],
  defaultMonth = 'all',
  defaultYear = 'all',
  onTriggerToast,
}) => {
  const { sekretariat: contextSekretariat, wilayahLabel, wilayahShort } = useSekretariat();
  // Pilihan Cakupan Data: 'all' atau 'monthly'
  const [scopeType, setScopeType] = useState<'all' | 'monthly'>(
    defaultMonth !== 'all' ? 'monthly' : 'all'
  );

  // Filter Bulan & Tahun jika memilih 'monthly'
  const currentMonthNum = String(new Date().getMonth() + 1).padStart(2, '0');
  const currentYearStr = String(new Date().getFullYear());

  const [selectedMonth, setSelectedMonth] = useState<string>(
    defaultMonth !== 'all' ? defaultMonth : currentMonthNum
  );
  const [selectedYear, setSelectedYear] = useState<string>(
    defaultYear !== 'all' ? defaultYear : currentYearStr
  );

  // Pilihan Format File: 'json' atau 'sql'
  const [format, setFormat] = useState<BackupFormat>('json');
  const [isProcessing, setIsProcessing] = useState(false);

  // Data 8 Tabel Lengkap: kas_rt, kategori, pengguna, data_warga, sekretariat, inventaris_rt, peminjaman_aset_rt, darurat_rt
  const [pengurusList, setPengurusList] = useState<SupabasePengurusRow[]>([]);
  const [dataWargaList, setDataWargaList] = useState<DataWargaItem[]>([]);
  const [sekretariatData, setSekretariatData] = useState<SekretariatItem | null>(null);
  const [inventarisList, setInventarisList] = useState<InventarisItem[]>([]);
  const [peminjamanList, setPeminjamanList] = useState<PeminjamanItem[]>([]);
  const [daruratList, setDaruratList] = useState<EmergencyAlertItem[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);

  // Ambil data seluruh 8 tabel saat modal terbuka
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchExtraTables = async () => {
      setIsLoadingTables(true);
      try {
        const [
          pengurusData, 
          wargaData, 
          sekData,
          invData,
          pinjamData,
          daruratData
        ] = await Promise.all([
          fetchAllPengurusFromSupabase(),
          fetchDataWargaFromSupabase(),
          getSekretariatFromSupabase(),
          fetchInventarisFromSupabase().then(r => r.data || getLocalInventaris()),
          fetchPeminjamanFromSupabase().then(r => r.data || getLocalPeminjaman()),
          fetchActiveEmergencyAlerts().then(r => r.data || getLocalEmergencyAlerts()),
        ]);
        if (isMounted) {
          setPengurusList(pengurusData || []);
          setDataWargaList(wargaData || []);
          setSekretariatData(sekData?.data || null);
          setInventarisList(invData || []);
          setPeminjamanList(pinjamData || []);
          setDaruratList(daruratData || []);
        }
      } catch (err) {
        console.warn('[BackupModal Fetch 8 Tables Exception]', err);
      } finally {
        if (isMounted) setIsLoadingTables(false);
      }
    };

    fetchExtraTables();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Daftar tahun unik dari transaksi
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    yearsSet.add(currentYearStr);
    transactions.forEach((tx) => {
      if (tx.date) {
        const y = tx.date.split('-')[0];
        if (y && y.length === 4) yearsSet.add(y);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [transactions, currentYearStr]);

  // Label Periode Dinamis
  const activePeriodLabel = useMemo(() => {
    if (scopeType === 'all') {
      return 'Semua Riwayat Data Transaksi';
    }
    const mObj = MONTH_NAMES.find((m) => m.value === selectedMonth);
    const mLabel = mObj ? mObj.label : `Bulan ${selectedMonth}`;
    return `Bulan ${mLabel} ${selectedYear}`;
  }, [scopeType, selectedMonth, selectedYear]);

  // Data transaksi yang tersaring untuk di-backup
  const backupTransactions = useMemo(() => {
    return filterTransactionsForBackup(transactions, scopeType, selectedMonth, selectedYear);
  }, [transactions, scopeType, selectedMonth, selectedYear]);

  // Ringkasan nominal data yang akan di-backup
  const summary = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    backupTransactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'Masuk') masuk += amt;
      else keluar += amt;
    });
    return {
      totalMasuk: masuk,
      totalKeluar: keluar,
      saldoBersih: masuk - keluar,
      count: backupTransactions.length,
    };
  }, [backupTransactions]);

  if (!isOpen) return null;

  // Eksekusi Backup Download
  const handleExecuteBackup = () => {
    if (backupTransactions.length === 0) {
      onTriggerToast(
        `Tidak ada data transaksi yang ditemukan untuk periode "${activePeriodLabel}". Backup tetap dilanjutkan untuk struktur 8 tabel.`,
        'info',
        'Peringatan Data Kosong'
      );
    }

    setIsProcessing(true);

    try {
      const scope: BackupScope = {
        type: scopeType,
        selectedMonth,
        selectedYear,
        periodLabel: activePeriodLabel,
      };

      const sekArray = sekretariatData ? [sekretariatData] : [];

      if (format === 'json') {
        const { jsonString, defaultFilename } = generateBackupJSON(
          backupTransactions,
          categories,
          scope,
          pengurusList,
          dataWargaList,
          sekArray,
          inventarisList,
          peminjamanList,
          daruratList
        );
        downloadFile(jsonString, defaultFilename, 'application/json;charset=utf-8;');
        onTriggerToast(
          `Backup 8 tabel "${defaultFilename}" berhasil diunduh (${backupTransactions.length} kas, ${categories.length} kategori, ${pengurusList.length} akun, ${dataWargaList.length} warga, ${inventarisList.length} aset, ${peminjamanList.length} pinjam, ${daruratList.length} SOS, 1 sekretariat).`,
          'success',
          'Backup 8 Tabel Berhasil'
        );
      } else {
        const { sqlString, defaultFilename } = generateSupabaseSQLDump(
          backupTransactions,
          categories,
          scope,
          pengurusList,
          dataWargaList,
          sekArray,
          inventarisList,
          peminjamanList,
          daruratList
        );
        downloadFile(sqlString, defaultFilename, 'application/sql;charset=utf-8;');
        onTriggerToast(
          `Script SQL Supabase 8 tabel "${defaultFilename}" berhasil diunduh. Siap dijalankan di SQL Editor Supabase.`,
          'success',
          'Backup SQL 8 Tabel Berhasil'
        );
      }

      onClose();
    } catch (err: any) {
      console.error('[Backup Error]', err);
      onTriggerToast(`Gagal mengeksekusi backup: ${err.message || err}`, 'error', 'Backup Gagal');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-6 transition-all transform animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4.5 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-tight text-white">
                  Backup Database Lengkap (8 Tabel Resmi)
                </h3>
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">
                  8 Tabel Terintegrasi
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                kas_rt • kategori • pengguna • data_warga • sekretariat • inventaris_rt • peminjaman_aset_rt • darurat_rt
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="Tutup dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5.5 max-h-[80vh] overflow-y-auto">
          {/* Instruksi Singkat */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Pencadangan ini mencakup <strong>seluruh 8 tabel database sistem</strong> secara terpadu: <strong>kas_rt</strong> (buku kas), <strong>kategori</strong> (pos anggaran), <strong>pengguna</strong> (akun pengurus), <strong>data_warga</strong> (kependudukan), <strong>sekretariat</strong> (profil RT), <strong>inventaris_rt</strong> (aset sarana), <strong>peminjaman_aset_rt</strong> (log peminjaman), dan <strong>darurat_rt</strong> (alarm SOS).
            </span>
          </div>

          {/* 1. PILIHAN CAKUPAN DATA */}
          <div>
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2.5">
              1. Pilihan Cakupan Data yang Ingin Di-Backup:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option A: Semua Data */}
              <button
                type="button"
                onClick={() => setScopeType('all')}
                className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  scopeType === 'all'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-600/10'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        scopeType === 'all'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-xs sm:text-sm text-slate-900">
                      Semua Data (8 Tabel Lengkap)
                    </span>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      scopeType === 'all'
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-300'
                    }`}
                  >
                    {scopeType === 'all' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Backup seluruh riwayat pembukuan dari awal ({transactions.length} mutasi kas) & seluruh 8 tabel sistem.
                </p>
              </button>

              {/* Option B: Bulan Tertentu */}
              <button
                type="button"
                onClick={() => setScopeType('monthly')}
                className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  scopeType === 'monthly'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-600/10'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        scopeType === 'monthly'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Calendar className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-xs sm:text-sm text-slate-900">
                      Bulan Tertentu
                    </span>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      scopeType === 'monthly'
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-300'
                    }`}
                  >
                    {scopeType === 'monthly' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Pilih bulan & tahun anggaran kas spesifik untuk keperluan arsip laporan bulanan berkala.
                </p>
              </button>
            </div>

            {/* Pemilih Bulan & Tahun (Hanya tampil jika memilih Bulan Tertentu) */}
            {scopeType === 'monthly' && (
              <div className="mt-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center gap-3 animate-in fade-in duration-150">
                <div className="w-full sm:w-1/2">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Pilih Bulan:
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10"
                  >
                    {MONTH_NAMES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-full sm:w-1/2">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Pilih Tahun Anggaran:
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        Tahun {yr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 2. PILIHAN FORMAT FILE BACKUP */}
          <div>
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2.5">
              2. Pilihan Format File Backup:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Format JSON */}
              <button
                type="button"
                onClick={() => setFormat('json')}
                className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  format === 'json'
                    ? 'border-emerald-600 bg-emerald-50/40 shadow-xs ring-2 ring-emerald-600/10'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <FileJson className="w-5 h-5 text-emerald-600" />
                      <span className="font-bold text-xs sm:text-sm text-slate-900">
                        File Snapshot JSON (.json)
                      </span>
                    </div>
                  </div>
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 mb-2">
                    Rekomendasi • Siap Restore 8 Tabel
                  </span>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Format resmi aplikasi Kas RT. Dapat langsung dipulihkan sewaktu-waktu dengan tombol <strong>Restore Data</strong>.
                  </p>
                </div>
              </button>

              {/* Format SQL */}
              <button
                type="button"
                onClick={() => setFormat('sql')}
                className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  format === 'sql'
                    ? 'border-emerald-600 bg-emerald-50/40 shadow-xs ring-2 ring-emerald-600/10'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <FileCode2 className="w-5 h-5 text-blue-600" />
                      <span className="font-bold text-xs sm:text-sm text-slate-900">
                        PostgreSQL SQL Dump (.sql)
                      </span>
                    </div>
                  </div>
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 mb-2">
                    Supabase & Restore Siap
                  </span>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Script query DDL & DML INSERT untuk seluruh 8 tabel ke Supabase SQL Editor atau diunggah via <strong>Restore Data</strong>.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* 3. RINGKASAN DATA YANG AKAN DI-BACKUP */}
          <div className="bg-slate-900 text-white rounded-xl p-4.5 border border-slate-800">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Ringkasan Data Siap Backup (8 Tabel)
                </span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-800/50">
                {activePeriodLabel}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
                <span className="text-[10px] text-slate-400 block mb-0.5">Jumlah Mutasi Kas</span>
                <span className="text-base font-extrabold text-white">
                  {summary.count}
                </span>
              </div>

              <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
                <span className="text-[10px] text-emerald-400 block mb-0.5">Total Kas Masuk</span>
                <span className="text-xs sm:text-sm font-extrabold text-emerald-400">
                  Rp {summary.totalMasuk.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
                <span className="text-[10px] text-rose-400 block mb-0.5">Total Kas Keluar</span>
                <span className="text-xs sm:text-sm font-extrabold text-rose-400">
                  Rp {summary.totalKeluar.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
                <span className="text-[10px] text-slate-300 block mb-0.5">Saldo Bersih</span>
                <span className="text-xs sm:text-sm font-extrabold text-white">
                  Rp {summary.saldoBersih.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* Rincian 8 Tabel Sistem */}
            <div className="mt-3.5 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <TableProperties className="w-3.5 h-3.5 text-emerald-400" />
                  Rincian 8 Tabel Database yang Dicadangkan:
                </span>
                {isLoadingTables ? (
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-400" /> Memeriksa 8 tabel...
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800/60">
                    8 Tabel Terhubung
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                {/* 1. kas_rt */}
                <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/60 flex items-center justify-between">
                  <div className="truncate pr-1">
                    <span className="font-mono text-emerald-300 font-bold block text-xs">kas_rt</span>
                    <span className="text-[10px] text-slate-400">Buku Kas</span>
                  </div>
                  <span className="font-bold text-white bg-slate-700 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                    {summary.count} baris
                  </span>
                </div>

                {/* 2. kategori */}
                <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/60 flex items-center justify-between">
                  <div className="truncate pr-1">
                    <span className="font-mono text-indigo-300 font-bold block text-xs">kategori</span>
                    <span className="text-[10px] text-slate-400">Pos Anggaran</span>
                  </div>
                  <span className="font-bold text-white bg-slate-700 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                    {categories.length} baris
                  </span>
                </div>

                {/* 3. pengguna */}
                <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/60 flex items-center justify-between">
                  <div className="truncate pr-1">
                    <span className="font-mono text-amber-300 font-bold block text-xs">pengguna</span>
                    <span className="text-[10px] text-slate-400">Akun Pengurus</span>
                  </div>
                  <span className="font-bold text-white bg-slate-700 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                    {pengurusList.length} akun
                  </span>
                </div>

                {/* 4. data_warga */}
                <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/60 flex items-center justify-between">
                  <div className="truncate pr-1">
                    <span className="font-mono text-blue-300 font-bold block text-xs">data_warga</span>
                    <span className="text-[10px] text-slate-400">Warga RT</span>
                  </div>
                  <span className="font-bold text-white bg-slate-700 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                    {dataWargaList.length} warga
                  </span>
                </div>

                {/* 5. sekretariat */}
                <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/60 flex items-center justify-between">
                  <div className="truncate pr-1">
                    <span className="font-mono text-teal-300 font-bold block text-xs">sekretariat</span>
                    <span className="text-[10px] text-slate-400">Profil RT</span>
                  </div>
                  <span className="font-bold text-white bg-slate-700 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                    {sekretariatData ? '1 data' : '1 profil'}
                  </span>
                </div>

                {/* 6. inventaris_rt */}
                <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/60 flex items-center justify-between">
                  <div className="truncate pr-1">
                    <span className="font-mono text-cyan-300 font-bold block text-xs">inventaris_rt</span>
                    <span className="text-[10px] text-slate-400">Aset Sarana</span>
                  </div>
                  <span className="font-bold text-white bg-slate-700 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                    {inventarisList.length} barang
                  </span>
                </div>

                {/* 7. peminjaman_aset_rt */}
                <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/60 flex items-center justify-between">
                  <div className="truncate pr-1">
                    <span className="font-mono text-purple-300 font-bold block text-xs">peminjaman</span>
                    <span className="text-[10px] text-slate-400">Log Peminjaman</span>
                  </div>
                  <span className="font-bold text-white bg-slate-700 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                    {peminjamanList.length} log
                  </span>
                </div>

                {/* 8. darurat_rt */}
                <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/60 flex items-center justify-between">
                  <div className="truncate pr-1">
                    <span className="font-mono text-rose-300 font-bold block text-xs">darurat_rt</span>
                    <span className="text-[10px] text-slate-400">Sinyal SOS</span>
                  </div>
                  <span className="font-bold text-white bg-slate-700 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                    {daruratList.length} log
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>Status: Siap di-backup & direstore sewaktu-waktu</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Format: .{format.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-60"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleExecuteBackup}
            disabled={isProcessing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-700/20 transition-all cursor-pointer active:scale-98 disabled:opacity-60"
          >
            <Download className="w-4 h-4 text-emerald-200" />
            <span>{isProcessing ? 'Memproses Unduhan 8 Tabel...' : `Unduh Backup 8 Tabel (${format.toUpperCase()})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

