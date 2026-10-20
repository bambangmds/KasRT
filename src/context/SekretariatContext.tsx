import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SekretariatItem } from '../types';
import {
  DEFAULT_SEKRETARIAT,
  getSekretariatFromSupabase,
  saveSekretariatToSupabase,
  deleteSekretariatFromSupabase,
} from '../lib/supabase';

interface SekretariatContextType {
  sekretariat: SekretariatItem;
  isLoading: boolean;
  fromSupabase: boolean;
  error: string | null;
  isDbEmpty: boolean;
  updateSekretariat: (item: Partial<SekretariatItem>) => Promise<{ success: boolean; error: string | null }>;
  deleteSekretariat: () => Promise<{ success: boolean; error: string | null }>;
  reloadSekretariat: () => Promise<void>;
  wilayahLabel: string;
  wilayahShort: string;
  kelurahanLabel: string;
  kopRtLabel: string;
  kopRwLabel: string;
}

const SekretariatContext = createContext<SekretariatContextType | undefined>(undefined);

export const SekretariatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sekretariat, setSekretariat] = useState<SekretariatItem>(DEFAULT_SEKRETARIAT);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fromSupabase, setFromSupabase] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDbEmpty, setIsDbEmpty] = useState<boolean>(false);

  const reloadSekretariat = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getSekretariatFromSupabase();
      setSekretariat(res.data);
      setFromSupabase(res.fromSupabase);
      setError(res.error);
      setIsDbEmpty(res.isDbEmpty);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat profil sekretariat');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadSekretariat();
  }, [reloadSekretariat]);

  // Dynamically update the browser tab title and metadata with the real RT, RW, & Kelurahan data from database sekretariat
  useEffect(() => {
    const rtStr = sekretariat.rt ? `RT.${sekretariat.rt}` : '';
    const rwStr = sekretariat.rw ? `RW.${sekretariat.rw}` : '';
    const wilayahIdent = [rtStr, rwStr].filter(Boolean).join(' ') || 'Kas RT';
    const kelStr = sekretariat.kelurahan ? `Kelurahan ${sekretariat.kelurahan}` : '';
    
    const titleText = `${wilayahIdent} - Sistem Pengelolaan Kas & Keuangan RT`;
    const descText = `Sistem Pengelolaan Kas dan Keuangan ${wilayahIdent}${kelStr ? `, ${kelStr}` : ''} dengan pencatatan transaksi, koreksi data, dan laporan keuangan.`;

    // 1. Update Document Title
    document.title = titleText;

    // 2. Update OpenGraph Title
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', titleText);
    }

    // 3. Update Meta Description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', descText);
    }

    // 4. Update OpenGraph Description
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) {
      ogDesc.setAttribute('content', descText);
    }
  }, [sekretariat]);

  const updateSekretariat = async (
    item: Partial<SekretariatItem>
  ): Promise<{ success: boolean; error: string | null }> => {
    setIsLoading(true);
    try {
      const res = await saveSekretariatToSupabase(item);
      if (res.success) {
        setSekretariat(res.data);
        setError(null);
        setIsDbEmpty(false); // No longer empty once successfully saved
        return { success: true, error: null };
      } else {
        setError(res.error);
        return { success: false, error: res.error };
      }
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan perubahan');
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSekretariat = async (): Promise<{ success: boolean; error: string | null }> => {
    setIsLoading(true);
    try {
      const res = await deleteSekretariatFromSupabase();
      if (res.success) {
        setSekretariat(DEFAULT_SEKRETARIAT);
        setFromSupabase(false);
        setIsDbEmpty(true);
        setError(null);
        return { success: true, error: null };
      } else {
        setError(res.error);
        return { success: false, error: res.error };
      }
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus data sekretariat');
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  const rtStr = sekretariat.rt ? `RT.${sekretariat.rt}` : 'RT';
  const rwStr = sekretariat.rw ? `RW.${sekretariat.rw}` : 'RW';
  const kelStr = sekretariat.kelurahan || '';

  const wilayahShort = sekretariat.rt && sekretariat.rw ? `RT.${sekretariat.rt} RW.${sekretariat.rw}` : 'RT';
  const wilayahLabel = [
    sekretariat.rt ? `RT.${sekretariat.rt}` : '',
    sekretariat.rw ? `RW.${sekretariat.rw}` : '',
    sekretariat.kelurahan ? `Kelurahan ${sekretariat.kelurahan}` : '',
    sekretariat.kecamatan ? `Kecamatan ${sekretariat.kecamatan}` : '',
  ].filter(Boolean).join(', ') || 'Sistem Kas RT';
  const kelurahanLabel = sekretariat.kelurahan ? `Kelurahan ${sekretariat.kelurahan}` : 'Kelurahan';
  const kopRtLabel = sekretariat.rt ? `RUKUN TETANGGA ${sekretariat.rt}` : 'RUKUN TETANGGA';
  const kopRwLabel = sekretariat.rw ? `RUKUN WARGA ${sekretariat.rw}` : 'RUKUN WARGA';

  return (
    <SekretariatContext.Provider
      value={{
        sekretariat,
        isLoading,
        fromSupabase,
        error,
        isDbEmpty,
        updateSekretariat,
        deleteSekretariat,
        reloadSekretariat,
        wilayahLabel,
        wilayahShort,
        kelurahanLabel,
        kopRtLabel,
        kopRwLabel,
      }}
    >
      {children}
    </SekretariatContext.Provider>
  );
};

export const useSekretariat = (): SekretariatContextType => {
  const context = useContext(SekretariatContext);
  if (!context) {
    // Return graceful fallback if rendered outside provider
    return {
      sekretariat: DEFAULT_SEKRETARIAT,
      isLoading: false,
      fromSupabase: false,
      error: null,
      isDbEmpty: false,
      updateSekretariat: async () => ({ success: false, error: 'Provider not found' }),
      deleteSekretariat: async () => ({ success: false, error: 'Provider not found' }),
      reloadSekretariat: async () => {},
      wilayahLabel: 'Sistem Kas RT',
      wilayahShort: 'RT',
      kelurahanLabel: 'Kelurahan',
      kopRtLabel: 'RUKUN TETANGGA',
      kopRwLabel: 'RUKUN WARGA',
    };
  }
  return context;
};
