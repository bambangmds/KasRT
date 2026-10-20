import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardList, 
  Users, 
  CheckCircle, 
  XCircle, 
  Coins, 
  Search, 
  Copy, 
  RefreshCw, 
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
  const [isLoadingWarga, setIsLoadingWarga] = useState<boolean>(false);
  const [localTxList, setLocalTxList] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Available categories for filter
  const availableCategories = useMemo(() => {
    const list = categories.filter(c => c.type === 'Masuk').map(c => c.name);
    return list.length > 0 ? list : DEFAULT_CATEGORIES;
  }, [categories]);

  // Load Data Warga & Transactions
  const loadData = async () => {
    setIsLoadingWarga(true);
    try {
      const warga = await fetchDataWargaFromSupabase();
      if (warga) {
        setDataWarga(warga);
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    if (onRefreshTransactions) {
      await onRefreshTransactions();
    }
    setIsRefreshing(false);
    onTriggerToast('Data laporan kepatuhan iuran berhasil disegarkan.', 'success');
  };

  // Compute Active Transactions (combining prop transactions + localTxList)
  const allKasMasuk = useMemo(() => {
    if (localTxList.length > 0) return localTxList;
    return transactions.filter(t => t.type === 'Masuk').map(t => ({
      id: t.id,
      tanggal: t.date,
      jenis: t.type,
      kategori: t.category,
      jumlah: t.amount,
      keterangan: t.description,
      warga_id: t.wargaId,
    }));
  }, [localTxList, transactions]);

  // Clean person name helper
  const cleanPersonName = (str?: string) =>
    (str || '')
      .toLowerCase()
      .replace(/^(bpk\.?|bapak\.?|ibu\.?|ibuk\.?|pak\.?|h\.?|hj\.?|sdr\.?|sdri\.?)\s+/i, '')
      .trim();

  // Hitung data kepatuhan iuran berdasarkan bulan, tahun, dan kategori terpilih
  const laporanKepatuhan = useMemo(() => {
    if (!dataWarga || dataWarga.length === 0) {
      return { sudahBayar: [], belumBayar: [] };
    }

    if (reportCategory === 'Saldo Pindahan' || reportCategory === 'Saldo Awal') {
      return { sudahBayar: [], belumBayar: [] };
    }

    const sudahBayar: any[] = [];
    const belumBayar: any[] = [];

    dataWarga.forEach(warga => {
      const cleanW = cleanPersonName(warga.nama_lengkap);

      // Cari apakah ada transaksi iuran yang cocok
      const matchingTx = allKasMasuk.find(tx => {
        if (tx.kategori === 'Saldo Pindahan' || tx.kategori === 'Saldo Awal') {
          return false;
        }

        const desc = (tx.keterangan || '').toLowerCase();
        let isWargaMatch = false;

        if (tx.warga_id && tx.warga_id === warga.id) {
          isWargaMatch = true;
        } else if (cleanW && cleanW.length >= 3 && desc.includes(cleanW)) {
          isWargaMatch = true;
        } else if (warga.nik && warga.nik.length >= 6 && warga.nik !== '-' && desc.includes(warga.nik)) {
          isWargaMatch = true;
        } else if (warga.no_kk && warga.no_kk.length >= 6 && warga.no_kk !== '-' && desc.includes(warga.no_kk)) {
          isWargaMatch = true;
        }

        if (!isWargaMatch) return false;

        // Cek Kategori
        if (reportCategory !== 'Semua Kategori' && tx.kategori !== reportCategory) {
          return false;
        }

        // Cek Bulan & Tahun: prioritas dari keterangan "Bulan <Nama>", fallback dari tanggal
        const monthMatch = desc.match(/bulan\s+([a-z]+|\d{1,2})/i);
        const yearMatch = desc.match(/(202\d|203\d)/);

        let txMonthName = '';
        let txYear = tx.tanggal ? tx.tanggal.split('-')[0] : '';

        if (monthMatch && monthMatch[1]) {
          const rawM = monthMatch[1].toLowerCase();
          const foundIdx = BULAN_LIST.findIndex(b => b.toLowerCase() === rawM);
          if (foundIdx >= 0) {
            txMonthName = BULAN_LIST[foundIdx];
          } else {
            const numM = parseInt(rawM, 10);
            if (!isNaN(numM) && numM >= 1 && numM <= 12) {
              txMonthName = BULAN_LIST[numM - 1];
            }
          }
        } else if (tx.tanggal && tx.tanggal.includes('-')) {
          const parts = tx.tanggal.split('-');
          if (parts.length >= 2) {
            const mIdx = parseInt(parts[1], 10) - 1;
            if (mIdx >= 0 && mIdx < 12) {
              txMonthName = BULAN_LIST[mIdx];
            }
          }
        }

        if (yearMatch && yearMatch[1]) {
          txYear = yearMatch[1];
        }

        return txMonthName.toLowerCase() === reportMonth.toLowerCase() && txYear === reportYear;
      });

      if (matchingTx) {
        sudahBayar.push({
          ...warga,
          paymentDate: matchingTx.tanggal,
          paymentAmount: matchingTx.jumlah,
          paymentCategory: matchingTx.kategori,
          paymentDescription: matchingTx.keterangan,
          txId: matchingTx.id
        });
      } else {
        belumBayar.push(warga);
      }
    });

    return { sudahBayar, belumBayar };
  }, [dataWarga, allKasMasuk, reportMonth, reportYear, reportCategory]);

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
    const text = `Daftar Tunggakan Iuran ${reportCategory} (${reportMonth} ${reportYear}):\n` +
      laporanKepatuhan.belumBayar.map((w: any, idx: number) => 
        `${idx + 1}. ${w.nama_lengkap} (KK: ${w.no_kk || '-'}) - Domisili: ${w.alamat_domisili || wilayahShort}`
      ).join('\n');
    
    navigator.clipboard.writeText(text);
    onTriggerToast('Daftar warga yang belum bayar berhasil disalin ke clipboard!', 'success', 'Berhasil Menyalin');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-indigo-600 to-blue-600 text-white rounded-xl shadow-sm shadow-indigo-600/20">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Laporan Kepatuhan & Rekap Iuran Warga</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Tinjau status kepatuhan setoran iuran per bulan, kelompok lunas, dan daftar tunggakan warga {wilayahShort}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoadingWarga}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title="Segarkan Data Laporan Iuran"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isLoadingWarga ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Filter Card */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Filter Periode & Kategori</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
            {/* Month Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 block uppercase">Bulan Tagihan</label>
              <select
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value)}
                className="w-full sm:w-36 p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium cursor-pointer"
              >
                {BULAN_LIST.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Year Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 block uppercase">Tahun</label>
              <select
                value={reportYear}
                onChange={(e) => setReportYear(e.target.value)}
                className="w-full sm:w-28 p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium cursor-pointer"
              >
                {TAHUN_LIST.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Category Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 block uppercase">Pos Kategori Iuran</label>
              <select
                value={reportCategory}
                onChange={(e) => setReportCategory(e.target.value)}
                className="w-full sm:w-48 p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium cursor-pointer"
              >
                <option value="Semua Kategori">Semua Kategori Iuran</option>
                {availableCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Quick Search bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchWargaQuery}
              onChange={(e) => setSearchWargaQuery(e.target.value)}
              placeholder="Cari nama warga, NIK, atau No. KK pada laporan ini..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
            />
          </div>
          {searchWargaQuery && (
            <button
              type="button"
              onClick={() => setSearchWargaQuery('')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Metric Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Warga */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider font-semibold">Total Warga Terdata</span>
            <span className="text-xl font-black text-slate-800 mt-0.5 block">{dataWarga.length} KK</span>
            <span className="text-[10px] text-slate-500 font-medium">Buku Data Warga {wilayahShort}</span>
          </div>
          <div className="p-3 bg-slate-50 text-slate-500 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2: Sudah Bayar */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/30 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold block uppercase tracking-wider text-emerald-700">Sudah Lunas</span>
            <span className="text-xl font-black text-emerald-700 mt-0.5 block">
              {laporanKepatuhan.sudahBayar.length} KK
              <span className="text-xs font-bold text-emerald-600 bg-emerald-100/70 px-1.5 py-0.5 rounded-md ml-2 inline-block">
                {kepatuhanPercent}%
              </span>
            </span>
            <span className="text-[10px] text-emerald-600 font-medium">Bulan {reportMonth} {reportYear}</span>
          </div>
          <div className="p-3 bg-emerald-100/80 text-emerald-700 rounded-xl">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3: Belum Bayar */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-rose-200/80 bg-gradient-to-br from-white to-rose-50/30 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold block uppercase tracking-wider text-rose-700">Belum Bayar (Tunggakan)</span>
            <span className="text-xl font-black text-rose-700 mt-0.5 block">
              {laporanKepatuhan.belumBayar.length} KK
              <span className="text-xs font-bold text-rose-600 bg-rose-100/70 px-1.5 py-0.5 rounded-md ml-2 inline-block">
                {dataWarga.length > 0 ? 100 - kepatuhanPercent : 0}%
              </span>
            </span>
            <span className="text-[10px] text-rose-600 font-medium">Perlu Dikonfirmasi</span>
          </div>
          <div className="p-3 bg-rose-100/80 text-rose-700 rounded-xl">
            <XCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4: Dana Terkumpul */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-indigo-200/80 bg-gradient-to-br from-white to-indigo-50/30 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-indigo-700 block uppercase tracking-wider">Dana Iuran Terkumpul</span>
            <span className="text-xl font-black text-indigo-900 mt-0.5 block">
              {formatSimpleRupiah(totalDanaTerkumpul)}
            </span>
            <span className="text-[10px] text-indigo-600 font-medium">Pos: {reportCategory}</span>
          </div>
          <div className="p-3 bg-indigo-100/80 text-indigo-700 rounded-xl">
            <Coins className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Dues Report Groups Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Sudah Bayar (Lunas) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
          <div className="bg-emerald-600 p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-700/80 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-white">Kelompok Sudah Bayar (Lunas)</h4>
                <p className="text-[10px] text-emerald-100 font-medium">
                  Total: {filteredSudahBayar.length} warga ({reportMonth} {reportYear})
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopySudahBayar}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              title="Salin Daftar Warga yang Sudah Bayar"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Salin Info</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[450px] p-4 divide-y divide-slate-100">
            {filteredSudahBayar.length > 0 ? (
              filteredSudahBayar.map((w: any, idx: number) => (
                <div key={w.id} className="py-3 flex items-start justify-between gap-3 hover:bg-slate-50/60 px-2.5 rounded-xl transition-colors">
                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">{idx + 1}. {w.nama_lengkap}</span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Lunas
                      </span>
                    </div>
                    <div className="text-[10.5px] text-slate-400 font-mono mt-0.5">
                      KK: {w.no_kk || '-'} • NIK: {w.nik || '-'}
                    </div>
                    <div className="text-[10.5px] text-slate-500 mt-1 flex items-center gap-1.5">
                      <span className="font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[9.5px] border border-indigo-100">{w.paymentCategory}</span>
                      <span>Tgl Setor: {formatDateIndo(w.paymentDate)}</span>
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap shrink-0">
                    <span className="text-xs font-black text-emerald-700 block">{formatSimpleRupiah(w.paymentAmount)}</span>
                    <span className="text-[9px] text-slate-400 font-mono block mt-1">ID: {w.txId ? w.txId.substring(0, 8) : 'TRX'}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
                <CheckCircle className="w-12 h-12 text-slate-200 mb-2" />
                <p className="text-xs font-bold text-slate-600">
                  {reportCategory === 'Saldo Pindahan' || reportCategory === 'Saldo Awal' 
                    ? 'Kategori Saldo Awal' 
                    : 'Belum Ada Setoran Masuk'}
                </p>
                <p className="text-[11px] text-slate-400 max-w-xs mt-1 leading-relaxed">
                  {reportCategory === 'Saldo Pindahan' || reportCategory === 'Saldo Awal'
                    ? 'Saldo Pindahan merupakan saldo awal pembukuan kas RT.'
                    : `Belum ditemukan data penerimaan iuran untuk bulan ${reportMonth} ${reportYear} pada kategori ${reportCategory}.`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Belum Bayar (Tunggakan) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
          <div className="bg-rose-600 p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-700/80 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-white">Kelompok Belum Bayar (Tunggakan)</h4>
                <p className="text-[10px] text-rose-100 font-medium">
                  Total: {filteredBelumBayar.length} warga ({reportMonth} {reportYear})
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyBelumBayar}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              title="Salin Daftar Warga yang Belum Bayar"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Salin Tunggakan</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[450px] p-4 divide-y divide-slate-100">
            {filteredBelumBayar.length > 0 ? (
              filteredBelumBayar.map((w: any, idx: number) => (
                <div key={w.id} className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 px-2.5 rounded-xl transition-colors">
                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">{idx + 1}. {w.nama_lengkap}</span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                        Belum Bayar
                      </span>
                    </div>
                    <div className="text-[10.5px] text-slate-400 font-mono mt-0.5">
                      KK: {w.no_kk || '-'} • NIK: {w.nik || '-'}
                    </div>
                    <div className="text-[10.5px] text-slate-500 mt-1">
                      Domisili: {w.alamat_domisili || wilayahShort}
                    </div>
                  </div>

                  {w.no_hp && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="text-[11px] font-mono text-slate-500 font-medium flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{w.no_hp}</span>
                      </div>
                      <a
                        href={`https://api.whatsapp.com/send?phone=${formatPhoneForWa(w.no_hp)}&text=${encodeURIComponent(
                          `Halo Bpk/Ibu *${w.nama_lengkap}*,\n\nKami dari Pengurus *RT.002 RW.09, Kelurahan Pondok Rajeg* ingin menginfokan mengenai status iuran berkala warga.\n\nTercatat untuk iuran *${reportCategory}* periode *${reportMonth} ${reportYear}* belum lunas.\n\nMohon dapat melakukan pembayaran di pos keuangan RT atau melalui Bendahara RT. Terima kasih banyak atas partisipasi aktif Anda selaku warga.\n\n*Salam hangat,*\n*Pengurus RT.002 RW.09*`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-600 transition-colors flex items-center justify-center cursor-pointer"
                        title="Kirim pengingat iuran sopan via WhatsApp"
                      >
                        <svg className="w-4 h-4 fill-current text-emerald-600 shrink-0" viewBox="0 0 24 24">
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.436 0 9.851-4.38 9.854-9.762.001-2.607-1.012-5.059-2.853-6.902C16.392 2.096 13.946 1.08 11.336 1.08c-5.44 0-9.857 4.379-9.86 9.762-.001 1.902.5 3.744 1.447 5.354L1.874 22.1l6.104-1.601c1.533.835 3.1 1.255 4.669 1.255zm11.302-7.14c-.302-.152-1.791-.883-2.073-.984-.282-.102-.487-.152-.69.152-.204.304-.79.984-.968 1.186-.179.203-.357.228-.659.076-.302-.152-1.274-.469-2.427-1.496-.897-.8-1.502-1.787-1.679-2.09-.178-.303-.019-.467.132-.618.136-.135.302-.354.453-.532.152-.178.203-.304.304-.507.102-.203.051-.38-.025-.532-.076-.152-.69-1.66-.945-2.272-.248-.598-.5-.516-.69-.526-.178-.01-.383-.01-.587-.01-.204 0-.538.076-.82.38-.282.304-1.077 1.052-1.077 2.563 0 1.511 1.096 2.969 1.248 3.172.152.203 2.158 3.297 5.228 4.618.729.314 1.3.502 1.745.643.733.232 1.399.2 1.925.122.587-.087 1.791-.733 2.046-1.439.255-.705.255-1.312.179-1.439-.076-.127-.282-.203-.585-.355z"/>
                        </svg>
                      </a>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
                <CheckCircle className="w-12 h-12 text-emerald-500 mb-2" />
                <p className={`text-xs font-bold ${
                  reportCategory === 'Saldo Pindahan' || reportCategory === 'Saldo Awal' ? 'text-slate-500' : 'text-emerald-600'
                }`}>
                  {reportCategory === 'Saldo Pindahan' || reportCategory === 'Saldo Awal' 
                    ? 'Kategori Saldo Awal' 
                    : 'Kepatuhan 100% Lunas!'}
                </p>
                <p className="text-[11px] text-slate-400 max-w-xs mt-1 leading-relaxed">
                  {reportCategory === 'Saldo Pindahan' || reportCategory === 'Saldo Awal'
                    ? 'Tidak ada kewajiban pembayaran berkala untuk kategori saldo awal.'
                    : `Seluruh warga terdaftar telah lunas membayar iuran ${reportCategory} untuk bulan ${reportMonth} ${reportYear}!`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
