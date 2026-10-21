import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  SupabaseKasRow, 
  Transaction, 
  TransactionType,
  CategoryItem,
  SupabaseCategoryRow,
  UserProfile,
  PengurusRole,
  SupabasePengurusRow,
  DataWargaItem,
  SekretariatItem,
  InventarisItem,
  PeminjamanItem
} from '../types';

// Storage keys for user-configured credentials via UI
const STORAGE_KEY_URL = 'kas_rt_supabase_url';
const STORAGE_KEY_ANON = 'kas_rt_supabase_anon_key';
const STORAGE_KEY_PROJECT_NAME = 'kas_rt_supabase_project_name';

// Default / fallback placeholders (from Vite env if defined)
const ENV_SUPABASE_URL = (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_SUPABASE_URL ? (import.meta.env.VITE_SUPABASE_URL as string) : '') || '';
const ENV_SUPABASE_ANON_KEY = (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_SUPABASE_ANON_KEY ? (import.meta.env.VITE_SUPABASE_ANON_KEY as string) : '') || '';
const ENV_SUPABASE_PROJECT_NAME = (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_SUPABASE_PROJECT_NAME ? (import.meta.env.VITE_SUPABASE_PROJECT_NAME as string) : '') || '';

// Sample placeholder pattern check
export const isPlaceholderValue = (val: string): boolean => {
  if (!val) return true;
  const trimmed = val.trim().toLowerCase();
  return (
    trimmed === '' ||
    trimmed.includes('your-project') ||
    trimmed.includes('your-supabase') ||
    trimmed.includes('your-anon') ||
    trimmed.includes('anon-key-here') ||
    trimmed.includes('btahiaacjynvjkwfaree') ||
    trimmed.includes('daaqldpxfycjpuxrozjm') ||
    trimmed.includes('yajrxnzwbwtttnwxhrap') ||
    trimmed.includes('placeholder') ||
    trimmed.includes('my_app_url') ||
    trimmed.includes('my_gemini_api_key')
  );
};

/**
 * Membersihkan format URL Supabase agar tidak menimbulkan error PGRST125.
 * - Menghilangkan akhiran path seperti '/rest/v1', '/auth/v1'
 * - Menghilangkan trailing slash '/'
 * - Mendeteksi URL dashboard project dan mengubahnya ke domain API '*.supabase.co'
 * - Menghapus tanda petik atau spasi ekstra
 */
export const cleanSupabaseUrl = (input: string): string => {
  if (!input) return '';
  let url = input.trim();

  // Bersihkan tanda petik
  url = url.replace(/^["']+|["']+$/g, '').trim();

  // Jika pengguna menyalin URL dari halaman browser dashboard Supabase
  // misal: https://supabase.com/dashboard/project/abcdefghijklmnopqrst
  const dashboardMatch = url.match(/supabase\.(?:com|io)\/dashboard\/project\/([a-zA-Z0-9_-]+)/i);
  if (dashboardMatch && dashboardMatch[1]) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  // Tambahkan protocol https:// jika belum ada
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    // Jika domain resmi *.supabase.co, base URL selalu origin-nya
    if (parsed.hostname.toLowerCase().endsWith('.supabase.co')) {
      return parsed.origin;
    }

    // Untuk custom domain atau self-hosted:
    // Hapus path spesifik API PostgREST jika ada yang tertempel
    let pathname = parsed.pathname;
    pathname = pathname.replace(/\/rest\/v1\/?$/i, '');
    pathname = pathname.replace(/\/auth\/v1\/?$/i, '');
    pathname = pathname.replace(/\/storage\/v1\/?$/i, '');
    pathname = pathname.replace(/\/+$/, '');

    return `${parsed.origin}${pathname}`;
  } catch {
    // Fallback regex jika URL parser gagal
    return url
      .replace(/\/rest\/v1\/?$/i, '')
      .replace(/\/auth\/v1\/?$/i, '')
      .replace(/\/storage\/v1\/?$/i, '')
      .replace(/\/+$/, '');
  }
};

/**
 * Membersihkan API Anon Key dari tanda petik atau spasi
 */
export const cleanAnonKey = (input: string): string => {
  if (!input) return '';
  return input.trim().replace(/^["']+|["']+$/g, '').trim();
};

/**
 * Menerjemahkan error teknis Supabase (termasuk browser NetworkError / CORS / HTML responses / Invalid API key)
 * menjadi pesan berbahasa Indonesia yang ramah dan solutif.
 */
export const formatFriendlySupabaseError = (error: any): string => {
  if (!error) return 'Terjadi kendala tidak diketahui.';
  const msg = typeof error === 'string' ? error : (error.message || String(error));

  if (/Invalid API key|JWT|invalid claim|invalid_key|apikey|service_role/i.test(msg)) {
    return 'Kunci API (Anon Key) Supabase tidak valid. Menggunakan data lokal. Silakan perbarui Project URL & Anon Key di Pengaturan Supabase.';
  }
  if (msg.includes('<!doctype') || msg.includes('<html') || msg.includes('Starting Server') || msg.includes('502') || msg.includes('503')) {
    return 'Basis data Supabase belum tersambung atau server sedang bersiap. Menggunakan mode penyimpanan lokal.';
  }
  if (/ENOTFOUND|getaddrinfo|btahiaacjynvjkwfaree|daaqldpxfycjpuxrozjm|yajrxnzwbwtttnwxhrap/i.test(msg)) {
    return 'Alamat server basis data tidak dapat dijangkau. Menggunakan data lokal.';
  }
  if (/NetworkError|Failed to fetch|Network request failed|net::ERR_|Load failed/i.test(msg)) {
    return 'Koneksi ke basis data terhalang. Menggunakan data lokal.';
  }
  if (/PGRST125/i.test(msg)) {
    return "Format SUPABASE_URL tidak valid (Error PGRST125). Jangan sertakan '/rest/v1' di URL project.";
  }
  if (/42P01/i.test(msg)) {
    return "Tabel belum dibuat di database Supabase. Silakan jalankan script skema SQL di Supabase SQL Editor.";
  }
  if (/22P02/i.test(msg)) {
    return "Format ID data bukan UUID valid yang sesuai dengan skema tabel Supabase.";
  }
  return msg;
};

// Auto-detect if .env credentials have changed, and ensure .env values always take precedence
const checkAndSyncEnvironmentAndClearCache = () => {
  if (typeof window === 'undefined' || !window.localStorage) return;

  const LAST_ENV_URL_KEY = 'kas_rt_last_env_url';
  const LAST_ENV_KEY_KEY = 'kas_rt_last_env_key';

  // Purge any stale/defunct project references
  const storedUrl = localStorage.getItem(STORAGE_KEY_URL) || '';
  if (
    storedUrl.includes('btahiaacjynvjkwfaree') ||
    storedUrl.includes('daaqldpxfycjpuxrozjm') ||
    storedUrl.includes('yajrxnzwbwtttnwxhrap')
  ) {
    localStorage.removeItem(STORAGE_KEY_URL);
    localStorage.removeItem(STORAGE_KEY_ANON);
  }

  const cleanCurrentUrl = cleanSupabaseUrl(ENV_SUPABASE_URL);
  const cleanCurrentKey = cleanAnonKey(ENV_SUPABASE_ANON_KEY);

  // Jika URL di file .env tersedia dan valid, selalu sinkronkan ke memory browser (localStorage)
  // agar memory browser tidak tertinggal atau menimpa konfigurasi proyek resmi
  if (cleanCurrentUrl && !isPlaceholderValue(cleanCurrentUrl)) {
    localStorage.setItem(STORAGE_KEY_URL, cleanCurrentUrl);
    if (cleanCurrentKey && !isPlaceholderValue(cleanCurrentKey)) {
      localStorage.setItem(STORAGE_KEY_ANON, cleanCurrentKey);
    }
  }

  const lastSavedUrl = localStorage.getItem(LAST_ENV_URL_KEY) || '';
  const lastSavedKey = localStorage.getItem(LAST_ENV_KEY_KEY) || '';

  // If environment variables changed (or running for the first time with a valid config),
  // clear out stale local storage cache overrides so everything is cleanly fetched from the active database.
  if (
    cleanCurrentUrl && 
    cleanCurrentKey && 
    (lastSavedUrl !== cleanCurrentUrl || lastSavedKey !== cleanCurrentKey)
  ) {
    console.log('[SUPABASE ENV SYNC] Menggunakan konfigurasi database dari file .env proyek...');
    
    // Clear stale cached items to force a clean re-fetch from the database
    localStorage.removeItem('kas_rt_sekretariat');
    localStorage.removeItem('kas_rt_transactions');
    localStorage.removeItem('kas_rt_categories');
    localStorage.removeItem('kas_rt_categories_v2');
    localStorage.removeItem('kas_rt_pengurus');
    localStorage.removeItem('kas_rt_data_warga');
    localStorage.removeItem('rt_konfirmasi_kode');

    // Save the new signatures to prevent repeated wipes
    localStorage.setItem(LAST_ENV_URL_KEY, cleanCurrentUrl);
    localStorage.setItem(LAST_ENV_KEY_KEY, cleanCurrentKey);
  }
};

// Run the environment and cache check immediately upon module load
try {
  checkAndSyncEnvironmentAndClearCache();
} catch (e) {
  console.error('[EnvSync Error]', e);
}

/**
 * Mengambil konfigurasi aktif Supabase.
 * Menjamin 100% bahwa file .env proyek (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY & VITE_SUPABASE_PROJECT_NAME)
 * SELALU menjadi prioritas utama di semua browser dan tidak tertimpa oleh memory browser / localStorage lama.
 */
export const getActiveSupabaseConfig = (): { url: string; anonKey: string; projectName: string; isConfigured: boolean; isFromEnv: boolean } => {
  const cleanEnvUrl = cleanSupabaseUrl(ENV_SUPABASE_URL);
  const cleanEnvKey = cleanAnonKey(ENV_SUPABASE_ANON_KEY);
  const cleanEnvProjectName = ENV_SUPABASE_PROJECT_NAME.trim().replace(/^["']+|["']+$/g, '').trim();

  const hasValidEnvUrl = Boolean(cleanEnvUrl && !isPlaceholderValue(cleanEnvUrl));
  const hasValidEnvKey = Boolean(cleanEnvKey && !isPlaceholderValue(cleanEnvKey));

  let activeUrl = '';
  let activeAnonKey = '';
  let activeProjectName = '';
  let isFromEnv = false;

  // 1. PRIORITAS UTAMA: Selalu ambil dari file .env yang ada di proyek
  if (hasValidEnvUrl) {
    activeUrl = cleanEnvUrl;
    activeAnonKey = hasValidEnvKey ? cleanEnvKey : cleanAnonKey(localStorage.getItem(STORAGE_KEY_ANON) || '');
    activeProjectName = cleanEnvProjectName || 'RT.002 RW.09';
    isFromEnv = true;
  } else {
    // 2. FALLBACK: Jika .env belum diisi, gunakan inputan lokal jika ada
    let localUrl = '';
    let localAnon = '';
    let localProjectName = '';
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localUrl = localStorage.getItem(STORAGE_KEY_URL) || '';
        localAnon = localStorage.getItem(STORAGE_KEY_ANON) || '';
        localProjectName = localStorage.getItem(STORAGE_KEY_PROJECT_NAME) || '';
        if (
          localUrl.includes('btahiaacjynvjkwfaree') ||
          localUrl.includes('daaqldpxfycjpuxrozjm') ||
          localUrl.includes('yajrxnzwbwtttnwxhrap')
        ) {
          localStorage.removeItem(STORAGE_KEY_URL);
          localStorage.removeItem(STORAGE_KEY_ANON);
          localStorage.removeItem(STORAGE_KEY_PROJECT_NAME);
          localUrl = '';
          localAnon = '';
          localProjectName = '';
        }
      }
    } catch {}

    activeUrl = cleanSupabaseUrl(localUrl);
    activeAnonKey = cleanAnonKey(localAnon || cleanEnvKey);
    activeProjectName = localProjectName || cleanEnvProjectName || 'RT.002 RW.09';
    isFromEnv = false;
  }

  const isConfigured = !isPlaceholderValue(activeUrl) && !isPlaceholderValue(activeAnonKey);

  return {
    url: activeUrl,
    anonKey: activeAnonKey,
    projectName: activeProjectName,
    isConfigured,
    isFromEnv,
  };
};

/**
 * Custom fetch dengan mekanisme auto-healing & server-proxy fallback.
 * Jika browser mengalami NetworkError (misal: adblocker, tracking protection, CORS, iframe restriction),
 * request otomatis dialihkan lewat same-origin proxy `/api/db-query-service`.
 */
export const resilientFetch: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, init);
  } catch (err: any) {
    const errMessage = err?.message || String(err);
    const isNetworkError = /NetworkError|Failed to fetch|Network request failed|Load failed|net::ERR_|ENOTFOUND/i.test(errMessage);

    if (isNetworkError && typeof window !== 'undefined' && window.location) {
      console.warn('[Supabase ResilientFetch] Direct fetch gagal (' + errMessage + '). Mengalihkan request otomatis lewat same-origin proxy /api/db-query-service...');
      try {
        const rawUrl = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
        const parsed = new URL(rawUrl);
        const proxyUrl = `${window.location.origin}/api/db-query-service${parsed.pathname}${parsed.search}`;
        
        // Buat Headers baru secara aman tanpa mutasi langsung
        const headers = new Headers();
        if (init?.headers) {
          const incomingHeaders = new Headers(init.headers);
          incomingHeaders.forEach((value, key) => {
            headers.set(key, value);
          });
        }
        
        const { url: targetUrl } = getActiveSupabaseConfig();
        if (targetUrl && !targetUrl.includes('btahiaacjynvjkwfaree')) {
          headers.set('x-target-db-url', targetUrl);
        }

        // Susun options secara selektif agar tidak memicu error kloning di browser
        const fetchOptions: RequestInit = {
          method: init?.method || 'GET',
          headers,
          mode: init?.mode,
          credentials: init?.credentials,
          cache: init?.cache,
          redirect: init?.redirect,
        };
        if (init?.body !== undefined) {
          fetchOptions.body = init.body;
        }
        if (init?.signal) {
          fetchOptions.signal = init.signal;
        }

        return await fetch(proxyUrl, fetchOptions);
      } catch (proxyErr) {
        console.error('[Supabase Proxy Fallback Failed]', proxyErr);
        throw err;
      }
    }
    throw err;
  }
};

let clientInstance: SupabaseClient | null = null;
let currentClientUrl = '';
let currentClientKey = '';

// Create or return singleton Supabase client
export const getSupabase = (): SupabaseClient | null => {
  const { url, anonKey, isConfigured } = getActiveSupabaseConfig();

  if (!isConfigured) {
    clientInstance = null;
    return null;
  }

  if (clientInstance && currentClientUrl === url && currentClientKey === anonKey) {
    return clientInstance;
  }

  try {
    clientInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: window.sessionStorage,
      },
      global: {
        fetch: resilientFetch,
      },
    });
    currentClientUrl = url;
    currentClientKey = anonKey;
    return clientInstance;
  } catch (err) {
    console.error('[Supabase Init Error]', err);
    return null;
  }
};

// Save custom credentials from settings UI modal
export const setSupabaseCredentials = (url: string, anonKey: string): void => {
  const cleanedUrl = cleanSupabaseUrl(url);
  const cleanedAnon = cleanAnonKey(anonKey);
  localStorage.setItem(STORAGE_KEY_URL, cleanedUrl);
  localStorage.setItem(STORAGE_KEY_ANON, cleanedAnon);
  clientInstance = null; // force re-instantiation
};

// Reset custom credentials (reverts to env variables or demo)
export const resetSupabaseCredentials = (): void => {
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_ANON);
  clientInstance = null;
};

/**
 * Cek apakah string merupakan format UUID valid
 */
export const isUuid = (str?: string): boolean => {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str.trim());
};

// Mappers between Supabase 'kas_rt' table row and Frontend Transaction
export const mapRowToTransaction = (row: SupabaseKasRow): Transaction => {
  return {
    id: String(row.id),
    date: row.tanggal || new Date().toISOString().split('T')[0],
    type: (row.jenis === 'Keluar' ? 'Keluar' : 'Masuk') as TransactionType,
    category: row.kategori || 'Umum',
    amount: Number(row.jumlah) || 0,
    description: row.keterangan || '',
    status: 'Synced',
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    wargaId: row.warga_id,
  };
};

export const mapTransactionToRow = (tx: Partial<Transaction> & { id: string }): SupabaseKasRow => {
  return {
    id: tx.id,
    tanggal: tx.date || new Date().toISOString().split('T')[0],
    jenis: tx.type || 'Masuk',
    kategori: tx.category || 'Umum',
    jumlah: Number(tx.amount) || 0,
    keterangan: tx.description || '',
    warga_id: tx.wargaId,
  };
};

/* =========================================================================
   1. SELECT / FETCH Data dari Tabel 'kas_rt'
   ========================================================================= */
export const fetchKasFromSupabase = async (): Promise<{
  data: Transaction[] | null;
  error: string | null;
}> => {
  const client = getSupabase();
  if (!client) {
    return { data: null, error: 'Supabase credentials belum dikonfigurasi.' };
  }

  try {
    const { data, error } = await client
      .from('kas_rt')
      .select('*')
      .order('tanggal', { ascending: false });

    if (error) {
      if (/Invalid API key|JWT|invalid claim|invalid_key|apikey|service_role/i.test(error.message || '')) {
        console.warn('[Supabase API Key Notice]', error.message);
      } else {
        console.error('[Supabase Fetch Error]', error);
      }
      return { data: null, error: formatFriendlySupabaseError(error) };
    }

    const transactions = (data as SupabaseKasRow[]).map(mapRowToTransaction);
    return { data: transactions, error: null };
  } catch (err: any) {
    console.error('[Supabase Fetch Exception]', err);
    return { data: null, error: formatFriendlySupabaseError(err) };
  }
};

/* =========================================================================
   2. INSERT Data ke Tabel 'kas_rt'
   ========================================================================= */
export const insertKasToSupabase = async (
  tx: Omit<Transaction, 'createdAt' | 'status'>
): Promise<{
  data: Transaction | null;
  error: string | null;
}> => {
  const client = getSupabase();
  if (!client) {
    return { data: null, error: 'Supabase client tidak tersedia.' };
  }

  // Bangun payload baris.
  // Jangan sertakan ID jika ID adalah format custom string (seperti TRX-xxx),
  // agar PostgreSQL Supabase yang menggunakan kolom tipe UUID dapat men-generate
  // UUID secara otomatis (gen_random_uuid()) tanpa memicu error 22P02.
  const payload: Record<string, any> = {
    tanggal: tx.date || new Date().toISOString().split('T')[0],
    jenis: tx.type || 'Masuk',
    kategori: tx.category || 'Umum',
    jumlah: Number(tx.amount) || 0,
    keterangan: tx.description || '',
  };

  if (tx.wargaId && isUuid(tx.wargaId)) {
    payload.warga_id = tx.wargaId;
  }

  if (tx.id && isUuid(tx.id)) {
    payload.id = tx.id;
  }

  try {
    let { data, error } = await client
      .from('kas_rt')
      .insert([payload])
      .select()
      .single();

    // Fallback jika database mewajibkan ID (not-null tanpa default 23502)
    if (error && error.code === '23502' && !payload.id) {
      const generatedUuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined;
      if (generatedUuid) {
        payload.id = generatedUuid;
        const retryResult = await client
          .from('kas_rt')
          .insert([payload])
          .select()
          .single();
        data = retryResult.data;
        error = retryResult.error;
      }
    }

    if (error) {
      console.error('[Supabase Insert Error]', error);
      let message = error.message;
      if (error.code === '22P02') {
        message = 'Format data ID tidak sesuai dengan tipe UUID pada tabel Supabase (Error 22P02).';
      }
      return { data: null, error: message };
    }

    return { data: mapRowToTransaction(data as SupabaseKasRow), error: null };
  } catch (err: any) {
    console.error('[Supabase Insert Exception]', err);
    return { data: null, error: err.message || 'Gagal menyimpan transaksi ke Supabase' };
  }
};

