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
  Activity
} from 'lucide-react';
import {
  getActiveSupabaseConfig,
  setSupabaseCredentials,
  resetSupabaseCredentials,
  testSupabaseConnection,
  cleanSupabaseUrl,
  cleanAnonKey,
  SUPABASE_SQL_SCHEMA,
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

  useEffect(() => {
    if (isOpen) {
      const config = getActiveSupabaseConfig();
      setUrl(config.url);
      setAnonKey(config.anonKey);
      setIsFromEnv(config.isFromEnv);
      setTestResult(null);
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
      onTriggerToast('Koneksi Supabase berhasil disimpan! Menyegarkan halaman...', 'success', 'Supabase Terhubung');
      onRefreshData();
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 1500);
    } else {
      // Even if table doesn't exist yet, save credentials so they don't lose typed info
      if (sanitizedUrl && sanitizedKey) {
        setSupabaseCredentials(sanitizedUrl, sanitizedKey);
      }
      onTriggerToast(res.message, 'error', 'Koneksi Gagal');
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
    }, 1500);
  };

  const handleResetAllCache = () => {
    resetSupabaseCredentials();
    onTriggerToast('Seluruh cache data browser telah dibersihkan! Memuat ulang...', 'success', 'Cache Dibersihkan');
    setTimeout(() => {
      onClose();
      window.location.reload();
    }, 1500);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    onTriggerToast('Query SQL tabel kas_rt berhasil disalin ke clipboard!', 'success');
    setTimeout(() => setCopiedSql(false), 2500);
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

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Konfigurasi Database Supabase
              </h3>
              <p className="text-xs text-slate-300">
                Tabel target: <code className="bg-white/10 px-1.5 py-0.5 rounded text-emerald-300">kas_rt</code>, <code className="bg-white/10 px-1.5 py-0.5 rounded text-emerald-300">kategori</code>, <code className="bg-white/10 px-1.5 py-0.5 rounded text-amber-300">pengguna</code>, <code className="bg-white/10 px-1.5 py-0.5 rounded text-blue-300">data_warga</code> & <code className="bg-white/10 px-1.5 py-0.5 rounded text-teal-300">sekretariat</code>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {/* Status Indicator Banner */}
          <div
            className={`p-4 rounded-xl mb-6 flex items-start gap-3 border ${
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
            <div className="text-xs leading-relaxed">
              <p className="font-bold mb-0.5">
                {connectionStatus === 'connected'
                  ? 'Tersambung ke Supabase Live'
                  : connectionStatus === 'connecting'
                  ? 'Sedang Menghubungkan ke Supabase...'
                  : 'Koneksi Supabase Belum Aktif'}
              </p>
              <p>
                {connectionStatus === 'connected'
                  ? "Aplikasi membaca dan menulis data langsung secara online ke tabel 'kas_rt' di database Supabase Anda."
                  : "Silakan masukkan Project URL & Anon API Key Supabase Anda di bawah ini, lalu klik 'Uji & Simpan Koneksi' untuk mengaktifkan sinkronisasi database live."}
              </p>
            </div>
          </div>

          <form onSubmit={handleTestAndSave} className="space-y-4">
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
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 border border-slate-200 focus:border-slate-400 transition-all"
                />
              </div>
              <span className="text-[11px] text-slate-500">
                Format: <code className="font-semibold text-slate-800">https://&lt;project-id&gt;.supabase.co</code> (jangan menambahkan <code className="text-rose-600">/rest/v1</code>)
              </span>
            </div>

            {/* Input Anon Key */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>SUPABASE_ANON_KEY</span>
                <span className="text-[11px] font-normal text-slate-500">
                  (VITE_SUPABASE_ANON_KEY / Public Key)
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
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 border border-slate-200 focus:border-slate-400 transition-all font-mono"
                />
              </div>
            </div>

            {/* Test Result Feedback */}
            {testResult && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
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

            {/* Schema SQL Helper Accordion/Box */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Table className="w-4 h-4 text-emerald-700" />
                  Struktur 5 Tabel Database Supabase
                </span>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copiedSql ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedSql ? 'Tersalin!' : 'Salin SQL Schema'}
                </button>
              </div>

              <p className="text-[11px] text-slate-500">
                Skema SQL mencakup pembuatan 5 tabel lengkap: transaksi <code className="font-semibold text-slate-800">kas_rt</code>, master <code className="font-semibold text-slate-800">kategori</code>, akun & hak akses <code className="font-semibold text-slate-800">pengguna</code> (dengan kolom no_hp), kependudukan <code className="font-semibold text-slate-800">data_warga</code>, serta profil wilayah <code className="font-semibold text-slate-800">sekretariat</code> (RT, RW, Kelurahan, Alamat).
              </p>
            </div>

            {/* Cron-Job.org / Keep-Alive Helper Box */}
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
                  {copiedCronUrl ? 'URL Tersalin!' : 'Salin URL Cron-Job'}
                </button>
              </div>

              <p className="text-[11px] text-amber-800/90 leading-relaxed">
                Supabase Free Tier otomatis tidur (*pause*) jika tidak ada aktivitas selama beberapa hari. Gunakan URL siap pakai ini di Cron-Job.org (sudah dilengkapi <code className="font-mono bg-white/70 px-1 rounded text-amber-900">apikey</code> agar bebas 401 Unauthorized):
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

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleClearCredentials}
                  className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer shrink-0"
                  title="Menghapus URL & Anon Key kustom serta membersihkan seluruh cache lokal"
                >
                  Hapus Kredensial
                </button>
                <button
                  type="button"
                  onClick={handleResetAllCache}
                  className="px-3 py-2 text-xs font-semibold text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer shrink-0"
                  title="Bersihkan seluruh cache data & profil yang tersimpan di browser"
                >
                  Bersihkan Cache
                </button>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                >
                  Tutup
                </button>

                <button
                  type="submit"
                  disabled={isTesting || !url || !anonKey}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isTesting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>{isTesting ? 'Menguji...' : 'Uji & Simpan Koneksi'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
