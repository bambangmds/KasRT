# Ringkasan Proyek & Konteks Pengembangan: Kas RT.002 RW.09

Dokumen ini merekam seluruh catatan pengembangan, arsitektur, dan instruksi proyek agar dapat dilanjutkan kapan saja dengan mulus.

---

## 1. Identitas & Tujuan Aplikasi
- **Nama Aplikasi**: Kas RT.002 RW.09 (Sistem Buku Kas & Laporan Keuangan RT.002 RW.09, Kelurahan Pondok Rajeg)
- **Teknologi**: React 18, TypeScript, Tailwind CSS, Vite, Supabase Client (`@supabase/supabase-js`), Lucide Icons & Material Symbols.
- **Tujuan**: Membantu pengurus RT mengelola pencatatan kas masuk (iuran warga, donasi, kas sosial) dan kas keluar (kebersihan, keamanan, perbaikan fasilitas), koreksi data, serta menyajikan laporan keuangan berkala.

---

## 2. Struktur Menu & Fitur Utama

### A. Input & Riwayat Kas (`/src/components/InputRiwayatView.tsx`)
- Formulir entri transaksi: Tanggal, Jenis (Masuk / Keluar), Kategori (otomatis sesuai jenis), Jumlah (Rp), dan Keterangan.
- **Input Keterangan**: Menggunakan `<textarea>` multi-baris dengan `resize-y`, `min-h-[90px]`, dan **tanpa batasan panjang karakter** (`maxLength`).
- Tabel riwayat transaksi dengan filter (Semua, Masuk, Keluar), pagination, dan tombol segarkan (*refresh*) langsung dari database Supabase.
- Tampilan teks panjang pada tabel dilengkapi tooltip `title` agar terbaca utuh saat disorot kursor.

### B. Koreksi & Hapus Data (`/src/components/KoreksiHapusView.tsx`)
- Pencarian dan filter transaksi berdasarkan jenis dan kata kunci.
- Modal Koreksi (Edit): Mengedit tanggal, tipe, kategori, nominal, dan **keterangan** (juga menggunakan `<textarea>` multi-baris bebas karakter).
- Modal Konfirmasi Hapus: Menghapus data secara aman dari tabel Supabase `kas_rt` dan state lokal.
- Tampilan ID transaksi: Ditampilkan dalam bentuk badge ringkas (format UUID pendek dengan tooltip UUID lengkap).

### C. Laporan Keuangan & Visualisasi (`/src/components/LaporanKeuanganView.tsx`)
- Kartu metrik: Total Kas Masuk, Total Kas Keluar, Saldo Bersih Kas RT saat ini.
- Grafik batang tren bulanan (Pemasukan vs Pengeluaran).
- Visualisasi persentase komposisi sumber kas warga.
- Modal Ekspor Data (`/src/components/ExportModal.tsx`) untuk mengunduh laporan dalam format PDF, Excel, CSV, atau mencetak langsung.

### D. Modal Pengaturan Supabase (`/src/components/SupabaseModal.tsx`)
- Konfigurasi URL dan Anon Key Supabase.
- Pengujian koneksi langsung (*Test Connection*).
- Penyiapan skema SQL cepat (*copy-paste* SQL ke Supabase SQL Editor).

---

## 3. Integrasi Database Supabase (`/src/lib/supabase.ts`)

- **Nama Tabel**: `kas_rt`
- **Skema Kolom**:
  ```sql
  CREATE TABLE IF NOT EXISTS kas_rt (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tanggal DATE NOT NULL,
    jenis TEXT NOT NULL CHECK (jenis IN ('Masuk', 'Keluar')),
    kategori TEXT NOT NULL,
    jumlah NUMERIC NOT NULL,
    keterangan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
  );
  ```
- **Penanganan Tipe Data ID (UUID)**:
  - Mengatasi error PostgreSQL `22P02` (*invalid input syntax for type uuid*).
  - Fungsi `isUuid(str)` memeriksa validitas UUID.
  - Saat penambahan baru, ID string kustom (seperti `TRX-xxx`) dihilangkan dari payload `INSERT` agar PostgreSQL men-generate UUID otomatis (`gen_random_uuid()`), dengan fallback client-side `crypto.randomUUID()`.
  - Fungsi update dan delete mendukung tipe data UUID dan mengabaikan ID demo non-UUID secara aman.

---

## 4. Riwayat Perubahan Terakhir
1. Penanganan tuntas error Supabase `22P02` untuk kolom `id` bertipe UUID.
2. Perubahan input `keterangan` menjadi `<textarea>` multi-baris tanpa batasan karakter (`maxLength`) pada formulir utama dan modal koreksi/edit.
3. Penambahan atribut tooltip `title` pada sel keterangan di tabel riwayat & koreksi.
4. **Aktivasi Halaman Koreksi & Hapus Terintegrasi Supabase**:
   - Auto-fetch seluruh data transaksi dari tabel `kas_rt` (`select('*')` diurutkan dari `tanggal` terbaru) saat halaman Koreksi dibuka atau saat tombol "Segarkan Data" diklik.
   - Konfirmasi alert/dialog *"Apakah Anda yakin ingin menghapus data ini?"* saat tombol tempat sampah diklik, mengeksekusi `DELETE` ke Supabase berdasarkan `id`, dan otomatis merefresh tabel sehingga data terhapus langsung hilang.
   - Modal Edit otomatis memuat seluruh data baris (tanggal, jenis, kategori, jumlah, dan keterangan), mengeksekusi `UPDATE` ke Supabase saat tombol *"Simpan Perubahan"* diklik, menutup modal, dan langsung merefresh tabel.
5. **Pembaruan Tombol Aksi Tabel Koreksi**:
   - Tombol "Edit" diubah menjadi ikon pensil (`Pencil` dari Lucide React) dengan efek hover menggelap halus.
   - Tombol "Hapus" diubah menjadi ikon tempat sampah (`Trash2` dari Lucide React) berwarna merah dengan efek hover merah menyala (`hover:bg-red-600 hover:text-white`).
   - Seluruh fungsi `onClick` tetap utuh terhubung ke Supabase.
6. **Perapian Tombol Modal Koreksi/Edit**:
   - Menghilangkan elemen teks "save" / "Save" bawaan ikon font ligature.
   - Menyisakan hanya 2 tombol berbahasa Indonesia yang jelas: **"Batal"** dan **"Simpan Perubahan"** (dengan ikon SVG centang `Check` dan `Loader2` saat proses penyimpanan berlangsung).
   - Fungsi update ke tabel Supabase `kas_rt` dan auto-refresh tabel tetap aktif sepenuhnya.
7. **Pembersihan Header Modal Koreksi/Edit**:
   - Menghapus teks "edit_note" sepenuhnya dari header modal.
   - Menghapus badge ID transaksi acak (UUID) dari samping judul.
   - Judul modal kini tampil bersih hanya bertuliskan: **"Koreksi Data Transaksi"** dengan tombol tutup ikon SVG silang (`X`).
8. **Pembersihan Teks Ganda/Bilingual & Migrasi Penuh ke Ikon Lucide**:
   - Mengganti seluruh Material Symbols berbasis teks/ligatur (`<span>material-symbols-outlined</span>`) dengan komponen SVG `lucide-react` di seluruh aplikasi (`Sidebar`, `Header`, `InputRiwayatView`, `KoreksiHapusView`, `LaporanKeuanganView`, `ExportModal`, `SupabaseModal`, `Toast`, dan banner `App.tsx`).
   - Menghilangkan kebocoran teks ligatur bawaan font (seperti teks `refresh Segarkan Data`, `receipt_long Input & Riwayat`, `edit_note Koreksi & Hapus`, `bar_chart Laporan Keuangan`, dan teks `search` yang menumpuk di placeholder kolom pencarian "Cari ID").
   - Semua antarmuka kini 100% menggunakan Bahasa Indonesia yang bersih dan rapi dengan ikon SVG yang presisi.
9. **Penyempurnaan Visual & Estetika Seluruh Halaman ("Keren & Indah")**:
   - **Sidebar**: Identitas RT 05 / RW 02 dengan emblem perisai, efek active tab elegan dark navy dengan aksen mint, status koneksi Supabase interaktif dengan indikator denyut (*live pulse*).
   - **Header**: Desain modern glassmorphism semi-transparan (`backdrop-blur-md`), badge identitas warga, tombol status sinkronisasi, dan popover profil pengurus yang informatif.
   - **Input & Riwayat Transaksi**:
     - *Segmented toggle switch* Kas Masuk vs Kas Keluar dengan warna terarah (emerald vs rose).
     - Tombol nominal cepat (*quick presets* nominal dues: +25k, +50k, +100k, +200k, +500k).
     - Card rekap bulan berjalan dengan kalkulasi saldo otomatis dan pencarian instan dengan tombol clear (X).
   - **Koreksi & Hapus Data**:
     - Kartu statistik mini di bagian atas (Total Seluruh Transaksi, Total Masuk, Total Keluar).
     - Filter pill interaktif (Semua, Masuk, Keluar), dropdown kategori, date picker, dan salin ID cepat (copy-to-clipboard).
     - Modal koreksi & modal konfirmasi hapus dengan preview ringkasan transaksi sebelum penghapusan permanen.
   - **Laporan Keuangan**:
     - Kalkulasi metrik **dinamis real-time** dari data tabel Supabase `kas_rt`.
     - Grafik batang tren bulanan dinamis dengan normalisasi ketinggian otomatis dan tooltip hover interaktif.
     - Diagram batang komposisi sumber pemasukan kas warga.
     - Tabel ringkasan realisasi pos anggaran dengan kalkulasi selisih bersih (*net balance*).
     - Dukungan ekspor laporan siap cetak (PDF) dan unduh file Excel (CSV).

