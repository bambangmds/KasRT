import * as XLSX from 'xlsx';
import { Transaction, TransactionType } from '../types';

export interface ImportParseResult {
  fileName: string;
  transactions: Transaction[];
  totalMasuk: number;
  totalKeluar: number;
  saldoBersih: number;
  validCount: number;
  skippedCount: number;
  warnings: string[];
}

/**
 * Normalisasi format tanggal dari berbagai representasi Excel (angka serial, DD/MM/YYYY, YYYY-MM-DD, dll.)
 */
export function normalizeExcelDate(val: any): string {
  if (!val && val !== 0) {
    return new Date().toISOString().split('T')[0];
  }

  // Kasus 1: Angka serial tanggal bawaan Excel (misal: 45223)
  if (typeof val === 'number') {
    try {
      const dateObj = XLSX.SSF.parse_date_code(val);
      if (dateObj && dateObj.y && dateObj.m && dateObj.d) {
        const y = String(dateObj.y).padStart(4, '0');
        const m = String(dateObj.m).padStart(2, '0');
        const d = String(dateObj.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch {
      // lanjut ke fallback
    }
  }

  const str = String(val).trim();

  // Kasus 2: Format ISO standar YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Kasus 3: Format Indonesia / DD/MM/YYYY atau DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = String(dmyMatch[1]).padStart(2, '0');
    const month = String(dmyMatch[2]).padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Kasus 4: Format YYYY/MM/DD
  const ymdSlash = str.match(/^(\d{4})[\/](\d{1,2})[\/](\d{1,2})$/);
  if (ymdSlash) {
    const year = ymdSlash[1];
    const month = String(ymdSlash[2]).padStart(2, '0');
    const day = String(ymdSlash[3]).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Kasus 5: Date object JavaScript parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Normalisasi nominal angka dari Excel (mengatasi string "Rp 150.000", desimal, dll.)
 */
export function normalizeExcelAmount(val: any): number {
  if (typeof val === 'number') {
    return Math.abs(val);
  }

  if (!val) return 0;

  // Bersihkan format Rupiah, spasi, titik ribuan
  let cleaned = String(val)
    .replace(/Rp\s*/gi, '')
    .replace(/\s+/g, '')
    .trim();

  if (cleaned.includes('.') && cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes('.') && !cleaned.includes(',')) {
    const parts = cleaned.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      cleaned = cleaned.replace(/\./g, '');
    }
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.abs(num);
}

/**
 * Membaca dan mem-parsing file Excel (.xlsx / .xls / .csv) menjadi data transaksi standar Kas RT
 */
export async function parseExcelToTransactions(
  file: File
): Promise<ImportParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('File Excel tidak memiliki lembar kerja (worksheet).');
  }

  // Cari sheet yang memuat transaksi kas (misal "Buku Kas RT", "Kas RT", atau sheet pertama)
  let targetSheetName = workbook.SheetNames[0];
  for (const name of workbook.SheetNames) {
    if (/kas|transaksi|jurnal|mutasi/i.test(name)) {
      targetSheetName = name;
      break;
    }
  }

  const worksheet = workbook.Sheets[targetSheetName];

  // Ambil data dalam bentuk matriks array-of-arrays
  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (!rows || rows.length === 0) {
    throw new Error('File Excel kosong atau tidak memiliki baris data.');
  }

  // 1. Cari baris header kolom
  let headerRowIndex = -1;
  let colTanggal = -1;
  let colJenis = -1;
  let colKategori = -1;
  let colJumlah = -1;
  let colKeterangan = -1;
  let colId = -1;
  let colWargaId = -1;

  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;

    let hasDateCol = false;
    let hasAmountCol = false;
    let hasTypeCol = false;

    row.forEach((cell, cIdx) => {
      const cellText = String(cell || '').toLowerCase().trim();
      if (/tanggal|date|tgl/i.test(cellText)) {
        colTanggal = cIdx;
        hasDateCol = true;
      } else if (/jenis|tipe|type/i.test(cellText)) {
        colJenis = cIdx;
        hasTypeCol = true;
      } else if (/kategori|category|pos/i.test(cellText)) {
        colKategori = cIdx;
      } else if (/jumlah|nominal|amount|total|debet|kredit|rupiah|\(rp\)/i.test(cellText)) {
        colJumlah = cIdx;
        hasAmountCol = true;
      } else if (/keterangan|deskripsi|uraian|description|memo|catatan/i.test(cellText)) {
        colKeterangan = cIdx;
      } else if (/id\s*transaksi|tx_id|id_tx|^id$/i.test(cellText)) {
        colId = cIdx;
      } else if (/id\s*warga|warga_id|wargaid/i.test(cellText)) {
        colWargaId = cIdx;
      }
    });

    if (hasDateCol && (hasAmountCol || hasTypeCol)) {
      headerRowIndex = r;
      break;
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 0;
    if (colTanggal === -1) colTanggal = 1;
    if (colJenis === -1) colJenis = 2;
    if (colKategori === -1) colKategori = 3;
    if (colJumlah === -1) colJumlah = 4;
    if (colKeterangan === -1) colKeterangan = 5;
    if (colId === -1) colId = 7;
    if (colWargaId === -1) colWargaId = 8;
  }

  const parsedTransactions: Transaction[] = [];
  const warnings: string[] = [];
  let skippedCount = 0;
  let totalMasuk = 0;
  let totalKeluar = 0;

  // 2. Iterasi baris data setelah header
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row) || row.length === 0) {
      continue;
    }

    const cellRawRow = row.map((c) => String(c || '').trim()).join(' ');

    if (!cellRawRow) {
      continue;
    }

    // Abaikan baris ringkasan di bagian bawah (TOTAL KAS MASUK, TOTAL KAS KELUAR, SALDO BERSIH KAS)
    if (
      /total\s*kas\s*masuk/i.test(cellRawRow) ||
      /total\s*kas\s*keluar/i.test(cellRawRow) ||
      /saldo\s*bersih/i.test(cellRawRow) ||
      /grand\s*total/i.test(cellRawRow)
    ) {
      skippedCount++;
      continue;
    }

    const rawTanggal = row[colTanggal];
    const rawJenis = String(row[colJenis] || '').trim();
    const rawKategori = String(row[colKategori] || '').trim();
    const rawJumlah = row[colJumlah];
    const rawKeterangan = String(row[colKeterangan] || '').trim();
    const rawId = colId !== -1 ? String(row[colId] || '').trim() : '';
    const rawWargaId = colWargaId !== -1 ? String(row[colWargaId] || '').trim() : '';

    const amount = normalizeExcelAmount(rawJumlah);

    if (amount <= 0 && !rawTanggal) {
      skippedCount++;
      continue;
    }

    let type: TransactionType = 'Masuk';
    if (/keluar|pengeluaran|out|debit|biaya/i.test(rawJenis)) {
      type = 'Keluar';
    }

    const date = normalizeExcelDate(rawTanggal);
    const category = rawKategori || (type === 'Masuk' ? 'Iuran Warga' : 'Operasional');
    const description = rawKeterangan === '-' ? '' : rawKeterangan;
    const wargaId = rawWargaId && rawWargaId !== '-' ? rawWargaId : undefined;

    const txId =
      rawId && rawId.length >= 4 && rawId !== '-'
        ? rawId
        : `IMP-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`.toUpperCase();

    if (type === 'Masuk') {
      totalMasuk += amount;
    } else {
      totalKeluar += amount;
    }

    parsedTransactions.push({
      id: txId,
      date,
      type,
      category,
      amount,
      description,
      status: 'Synced',
      wargaId,
      createdAt: new Date(`${date}T07:00:00Z`).getTime() || Date.now(),
    });
  }

  if (parsedTransactions.length === 0) {
    throw new Error(
      'Tidak ada data transaksi valid yang dapat diimpor dari file Excel ini. Pastikan kolom memuat Tanggal, Jenis, Kategori, dan Jumlah.'
    );
  }

  return {
    fileName: file.name,
    transactions: parsedTransactions,
    totalMasuk,
    totalKeluar,
    saldoBersih: totalMasuk - totalKeluar,
    validCount: parsedTransactions.length,
    skippedCount,
    warnings,
  };
}

