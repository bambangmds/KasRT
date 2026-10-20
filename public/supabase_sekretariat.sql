-- =========================================================================
-- SCRIPT SQL SUPABASE: TABEL SEKRETARIAT RT
-- Aplikasi: Kas RT.002 RW.09 (Kelurahan Pondok Rajeg)
-- Deskripsi: Skema tabel data identitas wilayah sekretariat RT
-- =========================================================================

-- 1. Buat Tabel sekretariat (PostgreSQL case-insensitive standar)
CREATE TABLE IF NOT EXISTS sekretariat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rt VARCHAR(10) NOT NULL DEFAULT '002',
  rw VARCHAR(10) NOT NULL DEFAULT '09',
  kelurahan VARCHAR(100) NOT NULL DEFAULT 'Pondok Rajeg',
  alamat TEXT NOT NULL DEFAULT 'Jl. Pondok Rajeg Raya, RT.002 RW.09, Kel. Pondok Rajeg, Kec. Cibinong, Kab. Bogor, Jawa Barat',
  kecamatan VARCHAR(100) DEFAULT 'Cibinong',
  kota_kabupaten VARCHAR(100) DEFAULT 'Kabupaten Bogor',
  provinsi VARCHAR(100) DEFAULT 'Jawa Barat',
  kode_pos VARCHAR(10) DEFAULT '16914',
  telepon VARCHAR(25),
  email VARCHAR(100),
  nama_ketua_rt VARCHAR(100),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Buat View Alias "Sekretariat" (Mendukung query dengan huruf kapital "Sekretariat")
CREATE OR REPLACE VIEW "Sekretariat" AS 
SELECT * FROM sekretariat;

-- 3. Konfigurasi Row Level Security (RLS) & Kebijakan Akses Publik
ALTER TABLE sekretariat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Akses Publik Sekretariat" ON sekretariat;
CREATE POLICY "Akses Publik Sekretariat" 
  ON sekretariat 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 4. Indexing untuk optimasi pencarian
CREATE INDEX IF NOT EXISTS idx_sekretariat_rt_rw ON sekretariat (rt, rw);
CREATE INDEX IF NOT EXISTS idx_sekretariat_kelurahan ON sekretariat (kelurahan);

-- 5. Masukkan Data Default Awal jika tabel masih kosong
INSERT INTO sekretariat (rt, rw, kelurahan, alamat, kecamatan, kota_kabupaten, provinsi, kode_pos)
SELECT 
  '002', 
  '09', 
  'Pondok Rajeg', 
  'Jl. Pondok Rajeg Raya, RT.002 RW.09, Kel. Pondok Rajeg, Kec. Cibinong, Kab. Bogor, Jawa Barat',
  'Cibinong',
  'Kabupaten Bogor',
  'Jawa Barat',
  '16914'
WHERE NOT EXISTS (
  SELECT 1 FROM sekretariat LIMIT 1
);

-- Cek isi tabel
SELECT * FROM sekretariat;
