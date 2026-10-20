export type TransactionType = 'Masuk' | 'Keluar';

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  category: string;
  amount: number;
  description: string;
  status: 'Synced' | 'Syncing' | 'Error';
  createdAt: number;
  wargaId?: string; // Menghubungkan ke data_warga
}

// Struktur data tabel 'kas_rt' di Supabase
// Kolom: id, tanggal, jenis, kategori, jumlah, keterangan, warga_id
export interface SupabaseKasRow {
  id: string;
  tanggal: string;
  jenis: string;
  kategori: string;
  jumlah: number;
  keterangan: string;
  created_at?: string;
  warga_id?: string; // Menghubungkan ke data_warga
}

export type SupabaseConnectionStatus = 'connected' | 'demo' | 'connecting' | 'error';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export type ActiveTab = 
  | 'input-riwayat-transaksi' 
  | 'koreksi-hapus' 
  | 'laporan-keuangan'
  | 'data-warga'
  | 'kelola-kategori'
  | 'kelola-data'
  | 'siaran-pengumuman'
  | 'inventaris-rt';

export interface InventarisItem {
  id: string;
  nama_barang: string;
  jumlah_total: number;
  jumlah_baik: number;
  jumlah_rusak: number;
  kondisi?: string; // e.g. 'Baik', 'Sangat Baik', 'Rusak Sebagian'
  lokasi_penyimpanan?: string;
  catatan?: string;
  created_at?: string;
}

export interface PeminjamanItem {
  id: string;
  id_barang: string;
  id_warga: string;
  tanggal_pinjam: string; // YYYY-MM-DD
  tanggal_kembali?: string; // YYYY-MM-DD
  jumlah_pinjam: number;
  keperluan?: string;
  status: 'Dipinjam' | 'Kembali';
  catatan?: string;
  created_at?: string;
  // Join fields for frontend display
  warga_nama?: string;
  barang_nama?: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  type: TransactionType;
  description?: string;
  createdAt?: string | number;
  wajib?: boolean; // true = wajib, false = sukarela / opsional
  nominal?: number; // Nilai nominal ketetapan / acuan iuran
}

// Struktur baris tabel 'kategori_kas' di Supabase
export interface SupabaseCategoryRow {
  id: string;
  nama: string;
  jenis: string;
  deskripsi?: string;
  created_at?: string;
  wajib?: boolean;
  nominal?: number;
}

export type ThemeName = 'emerald' | 'sapphire' | 'indigo';

export interface ToastInfo {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  title?: string;
}

export type PengurusRole = 
  | 'Ketua RT' 
  | 'Wakil Ketua RT'
  | 'Sekretaris' 
  | 'Bendahara' 
  | 'Seksi Keamanan' 
  | 'Seksi Sarana & Prasarana' 
  | 'Seksi Humas' 
  | 'Seksi Kerohanian' 
  | 'Seksi Pemuda & Olahraga' 
  | 'Seksi Pemberdayaan Perempuan'
  | 'Warga';

export type UserLevel = 'Admin' | 'User';

export interface UserProfile {
  id: string;
  email: string;
  nama: string;
  role: PengurusRole;
  levelAkses: UserLevel;
  no_hp?: string;
  wargaId?: string; // ID dari tabel data_warga
  no_kk?: string; // No KK dari tabel data_warga
  nik?: string; // NIK dari tabel data_warga
  alamat_domisili?: string; // Alamat domisili warga
  avatarInitials?: string;
  fotoUrl?: string; // URL atau Base64 foto/picture pengguna
  avatarShape?: 'circle' | 'rounded'; // Bentuk foto (bulat atau kotak melengkung)
  avatarSize?: 'sm' | 'md' | 'lg'; // Ukuran foto (32px, 36px, 40px)
  avatarZoom?: number; // Skala perbesaran foto (1 - 2)
  isDemo?: boolean;
}

export interface SupabasePengurusRow {
  id: string;
  nama: string;
  email: string;
  password?: string;
  jabatan: string;
  level_akses: 'Admin' | 'User';
  no_hp?: string;
  warga_id?: string;
  no_kk?: string;
  nik?: string;
  alamat_domisili?: string;
  foto_url?: string;
  created_at?: string;
}

export type SupabasePenggunaRow = SupabasePengurusRow;

export interface DataWargaItem {
  id?: string;
  no_kk: string;
  nik: string;
  nama_lengkap: string;
  jenis_kelamin?: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  agama?: string;
  pendidikan?: string;
  pekerjaan?: string;
  status_perkawinan?: string;
  alamat_domisili: string;
  no_hp?: string;
  status_warga?: string;
  catatan?: string;
  created_at?: string;
}

export interface SekretariatItem {
  id?: string;
  rt: string;
  rw: string;
  kelurahan: string;
  alamat: string;
  kecamatan?: string;
  kota_kabupaten?: string;
  provinsi?: string;
  kode_pos?: string;
  telepon?: string;
  email?: string;
  nama_ketua_rt?: string;
  created_at?: string;
  updated_at?: string;
}

export type SupabaseSekretariatRow = SekretariatItem;

