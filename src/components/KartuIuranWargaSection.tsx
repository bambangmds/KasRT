import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Lock,
  Printer,
  Copy,
  Check,
  Sparkles,
  Layers,
  Info,
  UserCheck,
  CheckCheck,
  ShieldCheck,
  User,
  Users,
  LayoutGrid,
  Table,
  Filter,
  Search,
  FileSpreadsheet
} from 'lucide-react';
import { Transaction, CategoryItem, UserProfile, SupabaseConnectionStatus } from '../types';
import { getSupabase, linkUserToDataWarga } from '../lib/supabase';
import { formatSimpleRupiah, formatDateIndo } from '../data/initialData';
import { useSekretariat } from '../context/SekretariatContext';
import { KartuIuranPrintModal } from './KartuIuranPrintModal';

interface KartuIuranWargaSectionProps {
  transactions: Transaction[];
  categories: CategoryItem[];
  activeUser?: UserProfile | null;
  connectionStatus?: SupabaseConnectionStatus;
  onTriggerToast: (msg: string, type?: 'success' | 'error' | 'info', title?: string) => void;
  onRefreshTransactions?: () => void;
}

const BULAN_LIST = [
  { no: 1, code: '01', name: 'Januari', short: 'Jan' },
  { no: 2, code: '02', name: 'Februari', short: 'Feb' },
  { no: 3, code: '03', name: 'Maret', short: 'Mar' },
  { no: 4, code: '04', name: 'April', short: 'Apr' },
  { no: 5, code: '05', name: 'Mei', short: 'Mei' },
  { no: 6, code: '06', name: 'Juni', short: 'Jun' },
  { no: 7, code: '07', name: 'Juli', short: 'Jul' },
  { no: 8, code: '08', name: 'Agustus', short: 'Agu' },
  { no: 9, code: '09', name: 'September', short: 'Sep' },
  { no: 10, code: '10', name: 'Oktober', short: 'Okt' },
  { no: 11, code: '11', name: 'November', short: 'Nov' },
  { no: 12, code: '12', name: 'Desember', short: 'Des' },
];

const MONTH_NAME_TO_CODE: Record<string, string> = {
  januari: '01', jan: '01', '01': '01', '1': '01',
  februari: '02', feb: '02', '02': '02', '2': '02',
  maret: '03', mar: '03', '03': '03', '3': '03',
  april: '04', apr: '04', '04': '04', '4': '04',
  mei: '05', '05': '05', '5': '05',
  juni: '06', jun: '06', '06': '06', '6': '06',
  juli: '07', jul: '07', '07': '07', '7': '07',
  agustus: '08', agu: '08', agt: '08', '08': '08', '8': '08',
  september: '09', sep: '09', '09': '09', '9': '09',
  oktober: '10', okt: '10', '10': '10',
  november: '11', nov: '11', '11': '11',
  desember: '12', des: '12', '12': '12',
};

/**
 * Normalisasi nomor HP untuk pencocokan akurat
 */
const cleanPhoneNumber = (phone?: string): string => {
  if (!phone) return '';
  return phone.replace(/\D/g, '').replace(/^62/, '0');
};

/**
 * Membersihkan gelar, sapaan umum, keterangan blok/rumah dalam tanda kurung,
 * dan gelar akademik agar pencocokan nama warga 100% presisi dan toleran.
 */
const cleanPersonName = (rawName?: string): string => {
  if (!rawName) return '';
  return rawName
    .toLowerCase()
    // Hapus tanda kurung dan isinya, misal: (Blok A/5), (RT 02), (Kav. 10), dsb.
    .replace(/\(.*?\)/g, '')
    // Hapus sapaan umum di awal nama
    .replace(/^(bpk\.?|bapak\.?|ibu\.?|ibuk\.?|pak\.?|h\.?|hj\.?|haji\.?|hajjah\.?|sdr\.?|sdri\.?|om\.?|tante\.?|ustadz\.?|ust\.?)\s+/i, '')
    // Hapus gelar akademik umum di akhir nama
    .replace(/,\s*(s\.?t|s\.?e|s\.?kom|s\.?pd|s\.?h|s\.?sos|s\.?i\.?kom|m\.?m|m\.?kom|dr\.?|ir\.?).*$/i, '')
    // Hapus karakter selain huruf dan angka
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Periksa apakah dua string nama orang saling cocok secara fonetik / token
 */
const isNameMatching = (nameA?: string, nameB?: string): boolean => {
  if (!nameA || !nameB) return false;
  const cA = cleanPersonName(nameA);
  const cB = cleanPersonName(nameB);
  if (!cA || !cB) return false;

  // 1. Persis sama setelah dibersihkan
  if (cA === cB) return true;

  // 2. Substring (satu nama mengandung nama lainnya, min 3 karakter)
  if (cA.length >= 3 && cB.length >= 3) {
    if (cA.includes(cB) || cB.includes(cA)) return true;
  }

  // 3. Token-based matching: Kata-kata utama (panjang >= 3) saling beririsan
  const wordsA = cA.split(/\s+/).filter((w) => w.length >= 3);
  const wordsB = cB.split(/\s+/).filter((w) => w.length >= 3);

  if (wordsA.length >= 2 && wordsB.length >= 2) {
    // Jika minimal 2 kata sama persis
    const matchedCount = wordsA.filter((w) => wordsB.includes(w)).length;
    if (matchedCount >= 2) return true;
  } else if (wordsA.length === 1 && wordsB.length >= 1) {
    if (wordsB.includes(wordsA[0]) && wordsA[0].length >= 4) return true;
  } else if (wordsB.length === 1 && wordsA.length >= 1) {
    if (wordsA.includes(wordsB[0]) && wordsB[0].length >= 4) return true;
  }

  return false;
};

export interface CitizenMonthStatus {
  no: number;
  code: string;
  name: string;
  short: string;
  isPaid: boolean;
  amount: number;
  paymentDate: string | null;
  category: string;
  description: string | null;
  txId: string | null;
}

/**
 * Ekstrak seluruh periode bulan (01-12) dan tahun dari sebuah transaksi kas,
 * mendukung pembayaran satu bulan maupun multi-bulan (misal: "Jan s/d Mar 2026").
 */
const getTransactionPeriods = (tx: Transaction): Array<{ monthCode: string; year: string }> => {
  const desc = (tx.description || '').toLowerCase();

  // Deteksi tahun dalam deskripsi (misal: 2024, 2025, 2026, 2027)
  const yearMatch = desc.match(/\b(202\d|203\d)\b/);
  const txYear = yearMatch ? yearMatch[1] : (tx.date ? tx.date.split('-')[0] : String(new Date().getFullYear()));

  const foundMonths = new Set<string>();

  // Pola 1: Range bulan seperti "Januari s/d Maret" atau "Jan - Mar" atau "Januari sampai Maret"
  const rangeMatch = desc.match(/\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|mei|jun|jul|agu|agt|sep|okt|nov|des)\s*(?:s\/?d|-|sampai)\s*(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|mei|jun|jul|agu|agt|sep|okt|nov|des)\b/i);
  if (rangeMatch) {
    const startCode = MONTH_NAME_TO_CODE[rangeMatch[1].toLowerCase()];
    const endCode = MONTH_NAME_TO_CODE[rangeMatch[2].toLowerCase()];
    if (startCode && endCode) {
      const startNum = parseInt(startCode, 10);
      const endNum = parseInt(endCode, 10);
      if (startNum <= endNum) {
        for (let i = startNum; i <= endNum; i++) {
          foundMonths.add(String(i).padStart(2, '0'));
        }
      }
    }
  }

  // Pola 2: Deteksi nama bulan tersendiri atau "bulan <nama>" / "bln <nama>"
  const bulanRegex = /\b(?:bulan\s+|bln\s+)?(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|mei|jun|jul|agu|agt|sep|okt|nov|des)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = bulanRegex.exec(desc)) !== null) {
    const rawMonth = match[1].toLowerCase();
    const code = MONTH_NAME_TO_CODE[rawMonth];
    if (code) foundMonths.add(code);
  }

  // Pola 3: Deteksi angka bulan eksplisit "bulan 10" atau "bln 09"
  const digitMonthRegex = /\b(?:bulan\s+|bln\s+)(0?[1-9]|1[0-2])\b/gi;
  let dMatch: RegExpExecArray | null;
  while ((dMatch = digitMonthRegex.exec(desc)) !== null) {
    const code = dMatch[1].padStart(2, '0');
    foundMonths.add(code);
  }

  // Jika ada bulan yang terdeteksi dari teks keterangan transaksi:
  if (foundMonths.size > 0) {
    return Array.from(foundMonths).map((code) => ({
      monthCode: code,
      year: txYear,
    }));
  }

  // Pola 4 (Fallback Tanggal Transaksi): Gunakan tanggal transaksi (YYYY-MM-DD)
  if (tx.date && tx.date.includes('-')) {
    const parts = tx.date.split('-');
    if (parts.length >= 2) {
      return [{
        monthCode: parts[1].padStart(2, '0'),
        year: parts[0],
      }];
    }
  }

  const now = new Date();
  return [{
    monthCode: String(now.getMonth() + 1).padStart(2, '0'),
    year: String(now.getFullYear()),
  }];
};