10. **Penyegaran Palet Warna Seluruh Halaman (Harmonis & Nyaman di Mata)**:
    - **Palet Slate & Cool Neutrals (`slate-50` hingga `slate-900`)**: Menggantikan latar belakang kontras tajam dengan kanvas `slate-100/60` yang lembut dan kartu `bg-white border-slate-200`.
    - **Aksen Kas Masuk / Positif (`emerald-600`, `emerald-700`, `emerald-50`)**: Warna hijau zamrud lembut dan natural, tidak menyilaukan mata, serta memenuhi standar aksesibilitas WCAG.
    - **Aksen Kas Keluar / Peringatan (`rose-500`, `rose-600`, `rose-50`)**: Warna merah lembut terarah untuk pengeluaran dan status penghapusan data.
    - **Kartu Saldo & Header Modal (`slate-900` dengan aksen `emerald-400`)**: Tampilan elegan, profesional, dan nyaman dipandang dalam durasi penggunaan yang lama.
    - Diterapkan secara serentak di seluruh halaman: `Input & Riwayat`, `Koreksi & Hapus`, `Laporan Keuangan`, `ExportModal`, `SupabaseModal`, `Toast`, `Sidebar`, dan `Header`.

11. **Penerapan Sidebar Executive Dark & Fitur Pemilih Tema Interaktif (*Theme Switcher*)**:
    - **Sidebar Executive Dark (`slate-900` / Midnight)**: Mengubah sidebar dari latar belakang putih pucat sebelumnya menjadi nuansa gelap berkelas dengan kontras tinggi, emblem RT 05 berkilau, dan kartu status koneksi Supabase berlatar kaca gelap dengan indikator denyut aktif.
    - **Fitur Pemilih Tema (*Theme Switcher*) di Header**: Menambahkan tombol dropdown bertanda palet warna (`Palette`) di bilah header atas dengan 3 preset warna instan:
      1. **Sapphire Blue** (Biru Modern & Finansial - Default): Nuansa biru korporat profesional.
      2. **Emerald Mint** (Hijau Zamrud Asri): Nuansa asri khas lingkungan warga RT.
      3. **Royal Indigo** (Ungu Mewah & Berkelas): Nuansa indigo modern prestisius.
    - **Penyimpanan Preferensi Tema**: Tema yang dipilih tersimpan secara otomatis di `localStorage` browser (`kas_rt_theme`) sehingga tetap aktif saat halaman dimuat ulang.

12. **Modernisasi Latar Belakang & Komponen Konten Sesuai Desain Standar**:
    - **Latar Belakang Dasar Halaman**: Menggunakan abu-abu kebiruan sejuk `bg-slate-50` (`#F8FAFC`) di seluruh aplikasi (`index.html`, `body` CSS, dan `App.tsx`).
    - **Komponen Konten (Formulir, Tabel, Kartu Dashboard, Modal)**: Memakai warna putih bersih (`bg-white`), sudut lengkung konsisten `rounded-xl`, dan bayangan halus `shadow-sm` untuk pemisahan visual yang jernih terhadap latar belakang dasar.
    - **Garis Pembatas (Border)**: Menggunakan abu-abu tipis presisi `border-slate-200` (`#E2E8F0`) di seluruh tabel, formulir, panel filter, dan kartu metrik agar rapi dan minimalis.

13. **Aktivasi Totalitas Dashboard Laporan Keuangan Terintegrasi Supabase**:
    - **Auto-Fetch Otomatis**: Saat tab Laporan Keuangan dibuka, sistem secara otomatis mengeksekusi penarikan data transaksi riil dari tabel `kas_rt` di Supabase, dilengkapi tombol "Segarkan Data" manual dengan animasi loading ikon `RefreshCw`.
    - **Kalkulasi Otomatis 3 Kartu Metrik Utama**:
      - *"Total Kas Masuk"*: Menjumlahkan seluruh kolom `jumlah` dengan `jenis = 'Masuk'`.
      - *"Total Kas Keluar"*: Menjumlahkan seluruh kolom `jumlah` dengan `jenis = 'Keluar'`.
      - *"Saldo Akhir Saat Ini"*: Menghitung `(Total Kas Masuk - Total Kas Keluar)`. Seluruh angka diformat dalam mata uang Rupiah rapi (contoh: `Rp 1.500.000`).
    - **Filter Periode Interaktif & Reaktif**: Komponen filter Bulan, Tahun Anggaran (dinamis dari data database), dan Kategori terhubung langsung secara real-time. Perubahan pilihan filter seketika memperbarui 3 kartu metrik, grafik tren, diagram komposisi, dan tabel realisasi pos kas. Dilengkapi tombol "Reset Filter" instan.
    - **Grafik Batang Riwayat Bulanan Riil**: Visualisasi komparatif Kas Masuk vs Kas Keluar 12 bulan (atau per tahun) dari riwayat transaksi Supabase dengan normalisasi ketinggian dinamis, tooltip detail saat disorot kursor, dan penanda sorotan (*highlight*) untuk bulan yang aktif dipilih.

14. **Fitur Drill-Down Interaktif Realisasi Anggaran Per Kategori**:
    - Setiap baris pos kategori anggaran pada tabel ringkasan dibuat interaktif (*clickable*) dengan kursor pointer, status sorot hover, dan badge indikator visual (*"Dibuka"* & border zamrud aktif).
    - Menampilkan panel **Tabel Detail Transaksi** langsung di bawah ringkasan saat salah satu kategori diklik, dilengkapi animasi kemunculan halus (*smooth scroll*).
    - Penyaringan otomatis (*auto-filter*): Menampilkan seluruh transaksi (baik Kas Masuk maupun Kas Keluar) untuk kategori terpilih yang sesuai dengan periode Bulan & Tahun Anggaran aktif pada dashboard.
    - Kolom lengkap tersaji rapi: **Tanggal** (format Bahasa Indonesia, misal: 12 Mei 2024), **Jenis** (badge Kas Masuk / Kas Keluar), **Jumlah** (format Rupiah rapi), dan **Keterangan Lengkap** (multi-baris tanpa terpotong).
    - Dilengkapi ringkasan metrik kategori (frekuensi transaksi, total masuk, total keluar, selisih bersih) serta tombol **"Tutup Detail"** di bagian atas dan bawah tabel untuk menyembunyikan kembali rincian dengan satu klik.

15. **Pembaruan Teks Labeling Wilayah (Kas RT.002 RW.09, Kelurahan Pondok Rajeg)**:
    - Seluruh penamaan umum dan teks lama RT/RW diganti secara spesifik menjadi: **"Kas RT.002 RW.09"** dan **"RT.002 RW.09, Kelurahan Pondok Rajeg"**.
    - Diterapkan pada `Sidebar`, `Header` (termasuk tag wilayah dan profil bendahara), `InputRiwayatView` (badge judul, total saldo kas, judul formulir, placeholder, dan pedoman kas), `KoreksiHapusView` (tag wilayah header), `LaporanKeuanganView` (tag wilayah header & nama file CSV), `ExportModal` (teks dialog & nama file download), `metadata.json`, dan `index.html`.
    - Seluruh nama variabel, nama fungsi, nama tabel database (`kas_rt`), dan kode logika Supabase tetap 100% terjaga tanpa perubahan sehingga aplikasi berjalan lancar tanpa eror.

16. **Penambahan Kategori Baru (Iuran Perbaikan Jalan, Bantuan Pembangunan Masjid, Biaya keRTan)**:
    - Menambahkan kategori: **Iuran Perbaikan Jalan**, **Bantuan Pembangunan Masjid**, dan **Biaya keRTan** ke dalam `CATEGORIES_BY_TYPE` (`initialData.ts`).
    - Kategori-kategori ini otomatis tersedia di formulir input transaksi kas (`InputRiwayatView`), modal koreksi/edit data transaksi (`KoreksiHapusView`), filter kategori laporan keuangan (`LaporanKeuanganView`), dan visualisasi drill-down anggaran.
    - Menambahkan tombol pencarian cepat (*quick chips*) untuk kata kunci kategori baru agar mempermudah pencarian dan filter transaksi.

17. **Aktivasi Supabase Live & Penghapusan Menyeluruh Label "Mode Demo"**:
    - Menghilangkan seluruh label dan teks "Mode Demo" yang membingungkan di seluruh aplikasi (banner, sidebar, header, toast saat simpan/edit/hapus data, dan modal pengaturan).
    - **Panel Quick Activation Langsung di Halaman Utama**: Menyediakan form input cepat *Project URL* dan *Anon API Key* dengan tombol *"Aktifkan"* langsung di banner atas, sehingga pengurus dapat menghubungkan database Supabase secara instan tanpa harus membuka modal berlapis.
    - **Re-Connect 1-Klik**: Tombol *"Coba Hubungkan Sekarang"* langsung menguji dan menyinkronkan data dari tabel `kas_rt` Supabase live.
    - **Banner Status Supabase Live Terhubung**: Saat tersambung, menampilkan indikator denyut hijau aktif dengan informasi jumlah transaksi online dan tombol *"Segarkan Data"*.
    - **Perapian Modal Supabase**: Mengganti tombol "Reset ke Mode Demo" dengan "Hapus Kredensial", memperjelas status koneksi, dan memperkuat fungsi verifikasi tabel `kas_rt`.

