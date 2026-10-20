import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Printer, 
  Settings, 
  FileText, 
  Eye, 
  Check, 
  HelpCircle,
  Sparkles,
  ArrowRight,
  Info,
  ChevronRight,
  User,
  Calendar,
  Layers,
  Download
} from 'lucide-react';
import { Transaction } from '../types';
import { formatSimpleRupiah, formatDateIndo } from '../data/initialData';
import { useSekretariat } from '../context/SekretariatContext';
import { fetchAllPengurusFromSupabase } from '../lib/supabase';
import { AppLogo, RT_LOGO_DATA_URL } from './AppLogo';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  periodLabel: string;
  onTriggerToast: (msg: string, type?: 'success' | 'error' | 'info', title?: string) => void;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  transactions,
  periodLabel,
  onTriggerToast,
}) => {
  const { sekretariat, wilayahShort, wilayahLabel, kelurahanLabel, kopRtLabel } = useSekretariat();

  // Configuration States
  const [paperSize, setPaperSize] = useState<'A4' | 'F4'>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [showSignatures, setShowSignatures] = useState<boolean>(true);
  const [signatureDate, setSignatureDate] = useState<string>(() => {
    const today = new Date();
    return today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  });
  const [chairmanName, setChairmanName] = useState<string>(sekretariat.nama_ketua_rt || 'Drs. H. Mulyadi');
  const [treasurerName, setTreasurerName] = useState<string>('Hj. Siti Aminah');
  const [reportTitle, setReportTitle] = useState<string>(`LAPORAN PERTANGGUNGJAWABAN KAS ${wilayahShort.toUpperCase()}`);
  const [subTitle, setSubTitle] = useState<string>('Buku Kas Keuangan & Laporan Pertanggungjawaban Mutasi Kas Warga');

  // Load official signatures from pengguna on mount/isOpen
  useEffect(() => {
    const fetchOfficialSignatures = async () => {
      if (!isOpen) return;
      try {
        const pengurusList = await fetchAllPengurusFromSupabase().catch(() => []);

        // 1. Find Ketua RT
        const ketuaRt = pengurusList.find(
          (p) => p.jabatan === 'Ketua RT' || p.jabatan === 'Ketua'
        );
        if (ketuaRt) {
          setChairmanName(ketuaRt.nama);
        } else if (sekretariat.nama_ketua_rt) {
          setChairmanName(sekretariat.nama_ketua_rt);
        }

        // 2. Find Bendahara
        const bendahara = pengurusList.find(
          (p) => p.jabatan === 'Bendahara'
        );
        if (bendahara) {
          setTreasurerName(bendahara.nama);
        } else {
          setTreasurerName('Bendahara RT');
        }
      } catch (err) {
        console.warn('Gagal memuat tanda tangan dari pengguna:', err);
      }
    };

    fetchOfficialSignatures();
    setReportTitle(`LAPORAN PERTANGGUNGJAWABAN KAS ${wilayahShort.toUpperCase()}`);
  }, [isOpen, sekretariat, wilayahShort]);

  // Sort transactions chronologically by date
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      const dateA = new Date(a.date).getTime() || 0;
      const dateB = new Date(b.date).getTime() || 0;
      return dateA - dateB;
    });
  }, [transactions]);

  // Calculate stats
  let totalMasuk = 0;
  let totalKeluar = 0;
  sortedTransactions.forEach((tx) => {
    const amount = Number(tx.amount) || 0;
    if (tx.type === 'Masuk') {
      totalMasuk += amount;
    } else if (tx.type === 'Keluar') {
      totalKeluar += amount;
    }
  });
  const netBalance = totalMasuk - totalKeluar;

  if (!isOpen) return null;

  // Function to launch bulletproof printing window
  const handleLaunchPrint = () => {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        onTriggerToast(
          'Gagal membuka jendela cetak. Harap izinkan pop-up (Pop-up Blocker) pada browser Anda.', 
          'error', 
          'Pop-up Terblokir'
        );
        return;
      }

      // Format date
      const printDateStr = new Date().toLocaleDateString('id-ID', { dateStyle: 'long' });

      // Build rows HTML (sorted chronologically)
      const tableRowsHtml = sortedTransactions.map((tx, idx) => `
        <tr class="border-b border-black">
          <td class="border-l border-r border-black px-1.5 py-0.5 text-center text-xs font-mono">${idx + 1}</td>
          <td class="border-r border-black px-1.5 py-0.5 text-center text-xs whitespace-nowrap">${formatDateIndo(tx.date)}</td>
          <td class="border-r border-black px-1.5 py-0.5 text-center text-xs font-bold ${tx.type === 'Masuk' ? 'text-emerald-800' : 'text-rose-800'}">${tx.type}</td>
          <td class="border-r border-black px-1.5 py-0.5 text-xs font-semibold">${tx.category}</td>
          <td class="border-r border-black px-1.5 py-0.5 text-right text-xs font-mono font-bold whitespace-nowrap">${tx.amount.toLocaleString('id-ID')}</td>
          <td class="border-r border-black px-1.5 py-0.5 text-xs break-words">${tx.description || '-'}</td>
        </tr>
      `).join('');

      const rtRwLabel = `${sekretariat.rt || '002'}/${sekretariat.rw || '09'}`;

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
                size: ${paperSize === 'A4' ? 'A4' : '8.5in 13in'} ${orientation};
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
            <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
            <script>
              const pdfDocTitle = 'Cetak_Laporan_Kas_${wilayahShort.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}';
              
              function executeCleanPrint() {
                document.title = "";
                window.print();
                setTimeout(() => {
                  document.title = pdfDocTitle;
                }, 1000);
              }

              function downloadReport() {
                const btn = document.getElementById("download-btn");
                const originalText = btn.innerHTML;
                btn.innerHTML = "Memproses PDF...";
                btn.disabled = true;
                
                // Hide controls temporarily so they don't appear in the PDF
                const controls = document.getElementById("print-controls");
                controls.style.display = "none";
                
                const element = document.getElementById("report-content");
                const opt = {
                  margin:       [6, 6, 6, 6],
                  filename:     pdfDocTitle + '.pdf',
                  image:        { type: 'jpeg', quality: 0.98 },
                  html2canvas:  { scale: 2, useCORS: true },
                  jsPDF:        { unit: 'mm', format: '${paperSize === 'A4' ? 'a4' : 'legal'}', orientation: '${orientation}' },
                  pagebreak:    { mode: ['css', 'legacy'], avoid: 'tr' }
                };
                
                html2pdf().set(opt).from(element).save().then(() => {
                  controls.style.display = "flex";
                  btn.innerHTML = originalText;
                  btn.disabled = false;
                });
              }
            </script>
          </head>
          <body class="p-3 md:p-6 text-black">
            <div id="report-content" class="w-full max-w-5xl mx-auto border border-black/10 p-4 md:p-6 shadow-xs sm:shadow-none bg-white relative">
              
              <!-- Floating controls ONLY on screen, hidden on physical paper -->
              <div id="print-controls" class="no-print mb-4 p-3.5 bg-slate-900 text-white rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-md font-sans">
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
                  <button id="download-btn" onclick="downloadReport()" class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    Download PDF
                  </button>
                  <button onclick="executeCleanPrint()" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
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
                    <h1 class="text-sm sm:text-base md:text-lg font-bold uppercase tracking-wide leading-tight whitespace-nowrap">PENGURUS ${sekretariat.rt ? `RUKUN TETANGGA ${sekretariat.rt}` : 'RUKUN TETANGGA'} ${sekretariat.rw ? `RUKUN WARGA ${sekretariat.rw}` : 'RUKUN WARGA'}</h1>
                    <h2 class="text-xs sm:text-sm md:text-base font-bold uppercase tracking-wide leading-tight whitespace-nowrap">${sekretariat.kelurahan ? `KELURAHAN ${sekretariat.kelurahan.toUpperCase()}` : ''}${sekretariat.kecamatan ? `, KECAMATAN ${sekretariat.kecamatan.toUpperCase()}` : ''}</h2>
                    <p class="text-[10.5px] sm:text-xs md:text-sm italic text-blue-800 mt-0.5">Alamat: ${sekretariat.alamat || '-'}</p>
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
                  <span class="inline-block border-b-2 border-black pb-0.5 text-sm md:text-base font-bold uppercase tracking-wide">${reportTitle}</span>
                </div>
                <p class="text-[11px] font-semibold mt-1 italic text-gray-700">${subTitle}</p>
                <div class="flex justify-between items-center text-[11px] text-gray-700 font-semibold mt-2 bg-gray-50 px-2 py-1 border border-black/10 rounded-sm">
                  <span>Periode: <b class="font-bold text-black">${periodLabel}</b></span>
                  <span>Tanggal Dokumen: ${printDateStr}</span>
                </div>
              </div>

              <!-- Ringkasan Kas -->
              <div class="grid grid-cols-3 gap-0 border border-black text-center divide-x divide-black bg-gray-50/50 mb-3 font-sans">
                <div class="p-1.5">
                  <p class="text-[9px] font-bold uppercase tracking-wider text-gray-600 mb-0.5">Total Kas Masuk (+)</p>
                  <p class="text-xs md:text-sm font-bold text-emerald-800">${formatSimpleRupiah(totalMasuk)}</p>
                </div>
                <div class="p-1.5">
                  <p class="text-[9px] font-bold uppercase tracking-wider text-gray-600 mb-0.5">Total Kas Keluar (-)</p>
                  <p class="text-xs md:text-sm font-bold text-rose-800">${formatSimpleRupiah(totalKeluar)}</p>
                </div>
                <div class="p-1.5">
                  <p class="text-[9px] font-bold uppercase tracking-wider text-gray-600 mb-0.5">Saldo Bersih Akhir</p>
                  <p class="text-xs md:text-sm font-bold ${netBalance >= 0 ? 'text-blue-800' : 'text-rose-900'}">${formatSimpleRupiah(netBalance)}</p>
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
                    <td class="border-r border-black px-1.5 py-1 text-right font-mono text-emerald-800">${totalMasuk.toLocaleString('id-ID')}</td>
                    <td class="border-r border-black px-1.5 py-1 text-[11px] text-gray-600 italic">Total Penerimaan Kas</td>
                  </tr>
                  <tr class="bg-gray-50 border-b border-black font-bold font-sans text-xs">
                    <td colspan="4" class="border-l border-r border-black px-1.5 py-1 text-right">TOTAL KAS KELUAR:</td>
                    <td class="border-r border-black px-1.5 py-1 text-right font-mono text-rose-800">${totalKeluar.toLocaleString('id-ID')}</td>
                    <td class="border-r border-black px-1.5 py-1 text-[11px] text-gray-600 italic">Total Pengeluaran Kas</td>
                  </tr>
                  <tr class="bg-gray-100 border-b border-black font-bold font-sans text-xs">
                    <td colspan="4" class="border-l border-r border-black px-1.5 py-1 text-right text-xs">SALDO BERSIH KAS RT:</td>
                    <td class="border-r border-black px-1.5 py-1 text-right font-mono text-xs text-blue-900">${netBalance.toLocaleString('id-ID')}</td>
                    <td class="border-r border-black px-1.5 py-1 text-[11px] text-gray-800 italic">Arus Kas Bersih Tersisa</td>
                  </tr>
                </tbody>
              </table>

              <!-- Footer Penjelasan & Tanda Tangan -->
              ${showSignatures ? `
                <div class="mt-6 text-xs font-sans break-inside-avoid">
                  <div class="grid grid-cols-2 text-center">
                    <div></div>
                    <div class="pb-1">
                      <p>${sekretariat.kelurahan ? `Kelurahan ${sekretariat.kelurahan}, ` : ''}${signatureDate}</p>
                    </div>
                  </div>
                  
                  <div class="grid grid-cols-2 text-center mt-1">
                    <div class="space-y-12">
                      <p class="font-bold uppercase tracking-wider text-gray-700">Bendahara ${wilayahShort}</p>
                      <div>
                        <span class="font-bold text-sm border-b border-black pb-1 inline-block min-w-[140px]">${treasurerName}</span>
                        <p class="text-[10px] text-gray-500 mt-1">Pengelola Kas RT</p>
                      </div>
                    </div>
                    
                    <div class="space-y-12">
                      <p class="font-bold uppercase tracking-wider text-gray-700">Ketua ${wilayahShort}</p>
                      <div>
                        <span class="font-bold text-sm border-b border-black pb-1 inline-block min-w-[140px]">${chairmanName}</span>
                        <p class="text-[10px] text-gray-500 mt-1">Pengurus Lingkungan</p>
                      </div>
                    </div>
                  </div>

                  <div class="text-center mt-6 pt-4 border-t border-dashed border-gray-300 text-[10px] text-gray-400 no-print font-sans">
                    Dokumen ini digenerate secara otomatis oleh Sistem Pembukuan Digital Kas ${wilayahShort}${sekretariat.kelurahan ? ` Kelurahan ${sekretariat.kelurahan}` : ''}.
                  </div>
                </div>
              ` : ''}

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
      onTriggerToast('Jendela Cetak PDF berhasil dibuka di tab baru!', 'success', 'Cetak Laporan');
      onClose();
    } catch (e) {
      console.error(e);
      onTriggerToast('Gagal memicu jendela cetak. Silakan coba lagi.', 'error', 'Sistem Error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-scale-up">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-slate-900 border-b border-slate-800 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-md shadow-indigo-500/10">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                Pratinjau & Cetak Laporan PDF
              </h3>
              <p className="text-xs text-slate-400">
                Laporan Keuangan Resmi {wilayahLabel}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body (Split view on large screens) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 flex flex-col lg:flex-row gap-6">
          
          {/* Left Column: Adjustments & Settings */}
          <div className="w-full lg:w-96 flex flex-col gap-4 shrink-0">
            
            {/* Box 1: Layout & Format */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3.5">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Settings className="w-3.5 h-3.5 text-indigo-600" />
                <span>Pengaturan Layout Kertas</span>
              </h4>
              
              {/* Paper Size selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Ukuran Kertas</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaperSize('A4')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      paperSize === 'A4'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    A4 (Standar)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaperSize('F4')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      paperSize === 'F4'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                    title="F4 / Folio (8.5 x 13 inch)"
                  >
                    F4 / Folio
                  </button>
                </div>
              </div>

              {/* Orientation selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Orientasi Kertas</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrientation('portrait')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      orientation === 'portrait'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Potret (Tinggi)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrientation('landscape')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      orientation === 'landscape'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Lanskap (Lebar)
                  </button>
                </div>
              </div>

              {/* Title settings */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Judul Laporan</label>
                  <input
                    type="text"
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 bg-slate-50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Sub-Judul Laporan</label>
                  <input
                    type="text"
                    value={subTitle}
                    onChange={(e) => setSubTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 bg-slate-50"
                  />
                </div>
              </div>
            </div>

            {/* Box 2: Signatures & Names */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Tanda Tangan Pengurus</span>
                </h4>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSignatures}
                    onChange={(e) => setShowSignatures(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-7 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {showSignatures && (
                <div className="space-y-3 animate-fade-in text-xs">
                  {/* Signature Date */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>Tanggal Dokumen / TTD</span>
                    </label>
                    <input
                      type="text"
                      value={signatureDate}
                      onChange={(e) => setSignatureDate(e.target.value)}
                      placeholder="Contoh: 14 September 2026"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 bg-slate-50"
                    />
                  </div>

                  {/* Ketua RT Name */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="font-semibold text-slate-700">Nama Ketua RT</div>
                    <input
                      type="text"
                      value={chairmanName}
                      onChange={(e) => setChairmanName(e.target.value)}
                      placeholder="Nama Ketua RT"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 bg-slate-50"
                    />
                  </div>

                  {/* Bendahara Name */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="font-semibold text-slate-700">Nama Bendahara</div>
                    <input
                      type="text"
                      value={treasurerName}
                      onChange={(e) => setTreasurerName(e.target.value)}
                      placeholder="Nama Bendahara"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 bg-slate-50"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Hint alert */}
            <div className="bg-blue-50/80 border border-blue-200 p-3.5 rounded-xl text-xs text-blue-900 leading-relaxed flex gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Tips Aman Cetak:</span> Jendela cetak akan membuka tab baru di luar sandbox iFrame ini, sehingga dialog sistem cetak Anda dijamin terbuka lancar tanpa terblokir browser.
              </div>
            </div>
          </div>

          {/* Right Column: Live Document Preview */}
          <div className="flex-1 min-w-0 flex flex-col bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            
            {/* Preview Toolbar */}
            <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-slate-700 shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                Pratinjau Halaman ({transactions.length} Transaksi)
              </span>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold bg-white px-2 py-1 rounded-md border border-slate-200/80">
                <span>Ukuran: <b className="text-slate-800">{paperSize}</b></span>
                <span>•</span>
                <span>Orientasi: <b className="text-slate-800">{orientation === 'portrait' ? 'Potret' : 'Lanskap'}</b></span>
              </div>
            </div>

            {/* Mini Printable Document container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/40 select-none">
              <div 
                className={`mx-auto bg-white p-6 border border-slate-300 shadow-sm transition-all text-black relative leading-tight ${
                  orientation === 'landscape' ? 'max-w-4xl' : 'max-w-2xl'
                }`}
                style={{
                  fontFamily: 'serif',
                }}
              >
                
                {/* Official Kop Surat Berlogo RT & Label RT/RW di Bawah Logo */}
                <div className="border-b-2 border-blue-900 pb-2 mb-3 relative text-blue-900">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-13 sm:w-16 shrink-0 flex flex-col items-center justify-center text-center">
                      <img src={RT_LOGO_DATA_URL} className="w-10 h-10 sm:w-12 sm:h-12 object-contain" alt="Logo RT" />
                      <span className="font-sans font-bold text-[9px] sm:text-[10px] text-blue-950 tracking-tight -mt-0.5 sm:-mt-1 leading-tight whitespace-nowrap">
                        {sekretariat.rt || '002'}/{sekretariat.rw || '09'}
                      </span>
                    </div>
                    <div className="flex-1 text-center px-1">
                      <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wide leading-tight whitespace-nowrap">PENGURUS {sekretariat.rt ? `RUKUN TETANGGA ${sekretariat.rt}` : 'RUKUN TETANGGA'} {sekretariat.rw ? `RUKUN WARGA ${sekretariat.rw}` : 'RUKUN WARGA'}</h4>
                      <h5 className="text-[10px] sm:text-xs font-bold uppercase tracking-wide leading-tight whitespace-nowrap">{sekretariat.kelurahan ? `KELURAHAN ${sekretariat.kelurahan.toUpperCase()}` : ''}{sekretariat.kecamatan ? `, KECAMATAN ${sekretariat.kecamatan.toUpperCase()}` : ''}</h5>
                      <p className="text-[9px] sm:text-[10px] italic text-blue-800 mt-0.5">Alamat: {sekretariat.alamat || '-'}</p>
                    </div>
                    <div className="w-13 sm:w-16 shrink-0 hidden sm:flex flex-col items-center justify-center opacity-0 pointer-events-none select-none">
                      <div className="w-10 h-10 sm:w-12 sm:h-12"></div>
                      <span className="text-[9px] sm:text-[10px] -mt-0.5 sm:-mt-1">{sekretariat.rt || '002'}/{sekretariat.rw || '09'}</span>
                    </div>
                  </div>
                </div>

                {/* Title */}
                <div className="text-center mb-4">
                  <div>
                    <span className="inline-block border-b-2 border-slate-900 pb-[1px] text-xs font-bold uppercase tracking-wide">{reportTitle}</span>
                  </div>
                  <p className="text-[10px] italic text-slate-700 mt-1">{subTitle}</p>
                  
                  <div className="flex justify-between items-center text-[10px] text-slate-800 font-semibold mt-3 bg-slate-50 p-1.5 border border-slate-200 rounded-sm">
                    <span>Periode: <b className="text-black">{periodLabel}</b></span>
                    <span>Tgl Cetak: {new Date().toLocaleDateString('id-ID', { dateStyle: 'medium' })}</span>
                  </div>
                </div>

                {/* Compact Stats */}
                <div className="grid grid-cols-3 divide-x divide-black border border-black bg-slate-50/50 mb-4 text-center">
                  <div className="p-1.5">
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Total Masuk</p>
                    <p className="text-xs font-bold text-emerald-800">{formatSimpleRupiah(totalMasuk)}</p>
                  </div>
                  <div className="p-1.5">
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Total Keluar</p>
                    <p className="text-xs font-bold text-rose-800">{formatSimpleRupiah(totalKeluar)}</p>
                  </div>
                  <div className="p-1.5">
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Saldo Bersih</p>
                    <p className="text-xs font-bold text-indigo-900">{formatSimpleRupiah(netBalance)}</p>
                  </div>
                </div>

                {/* Miniature Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-black text-[9px] text-black">
                    <thead>
                      <tr className="bg-slate-100 border-b border-black font-semibold">
                        <th className="border-l border-r border-black p-1 text-center w-8">No</th>
                        <th className="border-r border-black p-1 text-center w-20">Tanggal</th>
                        <th className="border-r border-black p-1 text-center w-14">Jenis</th>
                        <th className="border-r border-black p-1 text-left">Kategori</th>
                        <th className="border-r border-black p-1 text-right w-24">Jumlah</th>
                        <th className="border-r border-black p-1 text-left">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTransactions.slice(0, 8).map((tx, idx) => (
                        <tr key={tx.id} className="border-b border-slate-300">
                          <td className="border-l border-r border-black p-1 text-center">{idx + 1}</td>
                          <td className="border-r border-black p-1 text-center whitespace-nowrap">{formatDateIndo(tx.date)}</td>
                          <td className={`border-r border-black p-1 text-center font-bold ${tx.type === 'Masuk' ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {tx.type}
                          </td>
                          <td className="border-r border-black p-1 truncate max-w-[80px]">{tx.category}</td>
                          <td className="border-r border-black p-1 text-right font-mono">{formatSimpleRupiah(tx.amount)}</td>
                          <td className="border-r border-black p-1 truncate max-w-[120px] italic text-slate-600">{tx.description || '-'}</td>
                        </tr>
                      ))}
                      {sortedTransactions.length > 8 && (
                        <tr className="border-b border-black">
                          <td colSpan={6} className="border-l border-r border-black p-1 text-center italic text-slate-400">
                            ... dan {sortedTransactions.length - 8} transaksi lainnya (tampil utuh di cetakan resmi) ...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Miniature Signatures */}
                {showSignatures && (
                  <div className="mt-6 text-[9px] text-black">
                    <div className="grid grid-cols-2 text-center">
                      <div></div>
                      <div>
                        <p>Bogor, {signatureDate}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 text-center mt-3">
                      <div className="space-y-8">
                        <p className="font-bold uppercase text-slate-700">Bendahara</p>
                        <div>
                          <span className="font-bold border-b border-slate-900 pb-0.5 inline-block text-slate-900 min-w-[90px]">{treasurerName}</span>
                          <p className="text-[7px] text-slate-400 mt-0.5">Pengelola Kas RT</p>
                        </div>
                      </div>
                      <div className="space-y-8">
                        <p className="font-bold uppercase text-slate-700">Ketua RT</p>
                        <div>
                          <span className="font-bold border-b border-slate-900 pb-0.5 inline-block text-slate-900 min-w-[90px]">{chairmanName}</span>
                          <p className="text-[7px] text-slate-400 mt-0.5">Pengurus Lingkungan</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-5 sm:px-6 py-4 bg-slate-900 border-t border-slate-800 text-white shrink-0 flex items-center justify-between gap-4">
          <div className="text-xs text-slate-400 hidden sm:inline-flex items-center gap-1.5">
            <Info className="w-4 h-4 text-slate-500" />
            <span>Mempersiapkan dokumen berukuran {paperSize} dengan orientasi {orientation === 'portrait' ? 'potret' : 'lanskap'}.</span>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 sm:px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-xl text-xs font-bold text-slate-300 transition-all cursor-pointer hover:text-white"
            >
              Batal / Tutup
            </button>
            <button
              type="button"
              onClick={handleLaunchPrint}
              className="px-5 sm:px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/10 active:scale-98"
            >
              <Printer className="w-4 h-4 text-emerald-200" />
              <span>Buka & Cetak Laporan PDF</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
