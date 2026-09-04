import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          950: '#0a1a12',
          900: '#0f2418',
          800: '#15321f',
          700: '#1c4028',
          600: '#265434',
        },
        cream: {
          50: '#fffdf8',
          100: '#faf4e6',
          200: '#f2e8d0',
          300: '#e8d9b5',
        },
        gold: {
          400: '#d4af6a',
          500: '#c19a4b',
          600: '#a67f38',
        },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(10,26,18,0.06), 0 4px 16px rgba(10,26,18,0.08)',
        cardHover: '0 2px 8px rgba(10,26,18,0.10), 0 12px 32px rgba(10,26,18,0.14)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};

export default config;
