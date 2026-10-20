import React, { useState, useRef } from 'react';
import {
  X,
  RotateCcw,
  UploadCloud,
  FileJson,
  FileCode2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
  Layers,
  Sparkles,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownLeft,
  Info
} from 'lucide-react';
import {
  BackupData,
  RestoreMode,
  parseBackupFile,
  executeRestoreData
} from '../lib/backupUtils';

interface RestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreComplete: () => Promise<void> | void;
  connectionStatus: 'connected' | 'connecting' | 'error' | 'demo';
  onTriggerToast: (msg: string, type?: 'success' | 'error' | 'info', title?: string) => void;
}

export const RestoreModal: React.FC<RestoreModalProps> = ({
  isOpen,
  onClose,
  onRestoreComplete,
  connectionStatus,
  onTriggerToast,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [backupData, setBackupData] = useState<BackupData | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [restoreMode, setRestoreMode] = useState<RestoreMode>('merge');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (file: File) => {
    setParseError(null);
    setSelectedFile(file);
    setIsParsing(true);

    try {
      const data = await parseBackupFile(file);
      setBackupData(data);
      onTriggerToast(
        `File backup "${file.name}" berhasil diverifikasi (${data.summary.transactionCount} transaksi).`,
        'success',
        'File Valid'
      );
    } catch (err: any) {
      console.error('[Parse Backup Error]', err);
      setBackupData(null);
      setParseError(err.message || 'File tidak valid atau rusak.');
      onTriggerToast(err.message || 'Gagal membaca file backup', 'error', 'Format Tidak Sesuai');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileChange(file);
    }
  };

  const handleResetFile = () => {
    setSelectedFile(null);
    setBackupData(null);
    setParseError(null);
    setConfirmReplace(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExecuteRestore = async () => {
    if (!backupData) return;

    if (restoreMode === 'replace' && !confirmReplace) {
      onTriggerToast(
        'Harap centang konfirmasi persetujuan sebelum mengeksekusi mode Timpa Bersih.',
        'error',
        'Konfirmasi Diperlukan'
      );
      return;
    }

    setIsRestoring(true);

    try {
      const result = await executeRestoreData(backupData, restoreMode, connectionStatus);

      if (result.success) {
        onTriggerToast(
          result.details || `Berhasil memulihkan ${result.restoredTransactionsCount} transaksi kas!`,
          'success',
          'Pemulihan Selesai'
        );
        await onRestoreComplete();
        onClose();
      } else {
        onTriggerToast(
          result.error || 'Terjadi kesalahan saat memulihkan data.',
          'error',
          'Pemulihan Gagal'
        );
      }
    } catch (err: any) {
      console.error('[Restore Exception]', err);
      onTriggerToast(err.message || 'Gagal memulihkan data', 'error', 'Pemulihan Gagal');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden my-6 transition-all transform animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4.5 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-tight text-white">
                  Restore / Pulihkan Data Kas
                </h3>
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30">
                  {connectionStatus === 'connected' ? 'Supabase Live' : 'Penyimpanan Lokal'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Pulihkan pembukuan kas dari file backup (.json atau .sql) resmi
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
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Petunjuk Singkat */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/70 text-xs text-amber-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              Pilih file snapshot backup (<strong>.json</strong>) atau file dump SQL (<strong>.sql</strong>) yang pernah Anda unduh melalui tombol <strong>Backup Database</strong>.
              Sistem akan memverifikasi integritas data sebelum memulihkannya ke dalam buku kas.
            </span>
          </div>

          {/* Area Unggah File */}
          {!backupData ? (
            <div>
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2">
                Pilih File Backup (.json / .sql):
              </label>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-600 bg-slate-50/60 hover:bg-emerald-50/20 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                  accept=".json,.sql,application/json,application/sql,text/plain"
                  className="hidden"
                />

                <div className="w-12 h-12 rounded-xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-emerald-600 group-hover:border-emerald-300 mb-3 transition-colors">
                  {isParsing ? (
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                  ) : (
                    <UploadCloud className="w-6 h-6" />
                  )}
                </div>

                <span className="text-sm font-bold text-slate-800 mb-1">
                  {isParsing ? 'Memeriksa Berkas Backup...' : 'Klik atau Tarik File Backup ke Sini'}
                </span>
                <span className="text-xs text-slate-400">
                  Mendukung format file resmi snapshot .JSON dan file dump .SQL hasil backup Kas RT
                </span>
              </div>

              {parseError && (
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          ) : (
            /* Pratinjau File Valid */
            <div className="space-y-4">
              {backupData.formatSource === 'sql' || selectedFile?.name.toLowerCase().endsWith('.sql') ? (
                <div className="flex items-center justify-between p-3.5 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-2.5">
                    <FileCode2 className="w-5 h-5 text-blue-700" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 block truncate max-w-[240px] sm:max-w-[320px]">
                          {selectedFile?.name}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                          SQL Dump (.sql)
                        </span>
                      </div>
                      <span className="text-[11px] text-blue-700">
                        File Backup SQL Valid • {backupData.transactions.length} Baris Transaksi
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetFile}
                    className="text-xs text-slate-500 hover:text-rose-600 underline font-semibold cursor-pointer shrink-0"
                  >
                    Ganti File
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="flex items-center gap-2.5">
                    <FileJson className="w-5 h-5 text-emerald-700" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 block truncate max-w-[240px] sm:max-w-[320px]">
                          {selectedFile?.name}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                          JSON Snapshot (.json)
                        </span>
                      </div>
                      <span className="text-[11px] text-emerald-700">
                        File Backup JSON Valid • {backupData.transactions.length} Baris Transaksi
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetFile}
                    className="text-xs text-slate-500 hover:text-rose-600 underline font-semibold cursor-pointer shrink-0"
                  >
                    Ganti File
                  </button>
                </div>
              )}

              {/* Rincian Ringkasan Backup */}
              <div className="bg-slate-900 text-white rounded-xl p-4 border border-slate-800">
                <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-300">
                    Cakupan: {backupData.scopeLabel}
                  </span>
                  <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                    {backupData.summary.transactionCount} Transaksi
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                  <div className="bg-slate-800/60 p-2 rounded-lg">
                    <span className="text-[10px] text-emerald-400 block mb-0.5">Kas Masuk</span>
                    <span className="font-bold text-emerald-300">
                      Rp {backupData.summary.totalKasMasuk.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="bg-slate-800/60 p-2 rounded-lg">
                    <span className="text-[10px] text-rose-400 block mb-0.5">Kas Keluar</span>
                    <span className="font-bold text-rose-300">
                      Rp {backupData.summary.totalKasKeluar.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="bg-slate-800/60 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-300 block mb-0.5">Saldo Bersih</span>
                    <span className="font-bold text-white">
                      Rp {backupData.summary.saldoBersih.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                {/* Daftar Tabel dalam File Backup */}
                <div className="mt-2.5 pt-2.5 border-t border-slate-800 text-[11px]">
                  <span className="text-slate-400 block mb-1.5 font-medium">8 Tabel yang termuat dalam arsip:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
                    <div className="bg-slate-800/80 px-2 py-1 rounded border border-slate-700 flex justify-between items-center">
                      <span className="font-mono text-emerald-300 font-bold">kas_rt</span>
                      <span className="text-white font-semibold">{backupData.transactions?.length || 0} baris</span>
                    </div>
                    <div className="bg-slate-800/80 px-2 py-1 rounded border border-slate-700 flex justify-between items-center">
                      <span className="font-mono text-indigo-300 font-bold">kategori</span>
                      <span className="text-white font-semibold">{backupData.categories?.length || 0} baris</span>
                    </div>
                    <div className="bg-slate-800/80 px-2 py-1 rounded border border-slate-700 flex justify-between items-center">
                      <span className="font-mono text-amber-300 font-bold">pengguna</span>
                      <span className="text-white font-semibold">{(backupData.pengguna?.length || backupData.pengurus?.length || backupData.summary?.pengurusCount || 0)} akun</span>
                    </div>
                    <div className="bg-slate-800/80 px-2 py-1 rounded border border-slate-700 flex justify-between items-center">
                      <span className="font-mono text-blue-300 font-bold">data_warga</span>
                      <span className="text-white font-semibold">{backupData.data_warga?.length || backupData.summary?.dataWargaCount || 0} warga</span>
                    </div>
                    <div className="bg-slate-800/80 px-2 py-1 rounded border border-slate-700 flex justify-between items-center">
                      <span className="font-mono text-teal-300 font-bold">sekretariat</span>
                      <span className="text-white font-semibold">{backupData.sekretariat?.length || backupData.summary?.sekretariatCount || 0} data</span>
                    </div>
                    <div className="bg-slate-800/80 px-2 py-1 rounded border border-slate-700 flex justify-between items-center">
                      <span className="font-mono text-cyan-300 font-bold">inventaris_rt</span>
                      <span className="text-white font-semibold">{(backupData.inventaris?.length || backupData.inventaris_rt?.length || backupData.summary?.inventarisCount || 0)} item</span>
                    </div>
                    <div className="bg-slate-800/80 px-2 py-1 rounded border border-slate-700 flex justify-between items-center">
                      <span className="font-mono text-purple-300 font-bold">peminjaman</span>
                      <span className="text-white font-semibold">{(backupData.peminjaman?.length || backupData.peminjaman_aset_rt?.length || backupData.summary?.peminjamanCount || 0)} log</span>
                    </div>
                    <div className="bg-slate-800/80 px-2 py-1 rounded border border-slate-700 flex justify-between items-center">
                      <span className="font-mono text-rose-300 font-bold">darurat_rt</span>
                      <span className="text-white font-semibold">{(backupData.darurat?.length || backupData.darurat_rt?.length || backupData.summary?.daruratCount || 0)} SOS</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pilihan Mode Restore */}
              <div>
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2">
                  Pilih Mode Pemulihan:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Mode Merge */}
                  <button
                    type="button"
                    onClick={() => setRestoreMode('merge')}
                    className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                      restoreMode === 'merge'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-600/10'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs sm:text-sm text-slate-900">
                          Gabungkan Data (Merge)
                        </span>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            restoreMode === 'merge'
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-slate-300'
                          }`}
                        >
                          {restoreMode === 'merge' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 mb-1.5">
                        Aman (Disarankan)
                      </span>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Menambahkan data dari file backup tanpa menghapus catatan kas yang sudah ada di database saat ini.
                      </p>
                    </div>
                  </button>

                  {/* Mode Replace */}
                  <button
                    type="button"
                    onClick={() => setRestoreMode('replace')}
                    className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                      restoreMode === 'replace'
                        ? 'border-rose-600 bg-rose-50/50 shadow-xs ring-2 ring-rose-600/10'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs sm:text-sm text-slate-900">
                          Timpa Bersih (Replace)
                        </span>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            restoreMode === 'replace'
                              ? 'border-rose-600 bg-rose-600 text-white'
                              : 'border-slate-300'
                          }`}
                        >
                          {restoreMode === 'replace' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 mb-1.5">
                        Reset Penuh
                      </span>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Mengganti seluruh catatan kas saat ini persis sesuai isi berkas backup. Data lama di database akan dikosongkan.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Konfirmasi jika memilih Timpa Bersih */}
              {restoreMode === 'replace' && (
                <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Peringatan Mode Timpa Bersih</span>
                  </div>
                  <p className="text-[11px] text-rose-700 leading-relaxed">
                    Seluruh catatan kas yang ada saat ini di database akan dihapus dan digantikan seluruhnya oleh transaksi pada file backup ini.
                  </p>
                  <label className="flex items-center gap-2 pt-1 text-xs text-slate-800 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmReplace}
                      onChange={(e) => setConfirmReplace(e.target.checked)}
                      className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                    />
                    <span>Saya mengerti dan setuju untuk menimpa data</span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isRestoring}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-60"
          >
            Batal
          </button>

          {backupData && (
            <button
              type="button"
              onClick={handleExecuteRestore}
              disabled={isRestoring || (restoreMode === 'replace' && !confirmReplace)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-amber-600/20 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {isRestoring ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Memulihkan Database...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 text-amber-200" />
                  <span>Mulai Pulihkan Data</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