18. **Fitur Ekspor Database SQL MySQL (`kas_rt_mysql.sql`)**:
    - Pembuatan file dump mandiri `/kas_rt_mysql.sql` dan `/public/kas_rt_mysql.sql` berstandar MySQL 5.7+, 8.0+, dan MariaDB dengan encoding `utf8mb4`.
    - Skema DDL lengkap: `CREATE TABLE kas_rt` dengan primary key `id`, index kolom `tanggal`, `jenis`, dan `kategori`, tipe nominal `DECIMAL(15, 2)`, dan enum jenis `('Masuk', 'Keluar')`.
    - Script DML `INSERT INTO kas_rt` memuat seluruh riwayat transaksi lengkap dengan tanggal, pos kategori, dan uraian/keterangan.
    - Penambahan opsi **MySQL Database Dump (.sql)** di modal ekspor (`ExportModal.tsx`) dan utilitas `exportUtils.ts` (`exportToMySQL` dan `generateMySQLDump`) dengan tombol download langsung dan tombol salin query SQL ke clipboard.

19. **Fitur Import Data Excel (.xlsx / .xls / .csv) di Sebelah Kanan Tombol Ekspor**:
    - Penempatan tombol **"Import Data"** tepat di sebelah kanan tombol "Ekspor Data" pada 3 halaman utama: **Input & Riwayat Transaksi**, **Koreksi & Hapus Data**, dan **Laporan Keuangan**.
    - Utilitas parser cerdas (`/src/lib/importUtils.ts`):
      - Mendukung format baris dan kolom yang 100% sama dengan file hasil ekspor aplikasi (`No`, `Tanggal`, `Jenis`, `Kategori`, `Jumlah (Rp)`, `Keterangan`, `Status Sinkron`, `ID Transaksi`).
      - Otomatis mendeteksi baris header dan mengabaikan baris total ringkasan di bagian bawah (*Total Kas Masuk*, *Total Kas Keluar*, *Saldo Bersih Kas*).
      - Normalisasi format tanggal fleksibel (serial number Excel, DD/MM/YYYY, YYYY-MM-DD).
      - Pembersihan teks nominal Rupiah (`Rp`, spasi, titik pemisah ribuan).
      - Fungsi `downloadExcelTemplate()` untuk mengunduh template Excel siap pakai.
    - Dialog Modal Interaktif (`/src/components/ImportModal.tsx`):
      - Area drag-and-drop & pemilihan file Excel/CSV.
      - Pratinjau tabel transaksi yang terbaca dan ringkasan akuntansi (Kas Masuk, Kas Keluar, Selisih Bersih).
      - Pilihan mode: **"Tambahkan ke Data Saat Ini"** (Append) atau **"Timpa / Ganti Seluruh Data"** (Replace).
    - Eksekusi penyimpanan batch ke database Supabase `kas_rt` (`insertMultipleKasToSupabase`) atau penyimpanan lokal jika sedang offline.

20. **Menu "Kelola Kategori" & Penyimpanan Dinamis di Database Supabase (`kategori_kas`)**:
    - **Menu Baru di Sidebar**: Menambahkan menu **"Kelola Kategori"** (ikon `Tag`) di menu navigasi utama aplikasi.
    - **Tabel Database Supabase (`kategori`)**:
      ```sql
      CREATE TABLE IF NOT EXISTS kategori (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nama TEXT NOT NULL,
        jenis TEXT NOT NULL CHECK (jenis IN ('Masuk', 'Keluar')),
        deskripsi TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        UNIQUE(nama, jenis)
      );
      ```
    - **Fitur CRUD & Proteksi Integritas Data Lengkap**:
      - **Tambah Kategori**: Form modal dengan pilihan tipe (Kas Masuk / Kas Keluar), nama kategori, dan uraian peruntukan pos yang langsung tersimpan ke tabel `kategori`.
      - **Koreksi / Edit Kategori**: Mengubah nama kategori dan deskripsi. Jika nama kategori diubah, sistem secara otomatis melakukan pembaruan kaskade (*cascade update*) pada seluruh transaksi di tabel `kas_rt` yang menggunakan kategori lama.
      - **Proteksi Hapus Kategori (Cek `kas_rt`)**: Sebelum menghapus, sistem memeriksa ke tabel `kas_rt` (`checkCategoryUsedInKas`). Jika kategori sedang digunakan oleh satu atau lebih data transaksi di `kas_rt`, **penghapusan DITOLAK secara mutlak** (tombol hapus terkunci dengan ikon gembok dan modal menampilkan pesan proteksi tanpa opsi tombol hapus). Kategori hanya dapat dihapus jika belum pernah digunakan pada transaksi kas (`count === 0`).
      - **Statistik & Frekuensi Pemakaian**: Menampilkan berapa kali setiap kategori telah digunakan dalam catatan kas riil serta total perputaran nominalnya.
      - **Inisialisasi Otomatis (Auto-Seed)**: Jika tabel `kategori` di database Supabase masih kosong, aplikasi secara cerdas menginisialisasi seluruh kategori standar ke database.
    - **Sinkronisasi Dinamis ke Seluruh Aplikasi**:
      - Seluruh halaman aplikasi (`Input & Riwayat`, `Koreksi & Hapus`, `Laporan Keuangan`) mengambil daftar kategori dinamis dari tabel `kategori` di Supabase.

21. **Penyempurnaan & Resolusi Error Tombol "Tambah Kategori"**:
    - **Deteksi Cerdas Skema Kolom**: `createCategoryInSupabase` dan `seedInitialCategoriesToSupabase` mendukung kolom dwibahasa (`nama`, `jenis`, `deskripsi` vs `name`, `type`, `description`).
    - **Fallback Aman & Graceful**: Jika tabel `kategori` belum dibuat di Supabase (`42P01`) atau izin RLS (`42501`) belum diizinkan, aplikasi tidak akan crash; data tetap ditambahkan secara lokal/state, dan notifikasi jelas memandu pengguna untuk menjalankan script SQL.
    - **Tombol & Modal "Skema SQL Kategori"**: Menyediakan tombol berikon database di bilah atas menu Kelola Kategori dan panduan langsung di dalam formulir untuk menyalin skema SQL tabel `kategori` siap pakai ke Supabase SQL Editor.

22. **Sinkronisasi Otomatis Teks Abu-abu (Placeholder) Keterangan Sesuai Kategori Terpilih**:
    - Pada halaman **Input & Riwayat Transaksi**, teks placeholder (warna abu-abu) pada kolom *Keterangan / Uraian Transaksi* kini secara dinamis berganti mengikuti deskripsi pos anggaran dari kategori dan tipe (Kas Masuk / Kas Keluar) yang sedang dipilih.
    - Dilengkapi tombol cepat **"Gunakan Deskripsi Kategori"** / **"Pakai Teks Ini"** yang memungkinkan pengurus mengisi isian keterangan langsung menggunakan deskripsi resmi kategori hanya dengan 1 klik.
    - Hal yang sama juga diterapkan pada modal edit/koreksi transaksi di halaman **Koreksi & Hapus Data**.

23. **Fitur Backup & Restore Database di Halaman Laporan Keuangan**:
    - **Tombol Aksi di Toolbar Laporan Keuangan**: Menambahkan tombol **"Backup Data"** (ikon `Database` biru indigo) dan **"Restore Data"** (ikon `RotateCcw` kuning keemasan) di bilah atas halaman Laporan Keuangan (di samping tombol Ekspor dan Import Data).
    - **Modal Backup Interaktif (`BackupModal.tsx`)**:
      - **Pilihan Cakupan Data**:
        1. *Semua Data yang Ada*: Mengamankan seluruh riwayat pembukuan dari awal hingga saat ini beserta master kategori.
        2. *Bulan Tertentu*: Pengurus dapat memilih dropdown Bulan (Januari–Desember) dan Tahun Anggaran untuk keperluan arsip laporan bulanan.
      - **Pilihan Format Backup**:
        1. *File Snapshot JSON (.json)* (Rekomendasi resmi): Format arsip lengkap yang siap dipulihkan (*restore*) sewaktu-waktu oleh aplikasi.
        2. *Script SQL PostgreSQL / Supabase (.sql)*: Script query DDL & DML INSERT siap eksekusi di Supabase SQL Editor.
      - **Pratinjau Ringkasan Real-Time**: Menampilkan rincian jumlah transaksi, total kas masuk, total kas keluar, dan saldo bersih yang tersaring sebelum pengurus mengunduh file.
    - **Modal Restore Interaktif (`RestoreModal.tsx`)**:
      - **Unggah & Validasi Fleksibel (.json & .sql)**: Area drag-and-drop file mendukung snapshot JSON (`.json`) maupun berkas dump SQL (`.sql`) dengan parser SQL cerdas (`parseSQLBackup`) yang otomatis mengekstrak perintah `INSERT INTO` tabel `kas_rt` dan `kategori`.
      - **Rincian Data Backup**: Menampilkan pratinjau format file (JSON / SQL), tanggal backup, cakupan periode, total transaksi, total kas masuk/keluar, dan master kategori yang terkandung dalam file.
      - **Pilihan Mode Pemulihan**:
        1. *Gabungkan Data (Merge / Append)*: Menambahkan data dari file backup tanpa menghapus catatan kas yang sudah ada saat ini.
        2. *Timpa Bersih (Replace / Reset)*: Mengosongkan catatan kas lama di database dan menggantikannya secara penuh dengan data dari file backup (dilengkapi konfirmasi persetujuan keamanan).
      - **Sinkronisasi Otomatis**: Memulihkan data langsung ke tabel `kas_rt` dan `kategori` di Supabase (atau LocalStorage jika offline), dan secara otomatis menyegarkan tampilan dashboard laporan.

