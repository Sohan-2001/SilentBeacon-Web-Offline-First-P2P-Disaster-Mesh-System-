# SilentBeacon-Web-Offline-First-P2P-Disaster-Mesh-System- 📡🚨
### 100% Offline, Local-First Emergency Coordination System for Web & Mobile Browsers

> **Disaster Response Tech Built for Zero Cellular Data, Zero Internet, and Zero External Infrastructure.**
> Deployable in seconds to **Vercel**, installable as a standalone Progressive Web App (PWA), and fully functional in **Airplane Mode**.

---

## 🌪️ The Problem
When a cyclone, flood, earthquake, or grid failure wipes out cellular towers, cuts the internet, and leaves an entire neighborhood in the dark:
- **Communication dies first.**
- Survivors who urgently need insulin, clean water, or rescue cannot signal for help.
- First responders and neighbors 50 meters away have no way of knowing someone is in danger.

**SilentBeacon Web** brings edge-native, zero-infrastructure peer-to-peer disaster coordination to any device with a modern web browser.

---

## 🛠️ System Architecture & Web Hardware Mapping

| Android Architecture (Original) | SilentBeacon Web Architecture | Browser Hardware API |
| :--- | :--- | :--- |
| **Google Nearby Connections (BLE + Wi-Fi Direct)** | **Multi-Modal Zero-Internet P2P Mesh** | WebRTC DataChannels, Web Audio FSK, Web NFC |
| **Room SQLite + Kotlin Flow** | **Local-First Reactive IndexedDB** | `idb` / IndexedDB + LocalStorage |
| **Epidemic Gossip Protocol** | **Two-Phase Digest & Delta Sync** | Monotonic Lamport Clocks & Pairwise Vector Clocks |
| **CRDT State Transitions (LWW)** | **Deterministic Lamport Tie-Breaker** | Commutative, associative, idempotent state merge |
| **Autonomous Critical Alarm Override** | **Acoustic Synthesizer & Vibration** | Web Audio API (dual-oscillator warble) + `navigator.vibrate` |
| **Persistent Foreground Service** | **Progressive Web App (PWA)** | Service Worker CacheStorage + Screen WakeLock API |
| **Directional Compass & Distance** | **Tactical Rescue Radar HUD** | `DeviceOrientationEvent` (Compass) + Haversine Azimuth |
| **Hardware Emergency Strobe** | **Camera Torch / LED Flashlight** | `MediaTrackConstraints` Torch API + High-contrast Strobe |

---

## 📡 Multi-Modal Zero-Internet Transports

### 1. Air-Gapped Optical QR Handshake (WebRTC DataChannel)
- Two phones in total Airplane Mode with zero network or cellular access establish a direct P2P socket:
  1. Phone A generates an SDP Offer compressed into a dynamic QR code.
  2. Phone B points its camera at Phone A's screen, decodes the offer, and displays an SDP Answer QR code.
  3. Phone A scans Phone B's answer QR code.
  4. An ad-hoc WebRTC DataChannel connects instantly, transferring distress tickets and vector clocks.

### 2. Acoustic Audio Modem (Data-Over-Sound / Ultrasound Chirps)
- Uses the device's physical speaker and microphone as a contactless acoustic data transponder:
  - Binary Frequency Shift Keying (FSK) modulation with preamble and postamble framing.
  - Generates audible / near-ultrasound rescue chirps that propagate through physical air space across rubble, rooms, or dark ruins where cameras cannot scan.
  - Built-in real-time spectrum analyzer with Goertzel / FFT peak frequency decoder.

### 3. Web NFC Tap-to-Sync
- On Android Chrome, tap two phones back-to-back using `NDEFReader` and `NDEFWriter` to beam distress tickets in milliseconds.

### 4. Local Wi-Fi Subnet & BroadcastChannel
- Auto-gossips across all devices connected to any battery-powered local Wi-Fi router or portable mobile hotspot (even with zero internet).
- Instant multi-tab / multi-window simulation for desktop evaluation.

---

## 🚨 Autonomous Critical Broadcast Alarm
When an SOS is broadcast with **`urgency: "CRITICAL"`** (e.g. trapped in debris, medical collapse):
1. **Web Audio Dual-Oscillator Siren**: Synthesizes authentic emergency frequency sweep (750 Hz – 1350 Hz at 3.2 Hz warble rate) driven through a dynamics compressor for maximum acoustic volume.
2. **Tactile Haptic Pulsing**: Loops hardware vibration pulses (`navigator.vibrate([500, 200, 500, 200, 1000])`).
3. **Screen WakeLock**: Prevents the screen and CPU from sleeping during rescue operations.
4. **Physical Camera Torch SOS**: Activates the phone's camera LED flash in Morse code (`... --- ...`).

---

## 🧭 Tactical Rescue Radar & Offline Vector Map
- **Compass HUD**: Calculates line-of-sight bearing and relative angle using the device's digital magnetometer (`DeviceOrientation`).
- **Dynamic Directional Arrow**: Rotates in real time, pointing rescuers directly toward the victim.
- **Proximity Sonar Ping**: Audio Geiger counter that beeps faster and higher in pitch as you close the distance.
- **Offline 2D Vector Map**: Concentric distance range rings (50m, 100m, 250m, 500m) and color-coded incident pins.

---

## 🏥 START Field Triage Calculator & Survival Tools
- **START (Simple Triage and Rapid Treatment)**:
  - Evaluates Respiration, Perfusion, and Mental status (RPM) to assign immediate disaster triage classifications:
    - 🔴 **IMMEDIATE (Red)**
    - 🟡 **DELAYED (Yellow)**
    - 🟢 **MINOR (Green)**
    - ⚫ **DECEASED / EXPECTANT (Black)**
  - One-click broadcast of classified triage tickets into the mesh.
- **Survival Protocols**: Water purification (boiling, SODIS, chlorination), arterial bleeding control / tourniquets, and building collapse extraction procedures.
- **Relief Squad Interoperability**: Full offline JSON export and import for disaster squads, military relief, or drone drops.

---

## 🚀 Deployment to Vercel

### Option 1: 1-Click Vercel CLI
```bash
# In the project directory
npm install -g vercel
vercel
```

### Option 2: Push to GitHub & Import in Vercel
1. Push this repository to GitHub.
2. In the Vercel Dashboard, click **Add New Project** and select this repository.
3. Build Settings are automatically configured:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Deploy!

`vercel.json` is pre-configured with client-side SPA routing and optimal Cache-Control headers for the Progressive Web App Service Worker.

---

## 📱 Offline Installation (PWA)
1. Open the deployed Vercel URL in **Chrome** (Android/Desktop) or **Safari** (iOS).
2. Tap the browser menu and select **"Add to Home Screen"** or **"Install App"**.
3. Turn on **Airplane Mode** (no Wi-Fi, no mobile data).
4. Launch SilentBeacon from your home screen — it boots up and operates **100% offline**.
