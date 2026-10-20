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
  Users
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

/**
 * Ekstrak periode bulan (01-12) dan tahun (misal: 2026) dari sebuah transaksi kas
 */
const getTransactionPeriod = (tx: Transaction): { monthCode: string; year: string } => {
  const desc = (tx.description || '').toLowerCase();
  
  // 1. Coba deteksi pola "Bulan <NamaBulan> <Tahun>" di keterangan (paling akurat)
  const monthMatch = desc.match(/bulan\s+([a-z]+|\d{1,2})/i);
  const yearMatch = desc.match(/(202\d|203\d)/);

  let detectedMonthCode: string | null = null;
  if (monthMatch && monthMatch[1]) {
    const rawM = monthMatch[1].toLowerCase();
    detectedMonthCode = MONTH_NAME_TO_CODE[rawM] || null;
  }

  let detectedYear: string | null = null;
  if (yearMatch && yearMatch[1]) {
    detectedYear = yearMatch[1];
  }

  // 2. Jika keterangan punya bulan & tahun eksplisit, gunakan itu secara mutlak
  if (detectedMonthCode) {
    return {
      monthCode: detectedMonthCode,
      year: detectedYear || (tx.date ? tx.date.split('-')[0] : String(new Date().getFullYear())),
    };
  }

  // 3. Fallback: Gunakan tanggal transaksi (YYYY-MM-DD)
  if (tx.date && tx.date.includes('-')) {
    const parts = tx.date.split('-');
    if (parts.length >= 2) {
      return {
        monthCode: parts[1].padStart(2, '0'),
        year: parts[0],
      };
    }
  }

  const now = new Date();
  return {
    monthCode: String(now.getMonth() + 1).padStart(2, '0'),
    year: String(now.getFullYear()),
  };
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

  // Perhitungan Status Pembayaran 12 Bulan (Januari s/d Desember) untuk warga terpilih SECARA PRESISI
  const monthlyStatus = useMemo(() => {
    if (!currentCitizen) return [];

    // Kumpulkan seluruh ID, nama alias, NIK, KK, dan HP yang merepresentasikan warga ini
    const candidateIds = new Set<string>();
    if (currentCitizen.id) candidateIds.add(currentCitizen.id);
    if (currentCitizen.matchedDbRecord?.id) candidateIds.add(currentCitizen.matchedDbRecord.id);
    if (mySelfCitizen?.id) candidateIds.add(mySelfCitizen.id);
    if (mySelfCitizen?.matchedDbRecord?.id) candidateIds.add(mySelfCitizen.matchedDbRecord.id);
    if (activeUser?.id) candidateIds.add(activeUser.id);
    if (manuallyLinkedWargaId) candidateIds.add(manuallyLinkedWargaId);

    // Kumpulkan seluruh variasi nama
    const candidateNames = new Set<string>();
    const addNameVariation = (name?: string) => {
      if (!name) return;
      const trimmed = name.toLowerCase().trim();
      if (trimmed) candidateNames.add(trimmed);
      const cleaned = cleanPersonName(name);
      if (cleaned) candidateNames.add(cleaned);
    };

    addNameVariation(currentCitizen.nama_lengkap);
    addNameVariation(currentCitizen.matchedDbRecord?.nama_lengkap);
    addNameVariation(activeUser?.nama);
    addNameVariation(mySelfCitizen?.nama_lengkap);

    // Kumpulkan NIK, KK, dan HP
    const candidateNiks = new Set<string>();
    const addNik = (n?: string) => {
      if (n && n !== '-' && n.trim().length >= 6) candidateNiks.add(n.trim());
    };
    addNik(currentCitizen.nik);
    addNik(currentCitizen.matchedDbRecord?.nik);

    const candidateKks = new Set<string>();
    const addKk = (k?: string) => {
      if (k && k !== '-' && k.trim().length >= 6) candidateKks.add(k.trim());
    };
    addKk(currentCitizen.no_kk);
    addKk(currentCitizen.matchedDbRecord?.no_kk);

    const candidatePhones = new Set<string>();
    const addPhone = (p?: string) => {
      const cP = cleanPhoneNumber(p);
      if (cP && cP.length >= 8) candidatePhones.add(cP);
    };
    addPhone(currentCitizen.no_hp);
    addPhone(currentCitizen.matchedDbRecord?.no_hp);
    addPhone(activeUser?.no_hp);

    // 1. Filter transaksi kas masuk yang BENAR-BENAR milik warga ini
    const citizenTxList = transactions.filter((t) => {
      if (t.type !== 'Masuk') return false;

      // A. Paling Akurat: Pencocokan ID Warga langsung
      if (t.wargaId && candidateIds.has(t.wargaId)) {
        return true;
      }

      const descLower = (t.description || '').toLowerCase();
      if (!descLower) return false;

      // B. Pencocokan Nama Lengkap / Alias
      for (const cName of candidateNames) {
        if (cName.length >= 3) {
          if (descLower.includes(cName)) {
            return true;
          }
          // Toleran token: "Budi" + "Santoso"
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

    // 2. Evaluasi status pembayaran untuk masing-masing bulan (01 s/d 12)
    return BULAN_LIST.map((b) => {
      const matchingTx = citizenTxList.find((tx) => {
        // Filter kategori jika bukan "Semua Iuran"
        if (selectedCategory !== 'Semua Iuran' && tx.category !== selectedCategory) {
          return false;
        }

        // Tentukan periode yang dibayar oleh transaksi ini
        const txPeriod = getTransactionPeriod(tx);

        // Hanya cocok jika TAHUN dan BULAN persis sama
        return txPeriod.year === selectedYear && txPeriod.monthCode === b.code;
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
  }, [currentCitizen, mySelfCitizen, activeUser, manuallyLinkedWargaId, transactions, selectedYear, selectedCategory]);

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
          {/* PEMILIH WARGA / IDENTITAS WARGA */}
          <div className="lg:col-span-5">
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
                  className="w-full p-2.5 bg-white border-2 border-indigo-200 focus:border-indigo-600 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 outline-none shadow-2xs cursor-pointer"
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
                <div className="p-3 bg-white border-2 border-emerald-500/40 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center font-black text-sm shrink-0">
                    {currentCitizen?.nama_lengkap ? currentCitizen.nama_lengkap.substring(0, 2).toUpperCase() : 'WG'}
                  </div>
                  <div className="truncate flex-1">
                    <div className="font-extrabold text-sm text-slate-900 truncate flex items-center gap-1.5">
                      <span>{currentCitizen?.nama_lengkap || activeUser?.nama || 'Akun Anda'}</span>
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" title="Akun Terverifikasi" />
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium mt-0.5 truncate">
                      {currentCitizen?.no_kk && currentCitizen.no_kk !== '-' ? `No. KK: ${currentCitizen.no_kk} • ` : ''}
                      {currentCitizen?.alamat_domisili || 'Warga RT.002 RW.09'}
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setIsChangingProfile(!isChangingProfile)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg text-[10px] font-bold shrink-0 transition-all cursor-pointer"
                    title="Sesuaikan jika nama akun login berbeda dengan nama KK di buku kas"
                  >
                    {isChangingProfile ? 'Batal' : 'Sesuaikan KK'}
                  </button>
                </div>

                {/* Dropdown pemilih profil jika warga ingin menyinkronkan ke KK / Nama yang tercatat di RT */}
                {isChangingProfile && (
                  <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-2 animate-in fade-in duration-200">
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
                    <p className="text-[10px] text-indigo-700">
                      Pilih nama kepala keluarga atau nama yang terdaftar saat pengurus mencatat iuran agar seluruh riwayat 12 bulan muncul lengkap.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Year Selector */}
          <div className="lg:col-span-3">
            <label className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Tahun Anggaran</span>
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none shadow-2xs cursor-pointer"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  Tahun {y}
                </option>
              ))}
            </select>
          </div>

          {/* Category Selector */}
          <div className="lg:col-span-4">
            <label className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>Pos Kategori Iuran</span>
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none shadow-2xs cursor-pointer"
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

      {/* 12-Month Matrix Grid */}
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              Matriks Pembayaran 12 Bulan — Tahun {selectedYear}
            </h3>
          </div>
          <div className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
            <span>Warga Yang Dilihat:</span>
            <span className="font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
              {currentCitizen?.nama_lengkap || activeUser?.nama || '-'}
            </span>
          </div>
        </div>

        {/* Grid of 12 Months */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
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
