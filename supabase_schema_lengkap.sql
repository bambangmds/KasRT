-- =========================================================================
-- MASTER SKEMA LENGKAP SUPABASE: KAS RT DIGITAL
-- Mencakup Seluruh Tabel:
-- 1. sekretariat (Profil & Wilayah RT)
-- 2. data_warga (Kependudukan & Warga RT)
-- 3. pengguna (Akun Login & Pengurus)
-- 4. inventaris_rt (Aset & Barang RT)
-- 5. peminjaman_aset_rt (Log Peminjaman Aset)
-- 6. kategori (Master Pos Kas Masuk & Keluar)
-- 7. kas_rt (Buku Transaksi Kas & Keuangan)
-- 8. darurat_rt (Sistem Siren & Tombol Darurat SOS)
-- =========================================================================

-- Aktifkan ekstensi UUID jika belum aktif
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================
-- 1. TABEL SEKRETARIAT (Profil Wilayah RT)
-- =========================================================================
CREATE TABLE IF NOT EXISTS sekretariat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rt VARCHAR(10) NOT NULL DEFAULT '002',
  rw VARCHAR(10) NOT NULL DEFAULT '09',
  kelurahan VARCHAR(100) NOT NULL DEFAULT 'Pondok Rajeg',
  kecamatan VARCHAR(100) NOT NULL DEFAULT 'Cibinong',
  alamat TEXT NOT NULL DEFAULT 'Jl. Pondok Rajeg Raya, RT.002 RW.09, Kel. Pondok Rajeg, Kec. Cibinong, Kab. Bogor, Jawa Barat',
  kota_kabupaten VARCHAR(100) DEFAULT 'Kabupaten Bogor',
  provinsi VARCHAR(100) DEFAULT 'Jawa Barat',
  kode_pos VARCHAR(10) DEFAULT '16914',
  telepon VARCHAR(25),
  email VARCHAR(100),
  nama_ketua_rt VARCHAR(100),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Buat View Alias "Sekretariat" (Mendukung query PostgREST huruf kapital)
CREATE OR REPLACE VIEW "Sekretariat" AS SELECT * FROM sekretariat;

ALTER TABLE sekretariat ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Akses Publik Sekretariat" ON sekretariat;
CREATE POLICY "Akses Publik Sekretariat" 
  ON sekretariat 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- =========================================================================
