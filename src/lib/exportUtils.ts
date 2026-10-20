import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Transaction, 
  CategoryItem, 
  SupabasePengurusRow, 
  DataWargaItem, 
  SekretariatItem, 
  InventarisItem, 
  PeminjamanItem 
} from '../types';
import { EmergencyAlertItem } from './supabase';

export interface ExportOptions {
  filename?: string;
  scopeTitle?: string;
  includeSummary?: boolean;
  sekretariat?: {
    rt?: string;
    rw?: string;
    kelurahan?: string;
    kecamatan?: string;
    alamat?: string;
    kota_kabupaten?: string;
    provinsi?: string;
    kode_pos?: string;
  };
}

export interface AllTablesExportData {
  kas_rt: Transaction[];
  kategori?: CategoryItem[];
  data_warga?: DataWargaItem[];
  pengguna?: SupabasePengurusRow[];
  inventaris_rt?: InventarisItem[];
  peminjaman_aset_rt?: PeminjamanItem[];
  darurat_rt?: EmergencyAlertItem[];
  sekretariat?: SekretariatItem[];
}

/**
 * Ekspor data transaksi kas_rt ke format Microsoft Excel (.xlsx) asli
 */
export function exportToExcel(
  transactions: Transaction[],
  options: ExportOptions = {}
): void {
  const {
    scopeTitle = 'Semua Transaksi',
    includeSummary = true,
    sekretariat,
  } = options;

  const rtStr = sekretariat?.rt || '';
  const rwStr = sekretariat?.rw || '';
  const kelStr = (sekretariat?.kelurahan || '').toUpperCase();
  const kecStr = (sekretariat?.kecamatan || '').toUpperCase();
  const alamatStr = sekretariat?.alamat || (sekretariat?.rt && sekretariat?.rw ? `RT.${sekretariat.rt} RW.${sekretariat.rw}, Kel. ${sekretariat?.kelurahan || ''}` : '');

  const defaultFilename = `Kas_${rtStr ? `RT${rtStr}_` : ''}${rwStr ? `RW${rwStr}_` : ''}${new Date().toISOString().split('T')[0]}.xlsx`;
  const filename = options.filename || defaultFilename;

  let totalMasuk = 0;
  let totalKeluar = 0;

  transactions.forEach((t) => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'Masuk') totalMasuk += amt;
    else if (t.type === 'Keluar') totalKeluar += amt;
  });

  const saldoBersih = totalMasuk - totalKeluar;

  const headerWilayah = [
    rtStr ? `RUKUN TETANGGA ${rtStr}` : 'RUKUN TETANGGA',
    rwStr ? `RUKUN WARGA ${rwStr}` : 'RUKUN WARGA'
  ].join(' ').toUpperCase();

  const sheetAoa: (string | number)[][] = [
    [`PENGURUS ${headerWilayah}`],
    [kelStr ? `KELURAHAN ${kelStr}${kecStr ? `, KECAMATAN ${kecStr}` : ''}` : 'BUKU KAS RT'],
    [`Alamat: ${alamatStr || '-'}`],
    [],
    ['LAPORAN REKAPITULASI MUTASI KAS WARGA'],
    [`Periode: ${scopeTitle} | Tanggal Dokumen: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}`],
    [],
    ['No', 'Tanggal', 'Jenis', 'Kategori', 'Jumlah (Rp)', 'Keterangan', 'Status Sinkron', 'ID Transaksi', 'ID Warga'],
  ];

  transactions.forEach((t, idx) => {
    sheetAoa.push([
      idx + 1,
      t.date,
      t.type,
      t.category,
      Number(t.amount) || 0,
      t.description || '-',
      t.status || 'Synced',
      t.id,
      t.wargaId || '',
    ]);
  });

  if (includeSummary) {
    sheetAoa.push(
      [],
      ['', '', '', 'TOTAL KAS MASUK', totalMasuk, '', '', '', ''],
      ['', '', '', 'TOTAL KAS KELUAR', totalKeluar, '', '', '', ''],
      ['', '', '', 'SALDO BERSIH KAS', saldoBersih, '', '', '', '']
    );
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetAoa);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 12 },
    { wch: 22 },
    { wch: 18 },
    { wch: 45 },
    { wch: 15 },
    { wch: 38 },
    { wch: 38 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Kas RT.${rtStr} RW.${rwStr}`);

  const finalFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, finalFilename);
}

/**
 * Ekspor seluruh 8 tabel ke format Excel Master Workbook (.xlsx) dengan 8 Lembar Kerja Terpisah
 */
export function exportAllTablesToExcel(
  tablesData: AllTablesExportData,
  options: ExportOptions = {}
): void {
  const { sekretariat } = options;
  const rtStr = sekretariat?.rt || '';
  const rwStr = sekretariat?.rw || '';
  const defaultFilename = `Master_8_Tabel_${rtStr ? `RT${rtStr}_` : ''}${rwStr ? `RW${rwStr}_` : ''}${new Date().toISOString().split('T')[0]}.xlsx`;
  const filename = options.filename || defaultFilename;

  const wb = XLSX.utils.book_new();

  // 1. Sheet Buku Kas RT (kas_rt)
  const kas = tablesData.kas_rt || [];
  const kasAoa: (string | number)[][] = [
    ['No', 'Tanggal', 'Jenis', 'Kategori', 'Jumlah (Rp)', 'Keterangan', 'ID Transaksi', 'ID Warga'],
  ];
  kas.forEach((t, idx) => {
    kasAoa.push([
      idx + 1,
      t.date,
      t.type,
      t.category,
      Number(t.amount) || 0,
      t.description || '-',
      t.id,
      t.wargaId || '',
    ]);
  });
  const wsKas = XLSX.utils.aoa_to_sheet(kasAoa);
  wsKas['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 12 }, { wch: 24 }, { wch: 18 }, { wch: 40 }, { wch: 38 }, { wch: 38 }];
  XLSX.utils.book_append_sheet(wb, wsKas, 'Buku Kas RT');

  // 2. Sheet Master Kategori (kategori)
  const kat = tablesData.kategori || [];
  const katAoa: (string | number)[][] = [
    ['No', 'Nama Kategori', 'Jenis', 'Deskripsi / Peruntukan', 'Wajib / Sukarela', 'Nominal Acuan (Rp)', 'ID Kategori'],
  ];
  kat.forEach((k, idx) => {
    katAoa.push([
      idx + 1,
      k.name,
      k.type,
      k.description || '-',
      k.wajib ? 'Wajib' : 'Sukarela',
      k.nominal || 0,
      k.id,
    ]);
  });
  const wsKat = XLSX.utils.aoa_to_sheet(katAoa);
  wsKat['!cols'] = [{ wch: 6 }, { wch: 25 }, { wch: 14 }, { wch: 40 }, { wch: 18 }, { wch: 20 }, { wch: 38 }];
  XLSX.utils.book_append_sheet(wb, wsKat, 'Pos Kategori Kas');

  // 3. Sheet Data Warga (data_warga)
  const warga = tablesData.data_warga || [];
  const wargaAoa: (string | number)[][] = [
    ['No', 'No KK', 'NIK', 'Nama Lengkap', 'Jenis Kelamin', 'Tempat Lahir', 'Tanggal Lahir', 'Agama', 'Pendidikan', 'Pekerjaan', 'Status Perkawinan', 'Alamat Domisili', 'No HP', 'Status Warga', 'Catatan', 'ID Warga'],
  ];
  warga.forEach((w, idx) => {
    wargaAoa.push([
      idx + 1,
      w.no_kk,
      w.nik,
      w.nama_lengkap,
      w.jenis_kelamin || 'Laki-laki',
      w.tempat_lahir || '-',
      w.tanggal_lahir || '-',
      w.agama || 'Islam',
      w.pendidikan || '-',
      w.pekerjaan || '-',
      w.status_perkawinan || 'Belum Kawin',
      w.alamat_domisili,
      w.no_hp || '-',
      w.status_warga || 'Warga Tetap',
      w.catatan || '-',
      w.id || '',
    ]);
  });
  const wsWarga = XLSX.utils.aoa_to_sheet(wargaAoa);
  wsWarga['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 18 }, { wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 35 }, { wch: 16 }, { wch: 18 }, { wch: 25 }, { wch: 38 }];
  XLSX.utils.book_append_sheet(wb, wsWarga, 'Data Kependudukan');

  // 4. Sheet Pengguna / Pengurus (pengguna)
  const peng = tablesData.pengguna || [];
  const pengAoa: (string | number)[][] = [
    ['No', 'Nama Pengurus / Pengguna', 'Email', 'Jabatan', 'Level Akses', 'No HP', 'No KK', 'NIK', 'Alamat', 'Foto Profil (Base64)', 'ID Pengguna'],
  ];
  peng.forEach((p, idx) => {
    pengAoa.push([
      idx + 1,
      p.nama,
      p.email,
      p.jabatan,
      p.level_akses || 'User',
      p.no_hp || '-',
      p.no_kk || '-',
      p.nik || '-',
      p.alamat_domisili || '-',
      p.foto_url || (p as any).fotoUrl || '',
      p.id,
    ]);
  });
  const wsPeng = XLSX.utils.aoa_to_sheet(pengAoa);
  wsPeng['!cols'] = [{ wch: 6 }, { wch: 25 }, { wch: 28 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 30 }, { wch: 45 }, { wch: 38 }];
  XLSX.utils.book_append_sheet(wb, wsPeng, 'Data Pengguna Pengurus');

  // 5. Sheet Inventaris & Aset RT (inventaris_rt)
  const inv = tablesData.inventaris_rt || [];
  const invAoa: (string | number)[][] = [
    ['No', 'Nama Barang / Aset', 'Jumlah Total', 'Jumlah Baik', 'Jumlah Rusak', 'Kondisi', 'Lokasi Penyimpanan', 'Catatan', 'ID Barang'],
  ];
  inv.forEach((i, idx) => {
    invAoa.push([
      idx + 1,
      i.nama_barang,
      Number(i.jumlah_total) || 1,
      Number(i.jumlah_baik) || 1,
      Number(i.jumlah_rusak) || 0,
      i.kondisi || 'Baik',
      i.lokasi_penyimpanan || '-',
      i.catatan || '-',
      i.id,
    ]);
  });
  const wsInv = XLSX.utils.aoa_to_sheet(invAoa);
  wsInv['!cols'] = [{ wch: 6 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 15 }, { wch: 25 }, { wch: 30 }, { wch: 38 }];
  XLSX.utils.book_append_sheet(wb, wsInv, 'Inventaris Aset RT');

  // 6. Sheet Log Peminjaman Aset (peminjaman_aset_rt)
  const pinjam = tablesData.peminjaman_aset_rt || [];
  const pinjamAoa: (string | number)[][] = [
    ['No', 'ID Barang', 'ID Warga', 'Tanggal Pinjam', 'Tanggal Kembali', 'Jumlah Pinjam', 'Keperluan', 'Status', 'Catatan', 'ID Peminjaman'],
  ];
  pinjam.forEach((pj, idx) => {
    pinjamAoa.push([
      idx + 1,
      pj.id_barang,
      pj.id_warga,
      pj.tanggal_pinjam,
      pj.tanggal_kembali || '-',
      Number(pj.jumlah_pinjam) || 1,
      pj.keperluan || '-',
      pj.status,
      pj.catatan || '-',
      pj.id,
    ]);
  });
  const wsPinjam = XLSX.utils.aoa_to_sheet(pinjamAoa);
  wsPinjam['!cols'] = [{ wch: 6 }, { wch: 38 }, { wch: 38 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 14 }, { wch: 25 }, { wch: 38 }];
  XLSX.utils.book_append_sheet(wb, wsPinjam, 'Peminjaman Aset');

  // 7. Sheet Log Darurat SOS (darurat_rt)
  const darurat = tablesData.darurat_rt || [];
  const daruratAoa: (string | number)[][] = [
    ['No', 'Nama Warga', 'Alamat', 'No HP', 'Tipe Darurat', 'Status', 'Keterangan', 'Waktu Dibuat', 'ID Log Darurat'],
  ];
  darurat.forEach((d, idx) => {
    daruratAoa.push([
      idx + 1,
      d.nama_warga,
      d.alamat,
      d.no_hp || '-',
      d.tipe_darurat,
      d.status,
      d.keterangan || '-',
      d.created_at || '-',
      d.id,
    ]);
  });
  const wsDarurat = XLSX.utils.aoa_to_sheet(daruratAoa);
  wsDarurat['!cols'] = [{ wch: 6 }, { wch: 24 }, { wch: 30 }, { wch: 16 }, { wch: 20 }, { wch: 12 }, { wch: 30 }, { wch: 22 }, { wch: 38 }];
  XLSX.utils.book_append_sheet(wb, wsDarurat, 'Log Darurat SOS');

  // 8. Sheet Profil Sekretariat (sekretariat)
  const sek = tablesData.sekretariat || (sekretariat ? [sekretariat as SekretariatItem] : []);
  const sekAoa: (string | number)[][] = [
    ['RT', 'RW', 'Kelurahan', 'Kecamatan', 'Alamat Sekretariat', 'Kota/Kabupaten', 'Provinsi', 'Kode Pos', 'Telepon', 'Nama Ketua RT'],
  ];
  sek.forEach((s) => {
    sekAoa.push([
      s.rt || '',
      s.rw || '',
      s.kelurahan || '',
      s.kecamatan || '',
      s.alamat || '',
      s.kota_kabupaten || '',
      s.provinsi || '',
      s.kode_pos || '',
      s.telepon || '',
      s.nama_ketua_rt || '',
    ]);
  });
  const wsSek = XLSX.utils.aoa_to_sheet(sekAoa);
  wsSek['!cols'] = [{ wch: 8 }, { wch: 8 }, { wch: 20 }, { wch: 20 }, { wch: 35 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsSek, 'Profil Sekretariat');

  const finalFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, finalFilename);
}

/**
 * Ekspor data transaksi ke format CSV dengan UTF-8 BOM
 */
export function exportToCSV(
  transactions: Transaction[],
  options: ExportOptions = {}
): void {
  const {
    scopeTitle = 'Semua Transaksi',
    sekretariat,
  } = options;

  const rtStr = sekretariat?.rt || '';
  const rwStr = sekretariat?.rw || '';
  const kelStr = sekretariat?.kelurahan || '';
  const wilayahIdent = rtStr && rwStr ? `RT.${rtStr} RW.${rwStr}` : 'Kas RT';

  const defaultFilename = `Kas_${rtStr ? `RT${rtStr}_` : ''}${rwStr ? `RW${rwStr}_` : ''}${new Date().toISOString().split('T')[0]}.csv`;
  const filename = options.filename || defaultFilename;

  const headers = ['No', 'Tanggal', 'Jenis', 'Kategori', 'Jumlah (Rp)', 'Keterangan', 'Status Sinkron', 'ID Transaksi', 'ID Warga'];
  
  const rows = transactions.map((t, idx) => [
    idx + 1,
    t.date,
    t.type,
    `"${(t.category || '').replace(/"/g, '""')}"`,
    t.amount,
    `"${(t.description || '').replace(/"/g, '""')}"`,
    t.status || 'Synced',
    `"${t.id}"`,
    `"${t.wargaId || ''}"`,
  ]);

  const csvContent =
    '\uFEFF' +
    `# BUKU KAS ${wilayahIdent}${kelStr ? ` - Kelurahan ${kelStr}` : ''}\n` +
    `# Cakupan: ${scopeTitle} | Tanggal Ekspor: ${new Date().toLocaleDateString('id-ID')}\n` +
    [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Ekspor data transaksi ke format JSON (struktur backup)
 */
export function exportToJSON(
  transactions: Transaction[],
  options: ExportOptions = {}
): void {
  const {
    scopeTitle = 'Semua Transaksi',
    sekretariat,
  } = options;

  const rtStr = sekretariat?.rt || '';
  const rwStr = sekretariat?.rw || '';
  const kelStr = sekretariat?.kelurahan || '';
  const kecStr = sekretariat?.kecamatan || '';
  const wilayahIdent = rtStr && rwStr ? `RT.${rtStr} RW.${rwStr}` : 'Kas RT';

  const defaultFilename = `Kas_${rtStr ? `RT${rtStr}_` : ''}${rwStr ? `RW${rwStr}_` : ''}Backup_${new Date().toISOString().split('T')[0]}.json`;
  const filename = options.filename || defaultFilename;

  let totalMasuk = 0;
  let totalKeluar = 0;
  transactions.forEach((t) => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'Masuk') totalMasuk += amt;
    else if (t.type === 'Keluar') totalKeluar += amt;
  });

  const payload = {
    aplikasi: `Kas ${wilayahIdent}`,
    wilayah: [
      rtStr ? `RT.${rtStr}` : '',
      rwStr ? `RW.${rwStr}` : '',
      kelStr ? `Kelurahan ${kelStr}` : '',
      kecStr ? `Kecamatan ${kecStr}` : '',
    ].filter(Boolean).join(', ') || 'Sistem Kas RT',
    cakupan: scopeTitle,
    tanggal_ekspor: new Date().toISOString(),
    total_transaksi: transactions.length,
    ringkasan: {
      total_kas_masuk: totalMasuk,
      total_kas_keluar: totalKeluar,
      saldo_bersih: totalMasuk - totalKeluar,
    },
    transaksi: transactions,
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
  const link = document.createElement('a');
  link.setAttribute('href', dataStr);
  link.setAttribute('download', filename.endsWith('.json') ? filename : `${filename}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Menghasilkan teks query SQL MySQL (DDL CREATE TABLE + DML INSERT VALUES) untuk seluruh 8 tabel resmi
 */
export function generateMySQLDump(
  transactions: Transaction[],
  scopeTitle: string = 'Semua Transaksi',
  sekretariat?: ExportOptions['sekretariat'],
  extraTables?: {
    kategori?: CategoryItem[];
    data_warga?: DataWargaItem[];
    pengguna?: SupabasePengurusRow[];
    inventaris_rt?: InventarisItem[];
    peminjaman_aset_rt?: PeminjamanItem[];
    darurat_rt?: EmergencyAlertItem[];
  }
): string {
  const exportDate = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const rtStr = sekretariat?.rt || '';
  const rwStr = sekretariat?.rw || '';
  const kelStr = sekretariat?.kelurahan || '';
  const kecStr = sekretariat?.kecamatan || '';
  const wilayahIdent = rtStr && rwStr ? `RT.${rtStr} RW.${rwStr}` : 'Kas RT';

  let sql = `-- =============================================================================\n`;
  sql += `-- DUMP STRUKTUR & DATA DATABASE MYSQL LENGKAP: 8 TABEL RESMI\n`;
  sql += `-- Aplikasi: Sistem Buku Kas & Manajemen ${wilayahIdent}\n`;
  sql += `-- Wilayah: ${[rtStr && `RT.${rtStr}`, rwStr && `RW.${rwStr}`, kelStr && `Kelurahan ${kelStr}`, kecStr && `Kec. ${kecStr}`].filter(Boolean).join(', ') || 'Sistem Kas RT'}\n`;
  sql += `-- Cakupan: ${scopeTitle} (${transactions.length} baris data kas)\n`;
  sql += `-- Tanggal Pembuatan: ${exportDate} WIB\n`;
  sql += `-- Target: MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+\n`;
  sql += `-- Karakter Encoding: UTF-8 (utf8mb4)\n`;
  sql += `-- =============================================================================\n\n`;

  sql += `SET NAMES utf8mb4;\n`;
  sql += `SET FOREIGN_KEY_CHECKS = 0;\n`;
  sql += `SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n\n`;

  // 1. sekretariat
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `-- 1. TABEL: sekretariat\n`;
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `DROP TABLE IF EXISTS \`sekretariat\`;\n`;
  sql += `CREATE TABLE \`sekretariat\` (\n`;
  sql += `  \`id\` VARCHAR(36) NOT NULL,\n`;
  sql += `  \`rt\` VARCHAR(10) NOT NULL,\n`;
  sql += `  \`rw\` VARCHAR(10) NOT NULL,\n`;
  sql += `  \`kelurahan\` VARCHAR(100) NOT NULL,\n`;
  sql += `  \`kecamatan\` VARCHAR(100) NOT NULL,\n`;
  sql += `  \`alamat\` TEXT NOT NULL,\n`;
  sql += `  PRIMARY KEY (\`id\`)\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

  if (sekretariat && (sekretariat.rt || sekretariat.rw)) {
    sql += `INSERT INTO \`sekretariat\` VALUES ('00000000-0000-0000-0000-000000000001', '${(sekretariat.rt || '').replace(/'/g, "\\'")}', '${(sekretariat.rw || '').replace(/'/g, "\\'")}', '${(sekretariat.kelurahan || '').replace(/'/g, "\\'")}', '${(sekretariat.kecamatan || '').replace(/'/g, "\\'")}', '${(sekretariat.alamat || '').replace(/'/g, "\\'")}');\n\n`;
  }

  // 2. kategori
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `-- 2. TABEL: kategori\n`;
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `DROP TABLE IF EXISTS \`kategori\`;\n`;
  sql += `CREATE TABLE \`kategori\` (\n`;
  sql += `  \`id\` VARCHAR(36) NOT NULL,\n`;
  sql += `  \`nama\` VARCHAR(100) NOT NULL,\n`;
  sql += `  \`jenis\` ENUM('Masuk', 'Keluar') NOT NULL,\n`;
  sql += `  \`deskripsi\` TEXT,\n`;
  sql += `  \`wajib\` TINYINT(1) NOT NULL DEFAULT '0',\n`;
  sql += `  \`nominal\` DECIMAL(15, 2) NOT NULL DEFAULT '0.00',\n`;
  sql += `  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `  PRIMARY KEY (\`id\`),\n`;
  sql += `  UNIQUE KEY \`uniq_nama_jenis\` (\`nama\`, \`jenis\`)\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

  // 3. data_warga
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `-- 3. TABEL: data_warga\n`;
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `DROP TABLE IF EXISTS \`data_warga\`;\n`;
  sql += `CREATE TABLE \`data_warga\` (\n`;
  sql += `  \`id\` VARCHAR(36) NOT NULL,\n`;
  sql += `  \`no_kk\` VARCHAR(16) NOT NULL,\n`;
  sql += `  \`nik\` VARCHAR(16) NOT NULL,\n`;
  sql += `  \`nama_lengkap\` VARCHAR(150) NOT NULL,\n`;
  sql += `  \`jenis_kelamin\` ENUM('Laki-laki', 'Perempuan') DEFAULT 'Laki-laki',\n`;
  sql += `  \`tempat_lahir\` VARCHAR(100) DEFAULT NULL,\n`;
  sql += `  \`tanggal_lahir\` DATE DEFAULT NULL,\n`;
  sql += `  \`agama\` VARCHAR(30) DEFAULT 'Islam',\n`;
  sql += `  \`pendidikan\` VARCHAR(50) DEFAULT NULL,\n`;
  sql += `  \`pekerjaan\` VARCHAR(80) DEFAULT NULL,\n`;
  sql += `  \`status_perkawinan\` VARCHAR(30) DEFAULT 'Belum Kawin',\n`;
  sql += `  \`alamat_domisili\` TEXT NOT NULL,\n`;
  sql += `  \`no_hp\` VARCHAR(20) DEFAULT NULL,\n`;
  sql += `  \`status_warga\` VARCHAR(50) DEFAULT 'Warga Tetap',\n`;
  sql += `  \`catatan\` TEXT,\n`;
  sql += `  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `  PRIMARY KEY (\`id\`),\n`;
  sql += `  UNIQUE KEY \`uniq_nik\` (\`nik\`),\n`;
  sql += `  KEY \`idx_no_kk\` (\`no_kk\`)\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

  // 4. pengguna
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `-- 4. TABEL: pengguna\n`;
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `DROP TABLE IF EXISTS \`pengguna\`;\n`;
  sql += `CREATE TABLE \`pengguna\` (\n`;
  sql += `  \`id\` VARCHAR(36) NOT NULL,\n`;
  sql += `  \`nama\` VARCHAR(150) NOT NULL,\n`;
  sql += `  \`email\` VARCHAR(100) NOT NULL,\n`;
  sql += `  \`password\` VARCHAR(255) NOT NULL,\n`;
  sql += `  \`jabatan\` VARCHAR(50) NOT NULL,\n`;
  sql += `  \`level_akses\` ENUM('Admin', 'User') NOT NULL DEFAULT 'User',\n`;
  sql += `  \`no_hp\` VARCHAR(20) DEFAULT NULL,\n`;
  sql += `  \`no_kk\` VARCHAR(16) DEFAULT NULL,\n`;
  sql += `  \`warga_id\` VARCHAR(36) DEFAULT NULL,\n`;
  sql += `  \`nik\` VARCHAR(16) DEFAULT NULL,\n`;
  sql += `  \`alamat_domisili\` TEXT,\n`;
  sql += `  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `  PRIMARY KEY (\`id\`),\n`;
  sql += `  UNIQUE KEY \`uniq_email\` (\`email\`)\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

  // 5. kas_rt
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `-- 5. TABEL: kas_rt\n`;
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `DROP TABLE IF EXISTS \`kas_rt\`;\n`;
  sql += `CREATE TABLE \`kas_rt\` (\n`;
  sql += `  \`id\` VARCHAR(36) NOT NULL,\n`;
  sql += `  \`tanggal\` DATE NOT NULL,\n`;
  sql += `  \`jenis\` ENUM('Masuk', 'Keluar') NOT NULL,\n`;
  sql += `  \`kategori\` VARCHAR(100) NOT NULL,\n`;
  sql += `  \`jumlah\` DECIMAL(15, 2) NOT NULL DEFAULT '0.00',\n`;
  sql += `  \`keterangan\` TEXT NOT NULL,\n`;
  sql += `  \`warga_id\` VARCHAR(36) DEFAULT NULL,\n`;
  sql += `  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `  PRIMARY KEY (\`id\`),\n`;
  sql += `  KEY \`idx_tanggal\` (\`tanggal\`),\n`;
  sql += `  KEY \`idx_jenis\` (\`jenis\`)\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

  if (transactions.length > 0) {
    sql += `INSERT INTO \`kas_rt\` (\`id\`, \`tanggal\`, \`jenis\`, \`kategori\`, \`jumlah\`, \`keterangan\`, \`warga_id\`, \`created_at\`) VALUES\n`;
    const values = transactions.map((t) => {
      const escapedId = (t.id || '').replace(/'/g, "\\'");
      const escapedDate = (t.date || new Date().toISOString().split('T')[0]).replace(/'/g, "\\'");
      const jenis = t.type === 'Keluar' ? 'Keluar' : 'Masuk';
      const escapedCat = (t.category || 'Lainnya').replace(/'/g, "\\'");
      const amt = Number(t.amount) || 0;
      const escapedDesc = (t.description || '').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '');
      const escapedWargaId = t.wargaId ? `'${t.wargaId.replace(/'/g, "\\'")}'` : 'NULL';
      const createdAtStr = t.createdAt
        ? new Date(t.createdAt).toISOString().replace('T', ' ').substring(0, 19)
        : `${escapedDate} 07:00:00`;
      return `  ('${escapedId}', '${escapedDate}', '${jenis}', '${escapedCat}', ${amt.toFixed(2)}, '${escapedDesc}', ${escapedWargaId}, '${createdAtStr}')`;
    });
    sql += values.join(',\n') + ';\n\n';
  }

  // 6. darurat_rt
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `-- 6. TABEL: darurat_rt\n`;
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `DROP TABLE IF EXISTS \`darurat_rt\`;\n`;
  sql += `CREATE TABLE \`darurat_rt\` (\n`;
  sql += `  \`id\` VARCHAR(36) NOT NULL,\n`;
  sql += `  \`id_warga\` VARCHAR(36) NOT NULL,\n`;
  sql += `  \`nama_warga\` VARCHAR(150) NOT NULL,\n`;
  sql += `  \`alamat\` TEXT NOT NULL,\n`;
  sql += `  \`no_hp\` VARCHAR(20) DEFAULT NULL,\n`;
  sql += `  \`tipe_darurat\` VARCHAR(50) NOT NULL,\n`;
  sql += `  \`status\` ENUM('Aktif', 'Selesai') NOT NULL DEFAULT 'Aktif',\n`;
  sql += `  \`keterangan\` TEXT,\n`;
  sql += `  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `  PRIMARY KEY (\`id\`)\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

  // 7. inventaris_rt
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `-- 7. TABEL: inventaris_rt\n`;
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `DROP TABLE IF EXISTS \`inventaris_rt\`;\n`;
  sql += `CREATE TABLE \`inventaris_rt\` (\n`;
  sql += `  \`id\` VARCHAR(36) NOT NULL,\n`;
  sql += `  \`nama_barang\` VARCHAR(150) NOT NULL,\n`;
  sql += `  \`jumlah_total\` INT NOT NULL DEFAULT '1',\n`;
  sql += `  \`jumlah_baik\` INT NOT NULL DEFAULT '1',\n`;
  sql += `  \`jumlah_rusak\` INT NOT NULL DEFAULT '0',\n`;
  sql += `  \`kondisi\` VARCHAR(50) DEFAULT 'Baik',\n`;
  sql += `  \`lokasi_penyimpanan\` VARCHAR(150) DEFAULT NULL,\n`;
  sql += `  \`catatan\` TEXT,\n`;
  sql += `  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `  PRIMARY KEY (\`id\`)\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

  // 8. peminjaman_aset_rt
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `-- 8. TABEL: peminjaman_aset_rt\n`;
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `DROP TABLE IF EXISTS \`peminjaman_aset_rt\`;\n`;
  sql += `CREATE TABLE \`peminjaman_aset_rt\` (\n`;
  sql += `  \`id\` VARCHAR(36) NOT NULL,\n`;
  sql += `  \`id_barang\` VARCHAR(36) NOT NULL,\n`;
  sql += `  \`id_warga\` VARCHAR(36) NOT NULL,\n`;
  sql += `  \`tanggal_pinjam\` DATE NOT NULL,\n`;
  sql += `  \`tanggal_kembali\` DATE DEFAULT NULL,\n`;
  sql += `  \`jumlah_pinjam\` INT NOT NULL DEFAULT '1',\n`;
  sql += `  \`keperluan\` TEXT,\n`;
  sql += `  \`status\` ENUM('Dipinjam', 'Kembali') NOT NULL DEFAULT 'Dipinjam',\n`;
  sql += `  \`catatan\` TEXT,\n`;
  sql += `  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `  PRIMARY KEY (\`id\`)\n`;
  sql += `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

  sql += `SET FOREIGN_KEY_CHECKS = 1;\n`;
  return sql;
}

/**
 * Ekspor data transaksi kas_rt ke format file SQL MySQL (.sql) siap import
 */
export function exportToMySQL(
  transactions: Transaction[],
  options: ExportOptions = {}
): void {
  const {
    scopeTitle = 'Semua Transaksi',
    sekretariat,
  } = options;

  const rtStr = sekretariat?.rt || '';
  const rwStr = sekretariat?.rw || '';

  const defaultFilename = `kas_rt_mysql_${rtStr ? `RT${rtStr}_` : ''}${rwStr ? `RW${rwStr}_` : ''}${new Date().toISOString().split('T')[0]}.sql`;
  const filename = options.filename || defaultFilename;

  const sqlContent = generateMySQLDump(transactions, scopeTitle, sekretariat);
  const blob = new Blob([sqlContent], { type: 'application/sql;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.sql') ? filename : `${filename}.sql`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
