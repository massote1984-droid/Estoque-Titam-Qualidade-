/**
 * Utilitário de Alerta Sonoro Autocontido (Web Audio API)
 * Gera bips e toques analógicos/digitais sintetizados sem arquivos externos,
 * garantindo compatibilidade 100% offline e sem dependências externas.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioCtx = new AudioCtx();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Toca alerta sonoro de acordo com o tipo de evento operacional.
 */
export function playOperationalSound(type: 'critical' | 'warning' | 'success' | 'info' = 'info') {
  try {
    const isMuted = localStorage.getItem('titam_sound_alerts_muted') === 'true';
    if (isMuted) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === 'critical') {
      // Tom de alerta duplo industrial (frequência 880Hz -> 660Hz -> 880Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.setValueAtTime(660, now + 0.12);
      osc1.frequency.setValueAtTime(880, now + 0.24);

      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.38);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);
    } else if (type === 'warning') {
      // Tom de aviso (600Hz pulso único)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(450, now + 0.25);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
    } else if (type === 'success') {
      // Chime ascendente suave (523Hz C5 -> 659Hz E5 -> 784Hz G5)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.15, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.08 + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.2);
      });
    } else {
      // Info sutil (440Hz -> 880Hz suave)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch (err) {
    // Fail silently if audio is blocked by user interaction policies
  }
}

export function isSoundAlertsMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('titam_sound_alerts_muted') === 'true';
}

export function setSoundAlertsMuted(muted: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('titam_sound_alerts_muted', muted ? 'true' : 'false');
}