24. **Dukungan Penuh Unggah & Pemulihan File Dump SQL (.sql) pada Menu Restore Data**:
    - **Penyebab Error Sebelumnya**: Modal Restore sebelumnya hanya menerima format JSON (`parseBackupFile` langsung mengeksekusi `JSON.parse` sehingga file `.sql` memicu error `"File tidak valid: Format bukan JSON yang benar"`).
    - **Engine Parser SQL Cerdas (`parseSQLBackup` di `backupUtils.ts`)**:
      - Mendukung file dump SQL PostgreSQL / Supabase yang dihasilkan oleh fitur Backup Data serta file dump MySQL (`kas_rt_mysql.sql`).
      - Mampu mengekstrak baris-baris perintah `INSERT INTO kas_rt (...) VALUES (...)` dan `INSERT INTO kategori (...) VALUES (...)` secara presisi, mencakup penanganan string berpetik tunggal, escape karakter, baris ganda, nilai `NULL`, `DEFAULT`, `gen_random_uuid()`, dan normalisasi format tanggal/nominal.
      - Otomatis mengekstrak metadata dari komentar header SQL (wilayah, tanggal pembuatan backup, dan label cakupan data).
    - **Pembaruan Antarmuka Modal Restore (`RestoreModal.tsx`)**:
      - Input file kini menerima ekstensi `.json, .sql, application/json, application/sql, text/plain`.
      - Menampilkan ikon dan badge visual dinamis: **SQL Dump (.sql)** dengan ikon `FileCode2` berwarna biru bila mengunggah file SQL, atau **JSON Snapshot (.json)** dengan ikon `FileJson` berwarna hijau zamrud.
      - Tetap mendukung kedua mode pemulihan: **Gabungkan Data (Merge)** dan **Timpa Bersih (Replace)** dengan preview statistik total transaksi, total kas masuk, kas keluar, saldo bersih, dan master kategori.

25. **Fitur & Tombol "Hapus Data" di Halaman Laporan Keuangan (`HapusDataModal.tsx`)**:
    - **Tombol Toolbar**: Menambahkan tombol beraksen merah **"Hapus Data"** (ikon `Trash2`) di bilah atas halaman Laporan Keuangan di samping tombol Ekspor, Import, Backup, dan Restore.
    - **Pilihan Cakupan Penghapusan**:
      1. *Hapus Bulan Tertentu*: Pengurus dapat memilih dropdown Bulan (Januari - Desember) dan Tahun Anggaran. Sistem otomatis menghitung jumlah transaksi dan rincian nominal kas yang cocok. Dilengkapi proteksi tombol dinonaktifkan jika tidak ada transaksi di periode tersebut.
      2. *Hapus Semua Data*: Mengosongkan seluruh tabel `kas_rt` untuk mereset buku kas dari awal. Dilengkapi rincian total transaksi, total kas masuk, kas keluar, dan saldo kas yang akan direset.
    - **Proteksi Keamanan Berlapis**:
      - Kotak peringatan bahaya penghapusan permanen.
      - Wajib mengetik kata `HAPUS SEMUA` pada mode hapus seluruh data untuk mencegah ketidaksengajaan.
      - Checkbox persetujuan eksplisit sebelum tombol eksekusi aktif.
    - **Eksekusi Database Supabase (`deleteAllKasFromSupabase` & `deleteKasByMonthFromSupabase`)**:
      - Menjalankan perintah `DELETE` ke tabel `kas_rt` di Supabase dengan filter yang aman dan kompatibel dengan PostgREST.
      - Sinkronisasi state lokal dan pembaruan otomatis tampilan dashboard tanpa perlu reload manual.

26. **Penerapan Opsi 1: Menu Baru "Kelola Data" di Sidebar & Perapian Halaman Laporan Keuangan**:
    - **Menu Baru di Sidebar (`Kelola Data`)**: Menambahkan menu berikon `Database` di navigasi utama dengan deskripsi *"Backup, restore & reset"*.
    - **Pusat Pemeliharaan Basis Data (`KelolaDataView.tsx`)**:
      - Menyediakan 4 kartu ringkasan status tabel `kas_rt` (Status Database, Total Catatan Kas, Total Kas Masuk, Total Kas Keluar, dan Saldo Buku Kas).
      - Menata 4 modul pemeliharaan dalam bentuk kartu bento yang terstruktur:
        1. *Backup Data Kas* (JSON Snapshot & SQL Dump).
        2. *Restore Data Kas* (Pemulihan dengan mode Merge atau Replace).
        3. *Import Data Transaksi* (Spreadsheet Excel .xlsx, .xls, .csv).
        4. *Hapus / Reset Data Kas* (Hapus periode bulan tertentu atau kosongkan seluruh tabel).
      - Dilengkapi kartu petunjuk dan panduan keamanan pembukuan kas RT.
    - **Pembersihan Bilah Atas Halaman Laporan Keuangan**:
      - Bilah atas halaman Laporan kini rapi, elegan, dan fokus murni pada fungsi pelaporan: **Segarkan Data**, **Cetak / PDF**, dan **Ekspor Data**.
      - Menambahkan tombol pintas berikon database yang memudahkan pengurus melompat langsung ke halaman *Kelola & Backup Data*.

27. **Fitur Gerbang Masuk & Autentikasi Pengurus (Login & Register)**:
    - **Layar Gerbang Autentikasi (`AuthScreen.tsx`)**:
      - Menjaga aplikasi buku kas RT agar hanya dapat diakses setelah pengurus melakukan login atau registrasi.
      - Desain bersih dan elegan dengan tab peralihan antara **"Masuk (Login)"** dan **"Daftar Pengurus"**.
      - Tab Register: Merekam Nama Lengkap, Jabatan RT (Ketua RT, Sekretaris, Bendahara, Seksi Keamanan, Seksi Kebersihan, Seksi Sosial, Warga), Email, dan Password (minimal 6 karakter) dengan toggle lihat/sembunyikan password.
      - Tab Login: Masuk menggunakan email & password. Dilengkapi tombol cepat *Gunakan Akun Cepat Bendahara Demo* (`bendahara@rt02.id` / `admin123`).
    - **Integrasi Supabase Auth & Local Session (`getCurrentPengurusSession`, `loginPengurus`, `registerPengurus`, `logoutPengurus`)**:
      - Menyimpan metadata akun pengurus di Supabase Auth (`user_metadata: { nama, role }`) saat online dan cache lokal terenkripsi di browser.
      - Session persistence: Pengurus tidak perlu login berulang kali setelah browser ditutup atau di-refresh.
    - **Sinkronisasi Profil Dinamis & Tombol Logout di Header & Sidebar**:
      - Avatar inisial, nama, dan jabatan di bilah atas (Header) dan navigasi samping (Sidebar) kini dinamis menampilkan nama pengurus yang sedang login.
      - Tombol **"Keluar (Logout)"** dengan ikon `LogOut` warna merah di popover profil Header dan di bagian bawah Sidebar untuk mengunci kembali aplikasi kas RT.

28. **Perbaikan Tuntas Kendala Login Kembali Setelah Logout**:
    - **Penyebab Masalah Sebelumnya**: Saat logout, `logoutPengurus` membersihkan key sesi aktif `kas_rt_active_user`. Namun, jika Supabase Auth belum mengonfirmasi email (atau sedang offline/jaringan lambat), proses login ulang kehilangan referensi akun karena belum ada penyimpanan registry kredensial terdaftar di perangkat.
    - **Solusi & Registry Akun Lokal Terpadu (`STORAGE_KEY_REGISTERED_USERS`)**:
      - Menyediakan registry pengurus terdaftar (`getLocalRegisteredUsers` & `saveUserToLocalRegistry`).
      - Setiap kali akun baru didaftarkan atau berhasil masuk, akun pengurus dicatat di registry perangkat sehingga pengurus dapat selalu masuk kembali kapan saja dengan email & password yang sesuai, baik saat Supabase online maupun offline.
      - Menghubungkan verifikasi password lokal dan Supabase Auth secara mulus dengan translasi pesan error yang ramah pengguna.
      - **Daftar Akun Cepat & Auto-fill di Layar Login**: Menampilkan daftar kartu akun pengurus yang terdaftar di perangkat tersebut pada layar login, memungkinkan pengurus memilih akun untuk auto-fill instan dan langsung masuk ke buku kas.

29. **Penerapan Permanen Tema Latar Belakang Oranye Gelap pada Halaman Login (`AuthScreen.tsx`)**:
    - **Pilihan Terpilih: Oranye Gelap (Dark Amber)**: Telah diterapkan secara permanen sebagai latar belakang layar login/masuk.
    - **Karakteristik Visual**:
      - Gradien gelap berkelas: `from-slate-950 via-neutral-950 to-orange-950` dipadukan dengan cahaya orbs amber & merah hangat (`bg-orange-600/30`, `bg-amber-500/25`, `bg-red-600/20`).
      - Emblem lambang RT berkilau amber-emas dengan aksen border `border-amber-500/30` dan kartu berbayang hitam pekat eksklusif.
      - Tombol aksi login dengan gradien oranye-amber kontras tinggi (`from-orange-600 via-amber-600 to-orange-700`).
    - **Pembersihan Opsi Uji Coba**: Seluruh opsi varian lain (*Sunset Oranye*, *Oranye Lembut*, *Midnight*) serta bilah tombol pemilih tema (*switcher*) telah dihapus secara bersih dari kode layar login sesuai permintaan pengguna.

