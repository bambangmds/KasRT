import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileText, 
  FileSpreadsheet, 
  Filter, 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet, 
  CheckCircle2, 
  Info,
  Layers,
  Calendar,
  Sparkles,
  RefreshCw,
  RotateCcw,
  BarChart3,
  PieChart,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  X,
  ListFilter,
  Printer,
  Download,
  Search,
  Database,
  Palette,
  CreditCard,
  ClipboardList
} from 'lucide-react';
import { Transaction, CategoryItem, UserProfile } from '../types';
import { exportToExcel } from '../lib/exportUtils';
import { CATEGORIES_BY_TYPE } from '../data/initialData';
import { PrintPreviewModal } from './PrintPreviewModal';
import { KartuIuranWargaSection } from './KartuIuranWargaSection';
import { LaporanIuranSection } from './LaporanIuranSection';
import { useSekretariat } from '../context/SekretariatContext';

interface LaporanKeuanganViewProps {
  transactions: Transaction[];
  categories?: CategoryItem[];
  connectionStatus?: 'connected' | 'connecting' | 'error' | 'demo';
  onTriggerToast: (msg: string, type?: 'success' | 'error' | 'info', title?: string) => void;
  onRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean;
  onOpenExport?: (filteredData?: Transaction[], filterLabel?: string) => void;
  onOpenImport?: () => void;
  onNavigateToKelolaData?: () => void;
  activeUser?: UserProfile | null;
}

/**
 * Format angka ke format mata uang Rupiah rapi
 * Contoh: 1500000 -> Rp 1.500.000, -500000 -> -Rp 500.000
 */
export function formatRupiahClean(num: number): string {
  if (isNaN(num)) return 'Rp 0';
  if (num < 0) {
    return `-Rp ${Math.abs(num).toLocaleString('id-ID')}`;
  }
  return `Rp ${Number(num).toLocaleString('id-ID')}`;
}

/**
 * Format tanggal YYYY-MM-DD ke format standar Indonesia: dd/mm/yyyy
 * Menggunakan penguncian dd/mm/yyyy agar konsisten di browser lokal tanpa terbalik mm/dd/yyyy.
 */
