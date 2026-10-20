import React, { useState, useRef } from 'react';
import {
  Upload,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Loader2,
  RefreshCw,
  Info,
  Calendar,
  Layers,
  ChevronRight
} from 'lucide-react';
import { Transaction } from '../types';
import { formatSimpleRupiah, formatDateIndo } from '../data/initialData';
import { 
  parseExcelToTransactions, 
  downloadExcelTemplate, 
  downloadMasterExcelTemplate, 
  ImportParseResult 
} from '../lib/importUtils';
import { useSekretariat } from '../context/SekretariatContext';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (transactions: Transaction[], mode: 'append' | 'replace') => Promise<void>;
  onTriggerToast: (msg: string, type?: 'success' | 'error' | 'info', title?: string) => void;
  existingCount?: number;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  onTriggerToast,
  existingCount = 0,
}) => {
  const { sekretariat, wilayahShort } = useSekretariat();
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ImportParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setFile(null);
    setParseResult(null);
    setIsParsing(false);
    setIsSubmitting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    handleReset();
    onClose();
  };

  const handleFileProcess = async (selectedFile: File) => {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const lowerName = selectedFile.name.toLowerCase();
    const isValidExt = validExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isValidExt) {
      onTriggerToast(
        'Format file tidak didukung. Harap unggah file Microsoft Excel (.xlsx / .xls) atau CSV.',
        'error',
        'Format Tidak Valid'
      );
      return;
    }

    setFile(selectedFile);
    setIsParsing(true);

    try {
      const result = await parseExcelToTransactions(selectedFile);
      setParseResult(result);
      onTriggerToast(
        `Berhasil membaca ${result.validCount} transaksi dari "${selectedFile.name}".`,
        'success',
        'File Terbaca'
      );
    } catch (err: any) {
      console.error('Import Parse Error:', err);
      onTriggerToast(
        err.message || 'Gagal memproses file Excel. Pastikan format kolom sesuai dengan template ekspor.',
        'error',
        'Gagal Membaca File'
      );
      setFile(null);
      setParseResult(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.transactions.length === 0) return;

    setIsSubmitting(true);
    try {
      await onImport(parseResult.transactions, importMode);
      handleClose();
    } catch (err: any) {
      console.error('Commit import error:', err);
      onTriggerToast(
        err.message || 'Terjadi kesalahan saat menyimpan data impor.',
        'error',
        'Gagal Import'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 print:hidden overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 my-auto overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 border border-emerald-400/30 flex items-center justify-center text-white shrink-0 shadow-md shadow-emerald-950/40">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Import Data Kas dari Excel
              </h3>
              <p className="text-xs text-slate-400">
                Format baris dan kolom 100% sama dengan hasil ekspor Excel Kas {wilayahShort}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
            title="Tutup dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-slate-700">
          {/* STATE 1: Belum Memilih File */}
          {!parseResult && (
            <div className="space-y-4">
              {/* Dropzone Area */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragOver
                    ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
                    : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50/80 bg-slate-50/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileProcess(e.target.files[0]);
                    }
                  }}
                />

                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                  {isParsing ? (
                    <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
                  ) : (
                    <Upload className="w-7 h-7 text-emerald-600" />
                  )}
                </div>

                <div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900">
                    {isParsing ? 'Sedang membaca file Excel...' : 'Pilih File Excel atau Tarik & Lepas ke Sini'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Mendukung file <span className="font-semibold text-slate-700">.xlsx</span>,{' '}
                    <span className="font-semibold text-slate-700">.xls</span>, atau{' '}
                    <span className="font-semibold text-slate-700">.csv</span> dengan struktur tabel hasil ekspor aplikasi ini.
                  </p>
                </div>

                <button
                  type="button"
                  className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer pointer-events-none"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Jelajahi File Komputer</span>
                </button>
              </div>

              {/* Pedoman Format Kolom */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Panduan Format Kolom Excel:</span>
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadExcelTemplate(sekretariat);
                        onTriggerToast('Template Kas (.xlsx) berhasil diunduh!', 'success');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-emerald-700 hover:bg-emerald-50 hover:border-emerald-500 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Template Kas (.xlsx)</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadMasterExcelTemplate(sekretariat);
                        onTriggerToast('Master Template 8 Tabel (.xlsx) berhasil diunduh!', 'success');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 border border-indigo-300 rounded-lg text-xs font-bold text-indigo-700 hover:bg-indigo-100 hover:border-indigo-500 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Master 8 Tabel (.xlsx)</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-900 block">1. Tanggal</span>
                    <span className="text-slate-500">YYYY-MM-DD atau format tanggal Excel</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-900 block">2. Jenis</span>
                    <span className="text-slate-500"><strong className="text-emerald-600">Masuk</strong> atau <strong className="text-rose-600">Keluar</strong></span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-900 block">3. Kategori</span>
                    <span className="text-slate-500">Iuran Warga, Donasi, Operasional, dll.</span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-900 block">4. Jumlah (Rp)</span>
                    <span className="text-slate-500">Nominal angka transaksi (Rp)</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 italic">
                  * Kolom <strong>Keterangan</strong>, <strong>No</strong>, dan <strong>ID Transaksi</strong> bersifat opsional. Kolom total ringkasan di baris terbawah akan otomatis dilewati secara aman.
                </p>
              </div>
            </div>
          )}

          {/* STATE 2: File Berhasil Dibaca (Pratinjau Data) */}
          {parseResult && (
            <div className="space-y-4">
              {/* File Info Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-950 block truncate max-w-xs sm:max-w-md">
                      {parseResult.fileName}
                    </span>
                    <span className="text-[11px] text-emerald-800">
                      Terbaca <strong className="font-semibold">{parseResult.validCount}</strong> baris transaksi valid
                      {parseResult.skippedCount > 0 && ` (${parseResult.skippedCount} baris ringkasan/kosong dilewati)`}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg shrink-0 transition-colors cursor-pointer"
                >
                  Ganti File Lain
                </button>
              </div>

              {/* Ringkasan Akuntansi Hasil Parse */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                    <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                    <span>Kas Masuk</span>
                  </span>
                  <div className="text-sm sm:text-base font-extrabold text-emerald-900 mt-1 truncate">
                    {formatSimpleRupiah(parseResult.totalMasuk)}
                  </div>
                </div>

                <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3 text-rose-600" />
                    <span>Kas Keluar</span>
                  </span>
                  <div className="text-sm sm:text-base font-extrabold text-rose-900 mt-1 truncate">
                    {formatSimpleRupiah(parseResult.totalKeluar)}
                  </div>
                </div>

                <div className="p-3 bg-slate-900 text-white rounded-xl border border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Selisih Bersih
                  </span>
                  <div className="text-sm sm:text-base font-extrabold text-emerald-400 mt-1 truncate">
                    {formatSimpleRupiah(parseResult.saldoBersih)}
                  </div>
                </div>
              </div>

              {/* Pilihan Mode Impor */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-800 block">Metode Impor:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      importMode === 'append'
                        ? 'bg-emerald-50/80 border-emerald-400 text-emerald-950 font-medium'
                        : 'bg-white border-slate-200 hover:bg-slate-100/60 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="text-xs font-bold block">Tambahkan ke Data Saat Ini</span>
                      <span className="text-[11px] text-slate-500">
                        {parseResult.validCount} data baru akan ditambahkan ke {existingCount} data kas yang sudah ada.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      importMode === 'replace'
                        ? 'bg-amber-50/80 border-amber-400 text-amber-950 font-medium'
                        : 'bg-white border-slate-200 hover:bg-slate-100/60 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="text-xs font-bold block">Timpa / Ganti Seluruh Data</span>
                      <span className="text-[11px] text-slate-500">
                        Data lama akan digantikan sepenuhnya dengan {parseResult.validCount} transaksi dari file ini.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Pratinjau Tabel Transaksi */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Pratinjau Data Transaksi ({parseResult.validCount} Baris):
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Menampilkan maksimal 10 baris pertama
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-2 px-3 w-8">#</th>
                        <th className="py-2 px-3">Tanggal</th>
                        <th className="py-2 px-3">Jenis</th>
                        <th className="py-2 px-3">Kategori</th>
                        <th className="py-2 px-3 text-right">Jumlah</th>
                        <th className="py-2 px-3">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {parseResult.transactions.slice(0, 10).map((tx, idx) => (
                        <tr key={tx.id || idx} className="hover:bg-slate-50/80">
                          <td className="py-1.5 px-3 text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-1.5 px-3 whitespace-nowrap font-medium">
                            {formatDateIndo(tx.date)}
                          </td>
                          <td className="py-1.5 px-3">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                tx.type === 'Masuk'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {tx.type}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                            {tx.category}
                          </td>
                          <td
                            className={`py-1.5 px-3 text-right font-bold whitespace-nowrap ${
                              tx.type === 'Masuk' ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            {formatSimpleRupiah(tx.amount)}
                          </td>
                          <td
                            className="py-1.5 px-3 max-w-[180px] truncate text-slate-600"
                            title={tx.description}
                          >
                            {tx.description || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parseResult.validCount > 10 && (
                  <p className="text-[11px] text-center text-slate-500 italic">
                    ...dan {parseResult.validCount - 10} transaksi lainnya siap diimpor.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs disabled:opacity-50"
          >
            Batal
          </button>

          {parseResult && (
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 active:scale-98"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Sedang Menyimpan Data...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>
                    Simpan {parseResult.validCount} Transaksi ke Kas RT
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
