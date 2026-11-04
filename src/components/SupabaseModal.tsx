import React, { useState, useEffect } from 'react';
import { 
  Database, 
  X, 
  CheckCircle2, 
  Loader2, 
  Info, 
  Link as LinkIcon, 
  Key, 
  AlertTriangle, 
  Table, 
  Check, 
  Copy,
  Clock,
  Activity,
  CloudUpload,
  Download,
  RefreshCw,
  Boxes,
  Users,
  Building2,
  FileSpreadsheet,
  ShieldCheck,
  HelpCircle
} from 'lucide-react';
import {
  getActiveSupabaseConfig,
  setSupabaseCredentials,
  resetSupabaseCredentials,
  testSupabaseConnection,
  cleanSupabaseUrl,
  cleanAnonKey,
  SUPABASE_SQL_SCHEMA,
  checkSupabaseTablesStatus,
  TableStatusInfo,
  getLocalDataSummary,
  LocalDataSummary,
  syncAllLocalDataToSupabase,
  getSekretariatFromSupabase,
} from '../lib/supabase';
import { SupabaseConnectionStatus } from '../types';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionStatus: SupabaseConnectionStatus;
  onRefreshData: () => void;
  onTriggerToast: (msg: string, type?: 'success' | 'error' | 'info', title?: string) => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({
  isOpen,
  onClose,
  connectionStatus,
  onRefreshData,
  onTriggerToast,
}) => {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedCronUrl, setCopiedCronUrl] = useState(false);
  const [isFromEnv, setIsFromEnv] = useState(false);

  // Live Table Status & Local Sync States
  const [tablesStatus, setTablesStatus] = useState<TableStatusInfo[] | null>(null);
  const [isCheckingTables, setIsCheckingTables] = useState(false);
  const [localSummary, setLocalSummary] = useState<LocalDataSummary | null>(null);
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const loadDiagnostics = async () => {
    setIsCheckingTables(true);
    setLocalSummary(getLocalDataSummary());
    try {
      const res = await checkSupabaseTablesStatus();
      setTablesStatus(res.tables);
    } catch {
      // ignore
    } finally {
      setIsCheckingTables(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const config = getActiveSupabaseConfig();
      setUrl(config.url);
      setAnonKey(config.anonKey);
      setIsFromEnv(config.isFromEnv);
      setTestResult(null);
      setSyncFeedback(null);
      loadDiagnostics();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUrlBlur = () => {
    if (url.trim()) {
      const sanitized = cleanSupabaseUrl(url);
      setUrl(sanitized);
    }
  };

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setTestResult(null);

    const sanitizedUrl = cleanSupabaseUrl(url);
    const sanitizedKey = cleanAnonKey(anonKey);
    setUrl(sanitizedUrl);
    setAnonKey(sanitizedKey);

    const res = await testSupabaseConnection(sanitizedUrl, sanitizedKey);
    setIsTesting(false);
    setTestResult(res);

    if (res.success) {
      setSupabaseCredentials(sanitizedUrl, sanitizedKey);

      // Segarkan data dan periksa status tabel sekretariat
      if (onRefreshData) {
        await onRefreshData();
      }

      // Periksa apakah tabel sekretariat di database Supabase yang baru masih kosong
      const sekCheck = await getSekretariatFromSupabase();
      if (sekCheck.isDbEmpty) {
        onTriggerToast(
          'Koneksi Supabase berhasil terhubung! Tabel sekretariat belum ada isinya, menuju ke registrasi wilayah & lokasi RT...',
          'info',
          'Registrasi Wilayah Wajib'
        );
        // Otomatis tutup modal agar langsung menuju layar registrasi wilayah/lokasi
        onClose();
        return;
      }

      onTriggerToast('Koneksi Supabase berhasil disimpan! Menyegarkan data...', 'success', 'Supabase Terhubung');
      loadDiagnostics();
    } else {
      if (sanitizedUrl && sanitizedKey) {
        setSupabaseCredentials(sanitizedUrl, sanitizedKey);
      }
      onTriggerToast(res.message, 'error', 'Koneksi Gagal');
      loadDiagnostics();
    }
  };

  const handleClearCredentials = () => {
    resetSupabaseCredentials();
    setUrl('');
    setAnonKey('');
    setTestResult(null);
    onTriggerToast('Pengaturan kredensial Supabase dibersihkan! Menyegarkan halaman...', 'info', 'Kredensial Dikosongkan');
    onRefreshData();
    setTimeout(() => {
      onClose();
      window.location.reload();
    }, 1200);
  };

  const handleResetAllCache = () => {
    resetSupabaseCredentials();
    onTriggerToast('Seluruh cache data browser telah dibersihkan! Memuat ulang...', 'success', 'Cache Dibersihkan');
    setTimeout(() => {
      onClose();
      window.location.reload();
    }, 1200);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    onTriggerToast('Skema SQL 8 tabel Supabase lengkap RLS berhasil disalin!', 'success', 'SQL Disalin');
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleDownloadSql = () => {
    try {
      const blob = new Blob([SUPABASE_SQL_SCHEMA], { type: 'text/sql;charset=utf-8;' });
      const dlUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = dlUrl;
      link.setAttribute('download', 'supabase_schema_lengkap.sql');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(dlUrl);
      onTriggerToast('File "supabase_schema_lengkap.sql" berhasil diunduh!', 'success', 'Unduh Berhasil');
    } catch {
      handleCopySql();
    }
  };

  const handleCopyCronUrl = () => {
    const cronPingUrl = url && anonKey 
      ? `${url.replace(/\/+$/, '')}/rest/v1/kas_rt?select=id&limit=1&apikey=${anonKey}`
      : `${window.location.origin}/api/cron-keepalive`;
    navigator.clipboard.writeText(cronPingUrl);
    setCopiedCronUrl(true);
    onTriggerToast('URL Ping Cron-Job (bebas 401) berhasil disalin ke clipboard!', 'success');
    setTimeout(() => setCopiedCronUrl(false), 2500);
  };

  const handleSyncAllLocal = async () => {
    setIsSyncingLocal(true);
    setSyncFeedback(null);
    const res = await syncAllLocalDataToSupabase();
    setIsSyncingLocal(false);

    if (res.success) {
      const parts = [];
      if (res.uploaded.sekretariat) parts.push('1 profil wilayah (sekretariat)');
      if (res.uploaded.pengguna > 0) parts.push(`${res.uploaded.pengguna} akun pengguna`);
      if (res.uploaded.dataWarga > 0) parts.push(`${res.uploaded.dataWarga} data warga`);
      if (res.uploaded.inventaris > 0) parts.push(`${res.uploaded.inventaris} aset inventaris`);
      if (res.uploaded.kas > 0) parts.push(`${res.uploaded.kas} transaksi kas`);

      const feedback = parts.length > 0
        ? `Berhasil mengunggah: ${parts.join(', ')} ke tabel Supabase!`
        : 'Seluruh data lokal sudah sinkron dengan Supabase.';
      
      setSyncFeedback(feedback);
      onTriggerToast(feedback, 'success', 'Sinkronisasi Selesai');
      onRefreshData();
      loadDiagnostics();
    } else {
      const errText = res.errors.length > 0 ? res.errors.join('; ') : 'Gagal menyinkronkan data.';
      setSyncFeedback(errText);
      onTriggerToast(errText, 'error', 'Sinkronisasi Gagal');
      loadDiagnostics();
    }
  };

  // Hitung jumlah data lokal yang terdeteksi
  const hasLocalDataToUpload = localSummary && (
    localSummary.sekretariat ||
    localSummary.registeredUsersCount > 0 ||
    localSummary.dataWargaCount > 0 ||
    localSummary.inventarisCount > 0 ||
    localSummary.transactionsCount > 0
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Konfigurasi & Sinkronisasi Database Supabase
              </h3>
              <p className="text-xs text-slate-300">
                Pencocokan tabel, skema SQL otomatis, dan sinkronisasi data lokal ke Supabase Live
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Scrollable */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Status Indicator Banner */}
          <div
            className={`p-4 rounded-xl flex items-start gap-3 border ${
              connectionStatus === 'connected'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : connectionStatus === 'connecting'
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            {connectionStatus === 'connected' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
            ) : connectionStatus === 'connecting' ? (
              <Loader2 className="w-5 h-5 shrink-0 mt-0.5 animate-spin text-blue-600" />
            ) : (
              <Info className="w-5 h-5 shrink-0 mt-0.5 text-slate-500" />
            )}
            <div className="text-xs leading-relaxed flex-1">
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm">
                  {connectionStatus === 'connected'
                    ? 'Tersambung ke Supabase Live'
                    : connectionStatus === 'connecting'
                    ? 'Sedang Menghubungkan ke Supabase...'
                    : 'Koneksi Supabase Belum Aktif'}
                </p>
                <button
                  type="button"
                  onClick={loadDiagnostics}
                  disabled={isCheckingTables}
                  className="text-xs text-indigo-700 hover:text-indigo-900 font-semibold flex items-center gap-1 cursor-pointer"
                  title="Cek ulang ketersediaan tabel Supabase"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingTables ? 'animate-spin' : ''}`} />
                  <span>Periksa Tabel</span>
                </button>
              </div>
              <p className="mt-1">
                {connectionStatus === 'connected'
                  ? "Koneksi API valid. Pastikan seluruh 8 tabel telah dibuat di Supabase SQL Editor agar data tersimpan di server."
                  : "Silakan masukkan Project URL & Anon API Key Supabase Anda di bawah ini, lalu klik 'Uji & Simpan Koneksi'."}
              </p>
            </div>
          </div>

          {/* Form Credentials */}
          <form onSubmit={handleTestAndSave} className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-indigo-600" />
              Kredensial API Proyek
            </h4>

            {/* Input URL */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  SUPABASE_URL
                  {isFromEnv && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      .env Proyek
                    </span>
                  )}
                </span>
                <span className="text-[11px] font-normal text-slate-500">
                  (VITE_SUPABASE_URL)
                </span>
              </label>
              <div className="relative flex items-center">
                <LinkIcon className="absolute left-3 text-slate-400 w-4 h-4 pointer-events-none" />
                <input
                  type="url"
                  required
                  placeholder="https://xyzabcdefghijklmnop.supabase.co"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onBlur={handleUrlBlur}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-white rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10 border border-slate-200 focus:border-slate-400 transition-all font-mono"
                />
              </div>
            </div>

            {/* Input Anon Key */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>SUPABASE_ANON_KEY</span>
                <span className="text-[11px] font-normal text-slate-500">
                  (Public Anon API Key / Publishable Key)
                </span>
              </label>
              <div className="relative flex items-center">
                <Key className="absolute left-3 text-slate-400 w-4 h-4 pointer-events-none" />
                <input
                  type="text"
                  required
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-white rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10 border border-slate-200 focus:border-slate-400 transition-all font-mono"
                />
              </div>

              {/* Tips Lokasi di Menu Baru Supabase */}
              <div className="mt-1 p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-lg text-[11px] text-amber-900 leading-relaxed">
                <p className="font-semibold flex items-center gap-1.5 text-amber-950 mb-1">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  Di mana menemukan Anon Key di menu Supabase baru?
                </p>
                <div className="space-y-1 pl-5 list-disc text-amber-800">
                  <div>
                    <strong>Cara 1 (Paling Cepat):</strong> Klik tombol <strong>&quot;Connect&quot;</strong> di header atas dashboard Supabase (sebelah nama proyek) &rarr; pilih tab <strong>&quot;App&quot;</strong>.
                  </div>
                  <div>
                    <strong>Cara 2 (Menu Pengaturan):</strong> Klik menu <strong>Settings (⚙️)</strong> di pojok kiri bawah &rarr; pilih <strong>&quot;API&quot;</strong> (atau <strong>&quot;Data API&quot;</strong>) &rarr; lihat bagian <strong>Project API keys</strong> pada baris bertuliskan <strong>&quot;anon&quot; &quot;public&quot;</strong> (klik tombol <em>Copy</em>).
                  </div>
                </div>
              </div>
            </div>

            {/* Test Result Feedback */}
            {testResult && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                )}
                <div className="leading-relaxed">{testResult.message}</div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="submit"
                disabled={isTesting || !url || !anonKey}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isTesting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 text-emerald-400" />
                )}
                <span>{isTesting ? 'Menguji...' : 'Uji & Simpan Kredensial'}</span>
              </button>
            </div>
          </form>

          {/* DIAGNOSTIK TABEL SUPABASE LIVE */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Table className="w-4 h-4 text-indigo-600" />
                  Status Ketersediaan 8 Tabel Supabase Live
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Pemeriksaan langsung ke PostgreSQL Supabase Anda untuk memastikan tabel sudah terbuat.
                </p>
              </div>
              <button
                type="button"
                onClick={loadDiagnostics}
                disabled={isCheckingTables}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingTables ? 'animate-spin' : ''}`} />
                <span>Segarkan Status</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {tablesStatus ? (
                tablesStatus.map((t) => (
                  <div
                    key={t.name}
                    className={`p-2.5 rounded-lg border flex items-center justify-between ${
                      t.status === 'ready'
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                        : t.status === 'missing'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    <div>
                      <span className="font-bold block">{t.name}</span>
                      <span className="text-[10px] text-slate-500">{t.label.split('(')[0]}</span>
                    </div>

                    <div className="text-right">
                      {t.status === 'ready' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {t.rowCount} baris
                        </span>
                      ) : t.status === 'missing' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px]">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Belum Dibuat
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold text-[10px]">
                          Error / RLS
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 py-3 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  <span>Memeriksa status tabel di Supabase...</span>
                </div>
              )}
            </div>

            {/* Note jika ada tabel yang missing */}
            {tablesStatus && tablesStatus.some((t) => t.status === 'missing' || t.status === 'rls_error') && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <p className="font-bold">Beberapa tabel belum terbuat di Supabase!</p>
                  <p className="text-[11px] text-amber-900/90 mt-0.5">
                    Supabase PostgreSQL <strong>tidak membuat tabel secara otomatis</strong> saat aplikasi mengirim data. 
                    Silakan gunakan tombol <strong>"Salin Skema SQL Lengkap"</strong> di bawah ini dan jalankan pada <strong>Supabase SQL Editor</strong> proyek Anda.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* SINKRONISASI DATA LOKAL KE SUPABASE */}
          <div className="p-4 bg-gradient-to-br from-indigo-50/70 to-blue-50/70 rounded-xl border border-indigo-200 shadow-2xs space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <CloudUpload className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-950">
                    Sinkronkan Data Lokal Browser ke Supabase
                  </h4>
                  <p className="text-[11px] text-indigo-900/80 leading-relaxed mt-0.5">
                    Data yang sudah Anda masukkan (pengguna baru, profil wilayah, data warga, atau baris inventaris) saat ini tersimpan di memori browser. Klik tombol di bawah ini untuk mengunggahnya langsung ke tabel Supabase!
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSyncAllLocal}
                disabled={isSyncingLocal || !url || !anonKey}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isSyncingLocal ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CloudUpload className="w-3.5 h-3.5" />
                )}
                <span>{isSyncingLocal ? 'Mengunggah...' : 'Unggah Data Lokal ke Supabase'}</span>
              </button>
            </div>

            {/* Ringkasan Data Lokal yang Tersedia */}
            {localSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                <div className="p-2 bg-white rounded-lg border border-indigo-100 flex items-center gap-2 text-slate-700">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Wilayah: <strong>{localSummary.sekretariat ? 'Tersedia' : 'Kosong'}</strong></span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-indigo-100 flex items-center gap-2 text-slate-700">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Pengguna: <strong>{localSummary.registeredUsersCount} Akun</strong></span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-indigo-100 flex items-center gap-2 text-slate-700">
                  <Boxes className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Inventaris: <strong>{localSummary.inventarisCount} Item</strong></span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-indigo-100 flex items-center gap-2 text-slate-700">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Kas: <strong>{localSummary.transactionsCount} Baris</strong></span>
                </div>
              </div>
            )}

            {syncFeedback && (
              <div className="p-2.5 bg-white rounded-lg border border-indigo-200 text-xs text-indigo-900 font-medium">
                {syncFeedback}
              </div>
            )}
          </div>

          {/* Master SQL Schema Helper Box */}
          <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Table className="w-4 h-4 text-emerald-400" />
                Skema SQL Lengkap (8 Tabel + RLS Policies)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadSql}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                  title="Unduh berkas .sql siap eksekusi"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Unduh .sql</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedSql ? (
                    <Check className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-white" />
                  )}
                  <span>{copiedSql ? 'SQL Tersalin!' : 'Salin Skema SQL'}</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              Mencakup 8 tabel resmi: <code className="text-emerald-300">sekretariat</code>, <code className="text-emerald-300">pengguna</code>, <code className="text-emerald-300">data_warga</code>, <code className="text-emerald-300">inventaris_rt</code>, <code className="text-emerald-300">peminjaman_aset_rt</code>, <code className="text-emerald-300">kategori</code>, <code className="text-emerald-300">kas_rt</code>, dan <code className="text-emerald-300">darurat_rt</code>, lengkap dengan hak akses Row Level Security (RLS) bebas blokir.
            </p>
          </div>

          {/* Cron-Job.org Helper Box */}
          <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                Pencegah Sleep Supabase (Cron-Job.org)
              </span>
              <button
                type="button"
                onClick={handleCopyCronUrl}
                className="text-xs font-semibold text-amber-800 hover:text-amber-950 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedCronUrl ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedCronUrl ? 'URL Tersalin!' : 'Salin URL Cron-Job'}</span>
              </button>
            </div>

            <p className="text-[11px] text-amber-800/90 leading-relaxed">
              Supabase Free Tier otomatis tidur (*pause*) jika tidak ada aktivitas selama 7 hari. Gunakan URL ping ini di Cron-Job.org agar database aktif terus 24/7:
            </p>
            <div className="p-2 bg-white rounded-lg border border-amber-200 text-[10px] font-mono text-slate-700 break-all select-all flex items-center justify-between gap-2">
              <span className="truncate">
                {url && anonKey
                  ? `${url.replace(/\/+$/, '')}/rest/v1/kas_rt?select=id&limit=1&apikey=${anonKey.slice(0, 12)}...`
                  : `${window.location.origin}/api/cron-keepalive`}
              </span>
              <Activity className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleClearCredentials}
              className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              Hapus Kredensial
            </button>
            <button
              type="button"
              onClick={handleResetAllCache}
              className="px-3 py-1.5 text-xs font-semibold text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              Bersihkan Cache
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-slate-900 hover:bg-slate-800 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer"
          >
            Selesai / Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