export function formatTanggalIndo(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const raw = dateStr.split('T')[0].trim();
    const parts = raw.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${day}/${month}/${year}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const dDay = String(d.getDate()).padStart(2, '0');
      const dMonth = String(d.getMonth() + 1).padStart(2, '0');
      return `${dDay}/${dMonth}/${d.getFullYear()}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export const LaporanKeuanganView: React.FC<LaporanKeuanganViewProps> = ({
  transactions,
  categories = [],
  connectionStatus = 'connected',
  onTriggerToast,
  onRefresh,
  isRefreshing = false,
  onOpenExport,
  onOpenImport,
  onNavigateToKelolaData,
  activeUser,
}) => {
  const { sekretariat, wilayahShort, wilayahLabel, kelurahanLabel } = useSekretariat();
  const [activeSubTab, setActiveSubTab] = useState<'rekap-arus-kas' | 'laporan-iuran' | 'kartu-iuran-warga'>('rekap-arus-kas');

  // 1. Auto-fetch data terbaru dari tabel 'kas_rt' di Supabase saat halaman dibuka
  useEffect(() => {
    if (onRefresh) {
      onRefresh();
    }
  }, []);

  // Filter States
  const currentYearStr = new Date().getFullYear().toString();

  // Dynamic available years from transactions + current year
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    transactions.forEach((t) => {
      if (t.date) {
        const y = t.date.split('-')[0];
        if (y && !isNaN(Number(y))) {
          years.add(y);
        }
      }
    });
    years.add(currentYearStr);
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [transactions, currentYearStr]);

  // Default year: latest year with transactions, or 'all' if no year preferred
  const defaultYear = useMemo(() => {
    const hasCurrentYearTx = transactions.some((t) => t.date && t.date.startsWith(currentYearStr));
    if (hasCurrentYearTx) return currentYearStr;
    return availableYears[0] || 'all';
  }, [transactions, currentYearStr, availableYears]);

  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>(defaultYear);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchKeterangan, setSearchKeterangan] = useState<string>('');
  const [detailSearchKeterangan, setDetailSearchKeterangan] = useState<string>('');
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Pilihan skema warna grafik:
  // 'blue-green': Pratinjau Opsi 1 (Biru untuk Kas Masuk & Hijau untuk Kas Keluar)
  // 'green-blue': Pratinjau Opsi 2 (Hijau untuk Kas Masuk & Biru untuk Kas Keluar)
  // 'green-red': Standar Finansial (Hijau Kas Masuk & Merah Kas Keluar)
  const [chartColorScheme, setChartColorScheme] = useState<'blue-green' | 'green-blue' | 'green-red'>(() => {
    return (localStorage.getItem('kas_rt_chart_color_scheme') as 'blue-green' | 'green-blue' | 'green-red') || 'blue-green';
  });

  const handleSetChartColorScheme = (scheme: 'blue-green' | 'green-blue' | 'green-red') => {
    setChartColorScheme(scheme);
    localStorage.setItem('kas_rt_chart_color_scheme', scheme);
    if (onTriggerToast) {
      if (scheme === 'blue-green') {
        onTriggerToast('Pratinjau Grafik Aktif: Biru (Kas Masuk) & Hijau (Kas Keluar).', 'info');
      } else if (scheme === 'green-blue') {
        onTriggerToast('Pratinjau Grafik Aktif: Hijau (Kas Masuk) & Biru (Kas Keluar).', 'info');
      } else {
        onTriggerToast('Skema warna grafik dikembalikan ke Standar Finansial (Hijau & Merah).', 'info');
      }
    }
  };

  const chartColors = useMemo(() => {
    if (chartColorScheme === 'blue-green') {
      return {
        scheme: 'blue-green',
        masukLabel: 'Kas Masuk (Biru)',
        keluarLabel: 'Kas Keluar (Hijau)',
        masukBarClass: 'bg-gradient-to-t from-blue-700 via-blue-600 to-sky-400 group-hover:from-blue-600 group-hover:to-sky-300 shadow-sm shadow-blue-500/20',
        keluarBarClass: 'bg-gradient-to-t from-emerald-600 via-emerald-500 to-teal-400 group-hover:from-emerald-500 group-hover:to-teal-300 shadow-sm shadow-emerald-500/20',
        masukLegendDot: 'bg-gradient-to-tr from-blue-700 to-sky-400',
        keluarLegendDot: 'bg-gradient-to-tr from-emerald-600 to-teal-400',
        masukLegendText: 'text-blue-700 font-bold',
        keluarLegendText: 'text-emerald-700 font-bold',
        masukTooltipText: 'text-blue-300',
        keluarTooltipText: 'text-emerald-300',
        selectedMonthBg: 'bg-blue-50/60 rounded-t-lg ring-1 ring-blue-400',
        selectedMonthText: 'text-blue-800',
        compositionBar: 'bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500',
        compositionPercentText: 'text-blue-700',
        headerIconClass: 'text-blue-600',
        bannerThemeText: 'Biru & Hijau (Opsi 1: Biru Masuk, Hijau Keluar)'
      };
    } else if (chartColorScheme === 'green-blue') {
      return {
        scheme: 'green-blue',
        masukLabel: 'Kas Masuk (Hijau)',
        keluarLabel: 'Kas Keluar (Biru)',
        masukBarClass: 'bg-gradient-to-t from-emerald-700 via-emerald-600 to-teal-400 group-hover:from-emerald-600 group-hover:to-teal-300 shadow-sm shadow-emerald-500/20',
        keluarBarClass: 'bg-gradient-to-t from-blue-700 via-blue-600 to-sky-400 group-hover:from-blue-600 group-hover:to-sky-300 shadow-sm shadow-blue-500/20',
        masukLegendDot: 'bg-gradient-to-tr from-emerald-600 to-teal-400',
        keluarLegendDot: 'bg-gradient-to-tr from-blue-700 to-sky-400',
        masukLegendText: 'text-emerald-700 font-bold',
        keluarLegendText: 'text-blue-700 font-bold',
        masukTooltipText: 'text-emerald-300',
        keluarTooltipText: 'text-blue-300',
        selectedMonthBg: 'bg-emerald-50/60 rounded-t-lg ring-1 ring-emerald-400',
        selectedMonthText: 'text-emerald-800',
        compositionBar: 'bg-gradient-to-r from-emerald-600 via-teal-500 to-blue-500',
        compositionPercentText: 'text-emerald-700',
        headerIconClass: 'text-emerald-600',
        bannerThemeText: 'Hijau & Biru (Opsi 2: Hijau Masuk, Biru Keluar)'
      };
    } else {
      return {
        scheme: 'green-red',
        masukLabel: 'Kas Masuk',
        keluarLabel: 'Kas Keluar',
        masukBarClass: 'bg-gradient-to-t from-emerald-700 via-emerald-600 to-teal-500 group-hover:from-emerald-600 group-hover:to-teal-400 shadow-sm shadow-emerald-500/20',
        keluarBarClass: 'bg-gradient-to-t from-rose-600 via-rose-500 to-pink-400 group-hover:from-rose-500 group-hover:to-pink-300 shadow-sm shadow-rose-500/20',
        masukLegendDot: 'bg-gradient-to-tr from-emerald-600 to-teal-500',
        keluarLegendDot: 'bg-gradient-to-tr from-rose-600 to-pink-500',
        masukLegendText: 'text-slate-700 font-semibold',
        keluarLegendText: 'text-slate-700 font-semibold',
        masukTooltipText: 'text-emerald-300',
        keluarTooltipText: 'text-rose-300',
        selectedMonthBg: 'bg-emerald-50/50 rounded-t-lg ring-1 ring-emerald-400',
        selectedMonthText: 'text-emerald-800',
        compositionBar: 'bg-gradient-to-r from-emerald-600 to-teal-600',
        compositionPercentText: 'text-emerald-700',
        headerIconClass: 'text-emerald-700',
        bannerThemeText: 'Standar Finansial (Hijau Masuk, Merah Keluar)'
      };
    }
  }, [chartColorScheme]);

  // Drill-down State: Kategori yang sedang dibuka detail transaksinya
  const [selectedCategoryDetail, setSelectedCategoryDetail] = useState<string | null>(null);
  const detailSectionRef = useRef<HTMLDivElement>(null);

  // Helper untuk menyorot kata kunci pencarian keterangan/uraian
  const highlightText = (text: string, query: string) => {
    if (!query || !query.trim() || !text) return text;
    const q = query.trim();
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    if (parts.length === 1) return text;
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={i} className="bg-amber-200 text-amber-950 font-bold px-1 py-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Preset kata kunci pencarian keterangan/uraian warga
  const quickKeteranganKeywords = [
    'Iuran Warga',
    'Perbaikan Jalan',
    'Pembangunan Masjid',
    'Biaya keRTan',
    'Lampu Jalan',
    'Kebersihan',
    'Santunan',
    'Pos Ronda',
    'Konsumsi Rapat',
  ];

  // Sync selectedYear if transactions loaded and selectedYear not yet in availableYears
  useEffect(() => {
    if (selectedYear !== 'all' && !availableYears.includes(selectedYear) && availableYears.length > 0) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const months = [
    { value: 'all', label: 'Sepanjang Tahun (Semua Bulan)' },
    { value: '01', label: 'Januari' },
    { value: '02', label: 'Februari' },
    { value: '03', label: 'Maret' },
    { value: '04', label: 'April' },
    { value: '05', label: 'Mei' },
    { value: '06', label: 'Juni' },
    { value: '07', label: 'Juli' },
    { value: '08', label: 'Agustus' },
    { value: '09', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' },
  ];

  // Unique categories from predefined list and recorded transactions
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    if (categories && categories.length > 0) {
      categories.forEach((c) => cats.add(c.name));
    } else {
      CATEGORIES_BY_TYPE.Masuk.forEach((c) => cats.add(c.value));
      CATEGORIES_BY_TYPE.Keluar.forEach((c) => cats.add(c.value));
    }
    transactions.forEach((t) => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats).sort();
  }, [transactions, categories]);

  // Filtered transactions for calculation based on dashboard filters
  const filteredTransactions = useMemo(() => {
    const q = searchKeterangan.toLowerCase().trim();
    return transactions.filter((tx) => {
      if (!tx.date) return false;
      const parts = tx.date.split('-');
      const txYear = parts[0];
      const txMonth = parts[1];

      const matchYear = selectedYear === 'all' || txYear === selectedYear;
      const matchMonth = selectedMonth === 'all' || txMonth === selectedMonth;
      const matchCategory = selectedCategory === 'all' || tx.category === selectedCategory;
      const matchKeterangan = !q || (tx.description || '').toLowerCase().includes(q);

      return matchYear && matchMonth && matchCategory && matchKeterangan;
    });
  }, [transactions, selectedYear, selectedMonth, selectedCategory, searchKeterangan]);

  // 2. Hitung secara otomatis nilai untuk 3 kartu metrik di bagian atas:
  // - "Total Kas Masuk": Jumlahkan semua kolom 'jumlah' yang memiliki 'jenis' = 'Masuk'.
  // - "Total Kas Keluar": Jumlahkan semua kolom 'jumlah' yang memiliki 'jenis' = 'Keluar'.
  // - "Saldo Akhir Saat Ini": Kurangi (Total Kas Masuk - Total Kas Keluar).
  const { totalMasuk, totalKeluar, saldoAkhir, countMasuk, countKeluar } = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    let cMasuk = 0;
    let cKeluar = 0;

    filteredTransactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'Masuk') {
        masuk += amt;
        cMasuk += 1;
      } else {
        keluar += amt;
        cKeluar += 1;
      }
    });

    return {
      totalMasuk: masuk,
      totalKeluar: keluar,
      saldoAkhir: masuk - keluar,
      countMasuk: cMasuk,
      countKeluar: cKeluar,
    };
  }, [filteredTransactions]);

  // Overall Cumulative Balance across all transactions in database
  const overallDatabaseBalance = useMemo(() => {
    let bal = 0;
    transactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'Masuk') bal += amt;
      else bal -= amt;
    });
    return bal;
  }, [transactions]);

  // Monthly trends calculated dynamically from Supabase transactions
  const monthlyTrends = useMemo(() => {
    const monthNames = [
      { num: '01', name: 'Jan' },
      { num: '02', name: 'Feb' },
      { num: '03', name: 'Mar' },
      { num: '04', name: 'Apr' },
      { num: '05', name: 'Mei' },
      { num: '06', name: 'Jun' },
      { num: '07', name: 'Jul' },
      { num: '08', name: 'Agu' },
      { num: '09', name: 'Sep' },
      { num: '10', name: 'Okt' },
      { num: '11', name: 'Nov' },
      { num: '12', name: 'Des' },
    ];

    const dataPoints = monthNames.map((m) => {
      let masuk = 0;
      let keluar = 0;
      let count = 0;

      transactions.forEach((t) => {
        if (!t.date) return;
        const [y, mon] = t.date.split('-');
        const matchYear = selectedYear === 'all' || y === selectedYear;
        const matchCategory = selectedCategory === 'all' || t.category === selectedCategory;

        if (matchYear && mon === m.num && matchCategory) {
          const amt = Number(t.amount) || 0;
          if (t.type === 'Masuk') masuk += amt;
          else keluar += amt;
          count += 1;
        }
      });

      return {
        monthCode: m.num,
        month: m.name,
        masuk,
        keluar,
        count,
        net: masuk - keluar,
      };
    });

    // Max value for height normalization (minimum scale 100,000 for aesthetics)
    const maxVal = Math.max(...dataPoints.map((d) => Math.max(d.masuk, d.keluar)), 100000);

    return dataPoints.map((d) => ({
      ...d,
      masukHeight: `${Math.max(Math.round((d.masuk / maxVal) * 100), d.masuk > 0 ? 8 : 2)}%`,
      keluarHeight: `${Math.max(Math.round((d.keluar / maxVal) * 100), d.keluar > 0 ? 8 : 2)}%`,
    }));
  }, [transactions, selectedYear, selectedCategory]);

  // Highest income month analysis
  const highestIncomeMonth = useMemo(() => {
    let max = -1;
    let best = null;
    monthlyTrends.forEach((m) => {
      if (m.masuk > max) {
        max = m.masuk;
        best = m;
      }
    });
    return max > 0 ? best : null;
  }, [monthlyTrends]);

  // Dynamic Category Composition
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { kategori: string; jenis: 'Masuk' | 'Keluar'; jumlah: number; nominal: number }>();

    filteredTransactions.forEach((tx) => {
      const key = `${tx.category}_${tx.type}`;
      if (!map.has(key)) {
        map.set(key, {
          kategori: tx.category,
          jenis: tx.type,
          jumlah: 0,
          nominal: 0,
        });
      }
      const item = map.get(key)!;
      item.jumlah += 1;
      item.nominal += Number(tx.amount) || 0;
    });

    return Array.from(map.values()).sort((a, b) => b.nominal - a.nominal);
  }, [filteredTransactions]);

  // Drill-down: Transaksi detail untuk kategori terpilih, disaring menurut bulan & tahun anggaran aktif serta kata kunci keterangan
  const categoryDetailTransactions = useMemo(() => {
    if (!selectedCategoryDetail) return [];
    const qGlobal = searchKeterangan.toLowerCase().trim();
    const qDetail = detailSearchKeterangan.toLowerCase().trim();

    return transactions
      .filter((tx) => {
        if (!tx.date) return false;
        const [txYear, txMonth] = tx.date.split('-');
        const matchYear = selectedYear === 'all' || txYear === selectedYear;
        const matchMonth = selectedMonth === 'all' || txMonth === selectedMonth;
        const matchCategory = tx.category === selectedCategoryDetail;
        const matchGlobal = !qGlobal || (tx.description || '').toLowerCase().includes(qGlobal);
        const matchDetail = !qDetail || (tx.description || '').toLowerCase().includes(qDetail);

        return matchYear && matchMonth && matchCategory && matchGlobal && matchDetail;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, selectedCategoryDetail, selectedYear, selectedMonth, searchKeterangan, detailSearchKeterangan]);

  // Ringkasan metrik untuk kategori yang sedang di-drilldown
  const categoryDetailSummary = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    categoryDetailTransactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'Masuk') masuk += amt;
      else keluar += amt;
    });
    return {
      masuk,
      keluar,
      net: masuk - keluar,
      totalCount: categoryDetailTransactions.length,
    };
  }, [categoryDetailTransactions]);

  // Handler klik baris kategori (buka/tutup detail)
  const handleSelectCategoryRow = (categoryName: string) => {
    if (selectedCategoryDetail === categoryName) {
      // Klik ulang kategori yang sama untuk menutup
      setSelectedCategoryDetail(null);
    } else {
      setSelectedCategoryDetail(categoryName);
      setTimeout(() => {
        detailSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  };

  // Composition distribution for masuk categories
  const masukComposition = useMemo(() => {
    const masukCategories = categoryBreakdown.filter((c) => c.jenis === 'Masuk');
    const total = masukCategories.reduce((acc, c) => acc + c.nominal, 0);

    if (total === 0) return [];

    return masukCategories.slice(0, 5).map((c) => ({
      kategori: c.kategori,
      nominal: c.nominal,
      percentage: Math.round((c.nominal / total) * 100),
    }));
  }, [categoryBreakdown]);

  // Filter handlers
  const handleApplyFilter = () => {
    setIsApplyingFilter(true);
    const monthObj = months.find((m) => m.value === selectedMonth);
    const monthLabel = monthObj ? monthObj.label : 'Semua Bulan';
    const yearLabel = selectedYear === 'all' ? 'Semua Tahun' : `Tahun ${selectedYear}`;
    setTimeout(() => {
      setIsApplyingFilter(false);
      onTriggerToast(`Filter Aktif: ${monthLabel} • ${yearLabel}`, 'success');
    }, 200);
  };

  const handleResetFilter = () => {
    setSelectedMonth('all');
    setSelectedYear('all');
    setSelectedCategory('all');
    setSearchKeterangan('');
    setDetailSearchKeterangan('');
    onTriggerToast('Filter direset ke semua periode dan keterangan.', 'info');
  };

  const isFilterActive =
    selectedMonth !== 'all' ||
    selectedYear !== 'all' ||
    selectedCategory !== 'all' ||
    Boolean(searchKeterangan.trim());

  const handleManualRefresh = async () => {
    if (onRefresh) {
      await onRefresh();
      onTriggerToast('Data laporan kas berhasil disinkronkan dengan Supabase.', 'success');
    }
  };

  const getActivePeriodLabel = () => {
    const monthObj = months.find((m) => m.value === selectedMonth);
    const monthLabel = selectedMonth === 'all' ? 'Semua Bulan' : (monthObj ? monthObj.label : selectedMonth);
    const yearLabel = selectedYear === 'all' ? 'Semua Tahun' : `Tahun ${selectedYear}`;
    const catLabel = selectedCategory === 'all' ? '' : ` • Kategori: ${selectedCategory}`;
    return `${monthLabel} • ${yearLabel}${catLabel}`;
  };

  const handleExportPDF = () => {
    setIsPrintModalOpen(true);
  };

  const handleExportExcel = () => {
    const periodLabel = getActivePeriodLabel();
    if (onOpenExport) {
      onOpenExport(filteredTransactions, periodLabel);
      return;
    }

    try {
      const rtStr = sekretariat?.rt || '';
      const rwStr = sekretariat?.rw || '';
      exportToExcel(filteredTransactions, {
        filename: `Laporan_Kas_${rtStr ? `RT${rtStr}_` : ''}${rwStr ? `RW${rwStr}_` : ''}${selectedYear}_${selectedMonth}.xlsx`,
        scopeTitle: `Laporan Kas (${periodLabel})`,
        includeSummary: true,
        sekretariat,
      });
      onTriggerToast('File laporan kas berhasil diunduh (Format Excel .xlsx).', 'success');
    } catch (e) {
      console.error(e);
      onTriggerToast('Gagal mengunduh file Excel.', 'error');
    }
  };

  return (
    <div className="flex flex-col w-full space-y-8 print:space-y-4">
      {/* Kop Surat Resmi untuk Cetak / PDF (Hanya Tampil Saat Cetak Dokumen) */}
      <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-4 text-center">
        <h2 className="text-xl font-black uppercase tracking-wider text-slate-950">
          {sekretariat.rt ? `RUKUN TETANGGA ${sekretariat.rt}` : 'RUKUN TETANGGA'} {sekretariat.rw ? `RUKUN WARGA ${sekretariat.rw}` : 'RUKUN WARGA'}
        </h2>
        <h3 className="text-base font-extrabold uppercase text-slate-900">
          {sekretariat.kelurahan ? `KELURAHAN ${sekretariat.kelurahan.toUpperCase()}` : ''}{sekretariat.kecamatan ? `, KECAMATAN ${sekretariat.kecamatan.toUpperCase()}` : ''}
        </h3>
        <p className="text-xs text-slate-600 mt-1">
          Buku Kas Keuangan & Laporan Pertanggungjawaban Mutasi Kas Warga
        </p>
        <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mt-3 pt-2 border-t border-slate-300">
          <span>
            Periode:{' '}
            {selectedMonth === 'all'
              ? 'Semua Bulan'
              : months.find((m) => m.value === selectedMonth)?.label || selectedMonth}{' '}
            {selectedYear === 'all' ? '(Semua Tahun)' : `Tahun ${selectedYear}`}
          </span>
          <span>Tanggal Cetak: {new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</span>
          <span>Tercatat: {filteredTransactions.length} Transaksi</span>
        </div>
      </div>

      {/* Header Title & Action Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-full border border-emerald-300/80 shadow-2xs">
              Laporan & Analisis Kas
            </span>
            <span className="text-xs font-medium text-slate-500 hidden sm:inline">• {wilayahLabel}</span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
            Laporan & Rekap Kas Warga
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Analisis arus kas masuk, pengeluaran rutin, dan saldo kas terverifikasi dari Supabase
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap print:hidden">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 transition-all rounded-xl text-xs sm:text-sm font-semibold border border-slate-200 shadow-2xs cursor-pointer active:scale-98 disabled:opacity-60"
            title="Segarkan data langsung dari Supabase"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Segarkan</span>
          </button>

          {/* Cetak PDF Button */}
          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 transition-all rounded-xl text-xs sm:text-sm font-semibold border border-slate-200 shadow-2xs cursor-pointer active:scale-98"
            title="Cetak Laporan PDF Resmi Warga"
          >
            <Printer className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Cetak / PDF</span>
          </button>

          {/* Ekspor Data Lengkap Button */}
          <button
            type="button"
            onClick={() => {
              const periodLabel = getActivePeriodLabel();
              if (onOpenExport) {
                onOpenExport(filteredTransactions, periodLabel);
              } else {
                handleExportExcel();
              }
            }}
            className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white hover:from-slate-800 hover:to-indigo-900 transition-all rounded-xl text-xs sm:text-sm font-semibold shadow-sm ring-1 ring-slate-700/50 cursor-pointer active:scale-98"
            title="Pilihan Format Ekspor Lengkap (.xlsx, PDF, CSV, JSON)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Ekspor (.xlsx, CSV...)</span>
          </button>

          {/* Tombol Pintas ke Halaman Kelola Data */}
          {onNavigateToKelolaData && (
            <button
              type="button"
              onClick={onNavigateToKelolaData}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 text-indigo-900 transition-all rounded-xl text-xs sm:text-sm font-bold border border-indigo-200/80 shadow-2xs cursor-pointer active:scale-98"
              title="Buka Halaman Kelola Data (Backup, Restore, Import & Reset Database)"
            >
              <Database className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Kelola & Backup</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub Menu / Mode Navigation */}
      <div className="flex border-b border-slate-200 bg-white p-1 rounded-xl shadow-xs border print:hidden gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveSubTab('rekap-arus-kas')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeSubTab === 'rekap-arus-kas'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20 ring-1 ring-emerald-500/30 font-extrabold'
              : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/60'
          }`}
        >
          <BarChart3 className={`w-3.5 h-3.5 transition-transform ${activeSubTab === 'rekap-arus-kas' ? 'text-emerald-100 scale-110' : 'text-slate-400'}`} />
          <span>Rekap Arus Kas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('laporan-iuran')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeSubTab === 'laporan-iuran'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-1 ring-indigo-500/30 font-extrabold'
              : 'text-slate-600 hover:text-indigo-700 hover:bg-indigo-50/60'
          }`}
        >
          <ClipboardList className={`w-3.5 h-3.5 transition-transform ${activeSubTab === 'laporan-iuran' ? 'text-blue-100 scale-110' : 'text-slate-400'}`} />
          <span>Kepatuhan Iuran</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('kartu-iuran-warga')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeSubTab === 'kartu-iuran-warga'
              ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-fuchsia-600/20 ring-1 ring-fuchsia-500/30 font-extrabold'
              : 'text-slate-600 hover:text-fuchsia-700 hover:bg-fuchsia-50/60'
          }`}
        >
          <CreditCard className={`w-3.5 h-3.5 transition-transform ${activeSubTab === 'kartu-iuran-warga' ? 'text-fuchsia-100 scale-110' : 'text-slate-400'}`} />
          <span>Kartu Iuran Warga (12 Bulan)</span>
        </button>
      </div>

      {/* VIEW 1: KARTU IURAN WARGA (12 BULAN) */}
      {activeSubTab === 'kartu-iuran-warga' && (
        <KartuIuranWargaSection
          transactions={transactions}
          categories={categories}
          activeUser={activeUser}
          connectionStatus={connectionStatus}
          onTriggerToast={onTriggerToast}
          onRefreshTransactions={onRefresh}
        />
      )}

      {/* VIEW 2: LAPORAN KEPATUHAN IURAN */}
      {activeSubTab === 'laporan-iuran' && (
        <LaporanIuranSection
          transactions={transactions}
          categories={categories}
          activeUser={activeUser}
          connectionStatus={connectionStatus}
          onTriggerToast={onTriggerToast}
          onRefreshTransactions={onRefresh}
        />
      )}

      {/* VIEW 3: REKAPITULASI & ARUS KAS UTAMA */}
      {activeSubTab === 'rekap-arus-kas' && (
        <div className="space-y-4 sm:space-y-5 lg:space-y-6">
          {/* 3. Filter Section (Bulan, Tahun, Kategori, & Keterangan) */}
          <div className="bg-white rounded-2xl p-3.5 sm:p-4.5 border border-slate-200 shadow-sm print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 sm:gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 flex-1">
            {/* Filter Bulan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Bulan Periode</span>
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 border border-slate-200 focus:border-slate-400 cursor-pointer font-medium"
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Tahun */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Tahun Anggaran</span>
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 border border-slate-200 focus:border-slate-400 cursor-pointer font-medium"
              >
                <option value="all">Semua Tahun (Akumulatif)</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    Tahun {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Kategori */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>Kategori Kas</span>
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 border border-slate-200 focus:border-slate-400 cursor-pointer font-medium"
              >
                <option value="all">Semua Kategori</option>
                {uniqueCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Keterangan / Uraian */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Cari Keterangan / Uraian</span>
                </span>
                {searchKeterangan && (
                  <button
                    type="button"
                    onClick={() => setSearchKeterangan('')}
                    className="text-[10px] text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  >
                    Hapus
                  </button>
                )}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchKeterangan}
                  onChange={(e) => setSearchKeterangan(e.target.value)}
                  placeholder="Ketik keterangan (cth: lampu, iuran...)"
                  className="w-full pl-8 pr-7 py-2 bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10 border border-slate-200 focus:border-slate-400 font-medium"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                {searchKeterangan && (
                  <button
                    type="button"
                    onClick={() => setSearchKeterangan('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 cursor-pointer"
                    title="Kosongkan pencarian"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isFilterActive && (
              <button
                type="button"
                onClick={handleResetFilter}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all rounded-xl text-xs sm:text-sm font-semibold cursor-pointer active:scale-98"
                title="Kembalikan filter ke semua periode"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleApplyFilter}
              disabled={isApplyingFilter}
              className="flex items-center justify-center gap-1.5 px-4.5 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white transition-all rounded-xl text-xs sm:text-sm font-bold shadow-sm shadow-emerald-600/20 hover:shadow-md cursor-pointer disabled:opacity-60 active:scale-98"
            >
              {isApplyingFilter ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <Filter className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{isApplyingFilter ? 'Menerapkan...' : 'Terapkan Filter'}</span>
            </button>
          </div>
        </div>

        {/* Quick Chips Keterangan */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            Pencarian Cepat:
          </span>
          {quickKeteranganKeywords.map((kw) => {
            const isSelected = searchKeterangan.toLowerCase() === kw.toLowerCase();
            return (
              <button
                key={kw}
                type="button"
                onClick={() => setSearchKeterangan(isSelected ? '' : kw)}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs font-semibold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {kw}
              </button>
            );
          })}
        </div>

        {/* Filter status indicator pill */}
        {isFilterActive && (
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>
                Menyaring <strong>{filteredTransactions.length}</strong> transaksi
                {searchKeterangan && (
                  <> dengan uraian &ldquo;<span className="text-emerald-700 font-semibold">{searchKeterangan}</span>&rdquo;</>
                )}
                {' '}dari total {transactions.length} catatan Supabase
              </span>
            </span>
            <span className="text-slate-400 text-[11px]">Filter aktif mempengaruhi 3 kartu metrik, grafik, dan tabel</span>
          </div>
        )}
      </div>

      {/* 2. Tiga Kartu Metrik di Bagian Atas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 lg:gap-5">
        {/* Kartu 1: Total Kas Masuk */}
        <div className="bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/40 rounded-2xl p-4.5 sm:p-5 relative overflow-hidden shadow-sm border border-emerald-200/90 group hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-emerald-500 via-teal-500 to-emerald-600" />
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Total Kas Masuk
              </span>
              <span className="text-[10.5px] text-slate-400 font-medium">Pemasukan & Iuran Warga</span>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 ring-1 ring-emerald-200/60">
              <TrendingUp className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 mb-1.5 tracking-tight">
            {formatRupiahClean(totalMasuk)}
          </div>
          <div className="flex items-center gap-1.5 text-emerald-800 text-[11px] font-bold bg-emerald-100/60 px-2.5 py-0.5 rounded-lg w-fit border border-emerald-200/70">
            <ArrowDownLeft className="w-3 h-3" />
            <span>
              {countMasuk} transaksi penerimaan
            </span>
          </div>
        </div>

        {/* Kartu 2: Total Kas Keluar */}
        <div className="bg-gradient-to-br from-white via-rose-50/20 to-pink-50/40 rounded-2xl p-4.5 sm:p-5 relative overflow-hidden shadow-sm border border-rose-200/90 group hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-rose-500 via-pink-500 to-rose-600" />
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Total Kas Keluar
              </span>
              <span className="text-[10.5px] text-slate-400 font-medium">Pengeluaran & Operasional</span>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-600 text-white flex items-center justify-center shadow-md shadow-rose-600/30 ring-1 ring-rose-200/60">
              <TrendingDown className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 mb-1.5 tracking-tight">
            {formatRupiahClean(totalKeluar)}
          </div>
          <div className="flex items-center gap-1.5 text-rose-800 text-[11px] font-bold bg-rose-100/60 px-2.5 py-0.5 rounded-lg w-fit border border-rose-200/70">
            <ArrowUpRight className="w-3 h-3" />
            <span>
              {countKeluar} transaksi pengeluaran
            </span>
          </div>
        </div>

        {/* Kartu 3: Saldo Akhir Saat Ini (Total Kas Masuk - Total Kas Keluar) */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white rounded-2xl p-4.5 sm:p-5 relative overflow-hidden shadow-xl border border-slate-700/80 ring-1 ring-emerald-500/30 group hover:shadow-2xl transition-all">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-emerald-400 to-teal-400" />
          <div className="absolute -right-8 -bottom-8 w-44 h-44 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-6 -top-6 w-32 h-32 bg-teal-500/15 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3 relative">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400 block">
                Saldo Bersih Kas
              </span>
              <span className="text-[10.5px] text-slate-400 font-medium">
                (Total Masuk − Total Keluar)
              </span>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-emerald-300 shadow-inner">
              <Wallet className="w-4.5 h-4.5 text-emerald-300" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white mb-1.5 tracking-tight relative">
            {formatRupiahClean(saldoAkhir)}
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold relative flex-wrap">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold shadow-2xs ${
                saldoAkhir >= 0
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>{saldoAkhir >= 0 ? 'Surplus' : 'Defisit'}</span>
            </span>
            {isFilterActive && (
              <span className="text-[11px] text-slate-300 truncate">
                • Total Seluruh DB: {formatRupiahClean(overallDatabaseBalance)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Interactive Chart & Composition Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            {/* Header Grafik & Baris Judul */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className={`w-5 h-5 ${chartColors.headerIconClass}`} />
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                    Tren Arus Kas Bulanan {selectedYear === 'all' ? '(Semua Tahun)' : `(${selectedYear})`}
                  </h2>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Live Supabase
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visualisasi data perbandingan Kas Masuk vs Kas Keluar riil dari database
                </p>
              </div>

              {/* Indikator Legenda Warna */}
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className={`w-3.5 h-3.5 rounded-sm ${chartColors.masukLegendDot} shadow-2xs`} />
                  <span className={chartColors.masukLegendText}>{chartColors.masukLabel}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-3.5 h-3.5 rounded-sm ${chartColors.keluarLegendDot} shadow-2xs`} />
                  <span className={chartColors.keluarLegendText}>{chartColors.keluarLabel}</span>
                </div>
              </div>
            </div>

            {/* Banner Interaktif: Pemilih & Pratinjau Skema Warna Grafik (Biru & Hijau) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-gradient-to-r from-blue-50/70 via-teal-50/50 to-emerald-50/70 rounded-xl border border-blue-200/80 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 via-teal-600 to-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800">
                      Pilihan Warna Grafik:
                    </span>
                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-white border border-blue-200 text-blue-900 shadow-2xs">
                      {chartColors.bannerThemeText}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Klik tombol di samping untuk menguji langsung tampilan warna Biru & Hijau vs Standar.
                  </p>
                </div>
              </div>

              {/* Segmented Switcher Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs shrink-0">
                <button
                  type="button"
                  onClick={() => handleSetChartColorScheme('blue-green')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    chartColorScheme === 'blue-green'
                      ? 'bg-gradient-to-r from-blue-600 to-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  title="Opsi 1: Kas Masuk Biru & Kas Keluar Hijau"
                >
                  <span className="flex items-center -space-x-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-white" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />
                  </span>
                  <span>Biru & Hijau</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetChartColorScheme('green-blue')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    chartColorScheme === 'green-blue'
                      ? 'bg-gradient-to-r from-emerald-600 to-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  title="Opsi 2: Kas Masuk Hijau & Kas Keluar Biru"
                >
                  <span className="flex items-center -space-x-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-white" />
                  </span>
                  <span>Hijau & Biru</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetChartColorScheme('green-red')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    chartColorScheme === 'green-red'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  title="Warna Standar: Kas Masuk Hijau & Kas Keluar Merah"
                >
                  <span className="flex items-center -space-x-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-white" />
                  </span>
                  <span>Standar</span>
                </button>
              </div>
            </div>
          </div>

          {/* Dynamic SVG/HTML Bar Chart */}
          <div className="w-full h-64 flex items-end justify-between gap-2 sm:gap-3 pt-8 px-2 border-b border-slate-200 relative">
            {monthlyTrends.map((item, idx) => {
              const isSelectedMonth = selectedMonth !== 'all' && selectedMonth === item.monthCode;
              return (
                <div
                  key={item.monthCode}
                  onMouseEnter={() => setHoveredBar(idx)}
                  onMouseLeave={() => setHoveredBar(null)}
                  className={`flex-1 flex flex-col items-center h-full justify-end gap-2 group relative cursor-pointer ${
                    isSelectedMonth ? chartColors.selectedMonthBg : ''
                  }`}
                >
                  {/* Tooltip on hover */}
                  {hoveredBar === idx && (
                    <div className="absolute -top-16 z-30 bg-slate-900 text-white text-xs py-2 px-3 rounded-xl shadow-xl whitespace-nowrap pointer-events-none border border-slate-700 animate-in fade-in zoom-in-95">
                      <div className="font-bold text-white flex items-center justify-between gap-3">
                        <span>Bulan {item.month} {selectedYear !== 'all' ? selectedYear : ''}</span>
                        <span className="text-[10px] text-slate-400">{item.count} transaksi</span>
                      </div>
                      <div className={`text-[11px] ${chartColors.masukTooltipText} font-medium`}>
                        {chartColors.scheme === 'blue-green' ? 'Masuk (Biru)' : 'Masuk'}: {formatRupiahClean(item.masuk)}
                      </div>
                      <div className={`text-[11px] ${chartColors.keluarTooltipText} font-medium`}>
                        {chartColors.scheme === 'blue-green' ? 'Keluar (Hijau)' : 'Keluar'}: {formatRupiahClean(item.keluar)}
                      </div>
                      <div className="text-[11px] text-slate-200 pt-0.5 border-t border-slate-800 font-bold">
                        Selisih: {formatRupiahClean(item.net)}
                      </div>
                    </div>
                  )}

                  <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-48">
                    {/* Masuk Bar */}
                    <div
                      className={`w-1/2 rounded-t-md transition-all duration-300 min-h-[4px] ${chartColors.masukBarClass}`}
                      style={{ height: item.masukHeight }}
                      title={`Kas Masuk: ${formatRupiahClean(item.masuk)}`}
                    />
                    {/* Keluar Bar */}
                    <div
                      className={`w-1/2 rounded-t-md transition-all duration-300 min-h-[4px] ${chartColors.keluarBarClass}`}
                      style={{ height: item.keluarHeight }}
                      title={`Kas Keluar: ${formatRupiahClean(item.keluar)}`}
                    />
                  </div>
                  <span
                    className={`text-[11px] pb-2 ${
                      isSelectedMonth
                        ? `font-extrabold ${chartColors.selectedMonthText}`
                        : item.masuk > 0 || item.keluar > 0
                        ? 'font-bold text-slate-900'
                        : 'text-slate-400 font-medium'
                    }`}
                  >
                    {item.month}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Chart Footer Stats */}
          <div className="pt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Sparkles className={`w-3.5 h-3.5 ${chartColors.headerIconClass}`} />
              <span>
                {highestIncomeMonth
                  ? `Pemasukan Tertinggi: Bulan ${highestIncomeMonth.month} (${formatRupiahClean(highestIncomeMonth.masuk)})`
                  : 'Grafik diperbarui secara otomatis dari riwayat transaksi kas'}
              </span>
            </span>
            <span className="font-semibold text-slate-700">
              Periode: {selectedYear === 'all' ? 'Semua Tahun' : `Tahun ${selectedYear}`}
            </span>
          </div>
        </div>

        {/* Composition Breakdown Widget */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <PieChart className={`w-5 h-5 ${chartColors.headerIconClass}`} />
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Komposisi Kas Masuk
              </h2>
            </div>
            <p className="text-xs text-slate-500 mb-6">
              Distribusi pos pemasukan kas warga periode terpilih
            </p>

            <div className="space-y-4">
              {masukComposition.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Belum ada pemasukan kas pada periode yang dipilih.
                </div>
              ) : (
                masukComposition.map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span className="text-slate-900 truncate max-w-[170px]" title={item.kategori}>
                        {item.kategori}
                      </span>
                      <span className={`font-bold ${chartColors.compositionPercentText}`}>{item.percentage}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${chartColors.compositionBar}`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 text-right">
                      {formatRupiahClean(item.nominal)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200">
            <div className="p-3.5 bg-slate-50 rounded-xl flex items-start gap-2.5 border border-slate-200">
              <ShieldCheck className={`w-4 h-4 ${chartColors.headerIconClass} shrink-0 mt-0.5`} />
              <span className="text-xs text-slate-600 leading-relaxed">
                Seluruh kalkulasi disinkronkan secara real-time dari tabel <strong>kas_rt</strong> Supabase.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Table Summary Category Section (Drill-Down Trigger) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Ringkasan Realisasi Anggaran Per Kategori
              </h2>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 hidden sm:inline">
                Interaktif
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Klik baris kategori di bawah ini untuk melihat rincian riwayat transaksi secara langsung (Drill-down).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1 rounded-full border border-slate-200 self-start sm:self-auto">
              {categoryBreakdown.length} Pos Anggaran
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200">
                <th className="py-3.5 px-5 sm:px-6">Kategori Anggaran</th>
                <th className="py-3.5 px-5 sm:px-6">Jenis Aliran</th>
                <th className="py-3.5 px-5 sm:px-6 text-center">Frekuensi Transaksi</th>
                <th className="py-3.5 px-5 sm:px-6 text-right">Total Nominal</th>
                <th className="py-3.5 px-4 text-center w-28">Rincian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {categoryBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Tidak ada data transaksi yang cocok dengan filter yang dipilih.
                  </td>
                </tr>
              ) : (
                categoryBreakdown.map((cat, i) => {
                  const isPemasukan = cat.jenis === 'Masuk';
                  const isSelected = selectedCategoryDetail === cat.kategori;
                  return (
                    <tr
                      key={i}
                      onClick={() => handleSelectCategoryRow(cat.kategori)}
                      className={`cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? 'bg-emerald-50/80 border-l-4 border-l-emerald-600 font-semibold'
                          : 'hover:bg-slate-50/90 border-l-4 border-l-transparent'
                      }`}
                      title={`Klik untuk melihat detail seluruh transaksi kategori "${cat.kategori}"`}
                    >
                      <td className="py-3.5 px-5 sm:px-6 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className={isSelected ? 'text-emerald-900 font-black' : ''}>
                            {cat.kategori}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] font-bold bg-emerald-200/80 text-emerald-900 px-1.5 py-0.5 rounded">
                              Dibuka
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 sm:px-6">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isPemasukan
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isPemasukan ? 'bg-emerald-600' : 'bg-rose-500'
                            }`}
                          />
                          {isPemasukan ? 'Kas Masuk' : 'Kas Keluar'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 sm:px-6 text-center font-medium text-slate-600">
                        {cat.jumlah} kali
                      </td>
                      <td
                        className={`py-3.5 px-5 sm:px-6 text-right font-extrabold text-sm ${
                          isPemasukan ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {isPemasukan ? '+ ' : '- '}
                        {formatRupiahClean(cat.nominal)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                            isSelected
                              ? 'bg-emerald-700 text-white shadow-2xs'
                              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          {isSelected ? 'Tutup' : 'Lihat Detail'}
                          {isSelected ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {categoryBreakdown.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-extrabold text-xs text-slate-900 border-t border-slate-200">
                  <td className="py-3.5 px-5 sm:px-6" colSpan={2}>
                    Total Selisih Bersih (Total Masuk - Total Keluar):
                  </td>
                  <td className="py-3.5 px-5 sm:px-6 text-center text-slate-500">
                    {filteredTransactions.length} Total Transaksi
                  </td>
                  <td
                    className={`py-3.5 px-5 sm:px-6 text-right text-sm font-black ${
                      saldoAkhir >= 0 ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    {formatRupiahClean(saldoAkhir)}
                  </td>
                  <td className="py-3.5 px-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 6. Drill-Down Detail Table Section */}
      {selectedCategoryDetail && (
        <div
          ref={detailSectionRef}
          className="bg-white rounded-xl shadow-md border-2 border-emerald-500/50 overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          {/* Detail Header */}
          <div className="p-5 sm:p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1.5">
                  <ListFilter className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Detail Transaksi Kategori</span>
                </span>
                <span className="text-xs text-slate-300 hidden sm:inline">
                  • {selectedMonth !== 'all' ? `Bulan ${months.find((m) => m.value === selectedMonth)?.label}` : 'Semua Bulan'}
                  {' / '}
                  {selectedYear !== 'all' ? `Tahun ${selectedYear}` : 'Semua Tahun'}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <span>{selectedCategoryDetail}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Menampilkan seluruh riwayat kas masuk dan keluar untuk kategori ini sesuai periode filter dashboard.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              {/* Quick summary metrics */}
              <div className="flex items-center gap-3 bg-slate-800/90 px-3.5 py-2 rounded-lg border border-slate-700 text-xs">
                <span className="text-slate-300">
                  <strong className="text-white">{categoryDetailSummary.totalCount}</strong> Transaksi
                </span>
                {categoryDetailSummary.masuk > 0 && (
                  <span className="text-emerald-400 font-bold">
                    +{formatRupiahClean(categoryDetailSummary.masuk)}
                  </span>
                )}
                {categoryDetailSummary.keluar > 0 && (
                  <span className="text-rose-400 font-bold">
                    -{formatRupiahClean(categoryDetailSummary.keluar)}
                  </span>
                )}
              </div>

              {/* Tombol Tutup Detail */}
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryDetail(null);
                  setDetailSearchKeterangan('');
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer border border-slate-700 active:scale-95 shadow-xs shrink-0"
              >
                <X className="w-4 h-4 text-slate-400" />
                <span>Tutup Detail</span>
              </button>
            </div>
          </div>

          {/* In-category search bar */}
          <div className="px-5 sm:px-6 py-2.5 bg-slate-800/60 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={detailSearchKeterangan}
                onChange={(e) => setDetailSearchKeterangan(e.target.value)}
                placeholder={`Saring keterangan kategori ${selectedCategoryDetail}...`}
                className="w-full pl-8 pr-7 py-1.5 bg-slate-900/90 text-white rounded-lg text-xs placeholder:text-slate-400 outline-none border border-slate-700 focus:border-emerald-500 font-medium"
              />
              {detailSearchKeterangan && (
                <button
                  type="button"
                  onClick={() => setDetailSearchKeterangan('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  title="Kosongkan"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <span className="text-[11px] text-slate-400">
              Ditemukan <strong className="text-white">{categoryDetailTransactions.length}</strong> transaksi pada rincian kategori
            </span>
          </div>

          {/* Tabel Detail Transaksi */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200">
                  <th className="py-3 px-5 sm:px-6 w-40 whitespace-nowrap">Tanggal</th>
                  <th className="py-3 px-5 sm:px-6 w-36 whitespace-nowrap">Jenis</th>
                  <th className="py-3 px-5 sm:px-6 w-44 text-right whitespace-nowrap">Jumlah</th>
                  <th className="py-3 px-5 sm:px-6">Keterangan Lengkap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {categoryDetailTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Info className="w-5 h-5 text-slate-300" />
                        <span className="text-xs">
                          Tidak ada data transaksi untuk kategori &ldquo;{selectedCategoryDetail}&rdquo; yang sesuai filter.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  categoryDetailTransactions.map((item) => {
                    const isMasuk = item.type === 'Masuk';
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Tanggal */}
                        <td className="py-3.5 px-5 sm:px-6 font-semibold text-slate-800 whitespace-nowrap">
                          {formatTanggalIndo(item.date)}
                        </td>

                        {/* Jenis */}
                        <td className="py-3.5 px-5 sm:px-6 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              isMasuk
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isMasuk ? 'bg-emerald-600' : 'bg-rose-500'
                              }`}
                            />
                            {isMasuk ? 'Kas Masuk' : 'Kas Keluar'}
                          </span>
                        </td>

                        {/* Jumlah */}
                        <td
                          className={`py-3.5 px-5 sm:px-6 text-right font-extrabold text-sm whitespace-nowrap ${
                            isMasuk ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {isMasuk ? '+ ' : '- '}
                          {formatRupiahClean(Number(item.amount) || 0)}
                        </td>

                        {/* Keterangan Lengkap */}
                        <td className="py-3.5 px-5 sm:px-6 text-slate-700 leading-relaxed font-normal whitespace-pre-wrap break-words">
                          {item.description && item.description.trim().length > 0 ? (
                            highlightText(item.description, detailSearchKeterangan || searchKeterangan)
                          ) : (
                            <span className="text-slate-400 italic">(Tanpa keterangan)</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {categoryDetailTransactions.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 font-bold text-xs text-slate-900 border-t border-slate-200">
                    <td className="py-3 px-5 sm:px-6" colSpan={2}>
                      Total Akumulasi Periode:
                    </td>
                    <td
                      className={`py-3 px-5 sm:px-6 text-right text-sm font-black whitespace-nowrap ${
                        categoryDetailSummary.net >= 0 ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {categoryDetailSummary.net >= 0 ? '+ ' : ''}
                      {formatRupiahClean(categoryDetailSummary.net)}
                    </td>
                    <td className="py-3 px-5 sm:px-6 text-slate-500 font-medium">
                      {categoryDetailSummary.totalCount} transaksi tercatat pada kategori {selectedCategoryDetail}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Footer Bar with Close Button */}
          <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Klik baris kategori lain pada tabel ringkasan di atas untuk beralih rincian, atau klik tombol di sebelah kanan untuk menutup.
              </span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedCategoryDetail(null)}
              className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer border border-slate-200 active:scale-95 shadow-2xs self-end sm:self-auto"
            >
              <X className="w-3.5 h-3.5" />
              <span>Tutup Detail</span>
            </button>
          </div>
        </div>
      )}
        </div>
      )}

      {/* Lembar Tanda Tangan Resmi Pengurus (Hanya Tampil Saat Cetak Dokumen / PDF) */}
      <div className="hidden print:block mt-8 pt-6 border-t border-slate-300 break-inside-avoid">
        <div className="text-right text-xs text-slate-700 mb-6 font-medium">
          {sekretariat.kelurahan ? `${sekretariat.kelurahan}, ` : ''}{new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}
        </div>
        <div className="grid grid-cols-2 gap-8 text-center text-xs">
          <div>
            <p className="font-semibold text-slate-700">Mengetahui,</p>
            <p className="font-bold text-slate-900">Ketua {wilayahShort}</p>
            <div className="h-20" />
            <p className="font-bold text-slate-900 underline">( {sekretariat.nama_ketua_rt || '........................................'} )</p>
            <p className="text-[11px] text-slate-500">Pengurus Lingkungan Warga</p>
          </div>
          <div>
            <p className="font-semibold text-slate-700">Dibuat Oleh,</p>
            <p className="font-bold text-slate-900">Bendahara {wilayahShort}</p>
            <div className="h-20" />
            <p className="font-bold text-slate-900 underline">( ........................................ )</p>
            <p className="text-[11px] text-slate-500">Pengelola Keuangan Kas</p>
          </div>
        </div>
      </div>

      {/* Print / PDF Preview Modal */}
      <PrintPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        transactions={filteredTransactions}
        periodLabel={getActivePeriodLabel()}
        onTriggerToast={onTriggerToast}
      />
    </div>
  );
};
