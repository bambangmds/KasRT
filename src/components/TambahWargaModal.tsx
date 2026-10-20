import React, { useState, useEffect } from 'react';
import { X, Check, Loader2, UserPlus, AlertCircle, Pencil } from 'lucide-react';
import { getSupabase, syncWargaUpdateToPengguna } from '../lib/supabase';
import { useSekretariat } from '../context/SekretariatContext';

interface TambahWargaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onTriggerToast: (msg: string, type?: 'success' | 'error' | 'info', title?: string) => void;
  editData?: any | null; // Data warga untuk mode koreksi/edit
}

export const TambahWargaModal: React.FC<TambahWargaModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onTriggerToast,
  editData,
}) => {
  const { sekretariat } = useSekretariat();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    no_kk: '',
    nik: '',
    nama_lengkap: '',
    jenis_kelamin: 'Laki-laki',
    tempat_lahir: '',
    tanggal_lahir: '',
    agama: 'Islam',
    pendidikan: '',
    pekerjaan: '',
    status_perkawinan: 'Belum Kawin',
    alamat_domisili: '',
    no_hp: '',
    status_warga: 'Warga Tetap',
    catatan: ''
  });

  useEffect(() => {
    if (isOpen && editData) {
      setFormData({
        no_kk: editData.no_kk || '',
        nik: editData.nik || '',
        nama_lengkap: editData.nama_lengkap || '',
        jenis_kelamin: editData.jenis_kelamin || 'Laki-laki',
        tempat_lahir: editData.tempat_lahir || '',
        tanggal_lahir: editData.tanggal_lahir || '',
        agama: editData.agama || 'Islam',
        pendidikan: editData.pendidikan || '',
        pekerjaan: editData.pekerjaan || '',
        status_perkawinan: editData.status_perkawinan || 'Belum Kawin',
        alamat_domisili: editData.alamat_domisili || '',
        no_hp: editData.no_hp || '',
        status_warga: editData.status_warga || 'Warga Tetap',
        catatan: editData.catatan || ''
      });
    } else if (isOpen && !editData) {
      setFormData({
        no_kk: '', nik: '', nama_lengkap: '', jenis_kelamin: 'Laki-laki', 
        tempat_lahir: '', tanggal_lahir: '', agama: 'Islam', pendidikan: '', 
        pekerjaan: '', status_perkawinan: 'Belum Kawin', alamat_domisili: '', 
        no_hp: '', status_warga: 'Warga Tetap', catatan: ''
      });
    }
  }, [isOpen, editData]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validasi basic
    if (formData.nik && formData.nik.length > 0 && formData.nik.length < 16) {
      setErrorMsg('Jika NIK diisi, harus berjumlah 16 angka.');
      return;
    }
    if (formData.no_kk && formData.no_kk.length > 0 && formData.no_kk.length < 16) {
      setErrorMsg('Jika No. KK diisi, harus berjumlah 16 angka.');
      return;
    }
    if (!formData.nama_lengkap) {
      setErrorMsg('Nama Lengkap wajib diisi.');
      return;
    }
    if (!formData.alamat_domisili) {
      setErrorMsg('Alamat Domisili wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    const client = getSupabase();
    if (!client) {
      setErrorMsg('Koneksi database tidak tersedia. Mode offline.');
      setIsSubmitting(false);
      return;
    }

    try {
      const generate16Digit = () => {
        let result = '';
        for (let i = 0; i < 16; i++) {
          result += Math.floor(Math.random() * 10).toString();
        }
        return result;
      };

      const payload = {
        ...formData,
        nik: formData.nik || generate16Digit(),
        no_kk: formData.no_kk || generate16Digit(),
        tanggal_lahir: formData.tanggal_lahir || null // Handle empty date
      };

      let dbError;

      if (editData) {
        // Mode Edit
        const { error } = await client
          .from('data_warga')
          .update(payload)
          .eq('id', editData.id);
        dbError = error;

        if (!error) {
          // Sinkronisasi otomatis ke tabel pengguna jika data warga memiliki akun terhubung
          await syncWargaUpdateToPengguna(editData, payload);
        }
      } else {
        // Mode Tambah
        const { error } = await client
          .from('data_warga')
          .insert([payload]);
        dbError = error;
      }

      if (dbError) {
        if (dbError.code === '23505' && dbError.message.includes('nik')) {
          setErrorMsg(`Gagal menyimpan: NIK ${formData.nik} sudah terdaftar di sistem.`);
        } else {
          setErrorMsg(dbError.message);
        }
        setIsSubmitting(false);
        return;
      }

      if (editData) {
        onTriggerToast(`Data warga ${formData.nama_lengkap} berhasil diperbarui!`, 'success', 'Koreksi Berhasil');
      } else {
        onTriggerToast(`Data warga ${formData.nama_lengkap} berhasil ditambahkan!`, 'success', 'Berhasil Disimpan');
      }
      
      // Reset form
      setFormData({
        no_kk: '', nik: '', nama_lengkap: '', jenis_kelamin: 'Laki-laki', 
        tempat_lahir: '', tanggal_lahir: '', agama: 'Islam', pendidikan: '', 
        pekerjaan: '', status_perkawinan: 'Belum Kawin', alamat_domisili: '', 
        no_hp: '', status_warga: 'Warga Tetap', catatan: ''
      });
      
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm transition-opacity">
      <div 
        className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-full animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              {editData ? <Pencil className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {editData ? 'Koreksi Data Warga' : 'Tambah Data Warga'}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {editData ? 'Perbarui data demografi penduduk' : 'Masukkan data demografi penduduk baru'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body / Form */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {errorMsg && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-700">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm font-medium">{errorMsg}</div>
            </div>
          )}

          <form id="tambah-warga-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Section 1: Identitas Utama */}
            <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">Identitas Utama</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Nomor Induk Kependudukan (NIK)</label>
                  <input type="text" name="nik" value={formData.nik} onChange={handleChange} maxLength={16}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono" 
                    placeholder="Opsional (Otomatis jika kosong)" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Nomor Kartu Keluarga (KK)</label>
                  <input type="text" name="no_kk" value={formData.no_kk} onChange={handleChange} maxLength={16}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono" 
                    placeholder="Opsional (Otomatis jika kosong)" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-slate-700">Nama Lengkap (Sesuai KTP) <span className="text-rose-500">*</span></label>
                  <input required type="text" name="nama_lengkap" value={formData.nama_lengkap} onChange={handleChange}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                    placeholder="Nama Lengkap" />
                </div>
              </div>
            </div>

            {/* Section 2: Data Demografi */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Jenis Kelamin</label>
                  <select name="jenis_kelamin" value={formData.jenis_kelamin} onChange={handleChange}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none">
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Tempat Lahir</label>
                    <input type="text" name="tempat_lahir" value={formData.tempat_lahir} onChange={handleChange}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="Kota/Kab" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Tanggal Lahir</label>
                    <input type="date" name="tanggal_lahir" value={formData.tanggal_lahir} onChange={handleChange}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Agama</label>
                    <select name="agama" value={formData.agama} onChange={handleChange}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none">
                      <option value="Islam">Islam</option>
                      <option value="Kristen">Kristen</option>
                      <option value="Katolik">Katolik</option>
                      <option value="Hindu">Hindu</option>
                      <option value="Buddha">Buddha</option>
                      <option value="Konghucu">Konghucu</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Status Perkawinan</label>
                    <select name="status_perkawinan" value={formData.status_perkawinan} onChange={handleChange}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none">
                      <option value="Belum Kawin">Belum Kawin</option>
                      <option value="Kawin">Kawin</option>
                      <option value="Cerai Hidup">Cerai Hidup</option>
                      <option value="Cerai Mati">Cerai Mati</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Status Warga di {sekretariat.rt ? `RT.${sekretariat.rt}` : 'Lingkungan RT'}</label>
                  <select name="status_warga" value={formData.status_warga} onChange={handleChange}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none">
                    <option value="Warga Tetap">Warga Tetap</option>
                    <option value="Warga Pendatang/Kontrak">Warga Pendatang / Kontrak</option>
                    <option value="Warga Kos">Warga Kos</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Pendidikan Terakhir</label>
                  <input type="text" name="pendidikan" value={formData.pendidikan} onChange={handleChange}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="Misal: SMA, S1, S2" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Pekerjaan</label>
                  <input type="text" name="pekerjaan" value={formData.pekerjaan} onChange={handleChange}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" placeholder="Misal: Karyawan Swasta, PNS" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">No. WhatsApp / HP</label>
                  <input type="tel" name="no_hp" value={formData.no_hp} onChange={handleChange}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono" placeholder="08..." />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Alamat / Blok Rumah <span className="text-rose-500">*</span></label>
                  <textarea required name="alamat_domisili" value={formData.alamat_domisili} onChange={handleChange}
                    rows={2}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y" 
                    placeholder="Blok A No. 12" />
                </div>
              </div>
            </div>

            {/* Section 3: Catatan */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Catatan Tambahan (Opsional)</label>
              <textarea name="catatan" value={formData.catatan} onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-y" 
                placeholder="Keterangan tambahan jika diperlukan..." />
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="p-4 md:px-6 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 rounded-b-2xl">
          <button 
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl transition-all disabled:opacity-50"
          >
            Batal
          </button>
          <button 
            type="submit"
            form="tambah-warga-form"
            disabled={isSubmitting}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 shadow-md shadow-indigo-200 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {editData ? 'Simpan Perubahan' : 'Simpan Data Warga'}
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