/* =========================================================================
   3. UPDATE Data pada Tabel 'kas_rt'
   ========================================================================= */
export const updateKasInSupabase = async (
  tx: Transaction
): Promise<{
  data: Transaction | null;
  error: string | null;
}> => {
  const client = getSupabase();
  if (!client) {
    return { data: null, error: 'Supabase client tidak tersedia.' };
  }

  if (!isUuid(tx.id)) {
    return { data: { ...tx, status: 'Synced' }, error: null };
  }

  const row = mapTransactionToRow(tx);

  try {
    const { data, error } = await client
      .from('kas_rt')
      .update({
        tanggal: row.tanggal,
        jenis: row.jenis,
        kategori: row.kategori,
        jumlah: row.jumlah,
        keterangan: row.keterangan,
        warga_id: row.warga_id,
      })
      .eq('id', row.id)
      .select()
      .single();

    if (error) {
      console.error('[Supabase Update Error]', error);
      let message = error.message;
      if (error.code === '22P02') {
        message = `ID transaksi (${tx.id}) bukan UUID valid yang tersimpan di Supabase.`;
      }
      return { data: null, error: message };
    }

    return { data: mapRowToTransaction(data as SupabaseKasRow), error: null };
  } catch (err: any) {
    console.error('[Supabase Update Exception]', err);
    return { data: null, error: err.message || 'Gagal memperbarui data di Supabase' };
  }
};

/* =========================================================================
   4. DELETE Data dari Tabel 'kas_rt'
   ========================================================================= */
export const deleteKasFromSupabase = async (
  id: string
): Promise<{
  success: boolean;
  error: string | null;
}> => {
  const client = getSupabase();
  if (!client) {
    return { success: false, error: 'Supabase client tidak tersedia.' };
  }

  if (!isUuid(id)) {
    return { success: true, error: null };
  }

  try {
    const { error } = await client
      .from('kas_rt')
      .delete()
      .eq('id', id);

    if (error) {
      // Jika error 22P02 (misalnya menghapus ID demo lokal TRX-xxx pada tabel bertipe UUID)
      // abaikan karena baris tersebut memang tidak ada di Supabase
      if (error.code === '22P02') {
        console.warn(`[Supabase Delete Note] ID "${id}" bukan UUID, dilewati.`);
        return { success: true, error: null };
      }
      console.error('[Supabase Delete Error]', error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal menghapus data dari Supabase' };
  }
};

/**
 * Hapus seluruh catatan transaksi kas dari tabel 'kas_rt' di Supabase
 */
export const deleteAllKasFromSupabase = async (): Promise<{
  success: boolean;
  count: number;
  error: string | null;
}> => {
  const client = getSupabase();
  try {
    localStorage.setItem('kas_rt_transactions', JSON.stringify([]));
  } catch {}

  if (!client) {
    return { success: true, count: 0, error: null };
  }

  try {
    let { data, error } = await client
      .from('kas_rt')
      .delete()
      .or('id.neq.00000000-0000-0000-0000-000000000000,id.is.null')
      .select('id');

    if (error) {
      const retry = await client.from('kas_rt').delete().neq('id', '__non_existent__').select('id');
      if (!retry.error) {
        data = retry.data;
        error = null;
      }
    }

    if (error && error.code !== '42P01') {
      console.error('[Supabase Delete All Kas Error]', error);
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: data?.length || 0, error: null };
  } catch (err: any) {
    console.error('[Supabase Delete All Exception]', err);
    return { success: false, count: 0, error: err.message || 'Gagal mengosongkan tabel kas_rt' };
  }
};

/**
 * Hapus transaksi kas berdasarkan bulan dan tahun tertentu dari tabel 'kas_rt'
 */
export const deleteKasByMonthFromSupabase = async (
  year: number,
  month: number
): Promise<{
  success: boolean;
  count: number;
  error: string | null;
}> => {
  const client = getSupabase();
  if (!client) {
    return { success: false, count: 0, error: 'Supabase client tidak tersedia.' };
  }

  try {
    const mStr = String(month).padStart(2, '0');
    const startDate = `${year}-${mStr}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${mStr}-${String(lastDay).padStart(2, '0')}`;

    const { data, error } = await client
      .from('kas_rt')
      .delete()
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .select('id');

    if (error) {
      console.error('[Supabase Delete Kas By Month Error]', error);
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: data?.length || 0, error: null };
  } catch (err: any) {
    console.error('[Supabase Delete Kas By Month Exception]', err);
    return {
      success: false,
      count: 0,
      error: err.message || `Gagal menghapus data kas bulan ${month}/${year}`,
    };
  }
};

/* =========================================================================
   5. TEST CONNECTION & SETUP HELPER
   ========================================================================= */
export const testSupabaseConnection = async (
  testUrl?: string,
  testKey?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const rawUrl = testUrl !== undefined ? testUrl : getActiveSupabaseConfig().url;
    const rawKey = testKey !== undefined ? testKey : getActiveSupabaseConfig().anonKey;

    const url = cleanSupabaseUrl(rawUrl);
    const key = cleanAnonKey(rawKey);

    if (!url || !key || isPlaceholderValue(url) || isPlaceholderValue(key)) {
      return {
        success: false,
        message: 'Harap masukkan SUPABASE_URL dan SUPABASE_ANON_KEY yang valid.',
      };
    }

    const testClient = createClient(url, key, {
      auth: { persistSession: false },
      global: { fetch: resilientFetch },
    });

    // Check table accessibility
    const { error } = await testClient
      .from('kas_rt')
      .select('id')
      .limit(1);

    if (error) {
      if (error.code === 'PGRST125') {
        return {
          success: false,
          message:
            "Format SUPABASE_URL tidak valid (Error PGRST125). Jangan sertakan '/rest/v1' atau akhiran path lainnya. Gunakan format: https://<project-ref>.supabase.co",
        };
      }
      if (error.code === '42P01') {
        return {
          success: false,
          message:
            "Terkoneksi ke Supabase, namun tabel 'kas_rt' belum dibuat! Gunakan tombol 'Salin SQL Schema' untuk membuatnya di Supabase SQL Editor.",
        };
      }
      return {
        success: false,
        message: formatFriendlySupabaseError(error),
      };
    }

    return {
      success: true,
      message: "Koneksi berhasil! Tabel 'kas_rt' terdeteksi dan siap digunakan.",
    };
  } catch (err: any) {
    return {
      success: false,
      message: formatFriendlySupabaseError(err),
    };
  }
};

// SQL Schema for user to run in Supabase SQL Editor
export const SUPABASE_SQL_SCHEMA = `-- =========================================================================
-- SKEMA DATABASE KAS RT (Tabel Sekretariat, Kas RT, Kategori, Pengurus & Data Warga)
-- Jalankan seluruh query ini di Supabase SQL Editor:
-- =========================================================================

-- 1. Tabel Master Kategori Kas RT (Pos Penerimaan & Pengeluaran)
CREATE TABLE IF NOT EXISTS kategori (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('Masuk', 'Keluar')),
  deskripsi TEXT,
  wajib BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(nama, jenis)
);

-- Pastikan kolom wajib tersedia jika tabel kategori sudah dibuat sebelumnya
ALTER TABLE kategori ADD COLUMN IF NOT EXISTS wajib BOOLEAN DEFAULT false;

ALTER TABLE kategori ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Akses Publik Kategori" ON kategori;
CREATE POLICY "Akses Publik Kategori" 
  ON kategori 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 2. Tabel Buku Transaksi Kas RT
CREATE TABLE IF NOT EXISTS kas_rt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal DATE NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('Masuk', 'Keluar')),
  kategori TEXT NOT NULL,
  jumlah NUMERIC NOT NULL,
  keterangan TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE kas_rt ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Akses Publik Kas RT" ON kas_rt;
CREATE POLICY "Akses Publik Kas RT" 
  ON kas_rt 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 3. Tabel Data Pengguna / Pengurus & Warga RT (Hak Akses Admin & User)
-- Catatan: Jika sebelumnya tabel Anda bernama 'pengurus', Anda dapat menjalankan:
-- ALTER TABLE IF EXISTS pengurus RENAME TO pengguna;
CREATE TABLE IF NOT EXISTS pengguna (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  jabatan TEXT NOT NULL,
  level_akses TEXT NOT NULL DEFAULT 'User' CHECK (level_akses IN ('Admin', 'User')),
  no_hp TEXT,
  no_kk VARCHAR(16),
  warga_id UUID,
  nik VARCHAR(16),
  alamat_domisili TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Pastikan kolom relasi data warga ada di tabel pengguna jika tabel sudah dibuat sebelumnya
ALTER TABLE pengguna ADD COLUMN IF NOT EXISTS no_kk VARCHAR(16);
ALTER TABLE pengguna ADD COLUMN IF NOT EXISTS warga_id UUID;
ALTER TABLE pengguna ADD COLUMN IF NOT EXISTS nik VARCHAR(16);
ALTER TABLE pengguna ADD COLUMN IF NOT EXISTS alamat_domisili TEXT;
ALTER TABLE pengguna ADD COLUMN IF NOT EXISTS no_hp TEXT;

ALTER TABLE pengguna ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Akses Publik Pengguna" ON pengguna;
CREATE POLICY "Akses Publik Pengguna" 
  ON pengguna 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 4. Tabel Data Kependudukan & Warga RT (Data Warga)
CREATE TABLE IF NOT EXISTS data_warga (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no_kk VARCHAR(16) NOT NULL,
  nik VARCHAR(16) UNIQUE NOT NULL,
  nama_lengkap TEXT NOT NULL,
  jenis_kelamin TEXT CHECK (jenis_kelamin IN ('Laki-laki', 'Perempuan')),
  tempat_lahir TEXT,
  tanggal_lahir DATE,
  agama TEXT,
  pendidikan TEXT,
  pekerjaan TEXT,
  status_perkawinan TEXT CHECK (status_perkawinan IN ('Belum Kawin', 'Kawin', 'Cerai Hidup', 'Cerai Mati')),
  alamat_domisili TEXT NOT NULL,
  no_hp VARCHAR(20),
  status_warga TEXT CHECK (status_warga IN ('Warga Tetap', 'Warga Pendatang/Kontrak', 'Warga Kos')),
  catatan TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_data_warga_nik ON data_warga (nik);
CREATE INDEX IF NOT EXISTS idx_data_warga_no_kk ON data_warga (no_kk);
CREATE INDEX IF NOT EXISTS idx_data_warga_nama ON data_warga (nama_lengkap);

ALTER TABLE data_warga ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Akses Publik Data Warga" ON data_warga;
CREATE POLICY "Akses Publik Data Warga" 
  ON data_warga 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 5. Hubungkan tabel kas_rt dengan data_warga menggunakan warga_id
ALTER TABLE kas_rt ADD COLUMN IF NOT EXISTS warga_id UUID REFERENCES data_warga(id) ON DELETE SET NULL;

-- 6. Tabel Data Wilayah & Sekretariat RT (5 Kolom: RT, RW, Kelurahan, Kecamatan, Alamat)
CREATE TABLE IF NOT EXISTS sekretariat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rt VARCHAR(10) NOT NULL,
  rw VARCHAR(10) NOT NULL,
  kelurahan VARCHAR(100) NOT NULL,
  kecamatan VARCHAR(100) NOT NULL,
  alamat TEXT NOT NULL
);

-- View Alias "Sekretariat" (Mendukung query dengan huruf kapital "Sekretariat")
CREATE OR REPLACE VIEW "Sekretariat" AS SELECT * FROM sekretariat;

ALTER TABLE sekretariat ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Akses Publik Sekretariat" ON sekretariat;
CREATE POLICY "Akses Publik Sekretariat" 
  ON sekretariat 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 7. Tabel Peringatan Darurat / Siren SOS RT.002 RW.09
CREATE TABLE IF NOT EXISTS darurat_rt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_warga UUID NOT NULL,
  nama_warga TEXT NOT NULL,
  alamat TEXT NOT NULL,
  no_hp TEXT,
  tipe_darurat TEXT NOT NULL, -- 'Medis/Kesehatan', 'Keamanan/Maling', 'Kebakaran', 'Bencana Alam', 'Lainnya'
  status TEXT NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Selesai')),
  keterangan TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE darurat_rt ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Akses Publik Darurat RT" ON darurat_rt;
CREATE POLICY "Akses Publik Darurat RT" 
  ON darurat_rt 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 8. Tabel Inventaris & Aset RT
CREATE TABLE IF NOT EXISTS inventaris_rt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_barang TEXT NOT NULL,
  jumlah_total INTEGER NOT NULL DEFAULT 1,
  jumlah_baik INTEGER NOT NULL DEFAULT 1,
  jumlah_rusak INTEGER NOT NULL DEFAULT 0,
  kondisi TEXT,
  lokasi_penyimpanan TEXT,
  catatan TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE inventaris_rt ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Akses Publik Inventaris RT" ON inventaris_rt;
CREATE POLICY "Akses Publik Inventaris RT" 
  ON inventaris_rt 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 9. Tabel Log Peminjaman Aset RT
CREATE TABLE IF NOT EXISTS peminjaman_aset_rt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_barang UUID NOT NULL REFERENCES inventaris_rt(id) ON DELETE CASCADE,
  id_warga UUID NOT NULL,
  tanggal_pinjam DATE NOT NULL,
  tanggal_kembali DATE,
  jumlah_pinjam INTEGER NOT NULL DEFAULT 1,
  keperluan TEXT,
  status TEXT NOT NULL CHECK (status IN ('Dipinjam', 'Kembali')),
  catatan TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE peminjaman_aset_rt ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Akses Publik Peminjaman Aset RT" ON peminjaman_aset_rt;
CREATE POLICY "Akses Publik Peminjaman Aset RT" 
  ON peminjaman_aset_rt 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
`;

// Dedicated Script for Sekretariat table only (5 Kolom: RT, RW, Kelurahan, Kecamatan, Alamat)
export const SEKRETARIAT_SQL_SCHEMA = `-- =========================================================================
-- SCRIPT SQL: TABEL SEKRETARIAT RT (5 KOLOM: RT, RW, KELURAHAN, KECAMATAN, ALAMAT)
-- =========================================================================
CREATE TABLE IF NOT EXISTS sekretariat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rt VARCHAR(10) NOT NULL,
  rw VARCHAR(10) NOT NULL,
  kelurahan VARCHAR(100) NOT NULL,
  kecamatan VARCHAR(100) NOT NULL,
  alamat TEXT NOT NULL
);

-- View alias dengan huruf kapital "Sekretariat"
CREATE OR REPLACE VIEW "Sekretariat" AS SELECT * FROM sekretariat;

ALTER TABLE sekretariat ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Akses Publik Sekretariat" ON sekretariat;
CREATE POLICY "Akses Publik Sekretariat" 
  ON sekretariat 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
`;

/* =========================================================================
   6. SEED INITIAL TRANSACTIONS HELPER
   ========================================================================= */
export const seedInitialTransactionsToSupabase = async (
  seedData: Transaction[]
): Promise<{ success: boolean; count: number; error: string | null }> => {
  const client = getSupabase();
  if (!client) return { success: false, count: 0, error: 'Supabase client tidak tersedia.' };

  try {
    const rows = seedData.map((tx) => {
      const row: Record<string, any> = {
        tanggal: tx.date || new Date().toISOString().split('T')[0],
        jenis: tx.type || 'Masuk',
        kategori: tx.category || 'Umum',
        jumlah: Number(tx.amount) || 0,
        keterangan: tx.description || '',
      };
      if (tx.id && isUuid(tx.id)) {
        row.id = tx.id;
      }
      return row;
    });

    const { data, error } = await client
      .from('kas_rt')
      .insert(rows)
      .select();

    if (error) {
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: data?.length || rows.length, error: null };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message || 'Gagal memasukkan data awal' };
  }
};

/* =========================================================================
   7. BATCH INSERT TRANSAKSI (UNTUK FITUR IMPORT EXCEL)
   ========================================================================= */
export const insertMultipleKasToSupabase = async (
  transactions: Transaction[]
): Promise<{ success: boolean; insertedCount: number; error: string | null }> => {
  const client = getSupabase();
  if (!client) {
    return { success: false, insertedCount: 0, error: 'Supabase client tidak tersedia.' };
  }

  try {
    const rows = transactions.map((tx) => {
      const row: Record<string, any> = {
        tanggal: tx.date || new Date().toISOString().split('T')[0],
        jenis: tx.type === 'Keluar' ? 'Keluar' : 'Masuk',
        kategori: tx.category || 'Umum',
        jumlah: Number(tx.amount) || 0,
        keterangan: tx.description || '',
      };
      if (tx.wargaId && isUuid(tx.wargaId)) {
        row.warga_id = tx.wargaId;
      }
      if (tx.id && isUuid(tx.id)) {
        row.id = tx.id;
      }
      return row;
    });

    // Masukkan dalam pecahan batch 50 baris agar aman dari limit payload
    const chunkSize = 50;
    let totalInserted = 0;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { data, error } = await client
        .from('kas_rt')
        .insert(chunk)
        .select('id');

      if (error) {
        console.error('[Supabase Bulk Insert Error]', error);
        return {
          success: totalInserted > 0,
          insertedCount: totalInserted,
          error: `Gagal menyimpan ke Supabase: ${error.message}`,
        };
      }
      totalInserted += data?.length || chunk.length;
    }

    return { success: true, insertedCount: totalInserted, error: null };
  } catch (err: any) {
    return {
      success: false,
      insertedCount: 0,
      error: err.message || 'Gagal menyimpan transaksi ke Supabase',
    };
  }
};

/**
 * Mengosongkan seluruh isi tabel 'kas_rt' di Supabase (untuk mode Replace pada fitur Restore / Import)
 */
export const clearKasInSupabase = async (): Promise<{ success: boolean; error: string | null }> => {
  const client = getSupabase();
  if (!client) {
    return { success: false, error: 'Supabase client tidak tersedia.' };
  }

  try {
    const { error } = await client
      .from('kas_rt')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.error('[Supabase Clear kas_rt Error]', error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Gagal mengosongkan data kas di Supabase',
    };
  }
};

/* =========================================================================
   8. MANAJEMEN KATEGORI KAS DI SUPABASE (TABEL: kategori)
   ========================================================================= */

// Skema SQL khusus untuk tabel master kategori
export const KATEGORI_SQL_SCHEMA = `-- Skema Master Pos Kategori Kas RT (Dengan Kolom Wajib & Nominal Iuran)
-- JALANKAN INI UNTUK MENAMBAH KOLOM 'wajib' JIKA TABEL SUDAH ADA:
-- ALTER TABLE kategori ADD COLUMN IF NOT EXISTS wajib BOOLEAN DEFAULT false;
-- JALANKAN INI UNTUK MENAMBAH KOLOM 'nominal' JIKA TABEL SUDAH ADA:
-- ALTER TABLE kategori ADD COLUMN IF NOT EXISTS nominal NUMERIC DEFAULT 0;

CREATE TABLE IF NOT EXISTS kategori (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('Masuk', 'Keluar')),
  deskripsi TEXT,
  wajib BOOLEAN DEFAULT false,
  nominal NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(nama, jenis)
);

ALTER TABLE kategori ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Akses Publik Kategori" ON kategori;
CREATE POLICY "Akses Publik Kategori" 
  ON kategori 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
`;

