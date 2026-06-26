import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        steel: '#2A2A2A',
        cyan: {
          DEFAULT: '#5BC0EB',
          soft: '#7CD1F5',
          deep: '#3A9CC7',
        },
        wire: '#FFD93D',
        navy: '#0A0E27',
        cluster: '#F0EAD6',
        gold: '#D4AF37',
        shadow: '#1A1A2E',
        fog: '#8B8680',
      },
      fontFamily: {
        display: ['var(--font-space-mono)', 'ui-monospace', 'monospace'],
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'cyan-glow': '0 0 24px rgba(91, 192, 235, 0.35)',
        'wire-glow': '0 0 18px rgba(255, 217, 61, 0.30)',
        card: '0 12px 32px rgba(0, 0, 0, 0.45)',
      },
      backgroundImage: {
        'grid-lines': 'linear-gradient(rgba(91,192,235,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(91,192,235,0.06) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};

export default config;
