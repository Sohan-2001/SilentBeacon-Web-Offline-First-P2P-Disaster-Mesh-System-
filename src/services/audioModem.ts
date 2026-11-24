// SilentBeacon Acoustic Audio Modem (Data over Sound)
// Transmits and receives distress tickets via audio frequency modulation (FSK)

export interface AcousticPacket {
  type: 'SOS_BEACON';
  id: string;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  casualties: number;
  lat: number;
  lng: number;
  lamport: number;
  checksum: number;
}

export class AudioModem {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private isListening: boolean = false;
  private isTransmitting: boolean = false;
  private onPacketReceived?: (packet: AcousticPacket) => void;
  private listenIntervalId: any = null;

  // Frequencies in Hertz (Audible disaster beacon tones)
  // Low-interference frequency band (1200Hz - 2400Hz)
  private readonly FREQ_PREAMBLE = 1400;
  private readonly FREQ_ZERO = 1750;
  private readonly FREQ_ONE = 2150;
  private readonly FREQ_POSTAMBLE = 2500;
  private readonly BIT_DURATION_MS = 60; // 60ms per bit for acoustic stability

  constructor(onPacketReceived?: (packet: AcousticPacket) => void) {
    this.onPacketReceived = onPacketReceived;
  }

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Compresses an emergency ticket into a ultra-compact 24-byte acoustic payload
   */
  public serializeToBits(packet: AcousticPacket): string {
    const jsonStr = JSON.stringify({
      i: packet.id.slice(0, 8),
      u: packet.urgency[0],
      c: packet.casualties,
      lt: Math.round(packet.lat * 1000) / 1000,
      lg: Math.round(packet.lng * 1000) / 1000,
      lp: packet.lamport
    });

    let binary = '';
    for (let i = 0; i < jsonStr.length; i++) {
      const charCode = jsonStr.charCodeAt(i);
      const bin = charCode.toString(2).padStart(8, '0');
      binary += bin;
    }
    return binary;
  }

  public deserializeFromBits(binary: string): AcousticPacket | null {
    try {
      let str = '';
      for (let i = 0; i < binary.length; i += 8) {
        const byte = binary.substring(i, i + 8);
        if (byte.length === 8) {
          str += String.fromCharCode(parseInt(byte, 2));
        }
      }
      const data = JSON.parse(str);
      const urgencyMap: Record<string, 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'> = {
        C: 'CRITICAL',
        H: 'HIGH',
        M: 'MEDIUM',
        L: 'LOW'
      };
      return {
        type: 'SOS_BEACON',
        id: data.i || 'ACOUSTIC-' + Date.now(),
        urgency: urgencyMap[data.u] || 'HIGH',
        category: 'MEDICAL',
        casualties: data.c || 1,
        lat: data.lt || 0,
        lng: data.lg || 0,
        lamport: data.lp || 1,
        checksum: 1
      };
    } catch {
      return null;
    }
  }

  /**
   * Transmits data bits into acoustic tone sequence using device speaker
   */
  public async transmitPacket(packet: AcousticPacket, onProgress?: (pct: number) => void): Promise<void> {
    if (this.isTransmitting) return;
    this.isTransmitting = true;

    const ctx = this.getAudioContext();
    const bits = this.serializeToBits(packet);
    
    // Play Preamble tone, bit sequence, Postamble tone
    const bitDurSec = this.BIT_DURATION_MS / 1000;
    let startTime = ctx.currentTime + 0.1;

    const playTone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      // Smooth attack and release to eliminate audio clicks
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur - 0.005);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur);
    };

    // Preamble (wake up microphone decoder)
    playTone(this.FREQ_PREAMBLE, startTime, bitDurSec * 2);
    startTime += bitDurSec * 2;

    // Transmit bits
    for (let i = 0; i < bits.length; i++) {
      const bit = bits[i];
      const freq = bit === '1' ? this.FREQ_ONE : this.FREQ_ZERO;
      playTone(freq, startTime, bitDurSec);
      startTime += bitDurSec;
      if (onProgress) {
        setTimeout(() => onProgress(Math.round(((i + 1) / bits.length) * 100)), (startTime - ctx.currentTime) * 1000);
      }
    }

    // Postamble
    playTone(this.FREQ_POSTAMBLE, startTime, bitDurSec * 2);
    startTime += bitDurSec * 2;

    const totalDurationMs = (startTime - ctx.currentTime) * 1000;
    await new Promise((res) => setTimeout(res, totalDurationMs));
    this.isTransmitting = false;
  }

  /**
   * Starts listening for acoustic beacons using the microphone
   */
  public async startListening(): Promise<boolean> {
    if (this.isListening) return true;
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      const ctx = this.getAudioContext();
      const source = ctx.createMediaStreamSource(this.mediaStream);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      source.connect(this.analyser);

      this.isListening = true;
      this.pollAcousticSpectrum();
      return true;
    } catch (err) {
      console.warn('Microphone access denied or unavailable for acoustic modem:', err);
      return false;
    }
  }

  private pollAcousticSpectrum() {
    if (!this.analyser || !this.audioCtx) return;
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const sampleRate = this.audioCtx.sampleRate;
    const binSize = sampleRate / this.analyser.fftSize;

    let accumulatedBits = '';
    let isDecoding = false;
    let lastBitTime = 0;

    const detectFrequency = () => {
      if (!this.isListening || !this.analyser) return;
      this.analyser.getByteFrequencyData(dataArray);

      // Helper to get amplitude around target frequency
      const getAmp = (freq: number) => {
        const bin = Math.round(freq / binSize);
        let max = 0;
        for (let b = Math.max(0, bin - 2); b <= Math.min(bufferLength - 1, bin + 2); b++) {
          if (dataArray[b] > max) max = dataArray[b];
        }
        return max;
      };

      const ampPreamble = getAmp(this.FREQ_PREAMBLE);
      const ampZero = getAmp(this.FREQ_ZERO);
      const ampOne = getAmp(this.FREQ_ONE);
      const ampPostamble = getAmp(this.FREQ_POSTAMBLE);
      const threshold = 140; // minimum SNR threshold

      const now = performance.now();

      if (!isDecoding && ampPreamble > threshold) {
        isDecoding = true;
        accumulatedBits = '';
        lastBitTime = now;
      } else if (isDecoding) {
        if (ampPostamble > threshold && accumulatedBits.length >= 24) {
          // Packet complete!
          isDecoding = false;
          const packet = this.deserializeFromBits(accumulatedBits);
          if (packet && this.onPacketReceived) {
            this.onPacketReceived(packet);
          }
          accumulatedBits = '';
        } else if (now - lastBitTime >= this.BIT_DURATION_MS * 0.8) {
          if (ampOne > threshold && ampOne > ampZero + 15) {
            accumulatedBits += '1';
            lastBitTime = now;
          } else if (ampZero > threshold && ampZero > ampOne + 15) {
            accumulatedBits += '0';
            lastBitTime = now;
          }
        }
      }

      this.listenIntervalId = requestAnimationFrame(detectFrequency);
    };

    this.listenIntervalId = requestAnimationFrame(detectFrequency);
  }

  public stopListening(): void {
    this.isListening = false;
    if (this.listenIntervalId) {
      cancelAnimationFrame(this.listenIntervalId);
      this.listenIntervalId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  public getStatus(): { isListening: boolean; isTransmitting: boolean } {
    return {
      isListening: this.isListening,
      isTransmitting: this.isTransmitting
    };
  }
}
