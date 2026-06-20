import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/providers/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        steel: {
          DEFAULT: '#2A2A2A',
          dark: '#1A1A2E',
        },
        cyan: {
          glow: '#5BC0EB',
        },
        wire: {
          glow: '#FFD93D',
        },
        night: {
          DEFAULT: '#0A0E27',
          deep: '#050818',
        },
        cluster: {
          white: '#F0EAD6',
        },
        accent: {
          gold: '#D4AF37',
        },
        fog: {
          DEFAULT: '#8B8680',
        },
      },
      fontFamily: {
        display: ['var(--font-space-mono)', 'ui-monospace', 'monospace'],
        body: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(180deg, rgba(10,14,39,0) 0%, rgba(10,14,39,0.7) 60%, rgba(10,14,39,1) 100%)',
        'wire-glow':
          'radial-gradient(circle at 50% 30%, rgba(91,192,235,0.15) 0%, rgba(10,14,39,0) 60%)',
      },
      boxShadow: {
        substation: '0 0 0 1px rgba(91,192,235,0.16), 0 24px 60px rgba(5,8,24,0.6)',
        wire: '0 0 24px rgba(91,192,235,0.35)',
        gold: '0 0 32px rgba(212,175,55,0.32)',
      },
      keyframes: {
        hum: {
          '0%,100%': { opacity: '0.6' },
          '50%': { opacity: '0.9' },
        },
        currentFlow: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        breathe: {
          '0%,100%': { opacity: '0.35' },
          '50%': { opacity: '0.65' },
        },
      },
      animation: {
        hum: 'hum 3s ease-in-out infinite',
        current: 'currentFlow 4s linear infinite',
        breathe: 'breathe 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
