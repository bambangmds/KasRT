import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardList, 
  Users, 
  CheckCircle, 
  XCircle, 
  Coins, 
  Search, 
  Copy, 
  Calendar, 
  CreditCard,
  Filter,
  Download,
  Phone,
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import { CategoryItem, SupabaseConnectionStatus, Transaction, UserProfile, DataWargaItem } from '../types';
import { fetchDataWargaFromSupabase, fetchKasFromSupabase, getSupabase } from '../lib/supabase';
import { formatSimpleRupiah, formatDateIndo } from '../data/initialData';
import { useSekretariat } from '../context/SekretariatContext';
import { findMatchingIuranTx, isCategoryMatchingIuran } from '../lib/iuranMatching';

interface LaporanIuranSectionProps {
  transactions?: Transaction[];
  categories?: CategoryItem[];
  connectionStatus?: SupabaseConnectionStatus;
  onTriggerToast: (msg: string, type?: 'success' | 'error' | 'info', title?: string) => void;
  onRefreshTransactions?: () => Promise<void> | void;
  activeUser?: UserProfile | null;
}

const BULAN_LIST = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const TAHUN_LIST = ['2024', '2025', '2026', '2027', '2028'];

const DEFAULT_CATEGORIES = [
  'Iuran Warga',
  'Kebersihan',
  'Iuran Wajib',
  'Iuran Perbaikan Jalan',
  'Bantuan Pembangunan Masjid',
  'Biaya keRTan',
  'Sosial',
  'Lainnya'
];

