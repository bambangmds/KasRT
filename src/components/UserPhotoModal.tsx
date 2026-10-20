import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  Camera, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Check, 
  Trash2, 
  Image as ImageIcon, 
  Sparkles, 
  User, 
  Sliders, 
  ShieldCheck,
  Maximize2
} from 'lucide-react';
import { UserProfile } from '../types';
import { UserAvatar } from './UserAvatar';
import { useSekretariat } from '../context/SekretariatContext';

interface UserPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onSaveUser: (updatedUser: UserProfile) => void;
}

// Koleksi preset foto pengurus RT yang rapi, profesional & representatif
const PRESET_AVATARS = [
  {
    id: 'preset-pria-1',
    label: 'Pengurus Pria (Batik/Formal)',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=256&auto=format&fit=crop&q=80',
  },
  {
    id: 'preset-wanita-1',
    label: 'Pengurus Wanita (Kerudung/Sopan)',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=256&auto=format&fit=crop&q=80',
  },
  {
    id: 'preset-pria-2',
    label: 'Pengurus Pria (Kacamata/Rapi)',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=256&auto=format&fit=crop&q=80',
  },
  {
    id: 'preset-wanita-2',
    label: 'Pengurus Wanita (Formal/Ramah)',
    url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=256&auto=format&fit=crop&q=80',
  },
  {
    id: 'preset-pria-3',
    label: 'Ketua / Tokoh Warga Senior',
    url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=256&auto=format&fit=crop&q=80',
  },
  {
    id: 'preset-wanita-3',
    label: 'Bendahara / Pengurus Muda',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=256&auto=format&fit=crop&q=80',
  },
];

