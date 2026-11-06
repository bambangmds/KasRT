import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCheck,
  Users,
  Search,
  Plus,
  Pencil,
  RefreshCw,
  AlertCircle,
  Loader2,
  Phone,
  CheckCircle,
  Shield,
  ShieldCheck,
  Eye,
  EyeOff,
  Database,
  Printer,
  Copy,
  Check,
  X,
  Mail,
  Home,
  Award,
  Lock,
  KeyRound,
  ExternalLink,
  User,
  Sparkles,
} from 'lucide-react';
import {
  getSupabase,
  fetchAllPenggunaFromSupabase,
  createPenggunaInSupabase,
  updatePenggunaInSupabase,
  fetchDataWargaFromSupabase,
  PENGGUNA_SQL_SCHEMA,
} from '../lib/supabase';
import {
  SupabasePengurusRow,
  SupabaseConnectionStatus,
  DataWargaItem,
  PengurusRole,
} from '../types';
import { useSekretariat } from '../context/SekretariatContext';
import { exportDataPengurusPDF } from '../lib/exportUtils';
import { SUSUNAN_PENGURUS_RT, isWargaJabatan, sortPengurusByJabatan } from '../data/initialData';

interface DataPengurusSectionProps {
  connectionStatus?: SupabaseConnectionStatus;
  onTriggerToast: (
    msg: string,
    type?: 'success' | 'error' | 'info',
    title?: string
  ) => void;
  onDataChanged?: () => void;
}

