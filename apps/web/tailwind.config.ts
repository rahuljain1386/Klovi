import type { Config } from 'tailwindcss';
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './data/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: [
    // Core brand colors — never purge these
    'bg-cream', 'text-cream', 'bg-ink', 'text-ink',
    'bg-amber', 'text-amber', 'border-amber', 'bg-amber/5', 'bg-amber/10', 'bg-amber/15', 'bg-amber/20', 'bg-amber/30', 'bg-amber/90',
    'text-warm-gray', 'bg-warm-gray',
    'border-border', 'border-t', 'border-b',
    'text-green', 'bg-green/5', 'bg-green/10', 'bg-green/20',
    'text-rose', 'bg-rose', 'bg-rose/5',
    'text-blue', 'bg-blue/5', 'bg-blue/10', 'bg-blue/20',
    'text-purple', 'bg-purple/10', 'bg-purple/20',
    'text-white', 'bg-white',
    'font-display', 'font-sans',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#1a0f00',
        cream: '#fdf8f0',
        amber: { light: '#fef3c7', DEFAULT: '#f59e0b', dark: '#d97706' },
        teal: { light: '#ccfbf1', DEFAULT: '#0d9488' },
        green: { light: '#dcfce7', DEFAULT: '#16a34a' },
        rose: { light: '#fff1f2', DEFAULT: '#f43f5e' },
        blue: { light: '#eff6ff', DEFAULT: '#3b82f6' },
        purple: { light: '#f5f3ff', DEFAULT: '#8b5cf6' },
        'warm-gray': '#78716c',
        border: '#e7e0d4',
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
