export const BULAN_LIST = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

const MONTH_NAME_TO_INDEX: Record<string, number> = {
  januari: 0,
  jan: 0,
  februari: 1,
  feb: 1,
  maret: 2,
  mar: 2,
  april: 3,
  apr: 3,
  mei: 4,
  juni: 5,
  jun: 5,
  juli: 6,
  jul: 6,
  agustus: 7,
  agu: 7,
  agt: 7,
  september: 8,
  sep: 8,
  oktober: 9,
  okt: 9,
  november: 10,
  nov: 10,
  desember: 11,
  des: 11,
};

const MONTH_TOKEN_PATTERN =
  'januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|mei|jun|jul|agu|agt|sep|okt|nov|des';

const escapeRegex = (str: string): string =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Bersihkan gelar/sapaan di awal nama warga agar pencocokan lebih akurat.
 */
export const cleanPersonName = (str?: string): string =>
  (str || '')
    .toLowerCase()
    .replace(
      /^(bpk\.?|bapak\.?|ibu\.?|ibuk\.?|pak\.?|h\.?|hj\.?|sdr\.?|sdri\.?)\s+/i,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Normalisasi field transaksi baik dari row Supabase (tanggal, kategori, keterangan, warga_id)
 * maupun dari tipe frontend Transaction (date, category, description, wargaId).
 */
export interface NormalizedIuranTx {
  id?: string;
  tanggal: string;
  jenis: string;
  kategori: string;
  jumlah: number;
  keterangan: string;
  warga_id?: string | null;
  raw?: any;
}

export const normalizeIuranTx = (tx: any): NormalizedIuranTx => ({
  id: tx?.id ? String(tx.id) : undefined,
  tanggal: String(tx?.tanggal ?? tx?.date ?? ''),
  jenis: String(tx?.jenis ?? tx?.type ?? ''),
  kategori: String(tx?.kategori ?? tx?.category ?? ''),
  jumlah: Number(tx?.jumlah ?? tx?.amount ?? 0) || 0,
  keterangan: String(tx?.keterangan ?? tx?.description ?? ''),
  warga_id: tx?.warga_id ?? tx?.wargaId ?? null,
  raw: tx,
});

const parseMonthIndicesFromText = (text: string): number[] => {
  const found = new Set<number>();
  if (!text) return [];

  // Pola 1: Rentang bulan (misal: "Okt - Des", "Januari s/d Desember", "Nov sampai Des")
  const rangeRegex = new RegExp(
    `\\b(${MONTH_TOKEN_PATTERN})\\s*(?:s\\/?d|sampai|[-–—])\\s*(${MONTH_TOKEN_PATTERN})\\b`,
    'gi'
  );
  let rMatch: RegExpExecArray | null;
  while ((rMatch = rangeRegex.exec(text)) !== null) {
    const startIdx = MONTH_NAME_TO_INDEX[rMatch[1].toLowerCase()];
    const endIdx = MONTH_NAME_TO_INDEX[rMatch[2].toLowerCase()];
    if (startIdx !== undefined && endIdx !== undefined && startIdx <= endIdx) {
      for (let i = startIdx; i <= endIdx; i++) {
        found.add(i);
      }
    }
  }

  // Pola 2: Nama bulan tunggal atau didahului "bulan"/"bln" (termasuk "(Desember 2026)" maupun "(Bulan Desember 2026)")
  const monthRegex = new RegExp(
    `\\b(?:bulan\\s+|bln\\.?\\s+)?(${MONTH_TOKEN_PATTERN})\\b`,
    'gi'
  );
  let mMatch: RegExpExecArray | null;
  while ((mMatch = monthRegex.exec(text)) !== null) {
    const idx = MONTH_NAME_TO_INDEX[mMatch[1].toLowerCase()];
    if (idx !== undefined) {
      found.add(idx);
    }
  }

  // Pola 3: Angka bulan eksplisit "bulan 12" / "bln 12"
  const numRegex = /\b(?:bulan|bln\.?)\s+(0?[1-9]|1[0-2])\b/gi;
  let nMatch: RegExpExecArray | null;
  while ((nMatch = numRegex.exec(text)) !== null) {
    const numM = parseInt(nMatch[1], 10);
    if (!isNaN(numM) && numM >= 1 && numM <= 12) {
      found.add(numM - 1);
    }
  }

  return Array.from(found).sort((a, b) => a - b);
};

/**
 * Ekstrak daftar periode (nama bulan & tahun) dari sebuah transaksi kas.
 * Mendukung format:
 * - "Warga (Desember 2026) - Bpk. Ahmad" (Bayar PerOrangan)
 * - "Warga (Bulan Desember 2026) - Bpk. Ahmad" (Bayar Serempak)
 * - "Iuran Warga Okt - Des 2026 - Bpk. Ahmad" (Multi-bulan)
 * - Fallback ke tanggal transaksi YYYY-MM-DD bila keterangan tidak menyebut bulan.
 */
export const extractPeriodsFromTx = (
  txInput: any
): Array<{ monthName: string; year: string }> => {
  const tx = normalizeIuranTx(txInput);
  const desc = tx.keterangan.toLowerCase();

  // Ekstraksi Tahun (4 digit)
  let year = '';
  const yearMatch = desc.match(/\b(202\d|203\d)\b/);
  if (yearMatch && yearMatch[1]) {
    year = yearMatch[1];
  } else if (tx.tanggal && tx.tanggal.includes('-')) {
    year = tx.tanggal.split('-')[0];
  }

  // Prioritaskan parsing bagian periode (teks di dalam kurung atau sebelum " - ")
  // agar nama warga seperti "Ibu Mei", "Bpk. Juni", atau "Bpk. Agus" tidak salah terbaca sebagai nama bulan.
  let monthIndices: number[] = [];

  const parenMatches = desc.match(/\([^)]*\)/g);
  if (parenMatches && parenMatches.length > 0) {
    for (const seg of parenMatches) {
      const parsed = parseMonthIndicesFromText(seg);
      if (parsed.length > 0) {
        monthIndices = Array.from(new Set([...monthIndices, ...parsed]));
      }
    }
  }

  if (monthIndices.length === 0 && desc.includes(' - ')) {
    const beforeDash = desc.split(' - ')[0];
    monthIndices = parseMonthIndicesFromText(beforeDash);
  }

  if (monthIndices.length === 0) {
    monthIndices = parseMonthIndicesFromText(desc);
  }

  if (monthIndices.length > 0) {
    return monthIndices.map((idx) => ({
      monthName: BULAN_LIST[idx],
      year,
    }));
  }

  // Fallback dari tanggal transaksi (YYYY-MM-DD)
  if (tx.tanggal && tx.tanggal.includes('-')) {
    const parts = tx.tanggal.split('-');
    if (parts.length >= 2) {
      const mIdx = parseInt(parts[1], 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        return [{ monthName: BULAN_LIST[mIdx], year: year || parts[0] }];
      }
    }
  }

  return [];
};

