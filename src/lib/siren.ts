// Siren Sound Synthesizer using Web Audio API with Dual Harmonic Wave
// Produces a powerful wailing emergency siren that works across desktop & mobile browsers.

let audioCtx: AudioContext | null = null;
let oscillator1: OscillatorNode | null = null;
let oscillator2: OscillatorNode | null = null;
let gainNode: GainNode | null = null;
let intervalId: any = null;

/**
 * Inisialisasi awal AudioContext saat interaksi pertama pengguna (klik/sentuh)
 * agar browser tidak memblokir audio latar belakang saat sinyal darurat masuk.
 */
export const initAudioContextOnUserGesture = () => {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  } catch {}
};

// Pasang listener interaksi global satu kali
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    initAudioContextOnUserGesture();
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
}

export const startSirenAlarm = () => {
  try {
    if (!audioCtx || audioCtx.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }

    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    if (oscillator1 && intervalId) {
      return; // Sudah sedang berbunyi
    }

    if (!audioCtx) return;

    oscillator1 = audioCtx.createOscillator();
    oscillator2 = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();

    // Nada Utama (Sawtooth tajam untuk sirene darurat)
    oscillator1.type = 'sawtooth';
    oscillator1.frequency.setValueAtTime(480, audioCtx.currentTime);

    // Nada Harmoni Pendukung (Sine wave untuk resonansi ruang)
    oscillator2.type = 'sine';
    oscillator2.frequency.setValueAtTime(960, audioCtx.currentTime);

    // Tingkat volume proporsional dan jelas
    gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);

    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator1.start();
    oscillator2.start();

    // Modulasi frekuensi naik-turun khas sirene peringatan (440Hz -> 880Hz)
    let high = false;
    intervalId = setInterval(() => {
      if (!audioCtx || !oscillator1 || !oscillator2) return;
      const targetFreq1 = high ? 880 : 440;
      const targetFreq2 = high ? 1760 : 880;

      oscillator1.frequency.exponentialRampToValueAtTime(targetFreq1, audioCtx.currentTime + 0.38);
      oscillator2.frequency.exponentialRampToValueAtTime(targetFreq2, audioCtx.currentTime + 0.38);
      high = !high;
    }, 400);
  } catch (e) {
    console.warn('[Siren Synthesizer] Audio context startup exception:', e);
  }
};

export const stopSirenAlarm = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (oscillator1) {
    try {
      oscillator1.stop();
    } catch {}
    oscillator1.disconnect();
    oscillator1 = null;
  }
  if (oscillator2) {
    try {
      oscillator2.stop();
    } catch {}
    oscillator2.disconnect();
    oscillator2 = null;
  }
  if (gainNode) {
    try {
      gainNode.disconnect();
    } catch {}
    gainNode = null;
  }
};
