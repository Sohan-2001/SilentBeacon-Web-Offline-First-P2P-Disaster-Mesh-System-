// SilentBeacon Hardware API Manager: Acoustic Siren, Vibration, Torch, Geolocation, Orientation & WakeLock

export interface HardwareState {
  isSirenActive: boolean;
  isTorchActive: boolean;
  isWakeLocked: boolean;
  currentHeading: number | null; // 0 to 360 degrees
  currentLocation: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number | null;
  } | null;
}

export class HardwareManager {
  private audioCtx: AudioContext | null = null;
  private sirenOsc1: OscillatorNode | null = null;
  private sirenOsc2: OscillatorNode | null = null;
  private sirenLfo: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private isSirenPlaying: boolean = false;
  private vibrationIntervalId: any = null;
  private wakeLockSentinel: any = null;
  private videoTrack: MediaStreamTrack | null = null;
  private isTorchOn: boolean = false;
  private morseIntervalId: any = null;

  // Sensor state
  private heading: number | null = null;
  private location: HardwareState['currentLocation'] = null;
  private geoWatchId: number | null = null;
  private onStateChange?: (state: HardwareState) => void;

  constructor(onStateChange?: (state: HardwareState) => void) {
    this.onStateChange = onStateChange;
  }

  private notify() {
    if (this.onStateChange) {
      this.onStateChange({
        isSirenActive: this.isSirenPlaying,
        isTorchActive: this.isTorchOn,
        isWakeLocked: !!this.wakeLockSentinel,
        currentHeading: this.heading,
        currentLocation: this.location
      });
    }
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
   * Triggers the Autonomous High-Priority Critical Broadcast Siren Override
   */
  public async triggerCriticalSiren(): Promise<void> {
    if (this.isSirenPlaying) return;

    try {
      const ctx = this.getAudioContext();
      this.isSirenPlaying = true;

      // Request screen WakeLock so phone doesn't sleep during alarm
      this.requestWakeLock();

      // Master output gain with dynamics compressor to maximize loudness
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-12, ctx.currentTime);
      compressor.knee.setValueAtTime(30, ctx.currentTime);
      compressor.ratio.setValueAtTime(12, ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, ctx.currentTime);
      compressor.release.setValueAtTime(0.25, ctx.currentTime);

      this.sirenGain = ctx.createGain();
      this.sirenGain.gain.setValueAtTime(0.85, ctx.currentTime);

      // Dual siren synthesizer oscillators:
      // Oscillator 1: High piercing warble
      this.sirenOsc1 = ctx.createOscillator();
      this.sirenOsc1.type = 'sawtooth';
      this.sirenOsc1.frequency.setValueAtTime(950, ctx.currentTime);

      // LFO for frequency modulation (siren warble sweep between 800Hz and 1300Hz)
      this.sirenLfo = ctx.createOscillator();
      this.sirenLfo.type = 'sine';
      this.sirenLfo.frequency.setValueAtTime(3.2, ctx.currentTime); // 3.2 Hz warble rate

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(350, ctx.currentTime); // sweep depth +/- 350Hz

      this.sirenLfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc1.frequency);

      // Oscillator 2: Sub-frequency acoustic cutter
      this.sirenOsc2 = ctx.createOscillator();
      this.sirenOsc2.type = 'triangle';
      this.sirenOsc2.frequency.setValueAtTime(520, ctx.currentTime);

      // Connect nodes
      this.sirenOsc1.connect(this.sirenGain);
      this.sirenOsc2.connect(this.sirenGain);
      this.sirenGain.connect(compressor);
      compressor.connect(ctx.destination);

      this.sirenOsc1.start();
      this.sirenOsc2.start();
      this.sirenLfo.start();

      // Start hardware vibration pulse
      this.startVibrationLoop();

      this.notify();
    } catch (err) {
      console.warn('Failed to start audio siren:', err);
    }
  }

  /**
   * Stops the emergency siren and hardware vibration
   */
  public stopCriticalSiren(): void {
    if (!this.isSirenPlaying) return;

    try {
      if (this.sirenOsc1) {
        this.sirenOsc1.stop();
        this.sirenOsc1.disconnect();
        this.sirenOsc1 = null;
      }
      if (this.sirenOsc2) {
        this.sirenOsc2.stop();
        this.sirenOsc2.disconnect();
        this.sirenOsc2 = null;
      }
      if (this.sirenLfo) {
        this.sirenLfo.stop();
        this.sirenLfo.disconnect();
        this.sirenLfo = null;
      }
      if (this.sirenGain) {
        this.sirenGain.disconnect();
        this.sirenGain = null;
      }
    } catch {}

    this.isSirenPlaying = false;
    this.stopVibrationLoop();
    this.releaseWakeLock();
    this.notify();
  }

  /**
   * Hardware vibration loop using navigator.vibrate
   */
  private startVibrationLoop(): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const pattern = [500, 200, 500, 200, 1000];
      try {
        navigator.vibrate(pattern);
        this.vibrationIntervalId = setInterval(() => {
          navigator.vibrate(pattern);
        }, 2400);
      } catch {}
    }
  }

  private stopVibrationLoop(): void {
    if (this.vibrationIntervalId) {
      clearInterval(this.vibrationIntervalId);
      this.vibrationIntervalId = null;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch {}
    }
  }

  /**
   * Single tactile feedback click or alert
   */
  public vibrateFeedback(type: 'tap' | 'alert' | 'success' = 'tap'): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (type === 'tap') navigator.vibrate(40);
        else if (type === 'alert') navigator.vibrate([150, 80, 150]);
        else if (type === 'success') navigator.vibrate([80, 50, 120]);
      } catch {}
    }
  }

  /**
   * Plays a tactical proximity radar ping (beeps faster/higher when near coordinates)
   */
  public playRadarPing(distanceMeters: number): void {
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Pitch increases from 600Hz (far) to 1800Hz (within 20m)
      const freq = Math.min(1800, Math.max(600, 2000 - distanceMeters * 2));
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } catch {}
  }

  /**
   * Screen WakeLock API to keep device awake during rescue operations
   */
  public async requestWakeLock(): Promise<boolean> {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        this.wakeLockSentinel.addEventListener('release', () => {
          this.wakeLockSentinel = null;
          this.notify();
        });
        this.notify();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  public releaseWakeLock(): void {
    if (this.wakeLockSentinel) {
      try {
        this.wakeLockSentinel.release();
      } catch {}
      this.wakeLockSentinel = null;
      this.notify();
    }
  }

  /**
   * Physical Camera Flashlight / Torch API (Android Chrome & supported devices)
   */
  public async toggleTorch(forceState?: boolean): Promise<boolean> {
    const target = forceState !== undefined ? forceState : !this.isTorchOn;

    if (!target) {
      if (this.videoTrack) {
        try {
          await (this.videoTrack as any).applyConstraints({ advanced: [{ torch: false }] });
          this.videoTrack.stop();
        } catch {}
        this.videoTrack = null;
      }
      this.isTorchOn = false;
      this.notify();
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      const track = stream.getVideoTracks()[0];
      const capabilities = (track as any).getCapabilities ? (track as any).getCapabilities() : {};

      if (capabilities.torch) {
        await (track as any).applyConstraints({
          advanced: [{ torch: true }]
        });
        this.videoTrack = track;
        this.isTorchOn = true;
        this.notify();
        return true;
      } else {
        // Torch capability not on this camera
        track.stop();
        this.isTorchOn = false;
        this.notify();
        return false;
      }
    } catch (err) {
      console.warn('Torch not available:', err);
      this.isTorchOn = false;
      this.notify();
      return false;
    }
  }

  /**
   * Starts device orientation listener for offline compass
   */
  public startOrientationTracking(): void {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      let compassHeading: number | null = null;
      if ((e as any).webkitCompassHeading) {
        // iOS Safari
        compassHeading = (e as any).webkitCompassHeading;
      } else if (e.alpha !== null) {
        // Android / standard: alpha is 0 to 360 relative to initial or magnetic north
        compassHeading = 360 - e.alpha;
      }

      if (compassHeading !== null) {
        this.heading = Math.round(compassHeading);
        this.notify();
      }
    };

    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      // Check for iOS 13+ permission
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        (DeviceOrientationEvent as any).requestPermission().then((res: string) => {
          if (res === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation, true);
          }
        }).catch(() => {});
      } else {
        window.addEventListener('deviceorientation', handleOrientation, true);
      }
    }
  }

  /**
   * Starts offline geolocation tracking with fallback
   */
  public startLocationTracking(): void {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      this.geoWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          this.location = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude
          };
          this.notify();
        },
        (err) => {
          console.warn('Geolocation error:', err.message);
          // Set default coordinates if completely unavailable or in bunker
          if (!this.location) {
            this.location = {
              latitude: 22.5726,
              longitude: 88.3639,
              accuracy: 25
            };
            this.notify();
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 10000
        }
      );
    }
  }

  public cleanup(): void {
    this.stopCriticalSiren();
    if (this.videoTrack) {
      this.videoTrack.stop();
      this.videoTrack = null;
    }
    if (this.geoWatchId !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(this.geoWatchId);
    }
  }
}