30. **Fitur Menu "Data Warga" & Keseragaman Tombol Koreksi & Hapus**:
    - **Menu Data Warga**: Diletakkan tepat di bawah Laporan Keuangan pada dasbor, khusus untuk akun Admin/Pengurus.
    - **Tabel & CRUD Penduduk**: Terhubung langsung ke tabel `data_warga` di Supabase dengan modal entri lengkap (`TambahWargaModal.tsx`) dan pencarian instan (nama, NIK, KK).
    - **Desain Tombol Aksi Seragam**: Tombol Koreksi (ikon pensil `Pencil` abu-abu elegan dengan border dan efek zoom `hover:scale-105`) dan tombol Hapus (ikon tempat sampah `Trash2` dengan aksen merah lembut `bg-rose-50` dan hover merah pekat `hover:bg-rose-600 hover:text-white`) diimplementasikan 100% identik dengan tombol pada halaman Koreksi & Hapus Kas RT, termasuk modal konfirmasi hapus yang menampilkan rincian data warga sebelum dihapus.

31. **Perbaikan Tuntas Fitur "Minta Kode Konfirmasi" Langsung Baca Tabel Pengurus**:
    - **Penyebab Penolakan Sebelumnya**:
      1. Adanya syarat kata sandi (`!password`) dan pencocokan teks polos `spCheck.row.password !== password` yang memblokir permintaan jika kata sandi belum dimasukkan atau berbeda format.
      2. Pengecekan jabatan sebelumnya menggunakan `['Ketua RT', 'Sekretaris', 'Bendahara'].includes(role)` yang kaku terhadap perbedaan spasi atau huruf kapital/kecil (misal `ketua rt`, `Ketua RT.002`, atau jika kolom bernama `role`).
      3. Kueri `findPengurusInSupabaseTable` sebelumnya hanya menggunakan `.eq('email', ...)` yang sensitif terhadap spasi di basis data PostgreSQL.
    - **Solusi yang Diterapkan**:
      - **Pencarian Multi-Tahap `findPengurusInSupabaseTable`**: Menggunakan `ilike` case-insensitive, pencarian exact lowercase, dan pemindaian baris client-side `.trim()` untuk memastikan email pengurus di tabel `pengurus` selalu ditemukan.
      - **Penghapusan Hambatan Password pada Tombol Minta Kode**: Pengurus hanya perlu memasukkan email di kolom email, lalu menekan tombol *"Minta Kode Konfirmasi"*.
      - **Normalisasi Jabatan Cerdas**: Memeriksa kolom `jabatan`, `role`, atau `posisi` secara fleksibel dengan deteksi kata kunci `ketua`, `sekretaris`, `bendahara`, atau `admin` tanpa terpengaruh huruf besar/kecil atau variasi penulisan.
      - **Pengiriman Kode ke WhatsApp Mobile & Web**: Menggunakan deep link `whatsapp://send` untuk aplikasi WhatsApp di HP/mobile dan fallback `https://api.whatsapp.com/send` di peramban web/komputer, dilengkapi tombol aksi langsung *"Buka WhatsApp"* pada pesan sukses.
      - **Toleransi Nomor HP**: Jika kolom nomor telepon di tabel `pengurus` belum terisi, sistem tetap men-generate kode 6 digit dan menampilkannya secara transparan di layar agar proses pendaftaran warga tidak terhenti.

32. **Pembersihan Antarmuka Login (Menghapus Tombol Masuk Cepat & Preset Akun)**:
    - **Menghapus Tombol "Masuk Cepat Sebagai Warga"**: Tombol pintasan 1-klik di bagian bawah formulir telah dihapus secara bersih sehingga setiap warga dan pengurus wajib menggunakan akun terdaftar masing-masing.
    - **Menghapus Tombol "Contoh Akun Cepat" (Bendahara, Ketua RT, Warga)**: Menghapus seluruh tombol preset otomatis di bawah kolom kata sandi.
    - **Tampilan Bersih & Minimalis**: Antarmuka login kini fokus dan rapi, hanya menyisakan isian Email, Kata Sandi, tombol Login ke Dasbor Kas, serta tombol Minta Kode Konfirmasi bagi Pengurus Inti.

33. **Pesan Validasi Kode Konfirmasi Pendaftaran Warga**:
    - Jika kode konfirmasi yang dimasukkan oleh pemohon pendaftaran akun Warga tidak sesuai dengan kode yang dibuat/dikirimkan oleh sistem, antarmuka akan menampilkan pesan kesalahan resmi:
      `"Kode Konfirmasi Tidak Cocok, Silahkan minta kembali kode konfirmasi ke Pengurus Inti"`.
    - Pengecekan dilengkapi toleransi spasi ekstra (`.trim()`) dan pesan ramah ketika kode telah kadaluarsa melewati batas 30 menit.

34. **Bidang Isian Wajib Nomor HP / WhatsApp Khusus Pengurus Inti**:
    - **Muncul Khusus Pengurus Inti**: Bidang isian Nomor HP / WhatsApp secara dinamis hanya ditampilkan ketika pilihan jabatan merupakan Pengurus Inti (*Ketua RT, Wakil Ketua RT, Sekretaris, Bendahara*). Pilihan ini juga diberi tanda bintang emas `★ (Pengurus Inti)` pada dropdown formulir pendaftaran.
    - **Wajib Diisi (Mandatory)**: Dilengkapi badge *"Wajib Diisi Pengurus Inti"*, validasi format nomor (minimal 9-13 digit), dan pesan error penolakan jika dikosongkan.
    - **Integrasi Database**: Nomor HP disimpan ke kolom `no_hp` pada tabel `pengurus` di Supabase, Supabase Auth user metadata, dan registry profil lokal aplikasi, sehingga fitur pengiriman kode konfirmasi via WhatsApp ke pengurus dapat berjalan otomatis.
    - **Akun Warga Tetap Rapi**: Untuk pendaftaran akun Warga, bidang nomor HP ini tidak muncul dan digantikan oleh isian 6 digit Kode Konfirmasi.

35. **Pengalihan Langsung ke Aplikasi WhatsApp Mobile**:
    - **Protokol Native WhatsApp Mobile (`whatsapp://send`)**: Mengganti pengalihan sebelumnya yang menggunakan `api.whatsapp.com` (yang memaksa membuka WhatsApp Web di peramban) dengan skema protokol asli `whatsapp://send?phone=...&text=...`.
    - **Pemicu Langsung Aplikasi HP**: Saat tombol *"Minta Kode Konfirmasi"* diklik, sistem secara otomatis mengeksekusi tautan scheme `whatsapp://send` sehingga aplikasi WhatsApp Mobile di smartphone langsung terbuka menuju chat pengurus dengan draf pesan kode konfirmasi 6 digit.
    - **Tombol Aksi & Alternatif**: Kotak notifikasi sukses menyediakan tombol utama *"Buka Aplikasi WhatsApp Mobile"* yang langsung memanggil aplikasi WhatsApp di perangkat, serta opsi cadangan *"Buka via wa.me"* jika ingin dibuka melalui tautan universal.

36. **Penolakan Otomatis Pendaftaran Jabatan yang Sudah Terisi di Tabel Pengurus**:
    - **Proteksi Struktur Organisasi RT**: Setiap jabatan kepengurusan RT (*Ketua RT, Wakil Ketua RT, Sekretaris, Bendahara, serta Seksi-Seksi*) bersifat eksklusif/tunggal dan tidak boleh didaftarkan ganda oleh pihak lain atau warga yang tidak sengaja memilih jabatan pengurus.
    - **Pengecekan Real-Time Database**: Fungsi `checkJabatanExistsInPengurus` dan `getOccupiedJabatanFromSupabase` secara otomatis memeriksa ke tabel `pengurus` di database Supabase dan registry lokal.
    - **Penolakan Mutlak saat Registrasi**: Jika seorang pendaftar memilih jabatan yang sudah ada di tabel `pengurus` (selain role 'Warga'), sistem langsung menolak pendaftaran baik di tingkat antarmuka formulir maupun di tingkat server/database function `registerPengurus`, dengan pesan penolakan jelas: *"Pendaftaran Ditolak: Jabatan '[Nama Jabatan]' sudah terisi di tabel pengurus atas nama [Nama Pengurus]..."*.
    - **Indikator Visual di Dropdown Pilihan**: Pilihan jabatan pada formulir registrasi secara transparan menampilkan label penanda status keterisian `[Sudah Terisi: Nama Pengurus]`, disertai kartu peringatan (*amber alert*) di bawah dropdown untuk membimbing pendaftar memilih jabatan lain atau mendaftar sebagai *"Warga RT.002 RW.09"*.
37. **Pilihan Default 'Warga RT.002 RW.09' pada Formulir Pendaftaran Akun**:
    - **Prioritas Utama 'Warga'**: Saat pengguna beralih atau mengklik tombol *"Daftar Akun"*, nilai isian pilihan *"Jabatan / Amanah"* secara otomatis terpilih dan memunculkan opsi **Warga RT.002 RW.09** secara default (bukan lagi jabatan pengurus).
    - **Urutan Teratas Dropdown**: Opsi *Warga RT.002 RW.09 (Terbuka untuk Semua Warga)* ditempatkan pada posisi teratas (urutan pertama) dalam menu pilihan `<select>`, diikuti daftar seksi pengurus di bawahnya.
    - **Hak Akses Otomatis**: Memilih Warga secara otomatis mengeset jenis pengguna dan hak akses ke level *User (Warga)* yang hanya berfokus pada dasbor laporan keuangan.
