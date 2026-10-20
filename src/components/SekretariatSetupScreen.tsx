import React, { useState } from 'react';
import { 
  Building2, 
  MapPin, 
  Save, 
  Loader2, 
  ShieldAlert, 
  BadgeInfo, 
  UserCheck, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Sparkles, 
  Lock, 
  Mail, 
  Phone, 
  User, 
  Eye, 
  EyeOff, 
  FileText,
  Shield,
  Database
} from 'lucide-react';
import { PengurusRole, UserProfile } from '../types';
import { InitialSetupPayload } from '../lib/supabase';

interface SekretariatSetupScreenProps {
  onInitialize: (payload: InitialSetupPayload) => Promise<{ success: boolean; error: string | null; user?: UserProfile }>;
  isLoading: boolean;
  error: string | null;
}

export const SekretariatSetupScreen: React.FC<SekretariatSetupScreenProps> = ({
  onInitialize,
  isLoading,
  error: apiError,
}) => {
  // Wizard Step: 1 (Lokasi Wilayah) | 2 (Data Pengurus Inti & Akun)
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Form Step 1: Wilayah
  const [wilayahData, setWilayahData] = useState({
    rt: '',
    rw: '',
    kelurahan: '',
    kecamatan: '',
    alamat: '',
  });

  // Form Step 2: Pengurus Inti & Akun (Lengkap sama persis dengan TambahWargaModal)
  const [pengurusData, setPengurusData] = useState({
    role: 'Ketua RT' as PengurusRole,
    nama: '',
    nik: '',
    no_kk: '',
    jenis_kelamin: 'Laki-laki' as 'Laki-laki' | 'Perempuan',
    tempat_lahir: '',
    tanggal_lahir: '',
    agama: 'Islam',
    status_perkawinan: 'Kawin' as 'Belum Kawin' | 'Kawin' | 'Cerai Hidup' | 'Cerai Mati',
    status_warga: 'Warga Tetap' as 'Warga Tetap' | 'Warga Pendatang/Kontrak' | 'Warga Kos',
    pendidikan: '',
    pekerjaan: '',
    no_hp: '',
    alamat_domisili: '',
    catatan: '',
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Handle Wilayah Change
  const handleWilayahChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setWilayahData((prev) => ({ ...prev, [name]: value }));
    if (validationError) setValidationError(null);
  };

  // Handle Pengurus Change
  const handlePengurusChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPengurusData((prev) => ({ ...prev, [name]: value }));
    if (validationError) setValidationError(null);
  };

  // Validasi Langkah 1 & Pindah ke Langkah 2
  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const rt = wilayahData.rt.trim();
    const rw = wilayahData.rw.trim();
    const kelurahan = wilayahData.kelurahan.trim();
    const kecamatan = wilayahData.kecamatan.trim();
    const alamat = wilayahData.alamat.trim();

    if (!rt || !rw || !kelurahan || !kecamatan || !alamat) {
      setValidationError('Harap lengkapi semua kolom data wilayah (RT, RW, Kelurahan, Kecamatan, dan Alamat).');
      return;
    }

    // Prefill alamat domisili jika masih kosong
    if (!pengurusData.alamat_domisili) {
      setPengurusData((prev) => ({
        ...prev,
        alamat_domisili: alamat,
      }));
    }

    setCurrentStep(2);
  };

  // Submit Final (Langkah 1 + Langkah 2)
  const handleSubmitFinal = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const nama = pengurusData.nama.trim();
    const nik = pengurusData.nik.trim();
    const no_kk = pengurusData.no_kk.trim();
    const no_hp = pengurusData.no_hp.trim();
    const email = pengurusData.email.trim();
    const password = pengurusData.password;
    const alamat_domisili = pengurusData.alamat_domisili.trim() || wilayahData.alamat.trim();

    if (!nama) {
      setValidationError('Nama lengkap pengurus inti wajib diisi sesuai KTP.');
      return;
    }

    // Generate 16 digit unique number jika NIK / KK dikosongkan
    const generate16Digit = () => {
      let result = '';
      for (let i = 0; i < 16; i++) {
        result += Math.floor(Math.random() * 10).toString();
      }
      return result;
    };

    let nikClean = nik.replace(/\D/g, '');
    if (!nikClean) {
      nikClean = generate16Digit();
    } else if (nikClean.length < 16) {
      while (nikClean.length < 16) {
        nikClean += Math.floor(Math.random() * 10).toString();
      }
    }

    let kkClean = no_kk.replace(/\D/g, '');
    if (!kkClean) {
      kkClean = generate16Digit();
    } else if (kkClean.length < 16) {
      while (kkClean.length < 16) {
        kkClean += Math.floor(Math.random() * 10).toString();
      }
    }

    const hpClean = no_hp.replace(/\D/g, '');
    if (hpClean.length < 9) {
      setValidationError('Nomor WhatsApp / HP tidak valid (minimal 9-14 digit angka).');
      return;
    }

    if (!email || !email.includes('@')) {
      setValidationError('Harap masukkan alamat email yang valid untuk login akun.');
      return;
    }

    if (password.length < 6) {
      setValidationError('Kata sandi harus terdiri dari minimal 6 karakter.');
      return;
    }

    const payload: InitialSetupPayload = {
      sekretariat: {
        rt: wilayahData.rt.trim(),
        rw: wilayahData.rw.trim(),
        kelurahan: wilayahData.kelurahan.trim(),
        kecamatan: wilayahData.kecamatan.trim(),
        alamat: wilayahData.alamat.trim(),
      },
      pengurusInti: {
        role: pengurusData.role,
        nama,
        nik: nikClean,
        no_kk: kkClean,
        jenis_kelamin: pengurusData.jenis_kelamin,
        tempat_lahir: pengurusData.tempat_lahir ? pengurusData.tempat_lahir.trim() : undefined,
        tanggal_lahir: pengurusData.tanggal_lahir ? pengurusData.tanggal_lahir.trim() : undefined,
        agama: pengurusData.agama,
        status_perkawinan: pengurusData.status_perkawinan,
        status_warga: pengurusData.status_warga,
        pendidikan: pengurusData.pendidikan ? pengurusData.pendidikan.trim() : undefined,
        pekerjaan: pengurusData.pekerjaan ? pengurusData.pekerjaan.trim() : undefined,
        no_hp,
        alamat_domisili,
        catatan: pengurusData.catatan ? pengurusData.catatan.trim() : undefined,
        email,
        password,
      },
    };

    await onInitialize(payload);
  };

  const wilayahIdent = wilayahData.rt && wilayahData.rw ? `RT.${wilayahData.rt} RW.${wilayahData.rw}` : 'RT';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-2xl bg-white text-slate-900 rounded-3xl border border-slate-200 shadow-2xl overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header Ribbon & Step Indicator */}
        <div className="bg-slate-900 text-white p-6 sm:p-8 border-b border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 p-0.5 shadow-lg shadow-indigo-950/50 flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Inisialisasi Sistem Baru
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Aktivasi & Master Data Wilayah
                </h1>
              </div>
            </div>

            {/* Stepper Badge */}
            <div className="flex items-center gap-2 bg-slate-800/80 px-3.5 py-1.5 rounded-full border border-slate-700/80 shrink-0 self-start sm:self-auto">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep === 1 ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'
              }`}>
                {currentStep === 1 ? '1' : <CheckCircle2 className="w-3.5 h-3.5" />}
              </div>
              <span className="text-xs font-semibold text-slate-300">
                Langkah {currentStep} dari 2
              </span>
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-2 gap-2 mt-6">
            <div className={`h-1.5 rounded-full transition-all ${
              currentStep >= 1 ? 'bg-indigo-500' : 'bg-slate-800'
            }`} />
            <div className={`h-1.5 rounded-full transition-all ${
              currentStep >= 2 ? 'bg-indigo-500' : 'bg-slate-800'
            }`} />
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8">
          {/* STEP 1: LOKASI WILAYAH */}
          {currentStep === 1 && (
            <form onSubmit={handleNextStep} className="space-y-5">
              {/* Notice Box */}
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 flex gap-3 items-start text-amber-900 shadow-2xs">
                <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                <div className="text-xs font-medium leading-relaxed">
                  <span className="font-bold">Langkah 1 (Identitas Wilayah):</span> Sistem mendeteksi tabel sekretariat masih kosong. Harap isi data wilayah RT/RW Anda sebagai identitas resmi pembukuan dan laporan keuangan kas.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nomor RT <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="rt"
                    required
                    placeholder="Contoh: 002 atau 02"
                    value={wilayahData.rt}
                    onChange={handleWilayahChange}
                    disabled={isLoading}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all bg-slate-50/50 placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nomor RW <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="rw"
                    required
                    placeholder="Contoh: 009 atau 09"
                    value={wilayahData.rw}
                    onChange={handleWilayahChange}
                    disabled={isLoading}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all bg-slate-50/50 placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Kelurahan / Desa <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="kelurahan"
                    required
                    placeholder="Contoh: Pondok Rajeg"
                    value={wilayahData.kelurahan}
                    onChange={handleWilayahChange}
                    disabled={isLoading}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all bg-slate-50/50 placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Kecamatan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="kecamatan"
                    required
                    placeholder="Contoh: Cibinong"
                    value={wilayahData.kecamatan}
                    onChange={handleWilayahChange}
                    disabled={isLoading}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all bg-slate-50/50 placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Alamat Lengkap / Kantor Sekretariat RT <span className="text-rose-500">*</span>
                </label>
                <textarea
                  name="alamat"
                  required
                  placeholder="Contoh: Jl. Raya Pondok Rajeg No. 12, Pos Keamanan & Balai Warga RT.002"
                  value={wilayahData.alamat}
                  onChange={handleWilayahChange}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all bg-slate-50/50 resize-y min-h-[85px] placeholder:text-slate-400"
                ></textarea>
              </div>

              {(validationError || apiError) && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium leading-relaxed flex gap-2.5 items-start animate-in fade-in">
                  <BadgeInfo className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  <div>{validationError || apiError}</div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <span>Lanjut ke Langkah 2: Data Pengurus Inti</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* STEP 2: DATA PENGURUS INTI & PEMBUATAN AKUN ADMIN */}
          {currentStep === 2 && (
            <form onSubmit={handleSubmitFinal} className="space-y-5 animate-in fade-in duration-200">
              {/* Notice Box */}
              <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200 flex gap-3 items-start text-indigo-950 shadow-2xs">
                <Shield className="w-5 h-5 shrink-0 text-indigo-600 mt-0.5" />
                <div className="text-xs font-medium leading-relaxed">
                  <span className="font-bold">Langkah 2 (Syarat Pendaftaran Akun):</span> Sesuai ketentuan aktivasi, salah satu <strong>Pengurus Inti</strong> (Ketua RT, Sekretaris, Bendahara) wajib memasukkan data kependudukan resmi untuk mendaftarkan akun <strong>Administrator</strong> perdana ({wilayahIdent}).
                </div>
              </div>

              {/* Pilihan Jabatan Pengurus Inti */}
              <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl">
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Jabatan Pengurus Inti <span className="text-rose-500">*</span>
                </label>
                <select
                  name="role"
                  value={pengurusData.role}
                  onChange={handlePengurusChange}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-indigo-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all bg-white"
                >
                  <option value="Ketua RT">Ketua RT (Administrator Utama)</option>
                  <option value="Sekretaris">Sekretaris RT (Administrator)</option>
                  <option value="Bendahara">Bendahara RT (Administrator)</option>
                  <option value="Wakil Ketua RT">Wakil Ketua RT (Administrator)</option>
                </select>
              </div>

              {/* Data Kependudukan (Sama Persis dengan Modal Kelola Data Warga) */}
              <div className="space-y-4">
                {/* Section 1: Identitas Utama */}
                <div className="bg-slate-50 border border-slate-200 p-4 sm:p-5 rounded-2xl space-y-4">
                  <h3 className="text-xs font-bold text-slate-800 border-b border-slate-200/80 pb-2 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    <span>1. Identitas Utama Kependudukan</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Nomor Induk Kependudukan (NIK) <span className="text-slate-400 font-normal text-[11px]">(Opsional / Otomatis)</span>
                      </label>
                      <input
                        type="text"
                        name="nik"
                        maxLength={16}
                        placeholder="Opsional (Otomatis jika kosong)"
                        value={pengurusData.nik}
                        onChange={handlePengurusChange}
                        disabled={isLoading}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:font-sans placeholder:text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Nomor Kartu Keluarga (KK) <span className="text-slate-400 font-normal text-[11px]">(Opsional / Otomatis)</span>
                      </label>
                      <input
                        type="text"
                        name="no_kk"
                        maxLength={16}
                        placeholder="Opsional (Otomatis jika kosong)"
                        value={pengurusData.no_kk}
                        onChange={handlePengurusChange}
                        disabled={isLoading}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:font-sans placeholder:text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Nama Lengkap (Sesuai KTP) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="nama"
                        required
                        placeholder="Nama lengkap pengurus sesuai KTP"
                        value={pengurusData.nama}
                        onChange={handlePengurusChange}
                        disabled={isLoading}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Data Demografi */}
                <div className="bg-slate-50 border border-slate-200 p-4 sm:p-5 rounded-2xl space-y-4">
                  <h3 className="text-xs font-bold text-slate-800 border-b border-slate-200/80 pb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>2. Data Demografi & Domisili</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Jenis Kelamin</label>
                      <select
                        name="jenis_kelamin"
                        value={pengurusData.jenis_kelamin}
                        onChange={handlePengurusChange}
                        disabled={isLoading}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      >
                        <option value="Laki-laki">Laki-laki</option>
                        <option value="Perempuan">Perempuan</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Agama</label>
                      <select
                        name="agama"
                        value={pengurusData.agama}
                        onChange={handlePengurusChange}
                        disabled={isLoading}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      >
                        <option value="Islam">Islam</option>
                        <option value="Kristen">Kristen</option>
                        <option value="Katolik">Katolik</option>
                        <option value="Hindu">Hindu</option>
                        <option value="Buddha">Buddha</option>
                        <option value="Konghucu">Konghucu</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Tempat Lahir</label>
                      <input
                        type="text"
                        name="tempat_lahir"
                        placeholder="Kota/Kab"
                        value={pengurusData.tempat_lahir}
                        onChange={handlePengurusChange}
                        disabled={isLoading}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Tanggal Lahir</label>
                      <input
                        type="date"
                        name="tanggal_lahir"
                        value={pengurusData.tanggal_lahir}
                        onChange={handlePengurusChange}
                        disabled={isLoading}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Status Perkawinan</label>
                      <select
                        name="status_perkawinan"
                        value={pengurusData.status_perkawinan}
                        onChange={handlePengurusChange}
                        disabled={isLoading}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      >
                        <option value="Belum Kawin">Belum Kawin</option>
                        <option value="Kawin">Kawin</option>
                        <option value="Cerai Hidup">Cerai Hidup</option>
                        <option value="Cerai Mati">Cerai Mati</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Status Warga di {wilayahIdent}</label>
                      <select
                        name="status_warga"
                        value={pengurusData.status_warga}
                        onChange={handlePengurusChange}
                        disabled={isLoading}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      >
                        <option value="Warga Tetap">Warga Tetap</option>
                        <option value="Warga Pendatang/Kontrak">Warga Pendatang / Kontrak</option>
                        <option value="Warga Kos">Warga Kos</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Pendidikan Terakhir</label>
                      <input
                        type="text"
                        name="pendidikan"
                        placeholder="Misal: SMA, S1, S2"
                        value={pengurusData.pendidikan}
                        onChange={handlePengurusChange}
                        disabled={isLoading}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Pekerjaan</label>
                      <input
                        type="text"
                        name="pekerjaan"
                        placeholder="Misal: Karyawan Swasta, PNS, Wiraswasta"
                        value={pengurusData.pekerjaan}
                        onChange={handlePengurusChange}
                        disabled={isLoading}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">No. WhatsApp / HP</label>
                      <input
                        type="tel"
                        name="no_hp"
                        placeholder="08..."
                        value={pengurusData.no_hp}
                        onChange={handlePengurusChange}
                        disabled={isLoading}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Alamat / Blok Rumah <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="alamat_domisili"
                        required
                        placeholder="Misal: Blok A No. 12"
                        value={pengurusData.alamat_domisili}
                        onChange={handlePengurusChange}
                        disabled={isLoading}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Catatan Tambahan */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Catatan Tambahan (Opsional)</label>
                    <textarea
                      name="catatan"
                      rows={2}
                      placeholder="Keterangan tambahan jika diperlukan..."
                      value={pengurusData.catatan}
                      onChange={handlePengurusChange}
                      disabled={isLoading}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-y"
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* Data Akun Login Administrator */}
              <div className="space-y-4 pt-2 border-t border-slate-200">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 pb-1">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  <span>3. Kredensial Login Administrator (Tabel Pengguna)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Alamat Email Pengurus <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        name="email"
                        required
                        placeholder="email.pengurus@gmail.com"
                        value={pengurusData.email}
                        onChange={handlePengurusChange}
                        disabled={isLoading}
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all bg-slate-50/50"
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Kata Sandi Login <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        required
                        placeholder="Minimal 6 karakter"
                        value={pengurusData.password}
                        onChange={handlePengurusChange}
                        disabled={isLoading}
                        className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all bg-slate-50/50"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {(validationError || apiError) && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium leading-relaxed flex gap-2.5 items-start animate-in fade-in">
                  <BadgeInfo className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  <div>{validationError || apiError}</div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentStep(1);
                    setValidationError(null);
                  }}
                  disabled={isLoading}
                  className="w-full sm:w-auto px-5 h-12 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-200"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali ke Wilayah</span>
                </button>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full sm:flex-1 h-12 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan & Mengaktifkan Sistem...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Simpan Wilayah & Aktifkan Akun Admin</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-6 text-center text-xs text-slate-400 flex items-center gap-2">
        <Shield className="w-3.5 h-3.5 text-indigo-400" />
        <span>Sistem Pembukuan Digital Kas {wilayahIdent} &bull; Terproteksi Database Supabase</span>
      </div>
    </div>
  );
};
