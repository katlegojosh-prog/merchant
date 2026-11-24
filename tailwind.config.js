/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0a0a0a',
          base: '#111111',
          card: '#161616',
          elevated: '#1c1c1c',
        },
        /* Used as bg-surface, bg-surface-elevated, bg-card */
        surface: {
          DEFAULT: '#161616',
          base: '#111111',
          elevated: '#1c1c1c',
        },
        card: '#161616',
        gold: {
          DEFAULT: '#FACC15',
          muted: '#FCD34D',
          50: '#fffcf2',
        },
        urgent: {
          DEFAULT: '#FF4444',
          muted: '#F87171',
        },
        warn: {
          DEFAULT: '#FB923C',
          muted: '#FDBA74',
        },
        fresh: {
          DEFAULT: '#4ADE80',
          muted: '#86EFAC',
        },
        stone: {
          400: '#9c9c9c',
          500: '#6b6b6b',
          600: '#525252',
        },
      },
      /* The components use /12, /15 and /18 tints; without these steps
         Tailwind silently drops those classes. */
      opacity: {
        4: '0.04',
        6: '0.06',
        8: '0.08',
        12: '0.12',
        14: '0.14',
        15: '0.15',
        18: '0.18',
        35: '0.35',
        45: '0.45',
        55: '0.55',
        65: '0.65',
        85: '0.85',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['26px', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'display-md': ['22px', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'display-sm': ['18px', { lineHeight: '1.1', letterSpacing: '-0.01em' }],
      },
      spacing: {
        '5\\.5': '22px',
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 1px 3px 1px rgba(0, 0, 0, 0.2)',
        card: '0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 1px 3px 1px rgba(0, 0, 0, 0.2)',
        elevated: '0 8px 24px -6px rgba(0, 0, 0, 0.45), 0 2px 6px -2px rgba(0, 0, 0, 0.3)',
        input: '0 1px 2px 0 rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      },
      transitionDuration: {
        150: '150ms',
      },
    },
  },
  plugins: [],
}
