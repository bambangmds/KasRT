-- =============================================================================
-- DUMP STRUKTUR & DATA TABEL MYSQL: kas_rt
-- Sistem Buku Kas & Laporan Keuangan RT.002 RW.09, Kelurahan Pondok Rajeg
-- Tanggal Ekspor: 2026-09-11
-- Target Database: MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+
-- Karakter Encoding: UTF-8 (utf8mb4)
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- -----------------------------------------------------------------------------
-- 1. STRUKTUR TABEL: kas_rt
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `kas_rt`;

CREATE TABLE `kas_rt` (
  `id` VARCHAR(36) NOT NULL COMMENT 'ID Unik Transaksi (UUID atau kode TRX)',
  `tanggal` DATE NOT NULL COMMENT 'Tanggal transaksi kas (YYYY-MM-DD)',
  `jenis` ENUM('Masuk', 'Keluar') NOT NULL COMMENT 'Jenis arus kas: Masuk atau Keluar',
  `kategori` VARCHAR(100) NOT NULL COMMENT 'Kategori pos anggaran kas',
  `jumlah` DECIMAL(15, 2) NOT NULL DEFAULT '0.00' COMMENT 'Nominal transaksi (Rupiah)',
  `keterangan` TEXT NOT NULL COMMENT 'Uraian atau keterangan rincian transaksi',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Waktu pembuatan data transaksi',
  PRIMARY KEY (`id`),
  INDEX `idx_kas_tanggal` (`tanggal`),
  INDEX `idx_kas_jenis` (`jenis`),
  INDEX `idx_kas_kategori` (`kategori`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tabel Kas RT.002 RW.09 Pondok Rajeg';

-- -----------------------------------------------------------------------------
-- 2. DATA TRANSAKSI: kas_rt
-- -----------------------------------------------------------------------------
LOCK TABLES `kas_rt` WRITE;
INSERT INTO `kas_rt` (`id`, `tanggal`, `jenis`, `kategori`, `jumlah`, `keterangan`, `created_at`) VALUES
('TRX-001', '2023-10-24', 'Masuk', 'Iuran Wajib', 150000.00, 'Iuran Bulanan Warga RT.002 RW.09 - Budi Santoso', '2023-10-24 07:00:00'),
('TRX-002', '2023-10-23', 'Keluar', 'Keamanan', 350000.00, 'Perbaikan Lampu Jalan Blok B', '2023-10-23 07:00:00'),
('TRX-003', '2023-10-22', 'Masuk', 'Kebersihan', 75000.00, 'Sumbangan Sampah Warga', '2023-10-22 07:00:00'),
('TRX-004', '2023-10-20', 'Keluar', 'Sosial', 500000.00, 'Santunan Warga Sakit (Bapak Budi Blok C)', '2023-10-20 07:00:00'),
('TRX-005', '2023-10-19', 'Masuk', 'Iuran Warga', 500000.00, 'Iuran Warga Blok A01 - A10 (Bulan Oktober)', '2023-10-19 07:00:00'),
('TRX-006', '2023-10-18', 'Keluar', 'Operasional', 120000.00, 'Pembelian Bola Lampu Jalan Utama RT.002 RW.09', '2023-10-18 07:00:00'),
('TRX-007', '2023-10-15', 'Masuk', 'Donasi', 1500000.00, 'Sumbangan Warga untuk Perbaikan Pos Ronda', '2023-10-15 07:00:00'),
('TRX-008', '2023-10-12', 'Keluar', 'Konsumsi', 250000.00, 'Snack dan Konsumsi Rapat Koordinasi Warga', '2023-10-12 07:00:00'),
('TRX-009', '2023-10-10', 'Masuk', 'Iuran Wajib', 750000.00, 'Iuran Kas Warga Blok C (5 Kepala Keluarga)', '2023-10-10 07:00:00'),
('TRX-010', '2023-10-05', 'Keluar', 'Operasional', 450000.00, 'Honor Petugas Kebersihan Periode Awal Bulan', '2023-10-05 07:00:00'),
('TRX-011', '2023-10-02', 'Masuk', 'Iuran Warga', 1200000.00, 'Iuran Keamanan dan Kebersihan Warga Blok B', '2023-10-02 07:00:00'),
('TRX-012', '2023-09-28', 'Keluar', 'Keamanan', 300000.00, 'Pengadaan Kunci Gembok Portal Masuk RT.002 RW.09', '2023-09-28 07:00:00'),
('TRX-013', '2023-10-25', 'Masuk', 'Iuran Perbaikan Jalan', 1500000.00, 'Iuran Swadaya Perbaikan Jalan RT.002 RW.09 Warga Blok A & B', '2023-10-25 07:00:00'),
('TRX-014', '2023-10-26', 'Masuk', 'Bantuan Pembangunan Masjid', 1000000.00, 'Titipan Bantuan Pembangunan Masjid dari Warga', '2023-10-26 07:00:00'),
('TRX-015', '2023-10-27', 'Keluar', 'Biaya keRTan', 200000.00, 'Pengadaan Stempel, Map Arsip, dan Operasional Administrasi keRTan', '2023-10-27 07:00:00');
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- SELESAI: 15 baris data transaksi siap diimport ke MySQL / phpMyAdmin.
-- =============================================================================