let detectedCategoryTable: 'kategori' | 'kategori_kas' = 'kategori';

export const getCategoryTableName = (): 'kategori' | 'kategori_kas' => {
  return detectedCategoryTable;
};

export const mapCategoryRowToItem = (row: any): CategoryItem => {
  if (!row) {
    return {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cat-${Date.now()}`,
      name: 'Kategori',
      type: 'Masuk',
      description: '',
      createdAt: new Date().toISOString(),
      wajib: false,
      nominal: 0,
    };
  }
  return {
    id: String(row.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cat-${Date.now()}`)),
    name: String(row.nama || row.name || row.kategori || '').trim(),
    type: (row.jenis === 'Keluar' || row.type === 'Keluar') ? 'Keluar' : 'Masuk',
    description: String(row.deskripsi || row.description || ''),
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    wajib: row.wajib === true || row.wajib === 'Y' || row.wajib === 'Yes' || String(row.wajib).toLowerCase() === 'true',
    nominal: typeof row.nominal === 'number' ? row.nominal : (Number(row.nominal) || 0),
  };
};

/**
 * Memeriksa apakah suatu jenis kategori sedang digunakan oleh data transaksi di tabel 'kas_rt'.
 * Aturan Sistem: Kategori yang sedang digunakan TIDAK BOLEH dihapus demi menjaga konsistensi pembukuan kas.
 */
export const checkCategoryUsedInKas = async (
  categoryName: string,
  categoryType?: TransactionType
): Promise<{
  isUsed: boolean;
  count: number;
  error: string | null;
}> => {
  const client = getSupabase();
  if (!client) {
    return { isUsed: false, count: 0, error: 'Supabase client tidak tersedia.' };
  }

  try {
    let query = client
      .from('kas_rt')
      .select('id', { count: 'exact', head: true })
      .eq('kategori', categoryName.trim());

    if (categoryType) {
      query = query.eq('jenis', categoryType);
    }

    const { count, error } = await query;
    if (error) {
      console.warn('[Check Category Usage Error]', error);
      return { isUsed: false, count: 0, error: error.message };
    }

    const total = count || 0;
    return { isUsed: total > 0, count: total, error: null };
  } catch (err: any) {
    return { isUsed: false, count: 0, error: err.message };
  }
};

/**
 * Mengambil seluruh daftar kategori dari tabel 'kategori' (atau 'kategori_kas') di Supabase.
 */
export const fetchCategoriesFromSupabase = async (): Promise<{
  data: CategoryItem[] | null;
  error: string | null;
  tableNotCreated?: boolean;
}> => {
  const client = getSupabase();
  if (!client) {
    return { data: null, error: 'Supabase client tidak tersedia.' };
  }

  try {
    // Coba tabel 'kategori' terlebih dahulu
    let targetTable: 'kategori' | 'kategori_kas' = 'kategori';
    let { data, error } = await client
      .from('kategori')
      .select('*');

    // Jika tabel 'kategori' belum ada (42P01), coba tabel 'kategori_kas' sebagai fallback
    if (error && error.code === '42P01') {
      const fallbackRes = await client
        .from('kategori_kas')
        .select('*');

      if (!fallbackRes.error) {
        data = fallbackRes.data;
        error = null;
        targetTable = 'kategori_kas';
      }
    }

    detectedCategoryTable = targetTable;

    if (error) {
      if (error.code === '42P01') {
        return {
          data: null,
          error: "Tabel 'kategori' belum dibuat di Supabase.",
          tableNotCreated: true,
        };
      }
      return { data: null, error: formatFriendlySupabaseError(error) };
    }

    const categories: CategoryItem[] = (data || []).map((row: any) =>
      mapCategoryRowToItem(row)
    );

    // Urutkan kategori: Masuk dulu lalu Keluar, kemudian nama A-Z
    categories.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'Masuk' ? -1 : 1;
      return a.name.localeCompare(b.name, 'id');
    });

    return { data: categories, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err.message || 'Gagal mengambil data kategori dari Supabase',
    };
  }
};

/**
 * Menambahkan kategori baru ke tabel 'kategori' di Supabase.
 * Dilengkapi kemampuan otomatis mengenali tabel ('kategori' / 'kategori_kas')
 * dan nama kolom (Indonesia: nama, jenis / English: name, type).
 */
export const createCategoryInSupabase = async (
  category: Omit<CategoryItem, 'id'> & { id?: string }
): Promise<{
  data: CategoryItem | null;
  error: string | null;
  tableNotCreated?: boolean;
}> => {
  const client = getSupabase();
  if (!client) {
    return { data: null, error: 'Supabase client tidak tersedia.' };
  }

  const cleanName = category.name.trim();
  const cleanType = category.type;
  const cleanDesc = category.description?.trim() || null;
  const cleanWajib = category.wajib ? true : false;
  const cleanNominal = category.nominal ?? 0;

  // Siapkan payload dengan format kolom bahasa Indonesia
  const indoPayload: Record<string, any> = {
    nama: cleanName,
    jenis: cleanType,
    deskripsi: cleanDesc,
    wajib: cleanWajib,
    nominal: cleanNominal,
  };

  // Siapkan payload alternatif dengan format kolom bahasa Inggris jika dibuat via UI Supabase
  const engPayload: Record<string, any> = {
    name: cleanName,
    type: cleanType,
    description: cleanDesc,
    wajib: cleanWajib,
    nominal: cleanNominal,
  };

  if (category.id && isUuid(category.id)) {
    indoPayload.id = category.id;
    engPayload.id = category.id;
  }

  // Prioritaskan tabel terdeteksi, kemudian tabel alternatif
  const tablesToTry: Array<'kategori' | 'kategori_kas'> =
    detectedCategoryTable === 'kategori'
      ? ['kategori', 'kategori_kas']
      : ['kategori_kas', 'kategori'];

  let lastError: any = null;

  for (const table of tablesToTry) {
    try {
      // 1. Coba format kolom Indonesia (nama, jenis, deskripsi)
      let { data, error } = await client
        .from(table)
        .insert([indoPayload])
        .select();

      // 2. Jika kolom "nama" tidak dikenali (error 42703), coba format kolom English (name, type)
      if (error && error.code === '42703') {
        const engRes = await client
          .from(table)
          .insert([engPayload])
          .select();
        if (!engRes.error) {
          data = engRes.data;
          error = null;
        } else {
          error = engRes.error;
        }
      }

      if (!error) {
        detectedCategoryTable = table;
        const createdRow = data && data.length > 0 ? data[0] : { ...indoPayload, id: category.id || crypto.randomUUID() };
        return {
          data: mapCategoryRowToItem(createdRow),
          error: null,
        };
      }

      lastError = error;

      // Jika error 42P01 (relation does not exist), coba tabel berikutnya di perulangan
      if (error.code === '42P01') {
        continue;
      } else {
        // Jika error validasi atau RLS, hentikan perulangan
        break;
      }
    } catch (tryErr: any) {
      lastError = tryErr;
    }
  }

  if (lastError) {
    console.error('[Supabase Create Category Error]', lastError);
    if (lastError.code === '23505') {
      return {
        data: null,
        error: `Kategori "${cleanName}" untuk "${cleanType === 'Masuk' ? 'Kas Masuk' : 'Kas Keluar'}" sudah ada di database.`,
      };
    }
    if (lastError.code === '42P01') {
      return {
        data: null,
        tableNotCreated: true,
        error: "Tabel 'kategori' belum dibuat di database Supabase Anda. Silakan salin dan jalankan skema SQL di Supabase SQL Editor.",
      };
    }
    if (lastError.code === '42501') {
      return {
        data: null,
        error: "Izin simpan ditolak oleh Row Level Security (RLS) Supabase untuk tabel 'kategori'. Pastikan policy akses publik telah ditambahkan di Supabase.",
      };
    }
    return {
      data: null,
      error: lastError.message || 'Gagal menambahkan kategori ke Supabase.',
    };
  }

  return { data: null, error: 'Gagal menambahkan kategori ke database Supabase.' };
};

/**
 * Mengubah nama/deskripsi kategori di tabel 'kategori' dan memperbarui riwayat transaksi terkait di 'kas_rt'.
 */
export const updateCategoryInSupabase = async (
  category: CategoryItem,
  oldName?: string
): Promise<{
  data: CategoryItem | null;
  error: string | null;
}> => {
  const client = getSupabase();
  if (!client) {
    return { data: null, error: 'Supabase client tidak tersedia.' };
  }

  try {
    const table = detectedCategoryTable;
    const cleanName = category.name.trim();
    const cleanType = category.type;
    const cleanDesc = category.description?.trim() || null;
    const cleanWajib = category.wajib ? true : false;
    const cleanNominal = category.nominal ?? 0;

    // 1. Coba update kolom bahasa Indonesia
    let updateRes = await client
      .from(table)
      .update({
        nama: cleanName,
        jenis: cleanType,
        deskripsi: cleanDesc,
        wajib: cleanWajib,
        nominal: cleanNominal,
      })
      .eq(isUuid(category.id) ? 'id' : 'nama', isUuid(category.id) ? category.id : (oldName || cleanName))
      .select();

    // 2. Coba fallback format kolom English jika error 42703
    if (updateRes.error && updateRes.error.code === '42703') {
      updateRes = await client
        .from(table)
        .update({
          name: cleanName,
          type: cleanType,
          description: cleanDesc,
          wajib: cleanWajib,
          nominal: cleanNominal,
        })
        .eq(isUuid(category.id) ? 'id' : 'name', isUuid(category.id) ? category.id : (oldName || cleanName))
        .select();
    }

    if (updateRes.error) {
      console.error('[Supabase Update Category Error]', updateRes.error);
      return { data: null, error: updateRes.error.message };
    }

    // Jika nama kategori berubah, perbarui juga kolom kategori di tabel kas_rt secara otomatis
    if (oldName && oldName.trim() !== cleanName) {
      await client
        .from('kas_rt')
        .update({ kategori: cleanName })
        .eq('kategori', oldName.trim())
        .eq('jenis', cleanType);
    }

    const updatedRow = updateRes.data && updateRes.data.length > 0 ? updateRes.data[0] : category;
    return {
      data: mapCategoryRowToItem(updatedRow),
      error: null,
    };
  } catch (err: any) {
    return {
      data: null,
      error: err.message || 'Gagal mengubah kategori di Supabase',
    };
  }
};

/**
 * Menghapus kategori dari Supabase.
 * PENTING: Sebelum menghapus, sistem memastikan jenis kategori TIDAK SEDANG DIGUNAKAN di tabel 'kas_rt'.
 * Jika sedang terpakai, penghapusan DITOLAK demi integritas data kas RT.
 */
export const deleteCategoryFromSupabase = async (
  id: string,
  name?: string,
  type?: TransactionType
): Promise<{
  success: boolean;
  isUsed?: boolean;
  usedCount?: number;
  error: string | null;
}> => {
  const client = getSupabase();
  if (!client) {
    return { success: false, error: 'Supabase client tidak tersedia.' };
  }

  try {
    const table = detectedCategoryTable;
    let catName = name;
    let catType = type;

    // Jika nama atau jenis belum lengkap, cari dulu dari baris kategori
    if (!catName || !catType) {
      const { data: catData } = await client
        .from(table)
        .select('nama, jenis')
        .eq('id', id)
        .maybeSingle();

      if (catData) {
        catName = catData.nama;
        catType = catData.jenis as TransactionType;
      }
    }

    // VERIFIKASI KEBERADAAN TRANSAKSI DI TABEL kas_rt:
    // Pastikan kategori tidak sedang terpakai di transaksi kas
    if (catName) {
      const checkResult = await checkCategoryUsedInKas(catName, catType);
      if (checkResult.isUsed && checkResult.count > 0) {
        return {
          success: false,
          isUsed: true,
          usedCount: checkResult.count,
          error: `Kategori "${catName}" (${catType || 'Kas'}) tidak dapat dihapus karena sedang digunakan oleh ${checkResult.count} data transaksi di tabel 'kas_rt'. Harap ubah atau hapus transaksi terkait terlebih dahulu.`,
        };
      }
    }

    let deleteQuery = client.from(table).delete();

    if (isUuid(id)) {
      deleteQuery = deleteQuery.eq('id', id);
    } else if (catName && catType) {
      deleteQuery = deleteQuery.eq('nama', catName).eq('jenis', catType);
    } else {
      return { success: false, error: 'ID atau nama kategori tidak valid.' };
    }

    const { error } = await deleteQuery;
    if (error) {
      console.error('[Supabase Delete Category Error]', error);
      return { success: false, error: error.message };
    }

    return { success: true, isUsed: false, usedCount: 0, error: null };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Gagal menghapus kategori dari Supabase',
    };
  }
};

/**
 * Menanamkan daftar kategori awal jika tabel kategori di Supabase masih kosong.
 */
export const seedInitialCategoriesToSupabase = async (
  seedCategories: CategoryItem[]
): Promise<{
  success: boolean;
  count: number;
  error: string | null;
}> => {
  const client = getSupabase();
  if (!client) {
    return { success: false, count: 0, error: 'Supabase client tidak tersedia.' };
  }

  try {
    const table = detectedCategoryTable;
    const rowsIndo = seedCategories.map((c) => ({
      nama: c.name.trim(),
      jenis: c.type,
      deskripsi: c.description || null,
      wajib: c.wajib ? true : false,
      nominal: c.nominal ?? 0,
    }));

    let { data, error } = await client
      .from(table)
      .upsert(rowsIndo, { onConflict: 'nama,jenis' })
      .select('id');

    if (error && error.code === '42703') {
      const rowsEng = seedCategories.map((c) => ({
        name: c.name.trim(),
        type: c.type,
        description: c.description || null,
        wajib: c.wajib ? true : false,
        nominal: c.nominal ?? 0,
      }));
      const engRes = await client
        .from(table)
        .upsert(rowsEng, { onConflict: 'name,type' })
        .select('id');
      if (!engRes.error) {
        data = engRes.data;
        error = null;
      }
    }

    if (error) {
      console.error('[Supabase Seed Categories Error]', error);
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: data?.length || rowsIndo.length, error: null };
  } catch (err: any) {
    return {
      success: false,
      count: 0,
      error: err.message || 'Gagal menginisialisasi kategori awal ke Supabase',
    };
  }
};

// ==============================================================================
// AUTHENTICATION & PENGURUS PROFILE HELPERS (TABEL: pengurus)
// ==============================================================================

const STORAGE_KEY_ACTIVE_USER = 'kas_rt_active_user';
const STORAGE_KEY_REGISTERED_USERS = 'kas_rt_registered_users';

export interface StoredUserCredential {
  profile: UserProfile;
  password?: string;
}

export const getInitials = (name: string): string => {
  if (!name) return 'RT';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Mendapatkan daftar seluruh akun pengurus yang terdaftar di perangkat lokal
 */
export const getLocalRegisteredUsers = (): StoredUserCredential[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REGISTERED_USERS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[GetLocalRegisteredUsers Error]', err);
  }

  // Akun bawaan (default)
  const defaultAccounts: StoredUserCredential[] = [
    {
      profile: {
        id: 'bendahara-rt02-default',
        email: 'bendahara@rt02.id',
        nama: 'Bendahara Kas RT',
        role: 'Bendahara',
        levelAkses: 'Admin',
        avatarInitials: '02',
        isDemo: true,
      },
      password: 'admin123',
    },
    {
      profile: {
        id: 'ketua-rt-default',
        email: 'ketua@rt.id',
        nama: 'Ketua RT',
        role: 'Ketua RT',
        levelAkses: 'Admin',
        avatarInitials: 'RT',
        isDemo: true,
      },
      password: 'admin123',
    },
    {
      profile: {
        id: 'warga-rt-default',
        email: 'warga@rt.id',
        nama: 'Warga Lingkungan RT',
        role: 'Warga',
        levelAkses: 'User',
        avatarInitials: 'WG',
        isDemo: true,
      },
      password: 'wargart',
    },
  ];

  try {
    localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(defaultAccounts));
  } catch {
    // ignore
  }

  return defaultAccounts;
};

/**
 * Menyimpan atau memperbarui akun pengurus di registry lokal
 */
export const saveUserToLocalRegistry = (profile: UserProfile, password?: string) => {
  try {
    const list = getLocalRegisteredUsers();
    const existingIndex = list.findIndex(
      (u) => u.profile.email.toLowerCase() === profile.email.toLowerCase()
    );

    const cred: StoredUserCredential = {
      profile,
      password: password || (existingIndex >= 0 ? list[existingIndex].password : undefined),
    };

    if (existingIndex >= 0) {
      list[existingIndex] = cred;
    } else {
      list.push(cred);
    }

    localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(list));
  } catch (err) {
    console.warn('[SaveUserToLocalRegistry Error]', err);
  }
};

export const removeUserFromLocalRegistry = (email: string) => {
  try {
    const list = getLocalRegisteredUsers();
    const filtered = list.filter(
      (u) => u.profile.email.toLowerCase().trim() !== email.toLowerCase().trim()
    );
    localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(filtered));
  } catch (err) {
    console.warn('[RemoveUserFromLocalRegistry Error]', err);
  }
};

/**
 * Menyimpan / menyinkronkan profil pengguna / pengurus ke tabel 'pengguna' (atau fallback 'pengurus') di Supabase
 */
