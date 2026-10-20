import { 
  Transaction, 
  CategoryItem, 
  TransactionType, 
  SupabasePengurusRow, 
  DataWargaItem, 
  SekretariatItem,
  InventarisItem,
  PeminjamanItem
} from '../types';
import {
  getSupabase,
  insertMultipleKasToSupabase,
  clearKasInSupabase,
  seedInitialCategoriesToSupabase,
  restorePengurusToSupabase,
  restoreDataWargaToSupabase,
  restoreSekretariatToSupabase,
  restoreInventarisToSupabase,
  restorePeminjamanToSupabase,
  restoreDaruratToSupabase,
  clearInventarisInSupabase,
  clearPeminjamanInSupabase,
  clearDaruratInSupabase,
  EmergencyAlertItem,
  isUuid,
} from './supabase';

export interface BackupScope {
  type: 'all' | 'monthly';
  selectedMonth: string; // 'all' atau '01'..'12'
  selectedYear: string;  // 'all' atau '2024', dll.
  periodLabel: string;
}

export type BackupFormat = 'json' | 'sql';

export interface BackupData {
  appName: string;
  wilayah: string;
  version: string;
  backupTimestamp: string;
  scopeType: 'all' | 'monthly';
  scopeLabel: string;
  selectedMonth: string;
  selectedYear: string;
  formatSource?: 'json' | 'sql';
  summary: {
    totalKasMasuk: number;
    totalKasKeluar: number;
    saldoBersih: number;
    transactionCount: number;
    categoryCount: number;
    pengurusCount?: number;
    dataWargaCount?: number;
    sekretariatCount?: number;
    inventarisCount?: number;
    peminjamanCount?: number;
    daruratCount?: number;
    totalTables?: number;
  };
  tables?: {
    kas_rt: Transaction[];
    kategori: CategoryItem[];
    pengurus: (SupabasePengurusRow | any)[];
    pengguna?: (SupabasePengurusRow | any)[];
    data_warga: (DataWargaItem | any)[];
    sekretariat?: (SekretariatItem | any)[];
    inventaris_rt?: (InventarisItem | any)[];
    peminjaman_aset_rt?: (PeminjamanItem | any)[];
    darurat_rt?: (EmergencyAlertItem | any)[];
  };
  categories: CategoryItem[];
  transactions: Transaction[];
  pengurus?: (SupabasePengurusRow | any)[];
  pengguna?: (SupabasePengurusRow | any)[];
  data_warga?: (DataWargaItem | any)[];
  sekretariat?: (SekretariatItem | any)[];
  inventaris?: (InventarisItem | any)[];
  inventaris_rt?: (InventarisItem | any)[];
  peminjaman?: (PeminjamanItem | any)[];
  peminjaman_aset_rt?: (PeminjamanItem | any)[];
  darurat?: (EmergencyAlertItem | any)[];
  darurat_rt?: (EmergencyAlertItem | any)[];
}

export type RestoreMode = 'merge' | 'replace';

export interface RestoreResult {
  success: boolean;
  restoredTransactionsCount: number;
  restoredCategoriesCount: number;
  restoredPengurusCount?: number;
  restoredDataWargaCount?: number;
  restoredSekretariatCount?: number;
  restoredInventarisCount?: number;
  restoredPeminjamanCount?: number;
  restoredDaruratCount?: number;
  mode: RestoreMode;
  target: 'supabase' | 'local';
  error?: string;
  details?: string;
}

/**
 * Menyaring daftar transaksi sesuai cakupan backup (Semua Data atau Bulan Tertentu)
 */