38. **Pembersihan Antarmuka Halaman Login (Penghapusan Kartu 'Pengurus Terdaftar')**:
    - Menghapus kartu daftar "Pengurus Terdaftar" pada tab Login sehingga formulir masuk tampil lebih ringkas, bersih, dan langsung berfokus pada input Alamat Email dan Kata Sandi.

39. **Migrasi dan Sinkronisasi Penuh ke Tabel Database 'pengguna' di Supabase**:
    - **Prioritas Tabel 'pengguna'**: Aplikasi kini mengutamakan tabel `pengguna` di Supabase untuk autentikasi, pengecekan akun, penyimpanan pendaftaran akun baru, validasi jabatan, serta proses backup dan restore.
    - **Backward Compatibility (Fallback Cerdas)**: Seluruh fungsi operasi database (`savePengurusToSupabaseTable`, `findPengurusInSupabaseTable`, `checkJabatanExistsInPengurus`, `getOccupiedJabatanFromSupabase`, `fetchAllPengurusFromSupabase`, dan `restorePengurusToSupabase`) mendukung pengecekan tabel ganda (`pengguna` dan fallback `pengurus`), sehingga seluruh akun yang sudah ada sebelumnya tetap terbaca dan logika kode berjalan tanpa eror.
    - **Skema SQL & Backup/Restore**: Template SQL dan generator dump SQL/JSON kini menggunakan nama tabel `pengguna` lengkap dengan kolom `no_hp` dan kebijakan RLS (Row Level Security).

40. **Ketentuan Mutlak Tampilan Layar Pertama (Halaman Login Mutlak)**:
    - **Migrasi Sesi ke Session Storage**: Seluruh penyimpanan sesi pengguna aktif (`kas_rt_active_user`) dan konfigurasi penyimpanan token Supabase Auth telah dimigrasikan sepenuhnya dari `localStorage` (penyimpanan lokal permanen) ke `sessionStorage` (penyimpanan berbasis sesi/tab).
    - **Kewajiban Login Pertama**: Dengan transisi ini, setiap kali peramban (*browser*) atau tab baru dibuka untuk mengakses aplikasi, sesi dipastikan dalam keadaan kosong (bersih). Hal ini secara mutlak memaksa aplikasi memunculkan halaman **Login** terlebih dahulu sebagai gerbang utama sebelum pengguna dapat mengakses dasbor utama.
    - **Preservasi Penyegaran Halaman**: Sesi tetap terjaga dengan aman apabila pengguna melakukan penyegaran halaman (*page refresh*) di tab yang sama, menjaga kenyamanan penggunaan tanpa harus login ulang terus-menerus selama sesi tab aktif.

41. **Sub-Menu Segmented Dasbor Data Warga (Transaksi Iuran & Kelola Data Warga)**:
    - **Dua Sub-Menu Dinamis**: Menambahkan bilah sub-menu berdesain segmented control modern yang membagi halaman Data Warga menjadi dua tab fungsional: **Transaksi Iuran** dan **Kelola Data Warga**.
    - **Transaksi Iuran (Pencatatan Instan)**: 
      - Menyediakan sistem pencatatan iuran warga yang intuitif dengan fitur pencarian cepat warga dari tabel `data_warga` Supabase.
      - Pilihan kategori iuran lengkap (Iuran Warga, Kebersihan, Iuran Wajib, dll.), tanggal, bulan, serta tahun tagihan.
      - Input nominal dengan tombol pintas cepat (+Rp 20.000, +Rp 25.000, +Rp 50.000, +Rp 100.000) dan isian deskripsi otomatis/manual.
      - Penyimpanan langsung ke tabel `kas_rt` di Supabase, yang secara instan menyinkronkan total saldo kas utama di seluruh bagian aplikasi (buku kas, laporan keuangan, grafik bulanan) berkat pemicu callback `onRefreshTransactions`.
      - Menampilkan tabel riwayat penerimaan iuran terbaru yang langsung difilter dari database Supabase secara real-time.
    - **Kelola Data Warga (Basis Data Demografi)**: 
      - Menyimpan seluruh fitur manajemen demografi warga asli (tabel daftar warga, tambah warga, koreksi data, dan hapus warga berbasis Supabase) secara terpisah, rapi, dan mudah dioperasikan.

42. **Integrasi Dinamis Kategori Iuran dengan Tabel Kategori Supabase**:
    - **Pengambilan Data Live**: Dropdown pilihan *"Kategori Iuran"* pada sub-menu Transaksi Iuran kini tidak lagi menggunakan data statis, melainkan langsung mengambil daftar kategori tipe **'Masuk'** (Pemasukan) dari tabel `kategori` di Supabase secara real-time.
    - **Fallback Aman (Graceful Handling)**: Jika tabel kategori kosong atau tidak dapat diakses sementara, sistem otomatis kembali (*fallback*) menggunakan daftar iuran bawaan agar operasional pencatatan tetap berjalan tanpa gangguan.
    - **Sifat Reaktif & Sinkron**: Perubahan yang dilakukan melalui menu "Kelola Kategori" (menambah, mengubah, atau menghapus kategori iuran) seketika tercermin pada pilihan opsi di formulir Transaksi Iuran.

43. **Relasional Transaksi Kas (`kas_rt`) dengan Data Kependudukan (`data_warga`)**:
    - **Kolom Kunci Asing `warga_id`**: Menambahkan kolom `warga_id` (tipe UUID) pada tabel `kas_rt` yang bertindak sebagai Foreign Key relasional menuju kolom `id` pada tabel `data_warga` dengan aksi `ON DELETE SET NULL`.
    - **Pencatatan Transaksi Terhubung**: Setiap kali transaksi iuran dicatat melalui halaman warga, ID warga bersangkutan secara otomatis dikirimkan dan disimpan dalam kolom `warga_id` tabel `kas_rt` di Supabase.
    - **Pembaruan Skema SQL Global**: Memperbarui variabel `SUPABASE_SQL_SCHEMA` bawaan aplikasi agar ketika pengurus menyalin script database dari menu pengaturan, perintah modifikasi kolom relasi (`ALTER TABLE kas_rt ADD COLUMN IF NOT EXISTS warga_id...`) otomatis disertakan.

44. **Dukungan Pencatatan Transaksi Tunggal & Serempak (Semua Warga)**:
    - **Segmented Mode Toggle**: Menambahkan bilah pilihan di bagian atas formulir entri iuran untuk beralih antara mode **Satu Warga (Tunggal)** dan **Semua Warga (Serempak)**.
    - **Checklist & Saringan Warga**: Pada mode serempak, aplikasi menyediakan checklist daftar warga interaktif yang dilengkapi saringan (*search filtering*) pencarian instan, tombol pintas **Pilih Semua**, dan **Kosongkan**.
    - **Pra-pilih Otomatis**: Saat beralih ke mode serempak, sistem secara cerdas langsung memberi tanda centang pada seluruh warga terdaftar sebagai default untuk menghemat klik pengurus.
    - **Penyimpanan Batch Paralel**: Memanfaatkan `Promise.all` untuk menyimpan seluruh iuran warga yang dicentang secara paralel ke database Supabase `kas_rt`, di mana setiap baris transaksi yang dihasilkan otomatis memuat nominal iuran dan deskripsi personal yang disesuaikan dengan nama masing-masing warga bersangkutan.
    - **Perbaikan Tombol Simpan**: Memperbaiki logika `disabled` pada tombol submit utama yang sebelumnya mengunci tombol secara keliru jika `selectedWargaId` tunggal kosong, sehingga kini tombol aktif secara dinamis mendeteksi jumlah centang pada mode serempak.
    - **Pencarian Nama & Alamat Serempak**: Menambahkan filter pencarian interaktif berdasarkan **Nama** dan **Alamat Domisili** pada daftar warga di mode serempak, lengkap dengan tombol silang (X) untuk membersihkan kata kunci pencarian secara cepat, memudahkan pengurus menyaring warga tertentu dan menonaktifkan checklist iuran warga tersebut tanpa harus menggulir (scroll) daftar yang panjang.
    - **Proteksi Iuran Ganda (Sudah Lunas)**: Sistem kini memiliki validasi otomatis untuk mencegah warga ditagih dua kali pada kategori, bulan, dan tahun yang sama.
      - *Satu Warga (Tunggal)*: Menampilkan *badge* "Sudah Lunas" pada nama warga di daftar pencarian dan memunculkan error peringatan (Toast) jika pengurus memaksa menyimpan.
      - *Semua Warga (Serempak)*: Warga yang sudah lunas otomatis dinonaktifkan dari daftar centang (kotak centang terkunci abu-abu), menampilkan *badge* lunas, dan tombol "Pilih Semua" otomatis mengecualikan mereka dari seleksi sehingga aman dari transaksi ganda yang tidak disengaja.
    - **Memori Nilai Default per Kategori**: Mengimplementasikan penyimpanan nilai nominal pintar menggunakan `localStorage`. Setiap kali pengurus mengetik atau menekan tombol nominal (misal: 25.000 untuk Iuran Wajib, 50.000 untuk Iuran Keamanan), nilai tersebut akan langsung disimpan sebagai default spesifik untuk kategori tersebut. Ketika pengurus memilih kategori itu kembali, nilai nominal akan terisi otomatis, menghemat waktu dan menghilangkan pengetikan ulang.