export const savePengurusToSupabaseTable = async (
  profile: UserProfile,
  plainPassword?: string
): Promise<{ success: boolean; error?: string }> => {
  const client = getSupabase();
  if (!client) return { success: false, error: 'Supabase client offline' };

  try {
    const cleanEmail = profile.email.toLowerCase().trim();
    const cleanNama = profile.nama.trim();
    const cleanRole = profile.role || 'Warga';
    const cleanLevel = profile.levelAkses || (cleanRole === 'Warga' ? 'User' : 'Admin');
    const cleanHp = profile.no_hp ? profile.no_hp.trim() : null;
    const finalPassword = plainPassword || 'admin123';

    // Coba simpan ke tabel 'pengguna' terlebih dahulu (skema baru), lalu fallback ke 'pengurus'
    const targetTables = ['pengguna', 'pengurus', 'pengurus_rt', 'users'];
    let lastError: any = null;

    for (const tbl of targetTables) {
      try {
        // 1. Periksa apakah baris dengan email ini sudah ada di tabel target
        const { data: existingRows, error: searchErr } = await client
          .from(tbl)
          .select('*')
          .ilike('email', cleanEmail)
          .limit(1);

        if (searchErr) {
          if (searchErr.code === '42P01' || searchErr.message?.includes('does not exist')) {
            // Tabel tidak ditemukan, coba tabel berikutnya
            lastError = searchErr;
            continue;
          }
        }

        if (existingRows && existingRows.length > 0) {
          // A. BARIS SUDAH ADA -> LAKUKAN UPDATE
          const existingRow = existingRows[0];
          
          // 1. Coba update dengan SELURUH kolom relasi data warga
          const fullPayload: Record<string, any> = {
            nama: cleanNama,
            jabatan: cleanRole,
            level_akses: cleanLevel,
            password: finalPassword,
          };
          if (cleanHp) fullPayload.no_hp = cleanHp;
          if (profile.wargaId && isUuid(profile.wargaId)) fullPayload.warga_id = profile.wargaId;
          if (profile.no_kk) fullPayload.no_kk = String(profile.no_kk);
          if (profile.nik) fullPayload.nik = String(profile.nik);
          if (profile.alamat_domisili) fullPayload.alamat_domisili = String(profile.alamat_domisili);

          let { error: updateErr } = await client
            .from(tbl)
            .update(fullPayload)
            .eq('id', existingRow.id);

          if (!updateErr) {
            return { success: true };
          }

          // 2. Retry jika ada kolom spesifik yang belum ada di tabel Supabase (coba dengan no_kk & no_hp)
          if (updateErr) {
            const noKkPayload: Record<string, any> = {
              nama: cleanNama,
              jabatan: cleanRole,
              level_akses: cleanLevel,
              password: finalPassword,
            };
            if (cleanHp) noKkPayload.no_hp = cleanHp;
            if (profile.no_kk) noKkPayload.no_kk = String(profile.no_kk);
            if (profile.nik) noKkPayload.nik = String(profile.nik);

            const retryNoKk = await client.from(tbl).update(noKkPayload).eq('id', existingRow.id);
            if (!retryNoKk.error) return { success: true };

            // 3. Retry fallback dengan kolom dasar
            const strippedPayload = {
              nama: cleanNama,
              jabatan: cleanRole,
              level_akses: cleanLevel,
              password: finalPassword,
            };
            if (cleanHp) (strippedPayload as any).no_hp = cleanHp;
            const retryUpdate = await client.from(tbl).update(strippedPayload).eq('id', existingRow.id);
            if (!retryUpdate.error) return { success: true };
          }

          // Retry dengan variasi nama kolom (role alih-alih jabatan)
          const altUpdate: Record<string, any> = {
            nama: cleanNama,
            role: cleanRole,
            password: finalPassword,
          };
          const retryAlt = await client.from(tbl).update(altUpdate).eq('id', existingRow.id);
          if (!retryAlt.error) return { success: true };

          lastError = updateErr;
        } else {
          // B. BARIS BELUM ADA -> LAKUKAN INSERT BARU
          const uuid = profile.id && isUuid(profile.id) ? profile.id : crypto.randomUUID();
          const insertPayload: Record<string, any> = {
            id: uuid,
            nama: cleanNama,
            email: cleanEmail,
            password: finalPassword,
            jabatan: cleanRole,
            level_akses: cleanLevel,
          };
          if (cleanHp) {
            insertPayload.no_hp = cleanHp;
          }
          if (profile.wargaId) insertPayload.warga_id = profile.wargaId;
          if (profile.no_kk) insertPayload.no_kk = profile.no_kk;
          if (profile.nik) insertPayload.nik = profile.nik;
          if (profile.alamat_domisili) insertPayload.alamat_domisili = profile.alamat_domisili;

          let { error: insertErr } = await client
            .from(tbl)
            .insert([insertPayload]);

          if (!insertErr) {
            return { success: true };
          }

          // Jika insert gagal karena kolom id tidak boleh di-override atau default gen_random_uuid()
          if (insertErr.message?.toLowerCase().includes('id') || insertErr.code === '42703') {
            const noIdPayload = { ...insertPayload };
            delete noIdPayload.id;
            const retryInsertNoId = await client.from(tbl).insert([noIdPayload]);
            if (!retryInsertNoId.error) return { success: true };
          }

          // Jika insert gagal karena kolom ekstra (warga_id, no_kk, nik, alamat_domisili, no_hp) belum ada
          if (insertErr) {
            const standardInsert: Record<string, any> = {
              nama: cleanNama,
              email: cleanEmail,
              password: finalPassword,
              jabatan: cleanRole,
              level_akses: cleanLevel,
            };
            if (cleanHp) standardInsert.no_hp = cleanHp;
            const retryStd = await client.from(tbl).insert([standardInsert]);
            if (!retryStd.error) return { success: true };
          }

          // Coba fallback dengan metode upsert
          const upsertRes = await client.from(tbl).upsert([insertPayload], { onConflict: 'email' });
          if (!upsertRes.error) return { success: true };

          lastError = insertErr;
        }

        // Jika tabel ada tapi ada RLS blocking
        if (lastError && (lastError.code === '42501' || lastError.message?.toLowerCase().includes('violates row-level security'))) {
          return {
            success: false,
            error: `Izin akses tabel '${tbl}' ditolak oleh Row Level Security (RLS) Supabase. Pastikan RLS Policy "Akses Publik Pengguna" telah diaktifkan di Supabase SQL Editor.`
          };
        }
      } catch (tableErr: any) {
        lastError = tableErr;
        console.warn(`[savePengurusToSupabaseTable loop on ${tbl}]`, tableErr);
      }
    }

    if (lastError) {
      console.warn('[Supabase savePengurusToSupabaseTable Note]', lastError.message || lastError);
      return { success: false, error: lastError.message || 'Gagal menyimpan data ke tabel pengguna di Supabase' };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Terjadi kesalahan sistem saat menyimpan ke database' };
  }
};

export const savePenggunaToSupabaseTable = savePengurusToSupabaseTable;

/**
 * Mencari pengguna / pengurus di tabel 'pengguna' atau 'pengurus' di Supabase berdasarkan email
 */
export const findPengurusInSupabaseTable = async (
  email: string
): Promise<{ found: boolean; row?: any; error?: string }> => {
  const cleanEmail = email.trim();
  const lowerEmail = cleanEmail.toLowerCase();

  const client = getSupabase();
  if (client) {
    let lastQueryError: string | null = null;
    const tableCandidates = ['pengguna', 'Pengguna', 'pengurus', 'Pengurus', 'pengurus_rt', 'users'];

    for (const tbl of tableCandidates) {
      try {
        // 1. Coba pencarian langsung dengan ilike pada kolom 'email'
        const { data: dataIlike, error: errorIlike } = await client
          .from(tbl)
          .select('*')
          .ilike('email', cleanEmail)
          .limit(5);

        if (!errorIlike && dataIlike && dataIlike.length > 0) {
          return { found: true, row: dataIlike[0] };
        }

        // 2. Coba scan baris tabel untuk menangani variasi nama kolom (email, Email, surel, username)
        const { data: allRows, error: errorAll } = await client
          .from(tbl)
          .select('*')
          .limit(200);

        if (!errorAll && allRows && allRows.length > 0) {
          const matched = allRows.find((item: any) => {
            const itemEmail = String(
              item.email || item.Email || item.surel || item.mail || item.user_email || item.username || ''
            ).toLowerCase().trim();
            return itemEmail === lowerEmail || itemEmail === cleanEmail;
          });
          if (matched) {
            return { found: true, row: matched };
          }
        }

        if (errorAll) {
          lastQueryError = errorAll.message || errorAll.code || 'Query error';
          if (errorAll.code === '42P01') {
            // Relasi tabel tidak ditemukan, lanjut periksa tabel kandidat berikutnya
            continue;
          }
          if (errorAll.code === '42501') {
            lastQueryError = 'Izin akses tabel pengurus ditolak oleh Row Level Security (RLS) Supabase.';
            break;
          }
        }
      } catch (err: any) {
        lastQueryError = err?.message || String(err);
        console.warn(`[findPengurusInSupabaseTable exception on ${tbl}]`, err);
      }
    }

    if (lastQueryError) {
      console.warn('[findPengurusInSupabaseTable query error]', lastQueryError);
      return { found: false, error: lastQueryError };
    }
  }

  // 4. Fallback ke akun lokal / bawaan (jika Supabase belum connect atau offline)
  const localUsers = getLocalRegisteredUsers();
  const matchedLocal = localUsers.find(
    (u) => (u.profile.email || '').toLowerCase().trim() === lowerEmail
  );
  if (matchedLocal) {
    return {
      found: true,
      row: {
        id: matchedLocal.profile.id,
        email: matchedLocal.profile.email,
        nama: matchedLocal.profile.nama,
        jabatan: matchedLocal.profile.role,
        role: matchedLocal.profile.role,
        level_akses: matchedLocal.profile.levelAkses,
        no_hp: matchedLocal.profile.no_hp || '081234567890',
        password: matchedLocal.password,
      },
    };
  }

  return { found: false };
};

export const findPenggunaInSupabaseTable = findPengurusInSupabaseTable;

/**
 * Normalisasi nama jabatan untuk perbandingan konsisten
 */
export const normalizeJabatan = (jabatan: string): string => {
  if (!jabatan) return '';
  const clean = String(jabatan)
    .toLowerCase()
    .replace(/[\.\-_/\\,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Warga bukan pengurus inti
  if (clean.includes('warga')) return 'Warga';

  // Wakil Ketua RT (wajib dicek sebelum Ketua)
  if (clean.includes('wakil') && (clean.includes('ketua') || clean.includes('rt'))) {
    return 'Wakil Ketua RT';
  }

  // Ketua RT (menangani 'ketua', 'ketua rt', 'ketua rw', dll.)
  if (clean.includes('ketua')) {
    return 'Ketua RT';
  }

  // Sekretaris (menangani 'sekretaris', 'sekretaris rt', 'sekretariat', 'sekre')
  if (clean.includes('sekretaris') || clean.includes('sekretariat') || clean.includes('sekre')) {
    return 'Sekretaris';
  }

  // Bendahara (menangani 'bendahara', 'bendahara rt', 'keuangan', 'kasir')
  if (clean.includes('bendahara') || clean.includes('keuangan') || clean.includes('kasir')) {
    return 'Bendahara';
  }

  return (jabatan || '').trim();
};

/**
 * Memeriksa apakah dua nama jabatan mengacu pada posisi kepengurusan yang sama
 */
export const isJabatanMatching = (a: string, b: string): boolean => {
  if (!a || !b) return false;
  const cleanA = a.trim().toLowerCase();
  const cleanB = b.trim().toLowerCase();
  // Warga bukan jabatan tunggal/eksklusif
  if (cleanA.includes('warga') || cleanB.includes('warga')) return false;

  const normA = normalizeJabatan(a);
  const normB = normalizeJabatan(b);
  if (!normA || !normB) return false;
  return normA.toLowerCase() === normB.toLowerCase();
};

/**
 * Memeriksa apakah suatu jabatan sudah terdaftar / terisi di tabel 'pengguna' / 'pengurus' Supabase
 * Jika sudah ada pengurus yang memegang jabatan tersebut, pendaftaran akun baru dengan jabatan itu DITOLAK.
 */
export const checkJabatanExistsInPengurus = async (
  role: string
): Promise<{
  exists: boolean;
  existingPengurusName?: string;
  existingEmail?: string;
  existingRole?: string;
  error?: string;
}> => {
  // Posisi Warga terbuka untuk seluruh warga (bukan jabatan tunggal)
  if (!role || role.trim() === 'Warga' || role.trim().toLowerCase().includes('warga')) {
    return { exists: false };
  }

  const client = getSupabase();
  if (client) {
    const tableCandidates = ['pengguna', 'Pengguna', 'pengurus', 'Pengurus', 'pengurus_rt', 'users'];
    for (const tbl of tableCandidates) {
      try {
        const { data, error } = await client
          .from(tbl)
          .select('*')
          .limit(200);

        if (!error && data) {
          const found = data.find((row: any) => {
            const rawJab = String(
              row.jabatan ||
              row.role ||
              row.posisi ||
              row.Jabatan ||
              row.Role ||
              row.Posisi ||
              row.kategori ||
              ''
            ).trim();
            return isJabatanMatching(rawJab, role);
          });

          if (found) {
            const foundNama = String(
              found.nama ||
              found.name ||
              found.Nama ||
              found.full_name ||
              found.fullname ||
              found.nama_lengkap ||
              found.Nama_Lengkap ||
              found.nama_pengurus ||
              found.pengurus_nama ||
              found.nama_pengguna ||
              'Pengurus Terdaftar'
            ).trim();

            return {
              exists: true,
              existingPengurusName: foundNama,
              existingEmail: found.email || found.Email || found.surel,
              existingRole: found.jabatan || found.role || role,
            };
          }

          // Tabel pengguna / pengurus ada dan terbaca di Supabase, jabatan ini belum terisi di tabel ini
          return { exists: false };
        }
      } catch (err: any) {
        console.warn(`[checkJabatanExistsInPengurus Exception on ${tbl}]`, err);
      }
    }
  }

  // Fallback ke registry lokal HANYA jika Supabase offline & BUKAN akun demo bawaan
  const localUsers = getLocalRegisteredUsers();
  const matchedLocal = localUsers.find((u) => {
    if (u.profile.isDemo) return false; // Jangan gunakan akun demo bawaan untuk memblokir jabatan!
    const rowJab = (u.profile.role || '').trim();
    return isJabatanMatching(rowJab, role);
  });

  if (matchedLocal) {
    return {
      exists: true,
      existingPengurusName: matchedLocal.profile.nama,
      existingEmail: matchedLocal.profile.email,
      existingRole: matchedLocal.profile.role,
    };
  }

  return { exists: false };
};

/**
 * Mengambil pemetaan seluruh jabatan pengurus yang sudah terisi dari Supabase
 * PENTING: Hanya mengambil data riil dari Supabase dan TIDAK menyuntikkan akun demo bawaan.
 */
export const getOccupiedJabatanFromSupabase = async (): Promise<Record<string, { nama: string; email?: string }>> => {
  const map: Record<string, { nama: string; email?: string }> = {};

  const client = getSupabase();
  let queriedSupabaseSuccess = false;

  if (client) {
    const tableCandidates = ['pengguna', 'Pengguna', 'pengurus', 'Pengurus', 'pengurus_rt', 'users'];
    for (const tbl of tableCandidates) {
      try {
        const { data, error } = await client
          .from(tbl)
          .select('*')
          .limit(200);

        if (!error && data) {
          queriedSupabaseSuccess = true;
          data.forEach((row: any) => {
            const rawJab = String(
              row.jabatan ||
              row.role ||
              row.posisi ||
              row.Jabatan ||
              row.Role ||
              row.Posisi ||
              row.kategori ||
              row.status ||
              ''
            ).trim();

            if (rawJab && !rawJab.toLowerCase().includes('warga')) {
              const norm = normalizeJabatan(rawJab);
              const nama = String(
                row.nama ||
                row.name ||
                row.Nama ||
                row.Name ||
                row.full_name ||
                row.fullname ||
                row.nama_lengkap ||
                row.Nama_Lengkap ||
                row.nama_pengurus ||
                row.pengurus_nama ||
                row.username ||
                row.user_name ||
                ''
              ).trim();

              const email = String(
                row.email ||
                row.Email ||
                row.surel ||
                row.mail ||
                row.user_email ||
                ''
              ).trim();

              if (norm && nama) {
                map[norm] = {
                  nama,
                  email,
                };
              }
            }
          });
          // Jika berhasil query salah satu tabel pengurus di Supabase, selesai
          break;
        }
      } catch (e) {
        console.warn(`[getOccupiedJabatanFromSupabase Exception on ${tbl}]`, e);
      }
    }
  }

  // PENTING:
  // JANGAN PERNAH menyuntikkan akun demo bawaan (seperti Bendahara Kas RT atau Ketua RT demo) ke pemetaan jabatan terisi!
  // Database Supabase adalah sumber kebenaran utama.
  // Hanya jika Supabase benar-benar offline dan pengguna mendaftarkan akun lokal nyata (bukan isDemo).
  if (!queriedSupabaseSuccess && !client) {
    const localUsers = getLocalRegisteredUsers();
    localUsers.forEach((u) => {
      if (u.profile.isDemo) return; // Abaikan akun demo bawaan!
      const r = (u.profile.role || '').trim();
      if (r && !r.toLowerCase().includes('warga')) {
        const norm = normalizeJabatan(r);
        if (norm && !map[norm] && u.profile.nama) {
          map[norm] = { nama: u.profile.nama, email: u.profile.email };
        }
      }
    });
  }

  return map;
};

/**
 * Mendapatkan sesi pengurus saat ini (baik dari Supabase Auth maupun Session Storage)
 */
export const getCurrentPengurusSession = async (): Promise<UserProfile | null> => {
  // 1. Cek dulu apakah ada sesi aktif di Session Storage
  const localSaved = sessionStorage.getItem(STORAGE_KEY_ACTIVE_USER);
  if (localSaved) {
    try {
      const parsed = JSON.parse(localSaved);
      if (parsed && parsed.email) {
        return parsed;
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY_ACTIVE_USER);
    }
  }

  // 2. Jika tidak ada di session storage, cek ke Supabase Auth
  const client = getSupabase();
  if (client) {
    try {
      const { data: { session }, error } = await client.auth.getSession();
      if (!error && session && session.user) {
        const user = session.user;
        const meta = user.user_metadata || {};
        let nama = meta.nama || meta.name || user.email?.split('@')[0] || 'Pengurus RT';
        let role = (meta.role as PengurusRole) || 'Bendahara';
        let levelAkses = (meta.level_akses as any) || (role === 'Warga' ? 'User' : 'Admin');
        let fotoUrl = meta.foto_url || meta.avatarUrl || undefined;
        let no_hp = undefined;
        let wargaId = undefined;
        let no_kk = undefined;
        let nik = undefined;
        let alamat_domisili = undefined;

        // Ambil data profil penuh dari tabel database (termasuk foto_url)
        const spCheck = await findPengurusInSupabaseTable(user.email || '');
        if (spCheck.found && spCheck.row) {
          const row = spCheck.row;
          nama = row.nama || row.name || row.Nama || row.nama_lengkap || nama;
          const rawJab = String(row.jabatan || row.role || row.posisi || '').trim();
          const normRole = normalizeJabatan(rawJab);
          if (normRole) {
            role = normRole as PengurusRole;
          }
          levelAkses = (row.level_akses as any) || (role === 'Warga' ? 'User' : 'Admin');
          no_hp = row.no_hp || row.telepon || row.phone;
          fotoUrl = row.foto_url || fotoUrl;
          wargaId = row.warga_id || row.wargaId;
          no_kk = row.no_kk || row.noKk || row.kk;
          nik = row.nik || row.NIK;
          alamat_domisili = row.alamat_domisili || row.alamat;
        }
        
        const profile: UserProfile = {
          id: user.id,
          email: user.email || '',
          nama,
          role,
          levelAkses,
          no_hp,
          fotoUrl,
          wargaId,
          no_kk,
          nik,
          alamat_domisili,
          avatarInitials: getInitials(nama),
          isDemo: false,
        };
        // Simpan ke session cache
        sessionStorage.setItem(STORAGE_KEY_ACTIVE_USER, JSON.stringify(profile));
        return profile;
      }
    } catch (err) {
      console.warn('[Supabase Auth GetSession]', err);
    }
  }

  return null;
};

/**
 * Helper untuk membersihkan dan menormalkan nama orang
 */
export const cleanPersonName = (name?: string): string => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/^(bpk\.?|bapak\.?|ibu\.?|ibuk\.?|pak\.?|h\.?|hj\.?|haji\.?|hajjah\.?|sdr\.?|sdri\.?|om\.?|tante\.?|ustadz\.?|ust\.)\s+/gi, '')
    .replace(/,\s*(s\.?t|s\.?e|s\.?kom|s\.?pd|s\.?h|s\.?sos|s\.?i\.?kom|m\.?m|m\.?kom|dr\.?|ir\.).*$/gi, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
};

/**
 * Helper untuk membersihkan nomor telepon/HP
 */
export const cleanPhoneNumber = (phone?: string): string => {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('62')) {
    digits = '0' + digits.slice(2);
  }
  return digits;
};

/**
 * Algoritma cerdas untuk mencocokkan profil login warga dengan catatan di data_warga
 */
export const matchResidentToProfile = (
  allWarga: DataWargaItem[],
  profile: { nama?: string; email?: string; no_hp?: string }
): DataWargaItem | undefined => {
  if (!allWarga || allWarga.length === 0) return undefined;

  const cleanPName = cleanPersonName(profile.nama);
  const cleanPPhone = cleanPhoneNumber(profile.no_hp);
  const cleanPEmail = (profile.email || '').toLowerCase().trim();

  // 1. Cocokkan Email (jika ada di data_warga)
  if (cleanPEmail) {
    const byEmail = allWarga.find((w) => {
      const wEmail = String((w as any).email || '').toLowerCase().trim();
      return wEmail && wEmail === cleanPEmail;
    });
    if (byEmail) return byEmail;
  }

  // 2. Cocokkan Nomor HP (jika ada)
  if (cleanPPhone && cleanPPhone.length >= 8) {
    const byPhone = allWarga.find((w) => {
      const wPhone = cleanPhoneNumber(w.no_hp);
      return wPhone && wPhone.length >= 8 && (wPhone === cleanPPhone || wPhone.endsWith(cleanPPhone.slice(-8)) || cleanPPhone.endsWith(wPhone.slice(-8)));
    });
    if (byPhone) return byPhone;
  }

  // 3. Cocokkan Nama Lengkap Persis (setelah dibersihkan sapaan & gelar)
  if (cleanPName && cleanPName.length >= 3) {
    const byExactName = allWarga.find((w) => cleanPersonName(w.nama_lengkap) === cleanPName);
    if (byExactName) return byExactName;
  }

  // 4. Cocokkan Nama Substring / Token
  if (cleanPName && cleanPName.length >= 4) {
    const nameTokens = cleanPName.split(' ').filter((t) => t.length >= 3);
    const byToken = allWarga.find((w) => {
      const cWName = cleanPersonName(w.nama_lengkap);
      if (cWName.includes(cleanPName) || cleanPName.includes(cWName)) return true;
      // Periksa apakah setidaknya 2 token kata cocok
      if (nameTokens.length >= 2) {
        const matchCount = nameTokens.filter((token) => cWName.includes(token)).length;
        if (matchCount >= 2) return true;
      }
      return false;
    });
    if (byToken) return byToken;
  }

  return undefined;
};

/**
 * Menyinkronkan pembaruan data_warga ke tabel pengguna (dan pengurus/users) serta cache lokal
 * Ketika admin mengubah data warga (nama, NIK, No. KK, No. HP, Alamat Domisili),
 * seluruh akun pengguna yang berelasi otomatis ikut diperbarui.
 */
export const syncWargaUpdateToPengguna = async (
  oldWarga: Partial<DataWargaItem>,
  newWarga: Partial<DataWargaItem>
): Promise<{ success: boolean; updatedCount: number; error?: string }> => {
  const client = getSupabase();
  let updatedCount = 0;

  const targetNik = (oldWarga.nik || newWarga.nik || '').trim();
  const targetWargaId = oldWarga.id || newWarga.id;
  const oldNama = (oldWarga.nama_lengkap || '').trim();
  const newNama = (newWarga.nama_lengkap || oldNama).trim();
  const newNik = (newWarga.nik || oldWarga.nik || '').trim();
  const newKk = (newWarga.no_kk || oldWarga.no_kk || '').trim();
  const newHp = (newWarga.no_hp || oldWarga.no_hp || '').trim();
  const newAlamat = (newWarga.alamat_domisili || oldWarga.alamat_domisili || '').trim();

  // 1. Update di Database Supabase jika terhubung
  if (client) {
    const tableCandidates = ['pengguna', 'pengurus', 'pengurus_rt', 'users'];
    for (const tbl of tableCandidates) {
      try {
        const { data: rows, error } = await client.from(tbl).select('*');
        if (!error && rows) {
          const matchedRows = rows.filter((r: any) => {
            if (targetWargaId && r.warga_id && String(r.warga_id) === String(targetWargaId)) return true;
            if (targetNik && r.nik && String(r.nik) === String(targetNik)) return true;
            if (oldNama && r.nama && cleanPersonName(r.nama) === cleanPersonName(oldNama)) return true;
            return false;
          });

          for (const r of matchedRows) {
            const updatePayload: Record<string, any> = {
              nama: newNama || r.nama,
            };
            if (newNik) updatePayload.nik = newNik;
            if (newKk) updatePayload.no_kk = newKk;
            if (newHp) updatePayload.no_hp = newHp;
            if (newAlamat) updatePayload.alamat_domisili = newAlamat;
            if (targetWargaId && isUuid(targetWargaId)) updatePayload.warga_id = targetWargaId;

            const updateRes = await client.from(tbl).update(updatePayload).eq('id', r.id);
            if (!updateRes.error) {
              updatedCount++;
            }
          }
        }
      } catch (err) {
        console.warn(`[syncWargaUpdateToPengguna Exception on ${tbl}]`, err);
      }
    }
  }

  // 2. Update di Local Registered Users
  try {
    const localUsers = getLocalRegisteredUsers();
    let localChanged = false;
    localUsers.forEach((u) => {
      const matchWId = targetWargaId && u.profile.wargaId === targetWargaId;
      const matchNik = targetNik && u.profile.nik === targetNik;
      const matchName = oldNama && cleanPersonName(u.profile.nama) === cleanPersonName(oldNama);

      if (matchWId || matchNik || matchName) {
        u.profile.nama = newNama || u.profile.nama;
        if (newNik) u.profile.nik = newNik;
        if (newKk) u.profile.no_kk = newKk;
        if (newHp) u.profile.no_hp = newHp;
        if (newAlamat) u.profile.alamat_domisili = newAlamat;
        if (targetWargaId) u.profile.wargaId = targetWargaId;
        u.profile.avatarInitials = getInitials(u.profile.nama);
        localChanged = true;
        updatedCount++;
      }
    });

    if (localChanged) {
      localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(localUsers));
    }
  } catch (err) {
    console.warn('[syncWargaUpdateToPengguna Local Error]', err);
  }

  // 3. Update active session jika user yang sedang login adalah warga yang diubah
  try {
    const activeRaw = sessionStorage.getItem(STORAGE_KEY_ACTIVE_USER);
    if (activeRaw) {
      const activeUser: UserProfile = JSON.parse(activeRaw);
      const matchWId = targetWargaId && activeUser.wargaId === targetWargaId;
      const matchNik = targetNik && activeUser.nik === targetNik;
      const matchName = oldNama && cleanPersonName(activeUser.nama) === cleanPersonName(oldNama);

      if (matchWId || matchNik || matchName) {
        activeUser.nama = newNama || activeUser.nama;
        if (newNik) activeUser.nik = newNik;
        if (newKk) activeUser.no_kk = newKk;
        if (newHp) activeUser.no_hp = newHp;
        if (newAlamat) activeUser.alamat_domisili = newAlamat;
        if (targetWargaId) activeUser.wargaId = targetWargaId;
        activeUser.avatarInitials = getInitials(activeUser.nama);
        sessionStorage.setItem(STORAGE_KEY_ACTIVE_USER, JSON.stringify(activeUser));
      }
    }
  } catch (err) {
    console.warn('[syncWargaUpdateToPengguna Active Session Error]', err);
  }

  return { success: true, updatedCount };
};

