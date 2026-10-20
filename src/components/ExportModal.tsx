import React, { useState } from 'react';
import { 
  Download, 
  X, 
  FileSpreadsheet, 
  Printer, 
  FileCode, 
  FileText,
  ChevronRight, 
  Check, 
  Filter, 
  Layers, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Building2,
  Wallet,
  Database,
  Copy,
  TableProperties,
  Loader2,
  Sparkles
} from 'lucide-react';
import { Transaction } from '../types';
import { formatSimpleRupiah, formatDateIndo } from '../data/initialData';
import { 
  exportToExcel, 
  exportAllTablesToExcel, 
  exportToCSV, 
  exportToJSON, 
  exportToMySQL, 
  generateMySQLDump 
} from '../lib/exportUtils';
import { fetchAll8TablesData } from '../lib/supabase';
import { useSekretariat } from '../context/SekretariatContext';
import { RT_LOGO_DATA_URL } from './AppLogo';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  filteredTransactions?: Transaction[];
  filterLabel?: string;
  onTriggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  transactions,
  filteredTransactions,
  filterLabel,
  onTriggerToast,
}) => {
  const { sekretariat, wilayahShort, wilayahLabel, kelurahanLabel, kopRtLabel } = useSekretariat();
  const [isExportingAll, setIsExportingAll] = useState(false);

  // Mode cakupan: 'all' (semua transaksi) atau 'filtered' (data yang sedang difilter)
  const hasFilteredOption = Boolean(
    filteredTransactions && 
    filteredTransactions.length > 0 && 
    filteredTransactions.length !== transactions.length
  );

  const [scope, setScope] = useState<'all' | 'filtered'>(
    hasFilteredOption ? 'filtered' : 'all'
  );

  if (!isOpen) return null;

  // Tentukan data transaksi aktif yang akan diekspor
  const activeData = scope === 'filtered' && filteredTransactions 
    ? filteredTransactions 
    : transactions;

  const currentScopeTitle = scope === 'filtered' && filterLabel
    ? `Data Terfilter (${filterLabel})`
    : 'Semua Riwayat Transaksi';

  // Hitung metrik data aktif
  let activeMasuk = 0;
  let activeKeluar = 0;
  activeData.forEach((t) => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'Masuk') activeMasuk += amt;
    else if (t.type === 'Keluar') activeKeluar += amt;
  });
  const activeSaldo = activeMasuk - activeKeluar;

  const todayIso = new Date().toISOString().split('T')[0];

  // 1. Ekspor Master Excel 8 Tabel (.xlsx)
  const handleExportAllTablesExcel = async () => {
    setIsExportingAll(true);
    try {
      const allData = await fetchAll8TablesData();
      const rtStr = sekretariat?.rt || '';
      const rwStr = sekretariat?.rw || '';
      const filename = `Master_8_Tabel_${rtStr ? `RT${rtStr}_` : ''}${rwStr ? `RW${rwStr}_` : ''}${todayIso}.xlsx`;
      exportAllTablesToExcel(allData, {
        filename,
        sekretariat,
      });
      onTriggerToast(`Master Workbook Excel 8 Tabel berhasil diunduh!`, 'success');
      onClose();
    } catch (err) {
      console.error('Export All Tables Error:', err);
      onTriggerToast('Gagal mengekspor Master Workbook Excel 8 Tabel.', 'error');
    } finally {
      setIsExportingAll(false);
    }
  };

  // 2. Ekspor Excel Kas RT (.xlsx)
  const handleExportExcel = () => {
    try {
      const rtStr = sekretariat?.rt || '';
      const rwStr = sekretariat?.rw || '';
      const filename = `Kas_${rtStr ? `RT${rtStr}_` : ''}${rwStr ? `RW${rwStr}_` : ''}${scope === 'filtered' ? 'Filtered_' : 'Semua_'}${todayIso}.xlsx`;
      exportToExcel(activeData, {
        filename,
        scopeTitle: currentScopeTitle,
        includeSummary: true,
        sekretariat,
      });
      onTriggerToast(`File Excel (.xlsx) berhasil diunduh (${activeData.length} transaksi)!`, 'success');
      onClose();
    } catch (err) {
      console.error('Export Excel Error:', err);
      onTriggerToast('Gagal mengekspor file Excel. Silakan coba lagi.', 'error');
    }
  };

  // 2. Ekspor Cetak / PDF
  const handlePrintPDF = () => {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        onTriggerToast(
          'Gagal membuka jendela cetak. Harap izinkan pop-up (Pop-up Blocker) pada browser Anda.', 
          'error'
        );
        return;
      }

      const printDateStr = new Date().toLocaleDateString('id-ID', { dateStyle: 'long' });
      const rtRwLabel = `${sekretariat?.rt || '002'}/${sekretariat?.rw || '09'}`;

      // Build rows HTML
      const tableRowsHtml = activeData.map((tx, idx) => `
        <tr class="border-b border-black">
          <td class="border-l border-r border-black px-1.5 py-0.5 text-center text-xs font-mono">${idx + 1}</td>
          <td class="border-r border-black px-1.5 py-0.5 text-center text-xs whitespace-nowrap">${formatDateIndo(tx.date)}</td>
          <td class="border-r border-black px-1.5 py-0.5 text-center text-xs font-bold ${tx.type === 'Masuk' ? 'text-emerald-800' : 'text-rose-800'}">${tx.type}</td>
          <td class="border-r border-black px-1.5 py-0.5 text-xs font-semibold">${tx.category}</td>
          <td class="border-r border-black px-1.5 py-0.5 text-right text-xs font-mono font-bold whitespace-nowrap">${tx.amount.toLocaleString('id-ID')}</td>
          <td class="border-r border-black px-1.5 py-0.5 text-xs break-words">${tx.description || '-'}</td>
        </tr>
      `).join('');

      // Build complete HTML content for the tab
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title></title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Courier+Prime&family=Tinos:wght@400;700&display=swap');
              
              @page {
                size: A4 portrait;
                margin: 0;
              }

              @media print {
                html, body {
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                .no-print {
                  display: none !important;
                }
                #report-content {
                  padding: 8mm 6mm !important;
                  margin: 0 !important;
                  border: none !important;
                  box-shadow: none !important;
                  max-width: 100% !important;
                  width: 100% !important;
                }
                tr {
                  page-break-inside: avoid;
                  break-inside: avoid;
                }
              }

              body {
                font-family: 'Tinos', 'Times New Roman', serif;
                color: #000;
                background-color: #fff;
                line-height: 1.25;
              }
            </style>
            <script>
              const pdfDocTitle = 'Cetak_Laporan_Kas_${sekretariat?.rt ? `RT${sekretariat.rt}_` : ''}${sekretariat?.rw ? `RW${sekretariat.rw}_` : ''}${new Date().toISOString().split('T')[0]}';
              function executeCleanPrint() {
                document.title = "";
                window.print();
                setTimeout(() => {
                  document.title = pdfDocTitle;
                }, 1000);
              }
            </script>
          </head>
          <body class="p-3 md:p-6 text-black">
            <div id="report-content" class="w-full max-w-5xl mx-auto border border-black/10 p-4 md:p-6 bg-white relative">
              
              <!-- Floating controls ONLY on screen, hidden on physical paper -->
              <div class="no-print mb-4 p-3.5 bg-slate-900 text-white rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-md font-sans">
                <div class="flex items-center gap-2.5">
                  <div class="p-1.5 bg-emerald-600 rounded-lg shrink-0">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                  <div>
                    <h4 class="text-xs font-bold uppercase tracking-wider text-emerald-400">Jendela Siap Cetak (Bebas URL & Header)</h4>
                    <p class="text-[11px] text-slate-300">Jika pada dialog cetak masih muncul URL web, pastikan opsi <b>"Headers and footers / Header & catatan kaki"</b> pada pengaturan print browser <b>TIDAK dicentang</b>.</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button onclick="executeCleanPrint()" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95">
                    Cetak Sekarang
                  </button>
                  <button onclick="window.close()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-all cursor-pointer">
                    Tutup Jendela
                  </button>
                </div>
              </div>

              <!-- Kop Surat Resmi Berlogo RT & Label RT/RW di Bawah Logo -->
              <div class="border-b-4 border-double border-blue-900 pb-2 mb-3 text-blue-900">
                <div class="flex items-center justify-between gap-2">
                  <!-- Logo RT Kiri dengan Label RT/RW di Bawah Logo -->
                  <div class="w-16 sm:w-20 shrink-0 flex flex-col items-center justify-center text-center">
                    <img src="${RT_LOGO_DATA_URL}" class="w-12 h-12 sm:w-13 sm:h-13 md:w-14 md:h-14 object-contain" alt="Logo RT" />
                    <span class="font-sans font-bold text-[10px] sm:text-[11px] md:text-[12px] text-blue-950 tracking-tight -mt-0.5 sm:-mt-1 leading-tight whitespace-nowrap">
                      ${rtRwLabel}
                    </span>
                  </div>

                  <!-- Teks Kop Surat Tengah Sempurna & Besar -->
                  <div class="flex-1 text-center px-1">
                    <h1 class="text-sm sm:text-base md:text-lg font-bold uppercase tracking-wide leading-tight whitespace-nowrap">PENGURUS ${sekretariat?.rt ? `RUKUN TETANGGA ${sekretariat.rt}` : 'RUKUN TETANGGA'} ${sekretariat?.rw ? `RUKUN WARGA ${sekretariat.rw}` : 'RUKUN WARGA'}</h1>
                    <h2 class="text-xs sm:text-sm md:text-base font-bold uppercase tracking-wide leading-tight whitespace-nowrap">${sekretariat?.kelurahan ? `KELURAHAN ${sekretariat.kelurahan.toUpperCase()}` : ''}${sekretariat?.kecamatan ? `, KECAMATAN ${sekretariat.kecamatan.toUpperCase()}` : ''}</h2>
                    <p class="text-[10.5px] sm:text-xs md:text-sm italic text-blue-800 mt-0.5">Alamat: ${sekretariat?.alamat || '-'}</p>
                  </div>

                  <!-- Spacer Penyeimbang Kanan Simetris -->
                  <div class="w-16 sm:w-20 shrink-0 hidden sm:flex flex-col items-center justify-center opacity-0 pointer-events-none select-none">
                    <div class="w-12 h-12 sm:w-13 sm:h-13 md:w-14 md:h-14"></div>
                    <span class="text-[10px] sm:text-[11px] md:text-[12px] -mt-0.5 sm:-mt-1">${rtRwLabel}</span>
                  </div>
                </div>
              </div>

              <!-- Judul Laporan -->
              <div class="text-center mb-3">
                <div>
                  <span class="inline-block border-b-2 border-black pb-0.5 text-sm md:text-base font-bold uppercase tracking-wide">LAPORAN REKAPITULASI MUTASI KAS WARGA</span>
                </div>
                <div class="flex justify-between items-center text-[11px] text-gray-700 font-semibold mt-2 bg-gray-50 px-2 py-1 border border-black/10 rounded-sm">
                  <span>Periode: <b class="font-bold text-black">${filterLabel || 'Semua Riwayat'}</b></span>
                  <span>Tanggal Dokumen: ${printDateStr}</span>
                </div>
              </div>

              <!-- Ringkasan Kas -->
              <div class="grid grid-cols-3 gap-0 border border-black text-center divide-x divide-black bg-gray-50/50 mb-3 font-sans">
                <div class="p-1.5">
                  <p class="text-[9px] font-bold uppercase tracking-wider text-gray-600 mb-0.5">Total Kas Masuk (+)</p>
                  <p class="text-xs md:text-sm font-bold text-emerald-800">${formatSimpleRupiah(activeMasuk)}</p>
                </div>
                <div class="p-1.5">
                  <p class="text-[9px] font-bold uppercase tracking-wider text-gray-600 mb-0.5">Total Kas Keluar (-)</p>
                  <p class="text-xs md:text-sm font-bold text-rose-800">${formatSimpleRupiah(activeKeluar)}</p>
                </div>
                <div class="p-1.5">
                  <p class="text-[9px] font-bold uppercase tracking-wider text-gray-600 mb-0.5">Saldo Bersih Akhir</p>
                  <p class="text-xs md:text-sm font-bold ${activeSaldo >= 0 ? 'text-blue-800' : 'text-rose-900'}">${formatSimpleRupiah(activeSaldo)}</p>
                </div>
              </div>

              <!-- Tabel Transaksi Rinci -->
              <table class="w-full border-collapse border border-black mb-4">
                <thead>
                  <tr class="bg-gray-100 border-b border-black text-[11px] font-bold font-sans uppercase">
                    <th class="border-l border-r border-black px-1.5 py-1 text-center w-[4%]">No</th>
                    <th class="border-r border-black px-1.5 py-1 text-center w-[11%]">Tanggal</th>
                    <th class="border-r border-black px-1.5 py-1 text-center w-[8%]">Jenis</th>
                    <th class="border-r border-black px-1.5 py-1 text-left w-[24%]">Kategori</th>
                    <th class="border-r border-black px-1.5 py-1 text-right w-[14%]">Jumlah</th>
                    <th class="border-r border-black px-1.5 py-1 text-left w-[39%]">Keterangan</th>
                  </tr>
                </thead>
                <tbody class="text-xs">
                  ${tableRowsHtml}
                  <!-- Total row at bottom -->
                  <tr class="bg-gray-50 border-t border-b border-black font-bold font-sans text-xs">
                    <td colspan="4" class="border-l border-r border-black px-1.5 py-1 text-right">TOTAL KAS MASUK:</td>
                    <td class="border-r border-black px-1.5 py-1 text-right font-mono text-emerald-800">${activeMasuk.toLocaleString('id-ID')}</td>
                    <td class="border-r border-black px-1.5 py-1 text-[11px] text-gray-600 italic">Total Penerimaan Kas</td>
                  </tr>
                  <tr class="bg-gray-50 border-b border-black font-bold font-sans text-xs">
                    <td colspan="4" class="border-l border-r border-black px-1.5 py-1 text-right">TOTAL KAS KELUAR:</td>
                    <td class="border-r border-black px-1.5 py-1 text-right font-mono text-rose-800">${activeKeluar.toLocaleString('id-ID')}</td>
                    <td class="border-r border-black px-1.5 py-1 text-[11px] text-gray-600 italic">Total Pengeluaran Kas</td>
                  </tr>
                  <tr class="bg-gray-100 border-b border-black font-bold font-sans text-xs">
                    <td colspan="4" class="border-l border-r border-black px-1.5 py-1 text-right text-xs">SALDO BERSIH KAS RT:</td>
                    <td class="border-r border-black px-1.5 py-1 text-right font-mono text-xs text-blue-900">${activeSaldo.toLocaleString('id-ID')}</td>
                    <td class="border-r border-black px-1.5 py-1 text-[11px] text-gray-800 italic">Arus Kas Bersih Tersisa</td>
                  </tr>
                </tbody>
              </table>

              <!-- Footer Penjelasan & Tanda Tangan -->
              <div class="mt-6 text-xs font-sans break-inside-avoid">
                <div class="grid grid-cols-2 text-center">
                  <div></div>
                  <div class="pb-1">
                    <p>${sekretariat.kelurahan ? `Kelurahan ${sekretariat.kelurahan}, ` : ''}${printDateStr}</p>
                  </div>
                </div>
                
                <div class="grid grid-cols-2 text-center mt-1">
                  <div class="space-y-12 col-span-1">
                    <p class="font-bold uppercase tracking-wider text-gray-700">Bendahara ${wilayahShort}</p>
                    <div>
                      <span class="font-bold text-sm border-b border-black pb-1 inline-block min-w-[140px]">Bendahara</span>
                    </div>
                  </div>
                  
                  <div class="space-y-12 col-span-1">
                    <p class="font-bold uppercase tracking-wider text-gray-700">Ketua ${wilayahShort}</p>
                    <div>
                      <span class="font-bold text-sm border-b border-black pb-1 inline-block min-w-[140px]">${sekretariat.nama_ketua_rt || 'Ketua RT'}</span>
                    </div>
                  </div>
                </div>

                <div class="text-center mt-6 pt-4 border-t border-dashed border-gray-300 text-[10px] text-gray-400 no-print font-sans">
                  Dokumen ini digenerate secara otomatis oleh Sistem Pembukuan Digital Kas ${wilayahShort}${sekretariat.kelurahan ? ` Kelurahan ${sekretariat.kelurahan}` : ''}.
                </div>
              </div>

            </div>

            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 400);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
      onTriggerToast(`Jendela Cetak PDF berhasil dibuka di tab baru!`, 'success');
      onClose();
    } catch (err) {
      console.error('Export Print Error:', err);
      onTriggerToast('Gagal memicu jendela cetak.', 'error');
    }
  };

  // 3. Ekspor CSV
  const handleExportCSV = () => {
    try {
      const rtStr = sekretariat?.rt || '';
      const rwStr = sekretariat?.rw || '';
      const filename = `Kas_${rtStr ? `RT${rtStr}_` : ''}${rwStr ? `RW${rwStr}_` : ''}${scope === 'filtered' ? 'Filtered_' : 'Semua_'}${todayIso}.csv`;
      exportToCSV(activeData, {
        filename,
        scopeTitle: currentScopeTitle,
        sekretariat,
      });
      onTriggerToast(`File CSV berhasil diunduh (${activeData.length} transaksi)!`, 'success');
      onClose();
    } catch (err) {
      console.error('Export CSV Error:', err);
      onTriggerToast('Gagal mengekspor file CSV.', 'error');
    }
  };

  // 4. Ekspor JSON
  const handleExportJSON = () => {
    try {
      const rtStr = sekretariat?.rt || '';
      const rwStr = sekretariat?.rw || '';
      const filename = `Kas_${rtStr ? `RT${rtStr}_` : ''}${rwStr ? `RW${rwStr}_` : ''}Backup_${scope === 'filtered' ? 'Filtered_' : 'Semua_'}${todayIso}.json`;
      exportToJSON(activeData, {
        filename,
        scopeTitle: currentScopeTitle,
        sekretariat,
      });
      onTriggerToast(`Cadangan data JSON berhasil diunduh (${activeData.length} transaksi)!`, 'success');
      onClose();
    } catch (err) {
      console.error('Export JSON Error:', err);
      onTriggerToast('Gagal mengekspor data JSON.', 'error');
    }
  };

  // 5. Ekspor SQL (MySQL Dump: DDL + DML)
  const handleExportMySQL = () => {
    try {
      const rtStr = sekretariat?.rt || '';
      const rwStr = sekretariat?.rw || '';
      const filename = `kas_rt_mysql_${rtStr ? `RT${rtStr}_` : ''}${rwStr ? `RW${rwStr}_` : ''}${scope === 'filtered' ? 'Filtered_' : 'Semua_'}${todayIso}.sql`;
      exportToMySQL(activeData, {
        filename,
        scopeTitle: currentScopeTitle,
        sekretariat,
      });
      onTriggerToast(`File SQL MySQL (.sql) berhasil diunduh (${activeData.length} transaksi)!`, 'success');
      onClose();
    } catch (err) {
      console.error('Export MySQL Error:', err);
      onTriggerToast('Gagal mengekspor file SQL MySQL.', 'error');
    }
  };

  const handleCopyMySQL = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const sql = generateMySQLDump(activeData, currentScopeTitle, sekretariat);
      navigator.clipboard.writeText(sql);
      onTriggerToast('Query SQL MySQL berhasil disalin ke clipboard!', 'success');
    } catch (err) {
      console.error('Copy SQL Error:', err);
      onTriggerToast('Gagal menyalin query SQL.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 print:hidden overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-5 sm:p-6 animate-in fade-in zoom-in-95 border border-slate-200 my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-center shadow-sm">
              <Download className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                  Ekspor & Unduh Data Kas
                </h3>
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                  {wilayahShort}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {kelurahanLabel} • Pilihan format spreadsheet & dokumen
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scope Switcher (Jika ada opsi filtered) */}
        {hasFilteredOption && filteredTransactions && (
          <div className="mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">
              Pilih Cakupan Data yang Diekspor:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope('filtered')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  scope === 'filtered'
                    ? 'bg-white text-emerald-700 border-emerald-400 shadow-xs ring-2 ring-emerald-500/10'
                    : 'bg-transparent text-slate-600 border-slate-200 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span className="truncate">
                  Data Terfilter ({filteredTransactions.length})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setScope('all')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  scope === 'all'
                    ? 'bg-white text-slate-900 border-slate-400 shadow-xs ring-2 ring-slate-900/10'
                    : 'bg-transparent text-slate-600 border-slate-200 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="truncate">Semua Data ({transactions.length})</span>
              </button>
            </div>
            {scope === 'filtered' && filterLabel && (
              <div className="text-[11px] text-emerald-700 font-medium mt-2 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Menyaring: {filterLabel}</span>
              </div>
            )}
          </div>
        )}

        {/* Ringkasan Singkat Data yang Dipilih */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white rounded-xl p-3.5 mb-4 shadow-md border border-slate-800">
          <div className="flex items-center justify-between text-xs mb-2 pb-2 border-b border-slate-800">
            <span className="text-slate-400 font-medium">
              Data siap diekspor:
            </span>
            <span className="font-bold text-white bg-white/10 px-2 py-0.5 rounded text-[11px] border border-white/10">
              {activeData.length} Transaksi Tercatat
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/50">
              <span className="text-[10px] text-emerald-400 block font-semibold">Kas Masuk</span>
              <span className="font-extrabold text-[11px] text-white">
                {formatSimpleRupiah(activeMasuk)}
              </span>
            </div>
            <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/50">
              <span className="text-[10px] text-rose-400 block font-semibold">Kas Keluar</span>
              <span className="font-extrabold text-[11px] text-white">
                {formatSimpleRupiah(activeKeluar)}
              </span>
            </div>
            <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700/50">
              <span className="text-[10px] text-blue-300 block font-semibold">Saldo Bersih</span>
              <span className="font-extrabold text-[11px] text-white">
                {formatSimpleRupiah(activeSaldo)}
              </span>
            </div>
          </div>
        </div>

        {/* Export Options List */}
        <div className="space-y-2.5 mb-4">
          {/* 0. Master Workbook Excel 8 Tabel (.xlsx) */}
          <button
            type="button"
            onClick={handleExportAllTablesExcel}
            disabled={isExportingAll}
            className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-indigo-300 bg-gradient-to-r from-indigo-50/70 via-indigo-50/40 to-blue-50/40 hover:bg-indigo-50 hover:border-indigo-500 transition-all text-left group cursor-pointer shadow-xs disabled:opacity-60"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform">
                {isExportingAll ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : <TableProperties className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-indigo-950 group-hover:text-indigo-800">
                    Master Workbook Excel 8 Tabel (.xlsx)
                  </span>
                  <span className="text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.2 rounded-full">
                    8 Lembar Kerja
                  </span>
                </div>
                <p className="text-[11px] text-indigo-900/70 mt-0.5 leading-tight">
                  1 file Excel lengkap dengan 8 sheet: Buku Kas, Kategori, Warga, Pengguna, Inventaris, Peminjaman, Darurat SOS, & Sekretariat
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-indigo-400 group-hover:text-indigo-700 shrink-0 ml-2" />
          </button>

          {/* 1. Format Excel (.xlsx) */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-400 transition-all text-left group cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-slate-900 group-hover:text-emerald-800">
                    Microsoft Excel (.xlsx)
                  </span>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                    Rekomendasi
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                  Spreadsheet rapi dengan kolom Tanggal, Jenis, Kategori, Nominal, Keterangan & formula total otomatis
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 shrink-0 ml-2" />
          </button>

          {/* 2. Cetak / Simpan PDF */}
          <button
            type="button"
            onClick={handlePrintPDF}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700 shrink-0 group-hover:scale-105 transition-transform">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-slate-900 group-hover:text-blue-800">
                    Cetak / Simpan PDF
                  </span>
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded">
                    Siap Cetak
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                  Format resmi untuk rapat warga {wilayahShort} dengan kop surat, tabel rekap, dan kolom tanda tangan
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-700 shrink-0 ml-2" />
          </button>

          {/* 3. Format CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0 group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-extrabold text-slate-900 group-hover:text-slate-900 block">
                  Format CSV (Nilai Terpisah Koma)
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                  Format universal UTF-8 BOM, kompatibel dengan Google Sheets, Excel, dan program akuntansi
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
          </button>

          {/* 4. Format SQL Dump (MySQL) */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/60 hover:border-indigo-400 transition-all p-3 group">
            <div className="flex items-center justify-between gap-3">
              <div
                onClick={handleExportMySQL}
                className="flex items-center gap-3 cursor-pointer flex-1"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <Database className="w-5 h-5 text-indigo-100" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-900 group-hover:text-indigo-900">
                      MySQL Database Dump (.sql)
                    </span>
                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded">
                      MySQL / MariaDB
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                    Struktur DDL <code className="font-mono text-indigo-900 font-bold bg-white/80 px-1 rounded border border-indigo-200">CREATE TABLE kas_rt</code> + query <code className="font-mono text-indigo-900 font-bold bg-white/80 px-1 rounded border border-indigo-200">INSERT</code> siap import ke phpMyAdmin / MySQL
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyMySQL}
                  title="Salin query SQL ke clipboard"
                  className="p-2 rounded-lg bg-white hover:bg-indigo-100/80 text-indigo-700 border border-indigo-200 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Salin</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportMySQL}
                  title="Unduh file .sql"
                  className="px-2.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh .sql</span>
                </button>
              </div>
            </div>
          </div>

          {/* 5. Format JSON Backup */}
          <button
            type="button"
            onClick={handleExportJSON}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700 shrink-0 group-hover:scale-105 transition-transform">
                <FileCode className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-extrabold text-slate-900 block">
                  Format JSON (Cadangan Data Sistem)
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                  File backup terstruktur memuat metadata dan riwayat lengkap untuk pemulihan data tabel kas_rt
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
          </button>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-xs">
          <span className="text-[11px] text-slate-500">
            Database: <strong className="text-slate-800">tabel kas_rt</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
