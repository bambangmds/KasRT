/**
 * Utility Pengelola Bunyi & Notifikasi Darurat Latar Belakang (Background Alert & Siren)
 * Memungkinkan perangkat warga tetap berbunyi dan bergetar saat sinyal SOS dikirim,
 * baik saat aplikasi sedang dibuka, diminimalkan (background tab), maupun layar terkunci.
 */

import { EmergencyAlertItem } from './supabase';
import { startSirenAlarm, stopSirenAlarm } from './siren';

let originalDocTitle = '';
let titleFlashInterval: any = null;
let screenWakeLock: any = null;

/**
 * Cek apakah browser mendukung Web Notification API
 */
export const isNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

/**
 * Mendapatkan status izin notifikasi saat ini
 */
export const getNotificationPermission = (): NotificationPermission => {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
};

/**
 * Meminta izin notifikasi browser secara eksplisit
 */
export const requestAlarmNotificationPermission = async (): Promise<{
  granted: boolean;
  permission: NotificationPermission;
}> => {
  if (!isNotificationSupported()) {
    return { granted: false, permission: 'denied' };
  }

  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      // Mainkan konfirmasi nada singkat
      playNotificationChime();
      return { granted: true, permission: perm };
    }
    return { granted: false, permission: perm };
  } catch (err) {
    console.warn('[Notification Permission Error]', err);
    return { granted: false, permission: 'denied' };
  }
};

/**
 * Mainkan nada konfirmasi singkat menggunakan Web Audio API
 */
export const playNotificationChime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    console.warn('Chime audio error:', e);
  }
};

/**
 * Meminta Screen Wake Lock agar layar gawai tidak padam/mati saat alarm darurat sedang berbunyi
 */
export const requestScreenWakeLock = async () => {
  try {
    if ('wakeLock' in navigator && (navigator as any).wakeLock) {
      screenWakeLock = await (navigator as any).wakeLock.request('screen');
      screenWakeLock.addEventListener('release', () => {
        screenWakeLock = null;
      });
    }
  } catch (err) {
    console.warn('[Screen WakeLock] Tidak dapat mengunci layar aktif:', err);
  }
};

/**
 * Melepaskan Screen Wake Lock saat situasi darurat selesai
 */
export const releaseScreenWakeLock = () => {
  if (screenWakeLock) {
    try {
      screenWakeLock.release();
    } catch {}
    screenWakeLock = null;
  }
};

/**
 * Memulai animasi kedip judul tab browser agar terlihat mencolok saat tab diminimalkan
 */
export const startTitleFlashing = (tipeText = 'DARURAT SOS') => {
  if (titleFlashInterval) return;
  if (!originalDocTitle) {
    originalDocTitle = document.title;
  }

  let isAlert = false;
  titleFlashInterval = setInterval(() => {
    document.title = isAlert 
      ? `🚨 [${tipeText.toUpperCase()}] 🚨 BUKA APLIKASI!` 
      : `⚠️ [PERINGATAN WARGA RT] ⚠️`;
    isAlert = !isAlert;
  }, 650);
};

/**
 * Menghentikan kedip judul tab browser dan mengembalikan ke judul awal
 */
export const stopTitleFlashing = () => {
  if (titleFlashInterval) {
    clearInterval(titleFlashInterval);
    titleFlashInterval = null;
  }
  if (originalDocTitle) {
    document.title = originalDocTitle;
  }
};

/**
 * Memicu sirene dan notifikasi sistem penuh (Background & Foreground)
 */
export const triggerSOSBackgroundAlert = async (
  alert: EmergencyAlertItem,
  wilayahShort = 'RT.002 RW.09'
) => {
  // 1. Nyalakan sirene audio
  startSirenAlarm();

  // 2. Minta Screen Wake Lock
  requestScreenWakeLock();

  // 3. Mulai animasi judul tab
  startTitleFlashing(alert.tipe_darurat || 'DARURAT SOS');

  // 4. Pola getar darurat intensif di gawai Android/ponsel
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([800, 250, 800, 250, 1500, 300, 1500]);
    } catch {}
  }

  // 5. Tampilkan Notifikasi Sistem Web Push / OS Notification
  if (isNotificationSupported() && Notification.permission === 'granted') {
    const title = `🚨 ALARM DARURAT SOS ${wilayahShort}!`;
    const body = `⚠️ DARI: ${alert.nama_warga} (${alert.alamat})\n🚨 TIPE: ${alert.tipe_darurat}\n📝 ${alert.keterangan || 'Membutuhkan pertolongan segera!'}`;

    const notificationOptions: any = {
      body,
      icon: '/rt_logo.svg',
      badge: '/rt_logo.svg',
      tag: `sos-alert-${alert.id}`,
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: [500, 200, 500, 200, 1000, 200, 1000, 200, 1500],
      data: {
        url: window.location.href,
        alertId: alert.id,
      },
    };

    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, notificationOptions);
      } else {
        const n = new Notification(title, notificationOptions);
        n.onclick = () => {
          window.focus();
          n.close();
        };
      }
    } catch (err) {
      console.warn('[SOS Notification Dispatch Exception]', err);
    }
  }
};

/**
 * Menghentikan seluruh alarm darurat (audio, getar, kedip judul, wake lock)
 */
export const dismissSOSBackgroundAlert = () => {
  stopSirenAlarm();
  releaseScreenWakeLock();
  stopTitleFlashing();
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(0);
    } catch {}
  }
};

/**
 * Uji coba simulasi alarm latar belakang selama 5 detik
 */
export const runTestBackgroundAlarm = async (
  wilayahShort = 'RT.002 RW.09',
  onFinished?: () => void
) => {
  const mockAlert: EmergencyAlertItem = {
    id: 'test-' + Date.now(),
    id_warga: 'test-user',
    nama_warga: 'Simulasi Warga RT',
    alamat: 'Jl. Utama RT.002',
    tipe_darurat: 'Uji Coba Sistem SOS',
    status: 'Aktif',
    keterangan: 'Ini adalah uji coba suara sirene & notifikasi latar belakang. Perangkat Anda siap menerima peringatan.',
    created_at: new Date().toISOString(),
  };

  await triggerSOSBackgroundAlert(mockAlert, wilayahShort);

  setTimeout(() => {
    dismissSOSBackgroundAlert();
    if (onFinished) onFinished();
  }, 5000);
};