45. **Resolusi Tuntas Browser `TypeError: NetworkError when attempting to fetch resource`**:
    - **Akar Masalah**: Error ini terjadi pada level browser (terutama Firefox, Brave Shields, atau ekstensi adblock/anti-tracking) yang memblokir permintaan lintas domain (*cross-origin fetch*) ke `https://*.supabase.co` saat aplikasi dijalankan di dalam iFrame atau lingkungan terkunci.
    - **Solusi Same-Origin Proxy di Vite Middleware (`vite.config.ts`)**:
      - Menyediakan endpoint proxy lokal `/api/supabase-proxy/*` yang dijalankan di level server dev Vite.
      - Membaca konfigurasi `VITE_SUPABASE_URL` langsung dari file `.env` dan mendukung penerusan header dinamis `x-supabase-target-url`.
      - Karena request diarahkan ke asal yang sama (*same-origin*), seluruh pembatasan CORS, AdBlocker, pelacakan browser, maupun limitasi iframe tertangani 100%.
    - **Mekanisme Auto-Healing `resilientFetch` (`supabase.ts`)**:
      - Menginjeksi custom fetch handler pada inisialisasi `@supabase/supabase-js`.
      - Jika fetch langsung ke Supabase berhasil, sistem berjalan normal tanpa overhead.
      - Jika browser mendeteksi `NetworkError`, `resilientFetch` secara otomatis dan transparan mengalihkan request ke `/api/supabase-proxy` tanpa memutus alur aplikasi atau menampilkan error ke pengguna.
    - **Pembersihan URL Basis (`.env`)**: Memastikan `VITE_SUPABASE_URL` tidak memiliki akhiran path `/rest/v1/` untuk mencegah duplikasi path PostgREST.

46. **Fitur Keluar Sistem / Tutup Aplikasi dari Layar Login (`AppExitScreen.tsx`)**:
    - **Aksi Keluar Langsung**: Saat tombol **"Keluar"** (`LogOut`) pada formulir Login diklik (baik di peramban web komputer maupun di ponsel/HP), sistem secara otomatis mengeksekusi penutupan aplikasi (`window.close()`).
    - **Peniadaan Form Login (Halaman Login Hilang)**: Karena sebagian peramban web membatasi penutupan tab otomatis demi keamanan, aplikasi seketika menghilangkan formulir login dari layar dan mengalihkan status ke tampilan **"Sistem Telah Ditutup / Sesi Berakhir"** (`AppExitScreen`).
    - **Layar Penutupan yang Bersih & Aman**: Menampilkan identitas RT, status keluar aman, rincian waktu keluar (WIB & tanggal), tombol *"Tutup Tab / Keluar"*, serta tombol *"Buka Kembali Halaman Login"* jika pengguna ingin membuka kembali aplikasi tanpa harus memuat ulang (*refresh*) halaman manual.

47. **Penyederhanaan & Penataan Tombol Darurat SOS (Hanya 1 di Menu Utama `Sidebar.tsx`)**:
    - **Pembersihan dari Seluruh Header Halaman**: Menghapus tombol SOS dari bilah *Header* atas (`Header.tsx`), sehingga tombol tidak lagi muncul berulang di setiap halaman/sub-halaman pembukuan.
    - **Pemusatan di Menu Utama**: Tombol Sinyal Darurat (SOS) kini hanya tampil 1 tempat yaitu di dalam bagian **Menu Utama** pada navigasi samping (*Sidebar*).
    - **Ukuran Proporsional & Elegan**: Ukuran tombol ringkas (`px-3.5 py-2.5 rounded-xl`), dengan ikon `ShieldAlert` dan badge *Darurat* yang proporsional serta tidak mengganggu konsentrasi pengguna.

48. **Penyempurnaan Visual Mewah & Desain Eksekutif Modern (Fintech Aesthetic)**:
    - **Kartu Metrik & Saldo Eksekutif**: Mengadopsi gradasi *deep obsidian-emerald* bertekstur kaca (*luxury dark card & backdrop blur*) dengan aksen *glow ambient*, ring border halus berdaya pantul tinggi, dan tipografi monospaced tabular (`tabular-nums`) untuk kejelasan angka finansial.
    - **Peningkatan Kartu Kas Masuk & Keluar**: Menggunakan kartu rounded-2xl dengan subtle multi-stop gradients, duotone icon badges berbayangan lembut, dan indikator status akuntansi yang bersih.
    - **Standar Zero-Pill & Tipografi Rapi**: Menjaga kebersihan antarmuka dari badge berlebihan, menggunakan separator tipografis halus (`·`), dan memberikan proporsi spasial yang lapang pada desktop maupun ponsel.

49. **Optimalisasi Responsif untuk Layar Laptop Kecil & Layar Berskala Tinggi (Compact Viewport)**:
    - **Pengurangan Ketinggian Vertikal Berlebih**: Mengurangi padding atas `pt-16 sm:pt-18` dan margin antar seksi (`space-y-4 sm:space-y-5`) sehingga seluruh dashboard langsung terlihat (*above the fold*) tanpa harus terus-menerus menggulir (*scroll*).
    - **Penyesuaian Skala Kartu & Formulir**: Padding kartu (`p-4 sm:p-5`), input form, dan tombol subtab dibuat lebih ringkas dan proporsional untuk layar laptop 13–14 inci (resolusi 1366x768 atau skala 125%/150%).
    - **Tabel Data Kompak**: Padding baris tabel disesuaikan ke `py-2.5 px-3.5 sm:px-4` sehingga mampu menampilkan lebih banyak baris mutasi dalam satu pandangan layar laptop.

50. **Resolusi Tuntas Modal SOS Terpotong & Tombol Batal Tidak Tampak (`DaruratTriggerModal.tsx`)**:
    - **Akar Masalah**: Modal formulir SOS sebelumnya menggunakan `overflow-hidden` tanpa batasan tinggi adaptif (`max-h-[90vh]`) dan tanpa pembagian seksi sticky, sehingga pada layar laptop pendek (resolusi 1366x768 atau skala Windows 125%/150%), bagian bawah modal terpotong di bawah layar dan tidak bisa digulir (*scroll*).
    - **Header & Footer Tetap (Sticky / Fixed)**:
      - Header merah atas dan bilah tombol aksi bawah dipasang secara *fixed / sticky*.
      - Tombol **"Batal"** (dengan ikon panah kembali `ArrowLeft`) kini **selalu tampak dan bisa diklik seketika** di bagian kiri bawah modal tanpa perlu menggulir.
      - Tombol silang `X` di pojok kanan atas tetap tersedia.
      - Penambahan tombol pintas keyboard `ESC` dan klik area luar (*backdrop click*) untuk membatalkan/menutup modal kapan saja.
    - **Area Formulir Dapat Digulir (*Scrollable Content*)**: Badan formulir kini memiliki `overflow-y-auto` fleksibel dengan pembatasan tinggi `max-h-[92vh] sm:max-h-[90vh]`, sehingga seluruh opsi dan keterangan dapat digulir dengan sangat lancar pada layar laptop ukuran apa pun.

51. **Pengembalian Tipografi Font Angka / Nominal ke Versi Sebelumnya**:
    - **Peniadaan Gaya Font Monospace (`font-mono`) pada Angka**: Menghapus kelas `font-mono` dari seluruh tampilan nominal Rupiah dan metrik angka di seluruh aplikasi (`InputRiwayatView`, `LaporanKeuanganView`, dan `KoreksiHapusView`).
    - **Kembali ke Tipografi Sans-Serif Bersih (Plus Jakarta Sans)**: Seluruh angka nominal saldo, total kas masuk/keluar, dan rincian transaksi pada tabel kini kembali menggunakan font standar sans-serif yang tebal, tegas, dan natural sesuai preferensi kenyamanan pengguna.

52. **Penghapusan Tulisan NIK pada Kolom Tanda Tangan Cetak PDF (`PrintPreviewModal.tsx`)**:
    - **Pembersihan Teks NIK**: Menghapus tulisan "NIK: ..." di bawah garis nama penandatangan (Ketua RT & Bendahara) pada lembar cetak fisik, unduhan berkas PDF, serta layar pratinjau (*preview*).
    - **Tampilan Tanda Tangan Resmi & Rapi**: Bagian bawah tanda tangan kini menampilkan nama penandatangan dengan garis bawah dan keterangan jabatan resmi (*Pengurus Lingkungan* / *Pengelola Kas RT*) yang bersih, rapi, dan menjaga privasi nomor identitas pengurus.

53. **Menu Navigasi Utama Dapat Digulir (*Smooth Scrollable Sidebar Navigation*) (`Sidebar.tsx`)**:
    - **Akar Masalah**: Sebelumnya seluruh sidebar dibungkus dalam satu kontainer statis `overflow-hidden`, sehingga saat menu atau sub-menu diperluas di layar laptop dengan tinggi vertikal terbatas, menu di bagian bawah tidak bisa digulir dan terpotong.
    - **Struktur 3 Bagian (Fixed Header, Scrollable Nav, Fixed Footer)**:
      1. **Header Identitas RT (Fixed Top)**: Logo dan nama wilayah RT tetap terpampang rapi di atas tanpa ikut tergeser.
      2. **Menu Utama Scrollable (Flex-1 Overflow-Y-Auto)**: Seluruh tombol menu (Input & Riwayat, Koreksi & Hapus, Inventaris, Laporan Keuangan, dan Kelola Data & Master berserta 2 sub-menunya) kini dapat digulir naik-turun dengan sangat mulus, dilengkapi scrollbar gelap tipis yang elegan (`custom-scrollbar-dark`).
      3. **Profil Pengguna & Status Supabase (Fixed Bottom)**: Kartu pengguna aktif, tombol logout, dan status koneksi database tetap terkunci rapi di bagian bawah sidebar.

