import { Transaction, CategoryItem } from '../types';

export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const APP_LOGO_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCfhsg_aiC_UIC601axqiHgroX5wP9JYDq2e5CGY0WvbuNwD77xfT_cA7JKf8XgoLfqnv92hmNMRNAgyM_oJqzDytEOTxPVdt3X2aN_J7zNH3sEalISLukZZvsqvAJSgltEn_ptMR9RAcE6fG2GsSBsFhHzmWOVgJ0qfL6DlpOF69hFgd96Lx6N2MnpEfXLSltfZU_7vvZPG7XoPp6_VM-RzmseN_Jma3Ngxjf1zSwW1e152aMUL8Sv';

export const INITIAL_CATEGORIES: CategoryItem[] = [];

export const CATEGORIES_BY_TYPE = {
  Masuk: [
    { value: 'Iuran Warga', label: 'Iuran Warga (Bulanan)' },
    { value: 'Iuran Wajib', label: 'Iuran Wajib Warga' },
    { value: 'Iuran Perbaikan Jalan', label: 'Iuran Perbaikan Jalan' },
    { value: 'Bantuan Pembangunan Masjid', label: 'Bantuan Pembangunan Masjid' },
    { value: 'Biaya keRTan', label: 'Biaya keRTan' },
    { value: 'Donasi', label: 'Donasi / Sumbangan Sukarela' },
    { value: 'Kebersihan', label: 'Iuran Kebersihan' },
    { value: 'Sosial', label: 'Dana Sosial Masuk' },
    { value: 'Lainnya', label: 'Pemasukan Lainnya / Denda' }
  ],
  Keluar: [
    { value: 'Operasional', label: 'Operasional & Perawatan RT' },
    { value: 'Biaya keRTan', label: 'Biaya keRTan' },
    { value: 'Iuran Perbaikan Jalan', label: 'Iuran Perbaikan Jalan' },
    { value: 'Bantuan Pembangunan Masjid', label: 'Bantuan Pembangunan Masjid' },
    { value: 'Keamanan', label: 'Keamanan & Ronda Malam' },
    { value: 'Kebersihan', label: 'Honor Petugas Kebersihan' },
    { value: 'Sosial', label: 'Bantuan Sosial / Kematian / Sakit' },
    { value: 'Konsumsi', label: 'Konsumsi Rapat Warga' },
    { value: 'Infrastruktur', label: 'Perbaikan Lampu Jalan & Fasum' }
  ]
};

// Susunan Pengurus RT
export const SUSUNAN_PENGURUS_RT = [
  { no: 1, role: 'Ketua RT', label: 'Ketua RT', deskripsi: 'Pimpinan & penanggung jawab umum RT' },
  { no: 2, role: 'Wakil Ketua RT', label: 'Wakil Ketua RT', deskripsi: 'Mendampingi & mewakili Ketua RT dalam koordinasi wilayah' },
  { no: 3, role: 'Sekretaris', label: 'Sekretaris', deskripsi: 'Pengadministrasian surat-menyurat & kearsipan warga' },
  { no: 4, role: 'Bendahara', label: 'Bendahara', deskripsi: 'Pengelolaan buku kas, mutasi penerimaan & pengeluaran RT' },
  { no: 5, role: 'Seksi Keamanan', label: 'Seksi Keamanan', deskripsi: 'Koordinasi ronda malam, pos kamling & ketertiban lingkungan' },
  { no: 6, role: 'Seksi Sarana & Prasarana', label: 'Seksi Sarana & Prasarana', deskripsi: 'Pemeliharaan fasilitas umum, jalan, penerangan & sarpras RT' },
  { no: 7, role: 'Seksi Humas', label: 'Seksi Humas', deskripsi: 'Penghubung komunikasi, informasi warga & hubungan masyarakat' },
  { no: 8, role: 'Seksi Kerohanian', label: 'Seksi Kerohanian', deskripsi: 'Kegiatan keagamaan, peribadatan & kerukunan umat beragama' },
  { no: 9, role: 'Seksi Pemuda & Olahraga', label: 'Seksi Pemuda & Olahraga', deskripsi: 'Pembinaan karang taruna, kegiatan pemuda & agenda olahraga' },
  { no: 10, role: 'Seksi Pemberdayaan Perempuan', label: 'Seksi Pemberdayaan Perempuan', deskripsi: 'Kegiatan PKK, posyandu & pemberdayaan wanita di lingkungan RT' },
];

export function formatRupiah(num: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num).replace('IDR', 'Rp').trim();
}

export function formatSimpleRupiah(num: number): string {
  return 'Rp ' + Number(num).toLocaleString('id-ID');
}

export function formatDateIndo(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const raw = dateStr.split('T')[0].trim();
    const parts = raw.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const dateObj = new Date(year, month - 1, day);
        // Menggunakan toLocaleDateString('id-ID') sesuai standar Indonesia
        const formatted = dateObj.toLocaleDateString('id-ID', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        // Penguncian ekstra: jika browser lokal fallback ke format Amerika (mm/dd/yyyy),
        // paksa urutan selalu dd/mm/yyyy (hari/bulan/tahun)
        const d = String(day).padStart(2, '0');
        const m = String(month).padStart(2, '0');
        const y = String(year);
        // Jika formatted mengandung pemisah dan diawali hari yang sesuai, gunakan atau kunci ke dd/mm/yyyy
        return `${d}/${m}/${y}`;
      }
    }
    const dateObj = new Date(dateStr);
    if (!isNaN(dateObj.getTime())) {
      const d = String(dateObj.getDate()).padStart(2, '0');
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const y = dateObj.getFullYear();
      return `${d}/${m}/${y}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
}
