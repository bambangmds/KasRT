import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  Loader2, 
  Phone, 
  Receipt, 
  Coins, 
  Calendar, 
  CreditCard, 
  Check, 
  Info, 
  CheckCircle, 
  XCircle, 
  X,
  Sparkles
} from 'lucide-react';
import { getSupabase, insertKasToSupabase } from '../lib/supabase';
import { SupabaseConnectionStatus, CategoryItem } from '../types';
import { formatSimpleRupiah, formatDateIndo } from '../data/initialData';
import { useSekretariat } from '../context/SekretariatContext';

interface TransaksiIuranSectionProps {
  connectionStatus?: SupabaseConnectionStatus;
  onTriggerToast: (msg: string, type?: 'success' | 'error' | 'info', title?: string) => void;
  onRefreshTransactions?: () => void;
  categories?: CategoryItem[];
}

const BULAN_LIST = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const TAHUN_LIST = ['2024', '2025', '2026', '2027', '2028'];

const CATEGORIES_IURAN = [
  'Iuran Warga',
  'Kebersihan',
  'Iuran Wajib',
  'Iuran Perbaikan Jalan',
  'Bantuan Pembangunan Masjid',
  'Biaya keRTan',
  'Sosial',
  'Lainnya'
];

const getStoredDefaultAmount = (category: string): number => {
  const stored = localStorage.getItem(`kas_rt_default_amount_${category}`);
  return stored ? parseInt(stored, 10) : 25000;
};

const setStoredDefaultAmount = (category: string, amount: number) => {
  localStorage.setItem(`kas_rt_default_amount_${category}`, amount.toString());
};