/**
 * Membuat dan mengunduh file template Excel (.xlsx) resmi Kas RT (Single Sheet)
 */
export function downloadExcelTemplate(sekretariat?: { rt?: string; rw?: string; kelurahan?: string }): void {
  const rtStr = sekretariat?.rt ? `RT.${sekretariat.rt}` : 'RT';
  const rwStr = sekretariat?.rw ? `RW.${sekretariat.rw}` : 'RW';
  const kelStr = sekretariat?.kelurahan ? `, KELURAHAN ${sekretariat.kelurahan.toUpperCase()}` : '';

  const sheetAoa: (string | number)[][] = [
    [`BUKU KAS & LAPORAN KEUANGAN KAS ${rtStr} ${rwStr}`.toUpperCase()],
    [`${rtStr} ${rwStr}${kelStr}`.toUpperCase()],
    ['TEMPLATE RESMI IMPORT DATA EXCEL KAS RT'],
    [],
    ['No', 'Tanggal', 'Jenis', 'Kategori', 'Jumlah (Rp)', 'Keterangan', 'Status Sinkron', 'ID Transaksi', 'ID Warga'],
    [1, '2024-05-01', 'Masuk', 'Iuran Warga', 250000, 'Iuran Bulanan Warga Blok A No. 12', 'Synced', '', ''],
    [2, '2024-05-02', 'Keluar', 'Operasional', 100000, 'Pembelian Lampu Penerangan Gang', 'Synced', '', ''],
    [3, '2024-05-03', 'Masuk', 'Iuran Perbaikan Jalan', 500000, 'Swadaya Perbaikan Aspal Blok B', 'Synced', '', ''],
    [4, '2024-05-05', 'Masuk', 'Bantuan Pembangunan Masjid', 350000, 'Infaq Warga untuk Renovasi Musholla/Masjid', 'Synced', '', ''],
    [5, '2024-05-06', 'Keluar', 'Biaya keRTan', 75000, 'Foto copy formulir pendataan warga', 'Synced', '', ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetAoa);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 12 },
    { wch: 24 },
    { wch: 18 },
    { wch: 45 },
    { wch: 15 },
    { wch: 25 },
    { wch: 38 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template Kas RT');

  const fileRt = sekretariat?.rt ? `_RT${sekretariat.rt}` : '';
  const fileRw = sekretariat?.rw ? `_RW${sekretariat.rw}` : '';
  XLSX.writeFile(wb, `Template_Import_Kas${fileRt}${fileRw}.xlsx`);
}

/**
 * Membuat dan mengunduh Master Template Excel 8 Tabel (.xlsx)
 */
export function downloadMasterExcelTemplate(sekretariat?: { rt?: string; rw?: string; kelurahan?: string }): void {
  const rtStr = sekretariat?.rt ? `RT.${sekretariat.rt}` : 'RT';
  const rwStr = sekretariat?.rw ? `RW.${sekretariat.rw}` : 'RW';

  const wb = XLSX.utils.book_new();

  // 1. Sheet Kas RT
  const wsKas = XLSX.utils.aoa_to_sheet([
    ['No', 'Tanggal', 'Jenis', 'Kategori', 'Jumlah (Rp)', 'Keterangan', 'ID Transaksi', 'ID Warga'],
    [1, '2024-05-01', 'Masuk', 'Iuran Warga', 250000, 'Iuran Warga Blok A No. 12', '', ''],
    [2, '2024-05-02', 'Keluar', 'Operasional', 100000, 'Perbaikan Lampu Jalan', '', ''],
  ]);
  wsKas['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 12 }, { wch: 24 }, { wch: 18 }, { wch: 40 }, { wch: 38 }, { wch: 38 }];
  XLSX.utils.book_append_sheet(wb, wsKas, 'Buku Kas RT');

  // 2. Sheet Kategori
  const wsKat = XLSX.utils.aoa_to_sheet([
    ['No', 'Nama Kategori', 'Jenis', 'Deskripsi / Peruntukan', 'Wajib / Sukarela', 'Nominal Acuan (Rp)'],
    [1, 'Iuran Warga', 'Masuk', 'Iuran kas rutin bulanan warga', 'Wajib', 50000],
    [2, 'Operasional', 'Keluar', 'Biaya operasional & kebersihan lingkungan', 'Sukarela', 0],
  ]);
  wsKat['!cols'] = [{ wch: 6 }, { wch: 24 }, { wch: 14 }, { wch: 40 }, { wch: 18 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsKat, 'Pos Kategori Kas');

  // 3. Sheet Data Warga
  const wsWarga = XLSX.utils.aoa_to_sheet([
    ['No', 'No KK', 'NIK', 'Nama Lengkap', 'Jenis Kelamin', 'Tempat Lahir', 'Tanggal Lahir', 'Agama', 'Pendidikan', 'Pekerjaan', 'Status Perkawinan', 'Alamat Domisili', 'No HP', 'Status Warga', 'Catatan'],
    [1, '3201010101010001', '3201010101010002', 'Budi Santoso', 'Laki-laki', 'Bogor', '1985-05-12', 'Islam', 'S1', 'Karyawan Swasta', 'Kawin', 'Blok A No. 12', '081234567890', 'Warga Tetap', 'Kepala Keluarga'],
  ]);
  wsWarga['!cols'] = [{ wch: 6 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 35 }, { wch: 16 }, { wch: 16 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsWarga, 'Data Kependudukan');

  // 4. Sheet Pengguna
  const wsPeng = XLSX.utils.aoa_to_sheet([
    ['No', 'Nama Pengurus / Pengguna', 'Email', 'Jabatan', 'Level Akses', 'No HP', 'Alamat'],
    [1, 'Budi Santoso', 'budi@rt.id', 'Ketua RT', 'Admin', '081234567890', 'Blok A No. 12'],
  ]);
  wsPeng['!cols'] = [{ wch: 6 }, { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsPeng, 'Data Pengguna Pengurus');

  // 5. Sheet Inventaris
  const wsInv = XLSX.utils.aoa_to_sheet([
    ['No', 'Nama Barang / Aset', 'Jumlah Total', 'Jumlah Baik', 'Jumlah Rusak', 'Kondisi', 'Lokasi Penyimpanan', 'Catatan'],
    [1, 'Tenda Terpal 4x6 Meter', 2, 2, 0, 'Baik', 'Gudang Pos RW', 'Aset bersama warga'],
    [2, 'Kursi Lipat Chitose', 50, 48, 2, 'Baik', 'Pos RT', 'Sebagian perlu dicat ulang'],
  ]);
  wsInv['!cols'] = [{ wch: 6 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 15 }, { wch: 25 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsInv, 'Inventaris Aset RT');

  // 6. Sheet Peminjaman Aset
  const wsPinjam = XLSX.utils.aoa_to_sheet([
    ['No', 'ID Barang', 'ID Warga', 'Tanggal Pinjam', 'Tanggal Kembali', 'Jumlah Pinjam', 'Keperluan', 'Status', 'Catatan'],
    [1, '', '', '2024-05-10', '2024-05-12', 20, 'Acara Tasyakuran Keluarga', 'Kembali', 'Dikembalikan tepat waktu & lengkap'],
  ]);
  wsPinjam['!cols'] = [{ wch: 6 }, { wch: 38 }, { wch: 38 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 14 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsPinjam, 'Peminjaman Aset');

  // 7. Sheet Darurat SOS
  const wsDarurat = XLSX.utils.aoa_to_sheet([
    ['No', 'Nama Warga', 'Alamat', 'No HP', 'Tipe Darurat', 'Status', 'Keterangan'],
    [1, 'Budi Santoso', 'Blok A No. 12', '081234567890', 'Keamanan/Maling', 'Selesai', 'Pencegahan ronda malam'],
  ]);
  wsDarurat['!cols'] = [{ wch: 6 }, { wch: 24 }, { wch: 30 }, { wch: 16 }, { wch: 20 }, { wch: 12 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsDarurat, 'Log Darurat SOS');

  // 8. Sheet Sekretariat
  const wsSek = XLSX.utils.aoa_to_sheet([
    ['RT', 'RW', 'Kelurahan', 'Kecamatan', 'Alamat Sekretariat'],
    [sekretariat?.rt || '002', sekretariat?.rw || '09', sekretariat?.kelurahan || 'Pondok Rajeg', 'Cibinong', 'Jl. Masjid RT.002 RW.09'],
  ]);
  wsSek['!cols'] = [{ wch: 8 }, { wch: 8 }, { wch: 20 }, { wch: 20 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsSek, 'Profil Sekretariat');

  const fileRt = sekretariat?.rt ? `_RT${sekretariat.rt}` : '';
  const fileRw = sekretariat?.rw ? `_RW${sekretariat.rw}` : '';
  XLSX.writeFile(wb, `Master_Template_8_Tabel${fileRt}${fileRw}.xlsx`);
}