54. **Optimalisasi Ukuran & Reposisi Tombol Sinyal Darurat (SOS) (`Header.tsx` & `Sidebar.tsx`)**:
    - **Peniadaan Tombol Raksasa di Atas Menu**: Menghapus banner merah besar yang sebelumnya menumpuk di atas menu utama sidebar sehingga daftar navigasi menjadi bersih dan tidak sesak.
    - **Tombol SOS Kompak di Header Bilah Atas**: Menempatkan tombol mini `[ 🚨 SOS ]` beraksen merah lembut di toolbar kanan header (di samping pemilih tema dan profil), mudah dijangkau dengan 1 klik dari mana saja tanpa memenuhi ruang kerja halaman.
    - **Tombol Sekunder Ramping di Footer Sidebar**: Menambahkan tombol alternatif yang ramping dan proporsional di footer sidebar tepat di atas kartu profil pengguna.
    - **Bebas Polusi Visual pada Setiap Halaman**: Tidak ada tombol darurat yang dipasang di dalam konten halaman (seperti di Input Riwayat, Koreksi Hapus, atau Laporan Keuangan), menjaga fokus pembukuan kas tetap profesional dan bersih.

55. **Penyempurnaan Totalitas 8 Tabel untuk Backup/Restore dan Ekspor/Impor (`backupUtils.ts`, `exportUtils.ts`, `importUtils.ts`, `BackupModal.tsx`, `RestoreModal.tsx`, `ExportModal.tsx`, `ImportModal.tsx`, `KelolaDataView.tsx`)**:
    - **Cakupan 8 Tabel Resmi**:
      1. `kas_rt` (Buku Kas & Transaksi Masuk/Keluar)
      2. `kategori` (Master Pos Kategori Kas)
      3. `pengguna` (Akun Pengurus & Hak Akses)
      4. `data_warga` (Master Data Kependudukan)
      5. `sekretariat` (Profil & Identitas Wilayah RT)
      6. `inventaris_rt` (Buku Inventarisasi Sarana & Aset RT)
      7. `peminjaman_aset_rt` (Log Peminjaman Barang Warga)
      8. `darurat_rt` (Log Peringatan Sinyal Darurat / Panic Alert SOS)
    - **Fitur Backup 8 Tabel**:
      - Generator JSON & SQL Dump Supabase (`generateBackupJSON` dan `generateSupabaseSQLDump`) kini secara komprehensif mengemas seluruh 8 tabel ke dalam file snapshot JSON maupun script SQL DDL & DML INSERT.
      - `BackupModal.tsx` secara otomatis memuat status seluruh 8 tabel dan menampilkan grid ringkasan 8 tabel terhubung sebelum diunduh.
    - **Fitur Restore 8 Tabel**:
      - Parser SQL cerdas (`parseSQLBackup`) dan parser JSON (`parseBackupFile`) mengekstrak data dari seluruh 8 tabel.
      - `RestoreModal.tsx` menampilkan pratinjau data lengkap 8 tabel beserta jumlah barisnya dan mendukung pemulihan dalam mode *Gabungkan Data (Merge)* maupun *Timpa Bersih (Replace)* ke Supabase atau LocalStorage.
    - **Fitur Ekspor 8 Tabel**:
      - Opsi baru **"Master Workbook Excel 8 Tabel (.xlsx)"** di modal ekspor (`ExportModal.tsx`) yang membuat berkas Excel terpadu dengan 8 lembar kerja (*sheet*) terpisah untuk masing-masing tabel.
    - **Fitur Impor & Template 8 Tabel**:
      - Menambahkan opsi unduh **Master Template 8 Tabel (.xlsx)** di `ImportModal.tsx` (`downloadMasterExcelTemplate`) di samping template buku kas standar, memudahkan pengurus mengisi dan mengunggah master data secara serempak.

56. **Penyederhanaan Total Sistem Siaga SOS Terintegrasi WhatsApp Broadcast 1-Klik (`DaruratTriggerModal.tsx`, `DaruratSirenModal.tsx`, `Header.tsx`, `App.tsx`)**:
    - **Pembersihan Fitur Rumit / Ribet**:
      - Menghapus sepenuhnya modal pengaturan perizinan notifikasi yang membingungkan (`DaruratNotificationModal.tsx`), tombol lonceng pengaturan di header, serta trik pemutaran audio hening (*silent keep-alive loop*) yang boros baterai dan sering diintervensi oleh sistem operasi ponsel.
    - **Penerapan Sistem Baru yang 100% Simpel & Teruji di Lapangan**:
      1. **Tombol SOS Bersih & Jelas di Header & Sidebar**:
         - Tombol **"🚨 SOS"** di header atas kini tampil tegas, terang, dan beranimasi denyut halus (*pulse*), mudah diakses oleh warga dalam 1 ketukan.
      2. **Pemicu Darurat Terpadu WhatsApp (`DaruratTriggerModal.tsx`)**:
         - Form pemilihan kategori darurat (Medis, Keamanan, Kebakaran, Bencana, dll) beserta catatan situasi.
         - Tombol aksi utama: **"🚨 KIRIM SOS & WHATSAPP"**:
           - Menyimpan sinyal ke database Supabase `darurat_rt` seketika (memicu sirene pada seluruh perangkat yang sedang membuka aplikasi).
           - **Otomatis membuka WhatsApp** dengan pesan darurat berformat tebal (*bold*) lengkap (Nama pengirim, Kategori, Lokasi TKP, Kontak Telepon, Keterangan, dan Tautan Buka Aplikasi) siap kirim ke Grup WhatsApp RT.002.
         - Tombol alternatif: **"Kirim ke Sistem Saja"** jika tidak ingin membuka WhatsApp.
         - Layar konfirmasi sukses yang bersih dengan tombol **"Buka WhatsApp Sekarang"** dan tombol **"Salin Teks Pesan SOS"**.
      3. **Respon Cepat Pada Layar Alarm Sirene (`DaruratSirenModal.tsx`)**:
         - Menampilkan kartu identitas korban/pengirim dengan tombol cepat **"Telepon"** (`tel:`) dan **"WhatsApp"** langsung ke nomor HP korban.
         - Tombol **"Bagikan ke WhatsApp RT"** agar pengurus/tetangga lain yang menerima alarm dapat langsung meneruskan info darurat ke grup RT.
         - Tombol aksi lapangan: **"Matikan Suara"**, **"Saya Segera Datang! 🏃"**, dan **"Situasi Teratasi ✅"**.

57. **Penghapusan Frame Banner 'Muat Data Contoh ke Supabase'**:
    - Menghapus frame banner pembantu yang muncul saat tabel `kas_rt` Supabase terhubung dalam kondisi kosong di `App.tsx`.
    - Menjadikan tampilan antarmuka dasbor kas lebih bersih, ringkas, dan bebas dari elemen pengisi data contoh yang tidak diperlukan.

58. **Pemberlakuan Wajib Terdaftar di Buku Data Warga untuk Seluruh Pendaftaran Akun (`AuthScreen.tsx`)**:
    - **Proteksi Registrasi Serempak**: Seluruh calon pendaftar akun (baik Warga maupun Pengurus RT/pengurus lain seperti Ketua RT, Sekretaris, Bendahara, Seksi, dll.) kini **wajib terdaftar di Buku Data Warga (`data_warga`)** terlebih dahulu sebelum dapat membuat akun baru.
    - **Validasi Mutlak**: Menghapus isian nama manual terbuka untuk pengurus dan menggantikannya dengan komponen pencarian serta pemilihan data warga terverifikasi.
    - **Pesan Penolakan Jelas**: Jika nama pemohon tidak ditemukan di Data Warga, sistem secara mutlak menolak pendaftaran dengan pesan: *"Pendaftaran Ditolak! Anda belum terdaftar di Buku Data Warga. Seluruh Pengurus maupun Warga wajib terdaftar di Data Warga terlebih dahulu sebelum dapat membuat akun."*
    - **Relasi Otomatis**: NIK, No. KK, Alamat Domisili, dan ID Warga (`warga_id`) otomatis terhubung secara relasional saat akun didaftarkan.

59. **Resolusi Error 401 Cron-Job.org & Endpoint Keep-Alive Supabase (`vite.config.ts` & `SupabaseModal.tsx`)**:
    - **Penyebab Error 401**: PostgREST / REST API Supabase mewajibkan `apikey` header atau query parameter untuk seluruh request. Pinging tanpa `apikey` menghasilkan `401 Unauthorized`.
    - **Penyediaan Endpoint Ping Backend (`/api/ping` & `/api/cron-keepalive`)**:
      - Ditambahkan pada proxy server `vite.config.ts`.
      - Menerima ping publik dari Cron-Job.org tanpa error 401 dan secara aman mengeksekusi request ringan ke Supabase dengan menyertakan `apikey` secara otomatis dari server environment.
    - **Penyediaan Panel & Tombol 'Salin URL Cron-Job' di Modal Supabase**:
      - Menyediakan tombol 1-klik **"Salin URL Cron-Job"** di `SupabaseModal.tsx` yang secara otomatis menyalin URL lengkap yang sudah dilengkapi query string `&apikey=...` sesuai kredensial Supabase aktif.

---

## 5. Rencana & Opsi Pengembangan Berikutnya (Dapat Dilanjutkan Nanti)
- [ ] Fitur Cetak Kuitansi / Bukti Penerimaan Iuran (PDF per transaksi).
- [ ] Pencatatan data nomor rumah / blok warga untuk rekap pembayaran iuran per KK.
- [ ] Penambahan hak akses atau password proteksi untuk menu Koreksi/Hapus.
- [ ] Fitur unduh laporan bulanan siap cetak dalam format PDF resmi RT.