-- 2. TABEL DATA WARGA (Kependudukan)
-- =========================================================================
CREATE TABLE IF NOT EXISTS data_warga (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no_kk VARCHAR(16) NOT NULL,
  nik VARCHAR(16) UNIQUE NOT NULL,
  nama_lengkap TEXT NOT NULL,
  jenis_kelamin TEXT CHECK (jenis_kelamin IN ('Laki-laki', 'Perempuan')),
  tempat_lahir TEXT,
  tanggal_lahir DATE,
  agama TEXT,
  pendidikan TEXT,
  pekerjaan TEXT,
  status_perkawinan TEXT CHECK (status_perkawinan IN ('Belum Kawin', 'Kawin', 'Cerai Hidup', 'Cerai Mati')),
  alamat_domisili TEXT NOT NULL,
  no_hp VARCHAR(20),
  status_warga TEXT CHECK (status_warga IN ('Warga Tetap', 'Warga Pendatang/Kontrak', 'Warga Kos')),
  catatan TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_data_warga_nik ON data_warga (nik);
CREATE INDEX IF NOT EXISTS idx_data_warga_no_kk ON data_warga (no_kk);
CREATE INDEX IF NOT EXISTS idx_data_warga_nama ON data_warga (nama_lengkap);

ALTER TABLE data_warga ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Akses Publik Data Warga" ON data_warga;
CREATE POLICY "Akses Publik Data Warga" 
  ON data_warga 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- =========================================================================
-- 3. TABEL PENGGUNA (Akun Login Pengurus & Warga)
-- =========================================================================
CREATE TABLE IF NOT EXISTS pengguna (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  jabatan TEXT NOT NULL,
  level_akses TEXT NOT NULL DEFAULT 'User' CHECK (level_akses IN ('Admin', 'User')),
  no_hp TEXT,
  no_kk VARCHAR(16),
  warga_id UUID,
  nik VARCHAR(16),
  alamat_domisili TEXT,
  foto_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Pastikan kolom baru terpasang jika tabel pengguna sudah ada sebelumnya
ALTER TABLE pengguna ADD COLUMN IF NOT EXISTS no_kk VARCHAR(16);
ALTER TABLE pengguna ADD COLUMN IF NOT EXISTS warga_id UUID;
ALTER TABLE pengguna ADD COLUMN IF NOT EXISTS nik VARCHAR(16);
ALTER TABLE pengguna ADD COLUMN IF NOT EXISTS alamat_domisili TEXT;
ALTER TABLE pengguna ADD COLUMN IF NOT EXISTS no_hp TEXT;
ALTER TABLE pengguna ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- Buat View Alias "Pengguna"
CREATE OR REPLACE VIEW "Pengguna" AS SELECT * FROM pengguna;

ALTER TABLE pengguna ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Akses Publik Pengguna" ON pengguna;
CREATE POLICY "Akses Publik Pengguna" 
  ON pengguna 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- =========================================================================
-- 4. TABEL INVENTARIS RT (Aset & Barang)
-- =========================================================================
CREATE TABLE IF NOT EXISTS inventaris_rt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_barang TEXT NOT NULL,
  jumlah_total INTEGER NOT NULL DEFAULT 1,
  jumlah_baik INTEGER NOT NULL DEFAULT 1,
  jumlah_rusak INTEGER NOT NULL DEFAULT 0,
  kondisi TEXT DEFAULT 'Baik',
  lokasi_penyimpanan TEXT,
  catatan TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventaris_nama ON inventaris_rt (nama_barang);

ALTER TABLE inventaris_rt ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Akses Publik Inventaris RT" ON inventaris_rt;
CREATE POLICY "Akses Publik Inventaris RT" 
  ON inventaris_rt 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- =========================================================================
-- 5. TABEL PEMINJAMAN ASET RT
-- =========================================================================
CREATE TABLE IF NOT EXISTS peminjaman_aset_rt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_barang UUID NOT NULL REFERENCES inventaris_rt(id) ON DELETE CASCADE,
  id_warga UUID NOT NULL,
  tanggal_pinjam DATE NOT NULL,
  tanggal_kembali DATE,
  jumlah_pinjam INTEGER NOT NULL DEFAULT 1,
  keperluan TEXT,
  status TEXT NOT NULL DEFAULT 'Dipinjam' CHECK (status IN ('Dipinjam', 'Kembali')),
  catatan TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE peminjaman_aset_rt ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Akses Publik Peminjaman Aset RT" ON peminjaman_aset_rt;
CREATE POLICY "Akses Publik Peminjaman Aset RT" 
  ON peminjaman_aset_rt 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- =========================================================================
-- 6. TABEL MASTER KATEGORI KAS
-- =========================================================================
CREATE TABLE IF NOT EXISTS kategori (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('Masuk', 'Keluar')),
  deskripsi TEXT,
  wajib BOOLEAN DEFAULT false,
  nominal NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(nama, jenis)
);

ALTER TABLE kategori ADD COLUMN IF NOT EXISTS wajib BOOLEAN DEFAULT false;
ALTER TABLE kategori ADD COLUMN IF NOT EXISTS nominal NUMERIC DEFAULT 0;

ALTER TABLE kategori ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Akses Publik Kategori" ON kategori;
CREATE POLICY "Akses Publik Kategori" 
  ON kategori 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- =========================================================================
-- 7. TABEL BUKU TRANSAKSI KAS RT
-- =========================================================================
CREATE TABLE IF NOT EXISTS kas_rt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal DATE NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('Masuk', 'Keluar')),
  kategori TEXT NOT NULL,
  jumlah NUMERIC NOT NULL,
  keterangan TEXT NOT NULL,
  warga_id UUID REFERENCES data_warga(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kas_rt_tanggal ON kas_rt (tanggal);
CREATE INDEX IF NOT EXISTS idx_kas_rt_jenis ON kas_rt (jenis);
CREATE INDEX IF NOT EXISTS idx_kas_rt_kategori ON kas_rt (kategori);

ALTER TABLE kas_rt ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Akses Publik Kas RT" ON kas_rt;
CREATE POLICY "Akses Publik Kas RT" 
  ON kas_rt 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- =========================================================================
-- 8. TABEL PERINGATAN DARURAT RT (SOS SIREN)
-- =========================================================================
CREATE TABLE IF NOT EXISTS darurat_rt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_warga UUID NOT NULL,
  nama_warga TEXT NOT NULL,
  alamat TEXT NOT NULL,
  no_hp TEXT,
  tipe_darurat TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Selesai')),
  keterangan TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE darurat_rt ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Akses Publik Darurat RT" ON darurat_rt;
CREATE POLICY "Akses Publik Darurat RT" 
  ON darurat_rt 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- =========================================================================
-- DATA AWAL DEFAULT (Hanya jika tabel kosong)
-- =========================================================================

-- Inisialisasi Kategori Kas Masuk & Keluar standar
INSERT INTO kategori (nama, jenis, deskripsi, wajib, nominal)
VALUES
  ('Iuran Warga Bulanan', 'Masuk', 'Iuran rutin bulanan warga RT untuk operasional lingkungan', true, 25000),
  ('Iuran Keamanan / Satpam', 'Masuk', 'Iuran khusus pos ronda dan honor petugas keamanan', true, 20000),
  ('Iuran Kebersihan & Sampah', 'Masuk', 'Iuran pengelolaan kebersihan lingkungan dan pengangkutan sampah', true, 15000),
  ('Donasi & Sumbangan Sukarela', 'Masuk', 'Sumbangan sukarela donatur atau warga untuk kegiatan RT', false, 0),
  ('Dana Sosial Warga', 'Masuk', 'Kas sosial untuk santunan lelayu, duka cita, dan bantuan sakit', false, 0),
  ('Iuran Perbaikan Jalan', 'Masuk', 'Iuran swadaya pengaspalan / perbaikan paving jalan warga', false, 0),
  ('Honor Petugas Keamanan', 'Keluar', 'Gaji / honor bulanan petugas pos satpam RT', false, 0),
  ('Honor Petugas Kebersihan', 'Keluar', 'Honor petugas pengangkut sampah dan kebersihan drainase', false, 0),
  ('Biaya Listrik Pos & PJU', 'Keluar', 'Pembayaran token listrik pos ronda dan lampu penerangan jalan umum', false, 0),
  ('Pemeliharaan Sarana & Prasarana', 'Keluar', 'Perbaikan fasilitas umum, taman, pos, dan drainase lingkungan', false, 0),
  ('Kegiatan Warga & HUT RI', 'Keluar', 'Biaya penyelenggaraan acara 17 Agustus, kerja bakti, dan senam bersama', false, 0),
  ('Santunan Sosial & Duka', 'Keluar', 'Penyaluran santunan warga duka cita, melahirkan, atau sakit', false, 0),
  ('Konsumsi Rapat & Kerja Bakti', 'Keluar', 'Konsumsi rapat rutin bulanan warga dan agenda kerja bakti bersama', false, 0),
  ('Biaya keRTan', 'Keluar', 'Operasional administrasi sekretariat RT, ATK, cetak surat, dan perlengkapan', false, 0)
ON CONFLICT (nama, jenis) DO NOTHING;

-- Inisialisasi Data Wilayah Sekretariat jika masih kosong
INSERT INTO sekretariat (rt, rw, kelurahan, kecamatan, alamat, kota_kabupaten, provinsi, kode_pos)
SELECT 
  '002', 
  '09', 
  'Pondok Rajeg', 
  'Cibinong', 
  'Jl. Pondok Rajeg Raya, RT.002 RW.09, Kel. Pondok Rajeg, Kec. Cibinong, Kab. Bogor, Jawa Barat',
  'Kabupaten Bogor',
  'Jawa Barat',
  '16914'
WHERE NOT EXISTS (
  SELECT 1 FROM sekretariat LIMIT 1
);

-- =========================================================================
-- QUERY VERIFIKASI STATUS TABEL
-- =========================================================================
SELECT 'sekretariat' AS tabel, count(*) AS total_baris FROM sekretariat
UNION ALL SELECT 'pengguna', count(*) FROM pengguna
UNION ALL SELECT 'data_warga', count(*) FROM data_warga
UNION ALL SELECT 'inventaris_rt', count(*) FROM inventaris_rt
UNION ALL SELECT 'peminjaman_aset_rt', count(*) FROM peminjaman_aset_rt
UNION ALL SELECT 'kategori', count(*) FROM kategori
UNION ALL SELECT 'kas_rt', count(*) FROM kas_rt
UNION ALL SELECT 'darurat_rt', count(*) FROM darurat_rt;
