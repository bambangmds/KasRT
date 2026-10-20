import React, { useState, useEffect, useMemo } from 'react';
import { 
  Megaphone, 
  Users, 
  UserCheck, 
  MessageSquare, 
  Phone, 
  Copy, 
  CheckCircle, 
  Send, 
  Sparkles, 
  AlertTriangle, 
  HelpCircle, 
  FileText, 
  RefreshCw, 
  Check, 
  ArrowRight,
  Download
} from 'lucide-react';
import { fetchAllPenggunaFromSupabase, fetchDataWargaFromSupabase, getActiveSupabaseConfig } from '../lib/supabase';
import { DataWargaItem } from '../types';
import { useSekretariat } from '../context/SekretariatContext';
import { formatSimpleRupiah } from '../data/initialData';

interface SiaranWargaViewProps {
  onTriggerToast: (message: string, type: 'success' | 'error' | 'info', title?: string) => void;
  activeBalance?: number;
}

interface RecipientItem {
  id: string;
  nama: string;
  noHp: string;
  source: 'Akun Terdaftar' | 'Buku Data Warga';
  roleOrStatus: string;
  noKk?: string;
}

export const SiaranWargaView: React.FC<SiaranWargaViewProps> = ({
  onTriggerToast,
  activeBalance = 0,
}) => {
  const { wilayahShort, wilayahLabel, sekretariat } = useSekretariat();

  // Loading & Data States
  const [isLoading, setIsLoading] = useState(false);
  const [registeredAccounts, setRegisteredAccounts] = useState<any[]>([]);
  const [allResidents, setAllResidents] = useState<DataWargaItem[]>([]);

  // Filtering & Selection
  const [targetType, setTargetType] = useState<'akun' | 'warga'>('akun');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Message Composer States
  const [selectedTemplate, setSelectedTemplate] = useState<string>('umum');
  const [messageTemplate, setMessageTemplate] = useState<string>(
    `Yth. Bapak/Ibu {nama},\n\nKami dari Pengurus {wilayah} ingin menginfokan...`
  );

  // Send Tracker State (stores sent recipient IDs)
  const [sentMap, setSentMap] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('kas_rt_broadcast_sent_map');
    return saved ? JSON.parse(saved) : {};
  });

  // Auto-Next Highlight
  const [autoNext, setAutoNext] = useState(true);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  // Load Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const accounts = await fetchAllPenggunaFromSupabase();
      if (accounts) {
        setRegisteredAccounts(accounts);
      }

      const residentsRes = await fetchDataWargaFromSupabase();
      if (residentsRes) {
        setAllResidents(residentsRes);
      }
    } catch (err) {
      console.error('[SiaranWargaView loadData]', err);
      onTriggerToast('Gagal menyinkronkan daftar warga dari database.', 'error', 'Error Database');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [targetType]);

  // Save sent state
  const markAsSent = (id: string) => {
    const updated = { ...sentMap, [id]: true };
    setSentMap(updated);
    localStorage.setItem('kas_rt_broadcast_sent_map', JSON.stringify(updated));
    onTriggerToast('Status pengiriman diperbarui!', 'success');
  };

  const resetSentStatus = () => {
    if (window.confirm('Apakah Anda yakin ingin mereset seluruh status pengiriman siaran ini?')) {
      setSentMap({});
      localStorage.removeItem('kas_rt_broadcast_sent_map');
      onTriggerToast('Seluruh status pengiriman berhasil di-reset.', 'success');
    }
  };

  // Pre-defined Templates
  const templates = {
    umum: `Yth. Bapak/Ibu {nama},\n\nKami dari Pengurus {wilayah} ({kelurahan}) menginfokan bahwa...`,
    iuran: `Yth. Bapak/Ibu {nama},\n\nDiberitahukan kepada warga {wilayah}, untuk kelancaran kas sosial & kebersihan lingkungan, mohon partisipasi iuran bulanan warga.\n\nSaldo Kas saat ini: {saldo}.\nTerima kasih atas kerja samanya.`,
    rapat: `Kepada Yth.\nBapak/Ibu {nama}\ndi Tempat\n\nMengharap kehadiran Bapak/Ibu dalam acara Rapat Warga {wilayah} yang akan dilaksanakan pada:\n Hari: [Hari/Tanggal]\n Jam: [Waktu]\n Agenda: [Acara]\n\nKehadiran Bapak/Ibu sangat berarti demi kemajuan lingkungan kita. Terima kasih.`,
    kas: `Yth. Bapak/Ibu Warga {wilayah},\n\nBerikut kami sampaikan laporan transparansi saldo kas warga per hari ini.\n\nTotal Saldo Kas RT: {saldo}\n\nLaporan keuangan lengkap dapat dilihat langsung dengan login ke dasbor Buku Kas {wilayah}.\n\nSalam Hangat,\nPengurus {wilayah}`,
  };

  const applyTemplate = (key: keyof typeof templates) => {
    setSelectedTemplate(key);
    setMessageTemplate(templates[key]);
    onTriggerToast(`Template "${key === 'umum' ? 'Pengumuman Umum' : key === 'iuran' ? 'Iuran Bulanan' : key === 'rapat' ? 'Undangan Rapat' : 'Laporan Kas'}" diterapkan!`, 'info');
  };

  // Compile recipient list
  const rawRecipients: RecipientItem[] = useMemo(() => {
    if (targetType === 'akun') {
      // Filter from registered accounts
      return registeredAccounts.map(acc => {
        // Clean phone number format
        let rawPhone = acc.no_hp || '';
        let cleanPhone = rawPhone.replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) {
          cleanPhone = '62' + cleanPhone.slice(1);
        } else if (cleanPhone.startsWith('8')) {
          cleanPhone = '62' + cleanPhone;
        }

        return {
          id: acc.id || acc.email,
          nama: acc.nama,
          noHp: cleanPhone,
          source: 'Akun Terdaftar' as const,
          roleOrStatus: acc.role || acc.jabatan || 'Warga',
          noKk: acc.no_kk || undefined,
        };
      });
    } else {
      // Filter from all residents database
      return allResidents.map(res => {
        let rawPhone = res.no_hp || '';
        let cleanPhone = rawPhone.replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) {
          cleanPhone = '62' + cleanPhone.slice(1);
        } else if (cleanPhone.startsWith('8')) {
          cleanPhone = '62' + cleanPhone;
        }

        return {
          id: res.id,
          nama: res.nama_lengkap,
          noHp: cleanPhone,
          source: 'Buku Data Warga' as const,
          roleOrStatus: res.status_keanggotaan || 'Warga Tetap',
          noKk: res.no_kk || undefined,
        };
      });
    }
  }, [targetType, registeredAccounts, allResidents]);

  // Clean recipients with valid phone numbers & search query
  const recipients = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let filtered = rawRecipients;

    if (q) {
      filtered = filtered.filter(
        r => r.nama.toLowerCase().includes(q) || 
             (r.noKk && r.noKk.includes(q)) || 
             r.noHp.includes(q)
      );
    }

    return filtered;
  }, [rawRecipients, searchQuery]);

  // Separate valid phone numbers from empty ones
  const validRecipients = useMemo(() => {
    return recipients.filter(r => r.noHp && r.noHp.length >= 10);
  }, [recipients]);

  const invalidRecipients = useMemo(() => {
    return recipients.filter(r => !r.noHp || r.noHp.length < 10);
  }, [recipients]);

  // Generator for direct personalized message
  const generateMessage = (name: string) => {
    return messageTemplate
      .replace(/{nama}/g, name)
      .replace(/{wilayah}/g, wilayahShort)
      .replace(/{kelurahan}/g, sekretariat.kelurahan ? `Kel. ${sekretariat.kelurahan}` : wilayahLabel)
      .replace(/{saldo}/g, formatSimpleRupiah(activeBalance));
  };

  // Copy Comma Separated Phone Numbers
  const copyAllPhones = () => {
    const phones = validRecipients.map(r => r.noHp).join(',');
    if (!phones) {
      onTriggerToast('Tidak ada nomor telepon warga yang valid untuk disalin.', 'error');
      return;
    }
    navigator.clipboard.writeText(phones);
    onTriggerToast(`Berhasil menyalin ${validRecipients.length} nomor telepon ke clipboard (Format Koma).`, 'success', 'Nomor Disalin');
  };

  // Export as Google Contacts CSV
  const exportToGoogleContactsCSV = () => {
    if (validRecipients.length === 0) {
      onTriggerToast('Tidak ada kontak dengan nomor HP yang valid untuk diekspor.', 'error');
      return;
    }

    const headers = ['Name', 'Given Name', 'Group Membership', 'Phone 1 - Type', 'Phone 1 - Value'];
    const rows = validRecipients.map(r => [
      `Warga ${wilayahShort} - ${r.nama}`,
      r.nama,
      `Warga ${wilayahShort}`,
      'Mobile',
      `+${r.noHp}`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Kontak_Warga_${wilayahShort.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onTriggerToast(`Berhasil mengunduh file CSV berisi ${validRecipients.length} kontak warga untuk Google Contacts!`, 'success', 'Kontak Diekspor');
  };

  // Launch WhatsApp link
  const handleLaunchWhatsApp = (item: RecipientItem, index: number) => {
    const text = encodeURIComponent(generateMessage(item.nama));
    const waUrl = `https://api.whatsapp.com/send?phone=${item.noHp}&text=${text}`;
    
    window.open(waUrl, '_blank');
    markAsSent(item.id);

    // Auto next logic
    if (autoNext && index < validRecipients.length - 1) {
      setHighlightedIndex(index + 1);
      // Auto scroll to next highlighted row
      setTimeout(() => {
        const nextRow = document.getElementById(`recipient-row-${index + 1}`);
        if (nextRow) {
          nextRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  };

  const handleCopySingleMessage = (item: RecipientItem) => {
    const text = generateMessage(item.nama);
    navigator.clipboard.writeText(text);
    onTriggerToast(`Pesan siaran untuk "${item.nama}" berhasil disalin ke clipboard!`, 'success');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
      
      {/* View Header with Megaphone Shield */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full pointer-events-none" />
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-inner shrink-0">
            <Megaphone className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
              Menu Komunikasi & Siaran
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1.5">
              Siaran Pengumuman Warga
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Sampaikan pengumuman, undangan, atau tagihan iuran bulanan ke seluruh warga via WhatsApp kustom dengan cepat.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 shrink-0">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan Data</span>
          </button>
          
          <button
            type="button"
            onClick={resetSentStatus}
            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 cursor-pointer transition-all flex items-center gap-1"
          >
            <span>Reset Status Antrean</span>
          </button>
        </div>
      </div>

      {/* Target Audience Toggle & Metrik */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* audience selector card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-600" />
            <span>1. Tentukan Penerima Siaran (Target Audience)</span>
          </h3>

          <div className="grid grid-cols-2 gap-3.5">
            <button
              type="button"
              onClick={() => {
                setTargetType('akun');
                setHighlightedIndex(null);
              }}
              className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-300 ${
                targetType === 'akun'
                  ? 'border-blue-500 bg-gradient-to-br from-blue-50/60 to-indigo-50/60 shadow-md shadow-blue-500/5 ring-1 ring-blue-500/30'
                  : 'border-slate-200 hover:bg-slate-50/80 text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold flex items-center gap-2 ${targetType === 'akun' ? 'text-blue-900 font-extrabold' : 'text-slate-800'}`}>
                  <UserCheck className={`w-4 h-4 transition-transform ${targetType === 'akun' ? 'text-blue-600 scale-110' : 'text-slate-400'}`} />
                  <span>Akun Warga Terdaftar</span>
                </span>
                {targetType === 'akun' && (
                  <span className="p-1 rounded-full bg-blue-100 text-blue-700">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-slate-500 mt-2 leading-relaxed">
                Hanya warga atau pengurus yang sudah **membuat akun** terdaftar di tabel `pengguna`.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setTargetType('warga');
                setHighlightedIndex(null);
              }}
              className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-300 ${
                targetType === 'warga'
                  ? 'border-emerald-500 bg-gradient-to-br from-emerald-50/60 to-teal-50/40 shadow-md shadow-emerald-500/5 ring-1 ring-emerald-500/30'
                  : 'border-slate-200 hover:bg-slate-50/80 text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold flex items-center gap-2 ${targetType === 'warga' ? 'text-emerald-900 font-extrabold' : 'text-slate-800'}`}>
                  <Users className={`w-4 h-4 transition-transform ${targetType === 'warga' ? 'text-emerald-600 scale-110' : 'text-slate-400'}`} />
                  <span>Buku Data Warga (Semua)</span>
                </span>
                {targetType === 'warga' && (
                  <span className="p-1 rounded-full bg-emerald-100 text-emerald-700">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-slate-500 mt-2 leading-relaxed">
                Menghubungi **seluruh warga** yang tercatat di Buku Data Warga RT (baik punya akun maupun belum).
              </p>
            </button>
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari penerima berdasarkan nama, No. KK atau No. HP..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl border border-slate-200 shrink-0"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* stats card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-3.5">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-slate-600" />
            <span>Kondisi Kontak Terfilter</span>
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-blue-700 block">Ada No. HP WA</span>
              <span className="text-xl font-black text-blue-900 block mt-1">{validRecipients.length}</span>
              <span className="text-[10px] text-blue-600 block mt-0.5">Siap Dikirim</span>
            </div>

            <div className={`p-3 rounded-xl border ${
              invalidRecipients.length > 0 ? 'bg-amber-50 border-amber-200/60' : 'bg-slate-50 border-slate-200/60'
            }`}>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">No. HP Kosong</span>
              <span className={`text-xl font-black block mt-1 ${
                invalidRecipients.length > 0 ? 'text-amber-700' : 'text-slate-700'
              }`}>{invalidRecipients.length}</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Perlu Diperbarui</span>
            </div>
          </div>

          {/* Action Bulk utilities */}
          <div className="pt-1 flex flex-col gap-2">
            <button
              type="button"
              onClick={copyAllPhones}
              disabled={validRecipients.length === 0}
              className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 font-bold text-xs rounded-xl border border-slate-200 transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Salin Semua Nomor (Format Koma)</span>
            </button>

            <button
              type="button"
              onClick={exportToGoogleContactsCSV}
              disabled={validRecipients.length === 0}
              className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 font-bold text-xs rounded-xl border border-slate-200 transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Ekspor Kontak untuk Android / Google (.csv)</span>
            </button>
          </div>
        </div>

      </div>

      {/* Message Template Draft Composer */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-slate-600" />
            <span>2. Tulis & Kustomisasi Isi Pengumuman</span>
          </h3>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500 font-semibold mr-1">Preset Template:</span>
            <button
              type="button"
              onClick={() => applyTemplate('umum')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                selectedTemplate === 'umum' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              Umum
            </button>
            <button
              type="button"
              onClick={() => applyTemplate('iuran')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                selectedTemplate === 'iuran' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              Iuran Bulanan
            </button>
            <button
              type="button"
              onClick={() => applyTemplate('rapat')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                selectedTemplate === 'rapat' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              Undangan Rapat
            </button>
            <button
              type="button"
              onClick={() => applyTemplate('kas')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                selectedTemplate === 'kas' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              Laporan Kas RT
            </button>
          </div>
        </div>

        {/* Text Area Template Composer */}
        <div className="space-y-2">
          <textarea
            value={messageTemplate}
            onChange={(e) => {
              setMessageTemplate(e.target.value);
              setSelectedTemplate('kustom');
            }}
            placeholder="Tulis draf pesan di sini..."
            rows={5}
            className="w-full p-4 border border-slate-300 rounded-xl text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-2xs font-sans leading-relaxed"
          />

          {/* Tokens shortcut banner */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-[11px] text-slate-600">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-slate-700">Kode Dinamis (Klik untuk menyisipkan):</span>
              <button
                type="button"
                onClick={() => {
                  setMessageTemplate(prev => prev + ' {nama}');
                  setSelectedTemplate('kustom');
                }}
                className="px-2 py-0.5 bg-white border border-slate-200 rounded-md font-mono font-bold text-blue-600 hover:bg-blue-50 cursor-pointer"
                title="Akan digantikan oleh Nama Lengkap Warga secara otomatis"
              >
                {'{nama}'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMessageTemplate(prev => prev + ' {wilayah}');
                  setSelectedTemplate('kustom');
                }}
                className="px-2 py-0.5 bg-white border border-slate-200 rounded-md font-mono font-bold text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                title="Akan digantikan oleh RT.002 RW.09"
              >
                {'{wilayah}'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMessageTemplate(prev => prev + ' {saldo}');
                  setSelectedTemplate('kustom');
                }}
                className="px-2 py-0.5 bg-white border border-slate-200 rounded-md font-mono font-bold text-purple-600 hover:bg-purple-50 cursor-pointer"
                title="Akan digantikan oleh nominal Saldo Kas RT saat ini"
              >
                {'{saldo}'}
              </button>
            </div>
            
            <div className="font-mono text-slate-400 text-[10px]">
              Panjang: <strong className="text-slate-600">{messageTemplate.length}</strong> karakter
            </div>
          </div>
        </div>
      </div>

      {/* Main Send Queue Area */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        
        {/* Toolbar Header of Send queue */}
        <div className="p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-600" />
              <span>3. Antrean Pengiriman Siaran Warga ({validRecipients.length} Orang)</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Pilih warga di bawah untuk mengirimkan pesan WhatsApp yang sudah ter-kustomisasi secara personal.
            </p>
          </div>

          {/* Auto progression switch */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs shrink-0 self-start sm:self-auto">
            <span className="text-[11px] font-bold text-slate-700">Fokus Antrean Otomatis</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={autoNext} 
                onChange={(e) => setAutoNext(e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Empty warning list or main table queue */}
        {validRecipients.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">Penerima Siaran Kosong</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {searchQuery ? `Tidak ada warga terfilter yang cocok dengan "${searchQuery}".` : 'Daftar warga kosong atau tidak ada warga terdaftar yang memiliki No. HP aktif.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Nama Lengkap</th>
                  <th className="py-3 px-4">No. HP WA</th>
                  <th className="py-3 px-4">Sumber / Posisi</th>
                  <th className="py-3 px-4 max-w-xs truncate">Preview Pesan Ter-Kustom</th>
                  <th className="py-3 px-4 text-center w-24">Status</th>
                  <th className="py-3 px-4 text-right w-52">Aksi Kirim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {validRecipients.map((item, index) => {
                  const isSent = !!sentMap[item.id];
                  const isHighlighted = highlightedIndex === index;

                  return (
                    <tr 
                      key={item.id}
                      id={`recipient-row-${index}`}
                      className={`transition-colors ${
                        isHighlighted 
                          ? 'bg-blue-50/80 ring-2 ring-blue-500 ring-inset border-y-blue-200' 
                          : isSent 
                          ? 'bg-slate-50/40 text-slate-500' 
                          : 'hover:bg-slate-50/50'
                      }`}
                    >
                      <td className="py-3 px-4 text-center font-bold text-slate-400 font-mono">
                        {index + 1}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {item.nama}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium">
                        +{item.noHp}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800">{item.roleOrStatus}</span>
                          <span className="text-[9.5px] text-slate-400 font-medium">{item.source}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate" title={generateMessage(item.nama)}>
                        <span className="text-slate-600 italic">
                          "{generateMessage(item.nama)}"
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isSent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>Terkirim</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <span>Menunggu</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Copy message button */}
                          <button
                            type="button"
                            onClick={() => handleCopySingleMessage(item)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-950 rounded-lg border border-slate-200 cursor-pointer transition-colors"
                            title="Salin isi pesan kustom warga ini ke clipboard"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Send via WA Button */}
                          <button
                            type="button"
                            onClick={() => handleLaunchWhatsApp(item, index)}
                            className={`px-3 py-1.5 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                              isSent 
                                ? 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800' 
                                : 'bg-emerald-600 hover:bg-emerald-500 hover:shadow-sm text-white shadow-xs active:scale-98'
                            }`}
                            title={`Kirim pengumuman personal via WhatsApp ke ${item.nama}`}
                          >
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            <span>{isSent ? 'Kirim Ulang' : 'Kirim WA'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Warning/Instruction block for Citizens without Phone numbers */}
      {invalidRecipients.length > 0 && (
        <div className="bg-amber-50/70 border-2 border-amber-300/70 rounded-2xl p-5 space-y-3">
          <div className="flex items-start gap-3 text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-950">
                Pemberitahuan: Terdapat {invalidRecipients.length} Warga Terdaftar Tanpa Nomor HP Aktif
              </h4>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                Warga-warga berikut tidak masuk ke antrean siaran karena tidak memiliki nomor telepon atau nomor yang disimpan kurang dari 10 digit. Anda disarankan menghubungi mereka atau memutakhirkan nomor HP mereka di Buku Data Warga.
              </p>
            </div>
          </div>

          <div className="max-h-36 overflow-y-auto bg-white border border-amber-200 rounded-xl divide-y divide-slate-100 p-2 text-xs">
            {invalidRecipients.map((item, index) => (
              <div key={item.id} className="py-1.5 px-2 flex items-center justify-between gap-2.5">
                <span className="font-bold text-slate-800">{index + 1}. {item.nama}</span>
                <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  {item.source} • {item.roleOrStatus}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