/**
 * Cek apakah kategori transaksi cocok dengan pos kategori iuran yang dipilih.
 * Tidak menyamakan dua kategori berbeda hanya karena sama-sama mengandung kata "iuran"
 * (misal: "Iuran Perbaikan Jalan" tidak akan dianggap lunas untuk "Iuran Warga").
 */
export const isCategoryMatchingIuran = (
  txCategory?: string,
  targetCategory?: string
): boolean => {
  const catTx = (txCategory || '').trim().toLowerCase();
  if (catTx === 'saldo pindahan' || catTx === 'saldo awal') {
    return false;
  }

  const catTarget = (targetCategory || '').trim().toLowerCase();
  if (!catTarget || catTarget === 'semua kategori' || catTarget === 'semua iuran') {
    return true;
  }

  if (!catTx) return false;

  return (
    catTx === catTarget ||
    catTx.includes(catTarget) ||
    catTarget.includes(catTx)
  );
};

/**
 * Cek apakah sebuah transaksi benar-benar milik warga tertentu.
 * - Jika transaksi sudah memiliki `warga_id`, perbandingan hanya mengacu pada `warga_id`
 *   sehingga tidak akan salah mencocokkan warga lain yang kebetulan memiliki sebagian nama sama.
 * - Jika transaksi tidak memiliki `warga_id` (input kas umum manual/import), cocokkan via
 *   NIK, No. KK, atau nama lengkap dengan batas kata (\b) yang akurat.
 */
