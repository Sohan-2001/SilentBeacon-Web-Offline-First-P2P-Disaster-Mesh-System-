/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        beacon: {
          dark: '#000000',
          darkCard: '#0f172a',
          darkSurface: '#1e293b',
          light: '#f8fafc',
          lightCard: '#ffffff',
          lightSurface: '#f1f5f9',
          primary: '#dc2626', // Emergency Red
          warning: '#d97706', // Amber Alert
          success: '#059669', // Emerald Active
          info: '#2563eb',    // Google Blue
          radar: '#0284c7',   // Tactical Cyan
        }
      },
      animation: {
        'radar-sweep': 'radarSweep 3s linear infinite',
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'strobe-alarm': 'strobe 0.4s ease-in-out infinite alternate',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      keyframes: {
        radarSweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        strobe: {
          '0%': { opacity: '0.2' },
          '100%': { opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