export const LaporanIuranSection: React.FC<LaporanIuranSectionProps> = ({
  transactions = [],
  categories = [],
  connectionStatus = 'connected',
  onTriggerToast,
  onRefreshTransactions,
  activeUser
}) => {
  const { wilayahShort, wilayahLabel } = useSekretariat();

  // Helper to format Indonesian phone numbers for WhatsApp API
  const formatPhoneForWa = (phone?: string): string => {
    if (!phone) return '';
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    }
    return clean;
  };

  // Filters State
  const [reportMonth, setReportMonth] = useState<string>(() => BULAN_LIST[new Date().getMonth()]);
  const [reportYear, setReportYear] = useState<string>(() => String(new Date().getFullYear()));
  const [reportCategory, setReportCategory] = useState<string>('Iuran Warga');
  const [searchWargaQuery, setSearchWargaQuery] = useState<string>('');

  // Data Warga State
  const [dataWarga, setDataWarga] = useState<DataWargaItem[]>([]);
  const [, setIsLoadingWarga] = useState<boolean>(false);
  const [localTxList, setLocalTxList] = useState<any[]>([]);

  // Helper untuk memeriksa apakah suatu kategori pemasukan bersifat Wajib
  const isCategoryWajib = (c: CategoryItem) =>
    c.type === 'Masuk' &&
    (c.wajib === true ||
      String(c.wajib) === 'Y' ||
      String(c.wajib) === 'Yes' ||
      String(c.wajib).toLowerCase() === 'true');

  // Daftar kategori pemasukan yang bersifat Wajib saja (khusus Kepatuhan Iuran)
  const wajibCategories = useMemo(() => {
    if (categories && categories.length > 0) {
      return categories.filter(isCategoryWajib).map((c) => c.name);
    }
    return [];
  }, [categories]);

  // Sinkronkan reportCategory agar selalu merujuk ke kategori Wajib (atau 'Semua Kategori' jika ada >1 kategori wajib)
  useEffect(() => {
    if (wajibCategories.length === 0) return;
    if (
      (wajibCategories.length === 1 && reportCategory === 'Semua Kategori') ||
      (reportCategory !== 'Semua Kategori' && !wajibCategories.includes(reportCategory))
    ) {
      setReportCategory(wajibCategories[0]);
    }
  }, [wajibCategories, reportCategory]);

  // Load Data Warga & Transactions
  const loadData = async () => {
    setIsLoadingWarga(true);
    try {
      const warga = await fetchDataWargaFromSupabase();
      if (warga && warga.length > 0) {
        setDataWarga(warga);
      } else {
        const savedWarga = localStorage.getItem('kas_rt_data_warga');
        if (savedWarga) {
          try {
            const parsed = JSON.parse(savedWarga);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setDataWarga(parsed);
            }
          } catch {}
        }
      }

      // Also get full transactions from Supabase or props
      const client = getSupabase();
      if (client) {
        const { data: kasData } = await client
          .from('kas_rt')
          .select('*')
          .eq('jenis', 'Masuk')
          .order('tanggal', { ascending: false });
        if (kasData) {
          setLocalTxList(kasData);
        }
      }
    } catch (err) {
      console.warn('[LaporanIuranSection loadData]', err);
    } finally {
      setIsLoadingWarga(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [connectionStatus]);

  // Compute Active Transactions (combining prop transactions + localTxList)
  const allKasMasuk = useMemo(() => {
    const list: any[] = [];
    const seenIds = new Set<string>();

    if (Array.isArray(localTxList)) {
      localTxList.forEach((t) => {
        if (t && t.id) {
          seenIds.add(String(t.id));
          list.push(t);
        }
      });
    }

    if (Array.isArray(transactions)) {
      transactions.forEach((t) => {
        if (t && t.type === 'Masuk' && !seenIds.has(String(t.id))) {
          seenIds.add(String(t.id));
          list.push({
            id: t.id,
            tanggal: t.date,
            jenis: t.type,
            kategori: t.category,
            jumlah: t.amount,
            keterangan: t.description,
            warga_id: t.wargaId,
          });
        }
      });
    }

    return list;
  }, [localTxList, transactions]);

  // Filter transaksi Kas Masuk hanya yang termasuk Kategori Wajib
  const wajibKasMasuk = useMemo(() => {
    if (wajibCategories.length === 0) return [];
    return allKasMasuk.filter((tx) =>
      wajibCategories.some((wajibCat) => isCategoryMatchingIuran(tx?.kategori, wajibCat))
    );
  }, [allKasMasuk, wajibCategories]);

  // Hitung data kepatuhan iuran berdasarkan bulan, tahun, dan KATEGORI WAJIB
  // Menggunakan Single Source of Truth (findMatchingIuranTx) agar 100% sinkron dengan Setoran Iuran Warga
  const laporanKepatuhan = useMemo(() => {
    if (!dataWarga || dataWarga.length === 0 || wajibCategories.length === 0) {
      return { sudahBayar: [], belumBayar: [] };
    }

    const targetWajibCategories =
      reportCategory === 'Semua Kategori'
        ? wajibCategories
        : wajibCategories.includes(reportCategory)
          ? [reportCategory]
          : [];

    if (targetWajibCategories.length === 0) {
      return { sudahBayar: [], belumBayar: [] };
    }

    const sudahBayar: any[] = [];
    const belumBayar: any[] = [];

    dataWarga.forEach((warga) => {
      const matchedEntries: Array<{ category: string; tx: any }> = [];
      const unpaidCategories: string[] = [];

      targetWajibCategories.forEach((catName) => {
        const tx = findMatchingIuranTx(
          warga,
          wajibKasMasuk,
          catName,
          reportMonth,
          reportYear
        );
        if (tx) {
          matchedEntries.push({ category: catName, tx });
        } else {
          unpaidCategories.push(catName);
        }
      });

      if (unpaidCategories.length === 0 && matchedEntries.length > 0) {
        // Dedup transaksi jika perlu agar nominal tidak terhitung ganda
        const uniqueTxMap = new Map<string, any>();
        matchedEntries.forEach(({ tx }, idx) => {
          const key = tx?.id ? String(tx.id) : `tx-${idx}`;
          if (!uniqueTxMap.has(key)) {
            uniqueTxMap.set(key, tx);
          }
        });
        const uniqueTxs = Array.from(uniqueTxMap.values());
        const totalPaid = uniqueTxs.reduce(
          (sum, t) => sum + (Number(t.jumlah) || 0),
          0
        );
        const latestDate = uniqueTxs
          .map((t) => String(t.tanggal || ''))
          .filter(Boolean)
          .sort()
          .pop() || '';
        const paidCatLabels = Array.from(
          new Set(matchedEntries.map((m) => m.tx?.kategori || m.category).filter(Boolean))
        ).join(', ');

        sudahBayar.push({
          ...warga,
          paymentDate: latestDate,
          paymentAmount: totalPaid,
          paymentCategory: paidCatLabels,
          paymentDescription: uniqueTxs[0]?.keterangan || '',
          txId: uniqueTxs[0]?.id,
        });
      } else {
        belumBayar.push({
          ...warga,
          unpaidCategories,
          paidCategories: matchedEntries.map((m) => m.category),
        });
      }
    });

    return { sudahBayar, belumBayar };
  }, [dataWarga, wajibKasMasuk, wajibCategories, reportMonth, reportYear, reportCategory]);

  // Filtered by search query
  const filteredSudahBayar = useMemo(() => {
    if (!searchWargaQuery.trim()) return laporanKepatuhan.sudahBayar;
    const q = searchWargaQuery.toLowerCase().trim();
    return laporanKepatuhan.sudahBayar.filter((w: any) =>
      (w.nama_lengkap || '').toLowerCase().includes(q) ||
      (w.no_kk || '').includes(q) ||
      (w.nik || '').includes(q)
    );
  }, [laporanKepatuhan.sudahBayar, searchWargaQuery]);

  const filteredBelumBayar = useMemo(() => {
    if (!searchWargaQuery.trim()) return laporanKepatuhan.belumBayar;
    const q = searchWargaQuery.toLowerCase().trim();
    return laporanKepatuhan.belumBayar.filter((w: any) =>
      (w.nama_lengkap || '').toLowerCase().includes(q) ||
      (w.no_kk || '').includes(q) ||
      (w.nik || '').includes(q)
    );
  }, [laporanKepatuhan.belumBayar, searchWargaQuery]);

  const totalDanaTerkumpul = useMemo(() => {
    return laporanKepatuhan.sudahBayar.reduce((sum: number, item: any) => sum + (item.paymentAmount || 0), 0);
  }, [laporanKepatuhan.sudahBayar]);

  const kepatuhanPercent = dataWarga.length > 0 
    ? Math.round((laporanKepatuhan.sudahBayar.length / dataWarga.length) * 100) 
    : 0;

  const handleCopySudahBayar = () => {
    if (laporanKepatuhan.sudahBayar.length === 0) {
      onTriggerToast('Tidak ada data warga sudah bayar untuk disalin.', 'info', 'Info Kosong');
      return;
    }
    const text = laporanKepatuhan.sudahBayar.map((w: any, idx: number) => 
      `${idx + 1}. ${w.nama_lengkap} - Lunas ${w.paymentCategory} (${reportMonth} ${reportYear}) - ${formatSimpleRupiah(w.paymentAmount)}`
    ).join('\n');
    
    navigator.clipboard.writeText(text);
    onTriggerToast('Daftar warga yang sudah bayar berhasil disalin ke clipboard!', 'success', 'Berhasil Menyalin');
  };

  const handleCopyBelumBayar = () => {
    if (laporanKepatuhan.belumBayar.length === 0) {
      onTriggerToast('Seluruh warga sudah lunas!', 'success', 'Kepatuhan 100%');
      return;
    }
    const categoryLabel =
      reportCategory === 'Semua Kategori'
        ? `Kategori Wajib (${wajibCategories.join(', ')})`
        : reportCategory;
    const text = `Daftar Tunggakan Iuran ${categoryLabel} (${reportMonth} ${reportYear}):\n` +
      laporanKepatuhan.belumBayar.map((w: any, idx: number) => {
        const unpaidDetail =
          reportCategory === 'Semua Kategori' && Array.isArray(w.unpaidCategories) && w.unpaidCategories.length > 0
            ? ` [Belum: ${w.unpaidCategories.join(', ')}]`
            : '';
        return `${idx + 1}. ${w.nama_lengkap} (KK: ${w.no_kk || '-'}) - Domisili: ${w.alamat_domisili || wilayahShort}${unpaidDetail}`;
      }).join('\n');
    
    navigator.clipboard.writeText(text);
    onTriggerToast('Daftar warga yang belum bayar berhasil disalin ke clipboard!', 'success', 'Berhasil Menyalin');
  };

  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
      {/* Header Banner - Clean Gray Surface */}
      <div className="bg-slate-200/90 p-3.5 sm:p-4 rounded-2xl shadow-sm border border-slate-300 flex items-center gap-3.5">
        <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-blue-600 text-white rounded-xl shadow-sm shadow-indigo-600/20 shrink-0">
          <ClipboardList className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">Laporan Kepatuhan & Rekap Iuran Warga</h3>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            Tinjau status kepatuhan setoran iuran per bulan, kelompok lunas, dan daftar tunggakan warga {wilayahShort}.
          </p>
        </div>
      </div>

      {/* Filter Card - Compact Modern Executive Dark Navy Tinted Frame */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl shadow-md border border-indigo-900/70 text-white">
        <div className="flex flex-col lg:flex-row gap-2.5 items-start lg:items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600/40 text-indigo-200 border border-indigo-500/30 rounded-lg shadow-xs">
              <Filter className="w-3.5 h-3.5 text-indigo-300" />
            </div>
            <div>
              <span className="text-xs font-bold text-white uppercase tracking-wider block leading-tight">Filter Periode & Kategori</span>
              <span className="text-[10px] text-indigo-200/80 font-medium leading-tight">Penyaringan data kepatuhan iuran warga</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full lg:w-auto">
            {/* Month Dropdown */}
            <div className="space-y-0.5">
              <label className="text-[9.5px] font-bold text-indigo-200 block uppercase tracking-wider">Bulan Tagihan</label>
              <select
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value)}
                className="w-full sm:w-36 px-2.5 py-1.5 text-xs bg-slate-800 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none font-semibold cursor-pointer shadow-inner"
              >
                {BULAN_LIST.map(b => (
                  <option key={b} value={b} className="bg-slate-800 text-white">{b}</option>
                ))}
              </select>
            </div>

            {/* Year Dropdown */}
            <div className="space-y-0.5">
              <label className="text-[9.5px] font-bold text-indigo-200 block uppercase tracking-wider">Tahun</label>
              <select
                value={reportYear}
                onChange={(e) => setReportYear(e.target.value)}
                className="w-full sm:w-28 px-2.5 py-1.5 text-xs bg-slate-800 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none font-semibold cursor-pointer shadow-inner"
              >
                {TAHUN_LIST.map(y => (
                  <option key={y} value={y} className="bg-slate-800 text-white">{y}</option>
                ))}
              </select>
            </div>

            {/* Category Dropdown - Khusus Kategori Wajib */}
            <div className="space-y-0.5">
              <label className="text-[9.5px] font-bold text-indigo-200 block uppercase tracking-wider">Pos Kategori Wajib</label>
              <select
                value={wajibCategories.length === 0 ? '' : reportCategory}
                onChange={(e) => setReportCategory(e.target.value)}
                disabled={wajibCategories.length === 0}
                className="w-full sm:w-52 px-2.5 py-1.5 text-xs bg-slate-800 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none font-semibold cursor-pointer shadow-inner disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {wajibCategories.length === 0 ? (
                  <option value="" className="bg-slate-800 text-slate-300">Belum ada kategori wajib</option>
                ) : (
                  <>
                    {wajibCategories.length > 1 && (
                      <option value="Semua Kategori" className="bg-slate-800 text-white">Semua Kategori Wajib ({wajibCategories.length})</option>
                    )}
                    {wajibCategories.map(cat => (
                      <option key={cat} value={cat} className="bg-slate-800 text-white">{cat} (Wajib)</option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Quick Search bar */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-800 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchWargaQuery}
              onChange={(e) => setSearchWargaQuery(e.target.value)}
              placeholder="Cari nama warga, NIK, atau No. KK pada laporan ini..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-800 text-white placeholder-slate-400 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all outline-none font-medium"
            />
          </div>
          {searchWargaQuery && (
            <button
              type="button"
              onClick={() => setSearchWargaQuery('')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 cursor-pointer transition-colors shadow-2xs"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Metric Dashboard Cards - Masing-masing Frame Berwarna Khas Berbeda */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Warga Terdata - Royal Indigo Theme */}
        <div className="bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 p-4 sm:p-4.5 rounded-2xl border border-indigo-700/80 shadow-md text-white flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-indigo-200 uppercase tracking-wider block">Total Warga Terdata</span>
            <span className="text-xl sm:text-2xl font-black text-white mt-0.5 block">{dataWarga.length} KK</span>
            <span className="text-[10px] text-indigo-300 font-medium">Buku Data Warga {wilayahShort}</span>
          </div>
          <div className="p-3 bg-indigo-600/40 text-indigo-100 border border-indigo-400/30 rounded-xl shadow-xs shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2: Sudah Lunas - Emerald Green Theme */}
        <div className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 p-4 sm:p-4.5 rounded-2xl border border-emerald-700/80 shadow-md text-white flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-xs font-bold block uppercase tracking-wider text-emerald-200">Sudah Lunas</span>
            <span className="text-xl sm:text-2xl font-black text-white mt-0.5 block">
              {laporanKepatuhan.sudahBayar.length} KK
              <span className="text-xs font-black text-emerald-950 bg-emerald-300 px-2 py-0.5 rounded-md ml-2 inline-block shadow-2xs">
                {kepatuhanPercent}%
              </span>
            </span>
            <span className="text-[10px] text-emerald-300 font-medium">Bulan {reportMonth} {reportYear}</span>
          </div>
          <div className="p-3 bg-emerald-600/40 text-emerald-100 border border-emerald-400/30 rounded-xl shadow-xs shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3: Belum Bayar (Tunggakan) - Crimson Rose Theme */}
        <div className="bg-gradient-to-br from-rose-950 via-rose-900 to-slate-900 p-4 sm:p-4.5 rounded-2xl border border-rose-700/80 shadow-md text-white flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-xs font-bold block uppercase tracking-wider text-rose-200">Belum Bayar (Tunggakan)</span>
            <span className="text-xl sm:text-2xl font-black text-white mt-0.5 block">
              {laporanKepatuhan.belumBayar.length} KK
              <span className="text-xs font-black text-rose-950 bg-rose-300 px-2 py-0.5 rounded-md ml-2 inline-block shadow-2xs">
                {dataWarga.length > 0 ? 100 - kepatuhanPercent : 0}%
              </span>
            </span>
            <span className="text-[10px] text-rose-300 font-medium">Perlu Dikonfirmasi</span>
          </div>
          <div className="p-3 bg-rose-600/40 text-rose-100 border border-rose-400/30 rounded-xl shadow-xs shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4: Dana Iuran Terkumpul - Amber Golden Theme */}
        <div className="bg-gradient-to-br from-amber-950 via-amber-900 to-slate-900 p-4 sm:p-4.5 rounded-2xl border border-amber-700/80 shadow-md text-white flex items-center justify-between">
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-amber-200 block uppercase tracking-wider">Dana Iuran Terkumpul</span>
            <span className="text-xl sm:text-2xl font-black text-amber-300 mt-0.5 block">
              {formatSimpleRupiah(totalDanaTerkumpul)}
            </span>
            <span className="text-[10px] text-amber-200/90 font-medium">
              Pos: {wajibCategories.length === 0 ? 'Belum ada kategori wajib' : reportCategory === 'Semua Kategori' ? 'Semua Kategori Wajib' : reportCategory}
            </span>
          </div>
          <div className="p-3 bg-amber-600/40 text-amber-100 border border-amber-400/30 rounded-xl shadow-xs shrink-0">
            <Coins className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Dues Report Groups Grid - Modern Dark Jewel-Toned Obsidian Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Sudah Bayar (Lunas) - Deep Emerald-Teal & Gold Accent */}
        <div className="bg-neutral-950 rounded-2xl shadow-lg shadow-emerald-950/20 border border-emerald-500/40 overflow-hidden flex flex-col min-h-[400px]">
          <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-950 p-4 text-white border-b border-emerald-500/35 flex items-center justify-between gap-2">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-400/15 rounded-full blur-2xl pointer-events-none" />
            <div className="relative flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/35 flex items-center justify-center shadow-inner shrink-0">
                <CheckCircle className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-white tracking-tight">
                  Kelompok Sudah Bayar (Lunas)
                </h4>
                <p className="text-[11px] text-emerald-300/90 font-medium mt-0.5 tabular-nums">
                  Total: <strong className="text-white">{filteredSudahBayar.length} warga</strong> · {reportMonth} {reportYear}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopySudahBayar}
              className="relative flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0 active:scale-98"
              title="Salin Daftar Warga yang Sudah Bayar"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Salin Info</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[460px] p-2 space-y-1 bg-neutral-950 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-zinc-900 [&::-webkit-scrollbar-thumb]:bg-emerald-500/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-emerald-400/80 [scrollbar-color:#10b981_#18181b] [scrollbar-width:thin]">
            {filteredSudahBayar.length > 0 ? (
              filteredSudahBayar.map((w: any, idx: number) => (
                <div
                  key={w.id}
                  className="group px-2.5 py-1.5 flex items-center justify-between gap-2.5 rounded-lg odd:bg-zinc-950/90 even:bg-emerald-950/25 hover:bg-emerald-950/55 border border-zinc-800/80 hover:border-emerald-500/40 transition-all duration-150"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap leading-tight">
                      <span className="text-[11px] font-mono font-bold text-emerald-400 tabular-nums">
                        {String(idx + 1).padStart(2, '0')}.
                      </span>
                      <span className="text-xs font-bold text-white truncate">
                        {w.nama_lengkap}
                      </span>
                      <span className="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-400/35 shrink-0">
                        Lunas
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-300 mt-1 flex items-center gap-1.5 flex-wrap leading-tight">
                      <span className="font-semibold text-teal-200 bg-teal-500/15 px-1.5 py-0.5 rounded text-[9.5px] border border-teal-400/30">
                        {w.paymentCategory}
                      </span>
                      <span className="text-zinc-400 font-mono text-[10px]">
                        Tgl Setor: <span className="text-zinc-200">{formatDateIndo(w.paymentDate)}</span>
                      </span>
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap shrink-0">
                    <span className="inline-block text-xs font-extrabold font-mono tabular-nums text-amber-300 bg-amber-500/10 border border-amber-400/25 px-2 py-0.5 rounded-md">
                      {formatSimpleRupiah(w.paymentAmount)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-zinc-400 flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center mb-3">
                  <CheckCircle className="w-6 h-6 text-emerald-400/70" />
                </div>
                <p className="text-xs font-bold text-zinc-100">
                  {wajibCategories.length === 0
                    ? 'Belum Ada Kategori Bersifat Wajib'
                    : 'Belum Ada Setoran Masuk'}
                </p>
                <p className="text-[11px] text-zinc-400 max-w-xs mt-1 leading-relaxed">
                  {wajibCategories.length === 0
                    ? 'Tandai minimal satu kategori pemasukan sebagai Wajib di menu Kelola Kategori agar pengelompokan kepatuhan aktif.'
                    : `Belum ditemukan data penerimaan iuran wajib untuk bulan ${reportMonth} ${reportYear} pada pos ${reportCategory === 'Semua Kategori' ? 'Semua Kategori Wajib' : reportCategory}.`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Belum Bayar (Tunggakan) - Deep Crimson-Rose & Warm Amber Accent */}
        <div className="bg-neutral-950 rounded-2xl shadow-lg shadow-rose-950/20 border border-rose-500/40 overflow-hidden flex flex-col min-h-[400px]">
          <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-rose-950 to-amber-950/85 p-4 text-white border-b border-rose-500/35 flex items-center justify-between gap-2">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-rose-400/15 rounded-full blur-2xl pointer-events-none" />
            <div className="relative flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-400/35 flex items-center justify-center shadow-inner shrink-0">
                <XCircle className="w-5 h-5 text-rose-300" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-white tracking-tight">
                  Kelompok Belum Bayar (Tunggakan)
                </h4>
                <p className="text-[11px] text-rose-200/90 font-medium mt-0.5 tabular-nums">
                  Total: <strong className="text-white">{filteredBelumBayar.length} warga</strong> · {reportMonth} {reportYear}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyBelumBayar}
              className="relative flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0 active:scale-98"
              title="Salin Daftar Warga yang Belum Bayar"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Salin Tunggakan</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[460px] p-2 space-y-1 bg-neutral-950 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-zinc-900 [&::-webkit-scrollbar-thumb]:bg-rose-500/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-rose-400/80 [scrollbar-color:#f43f5e_#18181b] [scrollbar-width:thin]">
            {filteredBelumBayar.length > 0 ? (
              filteredBelumBayar.map((w: any, idx: number) => (
                <div
                  key={w.id}
                  className="group px-2.5 py-1.5 flex items-center justify-between gap-2.5 rounded-lg odd:bg-zinc-950/90 even:bg-rose-950/20 hover:bg-rose-950/45 border border-zinc-800/80 hover:border-rose-500/40 transition-all duration-150"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap leading-tight">
                      <span className="text-[11px] font-mono font-bold text-rose-400 tabular-nums">
                        {String(idx + 1).padStart(2, '0')}.
                      </span>
                      <span className="text-xs font-bold text-white truncate">
                        {w.nama_lengkap}
                      </span>
                      <span className="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-400/35 shrink-0">
                        Belum Bayar
                      </span>
                    </div>
                    {reportCategory === 'Semua Kategori' &&
                      Array.isArray(w.unpaidCategories) &&
                      w.unpaidCategories.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          <span className="text-[9.5px] font-semibold text-amber-300">Belum lunas:</span>
                          {w.unpaidCategories.map((catName: string) => (
                            <span
                              key={catName}
                              className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-200 border border-amber-400/35"
                            >
                              {catName}
                            </span>
                          ))}
                        </div>
                      )}
                  </div>

                  {w.no_hp && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="text-[10.5px] font-mono text-zinc-200 font-medium flex items-center gap-1 bg-zinc-900 px-2 py-1 rounded-md border border-zinc-700/80">
                        <Phone className="w-3 h-3 text-amber-400" />
                        <span>{w.no_hp}</span>
                      </div>
                      <a
                        href={`https://api.whatsapp.com/send?phone=${formatPhoneForWa(w.no_hp)}&text=${encodeURIComponent(
                          `Halo Bpk/Ibu *${w.nama_lengkap}*,\n\nKami dari Pengurus *RT.002 RW.09, Kelurahan Pondok Rajeg* ingin menginfokan mengenai status iuran berkala warga.\n\nTercatat untuk iuran wajib *${
                            Array.isArray(w.unpaidCategories) && w.unpaidCategories.length > 0
                              ? w.unpaidCategories.join(', ')
                              : reportCategory
                          }* periode *${reportMonth} ${reportYear}* belum lunas.\n\nMohon dapat melakukan pembayaran di pos keuangan RT atau melalui Bendahara RT. Terima kasih banyak atas partisipasi aktif Anda selaku warga.\n\n*Salam hangat,*\n*Pengurus RT.002 RW.09*`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded-md bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-sm transition-all flex items-center justify-center cursor-pointer active:scale-95"
                        title="Kirim pengingat iuran sopan via WhatsApp"
                      >
                        <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.436 0 9.851-4.38 9.854-9.762.001-2.607-1.012-5.059-2.853-6.902C16.392 2.096 13.946 1.08 11.336 1.08c-5.44 0-9.857 4.379-9.86 9.762-.001 1.902.5 3.744 1.447 5.354L1.874 22.1l6.104-1.601c1.533.835 3.1 1.255 4.669 1.255zm11.302-7.14c-.302-.152-1.791-.883-2.073-.984-.282-.102-.487-.152-.69.152-.204.304-.79.984-.968 1.186-.179.203-.357.228-.659.076-.302-.152-1.274-.469-2.427-1.496-.897-.8-1.502-1.787-1.679-2.09-.178-.303-.019-.467.132-.618.136-.135.302-.354.453-.532.152-.178.203-.304.304-.507.102-.203.051-.38-.025-.532-.076-.152-.69-1.66-.945-2.272-.248-.598-.5-.516-.69-.526-.178-.01-.383-.01-.587-.01-.204 0-.538.076-.82.38-.282.304-1.077 1.052-1.077 2.563 0 1.511 1.096 2.969 1.248 3.172.152.203 2.158 3.297 5.228 4.618.729.314 1.3.502 1.745.643.733.232 1.399.2 1.925.122.587-.087 1.791-.733 2.046-1.439.255-.705.255-1.312.179-1.439-.076-.127-.282-.203-.585-.355z"/>
                        </svg>
                      </a>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-zinc-400 flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-950/60 border border-emerald-500/35 flex items-center justify-center mb-3">
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                </div>
                <p className={`text-xs font-bold ${
                  wajibCategories.length === 0 ? 'text-zinc-200' : 'text-emerald-300'
                }`}>
                  {wajibCategories.length === 0
                    ? 'Belum Ada Kategori Bersifat Wajib'
                    : 'Kepatuhan 100% Lunas!'}
                </p>
                <p className="text-[11px] text-zinc-400 max-w-xs mt-1 leading-relaxed">
                  {wajibCategories.length === 0
                    ? 'Aktifkan status Wajib pada kategori iuran di menu Kelola Kategori untuk mulai memantau tunggakan warga.'
                    : `Seluruh warga terdaftar telah lunas membayar iuran wajib ${reportCategory === 'Semua Kategori' ? `(${wajibCategories.join(', ')})` : reportCategory} untuk bulan ${reportMonth} ${reportYear}!`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