export const isWargaMatchingTx = (warga: any, txInput: any): boolean => {
  if (!warga || !txInput) return false;
  const tx = normalizeIuranTx(txInput);

  // 1. Jika transaksi memiliki warga_id eksplisit, gunakan sebagai kebenaran mutlak
  if (tx.warga_id && String(tx.warga_id).trim() !== '') {
    if (warga.id && String(tx.warga_id).trim() === String(warga.id).trim()) {
      return true;
    }
    // Transaksi ini eksplisit ditandai milik warga lain -> jangan cocokan ulang lewat nama!
    return false;
  }

  const desc = tx.keterangan.toLowerCase();
  if (!desc) return false;

  // 2. Cek NIK & No. KK
  const nik = String(warga.nik || '').trim().toLowerCase();
  if (nik.length >= 6 && nik !== '-' && desc.includes(nik)) {
    return true;
  }

  const noKk = String(warga.no_kk || '').trim().toLowerCase();
  if (noKk.length >= 6 && noKk !== '-' && desc.includes(noKk)) {
    return true;
  }

  // 3. Cek Nama Warga secara presisi (batas kata / word boundary)
  if (!warga.nama_lengkap) return false;
  const fullW = String(warga.nama_lengkap).toLowerCase().replace(/\s+/g, ' ').trim();
  const cleanW = cleanPersonName(warga.nama_lengkap);

  if (fullW.length >= 3) {
    const fullRegex = new RegExp(`(?<![a-z0-9])${escapeRegex(fullW)}(?![a-z0-9])`, 'i');
    if (fullRegex.test(desc)) return true;
  }

  if (cleanW.length >= 3) {
    const cleanRegex = new RegExp(`(?<![a-z0-9])${escapeRegex(cleanW)}(?![a-z0-9])`, 'i');
    if (cleanRegex.test(desc)) return true;
  }

  // Untuk nama panjang (>= 3 kata, misal ada gelar/nama belakang di database yang disingkat di keterangan),
  // syaratkan minimal 2 kata utuh yang benar-benar cocok sebagai kata penuh.
  const nameParts = cleanW
    .split(/[\s.,/()-]+/)
    .filter((p) => p.length >= 3);

  if (nameParts.length >= 3) {
    const matchedWords = nameParts.filter((part) => {
      const partRegex = new RegExp(`(?<![a-z0-9])${escapeRegex(part)}(?![a-z0-9])`, 'i');
      return partRegex.test(desc);
    });
    if (matchedWords.length >= 2 && matchedWords.length >= Math.ceil(nameParts.length / 2)) {
      return true;
    }
  }

  return false;
};

/**
 * Single Source of Truth:
 * Cari transaksi pembayaran iuran yang cocok untuk seorang warga pada kategori, bulan, dan tahun tertentu.
 * Digunakan bersama oleh Laporan Kepatuhan Iuran dan Form Setoran Iuran Warga agar hasil 100% sinkron.
 */
export const findMatchingIuranTx = (
  warga: any,
  kasMasukList: any[],
  category: string,
  month: string,
  year: string
): any | undefined => {
  if (!warga || !Array.isArray(kasMasukList) || kasMasukList.length === 0) {
    return undefined;
  }

  const targetMonthLower = (month || '').trim().toLowerCase();
  const targetYear = String(year || '').trim();

  return kasMasukList.find((tx) => {
    if (!tx) return false;
    const norm = normalizeIuranTx(tx);

    // Pastikan hanya transaksi Kas Masuk
    if (norm.jenis && norm.jenis.toLowerCase() !== 'masuk') {
      return false;
    }

    // 1. Cek Kategori
    if (!isCategoryMatchingIuran(norm.kategori, category)) {
      return false;
    }

    // 2. Cek Identitas Warga
    if (!isWargaMatchingTx(warga, norm)) {
      return false;
    }

    // 3. Cek Bulan & Tahun Tagihan
    const periods = extractPeriodsFromTx(norm);
    return periods.some(
      (p) =>
        p.monthName.toLowerCase() === targetMonthLower &&
        String(p.year).trim() === targetYear
    );
  });
};
