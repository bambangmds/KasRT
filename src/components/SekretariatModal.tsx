import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Loader2,
  Trash2,
  AlertTriangle,
  Info,
  Building2,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { useSekretariat } from '../context/SekretariatContext';

interface SekretariatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerToast: (msg: string, type?: 'success' | 'error' | 'info', title?: string) => void;
  initialMode?: 'edit' | 'delete';
}

export const SekretariatModal: React.FC<SekretariatModalProps> = ({
  isOpen,
  onClose,
  onTriggerToast,
  initialMode = 'edit',
}) => {
  const { sekretariat, updateSekretariat, deleteSekretariat, fromSupabase, reloadSekretariat } = useSekretariat();

  const [formData, setFormData] = useState({
    rt: sekretariat.rt || '',
    rw: sekretariat.rw || '',
    kelurahan: sekretariat.kelurahan || '',
    alamat: sekretariat.alamat || '',
    kecamatan: sekretariat.kecamatan || '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        rt: sekretariat.rt || '',
        rw: sekretariat.rw || '',
        kelurahan: sekretariat.kelurahan || '',
        alamat: sekretariat.alamat || '',
        kecamatan: sekretariat.kecamatan || '',
      });
      setErrorMessage(null);
      setShowDeleteConfirm(initialMode === 'delete');
    }
  }, [isOpen, sekretariat, initialMode]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 1. Eksekusi Koreksi / Pembaruan Data
  const handleKoreksiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.rt.trim() || !formData.rw.trim()) {
      setErrorMessage('Nomor RT dan RW wajib diisi.');
      return;
    }

    if (!formData.kelurahan.trim()) {
      setErrorMessage('Nama Kelurahan / Desa wajib diisi.');
      return;
    }

    if (!formData.alamat.trim()) {
      setErrorMessage('Alamat lengkap sekretariat wajib diisi.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateSekretariat(formData);
      if (res.success) {
        onTriggerToast(
          `Koreksi data Sekretariat RT.${formData.rt} RW.${formData.rw} (${formData.kelurahan}) berhasil disimpan ke tabel database!`,
          'success',
          'Data Berhasil Dikoreksi'
        );
        onClose();
      } else {
        setErrorMessage(res.error || 'Gagal menyimpan koreksi data.');
        onTriggerToast(res.error || 'Gagal menyimpan ke Supabase', 'error', 'Koreksi Gagal');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSaving(false);
    }
  };

  // 2. Eksekusi Hapus Data Sekretariat
  const handleDeleteSubmit = async () => {
    setErrorMessage(null);
    setIsDeleting(true);
    try {
      const res = await deleteSekretariat();
      if (res.success) {
        onTriggerToast(
          'Data tabel Sekretariat berhasil dihapus. Sistem dialihkan ke halaman Inisialisasi Data Wilayah.',
          'info',
          'Data Sekretariat Dihapus'
        );
        onClose();
      } else {
        setErrorMessage(res.error || 'Gagal menghapus data dari tabel sekretariat.');
        onTriggerToast(res.error || 'Gagal menghapus data dari Supabase', 'error', 'Gagal Hapus');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat menghapus data.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden my-6 transition-all transform animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4.5 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              showDeleteConfirm 
                ? 'bg-rose-500/20 border border-rose-400/30 text-rose-400' 
                : 'bg-teal-500/20 border border-teal-400/30 text-teal-400'
            }`}>
              {showDeleteConfirm ? <Trash2 className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-tight text-white">
                  {showDeleteConfirm ? 'Hapus Data Tabel Sekretariat' : 'Koreksi Data Sekretariat & Wilayah'}
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  showDeleteConfirm 
                    ? 'bg-rose-500/20 text-rose-300 border-rose-400/30' 
                    : 'bg-teal-500/20 text-teal-300 border-teal-400/30'
                }`}>
                  Tabel sekretariat
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {showDeleteConfirm 
                  ? 'Konfirmasi pengosongan data identitas RT/RW di database' 
                  : 'Ubah dan perbarui informasi RT, RW, Kelurahan, dan Alamat'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="Tutup dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TAB / MODE SWITCHER (Bila ada data tersimpan) */}
        {!showDeleteConfirm ? (
          /* FORM KOREKSI DATA */
          <form onSubmit={handleKoreksiSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {errorMessage && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Info Status Koreksi */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                Perubahan data pada formulir ini langsung memperbarui tabel <code className="px-1.5 py-0.5 bg-slate-200 text-slate-800 rounded font-mono text-[11px]">sekretariat</code> di database Supabase dan secara otomatis menyinkronkan seluruh kop surat, nama dokumen, dan tanda tangan laporan.
              </div>
            </div>

            {/* Preview Live Kop */}
            <div className="bg-slate-900 text-white rounded-xl p-3.5 border border-slate-800 text-xs">
              <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider block mb-1">
                Pratinjau Kop Resmi Dokumen:
              </span>
              <div className="text-center bg-slate-800/80 rounded-lg p-3 border border-slate-700/60 font-serif">
                <p className="font-bold text-xs uppercase tracking-wide text-white">
                  PENGURUS RUKUN TETANGGA {formData.rt || '...'} RUKUN WARGA {formData.rw || '...'}
                </p>
                <p className="font-semibold text-[11px] uppercase text-slate-200">
                  KELURAHAN {(formData.kelurahan || '...').toUpperCase()}
                  {formData.kecamatan ? `, KECAMATAN ${formData.kecamatan.toUpperCase()}` : ''}
                </p>
                <p className="text-[10px] italic text-slate-400 mt-0.5 truncate">
                  Alamat: {formData.alamat || 'Belum diatur'}
                </p>
              </div>
            </div>

            {/* Grid RT & RW */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nomor RT <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  name="rt"
                  value={formData.rt}
                  onChange={handleChange}
                  placeholder="Contoh: 01"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Format: 01, 001, dll</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nomor RW <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  name="rw"
                  value={formData.rw}
                  onChange={handleChange}
                  placeholder="Contoh: 05"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:bg-white"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Format: 05, 005, dll</span>
              </div>
            </div>

            {/* Kelurahan & Kecamatan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kelurahan / Desa <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  name="kelurahan"
                  value={formData.kelurahan}
                  onChange={handleChange}
                  placeholder="Nama Kelurahan / Desa"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kecamatan
                </label>
                <input
                  type="text"
                  name="kecamatan"
                  value={formData.kecamatan}
                  onChange={handleChange}
                  placeholder="Nama Kecamatan"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Alamat Lengkap */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Alamat Lengkap Sekretariat <span className="text-rose-600">*</span>
              </label>
              <textarea
                name="alamat"
                value={formData.alamat}
                onChange={handleChange}
                rows={3}
                placeholder="Contoh: Jl. Mawar No. 10, Pos Keamanan RT"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:bg-white"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Digunakan pada kop surat cetak, dokumen ekspor PDF/Excel, dan arsip resmi.
              </span>
            </div>

            {/* Footer Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
              {/* Tombol Hapus Tabel Sekretariat */}
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSaving}
                className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 hover:text-rose-800 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                title="Hapus / Kosongkan data tabel sekretariat"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Hapus Data Sekretariat</span>
              </button>

              <div className="w-full sm:w-auto flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-60"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-teal-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan Koreksi...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Simpan Koreksi Data</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* TAMPILAN KONFIRMASI HAPUS TABEL SEKRETARIAT */
          <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {errorMessage && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Warning Banner */}
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                <span>Peringatan Penghapusan Data Sekretariat</span>
              </div>
              <p className="text-xs text-rose-700 leading-relaxed">
                Tindakan ini akan <strong>menghapus/mengosongkan</strong> data wilayah dari tabel <code className="px-1.5 py-0.5 bg-rose-100 text-rose-900 rounded font-mono font-bold">sekretariat</code> di database Supabase dan memori lokal.
              </p>
              <p className="text-xs text-rose-700 leading-relaxed font-semibold">
                Setelah data dihapus, aplikasi akan secara otomatis dialihkan ke halaman <strong>Inisialisasi Data Wilayah</strong> agar pengurus dapat mengisi data lokasi RT/RW yang baru.
              </p>
            </div>

            {/* Rincian Data yang Akan Dihapus */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Rincian Data yang Akan Dihapus:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">Nomor RT & RW</span>
                  <span className="font-bold text-slate-800">
                    RT.{sekretariat.rt || '-'} / RW.{sekretariat.rw || '-'}
                  </span>
                </div>
                <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">Kelurahan & Kecamatan</span>
                  <span className="font-bold text-slate-800 truncate block">
                    {sekretariat.kelurahan || '-'} {sekretariat.kecamatan ? `(${sekretariat.kecamatan})` : ''}
                  </span>
                </div>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs">
                <span className="text-slate-400 block text-[10px]">Alamat Lengkap</span>
                <span className="font-medium text-slate-700 leading-snug block mt-0.5">
                  {sekretariat.alamat || 'Tidak ada alamat tercatat'}
                </span>
              </div>
            </div>

            {/* Footer Aksi Hapus */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs sm:text-sm transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <ArrowLeft className="w-4 h-4 text-slate-500" />
                <span>Batal & Kembali</span>
              </button>

              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menghapus Data...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Ya, Hapus Data Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