/**
 * Menyinkronkan penghapusan data_warga ke tabel pengguna (dan pengurus/users) serta cache lokal
 * Ketika admin menghapus data warga dari data_warga, seluruh akun pengguna yang berelasi
 * (berdasarkan warga_id, NIK, atau nama lengkap) otomatis ikut terhapus dari tabel pengguna.
 */
export const syncWargaDeleteToPengguna = async (
  warga: Partial<DataWargaItem>
): Promise<{ success: boolean; deletedCount: number; error?: string }> => {
  const client = getSupabase();
  let deletedCount = 0;

  const targetWargaId = warga.id;
  const targetNik = (warga.nik || '').trim();
  const targetNama = (warga.nama_lengkap || '').trim();

  // 1. Hapus dari Database Supabase jika terhubung
  if (client) {
    const tableCandidates = ['pengguna', 'pengurus', 'pengurus_rt', 'users'];
    for (const tbl of tableCandidates) {
      try {
        const { data: rows, error } = await client.from(tbl).select('*');
        if (!error && rows) {
          const matchedRows = rows.filter((r: any) => {
            if (targetWargaId && r.warga_id && String(r.warga_id) === String(targetWargaId)) return true;
            if (targetNik && r.nik && String(r.nik) === String(targetNik)) return true;
            if (targetNama && r.nama && cleanPersonName(r.nama) === cleanPersonName(targetNama)) return true;
            return false;
          });

          for (const r of matchedRows) {
            const delRes = await client.from(tbl).delete().eq('id', r.id);
            if (!delRes.error) {
              deletedCount++;
            }
          }
        }
      } catch (err) {
        console.warn(`[syncWargaDeleteToPengguna Exception on ${tbl}]`, err);
      }
    }
  }

  // 2. Hapus dari Local Registered Users
  try {
    const localUsers = getLocalRegisteredUsers();
    const filteredUsers = localUsers.filter((u) => {
      if (u.profile.isDemo) return true; // Pertahankan akun demo bawaan jika bukan yang dihapus
      const matchWId = targetWargaId && u.profile.wargaId === targetWargaId;
      const matchNik = targetNik && u.profile.nik === targetNik;
      const matchName = targetNama && cleanPersonName(u.profile.nama) === cleanPersonName(targetNama);
      if (matchWId || matchNik || matchName) {
        deletedCount++;
        return false;
      }
      return true;
    });

    localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(filteredUsers));
  } catch (err) {
    console.warn('[syncWargaDeleteToPengguna Local Error]', err);
  }

  return { success: true, deletedCount };
};

/**
 * Menautkan akun pengguna dengan entri data_warga secara eksplisit
 */
export const linkUserToDataWarga = async (
  email: string,
  warga: DataWargaItem,
  plainPassword?: string
): Promise<{ success: boolean; user?: UserProfile; error?: string }> => {
  const cleanEmail = email.toLowerCase().trim();
  const currentSession = await getCurrentPengurusSession();
  const localUsers = getLocalRegisteredUsers();
  const userCred = localUsers.find((u) => u.profile.email.toLowerCase() === cleanEmail);

  const baseProfile = currentSession?.email.toLowerCase() === cleanEmail ? currentSession : (userCred?.profile || {
    id: isUuid(warga.id) ? warga.id : `pengguna-${Date.now()}`,
    email: cleanEmail,
    nama: warga.nama_lengkap,
    role: 'Warga' as PengurusRole,
    levelAkses: 'User' as const,
    avatarInitials: getInitials(warga.nama_lengkap),
    isDemo: false,
  });

  const updatedProfile: UserProfile = {
    ...baseProfile,
    nama: warga.nama_lengkap || baseProfile.nama,
    wargaId: warga.id,
    no_kk: warga.no_kk,
    nik: warga.nik,
    alamat_domisili: warga.alamat_domisili,
    no_hp: warga.no_hp || baseProfile.no_hp,
    avatarInitials: getInitials(warga.nama_lengkap || baseProfile.nama),
  };

  const password = plainPassword || userCred?.password || 'wargart';
  saveUserToLocalRegistry(updatedProfile, password);
  sessionStorage.setItem(STORAGE_KEY_ACTIVE_USER, JSON.stringify(updatedProfile));

  const client = getSupabase();
  if (client) {
    const saveRes = await savePengurusToSupabaseTable(updatedProfile, password);
    if (!saveRes.success) {
      console.warn('[linkUserToDataWarga Supabase Note]', saveRes.error);
    }
  }

  return { success: true, user: updatedProfile };
};

/**
 * Login Pengurus via Supabase (Tabel pengurus & Auth) atau Registry Lokal
 */
export const loginPengurus = async (
  email: string,
  password: string
): Promise<{ success: boolean; user?: UserProfile; fromSupabase?: boolean; error?: string }> => {
  const normalizedEmail = email.trim().toLowerCase();
  const rawPassword = password.trim();

  // 1. Cek apakah Supabase client aktif
  const client = getSupabase();
  if (client) {
    let authSuccess = false;
    let authUser: any = null;
    let authError: any = null;

    // Coba autentikasi via Supabase Auth resmi terlebih dahulu
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: normalizedEmail,
        password: rawPassword,
      });

      if (!error && data && data.user) {
        authSuccess = true;
        authUser = data.user;
      } else if (error) {
        authError = error;
      }
    } catch (err: any) {
      authError = err;
      console.warn('[Supabase SignIn Exception]', err);
    }

    if (authSuccess && authUser) {
      // Jika berhasil login via Auth, sinkronkan data profil dengan tabel 'pengurus'
      try {
        const spCheck = await findPengurusInSupabaseTable(normalizedEmail);
        const meta = authUser.user_metadata || {};
        
        let nama = meta.nama || meta.name || authUser.email?.split('@')[0] || 'Pengurus RT';
        let role = (meta.role as PengurusRole) || 'Bendahara';
        let levelAkses = (meta.level_akses as any) || (role === 'Warga' ? 'User' : 'Admin');
        let no_hp = undefined;

        // Terapkan data dari tabel pengurus (sumber kebenaran utama) jika ada
        if (spCheck.found && spCheck.row) {
           nama = spCheck.row.nama || spCheck.row.name || spCheck.row.Nama || spCheck.row.full_name || spCheck.row.fullname || spCheck.row.nama_lengkap || spCheck.row.nama_pengurus || nama;
           const rawJab = String(spCheck.row.jabatan || spCheck.row.role || spCheck.row.posisi || '').trim();
           const normRole = normalizeJabatan(rawJab);
           if (normRole) {
             role = normRole as PengurusRole;
           }

           levelAkses = (spCheck.row.level_akses as any) || (role === 'Warga' ? 'User' : 'Admin');
           no_hp = spCheck.row.no_hp || spCheck.row.telepon || spCheck.row.phone;
        }

        const profile: UserProfile = {
          id: authUser.id,
          email: authUser.email || normalizedEmail,
          nama,
          role,
          levelAkses,
          no_hp,
          fotoUrl: spCheck.found && spCheck.row ? (spCheck.row.foto_url || spCheck.row.fotoUrl) : undefined,
          wargaId: spCheck.found && spCheck.row ? (spCheck.row.warga_id || spCheck.row.wargaId) : undefined,
          no_kk: spCheck.found && spCheck.row ? (spCheck.row.no_kk || spCheck.row.noKk || spCheck.row.kk) : undefined,
          nik: spCheck.found && spCheck.row ? (spCheck.row.nik || spCheck.row.NIK) : undefined,
          alamat_domisili: spCheck.found && spCheck.row ? (spCheck.row.alamat_domisili || spCheck.row.alamat) : undefined,
          avatarInitials: getInitials(nama),
          isDemo: false,
        };

        // Otomatis tautkan data warga dari data_warga jika wargaId/no_kk belum terisi di akun lama
        if (!profile.wargaId || !profile.no_kk) {
          try {
            const allWarga = await fetchDataWargaFromSupabase();
            const matchedW = matchResidentToProfile(allWarga, {
              nama: profile.nama,
              email: normalizedEmail,
              no_hp: profile.no_hp,
            });

            if (matchedW) {
              profile.wargaId = matchedW.id;
              profile.no_kk = matchedW.no_kk || profile.no_kk;
              profile.nik = matchedW.nik || profile.nik;
              profile.alamat_domisili = matchedW.alamat_domisili || profile.alamat_domisili;
              profile.nama = matchedW.nama_lengkap || profile.nama;
            }
          } catch (wErr) {
            console.warn('[Auto-enrich Warga on Auth Login]', wErr);
          }
        }

        saveUserToLocalRegistry(profile, rawPassword);
        await savePengurusToSupabaseTable(profile, rawPassword);
        sessionStorage.setItem(STORAGE_KEY_ACTIVE_USER, JSON.stringify(profile));
        return { success: true, user: profile, fromSupabase: true };
      } catch (err) {
        console.warn('[Supabase Pengurus Table Sync Exception]', err);
      }
    }

    // Fallback: Jika Auth gagal (mungkin karena belum terdaftar di Auth, tapi ada di tabel pengurus)
    // Periksa kecocokan data manual di tabel 'pengurus' Supabase
    try {
      const spCheck = await findPengurusInSupabaseTable(normalizedEmail);
      if (spCheck.found && spCheck.row) {
        const row = spCheck.row;
        const dbPassword = String(
          row.password || row.Password || row.kata_sandi || row.pass || row.pwd || ''
        ).trim();

        if (dbPassword === rawPassword || (dbPassword && dbPassword.toLowerCase() === rawPassword.toLowerCase())) {
          const rawJab = String(row.jabatan || row.role || row.posisi || '').trim();
          const normRole = normalizeJabatan(rawJab);
          const userRole: PengurusRole = (normRole as PengurusRole) || 'Warga';
          const resolvedNama = String(
            row.nama ||
            row.name ||
            row.Nama ||
            row.full_name ||
            row.fullname ||
            row.nama_lengkap ||
            row.Nama_Lengkap ||
            row.nama_pengurus ||
            'Pengurus RT'
          ).trim();

          const profile: UserProfile = {
            id: row.id || crypto.randomUUID(),
            email: row.email || normalizedEmail,
            nama: resolvedNama,
            role: userRole,
            levelAkses: (row.level_akses as 'Admin' | 'User') || (userRole === 'Warga' ? 'User' : 'Admin'),
            no_hp: row.no_hp || row.nohp || row.telepon,
            fotoUrl: row.foto_url || row.fotoUrl,
            wargaId: row.warga_id || row.wargaId,
            no_kk: row.no_kk || row.noKk || row.kk,
            nik: row.nik || row.NIK,
            alamat_domisili: row.alamat_domisili || row.alamat,
            avatarInitials: getInitials(resolvedNama),
            isDemo: false,
          };

          // Otomatis tautkan data warga dari data_warga jika wargaId/no_kk belum terisi di akun lama
          if (!profile.wargaId || !profile.no_kk) {
            try {
              const allWarga = await fetchDataWargaFromSupabase();
              const matchedW = matchResidentToProfile(allWarga, {
                nama: profile.nama,
                email: normalizedEmail,
                no_hp: profile.no_hp,
              });

              if (matchedW) {
                profile.wargaId = matchedW.id;
                profile.no_kk = matchedW.no_kk || profile.no_kk;
                profile.nik = matchedW.nik || profile.nik;
                profile.alamat_domisili = matchedW.alamat_domisili || profile.alamat_domisili;
                profile.nama = matchedW.nama_lengkap || profile.nama;
              }
            } catch (wErr) {
              console.warn('[Auto-enrich Warga on Login]', wErr);
            }
          }

          // Sinkronkan ke Supabase & registry lokal & sesi aktif
          await savePengurusToSupabaseTable(profile, rawPassword);
          saveUserToLocalRegistry(profile, rawPassword);
          sessionStorage.setItem(STORAGE_KEY_ACTIVE_USER, JSON.stringify(profile));
          return { success: true, user: profile, fromSupabase: true };
        } else {
          return {
            success: false,
            error: 'Kata sandi salah. Silakan periksa kembali huruf besar/kecil (Caps Lock) dan pastikan sesuai dengan kata sandi terdaftar di Supabase.',
          };
        }
      }

      // Jika ada error email not confirmed dari Supabase Auth
      if (authError && authError.message && authError.message.toLowerCase().includes('confirm')) {
        return {
          success: false,
          error: `Email "${normalizedEmail}" terdaftar di Supabase Auth, namun belum dikonfirmasi (Email not confirmed). Silakan periksa kotak masuk email Anda atau nonaktifkan "Confirm email" di dashboard Supabase Authentication.`,
        };
      }

      // Jika ada error akses tabel dari Supabase
      if (spCheck.error) {
        return {
          success: false,
          error: `Gagal membaca tabel 'pengguna' di Supabase: ${spCheck.error}. Pastikan tabel 'pengguna' dan RLS Policy sudah dibuat di Supabase SQL Editor.`,
        };
      }
    } catch (err: any) {
      console.warn('[Supabase Pengguna Table Check Exception]', err);
    }
  }

  // 2. Fallback: Cek apakah user terdaftar di Local Registry perangkat ini
  const localUsers = getLocalRegisteredUsers();
  const matchedLocal = localUsers.find(
    (u) => u.profile.email.toLowerCase() === normalizedEmail
  );

  // Jika cocok di akun lokal dan password tepat
  if (matchedLocal) {
    if (matchedLocal.password === rawPassword) {
      const profile: UserProfile = {
        ...matchedLocal.profile,
        levelAkses: matchedLocal.profile.levelAkses || (matchedLocal.profile.role === 'Warga' ? 'User' : 'Admin'),
        avatarInitials: getInitials(matchedLocal.profile.nama),
      };
      sessionStorage.setItem(STORAGE_KEY_ACTIVE_USER, JSON.stringify(profile));
      return { success: true, user: profile, fromSupabase: false };
    } else {
      return {
        success: false,
        error: 'Kata sandi tidak sesuai. Silakan periksa kembali huruf besar/kecil (Caps Lock).',
      };
    }
  }

  // Akun cepat khusus Warga: warga@rt02.id / wargart02 atau warga@rt.id
  if ((normalizedEmail === 'warga@rt02.id' || normalizedEmail === 'warga@rt.id') && (rawPassword === 'wargart02' || rawPassword === 'wargart')) {
    const wargaProfile: UserProfile = {
      id: 'demo-warga-rt',
      email: normalizedEmail,
      nama: 'Warga Lingkungan RT',
      role: 'Warga',
      levelAkses: 'User',
      avatarInitials: 'WG',
      isDemo: true,
    };
    saveUserToLocalRegistry(wargaProfile, rawPassword);
    sessionStorage.setItem(STORAGE_KEY_ACTIVE_USER, JSON.stringify(wargaProfile));
    return { success: true, user: wargaProfile, fromSupabase: false };
  }

  // Jika Supabase tidak aktif sama sekali di browser ini
  if (!client) {
    return {
      success: false,
      error: `Database Supabase belum terhubung di browser ini. Jika akun "${email.trim()}" sudah dibuat di Supabase, silakan klik "Pengaturan Database" di bagian bawah untuk memasukkan Project URL & Anon Key Supabase Anda.`,
    };
  }

  return { 
    success: false, 
    error: `Akun dengan email "${email.trim()}" tidak ditemukan di database Supabase (tabel pengguna) maupun akun lokal. Pastikan ejaan email sesuai atau daftarkan akun baru di tab "Daftar Akun".` 
  };
};