/**
 * Ekstrak periode bulan utama dari sebuah transaksi
 */
const getTransactionPeriod = (tx: Transaction): { monthCode: string; year: string } => {
  const periods = getTransactionPeriods(tx);
  return periods[0];
};

/**
 * FUNGSI PERHITUNGAN TUNGGAL (SINGLE SOURCE OF TRUTH):
 * Menghitung status 12 bulan (Januari s/d Desember) untuk setiap warga secara presisi dan toleran.
 * Digunakan serentak oleh kartu warga, tabel rincian, tabel matriks semua warga, dan combo warga menunggak
 * agar tidak akan pernah ada perbedaan/desinkronisasi data.
 */
const computeCitizen12MonthStatus = (
  citizen: any,
  transactions: Transaction[],
  selectedYear: string,
  selectedCategory: string,
  extraContext?: {
    activeUser?: UserProfile | null;
    mySelfCitizen?: any;
    manuallyLinkedWargaId?: string;
  }
): CitizenMonthStatus[] => {
  if (!citizen) return [];

  // Kumpulkan seluruh candidate ID yang merepresentasikan warga ini
  const candidateIds = new Set<string>();
  if (citizen.id) candidateIds.add(citizen.id);
  if (citizen.matchedDbRecord?.id) candidateIds.add(citizen.matchedDbRecord.id);

  // Kumpulkan variasi nama lengkap, alias, dan sapaan
  const candidateNames = new Set<string>();
  const addNameVariation = (name?: string) => {
    if (!name) return;
    const trimmed = name.toLowerCase().trim();
    if (trimmed) candidateNames.add(trimmed);
    const cleaned = cleanPersonName(name);
    if (cleaned) candidateNames.add(cleaned);
  };

  addNameVariation(citizen.nama_lengkap);
  addNameVariation(citizen.matchedDbRecord?.nama_lengkap);

  // Kumpulkan NIK, KK, dan No HP
  const candidateNiks = new Set<string>();
  const addNik = (n?: string) => {
    if (n && n !== '-' && n.trim().length >= 6) candidateNiks.add(n.trim());
  };
  addNik(citizen.nik);
  addNik(citizen.matchedDbRecord?.nik);

  const candidateKks = new Set<string>();
  const addKk = (k?: string) => {
    if (k && k !== '-' && k.trim().length >= 6) candidateKks.add(k.trim());
  };
  addKk(citizen.no_kk);
  addKk(citizen.matchedDbRecord?.no_kk);

  const candidatePhones = new Set<string>();
  const addPhone = (p?: string) => {
    const cP = cleanPhoneNumber(p);
    if (cP && cP.length >= 8) candidatePhones.add(cP);
  };
  addPhone(citizen.no_hp);
  addPhone(citizen.matchedDbRecord?.no_hp);

  // Jika warga ini cocok dengan user yang sedang login, tambahkan kredensial akun login
  if (extraContext) {
    const { activeUser, mySelfCitizen, manuallyLinkedWargaId } = extraContext;
    const isThisMe =
      (mySelfCitizen && mySelfCitizen.id === citizen.id) ||
      (manuallyLinkedWargaId && manuallyLinkedWargaId === citizen.id) ||
      (activeUser?.nama && isNameMatching(activeUser.nama, citizen.nama_lengkap));

    if (isThisMe) {
      if (activeUser?.id) candidateIds.add(activeUser.id);
      if (manuallyLinkedWargaId) candidateIds.add(manuallyLinkedWargaId);
      if (activeUser?.nama) addNameVariation(activeUser.nama);
      if (activeUser?.no_hp) addPhone(activeUser.no_hp);
      if (activeUser?.no_kk) addKk(activeUser.no_kk);
    }
  }

  // Saring seluruh transaksi kas masuk yang milik warga ini
  const citizenTxList = transactions.filter((t) => {
    if (t.type !== 'Masuk') return false;

    // A. ID Warga langsung
    if (t.wargaId && candidateIds.has(t.wargaId)) {
      return true;
    }

    const descLower = (t.description || '').toLowerCase();
    if (!descLower) return false;

    // B. Pencocokan Nama Lengkap / Variasi Nama
    for (const cName of candidateNames) {
      if (cName.length >= 3) {
        if (descLower.includes(cName)) {
          return true;
        }
        const words = cName.split(/\s+/).filter((w) => w.length >= 3);
        if (words.length >= 2 && words.every((w) => descLower.includes(w))) {
          return true;
        }
      }
    }

    // C. Pencocokan NIK atau KK
    for (const nik of candidateNiks) {
      if (descLower.includes(nik)) return true;
    }
    for (const kk of candidateKks) {
      if (descLower.includes(kk)) return true;
    }

    // D. Pencocokan No HP
    for (const phone of candidatePhones) {
      if (descLower.includes(phone)) return true;
    }

    return false;
  });

  // Evaluasi status pembayaran untuk 12 bulan (01 s/d 12)
  return BULAN_LIST.map((b) => {
    const matchingTx = citizenTxList.find((tx) => {
      // Filter kategori jika bukan "Semua Iuran"
      if (selectedCategory !== 'Semua Iuran' && tx.category !== selectedCategory) {
        return false;
      }

      // Deteksi periode-periode bulan yang dicakup oleh transaksi ini
      const periods = getTransactionPeriods(tx);
      return periods.some((p) => p.year === selectedYear && p.monthCode === b.code);
    });

    if (matchingTx) {
      return {
        ...b,
        isPaid: true,
        amount: Number(matchingTx.amount) || 0,
        paymentDate: matchingTx.date,
        category: matchingTx.category,
        description: matchingTx.description,
        txId: matchingTx.id,
      };
    }

    return {
      ...b,
      isPaid: false,
      amount: 0,
      paymentDate: null,
      category: selectedCategory === 'Semua Iuran' ? 'Iuran Warga' : selectedCategory,
      description: null,
      txId: null,
    };
  });
};