export const DataPengurusSection: React.FC<DataPengurusSectionProps> = ({
  connectionStatus = 'connected',
  onTriggerToast,
  onDataChanged,
}) => {
  const { sekretariat, wilayahShort } = useSekretariat();

  // State List Pengurus & Warga (untuk autofill)
  const [pengurusList, setPengurusList] = useState<SupabasePengurusRow[]>([]);
  const [wargaList, setWargaList] = useState<DataWargaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<
    'All' | 'Inti' | 'Seksi' | 'Admin' | 'User'
  >('All');

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingPengurus, setEditingPengurus] =
    useState<SupabasePengurusRow | null>(null);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Form Fields State
  const [formNama, setFormNama] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formKategoriJabatan, setFormKategoriJabatan] = useState<
    'Inti' | 'Seksi' | 'Lainnya' | 'Warga'
  >('Inti');
  const [formJabatan, setFormJabatan] = useState('Ketua RT');
  const [customJabatan, setCustomJabatan] = useState('');
  const [formLevelAkses, setFormLevelAkses] = useState<'Admin' | 'User'>('Admin');
  const [formNoHp, setFormNoHp] = useState('');
  const [formAlamat, setFormAlamat] = useState('');
  const [formNik, setFormNik] = useState('');
  const [formNoKk, setFormNoKk] = useState('');
  const [formWargaId, setFormWargaId] = useState('');
  const [formFotoUrl, setFormFotoUrl] = useState('');
  const [selectedWargaId, setSelectedWargaId] = useState('');
  const [wargaSearchQuery, setWargaSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Filter Data Warga berdasarkan pencarian nama atau NIK
  const filteredWargaBySearch = useMemo(() => {
    if (!wargaSearchQuery.trim()) return wargaList;
    const q = wargaSearchQuery.toLowerCase().trim();
    return wargaList.filter(
      (w) =>
        (w.nama_lengkap || '').toLowerCase().includes(q) ||
        (w.nik || '').toLowerCase().includes(q) ||
        (w.alamat_domisili || '').toLowerCase().includes(q)
    );
  }, [wargaList, wargaSearchQuery]);

  // Helper Cek Jabatan Inti vs Seksi
  const checkIsPengurusInti = (jabatan: string): boolean => {
    const j = (jabatan || '').toLowerCase().trim();
    return (
      j.includes('ketua') ||
      j.includes('wakil ketua') ||
      j.includes('sekretaris') ||
      j.includes('bendahara')
    );
  };

  // Helper Cek Seksi-Seksi RT
  const checkIsSeksi = (jabatan: string): boolean => {
    const j = (jabatan || '').toLowerCase().trim();
    return j.includes('seksi') || j.includes('koordinator') || j.includes('bidang');
  };

  // Muat Data dari Supabase (Tabel pengguna) & Data Warga
  const loadData = async (showLoadingToast = false) => {
    setIsLoading(true);
    try {
      const [penggunaRes, citizensRes] = await Promise.all([
        fetchAllPenggunaFromSupabase(),
        fetchDataWargaFromSupabase(),
      ]);

      setPengurusList(penggunaRes || []);
      setWargaList(citizensRes || []);

      if (showLoadingToast) {
        const pengurusCount = (penggunaRes || []).filter((p) => !isWargaJabatan(p.jabatan)).length;
        onTriggerToast(
          `Berhasil menyinkronkan ${pengurusCount} akun pengurus dari tabel pengguna Supabase.`,
          'success',
          'Data Terkini'
        );
      }
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      onTriggerToast(
        err.message || 'Gagal memuat data pengurus dari Supabase.',
        'error',
        'Kendala Database'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [connectionStatus]);

  // 1. Filter Khusus Pengurus: Abaikan / keluarkan akun yang berstatus 'Warga'
  const activePengurusList = useMemo(() => {
    return (pengurusList || []).filter((p) => !isWargaJabatan(p.jabatan));
  }, [pengurusList]);

  // Helper status jabatan pengurus: 'Jabatan Terisi' atau 'Jabatan Kosong'
  const getJabatanStatusLabel = (jabatanName: string): string => {
    const j = (jabatanName || '').toLowerCase().trim();
    let isTerisi = false;
    if (j === 'ketua rt') {
      isTerisi = activePengurusList.some((p) => {
        const pj = (p.jabatan || '').toLowerCase().trim();
        return pj.includes('ketua') && !pj.includes('wakil');
      });
    } else if (j === 'wakil ketua rt' || j === 'wakil ketua') {
      isTerisi = activePengurusList.some((p) => {
        const pj = (p.jabatan || '').toLowerCase().trim();
        return pj.includes('wakil');
      });
    } else if (j === 'sekretaris') {
      isTerisi = activePengurusList.some((p) => {
        const pj = (p.jabatan || '').toLowerCase().trim();
        return pj.includes('sekretaris');
      });
    } else if (j === 'bendahara') {
      isTerisi = activePengurusList.some((p) => {
        const pj = (p.jabatan || '').toLowerCase().trim();
        return pj.includes('bendahara');
      });
    } else {
      isTerisi = activePengurusList.some(
        (p) => (p.jabatan || '').toLowerCase().trim() === j
      );
    }
    return isTerisi ? 'Jabatan Terisi' : 'Jabatan Kosong';
  };

  // Statistik Ringkas (Murni Pengurus Inti & Seksi-Seksi)
  const stats = useMemo(() => {
    const total = activePengurusList.length;
    const inti = activePengurusList.filter((p) => checkIsPengurusInti(p.jabatan)).length;
    const seksi = activePengurusList.filter((p) => !checkIsPengurusInti(p.jabatan)).length;
    const admin = activePengurusList.filter((p) => p.level_akses === 'Admin').length;
    const user = activePengurusList.filter((p) => p.level_akses === 'User').length;
    return { total, inti, seksi, admin, user };
  }, [activePengurusList]);

  // Filter Data & Urutkan sesuai Hierarki Jabatan Resmi:
  // 1. Ketua
  // 2. Wakil Ketua (jika ada)
  // 3. Sekretaris
  // 4. Bendahara
  // 5. Seksi-seksi yang ada (Keamanan, Sarpras, Humas, Kerohanian, Pemuda/Olahraga, Pemberdayaan Perempuan, dst.)
  const filteredPengurus = useMemo(() => {
    const list = activePengurusList.filter((p) => {
      // Filter Kategori
      if (categoryFilter === 'Inti' && !checkIsPengurusInti(p.jabatan)) return false;
      if (categoryFilter === 'Seksi' && checkIsPengurusInti(p.jabatan)) return false;
      if (categoryFilter === 'Admin' && p.level_akses !== 'Admin') return false;
      if (categoryFilter === 'User' && p.level_akses !== 'User') return false;

      // Filter Pencarian
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const mNama = (p.nama || '').toLowerCase().includes(q);
        const mEmail = (p.email || '').toLowerCase().includes(q);
        const mJabatan = (p.jabatan || '').toLowerCase().includes(q);
        const mHp = (p.no_hp || '').toLowerCase().includes(q);
        const mAlamat = (p.alamat_domisili || '').toLowerCase().includes(q);
        return mNama || mEmail || mJabatan || mHp || mAlamat;
      }
      return true;
    });

    // Urutkan sesuai jabatan yang diminta
    return list.slice().sort(sortPengurusByJabatan);
  }, [activePengurusList, categoryFilter, searchTerm]);

  // Buka Modal Tambah
  const handleOpenAdd = () => {
    setEditingPengurus(null);
    setSelectedWargaId('');
    setWargaSearchQuery('');
    setFormNama('');
    setFormEmail('');
    setFormPassword('');
    setShowPassword(false);
    setFormKategoriJabatan('Inti');
    setFormJabatan('Ketua RT');
    setCustomJabatan('');
    setFormLevelAkses('Admin');
    setFormNoHp('');
    setFormAlamat('');
    setFormNik('');
    setFormNoKk('');
    setFormWargaId('');
    setFormFotoUrl('');
    setFormError('');
    setIsFormModalOpen(true);
  };

  // Buka Modal Edit
  const handleOpenEdit = (p: SupabasePengurusRow) => {
    setEditingPengurus(p);
    setSelectedWargaId(p.warga_id || '');
    setFormNama(p.nama || '');
    setFormEmail(p.email || '');
    setFormPassword(''); // Kosongkan, jika tidak diubah
    setShowPassword(false);

    const isInti = checkIsPengurusInti(p.jabatan);
    const standardRoles = SUSUNAN_PENGURUS_RT.map((s) => s.role);
    const isStandard = standardRoles.includes(p.jabatan as any);

    if (p.jabatan === 'Warga' || isWargaJabatan(p.jabatan)) {
      setFormKategoriJabatan('Warga');
      setFormJabatan('Warga');
      setCustomJabatan('');
    } else if (isInti) {
      setFormKategoriJabatan('Inti');
      setFormJabatan(p.jabatan);
      setCustomJabatan('');
    } else if (isStandard) {
      setFormKategoriJabatan('Seksi');
      setFormJabatan(p.jabatan);
      setCustomJabatan('');
    } else {
      setFormKategoriJabatan('Lainnya');
      setFormJabatan('Lainnya');
      setCustomJabatan(p.jabatan);
    }

    setFormLevelAkses((p.level_akses as 'Admin' | 'User') || 'User');
    setFormNoHp(p.no_hp || '');
    setFormAlamat(p.alamat_domisili || '');
    setFormNik(p.nik || '');
    setFormNoKk(p.no_kk || '');
    setFormWargaId(p.warga_id || '');
    setFormFotoUrl(p.foto_url || '');
    setFormError('');
    setIsFormModalOpen(true);
  };

  // Autofill saat warga dipilih dari dropdown
  const handleSelectWarga = (wargaId: string) => {
    setSelectedWargaId(wargaId);
    if (!wargaId) return;

    const warga = wargaList.find((w) => w.id === wargaId);
    if (warga) {
      setFormNama(warga.nama_lengkap || '');
      setFormAlamat(warga.alamat_domisili || '');
      setFormNoHp(warga.no_hp || '');
      setFormNik(warga.nik || '');
      setFormNoKk(warga.no_kk || '');
      setFormWargaId(warga.id || '');

      // Buat email default yang bersih jika belum terisi
      if (!formEmail) {
        const cleanSlug = (warga.nama_lengkap || 'pengurus')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 15);
        setFormEmail(`${cleanSlug}@rt02.id`);
      }
    }
  };

  // Submit Simpan Tambah / Edit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    let cleanNama = formNama.trim();
    if (!cleanNama && selectedWargaId) {
      const warga = wargaList.find((w) => w.id === selectedWargaId);
      if (warga?.nama_lengkap) {
        cleanNama = warga.nama_lengkap.trim();
      }
    }
    if (!cleanNama) {
      if (formEmail) {
        const emailPrefix = formEmail.split('@')[0] || '';
        cleanNama = emailPrefix ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1) : 'Pengurus RT';
      } else {
        cleanNama = 'Pengurus RT';
      }
    }

    let cleanEmail = formEmail.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      const slug = cleanNama
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 15) || 'pengurus';
      cleanEmail = `${slug}@rt02.id`;
    }
    let finalJabatan = formJabatan;
    if (formKategoriJabatan === 'Warga') {
      finalJabatan = 'Warga';
    } else if (formKategoriJabatan === 'Lainnya') {
      finalJabatan = customJabatan.trim() || 'Pengurus';
    }

    // Ketentuan Hak Akses Otomatis:
    // Jika Jabatan: Ketua, Wakil Ketua, Sekretaris, atau Bendahara -> Admin
    // Selain pengurus inti (termasuk Seksi-seksi, Jabatan Lain, Warga) -> User
    const finalLevelAkses: 'Admin' | 'User' = checkIsPengurusInti(finalJabatan)
      ? 'Admin'
      : 'User';

    if (!cleanNama) {
      setFormError('Nama lengkap pengurus wajib diisi.');
      return;
    }

    if (!editingPengurus && (!formPassword || formPassword.length < 6)) {
      setFormError('Kata sandi awal minimal 6 karakter.');
      return;
    }

    setIsSubmitting(true);

    try {
      const finalAlamat = formAlamat.trim() || (selectedWargaId ? wargaList.find((w) => w.id === selectedWargaId)?.alamat_domisili : undefined);
      const payload: Partial<SupabasePengurusRow> = {
        nama: cleanNama,
        email: cleanEmail,
        jabatan: finalJabatan,
        level_akses: finalLevelAkses,
        no_hp: formNoHp.trim() || undefined,
        alamat_domisili: finalAlamat || undefined,
        nik: formNik.trim() || undefined,
        no_kk: formNoKk.trim() || undefined,
        warga_id: formWargaId || undefined,
        foto_url: formFotoUrl.trim() || undefined,
      };

      if (formPassword && formPassword.trim().length >= 6) {
        payload.password = formPassword.trim();
      }

      if (editingPengurus) {
        const isDemotedToWarga = finalJabatan === 'Warga';
        const previousJabatan = editingPengurus.jabatan;

        // Update Pengurus di Supabase
        const res = await updatePenggunaInSupabase(editingPengurus.id, payload);
        if (!res.success) {
          setFormError(res.error || 'Gagal memperbarui data pengurus.');
          return;
        }

        if (isDemotedToWarga) {
          onTriggerToast(
            `Jabatan ${cleanNama} berhasil diubah menjadi "Warga" dan Hak Akses menjadi "User" pada tabel pengguna Supabase. Posisi jabatan "${previousJabatan}" kini telah kosong dan dapat diisi oleh warga lain melalui tombol Daftar Akun.`,
            'success',
            'Jabatan Dialihkan ke Warga'
          );
        } else {
          onTriggerToast(
            `Data pengurus ${cleanNama} (${finalJabatan}) berhasil diperbarui!`,
            'success',
            'Update Berhasil'
          );
        }
      } else {
        // Tambah Pengurus Baru
        const res = await createPenggunaInSupabase(payload);
        if (!res.success) {
          setFormError(res.error || 'Gagal menambahkan pengurus ke database.');
          return;
        }
        onTriggerToast(
          `Pengurus baru ${cleanNama} (${finalJabatan}) berhasil ditambahkan ke tabel pengguna!`,
          'success',
          'Penambahan Berhasil'
        );
      }

      setIsFormModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan saat menyimpan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ekspor Dokumen Susunan Pengurus Resmi (PDF)
  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      await exportDataPengurusPDF(filteredPengurus, {
        sekretariat: {
          rt: sekretariat.rt,
          rw: sekretariat.rw,
          kelurahan: sekretariat.kelurahan,
          kecamatan: sekretariat.kecamatan,
          alamat: sekretariat.alamat,
          nama_ketua_rt: sekretariat.nama_ketua_rt,
        },
        filterLabel:
          categoryFilter === 'All'
            ? 'Seluruh Pengurus'
            : categoryFilter === 'Inti'
            ? 'Pengurus Inti'
            : categoryFilter === 'Seksi'
            ? 'Seksi-Seksi RT'
            : `${categoryFilter}`,
      });
      onTriggerToast(
        'Dokumen resmi Susunan Pengurus RT berhasil diekspor ke PDF.',
        'success',
        'Ekspor PDF Selesai'
      );
    } catch (err: any) {
      onTriggerToast(err.message || 'Gagal mengekspor PDF.', 'error');
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Helper Salin SQL Schema
  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(PENGGUNA_SQL_SCHEMA);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = PENGGUNA_SQL_SCHEMA;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Toolbar Pengurus */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="font-extrabold text-slate-900 text-base sm:text-lg flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-600" />
            <span>Kelola Data Pengurus & Akun Pengguna RT</span>
          </h2>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
            title="Segarkan data pengurus dari database Supabase"
          >
            <RefreshCw
              className={`w-4 h-4 text-slate-600 ${
                isLoading ? 'animate-spin text-indigo-600' : ''
              }`}
            />
            <span>{isLoading ? 'Memuat...' : 'Segarkan'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSqlModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-2xs"
            title="Lihat skema SQL tabel pengguna untuk Supabase"
          >
            <Database className="w-4 h-4 text-emerald-600" />
            <span>Skema SQL</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExportingPDF || filteredPengurus.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            title="Cetak & Unduh Laporan Susunan Pengurus RT ke PDF"
          >
            {isExportingPDF ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            ) : (
              <Printer className="w-4 h-4 text-indigo-600" />
            )}
            <span>Cetak PDF</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-700 hover:from-indigo-700 hover:to-blue-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm shadow-indigo-600/20 hover:shadow-md cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Pengurus</span>
          </button>
        </div>
      </div>

      {/* 2. Kartu Statistik Ringkas Kepengurusan */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* TOTAL PENGURUS */}
        <div className="bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 p-4 sm:p-5 rounded-2xl border border-indigo-700/80 shadow-md text-white flex items-center justify-between">
          <div>
            <div className="text-[10px] sm:text-xs font-bold text-indigo-200 uppercase tracking-wider">
              TOTAL PENGURUS
            </div>
            <div className="text-xl sm:text-2xl font-black text-white mt-0.5">
              {stats.total}{' '}
              <span className="text-xs font-bold text-indigo-200">akun</span>
            </div>
            <div className="text-[11px] text-indigo-200/80 mt-0.5">
              Tabel <code className="font-mono text-indigo-100">pengguna</code>
            </div>
          </div>
          <div className="p-2.5 bg-indigo-600/50 text-indigo-100 border border-indigo-400/30 rounded-xl shadow-xs shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        {/* PENGURUS INTI */}
        <div className="bg-gradient-to-br from-purple-950 via-indigo-900 to-slate-900 p-4 sm:p-5 rounded-2xl border border-purple-700/80 shadow-md text-white flex items-center justify-between">
          <div>
            <div className="text-[10px] sm:text-xs font-bold text-purple-200 uppercase tracking-wider">
              PENGURUS INTI
            </div>
            <div className="text-xl sm:text-2xl font-black text-white mt-0.5">
              {stats.inti}{' '}
              <span className="text-xs font-bold text-purple-200">pejabat</span>
            </div>
            <div className="text-[11px] text-purple-200/80 mt-0.5">
              Ketua, Wakil, Sekr, Bend
            </div>
          </div>
          <div className="p-2.5 bg-purple-600/50 text-purple-100 border border-purple-400/30 rounded-xl shadow-xs shrink-0">
            <Shield className="w-5 h-5" />
          </div>
        </div>

        {/* SEKSI-SEKSI RT */}
        <div className="bg-gradient-to-br from-teal-950 via-emerald-900 to-slate-900 p-4 sm:p-5 rounded-2xl border border-teal-700/80 shadow-md text-white flex items-center justify-between">
          <div>
            <div className="text-[10px] sm:text-xs font-bold text-teal-200 uppercase tracking-wider">
              SEKSI-SEKSI RT
            </div>
            <div className="text-xl sm:text-2xl font-black text-white mt-0.5">
              {stats.seksi}{' '}
              <span className="text-xs font-bold text-teal-200">pos seksi</span>
            </div>
            <div className="text-[11px] text-teal-200/80 mt-0.5">
              Keamanan, Sarpras, Humas, dll
            </div>
          </div>
          <div className="p-2.5 bg-teal-600/50 text-teal-100 border border-teal-400/30 rounded-xl shadow-xs shrink-0">
            <Award className="w-5 h-5" />
          </div>
        </div>

        {/* ADMINISTRATOR */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 p-4 sm:p-5 rounded-2xl border border-amber-700/80 shadow-md text-white flex items-center justify-between">
          <div>
            <div className="text-[10px] sm:text-xs font-bold text-amber-200 uppercase tracking-wider">
              ADMIN SISTEM
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-400 mt-0.5">
              {stats.admin}{' '}
              <span className="text-xs font-bold text-amber-200">admin</span>
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5">
              Akses penuh kelola data
            </div>
          </div>
          <div className="p-2.5 bg-amber-600/40 text-amber-200 border border-amber-400/30 rounded-xl shadow-xs shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Filter Pills & Pencarian */}
      <div className="bg-slate-200 px-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-300 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Filter Pills */}
        <div className="flex items-center gap-1 p-0.5 bg-white/80 backdrop-blur-xs rounded-lg border border-slate-300/80 w-fit shadow-2xs overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setCategoryFilter('All')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              categoryFilter === 'All'
                ? 'bg-slate-900 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Semua ({stats.total})
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('Inti')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              categoryFilter === 'Inti'
                ? 'bg-indigo-600 text-white shadow-xs font-bold'
                : 'text-indigo-700 hover:bg-indigo-50'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Pengurus Inti ({stats.inti})</span>
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('Seksi')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              categoryFilter === 'Seksi'
                ? 'bg-teal-600 text-white shadow-xs font-bold'
                : 'text-teal-700 hover:bg-teal-50'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Seksi-Seksi ({stats.seksi})</span>
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('Admin')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              categoryFilter === 'Admin'
                ? 'bg-amber-600 text-white shadow-xs font-bold'
                : 'text-amber-800 hover:bg-amber-50'
            }`}
          >
            Admin ({stats.admin})
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('User')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              categoryFilter === 'User'
                ? 'bg-slate-700 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Operator ({stats.user})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-xs bg-slate-900 border border-slate-800 rounded-lg shadow-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama, jabatan, email, no HP..."
            className="w-full pl-8 pr-7 py-1.5 bg-transparent border-none rounded-lg text-xs text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 4. Tabel Daftar Pengurus RT */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-white uppercase tracking-wider">
                <th className="py-2.5 px-3 text-white font-bold bg-slate-950 w-12 text-center">
                  No
                </th>
                <th className="py-2.5 px-3 text-white font-bold bg-slate-950">
                  Nama Pengurus
                </th>
                <th className="py-2.5 px-3 text-white font-bold bg-slate-950">
                  Jabatan / Posisi
                </th>
                <th className="py-2.5 px-3 text-white font-bold bg-slate-950">
                  Email Akun
                </th>
                <th className="py-2.5 px-3 text-white font-bold bg-slate-950">
                  No. HP
                </th>
                <th className="py-2.5 px-3 text-right text-white font-bold bg-slate-950">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                      <p className="font-semibold text-slate-700">
                        Memuat data pengurus dari Supabase...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredPengurus.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <UserCheck className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                      <p className="font-semibold text-slate-700">
                        Belum ada data pengurus yang sesuai.
                      </p>
                      <p className="text-xs text-slate-400">
                        {searchTerm
                          ? 'Coba ubah kata kunci pencarian Anda.'
                          : 'Klik tombol "Tambah Pengurus" untuk menambahkan akun pengurus baru.'}
                      </p>
                      {!searchTerm && (
                        <button
                          type="button"
                          onClick={handleOpenAdd}
                          className="mt-2 flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-semibold border border-indigo-200 transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah Pengurus Pertama</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPengurus.map((p, idx) => {
                  const isInti = checkIsPengurusInti(p.jabatan);
                  const isSeksi = checkIsSeksi(p.jabatan);
                  const initials = (p.nama || 'P')
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0].toUpperCase())
                    .join('');

                  return (
                    <tr
                      key={p.id || `pengurus-${idx}`}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* No */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center justify-center min-w-[24px] h-5.5 px-1.5 rounded-md text-[11px] font-mono font-black text-white shadow-2xs ${
                            isInti
                              ? 'bg-indigo-600 border border-indigo-700'
                              : 'bg-teal-600 border border-teal-700'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>

                      {/* Nama & Avatar */}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2.5">
                          {p.foto_url ? (
                            <img
                              src={p.foto_url}
                              alt={p.nama}
                              className="w-8 h-8 rounded-full object-cover border border-slate-300 shadow-2xs shrink-0"
                            />
                          ) : (
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-extrabold shadow-2xs shrink-0 ${
                                isInti
                                  ? 'bg-gradient-to-tr from-indigo-700 to-purple-600'
                                  : 'bg-gradient-to-tr from-teal-700 to-emerald-600'
                              }`}
                            >
                              {initials}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">
                              {p.nama}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {p.alamat_domisili ? (
                                <span title={p.alamat_domisili}>
                                  {p.alamat_domisili}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">
                                  Domisili {wilayahShort}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Jabatan */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                            isInti
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                              : 'bg-teal-50 text-teal-800 border-teal-300'
                          }`}
                        >
                          {isInti ? (
                            <Shield className="w-3.5 h-3.5 text-indigo-600" />
                          ) : (
                            <Award className="w-3.5 h-3.5 text-teal-600" />
                          )}
                          <span>{p.jabatan}</span>
                        </span>
                      </td>

                      {/* Email */}
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[170px]">{p.email}</span>
                        </div>
                      </td>

                      {/* Kontak / WhatsApp */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        {p.no_hp && p.no_hp.trim() !== '' && p.no_hp !== '-' ? (
                          <a
                            href={`https://wa.me/${p.no_hp.replace(/^0/, '62').replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md text-[11px] font-semibold transition-all shadow-2xs group cursor-pointer"
                            title={`Kirim pesan WhatsApp ke ${p.nama}`}
                          >
                            <Phone className="w-3 h-3 text-emerald-600 group-hover:scale-110 transition-transform" />
                            <span>{p.no_hp}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            - Tidak ada HP -
                          </span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(p)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-xs hover:shadow-sm shadow-indigo-600/20 transition-all cursor-pointer active:scale-95 text-xs font-semibold"
                          title={`Update / Alihkan Jabatan ${p.nama}`}
                        >
                          <Pencil className="w-3.5 h-3.5 text-white" />
                          <span>Update</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Info */}
        <div className="p-4 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                Pengurus Inti: <strong>{stats.inti}</strong>
              </span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-teal-600" />
              <span>
                Seksi-Seksi RT: <strong>{stats.seksi}</strong>
              </span>
            </span>
          </div>
          <div className="text-slate-400 font-medium">
            Total {filteredPengurus.length} pengurus ditampilkan
          </div>
        </div>
      </div>

      {/* 5. MODAL FORM: Tambah / Koreksi Pengurus */}
      {/* 5. MODAL FORM: Tambah / Koreksi Pengurus */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200/80 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div
              className={`flex items-center justify-between px-5 py-3.5 border-b shrink-0 relative overflow-hidden ${
                editingPengurus
                  ? 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border-indigo-900/50'
                  : 'bg-gradient-to-r from-slate-950 via-indigo-950 to-blue-950 text-white border-indigo-900/50'
              }`}
            >
              {/* Ambient lighting effect for modern look */}
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
              {!editingPengurus && (
                <div className="absolute left-1/4 -bottom-8 w-28 h-28 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
              )}
              <div className="flex items-center gap-2.5 relative z-10">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm shrink-0 ${
                    editingPengurus
                      ? 'bg-gradient-to-tr from-indigo-500 to-violet-500 text-white ring-1 ring-white/20 shadow-indigo-950/40'
                      : 'bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 text-white ring-1 ring-white/20 shadow-emerald-950/40'
                  }`}
                >
                  {editingPengurus ? (
                    <UserCheck className="w-5 h-5" />
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-white flex items-center gap-2">
                    <span>
                      {editingPengurus
                        ? 'Koreksi Data Pengurus RT'
                        : 'Tambah Pengurus / Akun Baru'}
                    </span>
                    {!editingPengurus && (
                      <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        <Sparkles className="w-3 h-3 text-emerald-300" />
                        Akun Baru
                      </span>
                    )}
                  </h3>
                  {editingPengurus ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wide">
                        Jabatan Pengurus:
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-black bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 text-slate-950 shadow-xs border border-amber-300 tracking-wide">
                        {editingPengurus.jabatan}
                      </span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-indigo-200/80 font-medium mt-0.5">
                      Daftarkan akun pengurus RT atau operator sistem baru
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 rounded-xl cursor-pointer transition-all relative z-10 text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form
              onSubmit={handleSubmitForm}
              className="p-4 sm:p-5 space-y-2.5 overflow-y-auto flex-1 custom-scrollbar"
            >
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2 shadow-2xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{formError}</span>
                </div>
              )}

              {/* Card Ringkasan Pengurus Terpilih */}
              {editingPengurus && (
                <div className="p-2.5 sm:p-3 bg-gradient-to-r from-indigo-50/80 via-slate-50 to-indigo-50/50 border border-indigo-200 rounded-2xl flex items-center justify-between gap-2.5 shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-700 text-white font-extrabold text-xs flex items-center justify-center shadow-xs shrink-0 tracking-wider">
                      {(editingPengurus.nama || 'P')
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((w) => w[0].toUpperCase())
                        .join('')}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {editingPengurus.nama}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono truncate">
                        {editingPengurus.email}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-[10px] block font-bold text-indigo-700 uppercase tracking-wider mb-0.5">
                      Jabatan Pengurus
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xs border border-indigo-500/30">
                      <Shield className="w-3.5 h-3.5 text-indigo-200" />
                      <span>{editingPengurus.jabatan}</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Opsi Cepat: Alihkan / Bebas-Tugaskan Menjadi Warga Biasa (Khusus Update Pengurus) */}
              {editingPengurus && (
                <div
                  className={`p-3 rounded-2xl border transition-all duration-200 ${
                    formJabatan === 'Warga' && formLevelAkses === 'User'
                      ? 'bg-gradient-to-r from-emerald-50 via-teal-50/60 to-emerald-50 border-emerald-400 ring-2 ring-emerald-500/10 shadow-sm'
                      : 'bg-gradient-to-r from-amber-50/90 via-orange-50/40 to-amber-50/90 border-amber-300/90 shadow-2xs hover:border-amber-400'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs transition-all ${
                          formJabatan === 'Warga' && formLevelAkses === 'User'
                            ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/30 ring-2 ring-emerald-300/40'
                            : 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-amber-500/20'
                        }`}
                      >
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span>Alihkan Jabatan Menjadi Warga Biasa</span>
                          {formJabatan === 'Warga' && formLevelAkses === 'User' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs animate-in zoom-in-90">
                              ✓ Siap Disimpan
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {formJabatan === 'Warga' && formLevelAkses === 'User'
                            ? 'Status dialihkan ke Warga Biasa. Tombol "Simpan Perubahan" kini aktif.'
                            : 'Klik tombol berwarna di samping untuk melepaskan jabatan pengurus ini.'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormKategoriJabatan('Warga');
                        setFormJabatan('Warga');
                        setFormLevelAkses('User');
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer whitespace-nowrap active:scale-95 flex items-center gap-1.5 shadow-sm ${
                        formJabatan === 'Warga' && formLevelAkses === 'User'
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-600/30 ring-2 ring-emerald-400/40 border border-emerald-500'
                          : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-500/25 ring-2 ring-amber-400/30 border border-amber-400'
                      }`}
                    >
                      {formJabatan === 'Warga' && formLevelAkses === 'User' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span>✓ Terpilih: Menjadi Warga</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5 text-white" />
                          <span>Ubah Menjadi Warga</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Fitur Mencari Nama Warga & Autofill */}
              {!editingPengurus && wargaList.length > 0 && (
                <div className="p-3 bg-gradient-to-r from-sky-50/90 via-indigo-50/40 to-blue-50/80 border border-sky-200/90 rounded-2xl space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-xs shrink-0">
                        <Search className="w-3 h-3" />
                      </div>
                      <span>Cari Nama Warga (Isi Otomatis)</span>
                    </label>
                    <span className="text-[10px] text-sky-700 bg-sky-100/90 border border-sky-200/80 px-2 py-0.5 rounded-full font-bold">
                      {wargaList.length} Warga Terdaftar
                    </span>
                  </div>

                  {/* Input Mencari Nama Warga */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-sky-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={wargaSearchQuery}
                      onChange={(e) => setWargaSearchQuery(e.target.value)}
                      placeholder="Ketik untuk mencari nama warga atau NIK..."
                      className="w-full pl-8 pr-8 py-1.5 bg-white border border-sky-200 hover:border-sky-300 focus:border-sky-500 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-4 focus:ring-sky-500/10 transition-all shadow-2xs"
                    />
                    {wargaSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setWargaSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Hasil Pencarian Warga */}
                  <div className="space-y-1">
                    <select
                      value={selectedWargaId}
                      onChange={(e) => {
                        handleSelectWarga(e.target.value);
                        const found = wargaList.find((w) => w.id === e.target.value);
                        if (found) setWargaSearchQuery(found.nama_lengkap);
                      }}
                      className="w-full px-3 py-1.5 bg-white hover:bg-slate-50/80 border border-sky-200 focus:border-sky-500 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-4 focus:ring-sky-500/10 transition-all shadow-2xs"
                    >
                      <option value="">
                        -- {wargaSearchQuery ? `Hasil Pencarian: ${filteredWargaBySearch.length} ditemukan` : 'Pilih dari data warga atau ketik di atas'} --
                      </option>
                      {filteredWargaBySearch.map((w) => (
                        <option key={w.id || w.nik} value={w.id}>
                          {w.nama_lengkap} (NIK: {w.nik || '-'}) — {w.alamat_domisili || 'RT'}
                        </option>
                      ))}
                    </select>

                    {/* Chips Rekomendasi Cepat (1-4 Warga) */}
                    {wargaSearchQuery.trim() && filteredWargaBySearch.length > 0 && filteredWargaBySearch.length <= 4 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {filteredWargaBySearch.map((w) => (
                          <button
                            key={w.id || w.nik}
                            type="button"
                            onClick={() => {
                              handleSelectWarga(w.id);
                              setWargaSearchQuery(w.nama_lengkap);
                            }}
                            className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer flex items-center gap-1 ${
                              selectedWargaId === w.id
                                ? 'bg-sky-600 text-white border-sky-700 shadow-2xs'
                                : 'bg-white hover:bg-sky-50 text-sky-900 border-sky-200'
                            }`}
                          >
                            <User className="w-3 h-3" />
                            <span>{w.nama_lengkap}</span>
                            {selectedWargaId === w.id && <Check className="w-3 h-3 text-white ml-0.5" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedWargaId && (
                    <div className="flex items-center justify-between text-[11px] text-sky-900 bg-sky-100/60 px-2.5 py-1 rounded-lg font-medium">
                      <span>✓ Data warga terpilih: Nama & Alamat berhasil diisi otomatis</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedWargaId('');
                          setWargaSearchQuery('');
                        }}
                        className="text-sky-700 hover:text-sky-900 underline cursor-pointer text-[10px]"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Baris Input Kredensial Akun: Email Akun & Kata Sandi Berdampingan Sejajar */}
              {!editingPengurus && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-gradient-to-b from-blue-50/40 to-slate-50/60 border border-slate-200/90 focus-within:border-blue-400 focus-within:bg-blue-50/30 transition-all shadow-2xs">
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 mb-1">
                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                      <span>Email Akun Login</span> <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="nama@rt02.id"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 rounded-xl text-xs sm:text-sm text-slate-800 font-mono transition-all shadow-2xs"
                    />
                  </div>

                  <div className="p-2.5 rounded-2xl bg-gradient-to-b from-amber-50/40 to-slate-50/60 border border-slate-200/90 focus-within:border-amber-400 focus-within:bg-amber-50/30 transition-all shadow-2xs">
                    <div className="flex items-center justify-between mb-1">
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Kata Sandi (Password Login)</span> <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-200/60">
                        Min. 6 Karakter
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        placeholder="Contoh: rt02jaya"
                        className="w-full pl-3 pr-10 py-1.5 bg-white border border-slate-200 hover:border-slate-300 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 rounded-xl text-xs sm:text-sm text-slate-800 font-medium transition-all shadow-2xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
                        title={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Baris 3: Kategori Jabatan & Dropdown Jabatan - Khusus Tambah Pengurus Baru */}
              {!editingPengurus && (
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Kategori Kepengurusan & Jabatan <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFormKategoriJabatan('Inti');
                        setFormJabatan('Ketua RT');
                        setFormLevelAkses('Admin');
                      }}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs ${
                        formKategoriJabatan === 'Inti'
                          ? 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-700 text-white border-transparent shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400/40'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-indigo-50/60 hover:border-indigo-300 hover:text-indigo-900'
                      }`}
                    >
                      <Shield className={`w-3.5 h-3.5 ${formKategoriJabatan === 'Inti' ? 'text-white' : 'text-indigo-600'}`} />
                      <span>Pengurus Inti</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFormKategoriJabatan('Seksi');
                        setFormJabatan('Seksi Keamanan');
                        setFormLevelAkses('User');
                      }}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs ${
                        formKategoriJabatan === 'Seksi'
                          ? 'bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 text-white border-transparent shadow-md shadow-teal-600/30 ring-2 ring-teal-400/40'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-teal-50/60 hover:border-teal-300 hover:text-teal-900'
                      }`}
                    >
                      <Award className={`w-3.5 h-3.5 ${formKategoriJabatan === 'Seksi' ? 'text-white' : 'text-teal-600'}`} />
                      <span>Seksi-Seksi RT</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFormKategoriJabatan('Lainnya');
                        setFormJabatan('Lainnya');
                      }}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs ${
                        formKategoriJabatan === 'Lainnya'
                          ? 'bg-gradient-to-r from-purple-600 via-violet-600 to-purple-700 text-white border-transparent shadow-md shadow-purple-600/30 ring-2 ring-purple-400/40'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-purple-50/60 hover:border-purple-300 hover:text-purple-900'
                      }`}
                    >
                      <Plus className={`w-3.5 h-3.5 ${formKategoriJabatan === 'Lainnya' ? 'text-white' : 'text-purple-600'}`} />
                      <span>Jabatan Lain</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFormKategoriJabatan('Warga');
                        setFormJabatan('Warga');
                        setFormLevelAkses('User');
                      }}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs ${
                        formKategoriJabatan === 'Warga'
                          ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 text-white border-transparent shadow-md shadow-amber-500/30 ring-2 ring-amber-400/40'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-amber-50/60 hover:border-amber-300 hover:text-amber-900'
                      }`}
                    >
                      <UserCheck className={`w-3.5 h-3.5 ${formKategoriJabatan === 'Warga' ? 'text-white' : 'text-amber-600'}`} />
                      <span>Warga Biasa</span>
                    </button>
                  </div>

                  {/* Info Ketika Kategori Warga Dipilih */}
                  {formKategoriJabatan === 'Warga' && (
                    <div className="p-3 bg-gradient-to-r from-amber-50 via-orange-50/50 to-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 space-y-1 animate-in fade-in duration-150 shadow-2xs">
                      <div className="font-bold flex items-center gap-1.5 text-amber-950">
                        <CheckCircle className="w-4 h-4 text-amber-600" />
                        <span>Status: Menjadi Warga Biasa (Hak Akses: User)</span>
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Pengguna ini akan disimpan dengan <strong>jabatan = "Warga"</strong> dan <strong>hak akses = "User"</strong> pada tabel <code className="font-mono bg-amber-100 px-1 py-0.2 rounded text-amber-900">pengguna</code> Supabase. Akun ini tidak lagi tercatat di struktur kepengurusan aktif, sehingga warga lain dapat mendaftarkan akun untuk mengisi jabatan tersebut.
                      </p>
                    </div>
                  )}

                  {/* Dropdown Jabatan Spesifik */}
                  {formKategoriJabatan === 'Inti' && (
                    <div className="p-2.5 bg-gradient-to-r from-indigo-50/80 via-blue-50/40 to-indigo-50/80 border border-indigo-200 rounded-2xl space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-indigo-950 flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Pilih Posisi Jabatan Pengurus Inti</span>
                        </label>
                        <span className="text-[10px] font-extrabold text-amber-900 bg-amber-100/90 border border-amber-300/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <KeyRound className="w-3 h-3 text-amber-700" />
                          <span>Hak Akses: Admin</span>
                        </span>
                      </div>
                      <select
                        value={formJabatan}
                        onChange={(e) => setFormJabatan(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-indigo-200 hover:border-indigo-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                      >
                        <option value="Ketua RT">Ketua RT ({getJabatanStatusLabel('Ketua RT')})</option>
                        <option value="Wakil Ketua RT">Wakil Ketua RT ({getJabatanStatusLabel('Wakil Ketua RT')})</option>
                        <option value="Sekretaris">Sekretaris ({getJabatanStatusLabel('Sekretaris')})</option>
                        <option value="Bendahara">Bendahara ({getJabatanStatusLabel('Bendahara')})</option>
                      </select>
                    </div>
                  )}

                  {formKategoriJabatan === 'Seksi' && (
                    <div className="p-2.5 bg-gradient-to-r from-teal-50/80 via-emerald-50/40 to-teal-50/80 border border-teal-200 rounded-2xl space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-teal-950 flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-teal-600" />
                          <span>Pilih Bidang Seksi Kepengurusan RT</span>
                        </label>
                        <span className="text-[10px] font-extrabold text-teal-900 bg-teal-100/90 border border-teal-300/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-teal-700" />
                          <span>Hak Akses: User</span>
                        </span>
                      </div>
                      <select
                        value={formJabatan}
                        onChange={(e) => setFormJabatan(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-teal-200 hover:border-teal-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
                      >
                        <option value="Seksi Keamanan">Seksi Keamanan ({getJabatanStatusLabel('Seksi Keamanan')})</option>
                        <option value="Seksi Sarana & Prasarana">Seksi Sarana & Prasarana ({getJabatanStatusLabel('Seksi Sarana & Prasarana')})</option>
                        <option value="Seksi Humas">Seksi Humas ({getJabatanStatusLabel('Seksi Humas')})</option>
                        <option value="Seksi Kerohanian">Seksi Kerohanian ({getJabatanStatusLabel('Seksi Kerohanian')})</option>
                        <option value="Seksi Pemuda & Olahraga">Seksi Pemuda & Olahraga ({getJabatanStatusLabel('Seksi Pemuda & Olahraga')})</option>
                        <option value="Seksi Pemberdayaan Perempuan">Seksi Pemberdayaan Perempuan ({getJabatanStatusLabel('Seksi Pemberdayaan Perempuan')})</option>
                      </select>
                    </div>
                  )}

                  {formKategoriJabatan === 'Lainnya' && (
                    <div className="p-2.5 bg-gradient-to-r from-purple-50/80 via-violet-50/40 to-purple-50/80 border border-purple-200 rounded-2xl space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-purple-950 flex items-center gap-1.5">
                          <Plus className="w-3.5 h-3.5 text-purple-600" />
                          <span>Ketik Nama Jabatan / Peran Kustom</span>
                        </label>
                        <span className="text-[10px] font-extrabold text-purple-900 bg-purple-100/90 border border-purple-300/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-purple-700" />
                          <span>Hak Akses: User</span>
                        </span>
                      </div>
                      <input
                        type="text"
                        required
                        value={customJabatan}
                        onChange={(e) => setCustomJabatan(e.target.value)}
                        placeholder="Ketik nama seksi/jabatan kustom (misal: Koordinator Kebersihan)"
                        className="w-full px-3 py-2 bg-white border border-purple-200 hover:border-purple-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-100 mt-1">
                <div>
                  {editingPengurus && !(formJabatan === 'Warga' && formLevelAkses === 'User') && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-[11px] shadow-sm">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="font-semibold text-white tracking-wide">
                        Klik tombol "Ubah Menjadi Warga" untuk mengaktifkan simpan.
                      </span>
                    </div>
                  )}
                  {editingPengurus && (formJabatan === 'Warga' && formLevelAkses === 'User') && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950 border border-emerald-800 text-white text-[11px] shadow-sm">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="font-bold text-white tracking-wide">
                        Perubahan status warga siap disimpan.
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFormModalOpen(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 active:scale-95 shadow-2xs"
                  >
                    Batal
                  </button>

                  <button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      (Boolean(editingPengurus) && !(formJabatan === 'Warga' && formLevelAkses === 'User'))
                    }
                    title={
                      Boolean(editingPengurus) && !(formJabatan === 'Warga' && formLevelAkses === 'User')
                        ? 'Klik tombol "Ubah Menjadi Warga" terlebih dahulu untuk mengaktifkan tombol simpan'
                        : undefined
                    }
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all shadow-sm ${
                      (Boolean(editingPengurus) && !(formJabatan === 'Warga' && formLevelAkses === 'User')) || isSubmitting
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none'
                        : editingPengurus
                        ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-emerald-600/30 hover:shadow-md hover:shadow-emerald-600/40 cursor-pointer active:scale-98 ring-2 ring-emerald-400/20'
                        : 'bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-500 hover:to-blue-600 text-white shadow-indigo-600/30 hover:shadow-md hover:shadow-indigo-600/40 cursor-pointer active:scale-98 ring-2 ring-indigo-400/20'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Menyimpan ke Supabase...</span>
                      </>
                    ) : (
                      <>
                        {editingPengurus ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                        <span>
                          {editingPengurus
                            ? 'Simpan Perubahan'
                            : 'Tambahkan Pengurus'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL SKEMA SQL TABEL PENGGUNA */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Skema SQL Tabel 'pengguna' Supabase
                  </h3>
                  <p className="text-xs text-slate-500">
                    Jalankan query DDL ini di Supabase SQL Editor jika tabel belum tersedia.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Code Box */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400">
                    PostgreSQL / Supabase DDL
                  </span>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span>Tersalin ke Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Skema SQL</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 text-xs font-mono text-emerald-300 leading-relaxed overflow-x-auto whitespace-pre">
                  {PENGGUNA_SQL_SCHEMA}
                </pre>
              </div>

              <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1.5">
                <span className="font-bold text-slate-800 block">
                  Cara Pasang di Supabase:
                </span>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px]">
                  <li>Klik tombol hijau <strong>"Salin Skema SQL"</strong> di atas.</li>
                  <li>Buka dashboard project Supabase Anda, masuk ke menu <strong>SQL Editor</strong>.</li>
                  <li>Tempelkan (Paste) query ke lembar SQL baru lalu tekan <strong>Run</strong>.</li>
                </ol>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