/**
 * Register Pengurus / Pengguna Baru via Tabel 'pengguna' Supabase, Supabase Auth & Registry Lokal
 */
export const registerPengurus = async (
  email: string,
  password: string,
  nama: string,
  role: PengurusRole,
  levelAkses: 'Admin' | 'User' = 'User',
  noHp?: string,
  citizenData?: {
    wargaId?: string;
    no_kk?: string;
    nik?: string;
    alamat_domisili?: string;
  }
): Promise<{ success: boolean; user?: UserProfile; savedToSupabase?: boolean; error?: string; message?: string }> => {
  const normalizedEmail = email.trim().toLowerCase();
  const rawPassword = password.trim();
  const cleanName = nama.trim();

  const client = getSupabase();

  // 1. Cek keberadaan email
  if (client) {
    // Jika Supabase aktif, jadikan database Supabase sebagai sumber kebenaran mutlak
    const existingInDb = await findPengurusInSupabaseTable(normalizedEmail);
    if (existingInDb.found) {
      return { 
        success: false, 
        error: 'Alamat email ini sudah terdaftar di database Supabase. Silakan langsung masuk di tab Login.' 
      };
    }
    // Bersihkan cache lokal jika ada sisa registrasi yang sebelumnya gagal tersimpan di Supabase
    removeUserFromLocalRegistry(normalizedEmail);
  } else {
    // Jika Supabase offline, cek registry lokal (abaikan akun demo bawaan)
    const localUsers = getLocalRegisteredUsers();
    const matchedLocal = localUsers.find(
      (u) => !u.profile.isDemo && u.profile.email.toLowerCase() === normalizedEmail
    );
    if (matchedLocal) {
      return { 
        success: false, 
        error: 'Alamat email ini sudah terdaftar di penyimpanan lokal. Silakan gunakan email lain atau langsung login.' 
      };
    }
  }

  // 2. Aturan Proteksi Jabatan: Jika warga atau pendaftar lain memilih jabatan yang sudah ada di tabel pengguna, tolak!
  if (role !== 'Warga') {
    const jabatanCheck = await checkJabatanExistsInPengurus(role);
    if (jabatanCheck.exists) {
      return {
        success: false,
        error: `Pendaftaran Ditolak: Jabatan "${role}" sudah terisi di tabel pengguna atas nama ${jabatanCheck.existingPengurusName || 'pengurus lain'}. Warga atau pengguna lain tidak dapat memilih jabatan yang sudah terdaftar. Silakan pilih jabatan lain yang kosong atau daftar sebagai Warga.`,
      };
    }
  }

  // Generate ID akun: gunakan ID UUID data_warga jika valid agar berelasi langsung 1-to-1
  const assignedId = citizenData?.wargaId && isUuid(citizenData.wargaId) 
    ? citizenData.wargaId 
    : `pengurus-${Date.now()}`;

  const profile: UserProfile = {
    id: assignedId,
    email: normalizedEmail,
    nama: cleanName,
    role,
    levelAkses,
    no_hp: noHp ? noHp.trim() : undefined,
    wargaId: citizenData?.wargaId,
    no_kk: citizenData?.no_kk,
    nik: citizenData?.nik,
    alamat_domisili: citizenData?.alamat_domisili,
    avatarInitials: getInitials(cleanName),
    isDemo: false,
  };

  let savedToSupabase = false;

  // 3. Simpan ke tabel 'pengguna' / 'pengurus' di Supabase
  if (client) {
    const dbSave = await savePengurusToSupabaseTable(profile, rawPassword);
    if (!dbSave.success) {
      // Jika gagal simpan ke Supabase, pastikan tidak meninggalkan data sampah di local storage
      removeUserFromLocalRegistry(normalizedEmail);
      return {
        success: false,
        error: `Gagal menyimpan data akun ke tabel database Supabase: ${dbSave.error || 'Pastikan tabel pengguna telah dibuat di Supabase SQL Editor.'}`,
      };
    }

    savedToSupabase = true;

    // Simpan salinan ke local storage setelah dipastikan BERHASIL tersimpan di Supabase
    saveUserToLocalRegistry(profile, rawPassword);

    // Coba juga sinkronkan ke Supabase Auth resmi (opsional)
    try {
      const { data, error } = await client.auth.signUp({
        email: normalizedEmail,
        password: rawPassword,
        options: {
          data: {
            nama: cleanName,
            role,
            level_akses: levelAkses,
            no_hp: profile.no_hp,
          },
        },
      });

      if (error) {
        console.warn('[Supabase SignUp Optional Note]', error.message);
      } else if (data && data.user) {
        profile.id = data.user.id;
        saveUserToLocalRegistry(profile, rawPassword);
      }
    } catch (err: any) {
      console.warn('[Supabase SignUp Optional Exception]', err);
    }
  } else {
    // Jika offline, simpan ke registry lokal
    saveUserToLocalRegistry(profile, rawPassword);
  }

  return { 
    success: true, 
    user: profile, 
    savedToSupabase,
    message: savedToSupabase
      ? `Data akun ${cleanName} (${levelAkses}) berhasil tersimpan di tabel database Supabase! Silakan masuk dengan email dan kata sandi Anda.`
      : `Akun ${cleanName} (${levelAkses}) berhasil didaftarkan. Silakan masuk untuk menuju dasbor kas.` 
  };
};

/**
 * Logout Pengurus
 */
export const logoutPengurus = async (): Promise<void> => {
  const client = getSupabase();
  if (client) {
    try {
      await client.auth.signOut();
    } catch (err) {
      console.warn('[Supabase SignOut]', err);
    }
  }
  sessionStorage.removeItem(STORAGE_KEY_ACTIVE_USER);
};

/**
 * Memperbarui profil pengurus (seperti foto profil, bentuk avatar, ukuran tampilan)
 */
export const updateUserProfileInStorage = async (
  updatedProfile: UserProfile
): Promise<void> => {
  try {
    // 1. Perbarui active user di SessionStorage
    sessionStorage.setItem(STORAGE_KEY_ACTIVE_USER, JSON.stringify(updatedProfile));

    // 2. Perbarui juga di daftar pengguna terdaftar
    const registeredList = getLocalRegisteredUsers();
    const idx = registeredList.findIndex(
      (u) => u.profile.email.toLowerCase() === updatedProfile.email.toLowerCase()
    );
    if (idx >= 0) {
      registeredList[idx].profile = updatedProfile;
      localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(registeredList));
    }

    // 3. Jika Supabase client aktif, perbarui metadata di Supabase Auth dan simpan ke tabel pengguna / pengurus
    const client = getSupabase();
    if (client) {
      try {
        await client.auth.updateUser({
          data: {
            foto_url: updatedProfile.fotoUrl,
            avatar_shape: updatedProfile.avatarShape,
            avatar_size: updatedProfile.avatarSize,
            avatar_zoom: updatedProfile.avatarZoom,
          },
        });
      } catch (err) {
        console.warn('[Supabase Update User Photo Auth]', err);
      }

      // SINKRONISASI UPDATE FOTO KE TABEL DATABASE (pengguna/pengurus)
      const targetTables = ['pengguna', 'pengurus', 'pengurus_rt', 'users'];
      for (const tbl of targetTables) {
        try {
          const { error: tblErr } = await client
            .from(tbl)
            .update({
              foto_url: updatedProfile.fotoUrl,
            })
            .ilike('email', updatedProfile.email.toLowerCase().trim());

          if (!tblErr) {
            console.log(`[updateUserProfileInStorage] Foto profil berhasil disimpan di tabel '${tbl}'`);
            break; // Jika sukses simpan di satu tabel kandidat, hentikan loop
          }
        } catch (tblEx) {
          console.warn(`[updateUserProfileInStorage Table Error on ${tbl}]`, tblEx);
        }
      }
    }
  } catch (err) {
    console.warn('[UpdateUserProfileInStorage Exception]', err);
  }
};

/* =========================================================================
   17. BACKUP & RESTORE HELPERS FOR ALL 4 TABLES (kas_rt, kategori, pengurus, data_warga)
   ========================================================================= */

/**
 * Mengambil seluruh data pengguna / pengurus dari tabel 'pengguna' (atau fallback 'pengurus') Supabase
 */
export const fetchAllPengurusFromSupabase = async (): Promise<SupabasePengurusRow[]> => {
  const client = getSupabase();
  const getLocalFallback = (): SupabasePengurusRow[] => {
    const local = getLocalRegisteredUsers();
    return local.map((u, idx) => ({
      id: u.profile.id && isUuid(u.profile.id) ? u.profile.id : `00000000-0000-4000-8000-${String(idx + 1).padStart(12, '0')}`,
      nama: u.profile.nama || 'Pengurus RT',
      email: u.profile.email || '',
      password: u.password || 'admin123',
      jabatan: u.profile.role || 'Pengurus',
      level_akses: (u.profile.levelAkses as 'Admin' | 'User') || 'User',
      foto_url: u.profile.fotoUrl,
      no_hp: u.profile.no_hp,
    }));
  };

  if (!client) {
    return getLocalFallback();
  }

  try {
    // 1. Coba ambil dari tabel utama 'pengguna'
    const { data: dataPengguna, error: errorPengguna } = await client
      .from('pengguna')
      .select('*')
      .order('nama', { ascending: true });

    if (!errorPengguna && dataPengguna && dataPengguna.length > 0) {
      return dataPengguna as SupabasePengurusRow[];
    }

    // 2. Fallback ke tabel 'pengurus' jika 'pengguna' belum ada atau kosong
    const { data: dataPengurus, error: errorPengurus } = await client
      .from('pengurus')
      .select('*')
      .order('nama', { ascending: true });

    if (!errorPengurus && dataPengurus && dataPengurus.length > 0) {
      return dataPengurus as SupabasePengurusRow[];
    }

    return getLocalFallback();
  } catch (err) {
    console.warn('[fetchAllPengurusFromSupabase]', err);
    return getLocalFallback();
  }
};

export const fetchAllPenggunaFromSupabase = fetchAllPengurusFromSupabase;

/**
 * Helper untuk mengambil data warga dari local storage
 */
export const getLocalWarga = (): DataWargaItem[] => {
  try {
    const raw = localStorage.getItem('kas_rt_data_warga');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

/**
 * Mengambil seluruh data warga dari tabel 'data_warga' Supabase (atau fallback local storage)
 */
export const fetchDataWargaFromSupabase = async (): Promise<DataWargaItem[]> => {
  const client = getSupabase();

  if (!client) {
    return getLocalWarga();
  }

  try {
    const { data, error } = await client
      .from('data_warga')
      .select('*')
      .order('nama_lengkap', { ascending: true });

    if (error || !data) {
      return getLocalWarga();
    }
    return data as DataWargaItem[];
  } catch (err) {
    console.warn('[fetchDataWargaFromSupabase]', err);
    return getLocalWarga();
  }
};

/**
 * Memulihkan data pengguna / pengurus ke Supabase (tabel pengguna atau pengurus) & registry lokal
 */
export const restorePengurusToSupabase = async (
  pengurusList: any[]
): Promise<{ success: boolean; count: number; error?: string }> => {
  if (!pengurusList || pengurusList.length === 0) {
    return { success: true, count: 0 };
  }

  // 1. Simpan ke registry lokal selalu
  try {
    const localUsers = getLocalRegisteredUsers();
    pengurusList.forEach((p) => {
      const email = (p.email || '').toLowerCase().trim();
      if (!email) return;
      const existingIdx = localUsers.findIndex(u => u.profile.email.toLowerCase() === email);
      const userProfile: UserProfile = {
        id: p.id || `pengurus-${Date.now()}`,
        nama: p.nama || p.name || 'Pengurus RT',
        email,
        role: (p.jabatan || p.role || 'Pengurus') as PengurusRole,
        levelAkses: (p.level_akses || p.levelAkses || 'User') as 'Admin' | 'User',
        no_hp: p.no_hp || p.nohp || p.phone || undefined,
        fotoUrl: p.foto_url || p.fotoUrl,
      };
      const userCred = {
        profile: userProfile,
        password: p.password || 'admin123',
      };
      if (existingIdx >= 0) {
        localUsers[existingIdx] = userCred;
      } else {
        localUsers.push(userCred);
      }
    });
    localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(localUsers));
  } catch (err) {
    console.warn('[restorePengurusToSupabase Local]', err);
  }

  // 2. Simpan ke Supabase jika client aktif
  const client = getSupabase();
  if (!client) {
    return { success: true, count: pengurusList.length };
  }

  try {
    const rows = pengurusList
      .map((p) => {
        const row: Record<string, any> = {
          nama: p.nama || p.name || 'Pengurus RT',
          email: (p.email || '').toLowerCase().trim(),
          password: p.password || 'admin123',
          jabatan: p.jabatan || p.role || 'Pengurus',
          level_akses: p.level_akses || p.levelAkses || 'User',
        };
        if (p.no_hp || p.nohp) {
          row.no_hp = p.no_hp || p.nohp;
        }
        if (p.foto_url || p.fotoUrl) {
          row.foto_url = p.foto_url || p.fotoUrl;
        }
        if (p.id && isUuid(p.id)) {
          row.id = p.id;
        }
        return row;
      })
      .filter((p) => Boolean(p.email));

    if (rows.length === 0) return { success: true, count: 0 };

    // Coba upsert ke tabel 'pengguna' terlebih dahulu
    let targetTable = 'pengguna';
    let { error } = await client.from('pengguna').upsert(rows, { onConflict: 'email' });

    if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
      targetTable = 'pengurus';
      const retry = await client.from('pengurus').upsert(rows, { onConflict: 'email' });
      error = retry.error;
    }

    if (error) {
      console.warn(`[restorePengurusToSupabase Upsert on ${targetTable}]`, error.message);
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: rows.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
};

export const restorePenggunaToSupabase = restorePengurusToSupabase;

/**
 * Memulihkan data warga ke Supabase (tabel data_warga) & local storage
 */
export const restoreDataWargaToSupabase = async (
  wargaList: any[]
): Promise<{ success: boolean; count: number; error?: string }> => {
  if (!wargaList || wargaList.length === 0) {
    return { success: true, count: 0 };
  }

  // 1. Simpan ke LocalStorage selalu
  try {
    localStorage.setItem('kas_rt_data_warga', JSON.stringify(wargaList));
  } catch (err) {
    console.warn('[restoreDataWargaToSupabase Local]', err);
  }

  // 2. Simpan ke Supabase jika client aktif
  const client = getSupabase();
  if (!client) {
    return { success: true, count: wargaList.length };
  }

  try {
    const rows = wargaList
      .map((w) => {
        const row: Record<string, any> = {
          no_kk: String(w.no_kk || ''),
          nik: String(w.nik || ''),
          nama_lengkap: w.nama_lengkap || '',
          jenis_kelamin: w.jenis_kelamin || 'Laki-laki',
          tempat_lahir: w.tempat_lahir || null,
          tanggal_lahir: w.tanggal_lahir || null,
          agama: w.agama || 'Islam',
          pendidikan: w.pendidikan || null,
          pekerjaan: w.pekerjaan || null,
          status_perkawinan: w.status_perkawinan || 'Belum Kawin',
          alamat_domisili: w.alamat_domisili || '-',
          no_hp: w.no_hp || null,
          status_warga: w.status_warga || 'Warga Tetap',
          catatan: w.catatan || null,
        };
        if (w.id && isUuid(w.id)) {
          row.id = w.id;
        }
        return row;
      })
      .filter((w) => Boolean(w.nik) && Boolean(w.nama_lengkap));

    if (rows.length === 0) return { success: true, count: 0 };

    const { error } = await client.from('data_warga').upsert(rows, { onConflict: 'nik' });
    if (error) {
      console.warn('[restoreDataWargaToSupabase Upsert]', error.message);
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: rows.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
};

/* =========================================================================
   12. TABEL SEKRETARIAT RT: FETCH, UPDATE & RESTORE HELPERS
   ========================================================================= */

export const DEFAULT_SEKRETARIAT: SekretariatItem = {
  rt: '',
  rw: '',
  kelurahan: '',
  alamat: '',
  kecamatan: '',
  kota_kabupaten: '',
  provinsi: '',
  kode_pos: '',
};

const STORAGE_KEY_SEKRETARIAT = 'kas_rt_sekretariat';

export const mapSekretariatRow = (data: any): SekretariatItem => {
  if (!data || typeof data !== 'object') return DEFAULT_SEKRETARIAT;
  return {
    id: data.id,
    rt: String(data.rt || data.RT || '').trim(),
    rw: String(data.rw || data.RW || '').trim(),
    kelurahan: String(data.kelurahan || data.Kelurahan || '').trim(),
    alamat: String(data.alamat || data.Alamat || '').trim(),
    kecamatan: String(data.kecamatan || data.Kecamatan || '').trim(),
    kota_kabupaten: data.kota_kabupaten || data.kota || '',
    provinsi: data.provinsi || '',
    kode_pos: data.kode_pos || '',
    telepon: data.telepon || data.no_hp || '',
    email: data.email || '',
    nama_ketua_rt: data.nama_ketua_rt || '',
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
};

/**
 * Mengambil data profil sekretariat RT dari tabel Supabase (sekretariat / Sekretariat)
 * dengan fallback ke localStorage.
 */
export const getSekretariatFromSupabase = async (): Promise<{
  data: SekretariatItem;
  fromSupabase: boolean;
  error: string | null;
  isDbEmpty: boolean;
}> => {
  // 1. Cek fallback lokal terlebih dahulu
  let localData = DEFAULT_SEKRETARIAT;
  let hasLocalCache = false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SEKRETARIAT);
    if (raw) {
      localData = mapSekretariatRow(JSON.parse(raw));
      hasLocalCache = true;
    }
  } catch {
    // Ignore local parse error
  }

  const client = getSupabase();
  if (!client) {
    return { data: localData, fromSupabase: false, error: null, isDbEmpty: !hasLocalCache };
  }

  try {
    // Ambil seluruh baris dari tabel 'sekretariat'
    let { data, error } = await client
      .from('sekretariat')
      .select('*');

    // Jika tabel tidak ditemukan, coba nama dengan huruf kapital 'Sekretariat'
    if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
      const retry = await client
        .from('Sekretariat')
        .select('*');
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.warn('[getSekretariatFromSupabase]', error.message);
      // Jika error 42P01 (relation does not exist), asumsikan tabel kosong/belum siap
      const isTableMissing = error.code === '42P01' || error.message?.includes('does not exist');
      return { 
        data: localData, 
        fromSupabase: false, 
        error: error.message, 
        isDbEmpty: isTableMissing ? true : !hasLocalCache 
      };
    }

    // Normalisasi data menjadi array baris yang aman
    const rows = Array.isArray(data) ? data : (data ? [data] : []);

    if (rows.length > 0) {
      const firstRow = rows[0];
      // Pastikan baris tersebut valid (memiliki kolom kunci seperti rt atau id)
      const hasValidRow = firstRow && (firstRow.rt || firstRow.RT || firstRow.id);

      if (hasValidRow) {
        const parsed = mapSekretariatRow(firstRow);
        // Simpan salinan ke localStorage agar tetap sinkron saat offline
        try {
          localStorage.setItem(STORAGE_KEY_SEKRETARIAT, JSON.stringify(parsed));
        } catch {
          // Ignore quota error
        }
        return { data: parsed, fromSupabase: true, error: null, isDbEmpty: false };
      }
    }

    // Jika data === null, array kosong, atau data tidak valid, berarti tabel kosong di database
    // Hapus local cache yang out-of-sync agar tidak menipu aplikasi
    try {
      localStorage.removeItem(STORAGE_KEY_SEKRETARIAT);
    } catch {
      // Ignore
    }
    return { data: DEFAULT_SEKRETARIAT, fromSupabase: false, error: null, isDbEmpty: true };
  } catch (err: any) {
    return { data: localData, fromSupabase: false, error: err.message, isDbEmpty: !hasLocalCache };
  }
};

/**
 * Menyimpan / memperbarui profil sekretariat RT ke Supabase dan localStorage
 */
export const saveSekretariatToSupabase = async (
  item: Partial<SekretariatItem>
): Promise<{ success: boolean; data: SekretariatItem; error: string | null }> => {
  const merged: SekretariatItem = {
    ...DEFAULT_SEKRETARIAT,
    ...item,
    updated_at: new Date().toISOString(),
  };

  const client = getSupabase();
  if (!client) {
    // Jika offline, simpan ke localStorage
    try {
      localStorage.setItem(STORAGE_KEY_SEKRETARIAT, JSON.stringify(merged));
    } catch {
      // Ignore storage error
    }
    return { success: true, data: merged, error: null };
  }

  try {
    // Hanya gunakan struktur 5 kolom resmi: RT, RW, Kelurahan, Kecamatan, Alamat
    const payload = {
      rt: String(merged.rt || '').trim(),
      rw: String(merged.rw || '').trim(),
      kelurahan: String(merged.kelurahan || '').trim(),
      kecamatan: String(merged.kecamatan || '').trim(),
      alamat: String(merged.alamat || '').trim(),
    };

    // Cek apakah sudah ada baris di tabel sekretariat
    let { data: existingRows, error: checkError } = await client
      .from('sekretariat')
      .select('*');

    if (checkError && (checkError.code === '42P01' || checkError.message?.includes('does not exist'))) {
      const retryCheck = await client.from('Sekretariat').select('*');
      existingRows = retryCheck.data;
      checkError = retryCheck.error;
    }

    let data: any = null;
    let error: any = null;

    if (existingRows && existingRows.length > 0) {
      const existing = existingRows[0];
      let updateQuery = client.from('sekretariat').update(payload);
      if (existing.id !== undefined && existing.id !== null) {
        updateQuery = updateQuery.eq('id', existing.id);
      } else {
        updateQuery = updateQuery.not('rt', 'is', null);
      }
      const res = await updateQuery.select();
      data = res.data?.[0] || res.data;
      error = res.error;

      if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
        let retryUpdate = client.from('Sekretariat').update(payload);
        if (existing.id !== undefined && existing.id !== null) {
          retryUpdate = retryUpdate.eq('id', existing.id);
        } else {
          retryUpdate = retryUpdate.not('rt', 'is', null);
        }
        const res2 = await retryUpdate.select();
        data = res2.data?.[0] || res2.data;
        error = res2.error;
      }
    } else {
      const res = await client
        .from('sekretariat')
        .insert([payload])
        .select();
      data = res.data?.[0] || res.data;
      error = res.error;

      if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
        const retry = await client
          .from('Sekretariat')
          .insert([payload])
          .select();
        data = retry.data?.[0] || retry.data;
        error = retry.error;
      }
    }

    if (error) {
      console.warn('[saveSekretariatToSupabase]', error.message);
      return { success: false, data: merged, error: error.message };
    }

    const saved = data ? mapSekretariatRow({ ...merged, ...(typeof data === 'object' ? data : {}) }) : merged;
    try {
      localStorage.setItem(STORAGE_KEY_SEKRETARIAT, JSON.stringify(saved));
    } catch {
      // Ignore
    }
    return { success: true, data: saved, error: null };
  } catch (err: any) {
    return { success: false, data: merged, error: err.message };
  }
};