export const KartuIuranWargaSection: React.FC<KartuIuranWargaSectionProps> = ({
  transactions,
  categories,
  activeUser,
  connectionStatus = 'connected',
  onTriggerToast,
  onRefreshTransactions,
}) => {
  const { sekretariat, wilayahLabel } = useSekretariat();
  
  // Data Warga state
  const [dataWarga, setDataWarga] = useState<any[]>([]);
  const [isLoadingWarga, setIsLoadingWarga] = useState(false);
  
  // Selection state
  const currentYearStr = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua Iuran');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  
  // Tampilan Laporan: Grid (Kartu), Tabel (12 Bulan), atau Tabel Semua Warga
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'all-table'>('grid');
  const [tableStatusFilter, setTableStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [searchAllWarga, setSearchAllWarga] = useState<string>('');
  
  // Penyimpanan profil warga yang ditautkan oleh user sendiri (jika nama registrasi login berbeda sedikit dari KK RT)
  const userStorageKey = `kas_rt_linked_warga_${(activeUser?.email || activeUser?.nama || 'anon').toLowerCase().replace(/\s+/g, '_')}`;
  const [manuallyLinkedWargaId, setManuallyLinkedWargaId] = useState<string>(() => {
    return localStorage.getItem(userStorageKey) || '';
  });
  const [isChangingProfile, setIsChangingProfile] = useState(false);

  // Identifikasi apakah akun yang login adalah Pengurus Inti / Admin
  const isPengurusInti = useMemo(() => {
    if (!activeUser) return false;
    return (
      activeUser.levelAkses === 'Admin' ||
      activeUser.role === 'Ketua RT' ||
      activeUser.role === 'Wakil Ketua RT' ||
      activeUser.role === 'Sekretaris' ||
      activeUser.role === 'Bendahara' ||
      (activeUser.role !== 'Warga' && activeUser.role !== undefined)
    );
  }, [activeUser]);

  // Load data warga from Supabase or localStorage
  const loadDataWarga = async () => {
    setIsLoadingWarga(true);
    const client = getSupabase();
    if (!client) {
      const local = localStorage.getItem('kas_rt_data_warga');
      if (local) {
        try {
          setDataWarga(JSON.parse(local));
        } catch {
          setDataWarga([]);
        }
      }
      setIsLoadingWarga(false);
      return;
    }

    try {
      const { data, error } = await client
        .from('data_warga')
        .select('*')
        .order('nama_lengkap', { ascending: true });

      if (error) {
        console.warn('Error fetching data_warga:', error.message);
        const local = localStorage.getItem('kas_rt_data_warga');
        if (local) {
          try {
            setDataWarga(JSON.parse(local));
          } catch {}
        }
      } else if (data) {
        setDataWarga(data);
      }
    } catch (err: any) {
      console.warn('Exception loading data_warga:', err);
    } finally {
      setIsLoadingWarga(false);
    }
  };

  useEffect(() => {
    loadDataWarga();
  }, [connectionStatus]);

  // Profil warga milik pengguna yang sedang login (Pencocokan Cerdas Multi-Lapisan)
  const mySelfCitizen = useMemo(() => {
    if (!activeUser) return null;

    const userCleanName = cleanPersonName(activeUser.nama);
    const userCleanPhone = cleanPhoneNumber(activeUser.no_hp);
    const userCleanEmail = (activeUser.email || '').toLowerCase().trim();

    // 1. Cek jika pengguna telah menautkan ID profil data_warga tertentu secara manual
    let matched: any = null;
    if (manuallyLinkedWargaId) {
      matched = dataWarga.find((w) => w.id === manuallyLinkedWargaId);
    }

    // 2. Cek kecocokan wargaId atau no_kk langsung dari akun terdaftar
    if (!matched && activeUser.wargaId) {
      matched = dataWarga.find((w) => w.id === activeUser.wargaId);
    }
    if (!matched && activeUser.no_kk) {
      matched = dataWarga.find((w) => w.no_kk && String(w.no_kk).trim() === String(activeUser.no_kk).trim());
    }

    // 3. Cek kecocokan Email (jika ada)
    if (!matched && userCleanEmail) {
      matched = dataWarga.find(
        (w) => w.email && w.email.toLowerCase().trim() === userCleanEmail
      );
    }

    // 4. Cek kecocokan ID akun langsung
    if (!matched && activeUser.id) {
      matched = dataWarga.find((w) => w.id === activeUser.id);
    }

    // 4. Cek kecocokan Nomor HP
    if (!matched && userCleanPhone && userCleanPhone.length >= 8) {
      matched = dataWarga.find(
        (w) => cleanPhoneNumber(w.no_hp) === userCleanPhone
      );
    }

    // 5. Cek kecocokan Nama Bersih (Persis sama)
    if (!matched && userCleanName) {
      matched = dataWarga.find(
        (w) => cleanPersonName(w.nama_lengkap) === userCleanName
      );
    }

    // 6. Cek kecocokan Nama Toleran / Substring / Token
    if (!matched && userCleanName) {
      matched = dataWarga.find((w) =>
        isNameMatching(w.nama_lengkap, activeUser.nama)
      );
    }

    // 7. Cek riwayat transaksi kas masuk: apakah ada transaksi yang memuat nama user ini
    // dan memiliki wargaId yang terdaftar di dataWarga
    if (!matched && userCleanName && transactions.length > 0) {
      for (const tx of transactions) {
        if (tx.type === 'Masuk' && tx.wargaId) {
          const desc = (tx.description || '').toLowerCase();
          if (desc.includes(userCleanName) || isNameMatching(tx.description, activeUser.nama)) {
            const foundByTx = dataWarga.find((w) => w.id === tx.wargaId);
            if (foundByTx) {
              matched = foundByTx;
              break;
            }
          }
        }
      }
    }

    return {
      id: matched?.id || activeUser.id || 'my-account-id',
      nama_lengkap: matched?.nama_lengkap || activeUser.nama || 'Warga Terdaftar',
      no_kk: matched?.no_kk || '-',
      nik: matched?.nik || '-',
      alamat_domisili: matched?.alamat_domisili || 'RT.002 RW.09',
      no_hp: matched?.no_hp || activeUser.no_hp || '-',
      email: matched?.email || activeUser.email || '',
      role: activeUser.role || (isPengurusInti ? 'Pengurus RT' : 'Warga'),
      isMatchedInDatabase: Boolean(matched),
      matchedDbRecord: matched,
    };
  }, [activeUser, dataWarga, isPengurusInti, manuallyLinkedWargaId, transactions]);

  // Handler untuk mengaitkan profil warga secara mandiri
  const handleLinkCitizenProfile = async (wargaId: string) => {
    if (!wargaId) {
      setManuallyLinkedWargaId('');
      localStorage.removeItem(userStorageKey);
      setIsChangingProfile(false);
      if (onTriggerToast) {
        onTriggerToast('Tautan profil warga dikembalikan ke pengaturan awal.', 'info');
      }
      return;
    }

    const selected = dataWarga.find((w) => w.id === wargaId);
    setManuallyLinkedWargaId(wargaId);
    localStorage.setItem(userStorageKey, wargaId);
    setIsChangingProfile(false);

    if (activeUser?.email && selected) {
      try {
        await linkUserToDataWarga(activeUser.email, selected);
      } catch (err) {
        console.warn('[handleLinkCitizenProfile]', err);
      }
    }

    if (onTriggerToast && selected) {
      onTriggerToast(
        `Akun & Kartu Iuran berhasil ditautkan ke ${selected.nama_lengkap} (KK: ${selected.no_kk || '-'}). Data pengguna di Supabase telah terupdate!`,
        'success',
        'Data Pengguna Terupdate'
      );
    }
  };

  // State pilihan warga aktif untuk pengurus
  const [selectedWargaId, setSelectedWargaId] = useState<string>('');

  // Set default selected citizen saat data loaded
  useEffect(() => {
    if (isPengurusInti) {
      if (!selectedWargaId && dataWarga.length > 0) {
        if (mySelfCitizen && dataWarga.some((w) => w.id === mySelfCitizen.id)) {
          setSelectedWargaId(mySelfCitizen.id);
        } else {
          setSelectedWargaId(dataWarga[0].id);
        }
      }
    } else {
      if (mySelfCitizen) {
        setSelectedWargaId(mySelfCitizen.id);
      }
    }
  }, [isPengurusInti, dataWarga, mySelfCitizen, selectedWargaId]);

  // Profil warga yang saat ini aktif ditampilkan di Buku Riwayat
  const currentCitizen = useMemo(() => {
    if (!isPengurusInti) {
      return mySelfCitizen || {
        id: activeUser?.id || 'warga-user',
        nama_lengkap: activeUser?.nama || 'Warga Terdaftar',
        no_kk: '-',
        nik: '-',
        alamat_domisili: 'RT.002 RW.09',
        no_hp: activeUser?.no_hp || '-',
        email: activeUser?.email || '',
        role: 'Warga',
        isMatchedInDatabase: false,
      };
    }

    if (selectedWargaId) {
      const foundInWarga = dataWarga.find((w) => w.id === selectedWargaId);
      if (foundInWarga) return { ...foundInWarga, isMatchedInDatabase: true };

      if (mySelfCitizen && selectedWargaId === mySelfCitizen.id) {
        return mySelfCitizen;
      }
    }

    if (dataWarga.length > 0) return { ...dataWarga[0], isMatchedInDatabase: true };
    return mySelfCitizen || {
      id: activeUser?.id || 'pengurus-id',
      nama_lengkap: activeUser?.nama || 'Pengurus RT',
      no_kk: '-',
      nik: '-',
      alamat_domisili: 'RT.002 RW.09',
      no_hp: activeUser?.no_hp || '-',
      email: activeUser?.email || '',
      role: activeUser?.role || 'Pengurus RT',
      isMatchedInDatabase: false,
    };
  }, [isPengurusInti, selectedWargaId, dataWarga, mySelfCitizen, activeUser]);

  // Available Years
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    transactions.forEach((t) => {
      const p = getTransactionPeriod(t);
      if (p.year && !isNaN(Number(p.year))) {
        years.add(p.year);
      }
    });
    years.add(currentYearStr);
    years.add((Number(currentYearStr) - 1).toString());
    years.add((Number(currentYearStr) + 1).toString());
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [transactions, currentYearStr]);

  // Available income categories
  const availableCategories = useMemo(() => {
    const incomeCats = categories.filter((c) => c.type === 'Masuk').map((c) => c.name);
    const defaultCats = ['Iuran Warga', 'Kebersihan', 'Iuran Wajib', 'Iuran Perbaikan Jalan', 'Sosial'];
    const merged = Array.from(new Set([...incomeCats, ...defaultCats]));
    return merged;
  }, [categories]);

  // Matriks rekap 12 bulan untuk seluruh warga terdaftar (Sumber Kebenaran Tunggal / Single Source of Truth)
  const allCitizensMatrix = useMemo(() => {
    if (!dataWarga || dataWarga.length === 0) return [];

    return dataWarga.map((w) => {
      const months = computeCitizen12MonthStatus(w, transactions, selectedYear, selectedCategory, {
        activeUser,
        mySelfCitizen,
        manuallyLinkedWargaId,
      });

      const paidCount = months.filter((m) => m.isPaid).length;
      const totalAmount = months.reduce((sum, m) => sum + (m.isPaid ? m.amount : 0), 0);

      return {
        warga: w,
        months,
        paidCount,
        totalAmount,
        complianceRate: Math.round((paidCount / 12) * 100),
        isFullyPaid: paidCount === 12,
      };
    });
  }, [dataWarga, transactions, selectedYear, selectedCategory, activeUser, mySelfCitizen, manuallyLinkedWargaId]);

  // Perhitungan Status Pembayaran 12 Bulan untuk warga terpilih (100% SINKRON dengan Matriks & Combo Tunggakan)
  const monthlyStatus = useMemo(() => {
    if (!currentCitizen) return [];

    // Prioritas 1: Ambil langsung dari allCitizensMatrix yang sudah dihitung agar 100% identik
    const matched = allCitizensMatrix.find((item) => item.warga.id === currentCitizen.id);
    if (matched) {
      return matched.months;
    }

    // Prioritas 2 (Fallback jika warga tidak ada di dataWarga): Hitung menggunakan fungsi tunggal yang sama
    return computeCitizen12MonthStatus(currentCitizen, transactions, selectedYear, selectedCategory, {
      activeUser,
      mySelfCitizen,
      manuallyLinkedWargaId,
    });
  }, [currentCitizen, allCitizensMatrix, transactions, selectedYear, selectedCategory, activeUser, mySelfCitizen, manuallyLinkedWargaId]);

  // Metrik Ringkasan Tahunan
  const summaryMetrics = useMemo(() => {
    const totalMonths = 12;
    const paidMonths = monthlyStatus.filter((m) => m.isPaid).length;
    const unpaidMonths = totalMonths - paidMonths;
    const totalPaidAmount = monthlyStatus.reduce((sum, m) => sum + (m.isPaid ? m.amount : 0), 0);
    
    // Rata-rata nominal iuran bulanan
    const avgMonthlyRate = paidMonths > 0 
      ? Math.round(totalPaidAmount / paidMonths) 
      : 25000;

    const estimatedArrears = unpaidMonths * avgMonthlyRate;
    const complianceRate = Math.round((paidMonths / totalMonths) * 100);

    const unpaidMonthNames = monthlyStatus
      .filter((m) => !m.isPaid)
      .map((m) => m.name);

    return {
      totalMonths,
      paidMonths,
      unpaidMonths,
      totalPaidAmount,
      avgMonthlyRate,
      estimatedArrears,
      complianceRate,
      unpaidMonthNames,
      isFullyPaid: paidMonths === totalMonths,
    };
  }, [monthlyStatus]);

  // Data baris 12 bulan yang tersaring untuk Tampilan Tabel
  const filteredMonthlyTable = useMemo(() => {
    if (tableStatusFilter === 'paid') return monthlyStatus.filter((m) => m.isPaid);
    if (tableStatusFilter === 'unpaid') return monthlyStatus.filter((m) => !m.isPaid);
    return monthlyStatus;
  }, [monthlyStatus, tableStatusFilter]);

  // Filter pencarian untuk Tabel Semua Warga
  const filteredAllCitizensMatrix = useMemo(() => {
    if (!searchAllWarga.trim()) return allCitizensMatrix;
    const q = searchAllWarga.toLowerCase().trim();
    return allCitizensMatrix.filter((item) => {
      const name = (item.warga.nama_lengkap || '').toLowerCase();
      const kk = (item.warga.no_kk || '').toLowerCase();
      const alamat = (item.warga.alamat_domisili || '').toLowerCase();
      return name.includes(q) || kk.includes(q) || alamat.includes(q);
    });
  }, [allCitizensMatrix, searchAllWarga]);

  // Daftar warga yang memiliki tunggakan iuran untuk bulan yang sudah lewat dan bulan berjalan
  const citizensWithArrears = useMemo(() => {
    const now = new Date();
    const currentYearNum = now.getFullYear();
    const currentMonthNum = now.getMonth() + 1; // 1 s/d 12
    const selYearNum = parseInt(selectedYear, 10) || currentYearNum;

    // Batas bulan yang dihitung sebagai tunggakan:
    // - Jika tahun berjalan (misal 2026): bulan yang sudah lewat dan bulan berjalan (1 s/d currentMonthNum)
    // - Jika tahun lampau (< 2026): seluruh 12 bulan (1 s/d 12)
    // - Jika tahun depan (> 2026): 0 (belum ada bulan berjalan)
    let maxMonthToCheck = 12;
    if (selYearNum === currentYearNum) {
      maxMonthToCheck = currentMonthNum;
    } else if (selYearNum > currentYearNum) {
      maxMonthToCheck = 0;
    }

    if (maxMonthToCheck === 0) return [];

    return allCitizensMatrix
      .map((item) => {
        // Ambil bulan-bulan <= maxMonthToCheck yang belum dibayar (isPaid === false)
        const overdueMonths = item.months.filter(
          (m) => m.no <= maxMonthToCheck && !m.isPaid
        );

        const overdueCount = overdueMonths.length;
        const overdueMonthNames = overdueMonths.map((m) => m.short).join(', ');

        return {
          warga: item.warga,
          overdueCount,
          overdueMonths,
          overdueMonthNames,
          totalAmount: item.totalAmount,
        };
      })
      .filter((item) => item.overdueCount > 0)
      .sort((a, b) => b.overdueCount - a.overdueCount);
  }, [allCitizensMatrix, selectedYear]);

  // Salin ringkasan ke clipboard
  const handleCopySummary = () => {
    if (!currentCitizen) return;

    const rtInfo = sekretariat.rt ? `RT ${sekretariat.rt} / RW ${sekretariat.rw || '09'}` : wilayahLabel;
    const text = [
      `📋 *KARTU RIWAYAT IURAN WARGA - TAHUN ${selectedYear}*`,
      `🏛️ ${rtInfo} (${sekretariat.kelurahan ? `Kel. ${sekretariat.kelurahan}` : 'Kel. Pondok Rajeg'})`,
      `------------------------------------------`,
      `👤 *Nama Warga*: ${currentCitizen.nama_lengkap}`,
      `🏠 *Alamat*: ${currentCitizen.alamat_domisili || '-'}`,
      `🏷️ *Kategori*: ${selectedCategory}`,
      `------------------------------------------`,
      `📊 *Status Pembayaran*:`,
      `✅ *Bulan Lunas*: ${summaryMetrics.paidMonths} dari 12 Bulan (${summaryMetrics.complianceRate}%)`,
      `💰 *Total Disetor*: ${formatSimpleRupiah(summaryMetrics.totalPaidAmount)}`,
      summaryMetrics.unpaidMonths > 0 
        ? `⚠️ *Tunggakan*: ${summaryMetrics.unpaidMonths} Bulan (${summaryMetrics.unpaidMonthNames.join(', ')}) - Estimasi: ${formatSimpleRupiah(summaryMetrics.estimatedArrears)}`
        : `🌟 *Status*: LUNAS 1 TAHUN PENUH! Terima kasih atas partisipasi Anda.`,
      `------------------------------------------`,
      `_Dicatat secara resmi oleh Sistem Buku Kas RT_`,
    ].join('\n');

    navigator.clipboard.writeText(text);
    onTriggerToast('Rincian kartu iuran berhasil disalin ke clipboard!', 'success', 'Tersalin');
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 sm:p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Buku Riwayat & Kartu Iuran Warga (12 Bulan)
                </h2>
                {isPengurusInti ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2.5 py-0.5 rounded-full">
                    <ShieldCheck className="w-3 h-3" />
                    Akses Pengurus Inti RT (Bisa Pilih Warga)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
                    <Lock className="w-3 h-3" />
                    Khusus Akun Anda ({activeUser?.nama || 'Warga'})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {isPengurusInti
                  ? 'Pilih nama warga di bawah untuk memeriksa riwayat setoran iuran 12 bulan dan status kelunasan/tunggakan.'
                  : `Menampilkan catatan pembayaran iuran resmi atas nama ${activeUser?.nama || 'akun Anda'}.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            {isPengurusInti && mySelfCitizen && (
              <button
                type="button"
                onClick={() => setSelectedWargaId(mySelfCitizen.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-xs ${
                  selectedWargaId === mySelfCitizen.id
                    ? 'bg-emerald-600 text-white border-emerald-400/50'
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
                }`}
                title="Lihat Kartu Iuran Saya Sendiri"
              >
                <User className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kartu Saya Sendiri</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/10 transition-all cursor-pointer shadow-xs"
              title="Salin Rincian Status Iuran"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Salin Info</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs shadow-indigo-600/30"
              title="Cetak Lembar Kartu Iuran"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Kartu</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Selector Bar */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/50">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
          {/* 1. PEMILIH WARGA / IDENTITAS WARGA (Lebar disesuaikan menjadi col-span-4) */}
          <div className="lg:col-span-4">
            <label className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>{isPengurusInti ? 'Pilih Warga Yang Dilihat' : 'Identitas Pemilik Kartu'}</span>
              {isPengurusInti ? (
                <span className="text-[10px] text-indigo-700 font-bold flex items-center gap-1">
                  <Users className="w-3 h-3" /> Mode Pengurus
                </span>
              ) : (
                <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Terkunci Akun Anda
                </span>
              )}
            </label>

            {isPengurusInti ? (
              // JIKA PENGURUS INTI: DROPDOWN PEMILIH WARGA LENGKAP
              <div className="relative">
                <select
                  value={selectedWargaId}
                  onChange={(e) => setSelectedWargaId(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-indigo-200 focus:border-indigo-600 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 outline-none shadow-2xs cursor-pointer truncate"
                >
                  {mySelfCitizen && (
                    <option value={mySelfCitizen.id}>
                      ⭐ {mySelfCitizen.nama_lengkap} (Akun Anda Sendiri - {mySelfCitizen.role || 'Pengurus'})
                    </option>
                  )}
                  {dataWarga
                    .filter((w) => !mySelfCitizen || w.id !== mySelfCitizen.id)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        👤 {w.nama_lengkap} — KK: {w.no_kk || '-'} ({w.alamat_domisili || 'Warga RT'})
                      </option>
                    ))}
                  {dataWarga.length === 0 && (
                    <option value="">(Belum ada data warga terdaftar di sistem)</option>
                  )}
                </select>
              </div>
            ) : (
              // JIKA WARGA BIASA: TAMPILKAN PROFIL DAN OPSI TAUTKAN KK JIKA DIPERLUKAN
              <div className="space-y-2">
                <div className="p-2.5 bg-white border-2 border-emerald-500/40 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center font-black text-xs shrink-0">
                    {currentCitizen?.nama_lengkap ? currentCitizen.nama_lengkap.substring(0, 2).toUpperCase() : 'WG'}
                  </div>
                  <div className="truncate flex-1">
                    <div className="font-extrabold text-xs text-slate-900 truncate flex items-center gap-1">
                      <span>{currentCitizen?.nama_lengkap || activeUser?.nama || 'Akun Anda'}</span>
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" title="Akun Terverifikasi" />
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium truncate">
                      {currentCitizen?.no_kk && currentCitizen.no_kk !== '-' ? `KK: ${currentCitizen.no_kk} • ` : ''}
                      {currentCitizen?.alamat_domisili || 'Warga RT.002 RW.09'}
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setIsChangingProfile(!isChangingProfile)}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg text-[10px] font-bold shrink-0 transition-all cursor-pointer"
                    title="Sesuaikan jika nama akun login berbeda dengan nama KK di buku kas"
                  >
                    {isChangingProfile ? 'Batal' : 'Ganti KK'}
                  </button>
                </div>

                {/* Dropdown pemilih profil jika warga ingin menyinkronkan ke KK / Nama yang tercatat di RT */}
                {isChangingProfile && (
                  <div className="p-2.5 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-2 animate-in fade-in duration-200">
                    <div className="text-[11px] font-bold text-indigo-900 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Pilih Nama / KK Anda di Buku RT:</span>
                    </div>
                    <select
                      value={manuallyLinkedWargaId || mySelfCitizen?.id || ''}
                      onChange={(e) => handleLinkCitizenProfile(e.target.value)}
                      className="w-full p-2 bg-white border border-indigo-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    >
                      <option value="">-- Otomatis Sesuai Nama Akun Login ({activeUser?.nama}) --</option>
                      {dataWarga.map((w) => (
                        <option key={w.id} value={w.id}>
                          👤 {w.nama_lengkap} — KK: {w.no_kk || '-'} ({w.alamat_domisili || 'RT.002 RW.09'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. COMBO BARU: WARGA ADA TUNGGAKAN (BULAN SUDAH LEWAT & BULAN BERJALAN) */}
          <div className="lg:col-span-3">
            <label className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1 text-amber-800">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="truncate">Warga Ada Tunggakan</span>
              </span>
              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                {citizensWithArrears.length} KK
              </span>
            </label>
            <div className="relative">
              <select
                value={citizensWithArrears.some((c) => c.warga.id === selectedWargaId) ? selectedWargaId : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    setSelectedWargaId(val);
                    const item = citizensWithArrears.find((c) => c.warga.id === val);
                    if (item) {
                      onTriggerToast(
                        `Menampilkan ${item.warga.nama_lengkap} (Nunggak ${item.overdueCount} bln: ${item.overdueMonthNames})`,
                        'info'
                      );
                    }
                  }
                }}
                className={`w-full p-2.5 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500/20 outline-none shadow-2xs cursor-pointer truncate transition-colors ${
                  citizensWithArrears.length > 0
                    ? 'bg-amber-50/70 hover:bg-amber-50/90 border-2 border-amber-300 focus:border-amber-600 text-amber-950'
                    : 'bg-slate-50 border border-slate-200 text-slate-500'
                }`}
              >
                <option value="">
                  {citizensWithArrears.length === 0
                    ? `✓ Nihil (Semua Lunas s/d Bln Ini)`
                    : `-- Pilih Warga Menunggak (${citizensWithArrears.length} KK) --`}
                </option>
                {citizensWithArrears.map((item) => (
                  <option key={item.warga.id} value={item.warga.id}>
                    ⚠️ {item.warga.nama_lengkap} ({item.overdueCount} Bln: {item.overdueMonthNames})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. TAHUN ANGGARAN (Lebar Diperkecil menjadi col-span-2) */}
          <div className="lg:col-span-2">
            <label className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Tahun</span>
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none shadow-2xs cursor-pointer truncate"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  Tahun {y}
                </option>
              ))}
            </select>
          </div>

          {/* 4. POS KATEGORI IURAN (Lebar Diperkecil menjadi col-span-3) */}
          <div className="lg:col-span-3">
            <label className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span className="truncate">Kategori Iuran</span>
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none shadow-2xs cursor-pointer truncate"
            >
              <option value="Semua Iuran">Semua Pos Iuran Masuk</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Ringkasan Status Kepatuhan 1 Tahun */}
      <div className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Status Kepatuhan */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Kepatuhan 1 Tahun ({selectedYear})
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-black text-slate-900">
                {summaryMetrics.paidMonths} / 12 <span className="text-xs font-medium text-slate-500">Bulan</span>
              </span>
              <span
                className={`text-xs font-black px-2 py-0.5 rounded-md ${
                  summaryMetrics.isFullyPaid
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : summaryMetrics.paidMonths >= 6
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {summaryMetrics.complianceRate}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  summaryMetrics.isFullyPaid
                    ? 'bg-emerald-500'
                    : summaryMetrics.paidMonths >= 6
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${summaryMetrics.complianceRate}%` }}
              />
            </div>
          </div>

          {/* Card 2: Total Telah Disetor */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Total Telah Disetor
              </span>
              <span className="text-xl font-black text-emerald-800 mt-1 block">
                {formatSimpleRupiah(summaryMetrics.totalPaidAmount)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
                Tercatat pada {summaryMetrics.paidMonths} bulan lunas
              </span>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Sisa Tunggakan */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                Sisa Bulan Tertunggak
              </span>
              <span className="text-xl font-black text-rose-700 mt-1 block">
                {summaryMetrics.unpaidMonths} Bulan
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
                {summaryMetrics.unpaidMonths > 0
                  ? `Est. ${formatSimpleRupiah(summaryMetrics.estimatedArrears)}`
                  : 'Tidak ada tunggakan'}
              </span>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <XCircle className="w-5 h-5" />
            </div>
          </div>

          {/* Card 4: Status Kelulusan Tahunan */}
          <div
            className={`p-4 rounded-xl border shadow-2xs flex flex-col justify-center ${
              summaryMetrics.isFullyPaid
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                : 'bg-amber-50/80 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {summaryMetrics.isFullyPaid ? (
                <Sparkles className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600" />
              )}
              <span className="text-[10px] font-black uppercase tracking-wide">
                {summaryMetrics.isFullyPaid ? 'Status: LUNAS PENUH' : 'Status: BELUM LENGKAP'}
              </span>
            </div>
            <p className="text-xs font-semibold mt-1 leading-snug">
              {summaryMetrics.isFullyPaid
                ? `Semua 12 bulan di tahun ${selectedYear} telah terbayar lunas.`
                : `Masih ada ${summaryMetrics.unpaidMonths} bulan (${summaryMetrics.unpaidMonthNames.slice(0, 3).join(', ')}${summaryMetrics.unpaidMonths > 3 ? '...' : ''}) yang belum tercatat.`}
            </p>
          </div>
        </div>
      </div>

      {/* 12-Month Matrix Section: Grid & Table Views */}
      <div className="p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                Matriks & Laporan Iuran 12 Bulan — Tahun {selectedYear}
              </h3>
            </div>
            <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-1">
              <span>Warga Terpilih:</span>
              <span className="font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                {currentCitizen?.nama_lengkap || activeUser?.nama || '-'}
              </span>
              {currentCitizen?.no_kk && currentCitizen.no_kk !== '-' && (
                <span className="text-[11px] text-slate-400 font-mono">
                  (KK: {currentCitizen.no_kk})
                </span>
              )}
            </div>
          </div>

          {/* View Mode Switcher Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-100'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid (Kartu)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-100'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Tabel (12 Bulan)</span>
            </button>
            {dataWarga.length > 0 && (
              <button
                type="button"
                onClick={() => setViewMode('all-table')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'all-table'
                    ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-100'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Tabel Semua Warga ({dataWarga.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* VIEW 1: GRID MODE (KARTU 12 BULAN) */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 animate-in fade-in duration-200">
            {monthlyStatus.map((m) => (
              <div
                key={m.no}
                className={`p-4 rounded-xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                  m.isPaid
                    ? 'bg-white border-emerald-200 hover:border-emerald-300 shadow-2xs'
                    : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Top Row: Month Name & Status Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black ${
                        m.isPaid
                          ? 'bg-emerald-100 text-emerald-800 font-mono'
                          : 'bg-slate-200 text-slate-600 font-mono'
                      }`}
                    >
                      {m.code}
                    </span>
                    <span className="font-bold text-xs text-slate-900">{m.name}</span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${
                      m.isPaid
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-600 border border-rose-200'
                    }`}
                  >
                    {m.isPaid ? (
                      <>
                        <Check className="w-3 h-3" /> Lunas
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3" /> Nunggak
                      </>
                    )}
                  </span>
                </div>

                {/* Middle Section: Amount & Details */}
                <div className="my-3">
                  {m.isPaid ? (
                    <div>
                      <span className="text-sm font-black text-emerald-700 block">
                        {formatSimpleRupiah(m.amount)}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5 font-medium">
                        Tgl: {m.paymentDate ? formatDateIndo(m.paymentDate) : '-'}
                      </span>
                      <span className="text-[9px] text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded mt-1.5 inline-block truncate max-w-full">
                        {m.category}
                      </span>
                    </div>
                  ) : (
                    <div className="py-1">
                      <span className="text-xs font-semibold text-slate-400 block">
                        Belum Terbayar
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5 italic">
                        Tidak ada catatan kas
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom Details: ID / Note */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400">
                  <span>{m.isPaid ? 'Terverifikasi' : 'Tertunggak'}</span>
                  <span className="font-mono">
                    {m.txId ? `ID: ${m.txId.substring(0, 8)}` : `BLN-${m.code}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* VIEW 2: TABLE MODE (RINCIAN TABEL 12 BULAN WARGA TERPILIH) */}
        {viewMode === 'table' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Table Control Bar: Filter Status + Salin */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-600 mr-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  Filter Status:
                </span>
                <button
                  type="button"
                  onClick={() => setTableStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tableStatusFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Semua Bulan (12)
                </button>
                <button
                  type="button"
                  onClick={() => setTableStatusFilter('paid')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tableStatusFilter === 'paid'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Lunas ({summaryMetrics.paidMonths})
                </button>
                <button
                  type="button"
                  onClick={() => setTableStatusFilter('unpaid')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tableStatusFilter === 'unpaid'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
                  }`}
                >
                  <XCircle className="w-3 h-3" />
                  Tertunggak ({summaryMetrics.unpaidMonths})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const tableText = [
                      `LAPORAN KARTU IURAN 12 BULAN (TAHUN ${selectedYear})`,
                      `Warga: ${currentCitizen?.nama_lengkap || activeUser?.nama || '-'} (KK: ${currentCitizen?.no_kk || '-'})`,
                      `Pos Kategori: ${selectedCategory}`,
                      `Total Terbayar: ${formatSimpleRupiah(summaryMetrics.totalPaidAmount)} (${summaryMetrics.paidMonths}/12 Bulan)`,
                      `Estimasi Tunggakan: ${formatSimpleRupiah(summaryMetrics.estimatedArrears)} (${summaryMetrics.unpaidMonths} Bulan)`,
                      '-------------------------------------------------------',
                      'No | Bulan | Status | Tgl Setor | Nominal | Kategori | Keterangan | No. Ref',
                      ...monthlyStatus.map(
                        (m) =>
                          `${m.code} | ${m.name} | ${m.isPaid ? 'LUNAS' : 'NUNGGAK'} | ${m.paymentDate ? formatDateIndo(m.paymentDate) : '-'} | ${formatSimpleRupiah(m.amount)} | ${m.category} | ${m.description || '-'} | ${m.txId ? m.txId.substring(0, 8) : '-'}`
                      )
                    ].join('\n');
                    navigator.clipboard.writeText(tableText);
                    onTriggerToast('Tabel rincian 12 bulan berhasil disalin ke clipboard!', 'success');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  title="Salin teks rincian tabel iuran"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Salin Tabel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Cetak / PDF</span>
                </button>
              </div>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <th className="py-3 px-3.5 text-center w-12">No.</th>
                    <th className="py-3 px-3.5 min-w-[130px]">Bulan / Periode</th>
                    <th className="py-3 px-3.5 text-center min-w-[130px]">Status Pembayaran</th>
                    <th className="py-3 px-3.5 min-w-[130px]">Tanggal Setor</th>
                    <th className="py-3 px-3.5 min-w-[150px]">Pos Kategori</th>
                    <th className="py-3 px-3.5 text-right min-w-[130px]">Nominal Setoran</th>
                    <th className="py-3 px-3.5 min-w-[200px]">Keterangan / Uraian</th>
                    <th className="py-3 px-3.5 text-center font-mono w-24">No. Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredMonthlyTable.map((m) => (
                    <tr
                      key={m.no}
                      className={`transition-colors hover:bg-indigo-50/40 ${
                        m.isPaid ? 'bg-white' : 'bg-slate-50/40'
                      }`}
                    >
                      {/* No */}
                      <td className="py-3 px-3.5 text-center font-mono font-bold text-slate-500 text-[11px]">
                        {m.code}
                      </td>

                      {/* Bulan / Periode */}
                      <td className="py-3 px-3.5">
                        <div className="font-extrabold text-slate-900 flex items-center gap-2">
                          <span
                            className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                              m.isPaid
                                ? 'bg-emerald-100 text-emerald-800 font-mono'
                                : 'bg-slate-200 text-slate-600 font-mono'
                            }`}
                          >
                            {m.code}
                          </span>
                          <span>{m.name}</span>
                          <span className="text-[10px] font-normal text-slate-400">
                            {selectedYear}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full ${
                            m.isPaid
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {m.isPaid ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-700 stroke-[3]" /> Lunas
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-rose-500" /> Nunggak
                            </>
                          )}
                        </span>
                      </td>

                      {/* Tanggal Bayar */}
                      <td className="py-3 px-3.5 text-slate-600 font-medium">
                        {m.isPaid && m.paymentDate ? (
                          <span className="font-semibold text-slate-800">
                            {formatDateIndo(m.paymentDate)}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>

                      {/* Pos Kategori */}
                      <td className="py-3 px-3.5">
                        {m.isPaid ? (
                          <span className="inline-block bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[11px] font-semibold truncate max-w-[180px]">
                            {m.category}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">
                            {selectedCategory === 'Semua Iuran' ? 'Iuran Warga' : selectedCategory}
                          </span>
                        )}
                      </td>

                      {/* Nominal */}
                      <td className="py-3 px-3.5 text-right">
                        {m.isPaid ? (
                          <span className="font-extrabold text-emerald-700 text-sm">
                            {formatSimpleRupiah(m.amount)}
                          </span>
                        ) : (
                          <span className="font-medium text-slate-400">
                            Rp 0
                          </span>
                        )}
                      </td>

                      {/* Keterangan */}
                      <td className="py-3 px-3.5 text-slate-600 max-w-xs">
                        {m.isPaid ? (
                          <span
                            className="block truncate font-medium text-slate-700"
                            title={m.description || ''}
                          >
                            {m.description || 'Penerimaan Iuran Kas Warga'}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            Belum ada setoran tercatat di buku kas
                          </span>
                        )}
                      </td>

                      {/* Ref / ID */}
                      <td className="py-3 px-3.5 text-center font-mono text-[10px]">
                        {m.isPaid && m.txId ? (
                          <span
                            className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 cursor-help"
                            title={`UUID Transaksi: ${m.txId}`}
                          >
                            {m.txId.substring(0, 8)}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {filteredMonthlyTable.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                        Tidak ada data bulan yang sesuai dengan filter.
                      </td>
                    </tr>
                  )}
                </tbody>

                {/* Table Summary Footer */}
                <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-xs text-slate-800">
                  <tr>
                    <td colSpan={2} className="py-3.5 px-3.5 text-slate-900 uppercase tracking-wider text-[11px]">
                      Total Akumulasi 12 Bulan ({selectedYear})
                    </td>
                    <td className="py-3.5 px-3.5 text-center">
                      <span className="inline-block px-2.5 py-1 bg-white rounded-lg border border-slate-300 text-slate-900 font-extrabold">
                        {summaryMetrics.paidMonths} Lunas / {summaryMetrics.unpaidMonths} Nunggak
                      </span>
                    </td>
                    <td colSpan={2} className="py-3.5 px-3.5 text-slate-500 font-medium text-[11px]">
                      Tingkat Kepatuhan: <strong className="text-slate-900">{summaryMetrics.complianceRate}%</strong>
                    </td>
                    <td className="py-3.5 px-3.5 text-right font-black text-emerald-800 text-sm">
                      {formatSimpleRupiah(summaryMetrics.totalPaidAmount)}
                    </td>
                    <td colSpan={2} className="py-3.5 px-3.5 text-slate-600 text-[11px]">
                      {summaryMetrics.estimatedArrears > 0 ? (
                        <span className="text-rose-600 font-bold">
                          Est. Tunggakan: {formatSimpleRupiah(summaryMetrics.estimatedArrears)}
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold">
                          ✓ Lunas Penuh Sepanjang Tahun
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 3: ALL CITIZENS MASTER MATRIX TABLE */}
        {viewMode === 'all-table' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Search & Info Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchAllWarga}
                  onChange={(e) => setSearchAllWarga(e.target.value)}
                  placeholder="Cari nama warga, nomor KK, atau alamat..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-600">
                <span>
                  Menampilkan <strong>{filteredAllCitizensMatrix.length}</strong> dari <strong>{dataWarga.length}</strong> warga terdaftar
                </span>
              </div>
            </div>

            {/* Master Matrix Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
              <table className="w-full text-left text-xs border-collapse min-w-[850px]">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <th className="py-3 px-3 text-center w-10">No.</th>
                    <th className="py-3 px-3 min-w-[180px]">Nama Warga / KK</th>
                    <th className="py-3 px-2 min-w-[120px]">No. KK / Alamat</th>
                    {BULAN_LIST.map((b) => (
                      <th key={b.code} className="py-3 px-1 text-center font-mono w-9" title={`Bulan ${b.name}`}>
                        {b.short}
                      </th>
                    ))}
                    <th className="py-3 px-2 text-center">Status</th>
                    <th className="py-3 px-3 text-right">Total Setoran</th>
                    <th className="py-3 px-2 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredAllCitizensMatrix.map((item, idx) => {
                    const isSelected = selectedWargaId === item.warga.id || currentCitizen?.id === item.warga.id;
                    return (
                      <tr
                        key={item.warga.id || idx}
                        className={`transition-colors hover:bg-indigo-50/50 ${
                          isSelected ? 'bg-indigo-50/60 font-medium' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{item.warga.nama_lengkap}</span>
                            {isSelected && (
                              <span className="w-2 h-2 rounded-full bg-indigo-600" title="Sedang Aktif Dipilih" />
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-slate-500 text-[11px]">
                          <div className="font-mono text-slate-700">{item.warga.no_kk || '-'}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                            {item.warga.alamat_domisili || 'RT.002 RW.09'}
                          </div>
                        </td>
                        {item.months.map((m) => (
                          <td key={m.code} className="py-2.5 px-1 text-center">
                            <span
                              title={`${m.name}: ${m.isPaid ? 'Lunas ' + formatSimpleRupiah(m.amount) : 'Tertunggak'}`}
                              className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-black ${
                                m.isPaid
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-50 text-rose-500'
                              }`}
                            >
                              {m.isPaid ? '✓' : '×'}
                            </span>
                          </td>
                        ))}
                        <td className="py-2.5 px-2 text-center">
                          <span
                            className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-full ${
                              item.isFullyPaid
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : item.paidCount > 0
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {item.paidCount}/12 Bln
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 text-xs">
                          {formatSimpleRupiah(item.totalAmount)}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedWargaId(item.warga.id);
                              setViewMode('table');
                              onTriggerToast(`Melihat rincian tabel untuk ${item.warga.nama_lengkap}`, 'info');
                            }}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold transition-all cursor-pointer"
                          >
                            Buka
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredAllCitizensMatrix.length === 0 && (
                    <tr>
                      <td colSpan={17} className="py-8 text-center text-slate-400 italic">
                        Tidak ada data warga yang cocok dengan kata kunci pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            Data disinkronkan secara real-time dari buku kas database <code className="font-mono font-bold text-slate-700">kas_rt</code>.
          </span>
        </div>
        <div className="font-medium text-[11px] text-slate-500">
          Akun Login: <span className="text-slate-900 font-bold">{activeUser?.nama || 'Pengguna'}</span> ({isPengurusInti ? 'Pengurus Inti' : 'Warga'})
        </div>
      </div>

      {/* Modal Pratinjau & Cetak Kartu Iuran */}
      <KartuIuranPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        citizen={currentCitizen}
        selectedYear={selectedYear}
        selectedCategory={selectedCategory}
        monthlyStatus={monthlyStatus}
        summaryMetrics={summaryMetrics}
        sekretariat={sekretariat}
        wilayahLabel={wilayahLabel}
        onTriggerToast={onTriggerToast}
      />
    </div>
  );
};