export const TransaksiIuranSection: React.FC<TransaksiIuranSectionProps> = ({ 
  connectionStatus = 'connected', 
  onTriggerToast,
  onRefreshTransactions,
  categories = []
}) => {
  const { wilayahShort } = useSekretariat();

  // Helper to format Indonesian phone numbers for WhatsApp API
  const formatPhoneForWa = (phone?: string): string => {
    if (!phone) return '';
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    }
    return clean;
  };

  // Helper to get citizen phone number
  const getCitizenPhone = (wId?: string, description?: string): string => {
    if (wId) {
      const match = dataWarga.find(w => w.id === wId);
      if (match?.no_hp) return match.no_hp;
    }
    if (description) {
      const lowerDesc = description.toLowerCase();
      const match = dataWarga.find(w => {
        if (!w.nama_lengkap) return false;
        const cleanName = w.nama_lengkap.toLowerCase()
          .replace(/^(bpk\.?|bapak\.?|ibu\.?|ibuk\.?|pak\.?|h\.?|hj\.?|sdr\.?|sdri\.?)\s+/i, '')
          .trim();
        return cleanName.length >= 3 && lowerDesc.includes(cleanName);
      });
      if (match?.no_hp) return match.no_hp;
    }
    return '';
  };

  // Helper to generate the WhatsApp receipt message Link
  const handleGetWaReceiptLink = (t: any) => {
    const phone = getCitizenPhone(t.warga_id, t.keterangan);
    if (!phone) return '';
    
    let citizenName = 'Warga';
    if (t.warga_id) {
      const w = dataWarga.find(item => item.id === t.warga_id);
      if (w?.nama_lengkap) citizenName = w.nama_lengkap;
    } else {
      const parts = (t.keterangan || '').split(' - ');
      if (parts.length > 1) {
        citizenName = parts[parts.length - 1];
      }
    }
    
    const formattedPhone = formatPhoneForWa(phone);
    const message = `Bukti Penerimaan Pembayaran Kas Resmi\n*RT.002 RW.09, Kelurahan Pondok Rajeg*\n\n` +
      `Telah diterima setoran iuran warga dengan rincian berikut:\n` +
      `• *Nama Penyetor*: ${citizenName}\n` +
      `• *Pos Kategori*: ${t.kategori}\n` +
      `• *Keterangan*: ${t.keterangan}\n` +
      `• *Tanggal Setor*: ${formatDateIndo(t.tanggal)}\n` +
      `• *Jumlah Nominal*: ${formatSimpleRupiah(t.jumlah)}\n` +
      `• *Status*: Lunas (Tercatat di Database RT)\n\n` +
      `Terima kasih atas partisipasi aktif Anda dalam membangun lingkungan yang asri, aman, dan kondusif.\n\n` +
      `*Salam hangat,*\n` +
      `*Bendahara RT.002 RW.09*`;
      
    return `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`;
  };

  // Get dynamic categories from Supabase
  const availableCategories = useMemo(() => {
    const list = categories
      .filter(c => c.type === 'Masuk' && (c.wajib === true || String(c.wajib) === 'Y' || String(c.wajib) === 'Yes' || String(c.wajib).toLowerCase() === 'true'))
      .map(c => c.name);
    if (list.length > 0) return list;
    return categories.filter(c => c.type === 'Masuk').map(c => c.name);
  }, [categories]);

  // Common Citizen State
  const [dataWarga, setDataWarga] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Transaksi Iuran Form State
  const [paymentMode, setPaymentMode] = useState<'tunggal' | 'serempak'>('tunggal');
  const [selectedWargaIds, setSelectedWargaIds] = useState<string[]>([]);
  const [selectedWargaId, setSelectedWargaId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Iuran Warga');
  const [paymentAmount, setPaymentAmount] = useState<number>(() => getStoredDefaultAmount('Iuran Warga'));

  // Pastikan selectedCategory selalu sinkron jika availableCategories berubah
  useEffect(() => {
    if (availableCategories.length > 0 && !availableCategories.includes(selectedCategory)) {
      setSelectedCategory(availableCategories[0]);
    }
  }, [availableCategories, selectedCategory]);

  // Sinkronisasi paymentAmount dengan nominal kategori dari database jika ada
  useEffect(() => {
    if (selectedCategory) {
      const matchedCat = categories.find(c => c.name === selectedCategory && c.type === 'Masuk');
      if (matchedCat && matchedCat.nominal !== undefined && matchedCat.nominal > 0) {
        setPaymentAmount(matchedCat.nominal);
      } else {
        setPaymentAmount(getStoredDefaultAmount(selectedCategory));
      }
    }
  }, [selectedCategory, categories]);

  // Helper untuk mendapatkan tanggal ISO (YYYY-MM-DD) yang sesuai dengan bulan & tahun tagihan
  const getIsoDateForPeriod = (monthName: string, yearStr: string, baseDateStr?: string): string => {
    const monthIdx = BULAN_LIST.indexOf(monthName);
    const mm = monthIdx >= 0 ? String(monthIdx + 1).padStart(2, '0') : '01';
    const yyyy = yearStr || String(new Date().getFullYear());
    let day = '10';
    if (baseDateStr && baseDateStr.includes('-')) {
      const parts = baseDateStr.split('-');
      if (parts.length === 3 && parts[2]) {
        const dNum = parseInt(parts[2], 10);
        if (!isNaN(dNum) && dNum >= 1 && dNum <= 28) {
          day = String(dNum).padStart(2, '0');
        }
      }
    }
    return `${yyyy}-${mm}-${day}`;
  };

  const [paymentMonth, setPaymentMonth] = useState<string>(() => BULAN_LIST[new Date().getMonth()]);
  const [paymentYear, setPaymentYear] = useState<string>(() => String(new Date().getFullYear()));
  const [paymentDate, setPaymentDate] = useState<string>(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${today.getFullYear()}-${mm}-${dd}`;
  });
  const [paymentDescription, setPaymentDescription] = useState<string>('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [searchWargaTerm, setSearchWargaTerm] = useState('');

  // Transaksi Iuran History State
  const [iuranHistory, setIuranHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [searchHistoryTerm, setSearchHistoryTerm] = useState('');

  // Handler pergantian bulan tagihan
  const handlePaymentMonthChange = (newMonth: string) => {
    setPaymentMonth(newMonth);
    setPaymentDate(prev => getIsoDateForPeriod(newMonth, paymentYear, prev));
  };

  // Handler pergantian tahun tagihan
  const handlePaymentYearChange = (newYear: string) => {
    setPaymentYear(newYear);
    setPaymentDate(prev => getIsoDateForPeriod(paymentMonth, newYear, prev));
  };

  const loadDataWarga = async () => {
    setIsLoading(true);
    const client = getSupabase();
    if (!client) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await client
        .from('data_warga')
        .select('*')
        .order('nama_lengkap', { ascending: true });

      if (error) {
        if (error.code === '42P01') {
          onTriggerToast('Tabel data_warga belum tersedia di Supabase. Silakan jalankan script SQL Anda.', 'warning', 'Tabel Belum Dibuat');
        } else {
          onTriggerToast(error.message, 'error', 'Gagal Memuat Data');
        }
      } else if (data) {
        setDataWarga(data);
      }
    } catch (err: any) {
      onTriggerToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadIuranHistory = async () => {
    setIsHistoryLoading(true);
    const client = getSupabase();
    if (!client) {
      setIsHistoryLoading(false);
      return;
    }
    try {
      const { data, error } = await client
        .from('kas_rt')
        .select('*')
        .eq('jenis', 'Masuk')
        .order('tanggal', { ascending: false });

      if (error) {
        console.error('Error loading iuran history:', error);
      } else if (data) {
        const incomeCategoryNames = categories.filter(c => c.type === 'Masuk').map(c => c.name);
        const activeCategoriesFilter = incomeCategoryNames.length > 0 ? incomeCategoryNames : CATEGORIES_IURAN;
        const filtered = data.filter((t: any) => 
          activeCategoriesFilter.includes(t.kategori) ||
          t.keterangan?.toLowerCase().includes('iuran') ||
          t.keterangan?.toLowerCase().includes('kk:') ||
          t.keterangan?.toLowerCase().includes('warga')
        );
        setIuranHistory(filtered);
      }
    } catch (err) {
      console.error('Exception loading iuran history:', err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (connectionStatus === 'connected') {
      loadDataWarga();
      loadIuranHistory();
    }
  }, [connectionStatus, categories]);

  // Update dynamic description automatically
  useEffect(() => {
    const label = selectedCategory;
    const cleanLabel = label.replace(/^iuran\s*/i, '');
    const prefix = cleanLabel ? `${cleanLabel} ` : '';
    
    if (paymentMode === 'tunggal') {
      if (selectedWargaId) {
        const selectedWarga = dataWarga.find(w => w.id === selectedWargaId);
        if (selectedWarga) {
          setPaymentDescription(`${prefix}(${paymentMonth} ${paymentYear}) - ${selectedWarga.nama_lengkap}`);
        }
      } else {
        setPaymentDescription('');
      }
    } else {
      if (selectedWargaIds.length > 0) {
        setPaymentDescription(`${prefix}(${paymentMonth} ${paymentYear}) - Serempak (${selectedWargaIds.length} Warga)`);
      } else {
        setPaymentDescription('');
      }
    }
  }, [selectedWargaId, selectedWargaIds, paymentMode, selectedCategory, paymentMonth, paymentYear, dataWarga]);

  // Helper: Cek apakah warga sudah membayar iuran tertentu di bulan dan tahun yang sama
  const checkIfWargaAlreadyPaid = useCallback((warga: any, category: string, month: string, year: string) => {
    const cleanW = (warga?.nama_lengkap || '')
      .toLowerCase()
      .replace(/^(bpk\.?|bapak\.?|ibu\.?|ibuk\.?|pak\.?|h\.?|hj\.?|sdr\.?|sdri\.?)\s+/i, '')
      .trim();

    return iuranHistory.some(tx => {
      const desc = (tx.keterangan || '').toLowerCase();
      let isWargaMatch = false;

      if (tx.warga_id && tx.warga_id === warga.id) {
        isWargaMatch = true;
      } else if (cleanW && cleanW.length >= 3 && desc.includes(cleanW)) {
        isWargaMatch = true;
      } else if (warga.nik && warga.nik.length >= 6 && warga.nik !== '-' && desc.includes(warga.nik)) {
        isWargaMatch = true;
      }

      if (!isWargaMatch) return false;
      if (category !== 'Semua Kategori' && tx.kategori !== category) return false;

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

      return txMonthName.toLowerCase() === month.toLowerCase() && txYear === year;
    });
  }, [iuranHistory]);

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentAmount <= 0) {
      onTriggerToast('Jumlah pembayaran harus lebih dari Rp 0.', 'error', 'Jumlah Salah');
      return;
    }

    setIsSavingPayment(true);
    
    try {
      if (paymentMode === 'tunggal') {
        if (!selectedWargaId) {
          onTriggerToast('Silakan pilih warga terlebih dahulu.', 'error', 'Warga Belum Terpilih');
          setIsSavingPayment(false);
          return;
        }

        const selectedWarga = dataWarga.find(w => w.id === selectedWargaId);
        if (!selectedWarga) {
          setIsSavingPayment(false);
          return;
        }

        if (checkIfWargaAlreadyPaid(selectedWarga, selectedCategory, paymentMonth, paymentYear)) {
          onTriggerToast(
            `${selectedWarga.nama_lengkap} sudah membayar iuran ${selectedCategory} untuk Bulan ${paymentMonth} ${paymentYear}.`, 
            'error', 
            'Iuran Sudah Lunas'
          );
          setIsSavingPayment(false);
          return;
        }

        const effectiveDate = getIsoDateForPeriod(paymentMonth, paymentYear, paymentDate);
        const nextId = crypto.randomUUID();
        const cleanCatLabel = selectedCategory.replace(/^iuran\s*/i, '');
        const catPrefix = cleanCatLabel ? `${cleanCatLabel} ` : '';
        const fallbackDesc = `${catPrefix}(${paymentMonth} ${paymentYear}) - ${selectedWarga.nama_lengkap}`;
        
        const { error } = await insertKasToSupabase({
          id: nextId,
          date: effectiveDate,
          type: 'Masuk',
          category: selectedCategory,
          amount: paymentAmount,
          description: paymentDescription || fallbackDesc,
          wargaId: selectedWargaId,
        });

        if (error) {
          onTriggerToast(`Gagal menyimpan iuran: ${error}`, 'error', 'Gagal Simpan');
        } else {
          onTriggerToast(`Pembayaran iuran ${selectedWarga.nama_lengkap} sebesar ${formatSimpleRupiah(paymentAmount)} berhasil dicatat!`, 'success', 'Iuran Berhasil');
          
          setSelectedWargaId('');
          setSearchWargaTerm('');
          loadIuranHistory();
          
          if (onRefreshTransactions) {
            onRefreshTransactions();
          }
        }
      } else {
        // Serempak mode
        if (selectedWargaIds.length === 0) {
          onTriggerToast('Silakan pilih minimal satu warga.', 'error', 'Warga Belum Terpilih');
          setIsSavingPayment(false);
          return;
        }

        const validWargaIds = selectedWargaIds.filter(wId => {
          const warga = dataWarga.find(w => w.id === wId);
          if (!warga) return false;
          return !checkIfWargaAlreadyPaid(warga, selectedCategory, paymentMonth, paymentYear);
        });

        if (validWargaIds.length === 0) {
          onTriggerToast('Seluruh warga yang dipilih sudah lunas untuk periode dan kategori ini.', 'error', 'Iuran Sudah Lunas');
          setIsSavingPayment(false);
          return;
        }

        const skippedCount = selectedWargaIds.length - validWargaIds.length;
        const effectiveDate = getIsoDateForPeriod(paymentMonth, paymentYear, paymentDate);
        const cleanCatLabel = selectedCategory.replace(/^iuran\s*/i, '');
        const catPrefix = cleanCatLabel ? `${cleanCatLabel} ` : '';
        
        const promises = validWargaIds.map(wId => {
          const warga = dataWarga.find(w => w.id === wId);
          const customDesc = `${catPrefix}(Bulan ${paymentMonth} ${paymentYear}) - ${warga?.nama_lengkap || 'Warga'}`;
          return insertKasToSupabase({
            id: crypto.randomUUID(),
            date: effectiveDate,
            type: 'Masuk',
            category: selectedCategory,
            amount: paymentAmount,
            description: customDesc,
            wargaId: wId,
          });
        });

        const results = await Promise.all(promises);
        const errors = results.filter(r => r.error).map(r => r.error);

        if (errors.length > 0) {
          onTriggerToast(`Gagal menyimpan beberapa iuran: ${errors[0]}`, 'error', 'Sebagian Gagal');
        } else {
          let successMessage = `Pembayaran iuran serempak untuk ${validWargaIds.length} warga sebesar ${formatSimpleRupiah(paymentAmount)}/warga berhasil dicatat!`;
          if (skippedCount > 0) {
            successMessage += ` (${skippedCount} warga dilewati karena sudah lunas)`;
          }
          onTriggerToast(successMessage, 'success', 'Iuran Serempak Berhasil');
          
          setSelectedWargaIds([]);
          setSearchWargaTerm('');
          loadIuranHistory();
          
          if (onRefreshTransactions) {
            onRefreshTransactions();
          }
        }
      }
    } catch (err: any) {
      onTriggerToast(err.message, 'error', 'Gagal Menambahkan');
    } finally {
      setIsSavingPayment(false);
    }
  };

  // Filter citizens for selection list in "Transaksi Iuran"
  const filteredWargaForSelect = dataWarga.filter(w =>
    w.nama_lengkap?.toLowerCase().includes(searchWargaTerm.toLowerCase()) ||
    w.nik?.includes(searchWargaTerm) ||
    w.no_kk?.includes(searchWargaTerm) ||
    w.alamat_domisili?.toLowerCase().includes(searchWargaTerm.toLowerCase())
  );

  // Filter iuran history
  const filteredHistory = iuranHistory.filter(t =>
    t.keterangan?.toLowerCase().includes(searchHistoryTerm.toLowerCase()) ||
    t.kategori?.toLowerCase().includes(searchHistoryTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm sm:text-base">
              Pencatatan Setoran Iuran Warga
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Input setoran iuran warga {wilayahShort} (tunggal atau serempak) langsung terhubung ke database kas RT.
            </p>
          </div>
        </div>

        <button 
          type="button"
          onClick={() => {
            loadDataWarga();
            loadIuranHistory();
          }}
          disabled={isLoading || isHistoryLoading || connectionStatus !== 'connected'}
          className="self-end sm:self-auto px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all shadow-2xs flex items-center gap-2 text-xs font-semibold disabled:opacity-50 cursor-pointer"
          title="Segarkan Data Iuran & Warga"
        >
          <RefreshCw className={`w-4 h-4 ${(isLoading || isHistoryLoading) ? 'animate-spin text-indigo-600' : ''}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* Main Grid: Form & History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Column 1: Record Form */}
        <div className="lg:col-span-5 bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Formulir Entri Iuran Warga</h4>
              <p className="text-[11px] text-slate-500">Pilih warga dan tentukan nominal setoran iuran</p>
            </div>
          </div>

          <form onSubmit={handleSavePayment} className="space-y-4">
            {/* Payment Mode Selection Toggle */}
            <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => {
                  setPaymentMode('tunggal');
                  setSelectedWargaIds([]);
                  setSearchWargaTerm('');
                }}
                className={`flex-1 py-2 rounded-lg text-center transition-all cursor-pointer ${
                  paymentMode === 'tunggal'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'hover:text-slate-800 hover:bg-slate-50/50'
                }`}
              >
                1. Bayar Tunggal (Perorangan)
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentMode('serempak');
                  setSelectedWargaId('');
                  setSearchWargaTerm('');
                }}
                className={`flex-1 py-2 rounded-lg text-center transition-all cursor-pointer ${
                  paymentMode === 'serempak'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'hover:text-slate-800 hover:bg-slate-50/50'
                }`}
              >
                2. Bayar Serempak (Banyak Warga)
              </button>
            </div>

            {/* Mode 1: Tunggal Selector */}
            {paymentMode === 'tunggal' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 flex justify-between">
                  <span>Pilih Warga Penyetor <span className="text-rose-500">*</span></span>
                  {selectedWargaId && (
                    <span className="text-emerald-600 font-semibold text-[11px]">Terpilih</span>
                  )}
                </label>
                
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Ketik untuk mencari nama warga / NIK..."
                    value={searchWargaTerm}
                    onChange={(e) => setSearchWargaTerm(e.target.value)}
                    className="block w-full pl-8 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                  />
                  {searchWargaTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchWargaTerm('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
                  {isLoading ? (
                    <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Memuat data warga...
                    </div>
                  ) : filteredWargaForSelect.length > 0 ? (
                    filteredWargaForSelect.map(w => {
                      const isSelected = selectedWargaId === w.id;
                      const isPaid = checkIfWargaAlreadyPaid(w, selectedCategory, paymentMonth, paymentYear);
                      return (
                        <div
                          key={w.id}
                          onClick={() => {
                            setSelectedWargaId(w.id);
                          }}
                          className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors text-xs ${
                            isSelected 
                              ? 'bg-indigo-50 border-l-4 border-indigo-600 text-indigo-900 font-medium' 
                              : isPaid
                                ? 'bg-emerald-50/40 text-slate-500 hover:bg-emerald-50/70'
                                : 'hover:bg-white text-slate-700'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <div className="font-bold flex items-center gap-1.5">
                              {w.nama_lengkap}
                              {isPaid && (
                                <span className="text-[9px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-semibold border border-emerald-200">
                                  Lunas ({paymentMonth})
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              NIK: {w.nik} • KK: {w.no_kk}
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Warga tidak ditemukan
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mode 2: Serempak Multi-Selector */}
            {paymentMode === 'serempak' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    Pilih Warga ({selectedWargaIds.length} Terpilih) <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const unpaidIds = dataWarga
                          .filter(w => !checkIfWargaAlreadyPaid(w, selectedCategory, paymentMonth, paymentYear))
                          .map(w => w.id);
                        setSelectedWargaIds(unpaidIds);
                      }}
                      className="text-[10px] text-indigo-600 hover:underline font-semibold cursor-pointer"
                    >
                      Pilih Semua Belum Lunas
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedWargaIds([])}
                      className="text-[10px] text-slate-500 hover:underline font-semibold cursor-pointer"
                    >
                      Batal Pilih
                    </button>
                  </div>
                </div>

                <div className="relative mb-2">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Saring warga..."
                    value={searchWargaTerm}
                    onChange={(e) => setSearchWargaTerm(e.target.value)}
                    className="block w-full pl-8 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
                  {isLoading ? (
                    <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Memuat data...
                    </div>
                  ) : filteredWargaForSelect.length > 0 ? (
                    filteredWargaForSelect.map(w => {
                      const isSelected = selectedWargaIds.includes(w.id);
                      const isPaid = checkIfWargaAlreadyPaid(w, selectedCategory, paymentMonth, paymentYear);
                      return (
                        <div
                          key={w.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedWargaIds(prev => prev.filter(id => id !== w.id));
                            } else {
                              setSelectedWargaIds(prev => [...prev, w.id]);
                            }
                          }}
                          className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors text-xs ${
                            isSelected 
                              ? 'bg-indigo-50/80 text-indigo-900 font-medium' 
                              : isPaid 
                                ? 'bg-emerald-50/30 text-slate-400' 
                                : 'hover:bg-white text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate pr-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer pointer-events-none"
                            />
                            <div className="truncate">
                              <div className="font-bold flex items-center gap-1.5">
                                {w.nama_lengkap}
                                {isPaid && (
                                  <span className="text-[9px] px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded font-normal">
                                    Lunas
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {w.alamat_domisili || 'Warga'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Warga tidak ditemukan
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Periode & Kategori Pos */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="space-y-1 sm:col-span-4">
                <label className="block text-[11px] font-bold text-slate-700">Bulan Tagihan</label>
                <select
                  value={paymentMonth}
                  onChange={(e) => handlePaymentMonthChange(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none cursor-pointer"
                >
                  {BULAN_LIST.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700">Tahun</label>
                <select
                  value={paymentYear}
                  onChange={(e) => handlePaymentYearChange(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none cursor-pointer"
                >
                  {TAHUN_LIST.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 sm:col-span-6">
                <label className="block text-[11px] font-bold text-slate-700">Pos Kategori</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    const catName = e.target.value;
                    setSelectedCategory(catName);
                    const matchedCat = categories.find(c => c.name === catName && c.type === 'Masuk');
                    if (matchedCat && matchedCat.nominal !== undefined && matchedCat.nominal > 0) {
                      setPaymentAmount(matchedCat.nominal);
                    } else {
                      setPaymentAmount(getStoredDefaultAmount(catName));
                    }
                  }}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-indigo-900 cursor-pointer"
                >
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Nominal Form */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 flex justify-between">
                <span>Nominal Pembayaran per Warga <span className="text-rose-500">*</span></span>
                <span className="text-indigo-600 font-extrabold text-xs">
                  {formatSimpleRupiah(paymentAmount)}
                </span>
              </label>
              
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-slate-400 text-xs font-bold pointer-events-none">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={paymentAmount || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 0;
                    setPaymentAmount(val);
                    setStoredDefaultAmount(selectedCategory, val);
                  }}
                  placeholder="25000"
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none font-bold text-slate-800"
                />
              </div>

              {/* Quick Nominal Presets */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] text-slate-400 font-medium flex items-center gap-0.5">
                  <Sparkles className="w-3 h-3 text-amber-500" /> Nominal:
                </span>
                {[10000, 20000, 25000, 50000, 100000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setPaymentAmount(amt);
                      setStoredDefaultAmount(selectedCategory, amt);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                      paymentAmount === amt 
                        ? 'bg-indigo-600 text-white border-indigo-600' 
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {amt / 1000}k
                  </button>
                ))}
              </div>
            </div>

            {/* Tanggal Transaksi & Uraian Keterangan */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Tanggal Pencatatan</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Uraian / Keterangan Transaksi</label>
              <textarea
                value={paymentDescription}
                onChange={(e) => setPaymentDescription(e.target.value)}
                rows={2}
                placeholder="Keterangan transaksi iuran..."
                className="block w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none resize-y min-h-[60px]"
                disabled={connectionStatus !== 'connected'}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={
                isSavingPayment || 
                connectionStatus !== 'connected' || 
                (paymentMode === 'tunggal' ? !selectedWargaId : selectedWargaIds.length === 0)
              }
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSavingPayment ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Merekam Pembayaran...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Catat & Simpan Setoran Iuran</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Column 2: History List */}
        <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col space-y-4 min-h-[500px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Riwayat Pembayaran Iuran Terbaru</h4>
                <p className="text-[11px] text-slate-500">Daftar transaksi setoran iuran terdaftar di tabel kas_rt</p>
              </div>
            </div>
            <div className="text-xs text-slate-400 font-medium">
              Total: <span className="font-bold text-slate-700">{filteredHistory.length}</span>
            </div>
          </div>

          {/* History Search Filter */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari riwayat (nama warga, kategori, keterangan)..."
              value={searchHistoryTerm}
              onChange={(e) => setSearchHistoryTerm(e.target.value)}
              className="block w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
            />
          </div>

          {/* History Table */}
          <div className="flex-1 overflow-x-auto border border-slate-100 rounded-xl max-h-[420px]">
            {isHistoryLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mb-3 text-indigo-500" />
                <p className="text-xs font-medium">Memuat riwayat iuran...</p>
              </div>
            ) : filteredHistory.length > 0 ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider text-[10px]">
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">Kategori</th>
                    <th className="p-3">Uraian / Keterangan</th>
                    <th className="p-3 text-right">Jumlah (Rp)</th>
                    <th className="p-3 text-center">Kwitansi WA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 text-slate-500 whitespace-nowrap">{formatDateIndo(t.tanggal)}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {t.kategori}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700 font-medium truncate max-w-[180px]" title={t.keterangan}>
                        {t.keterangan}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-800 whitespace-nowrap">
                        {formatSimpleRupiah(t.jumlah)}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {getCitizenPhone(t.warga_id, t.keterangan) ? (
                          <a
                            href={handleGetWaReceiptLink(t)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[10px] font-bold transition-all cursor-pointer"
                            title="Kirim bukti kwitansi via WhatsApp"
                          >
                            <svg className="w-3.5 h-3.5 fill-current text-emerald-600 shrink-0" viewBox="0 0 24 24">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.436 0 9.851-4.38 9.854-9.762.001-2.607-1.012-5.059-2.853-6.902C16.392 2.096 13.946 1.08 11.336 1.08c-5.44 0-9.857 4.379-9.86 9.762-.001 1.902.5 3.744 1.447 5.354L1.874 22.1l6.104-1.601c1.533.835 3.1 1.255 4.669 1.255zm11.302-7.14c-.302-.152-1.791-.883-2.073-.984-.282-.102-.487-.152-.69.152-.204.304-.79.984-.968 1.186-.179.203-.357.228-.659.076-.302-.152-1.274-.469-2.427-1.496-.897-.8-1.502-1.787-1.679-2.09-.178-.303-.019-.467.132-.618.136-.135.302-.354.453-.532.152-.178.203-.304.304-.507.102-.203.051-.38-.025-.532-.076-.152-.69-1.66-.945-2.272-.248-.598-.5-.516-.69-.526-.178-.01-.383-.01-.587-.01-.204 0-.538.076-.82.38-.282.304-1.077 1.052-1.077 2.563 0 1.511 1.096 2.969 1.248 3.172.152.203 2.158 3.297 5.228 4.618.729.314 1.3.502 1.745.643.733.232 1.399.2 1.925.122.587-.087 1.791-.733 2.046-1.439.255-.705.255-1.312.179-1.439-.076-.127-.282-.203-.585-.355z"/>
                            </svg>
                            <span className="text-emerald-700">Kirim</span>
                          </a>
                        ) : (
                          <span 
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 text-[10px] font-semibold select-none cursor-not-allowed"
                            title="Nomor HP warga belum terdaftar"
                          >
                            <span>Belum Ada WA</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
                <Coins className="w-12 h-12 text-slate-200 mb-2" />
                <p className="text-xs font-bold text-slate-500">Belum Ada Riwayat Iuran</p>
                <p className="text-[10px] text-slate-400 max-w-xs mt-1">
                  Belum ditemukan data transaksi iuran di database. Anda bisa mulai mencatat iuran pada panel formulir.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