export const UserPhotoModal: React.FC<UserPhotoModalProps> = ({
  isOpen,
  onClose,
  user,
  onSaveUser,
}) => {
  const { sekretariat, wilayahShort } = useSekretariat();

  // Declare all hooks unconditionally at the top
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [avatarSize, setAvatarSize] = useState<'sm' | 'md' | 'lg'>('sm');
  const [avatarShape, setAvatarShape] = useState<'circle' | 'rounded'>('circle');
  const [avatarZoom, setAvatarZoom] = useState<number>(1);
  const [activeSourceTab, setActiveSourceTab] = useState<'upload' | 'preset' | 'url'>('upload');
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize local states with user profile when modal opens or user updates
  React.useEffect(() => {
    if (isOpen && user) {
      setPhotoUrl(user.fotoUrl || '');
      setAvatarSize(user.avatarSize || 'sm');
      setAvatarShape(user.avatarShape || 'circle');
      setAvatarZoom(user.avatarZoom || 1);
      setActiveSourceTab('upload');
      setCustomUrlInput('');
      setUploadError(null);
    }
  }, [isOpen, user]);

  // Early return after all hook declarations
  if (!isOpen || !user) return null;

  // Helper untuk kompresi dan penyesuaian ukuran gambar client-side (maks 360x360 px)
  const processImageFile = (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('Harap pilih berkas gambar yang valid (JPG, PNG, atau WebP).');
      return;
    }

    setIsProcessingFile(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Buat canvas untuk resize gambar agar ringan & proporsional
        const canvas = document.createElement('canvas');
        const MAX_DIM = 360;
        let width = img.width;
        let height = img.height;

        // Hitung scaling proporsional square crop
        const minDim = Math.min(width, height);
        const startX = (width - minDim) / 2;
        const startY = (height - minDim) / 2;

        canvas.width = MAX_DIM;
        canvas.height = MAX_DIM;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, MAX_DIM, MAX_DIM);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setPhotoUrl(compressedDataUrl);
          setAvatarZoom(1); // reset zoom saat foto baru masuk
        }
        setIsProcessingFile(false);
      };

      img.onerror = () => {
        setUploadError('Gagal memproses gambar. Format berkas tidak didukung.');
        setIsProcessingFile(false);
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      setUploadError('Gagal membaca berkas dari perangkat.');
      setIsProcessingFile(false);
    };

    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrlInput.trim()) return;
    setPhotoUrl(customUrlInput.trim());
    setCustomUrlInput('');
  };

  const handleRemovePhoto = () => {
    setPhotoUrl('');
    setAvatarZoom(1);
  };

  const handleSave = () => {
    const updated: UserProfile = {
      ...user,
      fotoUrl: photoUrl || undefined,
      avatarSize,
      avatarShape,
      avatarZoom,
    };
    onSaveUser(updated);
    onClose();
  };

  // Preview user object
  const previewUser: UserProfile = {
    ...user,
    fotoUrl: photoUrl || undefined,
    avatarSize,
    avatarShape,
    avatarZoom,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-850 to-orange-950 text-white flex items-center justify-between border-b border-orange-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-950/40 shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-snug">
                Ganti Foto Pengguna
              </h3>
              <p className="text-xs text-orange-200/90 leading-tight">
                Sesuaikan foto profil dan ukuran tampilan di sebelah nama Anda
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Section 1: Live Preview Simulating Top Bar Header */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Pratinjau di Sebelah Nama Pengguna:
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                {photoUrl ? 'Foto Aktif' : 'Inisial 2 Huruf'}
              </span>
            </div>

            {/* Simulated Header Button */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/90 shadow-xs">
              <div className="flex items-center gap-2.5">
                {/* Avatar Display */}
                <UserAvatar
                  user={previewUser}
                  size="auto"
                  shape="auto"
                  className="ring-2 ring-orange-500/30 shadow-xs"
                />

                {/* Name & Role to the right */}
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900 leading-tight">
                      {user.nama}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                        user.levelAkses === 'Admin'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-blue-100 text-blue-900 border border-blue-300'
                      }`}
                    >
                      {user.levelAkses || 'User'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 leading-tight">
                    {user.role} &bull; {wilayahShort}
                  </span>
                </div>
              </div>

              {photoUrl && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
                  title="Kembalikan ke inisial 2 huruf"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Foto</span>
                </button>
              )}
            </div>
          </div>

          {/* Section 2: Pilihan Sumber Foto (Upload / Preset / URL) */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Pilih / Masukkan Foto Pengguna:
            </label>

            {/* Tabs for Photo Source */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl mb-3">
              <button
                type="button"
                onClick={() => setActiveSourceTab('upload')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeSourceTab === 'upload'
                    ? 'bg-white text-orange-950 shadow-xs ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Unggah Foto</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSourceTab('preset')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeSourceTab === 'preset'
                    ? 'bg-white text-orange-950 shadow-xs ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Preset Galeri</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSourceTab('url')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeSourceTab === 'url'
                    ? 'bg-white text-orange-950 shadow-xs ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Tautan URL</span>
              </button>
            </div>

            {/* Tab 1: Upload File */}
            {activeSourceTab === 'upload' && (
              <div className="space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-6 border-2 border-dashed border-orange-300 hover:border-orange-500 rounded-2xl bg-orange-50/40 hover:bg-orange-50/80 text-center transition-all cursor-pointer group"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-xs">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">
                    Klik untuk memilih foto dari komputer / HP Anda
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Mendukung JPG, PNG, atau WebP. Gambar otomatis dioptimalkan agar ringan.
                  </p>
                </div>

                {uploadError && (
                  <p className="text-xs text-rose-600 font-medium">{uploadError}</p>
                )}
                {isProcessingFile && (
                  <p className="text-xs text-orange-600 font-medium">Sedang memproses dan mengoptimalkan gambar...</p>
                )}
              </div>
            )}

            {/* Tab 2: Preset Photo Gallery */}
            {activeSourceTab === 'preset' && (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-500">
                  Pilih salah satu contoh foto pengurus yang telah disediakan:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PRESET_AVATARS.map((preset) => {
                    const isSelected = photoUrl === preset.url;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setPhotoUrl(preset.url);
                          setAvatarZoom(1);
                        }}
                        className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                          isSelected
                            ? 'bg-orange-50 border-orange-500 ring-2 ring-orange-400/40 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.label}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200"
                        />
                        <div className="overflow-hidden">
                          <span className="text-[11px] font-bold text-slate-800 block truncate">
                            {preset.label}
                          </span>
                          <span className="text-[9px] text-slate-500 block">
                            {isSelected ? '✓ Terpilih' : 'Klik pakai'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 3: URL Input */}
            {activeSourceTab === 'url' && (
              <form onSubmit={handleApplyCustomUrl} className="flex gap-2">
                <input
                  type="url"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  placeholder="https://contoh.com/foto-pengurus.jpg"
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-orange-500 bg-white"
                />
                <button
                  type="submit"
                  disabled={!customUrlInput.trim()}
                  className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Terapkan
                </button>
              </form>
            )}
          </div>

          {/* Section 3: Penyesuaian Ukuran & Bentuk Foto Sesuai Kebutuhan */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Sliders className="w-3.5 h-3.5 text-orange-600" />
              <span>Pengaturan Ukuran & Tampilan (Sesuai Kebutuhan):</span>
            </div>

            {/* 1. Pengaturan Ukuran Avatar di Bilah Atas */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                Ukuran Foto di Bilah Atas (Sebelah Nama):
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setAvatarSize('sm')}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    avatarSize === 'sm'
                      ? 'bg-orange-500 text-white border-orange-600 font-bold shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 text-xs'
                  }`}
                >
                  <span className="block text-xs">Standar</span>
                  <span className="text-[10px] opacity-85">32 piksel</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAvatarSize('md')}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    avatarSize === 'md'
                      ? 'bg-orange-500 text-white border-orange-600 font-bold shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 text-xs'
                  }`}
                >
                  <span className="block text-xs">Sedang</span>
                  <span className="text-[10px] opacity-85">36 piksel</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAvatarSize('lg')}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    avatarSize === 'lg'
                      ? 'bg-orange-500 text-white border-orange-600 font-bold shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 text-xs'
                  }`}
                >
                  <span className="block text-xs">Besar</span>
                  <span className="text-[10px] opacity-85">40 piksel</span>
                </button>
              </div>
            </div>

            {/* 2. Pengaturan Bentuk Avatar (Bulat vs Kotak) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                Bentuk Bingkai Foto:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAvatarShape('circle')}
                  className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    avatarShape === 'circle'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-current" />
                  <span>Lingkaran Penuh</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAvatarShape('rounded')}
                  className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    avatarShape === 'rounded'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-3.5 h-3.5 rounded-md border-2 border-current" />
                  <span>Kotak Melengkung</span>
                </button>
              </div>
            </div>

            {/* 3. Slider Zoom / Perbesar Foto (Framing Wajah) */}
            {photoUrl && (
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                  <span className="flex items-center gap-1">
                    <ZoomIn className="w-3.5 h-3.5 text-orange-600" />
                    <span>Perbesar / Zoom Foto (Pas Wajah):</span>
                  </span>
                  <span className="text-orange-700 font-mono">
                    {Math.round(avatarZoom * 100)}%
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAvatarZoom((z) => Math.max(1, Number((z - 0.1).toFixed(2))))}
                    className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                    title="Perkecil"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>

                  <input
                    type="range"
                    min="1"
                    max="2"
                    step="0.05"
                    value={avatarZoom}
                    onChange={(e) => setAvatarZoom(parseFloat(e.target.value))}
                    className="flex-1 accent-orange-600 cursor-pointer"
                  />

                  <button
                    type="button"
                    onClick={() => setAvatarZoom((z) => Math.min(2, Number((z + 0.1).toFixed(2))))}
                    className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                    title="Perbesar"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setAvatarZoom(1)}
                    className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer text-[10px] font-bold"
                    title="Reset Zoom"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Batal
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-950/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-98"
            >
              <Check className="w-4 h-4" />
              <span>Simpan Foto Pengguna</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