/**
 * Memulihkan data sekretariat RT saat proses Restore Database
 */
export const restoreSekretariatToSupabase = async (
  items: (SekretariatItem | any)[]
): Promise<{ success: boolean; count: number; error: string | null }> => {
  if (!items || items.length === 0) return { success: true, count: 0, error: null };

  const first = mapSekretariatRow(items[0]);
  return saveSekretariatToSupabase(first).then((res) => ({
    success: res.success,
    count: res.success ? 1 : 0,
    error: res.error,
  }));
};

/**
 * Hapus seluruh data dari tabel 'data_warga' di Supabase
 */
export const deleteAllWargaFromSupabase = async (): Promise<{
  success: boolean;
  count: number;
  error: string | null;
}> => {
  try {
    localStorage.setItem('kas_rt_data_warga', JSON.stringify([]));
  } catch {}

  const client = getSupabase();
  if (!client) return { success: true, count: 0, error: null };
  try {
    // Unlink foreign key in kas_rt first so foreign key constraint 23503 doesn't block
    try {
      await client.from('kas_rt').update({ warga_id: null }).not('warga_id', 'is', null);
    } catch {}

    let { data, error } = await client
      .from('data_warga')
      .delete()
      .or('id.neq.00000000-0000-0000-0000-000000000000,id.is.null')
      .select('id');

    if (error) {
      const retry = await client.from('data_warga').delete().neq('nik', '__non_existent__').select('id');
      if (!retry.error) {
        data = retry.data;
        error = null;
      }
    }

    if (error && error.code !== '42P01') {
      console.error('[Supabase Delete All Warga Error]', error);
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: data?.length || 0, error: null };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
};

/**
 * Hapus seluruh data dari tabel 'kategori' di Supabase
 */
export const deleteAllCategoriesFromSupabase = async (): Promise<{
  success: boolean;
  count: number;
  error: string | null;
}> => {
  try {
    localStorage.setItem('kas_rt_categories', JSON.stringify([]));
  } catch {}

  const client = getSupabase();
  if (!client) return { success: true, count: 0, error: null };
  try {
    let totalDeleted = 0;
    const tables = ['kategori', 'kategori_kas'];
    for (const tbl of tables) {
      try {
        let { data, error } = await client
          .from(tbl)
          .delete()
          .or('id.neq.00000000-0000-0000-0000-000000000000,id.is.null')
          .select('id');

        if (error) {
          const retry = await client.from(tbl).delete().neq('nama', '__non_existent__').select('id');
          if (!retry.error) {
            data = retry.data;
            error = null;
          }
        }

        if (!error && data) {
          totalDeleted += data.length;
        }
      } catch {}
    }

    return { success: true, count: totalDeleted, error: null };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
};

/**
 * Hapus seluruh data dari tabel 'pengguna' di Supabase
 */
export const deleteAllPenggunaFromSupabase = async (): Promise<{
  success: boolean;
  count: number;
  error: string | null;
}> => {
  try {
    localStorage.removeItem('kas_rt_registered_users');
    sessionStorage.removeItem('kas_rt_active_user');
  } catch {}

  const client = getSupabase();
  if (!client) return { success: true, count: 0, error: null };
  try {
    let totalDeleted = 0;
    const tables = ['pengguna', 'pengurus', 'pengurus_rt', 'users'];
    for (const tbl of tables) {
      try {
        let { data, error } = await client
          .from(tbl)
          .delete()
          .or('id.neq.00000000-0000-0000-0000-000000000000,id.is.null')
          .select('id');

        if (error) {
          const retry = await client.from(tbl).delete().neq('email', '__non_existent__').select('id');
          if (!retry.error) {
            data = retry.data;
            error = null;
          }
        }

        if (!error && data) {
          totalDeleted += data.length;
        }
      } catch {}
    }

    return { success: true, count: totalDeleted, error: null };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
};

/**
 * Hapus seluruh data dari tabel 'sekretariat' di Supabase dan bersihkan cache lokal
 */
export const deleteSekretariatFromSupabase = async (): Promise<{
  success: boolean;
  count: number;
  error: string | null;
}> => {
  try {
    localStorage.removeItem(STORAGE_KEY_SEKRETARIAT);
  } catch {}

  const client = getSupabase();
  if (!client) {
    return { success: true, count: 1, error: null };
  }

  try {
    let totalDeleted = 0;
    const tables = ['sekretariat', 'Sekretariat'];
    for (const tbl of tables) {
      try {
        let res = await client.from(tbl).delete().or('id.neq.00000000-0000-0000-0000-000000000000,id.is.null').select('id');
        if (res.error) {
          res = await client.from(tbl).delete().neq('rt', '__non_existent__').select('id');
        }
        if (!res.error && res.data) {
          totalDeleted += res.data.length;
        }
      } catch {}
    }

    return { success: true, count: totalDeleted || 1, error: null };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
};

/**
 * Alias untuk menghapus seluruh data tabel 'sekretariat'
 */
export const deleteAllSekretariatFromSupabase = deleteSekretariatFromSupabase;

/**
 * Alias eksplisit untuk fungsi koreksi/pembaruan tabel 'sekretariat'
 */
export const updateSekretariatToSupabase = saveSekretariatToSupabase;

/**
 * Memeriksa apakah seorang warga (berdasarkan id, no_kk, nik, atau email) sudah memiliki akun terdaftar di tabel pengguna
 */
export const checkCitizenAlreadyHasAccount = async (params: {
  wargaId?: string;
  no_kk?: string;
  nik?: string;
  email?: string;
}): Promise<{ exists: boolean; account?: { id: string; nama: string; email: string; role: string; no_kk?: string }; error?: string }> => {
  const client = getSupabase();
  const cleanEmail = params.email?.trim().toLowerCase();

  if (client) {
    const tableCandidates = ['pengguna', 'pengurus', 'pengurus_rt', 'users'];
    for (const tbl of tableCandidates) {
      try {
        const { data, error } = await client.from(tbl).select('*').limit(500);
        if (!error && data) {
          const found = data.find((row: any) => {
            // Cek email
            if (cleanEmail) {
              const rowEmail = String(row.email || row.Email || '').trim().toLowerCase();
              if (rowEmail === cleanEmail) return true;
            }
            // Cek warga_id
            if (params.wargaId && row.warga_id && String(row.warga_id) === String(params.wargaId)) {
              return true;
            }
            // Cek no_kk
            if (params.no_kk && row.no_kk && String(row.no_kk) === String(params.no_kk)) {
              return true;
            }
            // Cek nik
            if (params.nik && row.nik && String(row.nik) === String(params.nik)) {
              return true;
            }
            return false;
          });

          if (found) {
            return {
              exists: true,
              account: {
                id: found.id || '',
                nama: found.nama || found.name || 'Warga RT',
                email: found.email || found.Email || '',
                role: found.jabatan || found.role || 'Warga',
                no_kk: found.no_kk || undefined,
              }
            };
          }
        }
      } catch (err) {
        console.warn(`[checkCitizenAlreadyHasAccount Exception on ${tbl}]`, err);
      }
    }
  }

  // Fallback ke registry lokal
  const localUsers = getLocalRegisteredUsers();
  const foundLocal = localUsers.find((u) => {
    if (cleanEmail && u.profile.email.toLowerCase() === cleanEmail) return true;
    if (params.wargaId && u.profile.wargaId === params.wargaId) return true;
    if (params.no_kk && u.profile.no_kk === params.no_kk) return true;
    if (params.nik && u.profile.nik === params.nik) return true;
    return false;
  });

  if (foundLocal) {
    return {
      exists: true,
      account: {
        id: foundLocal.profile.id,
        nama: foundLocal.profile.nama,
        email: foundLocal.profile.email,
        role: foundLocal.profile.role,
        no_kk: foundLocal.profile.no_kk,
      }
    };
  }

  return { exists: false };
};

export interface InitialSetupPayload {
  sekretariat: {
    rt: string;
    rw: string;
    kelurahan: string;
    kecamatan: string;
    alamat: string;
  };
  pengurusInti: {
    role: PengurusRole; // 'Ketua RT' | 'Sekretaris' | 'Bendahara' | 'Wakil Ketua RT'
    nama: string;
    nik?: string;
    no_kk?: string;
    jenis_kelamin: 'Laki-laki' | 'Perempuan';
    tempat_lahir?: string;
    tanggal_lahir?: string;
    agama?: string;
    status_perkawinan?: 'Belum Kawin' | 'Kawin' | 'Cerai Hidup' | 'Cerai Mati';
    status_warga?: 'Warga Tetap' | 'Warga Pendatang/Kontrak' | 'Warga Kos';
    pendidikan?: string;
    pekerjaan?: string;
    no_hp?: string;
    alamat_domisili: string;
    catatan?: string;
    email: string;
    password: string;
  };
}

/**
 * Inisialisasi Lengkap Sistem:
 * 1. Simpan Data Wilayah ke tabel sekretariat
 * 2. Masukkan Data Kependudukan Pengurus Inti ke tabel data_warga
 * 3. Daftarkan Akun Administrator Pengurus Inti ke tabel pengguna
 */
export const initializeSystemWithCorePengurus = async (
  payload: InitialSetupPayload
): Promise<{
  success: boolean;
  user?: UserProfile;
  sekretariat?: SekretariatItem;
  error?: string;
}> => {
  try {
    const client = getSupabase();

    // 1. Simpan Data Sekretariat Wilayah
    const sekRes = await saveSekretariatToSupabase(payload.sekretariat);
    if (!sekRes.success) {
      return { success: false, error: sekRes.error || 'Gagal menyimpan data wilayah sekretariat.' };
    }

    // 2. Simpan Data Kependudukan Pengurus Inti ke tabel data_warga
    let citizenId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `warga-${Date.now()}`;
    const generate16Digit = () => {
      let result = '';
      for (let i = 0; i < 16; i++) {
        result += Math.floor(Math.random() * 10).toString();
      }
      return result;
    };

    let cleanNik = (payload.pengurusInti.nik || '').replace(/\D/g, '');
    if (!cleanNik) {
      cleanNik = generate16Digit();
    } else if (cleanNik.length < 16) {
      while (cleanNik.length < 16) cleanNik += Math.floor(Math.random() * 10).toString();
    }

    let cleanKk = (payload.pengurusInti.no_kk || '').replace(/\D/g, '');
    if (!cleanKk) {
      cleanKk = generate16Digit();
    } else if (cleanKk.length < 16) {
      while (cleanKk.length < 16) cleanKk += Math.floor(Math.random() * 10).toString();
    }

    const cleanNama = payload.pengurusInti.nama.trim();
    const cleanEmail = payload.pengurusInti.email.trim().toLowerCase();
    const cleanHp = (payload.pengurusInti.no_hp || '').trim();
    const cleanRole = payload.pengurusInti.role;

    const citizenRecord: DataWargaItem = {
      id: citizenId,
      no_kk: cleanKk,
      nik: cleanNik,
      nama_lengkap: cleanNama,
      jenis_kelamin: payload.pengurusInti.jenis_kelamin || 'Laki-laki',
      tempat_lahir: payload.pengurusInti.tempat_lahir ? payload.pengurusInti.tempat_lahir.trim() : undefined,
      tanggal_lahir: payload.pengurusInti.tanggal_lahir ? payload.pengurusInti.tanggal_lahir.trim() : undefined,
      agama: payload.pengurusInti.agama || 'Islam',
      status_perkawinan: payload.pengurusInti.status_perkawinan || 'Kawin',
      status_warga: payload.pengurusInti.status_warga || 'Warga Tetap',
      pendidikan: payload.pengurusInti.pendidikan ? payload.pengurusInti.pendidikan.trim() : undefined,
      pekerjaan: payload.pengurusInti.pekerjaan ? payload.pengurusInti.pekerjaan.trim() : undefined,
      alamat_domisili: payload.pengurusInti.alamat_domisili || payload.sekretariat.alamat || '-',
      no_hp: cleanHp || undefined,
      catatan: payload.pengurusInti.catatan ? payload.pengurusInti.catatan.trim() : `Pengurus Inti (${cleanRole})`,
      created_at: new Date().toISOString(),
    };

    // Simpan ke Supabase jika client aktif
    if (client) {
      try {
        const { data: existingWarga } = await client
          .from('data_warga')
          .select('id')
          .eq('nik', cleanNik)
          .maybeSingle();

        if (existingWarga?.id) {
          citizenId = existingWarga.id;
          await client.from('data_warga').update({
            no_kk: cleanKk,
            nama_lengkap: cleanNama,
            jenis_kelamin: citizenRecord.jenis_kelamin,
            tempat_lahir: citizenRecord.tempat_lahir || null,
            tanggal_lahir: citizenRecord.tanggal_lahir || null,
            agama: citizenRecord.agama,
            status_perkawinan: citizenRecord.status_perkawinan,
            status_warga: citizenRecord.status_warga,
            pendidikan: citizenRecord.pendidikan || null,
            pekerjaan: citizenRecord.pekerjaan || null,
            alamat_domisili: citizenRecord.alamat_domisili,
            no_hp: cleanHp || null,
            catatan: citizenRecord.catatan || null,
          }).eq('id', citizenId);
        } else {
          const insertRes = await client.from('data_warga').insert([citizenRecord]).select('id');
          if (insertRes.data?.[0]?.id) {
            citizenId = insertRes.data[0].id;
          }
        }
      } catch (wErr) {
        console.warn('[initializeSystemWithCorePengurus data_warga Exception]', wErr);
      }
    }

    // Update local data_warga storage
    try {
      const localW = getLocalWarga();
      const existIdx = localW.findIndex(w => w.nik === cleanNik);
      if (existIdx >= 0) {
        localW[existIdx] = { ...localW[existIdx], ...citizenRecord, id: citizenId };
      } else {
        localW.push({ ...citizenRecord, id: citizenId });
      }
      localStorage.setItem('kas_rt_data_warga', JSON.stringify(localW));
    } catch {
      // ignore
    }

    // 3. Register Akun Administrator Pengurus Inti ke tabel pengguna
    const regRes = await registerPengurus(
      cleanEmail,
      payload.pengurusInti.password,
      cleanNama,
      cleanRole,
      'Admin',
      cleanHp,
      {
        wargaId: citizenId,
        no_kk: cleanKk,
        nik: cleanNik,
        alamat_domisili: citizenRecord.alamat_domisili,
      }
    );

    if (!regRes.success || !regRes.user) {
      return {
        success: false,
        error: regRes.error || 'Data wilayah tersimpan, namun gagal mendaftarkan akun pengurus inti.',
      };
    }

    return {
      success: true,
      user: regRes.user,
      sekretariat: sekRes.data,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Terjadi kesalahan sistem saat inisialisasi.' };
  }
};

/* =========================================================================
   INVENTARIS RT & PEMINJAMAN ASET FUNCTIONS
   ========================================================================= */

// Helpers to read/write local inventory data
export const getLocalInventaris = (): InventarisItem[] => {
  try {
    const saved = localStorage.getItem('kas_rt_inventaris');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const saveLocalInventaris = (items: InventarisItem[]) => {
  localStorage.setItem('kas_rt_inventaris', JSON.stringify(items));
};

export const getLocalPeminjaman = (): PeminjamanItem[] => {
  try {
    const saved = localStorage.getItem('kas_rt_peminjaman');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const saveLocalPeminjaman = (items: PeminjamanItem[]) => {
  localStorage.setItem('kas_rt_peminjaman', JSON.stringify(items));
};

// FETCH INVENTARIS
export const fetchInventarisFromSupabase = async (): Promise<{
  data: InventarisItem[] | null;
  error: string | null;
  tableNotCreated?: boolean;
}> => {
  const client = getSupabase();
  if (!client) {
    return { data: getLocalInventaris(), error: null };
  }

  try {
    const { data, error } = await client
      .from('inventaris_rt')
      .select('*')
      .order('nama_barang', { ascending: true });

    if (error) {
      if (error.code === '42P01') {
        return { data: getLocalInventaris(), error: null, tableNotCreated: true };
      }
      return { data: null, error: error.message };
    }

    saveLocalInventaris(data || []);
    return { data, error: null };
  } catch (err: any) {
    return { data: getLocalInventaris(), error: null };
  }
};

// INSERT INVENTARIS
export const insertInventarisToSupabase = async (
  item: Omit<InventarisItem, 'id' | 'created_at'>
): Promise<{
  data: InventarisItem | null;
  error: string | null;
}> => {
  const client = getSupabase();
  const nextId = crypto.randomUUID();
  const localItem: InventarisItem = {
    ...item,
    id: nextId,
    created_at: new Date().toISOString(),
  };

  // Add to local cache first
  const localList = getLocalInventaris();
  localList.push(localItem);
  saveLocalInventaris(localList);

  if (!client) {
    return { data: localItem, error: null };
  }

  try {
    const { data, error } = await client
      .from('inventaris_rt')
      .insert([{ id: nextId, ...item }])
      .select()
      .single();

    if (error) {
      console.warn('[Supabase Inventaris Insert Error]', error);
      if (error.code === '42P01') {
        return { data: localItem, error: null };
      }
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    return { data: localItem, error: null };
  }
};

// UPDATE INVENTARIS
export const updateInventarisInSupabase = async (
  item: InventarisItem
): Promise<{
  data: InventarisItem | null;
  error: string | null;
}> => {
  const client = getSupabase();

  // Update local cache
  const localList = getLocalInventaris();
  const index = localList.findIndex(i => i.id === item.id);
  if (index >= 0) {
    localList[index] = item;
    saveLocalInventaris(localList);
  }

  if (!client || !isUuid(item.id)) {
    return { data: item, error: null };
  }

  try {
    const { data, error } = await client
      .from('inventaris_rt')
      .update({
        nama_barang: item.nama_barang,
        jumlah_total: Number(item.jumlah_total),
        jumlah_baik: Number(item.jumlah_baik),
        jumlah_rusak: Number(item.jumlah_rusak),
        kondisi: item.kondisi,
        lokasi_penyimpanan: item.lokasi_penyimpanan,
        catatan: item.catatan,
      })
      .eq('id', item.id)
      .select()
      .single();

    if (error) {
      console.warn('[Supabase Inventaris Update Error]', error);
      if (error.code === '42P01') {
        return { data: item, error: null };
      }
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    return { data: item, error: null };
  }
};

// DELETE INVENTARIS
export const deleteInventarisFromSupabase = async (
  id: string
): Promise<{
  success: boolean;
  error: string | null;
}> => {
  const client = getSupabase();

  // Remove from local cache
  const localList = getLocalInventaris();
  const filtered = localList.filter(i => i.id !== id);
  saveLocalInventaris(filtered);

  // Also filter any loans for this item
  const localLoans = getLocalPeminjaman();
  const filteredLoans = localLoans.filter(l => l.id_barang !== id);
  saveLocalPeminjaman(filteredLoans);

  if (!client || !isUuid(id)) {
    return { success: true, error: null };
  }

  try {
    const { error } = await client
      .from('inventaris_rt')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === '42P01') {
        return { success: true, error: null };
      }
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

// FETCH PEMINJAMAN
export const fetchPeminjamanFromSupabase = async (): Promise<{
  data: PeminjamanItem[] | null;
  error: string | null;
}> => {
  const client = getSupabase();
  if (!client) {
    return { data: getLocalPeminjaman(), error: null };
  }

  try {
    const { data, error } = await client
      .from('peminjaman_aset_rt')
      .select('*')
      .order('tanggal_pinjam', { ascending: false });

    if (error) {
      if (error.code === '42P01') {
        return { data: getLocalPeminjaman(), error: null };
      }
      return { data: null, error: error.message };
    }

    saveLocalPeminjaman(data || []);
    return { data, error: null };
  } catch (err: any) {
    return { data: getLocalPeminjaman(), error: null };
  }
};

// INSERT PEMINJAMAN
export const insertPeminjamanToSupabase = async (
  loan: Omit<PeminjamanItem, 'id' | 'created_at'>
): Promise<{
  data: PeminjamanItem | null;
  error: string | null;
}> => {
  const client = getSupabase();
  const nextId = crypto.randomUUID();
  const localItem: PeminjamanItem = {
    ...loan,
    id: nextId,
    created_at: new Date().toISOString(),
  };

  // Add to local cache first
  const localList = getLocalPeminjaman();
  localList.push(localItem);
  saveLocalPeminjaman(localList);

  if (!client) {
    return { data: localItem, error: null };
  }

  try {
    const { data, error } = await client
      .from('peminjaman_aset_rt')
      .insert([{ id: nextId, ...loan }])
      .select()
      .single();

    if (error) {
      console.warn('[Supabase Peminjaman Insert Error]', error);
      if (error.code === '42P01') {
        return { data: localItem, error: null };
      }
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    return { data: localItem, error: null };
  }
};

// UPDATE PEMINJAMAN
export const updatePeminjamanInSupabase = async (
  loan: PeminjamanItem
): Promise<{
  data: PeminjamanItem | null;
  error: string | null;
}> => {
  const client = getSupabase();

  // Update local cache
  const localList = getLocalPeminjaman();
  const index = localList.findIndex(l => l.id === loan.id);
  if (index >= 0) {
    localList[index] = loan;
    saveLocalPeminjaman(localList);
  }

  if (!client || !isUuid(loan.id)) {
    return { data: loan, error: null };
  }

  try {
    const { data, error } = await client
      .from('peminjaman_aset_rt')
      .update({
        id_barang: loan.id_barang,
        id_warga: loan.id_warga,
        tanggal_pinjam: loan.tanggal_pinjam,
        tanggal_kembali: loan.tanggal_kembali || null,
        jumlah_pinjam: Number(loan.jumlah_pinjam),
        keperluan: loan.keperluan,
        status: loan.status,
        catatan: loan.catatan,
      })
      .eq('id', loan.id)
      .select()
      .single();

    if (error) {
      console.warn('[Supabase Peminjaman Update Error]', error);
      if (error.code === '42P01') {
        return { data: loan, error: null };
      }
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    return { data: loan, error: null };
  }
};

// DELETE PEMINJAMAN
export const deletePeminjamanFromSupabase = async (
  id: string
): Promise<{
  success: boolean;
  error: string | null;
}> => {
  const client = getSupabase();

  // Remove from local cache
  const localList = getLocalPeminjaman();
  const filtered = localList.filter(l => l.id !== id);
  saveLocalPeminjaman(filtered);

  if (!client || !isUuid(id)) {
    return { success: true, error: null };
  }

  try {
    const { error } = await client
      .from('peminjaman_aset_rt')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === '42P01') {
        return { success: true, error: null };
      }
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

/* =========================================================================
   EMERGENCY ALERTS & SIREN SYSTEM FUNCTIONS
   ========================================================================= */

export interface EmergencyAlertItem {
  id: string;
  id_warga: string;
  nama_warga: string;
  alamat: string;
  no_hp?: string;
  tipe_darurat: string;
  status: 'Aktif' | 'Selesai';
  keterangan?: string;
  created_at?: string;
}

export const getLocalEmergencyAlerts = (): EmergencyAlertItem[] => {
  try {
    const saved = localStorage.getItem('kas_rt_emergency_alerts');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const saveLocalEmergencyAlerts = (items: EmergencyAlertItem[]) => {
  localStorage.setItem('kas_rt_emergency_alerts', JSON.stringify(items));
};

export const fetchActiveEmergencyAlerts = async (): Promise<{
  data: EmergencyAlertItem[] | null;
  error: string | null;
}> => {
  const client = getSupabase();
  if (!client) {
    const active = getLocalEmergencyAlerts().filter(a => a.status === 'Aktif');
    return { data: active, error: null };
  }

  try {
    const { data, error } = await client
      .from('darurat_rt')
      .select('*')
      .eq('status', 'Aktif')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') {
        const active = getLocalEmergencyAlerts().filter(a => a.status === 'Aktif');
        return { data: active, error: null };
      }
      return { data: null, error: error.message };
    }

    // merge with local
    const local = getLocalEmergencyAlerts();
    const merged = [...(data || [])];
    local.forEach(l => {
      if (l.status === 'Aktif' && !merged.some(m => m.id === l.id)) {
        merged.push(l);
      }
    });

    return { data: merged, error: null };
  } catch (err: any) {
    const active = getLocalEmergencyAlerts().filter(a => a.status === 'Aktif');
    return { data: active, error: null };
  }
};

export const insertEmergencyAlertToSupabase = async (
  alert: Omit<EmergencyAlertItem, 'id' | 'created_at'>
): Promise<{
  data: EmergencyAlertItem | null;
  error: string | null;
}> => {
  const client = getSupabase();
  const nextId = crypto.randomUUID();
  const localItem: EmergencyAlertItem = {
    ...alert,
    id: nextId,
    created_at: new Date().toISOString(),
  };

  // Add to local cache first
  const localList = getLocalEmergencyAlerts();
  localList.unshift(localItem);
  saveLocalEmergencyAlerts(localList);

  if (!client) {
    return { data: localItem, error: null };
  }

  try {
    const { data, error } = await client
      .from('darurat_rt')
      .insert([{ id: nextId, ...alert }])
      .select()
      .single();

    if (error) {
      console.warn('[Supabase Emergency Insert Error]', error);
      if (error.code === '42P01') {
        return { data: localItem, error: null };
      }
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    return { data: localItem, error: null };
  }
};

export const resolveEmergencyAlertInSupabase = async (
  id: string
): Promise<{
  success: boolean;
  error: string | null;
}> => {
  const client = getSupabase();

  // Update local cache
  const localList = getLocalEmergencyAlerts();
  const index = localList.findIndex(l => l.id === id);
  if (index >= 0) {
    localList[index].status = 'Selesai';
    saveLocalEmergencyAlerts(localList);
  }

  if (!client || !isUuid(id)) {
    return { success: true, error: null };
  }

  try {
    const { error } = await client
      .from('darurat_rt')
      .update({ status: 'Selesai' })
      .eq('id', id);

    if (error) {
      console.warn('[Supabase Emergency Resolve Error]', error);
      if (error.code === '42P01') {
        return { success: true, error: null };
      }
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

/* =========================================================================
   RESTORE & CLEAR HELPERS FOR 8 TABLES
   ========================================================================= */

/**
 * Memulihkan data inventaris ke Supabase & LocalStorage
 */
export const restoreInventarisToSupabase = async (
  items: (InventarisItem | any)[]
): Promise<{ success: boolean; count: number; error?: string }> => {
  if (!items || items.length === 0) return { success: true, count: 0 };

  try {
    saveLocalInventaris(items);
  } catch (e) {
    console.warn('[restoreInventaris Local]', e);
  }

  const client = getSupabase();
  if (!client) return { success: true, count: items.length };

  try {
    const rows = items.map((i) => {
      const row: Record<string, any> = {
        nama_barang: i.nama_barang || i.nama || 'Barang Inventaris',
        jumlah_total: Number(i.jumlah_total) || 1,
        jumlah_baik: Number(i.jumlah_baik) || 1,
        jumlah_rusak: Number(i.jumlah_rusak) || 0,
        kondisi: i.kondisi || 'Baik',
        lokasi_penyimpanan: i.lokasi_penyimpanan || null,
        catatan: i.catatan || null,
      };
      if (i.id && isUuid(i.id)) {
        row.id = i.id;
      }
      return row;
    });

    const { error } = await client.from('inventaris_rt').upsert(rows);
    if (error) {
      if (error.code === '42P01') {
        return { success: true, count: items.length };
      }
      console.warn('[restoreInventarisToSupabase Upsert Error]', error.message);
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: rows.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
};

/**
 * Memulihkan data peminjaman aset ke Supabase & LocalStorage
 */
export const restorePeminjamanToSupabase = async (
  items: (PeminjamanItem | any)[]
): Promise<{ success: boolean; count: number; error?: string }> => {
  if (!items || items.length === 0) return { success: true, count: 0 };

  try {
    saveLocalPeminjaman(items);
  } catch (e) {
    console.warn('[restorePeminjaman Local]', e);
  }

  const client = getSupabase();
  if (!client) return { success: true, count: items.length };

  try {
    const rows = items
      .map((p) => {
        const row: Record<string, any> = {
          id_barang: p.id_barang,
          id_warga: p.id_warga,
          tanggal_pinjam: p.tanggal_pinjam || new Date().toISOString().split('T')[0],
          tanggal_kembali: p.tanggal_kembali || null,
          jumlah_pinjam: Number(p.jumlah_pinjam) || 1,
          keperluan: p.keperluan || null,
          status: p.status === 'Kembali' ? 'Kembali' : 'Dipinjam',
          catatan: p.catatan || null,
        };
        if (p.id && isUuid(p.id)) {
          row.id = p.id;
        }
        return row;
      })
      .filter((p) => Boolean(p.id_barang) && Boolean(p.id_warga));

    if (rows.length === 0) return { success: true, count: 0 };

    const { error } = await client.from('peminjaman_aset_rt').upsert(rows);
    if (error) {
      if (error.code === '42P01') {
        return { success: true, count: items.length };
      }
      console.warn('[restorePeminjamanToSupabase Upsert Error]', error.message);
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: rows.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
};

/**
 * Memulihkan data darurat/SOS ke Supabase & LocalStorage
 */
export const restoreDaruratToSupabase = async (
  items: (EmergencyAlertItem | any)[]
): Promise<{ success: boolean; count: number; error?: string }> => {
  if (!items || items.length === 0) return { success: true, count: 0 };

  try {
    saveLocalEmergencyAlerts(items);
  } catch (e) {
    console.warn('[restoreDarurat Local]', e);
  }

  const client = getSupabase();
  if (!client) return { success: true, count: items.length };

  try {
    const rows = items
      .map((d) => {
        const row: Record<string, any> = {
          id_warga: d.id_warga || '00000000-0000-0000-0000-000000000000',
          nama_warga: d.nama_warga || 'Warga',
          alamat: d.alamat || '-',
          no_hp: d.no_hp || null,
          tipe_darurat: d.tipe_darurat || 'Lainnya',
          status: d.status === 'Selesai' ? 'Selesai' : 'Aktif',
          keterangan: d.keterangan || null,
        };
        if (d.id && isUuid(d.id)) {
          row.id = d.id;
        }
        return row;
      });

    if (rows.length === 0) return { success: true, count: 0 };

    const { error } = await client.from('darurat_rt').upsert(rows);
    if (error) {
      if (error.code === '42P01') {
        return { success: true, count: items.length };
      }
      console.warn('[restoreDaruratToSupabase Upsert Error]', error.message);
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: rows.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
};

/**
 * Mengosongkan tabel inventaris_rt di Supabase
 */
export const clearInventarisInSupabase = async (): Promise<{ success: boolean; error: string | null }> => {
  const client = getSupabase();
  saveLocalInventaris([]);
  if (!client) return { success: true, error: null };
  try {
    const { error } = await client.from('inventaris_rt').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error && error.code !== '42P01') return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

/**
 * Mengosongkan tabel peminjaman_aset_rt di Supabase
 */
export const clearPeminjamanInSupabase = async (): Promise<{ success: boolean; error: string | null }> => {
  const client = getSupabase();
  saveLocalPeminjaman([]);
  if (!client) return { success: true, error: null };
  try {
    const { error } = await client.from('peminjaman_aset_rt').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error && error.code !== '42P01') return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

/**
 * Mengosongkan tabel darurat_rt di Supabase
 */
export const clearDaruratInSupabase = async (): Promise<{ success: boolean; error: string | null }> => {
  const client = getSupabase();
  saveLocalEmergencyAlerts([]);
  if (!client) return { success: true, error: null };
  try {
    const { error } = await client.from('darurat_rt').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error && error.code !== '42P01') return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

/**
 * Mengambil data lengkap 8 tabel dari database Supabase / LocalStorage sekaligus
 */
export const fetchAll8TablesData = async (): Promise<{
  kas_rt: Transaction[];
  kategori: CategoryItem[];
  pengguna: SupabasePengurusRow[];
  data_warga: DataWargaItem[];
  sekretariat: SekretariatItem[];
  inventaris_rt: InventarisItem[];
  peminjaman_aset_rt: PeminjamanItem[];
  darurat_rt: EmergencyAlertItem[];
}> => {
  const [
    kasRes,
    catRes,
    penggunaRes,
    wargaRes,
    sekRes,
    invRes,
    pinjamRes,
    daruratRes,
  ] = await Promise.all([
    fetchKasFromSupabase().then((r) => r.data || []),
    fetchCategoriesFromSupabase().then((r) => r.data || []),
    fetchAllPengurusFromSupabase().then((r) => r || []),
    fetchDataWargaFromSupabase().then((r) => r || []),
    getSekretariatFromSupabase().then((r) => (r.data ? [r.data] : [])),
    fetchInventarisFromSupabase().then((r) => r.data || getLocalInventaris()),
    fetchPeminjamanFromSupabase().then((r) => r.data || getLocalPeminjaman()),
    fetchActiveEmergencyAlerts().then((r) => r.data || getLocalEmergencyAlerts()),
  ]);

  return {
    kas_rt: kasRes,
    kategori: catRes,
    pengguna: penggunaRes,
    data_warga: wargaRes,
    sekretariat: sekRes,
    inventaris_rt: invRes,
    peminjaman_aset_rt: pinjamRes,
    darurat_rt: daruratRes,
  };
};

export const deleteAllInventarisFromSupabase = clearInventarisInSupabase;
export const deleteAllPeminjamanFromSupabase = clearPeminjamanInSupabase;
export const deleteAllDaruratFromSupabase = clearDaruratInSupabase;



