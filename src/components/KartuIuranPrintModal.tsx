import React, { useRef } from 'react';
import {
  X,
  Printer,
  FileText,
  CheckCircle2,
  XCircle,
  Copy,
  Building2,
  Calendar,
  User,
  ShieldCheck,
  Check
} from 'lucide-react';
import { RT_LOGO_DATA_URL } from './AppLogo';
import { formatSimpleRupiah, formatDateIndo } from '../data/initialData';

interface KartuIuranPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  citizen: any;
  selectedYear: string;
  selectedCategory: string;
  monthlyStatus: Array<{
    no: number;
    code: string;
    name: string;
    isPaid: boolean;
    amount: number;
    paymentDate: string | null;
    category: string;
    description: string | null;
    txId: string | null;
  }>;
  summaryMetrics: {
    totalMonths: number;
    paidMonths: number;
    unpaidMonths: number;
    totalPaidAmount: number;
    estimatedArrears: number;
    complianceRate: number;
    isFullyPaid: boolean;
  };
  sekretariat: any;
  wilayahLabel: string;
  onTriggerToast: (msg: string, type?: 'success' | 'error' | 'info', title?: string) => void;
}

export const KartuIuranPrintModal: React.FC<KartuIuranPrintModalProps> = ({
  isOpen,
  onClose,
  citizen,
  selectedYear,
  selectedCategory,
  monthlyStatus,
  summaryMetrics,
  sekretariat,
  wilayahLabel,
  onTriggerToast,
}) => {
  const printContentRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !citizen) return null;

  const rtStr = sekretariat?.rt || '002';
  const rwStr = sekretariat?.rw || '09';
  const kelurahan = sekretariat?.kelurahan || 'Pondok Rajeg';
  const kecamatan = sekretariat?.kecamatan || 'Cibinong';
  const kota = sekretariat?.kota || 'Kabupaten Bogor';
  const printDateFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleExecutePrint = () => {
    try {
      const printArea = printContentRef.current;
      if (!printArea) return;

      // Create an invisible iframe to perform safe, isolated printing
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        return;
      }

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Kartu Iuran Warga - ${citizen.nama_lengkap} (${selectedYear})</title>
            <style>
              @page {
                size: A4 portrait;
                margin: 12mm 15mm;
              }
              body {
                font-family: Arial, Helvetica, sans-serif;
                color: #000;
                background: #fff;
                margin: 0;
                padding: 0;
                font-size: 11pt;
                line-height: 1.3;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .kop-header {
                display: flex;
                align-items: center;
                border-bottom: 3px double #000;
                padding-bottom: 8px;
                margin-bottom: 12px;
              }
              .kop-logo {
                width: 65px;
                height: 65px;
                margin-right: 15px;
              }
              .kop-text {
                flex: 1;
                text-align: center;
              }
              .kop-title {
                font-size: 13pt;
                font-weight: bold;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                margin: 0;
              }
              .kop-sub {
                font-size: 11pt;
                font-weight: bold;
                margin: 2px 0;
              }
              .kop-address {
                font-size: 9pt;
                color: #333;
                margin: 0;
              }
              .doc-title {
                text-align: center;
                font-size: 13pt;
                font-weight: bold;
                text-decoration: underline;
                margin-top: 10px;
                margin-bottom: 4px;
                text-transform: uppercase;
              }
              .doc-sub {
                text-align: center;
                font-size: 10pt;
                margin-bottom: 14px;
                color: #444;
              }
              .info-table {
                width: 100%;
                margin-bottom: 14px;
                font-size: 10pt;
                border-collapse: collapse;
              }
              .info-table td {
                padding: 2.5px 4px;
                vertical-align: top;
              }
              .info-label {
                width: 130px;
                font-weight: bold;
              }
              .info-colon {
                width: 10px;
              }
              .main-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 14px;
                font-size: 9.5pt;
              }
              .main-table th {
                background-color: #f0f0f0 !important;
                border: 1px solid #000;
                padding: 6px 4px;
                font-weight: bold;
                text-align: center;
              }
              .main-table td {
                border: 1px solid #000;
                padding: 5px 6px;
              }
              .badge-lunas {
                font-weight: bold;
                color: #047857;
              }
              .badge-nunggak {
                font-weight: bold;
                color: #b91c1c;
              }
              .summary-box {
                border: 1px solid #000;
                background-color: #fafafa !important;
                padding: 8px 12px;
                margin-bottom: 18px;
                font-size: 9.5pt;
              }
              .signature-section {
                display: flex;
                justify-content: space-between;
                margin-top: 20px;
                font-size: 10pt;
                page-break-inside: avoid;
              }
              .sig-box {
                text-align: center;
                width: 200px;
              }
              .sig-space {
                height: 55px;
              }
              .sig-name {
                font-weight: bold;
                text-decoration: underline;
              }
            </style>
          </head>
          <body>
            ${printArea.innerHTML}
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 300);

      onTriggerToast('Membuka jendela cetak...', 'info', 'Cetak Kartu');
    } catch (err) {
      console.error('Print error:', err);
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-lg">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Pratinjau Cetak Kartu Iuran Warga
              </h3>
              <p className="text-[11px] text-slate-300">
                {citizen.nama_lengkap} — Tahun Anggaran {selectedYear}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExecutePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak ke Printer / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Printable Sheet */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-slate-100 flex-1 flex justify-center">
          <div
            ref={printContentRef}
            className="w-full max-w-[210mm] bg-white p-6 sm:p-8 rounded-xl shadow-md border border-slate-300 text-slate-900 text-xs sm:text-sm print:border-none print:shadow-none print:p-0"
          >
            {/* KOP SURAT RT */}
            <div className="kop-header flex items-center border-b-2 border-slate-900 pb-3 mb-4">
              <img
                src={RT_LOGO_DATA_URL}
                alt="Logo RT"
                className="kop-logo w-14 h-14 sm:w-16 sm:h-16 mr-3 shrink-0 object-contain"
              />
              <div className="kop-text flex-1 text-center">
                <h2 className="kop-title text-sm sm:text-base font-extrabold uppercase tracking-wide text-slate-900">
                  RUKUN TETANGGA {rtStr} RUKUN WARGA {rwStr}
                </h2>
                <h3 className="kop-sub text-xs sm:text-sm font-bold text-slate-800">
                  KELURAHAN {kelurahan.toUpperCase()}, KECAMATAN {kecamatan.toUpperCase()}
                </h3>
                <p className="kop-address text-[10px] sm:text-[11px] text-slate-600">
                  {kota} — Provinsi Jawa Barat
                </p>
              </div>
            </div>

            {/* JUDUL DOKUMEN */}
            <div className="text-center my-3">
              <h1 className="doc-title text-sm sm:text-base font-black uppercase text-slate-900 underline tracking-wide">
                KARTU RIWAYAT IURAN WARGA
              </h1>
              <p className="doc-sub text-xs font-semibold text-slate-600 mt-0.5">
                Tahun Anggaran {selectedYear} • Pos: {selectedCategory}
              </p>
            </div>

            {/* IDENTITAS WARGA */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4">
                <div className="flex">
                  <span className="w-28 font-bold text-slate-700">Nama Lengkap</span>
                  <span className="w-3 text-slate-400">:</span>
                  <span className="font-extrabold text-slate-900 flex-1">{citizen.nama_lengkap}</span>
                </div>
                <div className="flex">
                  <span className="w-28 font-bold text-slate-700">No. KK / NIK</span>
                  <span className="w-3 text-slate-400">:</span>
                  <span className="text-slate-800 flex-1 font-mono">{citizen.no_kk || '-'} / {citizen.nik || '-'}</span>
                </div>
                <div className="flex">
                  <span className="w-28 font-bold text-slate-700">Alamat Domisili</span>
                  <span className="w-3 text-slate-400">:</span>
                  <span className="text-slate-800 flex-1">{citizen.alamat_domisili || `RT.${rtStr} RW.${rwStr}`}</span>
                </div>
                <div className="flex">
                  <span className="w-28 font-bold text-slate-700">No. WhatsApp/HP</span>
                  <span className="w-3 text-slate-400">:</span>
                  <span className="text-slate-800 flex-1 font-mono">{citizen.no_hp || '-'}</span>
                </div>
              </div>
            </div>

            {/* TABEL MATRIKS 12 BULAN */}
            <table className="main-table w-full border-collapse border border-slate-800 text-xs mb-4">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800">
                  <th className="border border-slate-800 px-2 py-1.5 text-center w-8">No</th>
                  <th className="border border-slate-800 px-2 py-1.5 text-left">Bulan Tagihan</th>
                  <th className="border border-slate-800 px-2 py-1.5 text-center w-24">Status</th>
                  <th className="border border-slate-800 px-2 py-1.5 text-right w-28">Jumlah Disetor</th>
                  <th className="border border-slate-800 px-2 py-1.5 text-center w-28">Tgl Bayar</th>
                  <th className="border border-slate-800 px-2 py-1.5 text-left">Keterangan / Ref</th>
                </tr>
              </thead>
              <tbody>
                {monthlyStatus.map((m, idx) => (
                  <tr key={m.no} className={m.isPaid ? 'bg-white' : 'bg-rose-50/30'}>
                    <td className="border border-slate-800 px-2 py-1 text-center font-mono">{idx + 1}</td>
                    <td className="border border-slate-800 px-2 py-1 font-bold">{m.name} {selectedYear}</td>
                    <td className="border border-slate-800 px-2 py-1 text-center">
                      {m.isPaid ? (
                        <span className="badge-lunas font-bold text-emerald-700">LUNAS</span>
                      ) : (
                        <span className="badge-nunggak font-bold text-rose-600">NUNGGAK</span>
                      )}
                    </td>
                    <td className="border border-slate-800 px-2 py-1 text-right font-mono font-bold">
                      {m.isPaid ? formatSimpleRupiah(m.amount) : '-'}
                    </td>
                    <td className="border border-slate-800 px-2 py-1 text-center text-[11px]">
                      {m.paymentDate ? formatDateIndo(m.paymentDate) : '-'}
                    </td>
                    <td className="border border-slate-800 px-2 py-1 text-[11px] text-slate-600 truncate max-w-[180px]">
                      {m.isPaid ? (m.txId ? `ID: ${m.txId.substring(0, 8)}` : 'Terverifikasi') : 'Belum dibayar'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* RINGKASAN AKUNTANSI */}
            <div className="summary-box border border-slate-800 bg-slate-50 p-3 rounded-lg mb-6 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-1.5 bg-white border border-slate-200 rounded">
                  <span className="text-[10px] text-slate-500 uppercase block font-bold">Bulan Lunas</span>
                  <span className="text-sm font-extrabold text-emerald-700">{summaryMetrics.paidMonths} / 12 Bulan</span>
                </div>
                <div className="p-1.5 bg-white border border-slate-200 rounded">
                  <span className="text-[10px] text-slate-500 uppercase block font-bold">Total Disetor</span>
                  <span className="text-sm font-extrabold text-slate-900">{formatSimpleRupiah(summaryMetrics.totalPaidAmount)}</span>
                </div>
                <div className="p-1.5 bg-white border border-slate-200 rounded">
                  <span className="text-[10px] text-slate-500 uppercase block font-bold">Sisa Tunggakan</span>
                  <span className={`text-sm font-extrabold ${summaryMetrics.unpaidMonths > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {summaryMetrics.unpaidMonths} Bulan
                  </span>
                </div>
                <div className="p-1.5 bg-white border border-slate-200 rounded">
                  <span className="text-[10px] text-slate-500 uppercase block font-bold">Kepatuhan</span>
                  <span className="text-sm font-extrabold text-indigo-700">{summaryMetrics.complianceRate}%</span>
                </div>
              </div>
            </div>

            {/* LEMBAR TANDA TANGAN */}
            <div className="signature-section flex justify-between items-start pt-2 text-xs">
              <div className="sig-box text-center w-48">
                <p className="font-semibold text-slate-700">Warga Yang Bersangkutan,</p>
                <div className="sig-space h-14" />
                <p className="sig-name font-bold text-slate-900 underline uppercase">{citizen.nama_lengkap}</p>
                <p className="text-[10px] text-slate-500">Warga RT.{rtStr} RW.{rwStr}</p>
              </div>

              <div className="sig-box text-center w-48">
                <p className="font-semibold text-slate-700">
                  {kelurahan}, {printDateFormatted}
                </p>
                <p className="font-semibold text-slate-700">Bendahara / Pengurus RT,</p>
                <div className="sig-space h-14" />
                <p className="sig-name font-bold text-slate-900 underline uppercase">
                  {sekretariat?.bendahara || 'BENDAHARA RT'}
                </p>
                <p className="text-[10px] text-slate-500">Pengurus RT.{rtStr} RW.{rwStr}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            Lembar kartu siap dicetak atau disimpan sebagai arsip PDF resmi.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleExecutePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Sekarang</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
