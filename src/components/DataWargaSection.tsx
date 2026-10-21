import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Pencil, 
  Trash2, 
  RefreshCw, 
  AlertCircle, 
  Loader2, 
  Phone, 
  CheckCircle, 
  Home, 
  UserCheck, 
  UserPlus
} from 'lucide-react';
import { getSupabase, syncWargaDeleteToPengguna } from '../lib/supabase';
import { SupabaseConnectionStatus } from '../types';
import { TambahWargaModal } from './TambahWargaModal';
import { useSekretariat } from '../context/SekretariatContext';

interface DataWargaSectionProps {
  connectionStatus?: SupabaseConnectionStatus;
  onTriggerToast: (msg: string, type?: 'success' | 'error' | 'info', title?: string) => void;
  onDataChanged?: () => void;
}

export const DataWargaSection: React.FC<DataWargaSectionProps> = ({
  connectionStatus = 'connected',
  onTriggerToast,
  onDataChanged
}) => {
  const { wilayahShort } = useSekretariat();
  
  // State Data Warga
  const [dataWarga, setDataWarga] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Warga Tetap' | 'Kontrak / Kos'>('All');
  
  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [wargaToEdit, setWargaToEdit] = useState<any | null>(null);
  const [wargaToDelete, setWargaToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load Data Warga dari Supabase
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
        if (onDataChanged) {
          onDataChanged();
        }
      }
    } catch (err: any) {
      onTriggerToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (connectionStatus === 'connected') {
      loadDataWarga();
    }
  }, [connectionStatus]);

  // Handle Delete Data Warga
  const handleDelete = async () => {
    if (!wargaToDelete) return;
    setIsDeleting(true);
    
    const client = getSupabase();
    if (!client) {
      setIsDeleting(false);
      return;
    }

    try {
      const { error } = await client
        .from('data_warga')
        .delete()
        .eq('id', wargaToDelete.id);

      if (error) throw error;
      
      // Sinkronisasi otomatis: hapus akun di tabel pengguna yang berelasi dengan data warga ini
      await syncWargaDeleteToPengguna(wargaToDelete);

      // Update local storage cache
      try {
        const localW = localStorage.getItem('kas_rt_data_warga');
        if (localW) {
          const parsed = JSON.parse(localW);
          const filtered = parsed.filter((w: any) => w.id !== wargaToDelete.id && w.nik !== wargaToDelete.nik);
          localStorage.setItem('kas_rt_data_warga', JSON.stringify(filtered));
        }
      } catch {}

      onTriggerToast(`Data warga ${wargaToDelete.nama_lengkap} beserta akun pengguna terkait berhasil dihapus.`, 'success', 'Berhasil Dihapus');
      setWargaToDelete(null);
      loadDataWarga();
    } catch (err: any) {
      onTriggerToast(err.message, 'error', 'Gagal Menghapus');
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper kriteria status_warga
  const isTetap = (w: any) => !w.status_warga || w.status_warga === 'Warga Tetap';
  const isKontrak = (w: any) => Boolean(
    w.status_warga && (
      w.status_warga.toLowerCase().includes('kontrak') || 
      w.status_warga.toLowerCase().includes('kos')
    )
  );

  // Filter logic
  const filteredWarga = dataWarga.filter(w => {
    const q = searchTerm.toLowerCase();
    const matchSearch = 
      (w.nama_lengkap || '').toLowerCase().includes(q) ||
      (w.nik || '').includes(q) ||
      (w.no_kk || '').includes(q) ||
      (w.alamat_domisili || '').toLowerCase().includes(q) ||
      (w.no_hp || '').includes(q);

    const matchStatus = 
      statusFilter === 'All' ? true :
      statusFilter === 'Warga Tetap' ? isTetap(w) :
      isKontrak(w);

    return matchSearch && matchStatus;
  });

  // Statistik ringkas
  const totalJiwa = dataWarga.length;
  const totalTetap = dataWarga.filter(isTetap).length;
  const totalKontrak = dataWarga.filter(isKontrak).length;
  const totalPunyaHp = dataWarga.filter(w => Boolean(w.no_hp && w.no_hp.trim() !== '' && w.no_hp.trim() !== '-')).length;

  return (
    <div className="space-y-6">
      {/* 1. Metric Cards Statistik Penduduk */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Total Warga</div>
            <div className="text-xl sm:text-2xl font-black text-slate-800 mt-0.5">{totalJiwa} <span className="text-xs font-normal text-slate-400">Jiwa</span></div>
          </div>
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[10px] sm:text-xs font-bold text-emerald-600 uppercase tracking-wider">Warga Tetap</div>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-0.5">{totalTetap} <span className="text-xs font-normal text-emerald-500">Jiwa</span></div>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Home className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[10px] sm:text-xs font-bold text-blue-600 uppercase tracking-wider">Kontrak / Kos</div>
            <div className="text-xl sm:text-2xl font-black text-blue-700 mt-0.5">{totalKontrak} <span className="text-xs font-normal text-blue-500">Jiwa</span></div>
          </div>
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[10px] sm:text-xs font-bold text-amber-600 uppercase tracking-wider">Terhubung No. HP</div>
            <div className="text-xl sm:text-2xl font-black text-amber-700 mt-0.5">{totalPunyaHp} <span className="text-xs font-normal text-amber-500">No. WA</span></div>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
            <Phone className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. Search, Filter & Action Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 w-full">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama warga, NIK, No. KK, atau domisili..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
            />
          </div>

          <div className="hidden md:flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setStatusFilter('All')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'All' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Semua ({totalJiwa})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('Warga Tetap')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'Warga Tetap' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-500 hover:text-emerald-700'
              }`}
            >
              Tetap ({totalTetap})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('Kontrak / Kos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'Kontrak / Kos' ? 'bg-white text-blue-800 shadow-xs' : 'text-slate-500 hover:text-blue-700'
              }`}
            >
              Kontrak ({totalKontrak})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={loadDataWarga}
            disabled={isLoading || connectionStatus !== 'connected'}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-indigo-600 rounded-xl transition-all shadow-2xs flex items-center justify-center disabled:opacity-50 cursor-pointer"
            title="Segarkan Data Warga"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
          
          <button
            type="button"
            onClick={() => {
              setWargaToEdit(null);
              setIsAddModalOpen(true);
            }}
            disabled={connectionStatus !== 'connected'}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm shadow-indigo-600/20 hover:shadow-md cursor-pointer active:scale-98 disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Warga</span>
          </button>
        </div>
      </div>

      {/* 3. Main Data Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
            <p className="text-sm font-medium">Memuat data warga dari database...</p>
          </div>
        ) : filteredWarga.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                  <th className="p-3.5 w-12 text-center">No</th>
                  <th className="p-3.5">Nama Lengkap</th>
                  <th className="p-3.5">NIK / No. KK</th>
                  <th className="p-3.5">Alamat Domisili</th>
                  <th className="p-3.5">Status & Kontak</th>
                  <th className="p-3.5 text-center w-24">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {filteredWarga.map((w, idx) => (
                  <tr key={w.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="p-3.5 text-center font-mono text-xs text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{w.nama_lengkap}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span className="font-medium text-slate-600">{w.jenis_kelamin === 'Laki-laki' ? 'Laki-laki' : 'Perempuan'}</span>
                        <span>•</span>
                        <span>{w.pekerjaan || 'Pekerjaan: -'}</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-mono text-xs font-semibold text-slate-700">{w.nik}</div>
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5">KK: {w.no_kk}</div>
                    </td>
                    <td className="p-3.5 text-xs font-medium text-slate-600">
                      {w.alamat_domisili || `${wilayahShort}`}
                    </td>
                    <td className="p-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isTetap(w) 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {w.status_warga || 'Warga Tetap'}
                        </span>
                        {w.no_hp && (
                          <div className="text-[11px] font-mono text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-emerald-600" />
                            {w.no_hp}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          type="button"
                          onClick={() => {
                            setWargaToEdit(w);
                            setIsAddModalOpen(true);
                          }}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-indigo-600 rounded-lg transition-all cursor-pointer border border-slate-200 hover:scale-105 active:scale-95 shadow-2xs"
                          title={`Koreksi data: ${w.nama_lengkap}`}
                          aria-label={`Edit data warga ${w.nama_lengkap}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => setWargaToDelete(w)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-lg transition-all cursor-pointer border border-rose-200 hover:border-rose-600 hover:scale-105 active:scale-95 shadow-2xs group"
                          title={`Hapus data: ${w.nama_lengkap}`}
                          aria-label={`Hapus data warga ${w.nama_lengkap}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
            <Users className="w-14 h-14 mb-3 text-slate-200" />
            <h3 className="text-base font-bold text-slate-700 mb-1">Belum Ada Data Warga</h3>
            <p className="text-xs max-w-md text-slate-500">
              Data warga belum tersedia atau tidak ditemukan dengan kata kunci pencarian. Klik tombol Tambah Warga untuk memasukkan data warga baru.
            </p>
          </div>
        )}
      </div>

      {/* Tambah/Edit Warga Modal */}
      <TambahWargaModal 
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setTimeout(() => setWargaToEdit(null), 300);
        }}
        onSuccess={loadDataWarga}
        onTriggerToast={onTriggerToast}
        editData={wargaToEdit}
      />

      {/* Konfirmasi Hapus Modal */}
      {wargaToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-6 text-center animate-in fade-in zoom-in-95 border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2 leading-snug">
              Hapus Data Warga & Akun?
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Tindakan ini akan menghapus data ini dari tabel <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-600 font-mono">data_warga</code> sekaligus otomatis <strong>menghapus akun pengguna terkait</strong> di tabel <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono">pengguna</code>.
            </p>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-left text-xs space-y-1 mb-5">
              <div className="flex justify-between items-center font-semibold text-slate-900">
                <span>{wargaToDelete.nama_lengkap}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-medium">
                  {wargaToDelete.status_warga || 'Warga'}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 font-mono">
                NIK: {wargaToDelete.nik}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                Domisili: {wargaToDelete.alamat_domisili}
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button 
                type="button"
                disabled={isDeleting}
                onClick={() => setWargaToDelete(null)}
                className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button 
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs hover:shadow-rose-200 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