export function filterTransactionsForBackup(
  transactions: Transaction[],
  scopeType: 'all' | 'monthly',
  selectedMonth: string,
  selectedYear: string
): Transaction[] {
  if (scopeType === 'all') {
    return [...transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  return transactions
    .filter((tx) => {
      if (!tx.date) return false;
      const parts = tx.date.split('-');
      if (parts.length < 2) return false;
      const [year, month] = parts;
      const matchYear = selectedYear === 'all' || year === selectedYear;
      const matchMonth = selectedMonth === 'all' || month === selectedMonth;
      return matchYear && matchMonth;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Menghasilkan string JSON snapshot backup resmi Kas RT (Mencakup 8 tabel: kas_rt, kategori, pengurus/pengguna, data_warga, sekretariat, inventaris_rt, peminjaman_aset_rt, darurat_rt)
 */
export function generateBackupJSON(
  transactions: Transaction[],
  categories: CategoryItem[],
  scope: BackupScope,
  pengurus: (SupabasePengurusRow | any)[] = [],
  dataWarga: (DataWargaItem | any)[] = [],
  sekretariat: (SekretariatItem | any)[] = [],
  inventaris: (InventarisItem | any)[] = [],
  peminjaman: (PeminjamanItem | any)[] = [],
  darurat: (EmergencyAlertItem | any)[] = []
): { jsonString: string; backupData: BackupData; defaultFilename: string } {
  let totalMasuk = 0;
  let totalKeluar = 0;

  transactions.forEach((tx) => {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'Masuk') totalMasuk += amt;
    else totalKeluar += amt;
  });

  const now = new Date();
  const dateIso = now.toISOString();
  const dateStr = dateIso.split('T')[0];

  const sekFirst = (sekretariat && sekretariat.length > 0) ? sekretariat[0] : null;
  const rtStr = sekFirst?.rt || '';
  const rwStr = sekFirst?.rw || '';
  const kelStr = sekFirst?.kelurahan || '';
  const kecStr = sekFirst?.kecamatan || '';
  const wilayahIdent = rtStr && rwStr ? `RT.${rtStr} RW.${rwStr}` : 'Kas RT';

  const backupData: BackupData = {
    appName: `Kas ${wilayahIdent}`,
    wilayah: [
      rtStr ? `RT.${rtStr}` : '',
      rwStr ? `RW.${rwStr}` : '',
      kelStr ? `Kelurahan ${kelStr}` : '',
      kecStr ? `Kecamatan ${kecStr}` : '',
    ].filter(Boolean).join(', ') || 'Sistem Kas RT',
    version: '3.0',
    backupTimestamp: dateIso,
    scopeType: scope.type,
    scopeLabel: scope.periodLabel,
    selectedMonth: scope.selectedMonth,
    selectedYear: scope.selectedYear,
    summary: {
      totalKasMasuk: totalMasuk,
      totalKasKeluar: totalKeluar,
      saldoBersih: totalMasuk - totalKeluar,
      transactionCount: transactions.length,
      categoryCount: categories.length,
      pengurusCount: pengurus.length,
      dataWargaCount: dataWarga.length,
      sekretariatCount: (sekretariat || []).length,
      inventarisCount: inventaris.length,
      peminjamanCount: peminjaman.length,
      daruratCount: darurat.length,
      totalTables: 8,
    },
    tables: {
      kas_rt: transactions || [],
      kategori: categories || [],
      pengurus: pengurus || [],
      pengguna: pengurus || [],
      data_warga: dataWarga || [],
      sekretariat: (sekretariat || []).map((s) => ({
        rt: String(s.rt || s.RT || '').trim(),
        rw: String(s.rw || s.RW || '').trim(),
        kelurahan: String(s.kelurahan || s.Kelurahan || '').trim(),
        kecamatan: String(s.kecamatan || s.Kecamatan || '').trim(),
        alamat: String(s.alamat || s.Alamat || '').trim(),
      })),
      inventaris_rt: inventaris || [],
      peminjaman_aset_rt: peminjaman || [],
      darurat_rt: darurat || [],
    },
    categories: categories || [],
    transactions: transactions || [],
    pengurus: pengurus || [],
    pengguna: pengurus || [],
    data_warga: dataWarga || [],
    sekretariat: (sekretariat || []).map((s) => ({
      rt: String(s.rt || s.RT || '').trim(),
      rw: String(s.rw || s.RW || '').trim(),
      kelurahan: String(s.kelurahan || s.Kelurahan || '').trim(),
      kecamatan: String(s.kecamatan || s.Kecamatan || '').trim(),
      alamat: String(s.alamat || s.Alamat || '').trim(),
    })),
    inventaris: inventaris || [],
    inventaris_rt: inventaris || [],
    peminjaman: peminjaman || [],
    peminjaman_aset_rt: peminjaman || [],
    darurat: darurat || [],
    darurat_rt: darurat || [],
  };

  const jsonString = JSON.stringify(backupData, null, 2);

  // Buat nama file rapi
  let filenameSuffix = 'Semua_8_Tabel';
  if (scope.type === 'monthly') {
    const cleanLabel = scope.periodLabel.replace(/[^a-zA-Z0-9]/g, '_');
    filenameSuffix = cleanLabel || `Bulan_${scope.selectedMonth}_${scope.selectedYear}`;
  }

  const rtPart = sekFirst?.rt ? `_RT${sekFirst.rt}` : '';
  const rwPart = sekFirst?.rw ? `_RW${sekFirst.rw}` : '';
  const defaultFilename = `Backup_8_Tabel${rtPart}${rwPart}_${filenameSuffix}_${dateStr}.json`;

  return { jsonString, backupData, defaultFilename };
}

/**
 * Menghasilkan script SQL PostgreSQL Dump untuk Supabase SQL Editor (Mencakup 8 tabel lengkap: sekretariat, kategori, data_warga, pengguna, kas_rt, darurat_rt, inventaris_rt, peminjaman_aset_rt)
 */
export function generateSupabaseSQLDump(
  transactions: Transaction[],
  categories: CategoryItem[],
  scope: BackupScope,
  pengurus: (SupabasePengurusRow | any)[] = [],
  dataWarga: (DataWargaItem | any)[] = [],
  sekretariat: (SekretariatItem | any)[] = [],
  inventaris: (InventarisItem | any)[] = [],
  peminjaman: (PeminjamanItem | any)[] = [],
  darurat: (EmergencyAlertItem | any)[] = []
): { sqlString: string; defaultFilename: string } {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const exportTime = now.toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'medium' });

  let totalMasuk = 0;
  let totalKeluar = 0;
  transactions.forEach((tx) => {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'Masuk') totalMasuk += amt;
    else totalKeluar += amt;
  });

  const sekFirst = (sekretariat && sekretariat.length > 0) ? sekretariat[0] : null;
  const rtStr = sekFirst?.rt || '';
  const rwStr = sekFirst?.rw || '';
  const kelStr = sekFirst?.kelurahan || '';
  const kecStr = sekFirst?.kecamatan || '';
  const wilayahIdent = rtStr && rwStr ? `RT.${rtStr} RW.${rwStr}` : 'Kas RT';

  let sql = `-- =============================================================================\n`;
  sql += `-- BACKUP PENUH DATABASE SUPABASE / POSTGRESQL: ${wilayahIdent.toUpperCase()} (8 TABEL RESMI)\n`;
  sql += `-- Wilayah: ${[rtStr && `RT.${rtStr}`, rwStr && `RW.${rwStr}`, kelStr && `Kelurahan ${kelStr}`, kecStr && `Kecamatan ${kecStr}`].filter(Boolean).join(', ') || 'Sistem Kas RT'}\n`;
  sql += `-- Tanggal Backup: ${exportTime}\n`;
  sql += `-- Cakupan: ${scope.periodLabel}\n`;
  sql += `-- Total 8 Tabel: sekretariat (${sekretariat.length}), kategori (${categories.length}), data_warga (${dataWarga.length}), pengguna (${pengurus.length}), kas_rt (${transactions.length}), darurat_rt (${darurat.length}), inventaris_rt (${inventaris.length}), peminjaman_aset_rt (${peminjaman.length})\n`;
  sql += `-- Ringkasan Kas: Masuk: Rp ${totalMasuk.toLocaleString('id-ID')} | Keluar: Rp ${totalKeluar.toLocaleString('id-ID')} | Saldo: Rp ${(totalMasuk - totalKeluar).toLocaleString('id-ID')}\n`;
  sql += `-- Target: PostgreSQL 14+, PostgreSQL 15+, Supabase Database Editor\n`;
  sql += `-- =============================================================================\n\n`;

  sql += `SET TIMEZONE = 'UTC';\n\n`;

  // 1. Skema & Data Sekretariat
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `-- 1. TABEL: sekretariat (Identitas Wilayah RT/RW)\n`;
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `CREATE TABLE IF NOT EXISTS sekretariat (\n`;
  sql += `  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n`;
  sql += `  rt VARCHAR(10) NOT NULL,\n`;
  sql += `  rw VARCHAR(10) NOT NULL,\n`;
  sql += `  kelurahan VARCHAR(100) NOT NULL,\n`;
  sql += `  kecamatan VARCHAR(100) NOT NULL,\n`;
  sql += `  alamat TEXT NOT NULL\n`;
  sql += `);\n\n`;
  sql += `ALTER TABLE sekretariat ENABLE ROW LEVEL SECURITY;\n`;
  sql += `DROP POLICY IF EXISTS "Akses Publik Sekretariat" ON sekretariat;\n`;
  sql += `CREATE POLICY "Akses Publik Sekretariat" ON sekretariat FOR ALL USING (true) WITH CHECK (true);\n\n`;

  if (sekretariat && sekretariat.length > 0) {
    sql += `-- Data Sekretariat Wilayah\n`;
    sql += `INSERT INTO sekretariat (rt, rw, kelurahan, kecamatan, alamat) VALUES\n`;
    const sekValues = sekretariat.map((s) => {
      const rt = (s.rt || '').replace(/'/g, "''");
      const rw = (s.rw || '').replace(/'/g, "''");
      const kel = (s.kelurahan || '').replace(/'/g, "''");
      const kec = (s.kecamatan || '').replace(/'/g, "''");
      const alm = (s.alamat || '').replace(/'/g, "''");
      return `  ('${rt}', '${rw}', '${kel}', '${kec}', '${alm}')`;
    });
    sql += sekValues.join(',\n') + ';\n\n';
  }

  // 2. Skema & Data Kategori
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `-- 2. TABEL: kategori (Master Pos Anggaran Penerimaan & Belanja)\n`;
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `CREATE TABLE IF NOT EXISTS kategori (\n`;
  sql += `  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n`;
  sql += `  nama TEXT NOT NULL,\n`;
  sql += `  jenis TEXT NOT NULL CHECK (jenis IN ('Masuk', 'Keluar')),\n`;
  sql += `  deskripsi TEXT,\n`;
  sql += `  wajib BOOLEAN DEFAULT false,\n`;
  sql += `  nominal NUMERIC DEFAULT 0,\n`;
  sql += `  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,\n`;
  sql += `  UNIQUE(nama, jenis)\n`;
  sql += `);\n\n`;
  sql += `ALTER TABLE kategori ENABLE ROW LEVEL SECURITY;\n`;
  sql += `DROP POLICY IF EXISTS "Akses Publik Kategori" ON kategori;\n`;
  sql += `CREATE POLICY "Akses Publik Kategori" ON kategori FOR ALL USING (true) WITH CHECK (true);\n\n`;

  if (categories && categories.length > 0) {
    sql += `-- Data Master Kategori (${categories.length} item)\n`;
    sql += `INSERT INTO kategori (id, nama, jenis, deskripsi, wajib, nominal, created_at) VALUES\n`;
    const catValues = categories.map((c) => {
      const idVal = c.id && isUuid(c.id) ? `'${c.id}'` : 'gen_random_uuid()';
      const namaEsc = (c.name || '').replace(/'/g, "''");
      const jenis = c.type === 'Keluar' ? 'Keluar' : 'Masuk';
      const descEsc = (c.description || '').replace(/'/g, "''");
      const wajibVal = c.wajib ? 'true' : 'false';
      const nominalVal = c.nominal !== undefined ? Number(c.nominal) || 0 : 0;
      const createdStr = c.createdAt 
        ? `'${new Date(c.createdAt).toISOString()}'` 
        : 'now()';
      return `  (${idVal}, '${namaEsc}', '${jenis}', '${descEsc}', ${wajibVal}, ${nominalVal}, ${createdStr})`;
    });
    sql += catValues.join(',\n') + '\n';
    sql += `ON CONFLICT (nama, jenis) DO UPDATE SET deskripsi = EXCLUDED.deskripsi, wajib = EXCLUDED.wajib, nominal = EXCLUDED.nominal;\n\n`;
  }

  // 3. Skema & Data Warga
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `-- 3. TABEL: data_warga (Master Data Kependudukan Warga RT)\n`;
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `CREATE TABLE IF NOT EXISTS data_warga (\n`;
  sql += `  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n`;
  sql += `  no_kk VARCHAR(16) NOT NULL,\n`;
  sql += `  nik VARCHAR(16) UNIQUE NOT NULL,\n`;
  sql += `  nama_lengkap TEXT NOT NULL,\n`;
  sql += `  jenis_kelamin TEXT CHECK (jenis_kelamin IN ('Laki-laki', 'Perempuan')),\n`;
  sql += `  tempat_lahir TEXT,\n`;
  sql += `  tanggal_lahir DATE,\n`;
  sql += `  agama TEXT,\n`;
  sql += `  pendidikan TEXT,\n`;
  sql += `  pekerjaan TEXT,\n`;
  sql += `  status_perkawinan TEXT CHECK (status_perkawinan IN ('Belum Kawin', 'Kawin', 'Cerai Hidup', 'Cerai Mati')),\n`;
  sql += `  alamat_domisili TEXT NOT NULL,\n`;
  sql += `  no_hp VARCHAR(20),\n`;
  sql += `  status_warga TEXT CHECK (status_warga IN ('Warga Tetap', 'Warga Pendatang/Kontrak', 'Warga Kos')),\n`;
  sql += `  catatan TEXT,\n`;
  sql += `  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL\n`;
  sql += `);\n\n`;
  sql += `CREATE INDEX IF NOT EXISTS idx_data_warga_nik ON data_warga (nik);\n`;
  sql += `CREATE INDEX IF NOT EXISTS idx_data_warga_no_kk ON data_warga (no_kk);\n`;
  sql += `ALTER TABLE data_warga ENABLE ROW LEVEL SECURITY;\n`;
  sql += `DROP POLICY IF EXISTS "Akses Publik Data Warga" ON data_warga;\n`;
  sql += `CREATE POLICY "Akses Publik Data Warga" ON data_warga FOR ALL USING (true) WITH CHECK (true);\n\n`;

  if (dataWarga && dataWarga.length > 0) {
    sql += `-- Data Kependudukan Warga (${dataWarga.length} baris)\n`;
    sql += `INSERT INTO data_warga (id, no_kk, nik, nama_lengkap, jenis_kelamin, tempat_lahir, tanggal_lahir, agama, pendidikan, pekerjaan, status_perkawinan, alamat_domisili, no_hp, status_warga, catatan, created_at) VALUES\n`;
    const wargaValues = dataWarga.map((w) => {
      const idVal = w.id && isUuid(w.id) ? `'${w.id}'` : 'gen_random_uuid()';
      const kk = (w.no_kk || '').replace(/'/g, "''");
      const nik = (w.nik || '').replace(/'/g, "''");
      const nama = (w.nama_lengkap || '').replace(/'/g, "''");
      const jk = (w.jenis_kelamin || 'Laki-laki').replace(/'/g, "''");
      const tmpLahir = w.tempat_lahir ? `'${w.tempat_lahir.replace(/'/g, "''")}'` : 'NULL';
      const tglLahir = w.tanggal_lahir ? `'${w.tanggal_lahir}'` : 'NULL';
      const agama = w.agama ? `'${w.agama.replace(/'/g, "''")}'` : `'Islam'`;
      const pend = w.pendidikan ? `'${w.pendidikan.replace(/'/g, "''")}'` : 'NULL';
      const pekr = w.pekerjaan ? `'${w.pekerjaan.replace(/'/g, "''")}'` : 'NULL';
      const statusKawin = w.status_perkawinan ? `'${w.status_perkawinan.replace(/'/g, "''")}'` : `'Belum Kawin'`;
      const alm = (w.alamat_domisili || '-').replace(/'/g, "''");
      const hp = w.no_hp ? `'${w.no_hp.replace(/'/g, "''")}'` : 'NULL';
      const statusWarga = w.status_warga ? `'${w.status_warga.replace(/'/g, "''")}'` : `'Warga Tetap'`;
      const cat = w.catatan ? `'${w.catatan.replace(/'/g, "''")}'` : 'NULL';
      const crt = w.created_at ? `'${w.created_at}'` : 'now()';
      return `  (${idVal}, '${kk}', '${nik}', '${nama}', '${jk}', ${tmpLahir}, ${tglLahir}, ${agama}, ${pend}, ${pekr}, ${statusKawin}, '${alm}', ${hp}, ${statusWarga}, ${cat}, ${crt})`;
    });
    sql += wargaValues.join(',\n') + '\n';
    sql += `ON CONFLICT (nik) DO UPDATE SET no_kk = EXCLUDED.no_kk, nama_lengkap = EXCLUDED.nama_lengkap, alamat_domisili = EXCLUDED.alamat_domisili, no_hp = EXCLUDED.no_hp;\n\n`;
  }

  // 4. Skema & Data Pengguna
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `-- 4. TABEL: pengguna (Akun Pengurus & Akses Warga RT)\n`;
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `CREATE TABLE IF NOT EXISTS pengguna (\n`;
  sql += `  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n`;
  sql += `  nama TEXT NOT NULL,\n`;
  sql += `  email TEXT UNIQUE NOT NULL,\n`;
  sql += `  password TEXT NOT NULL,\n`;
  sql += `  jabatan TEXT NOT NULL,\n`;
  sql += `  level_akses TEXT NOT NULL DEFAULT 'User' CHECK (level_akses IN ('Admin', 'User')),\n`;
  sql += `  no_hp TEXT,\n`;
  sql += `  no_kk VARCHAR(16),\n`;
  sql += `  warga_id UUID,\n`;
  sql += `  nik VARCHAR(16),\n`;
  sql += `  alamat_domisili TEXT,\n`;
  sql += `  foto_url TEXT,\n`;
  sql += `  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())\n`;
  sql += `);\n\n`;
  sql += `ALTER TABLE pengguna ENABLE ROW LEVEL SECURITY;\n`;
  sql += `DROP POLICY IF EXISTS "Akses Publik Pengguna" ON pengguna;\n`;
  sql += `CREATE POLICY "Akses Publik Pengguna" ON pengguna FOR ALL USING (true) WITH CHECK (true);\n\n`;
 
  if (pengurus && pengurus.length > 0) {
    sql += `-- Data Akun Pengguna / Pengurus (${pengurus.length} akun)\n`;
    sql += `INSERT INTO pengguna (id, nama, email, password, jabatan, level_akses, no_hp, no_kk, warga_id, nik, alamat_domisili, foto_url, created_at) VALUES\n`;
    const pengValues = pengurus.map((p) => {
      const idVal = p.id && isUuid(p.id) ? `'${p.id}'` : 'gen_random_uuid()';
      const nama = (p.nama || p.name || 'Pengurus').replace(/'/g, "''");
      const email = (p.email || '').toLowerCase().replace(/'/g, "''");
      const pwd = (p.password || 'admin123').replace(/'/g, "''");
      const jab = (p.jabatan || p.role || 'Pengurus').replace(/'/g, "''");
      const lvl = p.level_akses || p.levelAkses || 'User';
      const hp = (p.no_hp || p.nohp) ? `'${String(p.no_hp || p.nohp).replace(/'/g, "''")}'` : 'NULL';
      const kk = p.no_kk ? `'${String(p.no_kk).replace(/'/g, "''")}'` : 'NULL';
      const wId = p.warga_id && isUuid(p.warga_id) ? `'${p.warga_id}'` : 'NULL';
      const nik = p.nik ? `'${String(p.nik).replace(/'/g, "''")}'` : 'NULL';
      const alm = p.alamat_domisili ? `'${String(p.alamat_domisili).replace(/'/g, "''")}'` : 'NULL';
      const foto = (p.foto_url || p.fotoUrl) ? `'${String(p.foto_url || p.fotoUrl).replace(/'/g, "''")}'` : 'NULL';
      const crt = p.created_at ? `'${p.created_at}'` : 'now()';
      return `  (${idVal}, '${nama}', '${email}', '${pwd}', '${jab}', '${lvl}', ${hp}, ${kk}, ${wId}, ${nik}, ${alm}, ${foto}, ${crt})`;
    });
    sql += pengValues.join(',\n') + '\n';
    sql += `ON CONFLICT (email) DO UPDATE SET nama = EXCLUDED.nama, jabatan = EXCLUDED.jabatan, level_akses = EXCLUDED.level_akses, foto_url = EXCLUDED.foto_url;\n\n`;
  }

  // 5. Skema & Data Kas RT
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `-- 5. TABEL: kas_rt (Buku Mutasi Transaksi Kas RT)\n`;
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `CREATE TABLE IF NOT EXISTS kas_rt (\n`;
  sql += `  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n`;
  sql += `  tanggal DATE NOT NULL,\n`;
  sql += `  jenis TEXT NOT NULL CHECK (jenis IN ('Masuk', 'Keluar')),\n`;
  sql += `  kategori TEXT NOT NULL,\n`;
  sql += `  jumlah NUMERIC NOT NULL,\n`;
  sql += `  keterangan TEXT NOT NULL,\n`;
  sql += `  warga_id UUID REFERENCES data_warga(id) ON DELETE SET NULL,\n`;
  sql += `  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())\n`;
  sql += `);\n\n`;
  sql += `ALTER TABLE kas_rt ENABLE ROW LEVEL SECURITY;\n`;
  sql += `DROP POLICY IF EXISTS "Akses Publik Kas RT" ON kas_rt;\n`;
  sql += `CREATE POLICY "Akses Publik Kas RT" ON kas_rt FOR ALL USING (true) WITH CHECK (true);\n\n`;

  if (transactions && transactions.length > 0) {
    sql += `-- Data Transaksi Kas RT (${transactions.length} mutasi)\n`;
    sql += `INSERT INTO kas_rt (id, tanggal, jenis, kategori, jumlah, keterangan, warga_id, created_at) VALUES\n`;
    const kasValues = transactions.map((t) => {
      const idVal = t.id && isUuid(t.id) ? `'${t.id}'` : 'gen_random_uuid()';
      const tgl = t.date || new Date().toISOString().split('T')[0];
      const jenis = t.type === 'Keluar' ? 'Keluar' : 'Masuk';
      const kat = (t.category || 'Umum').replace(/'/g, "''");
      const jml = Number(t.amount) || 0;
      const ket = (t.description || '').replace(/'/g, "''");
      const wId = t.wargaId && isUuid(t.wargaId) ? `'${t.wargaId}'` : 'NULL';
      const crt = t.createdAt ? `'${new Date(t.createdAt).toISOString()}'` : 'now()';
      return `  (${idVal}, '${tgl}', '${jenis}', '${kat}', ${jml}, '${ket}', ${wId}, ${crt})`;
    });
    sql += kasValues.join(',\n') + ';\n\n';
  }

  // 6. Skema & Data Darurat / SOS
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `-- 6. TABEL: darurat_rt (Peringatan & Alarm Darurat SOS Warga)\n`;
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `CREATE TABLE IF NOT EXISTS darurat_rt (\n`;
  sql += `  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n`;
  sql += `  id_warga UUID NOT NULL,\n`;
  sql += `  nama_warga TEXT NOT NULL,\n`;
  sql += `  alamat TEXT NOT NULL,\n`;
  sql += `  no_hp TEXT,\n`;
  sql += `  tipe_darurat TEXT NOT NULL,\n`;
  sql += `  status TEXT NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Selesai')),\n`;
  sql += `  keterangan TEXT,\n`;
  sql += `  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL\n`;
  sql += `);\n\n`;
  sql += `ALTER TABLE darurat_rt ENABLE ROW LEVEL SECURITY;\n`;
  sql += `DROP POLICY IF EXISTS "Akses Publik Darurat RT" ON darurat_rt;\n`;
  sql += `CREATE POLICY "Akses Publik Darurat RT" ON darurat_rt FOR ALL USING (true) WITH CHECK (true);\n\n`;

  if (darurat && darurat.length > 0) {
    sql += `-- Data Log Darurat SOS (${darurat.length} peringatan)\n`;
    sql += `INSERT INTO darurat_rt (id, id_warga, nama_warga, alamat, no_hp, tipe_darurat, status, keterangan, created_at) VALUES\n`;
    const daruratValues = darurat.map((d) => {
      const idVal = d.id && isUuid(d.id) ? `'${d.id}'` : 'gen_random_uuid()';
      const wId = d.id_warga && isUuid(d.id_warga) ? `'${d.id_warga}'` : `'00000000-0000-0000-0000-000000000000'`;
      const nama = (d.nama_warga || 'Warga').replace(/'/g, "''");
      const alm = (d.alamat || '-').replace(/'/g, "''");
      const hp = d.no_hp ? `'${d.no_hp.replace(/'/g, "''")}'` : 'NULL';
      const tipe = (d.tipe_darurat || 'Lainnya').replace(/'/g, "''");
      const st = d.status === 'Selesai' ? 'Selesai' : 'Aktif';
      const ket = d.keterangan ? `'${d.keterangan.replace(/'/g, "''")}'` : 'NULL';
      const crt = d.created_at ? `'${d.created_at}'` : 'now()';
      return `  (${idVal}, ${wId}, '${nama}', '${alm}', ${hp}, '${tipe}', '${st}', ${ket}, ${crt})`;
    });
    sql += daruratValues.join(',\n') + ';\n\n';
  }

  // 7. Skema & Data Inventaris RT
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `-- 7. TABEL: inventaris_rt (Master Aset & Barang Milik RT)\n`;
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `CREATE TABLE IF NOT EXISTS inventaris_rt (\n`;
  sql += `  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n`;
  sql += `  nama_barang TEXT NOT NULL,\n`;
  sql += `  jumlah_total INTEGER NOT NULL DEFAULT 1,\n`;
  sql += `  jumlah_baik INTEGER NOT NULL DEFAULT 1,\n`;
  sql += `  jumlah_rusak INTEGER NOT NULL DEFAULT 0,\n`;
  sql += `  kondisi TEXT,\n`;
  sql += `  lokasi_penyimpanan TEXT,\n`;
  sql += `  catatan TEXT,\n`;
  sql += `  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL\n`;
  sql += `);\n\n`;
  sql += `ALTER TABLE inventaris_rt ENABLE ROW LEVEL SECURITY;\n`;
  sql += `DROP POLICY IF EXISTS "Akses Publik Inventaris RT" ON inventaris_rt;\n`;
  sql += `CREATE POLICY "Akses Publik Inventaris RT" ON inventaris_rt FOR ALL USING (true) WITH CHECK (true);\n\n`;

  if (inventaris && inventaris.length > 0) {
    sql += `-- Data Inventaris Barang RT (${inventaris.length} barang)\n`;
    sql += `INSERT INTO inventaris_rt (id, nama_barang, jumlah_total, jumlah_baik, jumlah_rusak, kondisi, lokasi_penyimpanan, catatan, created_at) VALUES\n`;
    const invValues = inventaris.map((i) => {
      const idVal = i.id && isUuid(i.id) ? `'${i.id}'` : 'gen_random_uuid()';
      const nama = (i.nama_barang || i.nama || 'Barang').replace(/'/g, "''");
      const tot = Number(i.jumlah_total) || 1;
      const baik = Number(i.jumlah_baik) || 1;
      const rusak = Number(i.jumlah_rusak) || 0;
      const kon = i.kondisi ? `'${i.kondisi.replace(/'/g, "''")}'` : `'Baik'`;
      const lok = i.lokasi_penyimpanan ? `'${i.lokasi_penyimpanan.replace(/'/g, "''")}'` : 'NULL';
      const cat = i.catatan ? `'${i.catatan.replace(/'/g, "''")}'` : 'NULL';
      const crt = i.created_at ? `'${i.created_at}'` : 'now()';
      return `  (${idVal}, '${nama}', ${tot}, ${baik}, ${rusak}, ${kon}, ${lok}, ${cat}, ${crt})`;
    });
    sql += invValues.join(',\n') + ';\n\n';
  }

  // 8. Skema & Data Log Peminjaman Aset RT
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `-- 8. TABEL: peminjaman_aset_rt (Log Transaksi Peminjaman Aset Warga)\n`;
  sql += `-- -----------------------------------------------------------------------------\n`;
  sql += `CREATE TABLE IF NOT EXISTS peminjaman_aset_rt (\n`;
  sql += `  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n`;
  sql += `  id_barang UUID NOT NULL REFERENCES inventaris_rt(id) ON DELETE CASCADE,\n`;
  sql += `  id_warga UUID NOT NULL,\n`;
  sql += `  tanggal_pinjam DATE NOT NULL,\n`;
  sql += `  tanggal_kembali DATE,\n`;
  sql += `  jumlah_pinjam INTEGER NOT NULL DEFAULT 1,\n`;
  sql += `  keperluan TEXT,\n`;
  sql += `  status TEXT NOT NULL CHECK (status IN ('Dipinjam', 'Kembali')),\n`;
  sql += `  catatan TEXT,\n`;
  sql += `  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL\n`;
  sql += `);\n\n`;
  sql += `ALTER TABLE peminjaman_aset_rt ENABLE ROW LEVEL SECURITY;\n`;
  sql += `DROP POLICY IF EXISTS "Akses Publik Peminjaman Aset RT" ON peminjaman_aset_rt;\n`;
  sql += `CREATE POLICY "Akses Publik Peminjaman Aset RT" ON peminjaman_aset_rt FOR ALL USING (true) WITH CHECK (true);\n\n`;

  if (peminjaman && peminjaman.length > 0) {
    sql += `-- Data Log Peminjaman Aset (${peminjaman.length} log)\n`;
    sql += `INSERT INTO peminjaman_aset_rt (id, id_barang, id_warga, tanggal_pinjam, tanggal_kembali, jumlah_pinjam, keperluan, status, catatan, created_at) VALUES\n`;
    const pinjamValues = peminjaman.map((p) => {
      const idVal = p.id && isUuid(p.id) ? `'${p.id}'` : 'gen_random_uuid()';
      const bId = p.id_barang && isUuid(p.id_barang) ? `'${p.id_barang}'` : 'NULL';
      const wId = p.id_warga && isUuid(p.id_warga) ? `'${p.id_warga}'` : 'NULL';
      const tglPinjam = p.tanggal_pinjam || new Date().toISOString().split('T')[0];
      const tglKembali = p.tanggal_kembali ? `'${p.tanggal_kembali}'` : 'NULL';
      const jml = Number(p.jumlah_pinjam) || 1;
      const kep = p.keperluan ? `'${p.keperluan.replace(/'/g, "''")}'` : 'NULL';
      const st = p.status === 'Kembali' ? 'Kembali' : 'Dipinjam';
      const cat = p.catatan ? `'${p.catatan.replace(/'/g, "''")}'` : 'NULL';
      const crt = p.created_at ? `'${p.created_at}'` : 'now()';
      return `  (${idVal}, ${bId}, ${wId}, '${tglPinjam}', ${tglKembali}, ${jml}, ${kep}, '${st}', ${cat}, ${crt})`;
    });
    sql += pinjamValues.join(',\n') + ';\n\n';
  }

  let filenameSuffix = 'Semua_8_Tabel';
  if (scope.type === 'monthly') {
    const cleanLabel = scope.periodLabel.replace(/[^a-zA-Z0-9]/g, '_');
    filenameSuffix = cleanLabel || `Bulan_${scope.selectedMonth}_${scope.selectedYear}`;
  }

  const rtPart = sekFirst?.rt ? `_RT${sekFirst.rt}` : '';
  const rwPart = sekFirst?.rw ? `_RW${sekFirst.rw}` : '';
  const defaultFilename = `Backup_8_Tabel_Supabase${rtPart}${rwPart}_${filenameSuffix}_${dateStr}.sql`;

  return { sqlString: sql, defaultFilename };
}

/**
 * Download file di browser
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Membersihkan nilai argumen SQL (menghilangkan kutip luar, spasi, atau NULL)
 */
function cleanRawArg(val: string): string {
  const trimmed = val.trim();
  if (trimmed.toUpperCase() === 'NULL') {
    return '';
  }
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Mem-parse argumen dalam 1 tuple SQL: "('val1', 123, 'val\'s', NULL)"
 */
function parseSQLTupleArgs(rawTuple: string): string[] {
  const args: string[] = [];
  let current = '';
  let inString = false;
  let quoteChar = '';

  for (let i = 0; i < rawTuple.length; i++) {
    const ch = rawTuple[i];

    if (inString) {
      if (ch === '\\' && i + 1 < rawTuple.length) {
        const nextChar = rawTuple[i + 1];
        if (nextChar === "'" || nextChar === '"' || nextChar === '\\') {
          current += nextChar;
          i++;
          continue;
        } else if (nextChar === 'n') {
          current += '\n';
          i++;
          continue;
        } else if (nextChar === 'r') {
          current += '\r';
          i++;
          continue;
        } else if (nextChar === 't') {
          current += '\t';
          i++;
          continue;
        }
      }

      if (ch === quoteChar) {
        if (i + 1 < rawTuple.length && rawTuple[i + 1] === quoteChar) {
          current += quoteChar;
          i++;
          continue;
        } else {
          inString = false;
          continue;
        }
      }

      current += ch;
    } else {
      if (ch === "'" || ch === '"') {
        inString = true;
        quoteChar = ch;
      } else if (ch === ',') {
        args.push(cleanRawArg(current));
        current = '';
      } else {
        current += ch;
      }
    }
  }

  args.push(cleanRawArg(current));
  return args;
}

/**
 * Mengekstrak seluruh row tuple dari pernyataan INSERT INTO untuk tabel tertentu
 */
function parseInsertRows(
  sqlText: string,
  targetTable: string
): { columns: string[] | null; rows: string[][] }[] {
  const results: { columns: string[] | null; rows: string[][] }[] = [];

  const insertRegex = new RegExp(
    `(?:INSERT\\s+(?:OR\\s+IGNORE\\s+|IGNORE\\s+)?INTO|REPLACE\\s+INTO)\\s+(?:[\`"]?\\w+[\`"]?\\.)?[\`"]?${targetTable}[\`"]?\\s*(?:\\(([^)]+)\\))?\\s*VALUES`,
    'gi'
  );

  let match: RegExpExecArray | null;
  while ((match = insertRegex.exec(sqlText)) !== null) {
    const rawCols = match[1];
    let columns: string[] | null = null;
    if (rawCols) {
      columns = rawCols
        .split(',')
        .map((c) => c.replace(/[\`"'\s]/g, '').toLowerCase());
    }

    const startIndex = insertRegex.lastIndex;
    let i = startIndex;
    const rows: string[][] = [];

    let inString = false;
    let quoteChar = '';
    let parenDepth = 0;
    let tupleStartIndex = -1;

    while (i < sqlText.length) {
      const ch = sqlText[i];

      // Abaikan komentar baris tunggal --
      if (!inString && ch === '-' && i + 1 < sqlText.length && sqlText[i + 1] === '-') {
        const nextNewline = sqlText.indexOf('\n', i + 2);
        if (nextNewline === -1) {
          i = sqlText.length;
        } else {
          i = nextNewline;
        }
        continue;
      }

      // Abaikan komentar blok /* ... */
      if (!inString && ch === '/' && i + 1 < sqlText.length && sqlText[i + 1] === '*') {
        const endBlock = sqlText.indexOf('*/', i + 2);
        if (endBlock === -1) {
          i = sqlText.length;
        } else {
          i = endBlock + 1;
        }
        continue;
      }

      // Selesai jika menemukan titik koma atau klausa penghenti di luar kurung/string
      if (!inString && parenDepth === 0) {
        if (ch === ';') {
          break;
        }
        const remaining = sqlText.substring(i, i + 25).toUpperCase();
        if (
          remaining.startsWith('ON CONFLICT') ||
          remaining.startsWith('ON DUPLICATE') ||
          remaining.startsWith('INSERT INTO') ||
          remaining.startsWith('REPLACE INTO')
        ) {
          break;
        }
      }

      if (inString) {
        if (ch === '\\' && i + 1 < sqlText.length) {
          i += 2;
          continue;
        }
        if (ch === quoteChar) {
          if (i + 1 < sqlText.length && sqlText[i + 1] === quoteChar) {
            i += 2;
            continue;
          } else {
            inString = false;
          }
        }
      } else {
        if (ch === "'" || ch === '"') {
          inString = true;
          quoteChar = ch;
        } else if (ch === '(') {
          if (parenDepth === 0) {
            tupleStartIndex = i + 1;
          }
          parenDepth++;
        } else if (ch === ')') {
          parenDepth--;
          if (parenDepth === 0 && tupleStartIndex !== -1) {
            const rawTuple = sqlText.substring(tupleStartIndex, i);
            const tupleArgs = parseSQLTupleArgs(rawTuple);
            if (tupleArgs.length > 0) {
              rows.push(tupleArgs);
            }
            tupleStartIndex = -1;
          }
        }
      }
      i++;
    }

    if (rows.length > 0) {
      results.push({ columns, rows });
    }
  }

  return results;
}

/**
 * Parse file backup dalam format Script SQL (PostgreSQL / Supabase / MySQL) untuk 8 tabel
 */
export function parseSQLBackup(sqlText: string, filename: string = 'backup.sql'): BackupData {
  const trimmed = sqlText.trim();

  let appName = 'Kas RT';
  let wilayah = '';
  let backupTimestamp = new Date().toISOString();
  let scopeLabel = 'Semua Riwayat Data Transaksi (SQL Dump)';
  let scopeType: 'all' | 'monthly' = 'all';

  const wilayahMatch = trimmed.match(/--\s*Wilayah:\s*([^\r\n]+)/i);
  if (wilayahMatch && wilayahMatch[1]) {
    wilayah = wilayahMatch[1].trim();
  }

  const tglMatch = trimmed.match(/--\s*(?:Tanggal Backup|Tanggal Pembuatan):\s*([^\r\n]+)/i);
  if (tglMatch && tglMatch[1]) {
    backupTimestamp = tglMatch[1].trim();
  }

  const cakupanMatch = trimmed.match(/--\s*Cakupan:\s*([^\r\n(]+)/i);
  if (cakupanMatch && cakupanMatch[1]) {
    scopeLabel = cakupanMatch[1].trim();
    if (/Bulan/i.test(scopeLabel)) {
      scopeType = 'monthly';
    }
  }

  // 1. Ekstrak data transaksi kas_rt
  const kasStatements = parseInsertRows(trimmed, 'kas_rt');
  const transactions: Transaction[] = [];

  kasStatements.forEach((stmt) => {
    const { columns, rows } = stmt;

    rows.forEach((row, rowIdx) => {
      let rawId = '';
      let rawDate = '';
      let rawType = '';
      let rawCategory = '';
      let rawAmount = '';
      let rawDesc = '';
      let rawWargaId = '';
      let rawCreatedAt = '';

      if (columns && columns.length > 0) {
        const colMap: Record<string, string> = {};
        columns.forEach((col, cIdx) => {
          if (cIdx < row.length) {
            colMap[col.toLowerCase()] = row[cIdx];
          }
        });

        rawId = colMap['id'] || colMap['tx_id'] || '';
        rawDate = colMap['tanggal'] || colMap['date'] || colMap['tgl'] || '';
        rawType = colMap['jenis'] || colMap['type'] || colMap['tipe'] || '';
        rawCategory = colMap['kategori'] || colMap['category'] || '';
        rawAmount = colMap['jumlah'] || colMap['amount'] || colMap['nominal'] || '0';
        rawDesc = colMap['keterangan'] || colMap['description'] || colMap['deskripsi'] || colMap['uraian'] || '';
        rawWargaId = colMap['warga_id'] || colMap['wargaid'] || '';
        rawCreatedAt = colMap['created_at'] || colMap['createdat'] || '';
      } else {
        if (row.length >= 8) {
          rawId = row[0];
          rawDate = row[1];
          rawType = row[2];
          rawCategory = row[3];
          rawAmount = row[4];
          rawDesc = row[5];
          rawWargaId = row[6];
          rawCreatedAt = row[7];
        } else if (row.length === 7) {
          rawId = row[0];
          rawDate = row[1];
          rawType = row[2];
          rawCategory = row[3];
          rawAmount = row[4];
          rawDesc = row[5];
          rawCreatedAt = row[6];
        } else if (row.length === 6) {
          if (row[1] && /\d{4}-\d{2}-\d{2}/.test(row[1])) {
            rawId = row[0];
            rawDate = row[1];
            rawType = row[2];
            rawCategory = row[3];
            rawAmount = row[4];
            rawDesc = row[5];
          } else {
            rawDate = row[0];
            rawType = row[1];
            rawCategory = row[2];
            rawAmount = row[3];
            rawDesc = row[4];
            rawCreatedAt = row[5];
          }
        } else if (row.length >= 5) {
          rawDate = row[0];
          rawType = row[1];
          rawCategory = row[2];
          rawAmount = row[3];
          rawDesc = row[4];
        }
      }

      let id = rawId.trim();
      if (!id || id.toLowerCase() === 'gen_random_uuid()' || id.toLowerCase() === 'default' || id.toLowerCase() === 'null') {
        id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `IMP-${Date.now()}-${rowIdx}`;
      }

      let date = new Date().toISOString().split('T')[0];
      const dateMatch = rawDate.match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) {
        date = dateMatch[0];
      }

      const type: TransactionType = /keluar/i.test(rawType) ? 'Keluar' : 'Masuk';
      const category = rawCategory.trim() || 'Umum';
      const cleanNum = rawAmount.replace(/[^0-9.-]/g, '');
      const amount = Math.abs(Number(cleanNum)) || 0;
      const description = rawDesc;

      let createdAt = Date.now();
      if (rawCreatedAt) {
        const parsedTime = new Date(rawCreatedAt).getTime();
        if (!isNaN(parsedTime)) {
          createdAt = parsedTime;
        } else {
          createdAt = new Date(date).getTime();
        }
      } else {
        createdAt = new Date(date).getTime();
      }

      const wargaId = rawWargaId && isUuid(rawWargaId) ? rawWargaId : undefined;

      transactions.push({
        id,
        date,
        type,
        category,
        amount,
        description,
        status: 'Synced',
        wargaId,
        createdAt,
      });
    });
  });

  // 2. Ekstrak data master kategori
  const catStatements = parseInsertRows(trimmed, 'kategori');
  const categories: CategoryItem[] = [];

  catStatements.forEach((stmt) => {
    const { columns, rows } = stmt;

    rows.forEach((row, catIdx) => {
      let rawId = '';
      let rawName = '';
      let rawType = '';
      let rawDesc = '';
      let rawWajib = '';
      let rawNominal = '';
      let rawCreatedAt = '';

      if (columns && columns.length > 0) {
        const colMap: Record<string, string> = {};
        columns.forEach((col, cIdx) => {
          if (cIdx < row.length) {
            colMap[col.toLowerCase()] = row[cIdx];
          }
        });
        rawId = colMap['id'] || '';
        rawName = colMap['nama'] || colMap['name'] || '';
        rawType = colMap['jenis'] || colMap['type'] || 'Masuk';
        rawDesc = colMap['deskripsi'] || colMap['description'] || '';
        rawWajib = colMap['wajib'] || '';
        rawNominal = colMap['nominal'] || '';
        rawCreatedAt = colMap['created_at'] || colMap['createdat'] || '';
      } else {
        if (row.length === 3) {
          rawName = row[0];
          rawType = row[1];
          rawDesc = row[2];
        } else if (row.length === 4) {
          rawId = row[0];
          rawName = row[1];
          rawType = row[2];
          rawDesc = row[3];
        } else if (row.length >= 7) {
          rawId = row[0];
          rawName = row[1];
          rawType = row[2];
          rawDesc = row[3];
          rawWajib = row[4];
          rawNominal = row[5];
          rawCreatedAt = row[6];
        }
      }

      if (rawName.trim()) {
        const isWajib = rawWajib === 'true' || rawWajib === 'Y' || rawWajib === 'Yes' || String(rawWajib).toLowerCase() === 'true';
        categories.push({
          id: rawId && isUuid(rawId) ? rawId : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cat-${Date.now()}-${catIdx}`),
          name: rawName.trim(),
          type: /keluar/i.test(rawType) ? 'Keluar' : 'Masuk',
          description: rawDesc.trim(),
          wajib: isWajib,
          nominal: rawNominal ? (Number(rawNominal) || 0) : 0,
          createdAt: rawCreatedAt && !isNaN(new Date(rawCreatedAt).getTime()) ? new Date(rawCreatedAt).toISOString() : new Date().toISOString(),
        });
      }
    });
  });

  // 3. Ekstrak data pengguna / pengurus
  const pengurusStatements = [
    ...parseInsertRows(trimmed, 'pengguna'),
    ...parseInsertRows(trimmed, 'pengurus'),
  ];
  const pengurus: any[] = [];
  pengurusStatements.forEach((stmt) => {
    const { columns, rows } = stmt;
    rows.forEach((row, pIdx) => {
      if (columns && columns.length > 0) {
        const colMap: Record<string, string> = {};
        columns.forEach((col, cIdx) => {
          if (cIdx < row.length) {
            colMap[col.toLowerCase()] = row[cIdx];
          }
        });
        pengurus.push({
          id: colMap['id'] || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pengurus-${Date.now()}-${pIdx}`),
          nama: colMap['nama'] || colMap['name'] || 'Pengurus',
          email: colMap['email'] || '',
          password: colMap['password'] || 'admin123',
          jabatan: colMap['jabatan'] || colMap['role'] || 'Pengurus',
          level_akses: colMap['level_akses'] || colMap['levelakses'] || 'User',
          no_hp: colMap['no_hp'] || colMap['nohp'] || null,
          no_kk: colMap['no_kk'] || colMap['nokk'] || null,
          warga_id: colMap['warga_id'] || colMap['wargaid'] || null,
          nik: colMap['nik'] || null,
          alamat_domisili: colMap['alamat_domisili'] || colMap['alamat'] || null,
          foto_url: colMap['foto_url'] || colMap['fotourl'] || null,
          created_at: colMap['created_at'] || new Date().toISOString(),
        });
      }
    });
  });

  // 4. Ekstrak data data_warga
  const dataWargaStatements = parseInsertRows(trimmed, 'data_warga');
  const dataWarga: any[] = [];
  dataWargaStatements.forEach((stmt) => {
    const { columns, rows } = stmt;
    rows.forEach((row, wIdx) => {
      if (columns && columns.length > 0) {
        const colMap: Record<string, string> = {};
        columns.forEach((col, cIdx) => {
          if (cIdx < row.length) {
            colMap[col.toLowerCase()] = row[cIdx];
          }
        });
        dataWarga.push({
          id: colMap['id'] || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `warga-${Date.now()}-${wIdx}`),
          no_kk: colMap['no_kk'] || colMap['nokk'] || '',
          nik: colMap['nik'] || '',
          nama_lengkap: colMap['nama_lengkap'] || colMap['nama'] || '',
          jenis_kelamin: colMap['jenis_kelamin'] || 'Laki-laki',
          tempat_lahir: colMap['tempat_lahir'] || null,
          tanggal_lahir: colMap['tanggal_lahir'] || null,
          agama: colMap['agama'] || 'Islam',
          pendidikan: colMap['pendidikan'] || null,
          pekerjaan: colMap['pekerjaan'] || null,
          status_perkawinan: colMap['status_perkawinan'] || 'Belum Kawin',
          alamat_domisili: colMap['alamat_domisili'] || colMap['alamat'] || '',
          no_hp: colMap['no_hp'] || colMap['nohp'] || null,
          status_warga: colMap['status_warga'] || 'Warga Tetap',
          catatan: colMap['catatan'] || null,
          created_at: colMap['created_at'] || new Date().toISOString(),
        });
      }
    });
  });

  // 5. Ekstrak data sekretariat
  let sekretariat: SekretariatItem[] = [];
  const sekStatements = parseInsertRows(trimmed, 'sekretariat');
  sekStatements.forEach((stmt) => {
    const { columns, rows } = stmt;
    rows.forEach((row) => {
      if (columns && columns.length > 0) {
        const colMap: Record<string, string> = {};
        columns.forEach((col, idx) => {
          if (idx < row.length) {
            colMap[col.toLowerCase()] = row[idx];
          }
        });
        sekretariat.push({
          rt: colMap['rt'] || '',
          rw: colMap['rw'] || '',
          kelurahan: colMap['kelurahan'] || '',
          kecamatan: colMap['kecamatan'] || '',
          alamat: colMap['alamat'] || '',
        });
      }
    });
  });

  // 6. Ekstrak data inventaris_rt
  const invStatements = parseInsertRows(trimmed, 'inventaris_rt');
  const inventaris: any[] = [];
  invStatements.forEach((stmt) => {
    const { columns, rows } = stmt;
    rows.forEach((row, iIdx) => {
      if (columns && columns.length > 0) {
        const colMap: Record<string, string> = {};
        columns.forEach((col, cIdx) => {
          if (cIdx < row.length) colMap[col.toLowerCase()] = row[cIdx];
        });
        inventaris.push({
          id: colMap['id'] || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `inv-${Date.now()}-${iIdx}`),
          nama_barang: colMap['nama_barang'] || colMap['nama'] || 'Barang',
          jumlah_total: Number(colMap['jumlah_total']) || 1,
          jumlah_baik: Number(colMap['jumlah_baik']) || 1,
          jumlah_rusak: Number(colMap['jumlah_rusak']) || 0,
          kondisi: colMap['kondisi'] || 'Baik',
          lokasi_penyimpanan: colMap['lokasi_penyimpanan'] || null,
          catatan: colMap['catatan'] || null,
          created_at: colMap['created_at'] || new Date().toISOString(),
        });
      }
    });
  });

  // 7. Ekstrak data peminjaman_aset_rt
  const pinjamStatements = parseInsertRows(trimmed, 'peminjaman_aset_rt');
  const peminjaman: any[] = [];
  pinjamStatements.forEach((stmt) => {
    const { columns, rows } = stmt;
    rows.forEach((row, pIdx) => {
      if (columns && columns.length > 0) {
        const colMap: Record<string, string> = {};
        columns.forEach((col, cIdx) => {
          if (cIdx < row.length) colMap[col.toLowerCase()] = row[cIdx];
        });
        peminjaman.push({
          id: colMap['id'] || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `loan-${Date.now()}-${pIdx}`),
          id_barang: colMap['id_barang'] || '',
          id_warga: colMap['id_warga'] || '',
          tanggal_pinjam: colMap['tanggal_pinjam'] || new Date().toISOString().split('T')[0],
          tanggal_kembali: colMap['tanggal_kembali'] || null,
          jumlah_pinjam: Number(colMap['jumlah_pinjam']) || 1,
          keperluan: colMap['keperluan'] || null,
          status: colMap['status'] === 'Kembali' ? 'Kembali' : 'Dipinjam',
          catatan: colMap['catatan'] || null,
          created_at: colMap['created_at'] || new Date().toISOString(),
        });
      }
    });
  });

  // 8. Ekstrak data darurat_rt
  const daruratStatements = parseInsertRows(trimmed, 'darurat_rt');
  const darurat: any[] = [];
  daruratStatements.forEach((stmt) => {
    const { columns, rows } = stmt;
    rows.forEach((row, dIdx) => {
      if (columns && columns.length > 0) {
        const colMap: Record<string, string> = {};
        columns.forEach((col, cIdx) => {
          if (cIdx < row.length) colMap[col.toLowerCase()] = row[cIdx];
        });
        darurat.push({
          id: colMap['id'] || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sos-${Date.now()}-${dIdx}`),
          id_warga: colMap['id_warga'] || '00000000-0000-0000-0000-000000000000',
          nama_warga: colMap['nama_warga'] || 'Warga',
          alamat: colMap['alamat'] || '-',
          no_hp: colMap['no_hp'] || null,
          tipe_darurat: colMap['tipe_darurat'] || 'Lainnya',
          status: colMap['status'] === 'Selesai' ? 'Selesai' : 'Aktif',
          keterangan: colMap['keterangan'] || null,
          created_at: colMap['created_at'] || new Date().toISOString(),
        });
      }
    });
  });

  let totalMasuk = 0;
  let totalKeluar = 0;
  transactions.forEach((t) => {
    if (t.type === 'Masuk') totalMasuk += t.amount;
    else totalKeluar += t.amount;
  });

  return {
    appName,
    wilayah,
    version: '3.0',
    backupTimestamp,
    scopeType,
    scopeLabel,
    selectedMonth: 'all',
    selectedYear: 'all',
    formatSource: 'sql',
    summary: {
      totalKasMasuk: totalMasuk,
      totalKasKeluar: totalKeluar,
      saldoBersih: totalMasuk - totalKeluar,
      transactionCount: transactions.length,
      categoryCount: categories.length,
      pengurusCount: pengurus.length,
      dataWargaCount: dataWarga.length,
      sekretariatCount: sekretariat.length,
      inventarisCount: inventaris.length,
      peminjamanCount: peminjaman.length,
      daruratCount: darurat.length,
      totalTables: 8,
    },
    tables: {
      kas_rt: transactions,
      kategori: categories,
      pengurus,
      pengguna: pengurus,
      data_warga: dataWarga,
      sekretariat,
      inventaris_rt: inventaris,
      peminjaman_aset_rt: peminjaman,
      darurat_rt: darurat,
    },
    categories,
    transactions,
    pengurus,
    pengguna: pengurus,
    data_warga: dataWarga,
    sekretariat,
    inventaris,
    inventaris_rt: inventaris,
    peminjaman,
    peminjaman_aset_rt: peminjaman,
    darurat,
    darurat_rt: darurat,
  };
}

/**
 * Parse & Validasi File Backup (.json atau .sql)
 */
export async function parseBackupFile(file: File): Promise<BackupData> {
  const text = await file.text();
  const trimmed = text.trim();
  const filenameLower = (file.name || '').toLowerCase();

  const isSql =
    filenameLower.endsWith('.sql') ||
    trimmed.startsWith('--') ||
    /INSERT\s+(?:OR\s+IGNORE\s+|IGNORE\s+)?INTO\s+[`"]?(?:kas_rt|kategori|pengguna|pengurus|data_warga|inventaris_rt|peminjaman_aset_rt|darurat_rt|sekretariat)[`"]?/i.test(trimmed);

  if (isSql) {
    return parseSQLBackup(trimmed, file.name);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err: any) {
    if (/INSERT\s+(?:OR\s+IGNORE\s+|IGNORE\s+)?INTO/i.test(trimmed)) {
      return parseSQLBackup(trimmed, file.name);
    }
    throw new Error('File tidak valid: Format bukan JSON atau file dump SQL (.sql) yang benar.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('File tidak memuat struktur objek data yang sesuai.');
  }

  const rawTransactions = parsed.transactions || parsed.transaksi || parsed.tables?.kas_rt || [];
  const normalizedTransactions: Transaction[] = Array.isArray(rawTransactions)
    ? rawTransactions.map((tx: any, idx: number) => {
        const id = tx.id ? String(tx.id) : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `IMP-${Date.now()}-${idx}`);
        const date = tx.date || tx.tanggal || new Date().toISOString().split('T')[0];
        const rawType = tx.type || tx.jenis || 'Masuk';
        const type: TransactionType = rawType === 'Keluar' || /keluar/i.test(rawType) ? 'Keluar' : 'Masuk';
        const category = tx.category || tx.kategori || 'Umum';
        const amount = Number(tx.amount || tx.jumlah) || 0;
        const description = tx.description || tx.keterangan || '';
        const status = tx.status || 'Synced';
        const createdAt = tx.createdAt || (tx.created_at ? new Date(tx.created_at).getTime() : Date.now());
        const wargaId = tx.wargaId || tx.warga_id || undefined;

        return {
          id,
          date,
          type,
          category,
          amount,
          description,
          status,
          wargaId,
          createdAt,
        };
      })
    : [];

  const rawCategories = parsed.categories || parsed.kategori || parsed.tables?.kategori || [];
  const normalizedCategories: CategoryItem[] = Array.isArray(rawCategories)
    ? rawCategories.map((c: any, idx: number) => ({
        id: c.id ? String(c.id) : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cat-${Date.now()}-${idx}`),
        name: String(c.name || c.nama || 'Umum').trim(),
        type: (c.type === 'Keluar' || c.jenis === 'Keluar') ? 'Keluar' : 'Masuk',
        description: String(c.description || c.deskripsi || ''),
        wajib: c.wajib === true || c.wajib === 'Y' || c.wajib === 'Yes' || String(c.wajib).toLowerCase() === 'true',
        nominal: typeof c.nominal === 'number' ? c.nominal : (Number(c.nominal) || 0),
        createdAt: c.createdAt || c.created_at || new Date().toISOString(),
      }))
    : [];

  const rawPengurus = parsed.pengguna || parsed.pengurus || parsed.tables?.pengguna || parsed.tables?.pengurus || [];
  const normalizedPengurus: any[] = Array.isArray(rawPengurus) ? rawPengurus : [];

  const rawDataWarga = parsed.data_warga || parsed.dataWarga || parsed.tables?.data_warga || [];
  const normalizedDataWarga: any[] = Array.isArray(rawDataWarga) ? rawDataWarga : [];

  const rawSekretariat = parsed.sekretariat || parsed.tables?.sekretariat || [];
  const normalizedSekretariat: any[] = Array.isArray(rawSekretariat)
    ? rawSekretariat
    : rawSekretariat && typeof rawSekretariat === 'object'
    ? [rawSekretariat]
    : [];

  const rawInventaris = parsed.inventaris || parsed.inventaris_rt || parsed.tables?.inventaris_rt || [];
  const normalizedInventaris: any[] = Array.isArray(rawInventaris) ? rawInventaris : [];

  const rawPeminjaman = parsed.peminjaman || parsed.peminjaman_aset_rt || parsed.tables?.peminjaman_aset_rt || [];
  const normalizedPeminjaman: any[] = Array.isArray(rawPeminjaman) ? rawPeminjaman : [];

  const rawDarurat = parsed.darurat || parsed.darurat_rt || parsed.tables?.darurat_rt || [];
  const normalizedDarurat: any[] = Array.isArray(rawDarurat) ? rawDarurat : [];

  let totalMasuk = 0;
  let totalKeluar = 0;
  normalizedTransactions.forEach((tx) => {
    if (tx.type === 'Masuk') totalMasuk += tx.amount;
    else totalKeluar += tx.amount;
  });

  const jsonSekFirst = normalizedSekretariat.length > 0 ? normalizedSekretariat[0] : null;

  return {
    appName: parsed.appName || parsed.aplikasi || (jsonSekFirst?.rt && jsonSekFirst?.rw ? `Kas RT.${jsonSekFirst.rt} RW.${jsonSekFirst.rw}` : 'Kas RT'),
    wilayah: parsed.wilayah || '',
    version: parsed.version || '3.0',
    backupTimestamp: parsed.backupTimestamp || parsed.tanggal_ekspor || new Date().toISOString(),
    scopeType: parsed.scopeType || (parsed.cakupan?.includes('Bulan') ? 'monthly' : 'all'),
    scopeLabel: parsed.scopeLabel || parsed.cakupan || 'Semua Data Transaksi',
    selectedMonth: parsed.selectedMonth || 'all',
    selectedYear: parsed.selectedYear || 'all',
    formatSource: 'json',
    summary: {
      totalKasMasuk: totalMasuk,
      totalKasKeluar: totalKeluar,
      saldoBersih: totalMasuk - totalKeluar,
      transactionCount: normalizedTransactions.length,
      categoryCount: normalizedCategories.length,
      pengurusCount: normalizedPengurus.length,
      dataWargaCount: normalizedDataWarga.length,
      sekretariatCount: normalizedSekretariat.length,
      inventarisCount: normalizedInventaris.length,
      peminjamanCount: normalizedPeminjaman.length,
      daruratCount: normalizedDarurat.length,
      totalTables: 8,
    },
    tables: {
      kas_rt: normalizedTransactions,
      kategori: normalizedCategories,
      pengurus: normalizedPengurus,
      pengguna: normalizedPengurus,
      data_warga: normalizedDataWarga,
      sekretariat: normalizedSekretariat,
      inventaris_rt: normalizedInventaris,
      peminjaman_aset_rt: normalizedPeminjaman,
      darurat_rt: normalizedDarurat,
    },
    categories: normalizedCategories,
    transactions: normalizedTransactions,
    pengurus: normalizedPengurus,
    pengguna: normalizedPengurus,
    data_warga: normalizedDataWarga,
    sekretariat: normalizedSekretariat,
    inventaris: normalizedInventaris,
    inventaris_rt: normalizedInventaris,
    peminjaman: normalizedPeminjaman,
    peminjaman_aset_rt: normalizedPeminjaman,
    darurat: normalizedDarurat,
    darurat_rt: normalizedDarurat,
  };
}

/**
 * Eksekusi Pemulihan (Restore) Data untuk 8 Tabel ke Supabase / Local Storage
 */
export async function executeRestoreData(
  backupData: BackupData,
  mode: RestoreMode,
  connectionStatus: 'connected' | 'connecting' | 'error' | 'demo'
): Promise<RestoreResult> {
  const isSupabaseLive = connectionStatus === 'connected' && Boolean(getSupabase());

  if (isSupabaseLive) {
    try {
      // 1. Jika mode 'replace', kosongkan tabel kas_rt, inventaris, peminjaman, darurat
      if (mode === 'replace') {
        await Promise.all([
          clearKasInSupabase().catch(() => {}),
          clearPeminjamanInSupabase().catch(() => {}),
          clearInventarisInSupabase().catch(() => {}),
          clearDaruratInSupabase().catch(() => {}),
        ]);
      }

      // 2. Masukkan data transaksi ke tabel 'kas_rt'
      const insertKasRes = await insertMultipleKasToSupabase(backupData.transactions);

      // 3. Masukkan master kategori
      let restoredCatCount = 0;
      if (backupData.categories && backupData.categories.length > 0) {
        const catRes = await seedInitialCategoriesToSupabase(backupData.categories);
        if (catRes.success) restoredCatCount = catRes.count;
      }

      // 4. Masukkan data warga (agar relasi warga_id valid)
      let restoredDataWargaCount = 0;
      const wList = backupData.data_warga || backupData.tables?.data_warga || [];
      if (wList.length > 0) {
        const wRes = await restoreDataWargaToSupabase(wList);
        if (wRes.success) restoredDataWargaCount = wRes.count;
      }

      // 5. Masukkan data pengurus
      let restoredPengurusCount = 0;
      const pList = backupData.pengurus || backupData.pengguna || backupData.tables?.pengguna || [];
      if (pList.length > 0) {
        const pRes = await restorePengurusToSupabase(pList);
        if (pRes.success) restoredPengurusCount = pRes.count;
      }

      // 6. Masukkan data sekretariat
      let restoredSekretariatCount = 0;
      const sList = backupData.sekretariat || backupData.tables?.sekretariat || [];
      if (sList.length > 0) {
        const sRes = await restoreSekretariatToSupabase(sList);
        if (sRes.success) restoredSekretariatCount = sRes.count;
      }

      // 7. Masukkan data inventaris
      let restoredInventarisCount = 0;
      const invList = backupData.inventaris || backupData.inventaris_rt || backupData.tables?.inventaris_rt || [];
      if (invList.length > 0) {
        const invRes = await restoreInventarisToSupabase(invList);
        if (invRes.success) restoredInventarisCount = invRes.count;
      }

      // 8. Masukkan data peminjaman aset
      let restoredPeminjamanCount = 0;
      const pinjamList = backupData.peminjaman || backupData.peminjaman_aset_rt || backupData.tables?.peminjaman_aset_rt || [];
      if (pinjamList.length > 0) {
        const pinjamRes = await restorePeminjamanToSupabase(pinjamList);
        if (pinjamRes.success) restoredPeminjamanCount = pinjamRes.count;
      }

      // 9. Masukkan data darurat
      let restoredDaruratCount = 0;
      const daruratList = backupData.darurat || backupData.darurat_rt || backupData.tables?.darurat_rt || [];
      if (daruratList.length > 0) {
        const daruratRes = await restoreDaruratToSupabase(daruratList);
        if (daruratRes.success) restoredDaruratCount = daruratRes.count;
      }

      const parts: string[] = [];
      if (insertKasRes.insertedCount > 0) parts.push(`${insertKasRes.insertedCount} transaksi kas`);
      if (restoredCatCount > 0) parts.push(`${restoredCatCount} kategori`);
      if (restoredDataWargaCount > 0) parts.push(`${restoredDataWargaCount} data warga`);
      if (restoredPengurusCount > 0) parts.push(`${restoredPengurusCount} akun pengguna`);
      if (restoredSekretariatCount > 0) parts.push(`${restoredSekretariatCount} sekretariat`);
      if (restoredInventarisCount > 0) parts.push(`${restoredInventarisCount} barang inventaris`);
      if (restoredPeminjamanCount > 0) parts.push(`${restoredPeminjamanCount} log pinjam`);
      if (restoredDaruratCount > 0) parts.push(`${restoredDaruratCount} log darurat`);

      const detailsMsg = parts.length > 0
        ? `Berhasil memulihkan ${parts.join(', ')} ke 8 tabel Supabase.`
        : 'Pemulihan selesai dengan sukses.';

      return {
        success: true,
        restoredTransactionsCount: insertKasRes.insertedCount,
        restoredCategoriesCount: restoredCatCount,
        restoredPengurusCount,
        restoredDataWargaCount,
        restoredSekretariatCount,
        restoredInventarisCount,
        restoredPeminjamanCount,
        restoredDaruratCount,
        mode,
        target: 'supabase',
        details: detailsMsg,
      };
    } catch (err: any) {
      return {
        success: false,
        restoredTransactionsCount: 0,
        restoredCategoriesCount: 0,
        mode,
        target: 'supabase',
        error: err.message || 'Terjadi kesalahan sistem saat pemulihan ke Supabase.',
      };
    }
  } else {
    // Mode Lokal (LocalStorage)
    try {
      let finalTransactions: Transaction[] = [];

      if (mode === 'replace') {
        finalTransactions = backupData.transactions;
      } else {
        const existingRaw = localStorage.getItem('kas_rt_transactions');
        let existing: Transaction[] = [];
        if (existingRaw) {
          try {
            existing = JSON.parse(existingRaw);
          } catch {}
        }
        const existingIds = new Set(existing.map((t) => t.id));
        const newItems = backupData.transactions.filter((t) => !existingIds.has(t.id));
        finalTransactions = [...newItems, ...existing];
      }

      localStorage.setItem('kas_rt_transactions', JSON.stringify(finalTransactions));

      let restoredCatCount = 0;
      if (backupData.categories && backupData.categories.length > 0) {
        localStorage.setItem('kas_rt_categories', JSON.stringify(backupData.categories));
        restoredCatCount = backupData.categories.length;
      }

      let restoredPengurusCount = 0;
      const pList = backupData.pengurus || backupData.pengguna || [];
      if (pList.length > 0) {
        localStorage.setItem('kas_rt_pengurus', JSON.stringify(pList));
        restoredPengurusCount = pList.length;
      }

      let restoredDataWargaCount = 0;
      const wList = backupData.data_warga || [];
      if (wList.length > 0) {
        localStorage.setItem('kas_rt_data_warga', JSON.stringify(wList));
        restoredDataWargaCount = wList.length;
      }

      let restoredSekretariatCount = 0;
      const sList = backupData.sekretariat || [];
      if (sList.length > 0) {
        localStorage.setItem('kas_rt_sekretariat', JSON.stringify(sList[0]));
        restoredSekretariatCount = 1;
      }

      let restoredInventarisCount = 0;
      const invList = backupData.inventaris || backupData.inventaris_rt || [];
      if (invList.length > 0) {
        localStorage.setItem('kas_rt_inventaris', JSON.stringify(invList));
        restoredInventarisCount = invList.length;
      }

      let restoredPeminjamanCount = 0;
      const pinjamList = backupData.peminjaman || backupData.peminjaman_aset_rt || [];
      if (pinjamList.length > 0) {
        localStorage.setItem('kas_rt_peminjaman', JSON.stringify(pinjamList));
        restoredPeminjamanCount = pinjamList.length;
      }

      let restoredDaruratCount = 0;
      const daruratList = backupData.darurat || backupData.darurat_rt || [];
      if (daruratList.length > 0) {
        localStorage.setItem('kas_rt_emergency_alerts', JSON.stringify(daruratList));
        restoredDaruratCount = daruratList.length;
      }

      const parts: string[] = [];
      if (backupData.transactions.length > 0) parts.push(`${backupData.transactions.length} transaksi kas`);
      if (restoredCatCount > 0) parts.push(`${restoredCatCount} kategori`);
      if (restoredDataWargaCount > 0) parts.push(`${restoredDataWargaCount} data warga`);
      if (restoredPengurusCount > 0) parts.push(`${restoredPengurusCount} pengurus`);
      if (restoredSekretariatCount > 0) parts.push(`${restoredSekretariatCount} sekretariat`);
      if (restoredInventarisCount > 0) parts.push(`${restoredInventarisCount} barang inventaris`);
      if (restoredPeminjamanCount > 0) parts.push(`${restoredPeminjamanCount} log pinjam`);
      if (restoredDaruratCount > 0) parts.push(`${restoredDaruratCount} log darurat`);

      const detailsMsg = parts.length > 0
        ? `Berhasil memulihkan ${parts.join(', ')} ke penyimpanan lokal.`
        : 'Pemulihan selesai dengan sukses.';

      return {
        success: true,
        restoredTransactionsCount: backupData.transactions.length,
        restoredCategoriesCount: restoredCatCount,
        restoredPengurusCount,
        restoredDataWargaCount,
        restoredSekretariatCount,
        restoredInventarisCount,
        restoredPeminjamanCount,
        restoredDaruratCount,
        mode,
        target: 'local',
        details: detailsMsg,
      };
    } catch (err: any) {
      return {
        success: false,
        restoredTransactionsCount: 0,
        restoredCategoriesCount: 0,
        mode,
        target: 'local',
        error: err.message || 'Gagal menyimpan data ke penyimpanan lokal.',
      };
    }
  }
}
