import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1a0f00',
        cream: '#fdf8f0',
        amber: { light: '#fef3c7', DEFAULT: '#f59e0b', dark: '#d97706' },
        teal: { light: '#ccfbf1', DEFAULT: '#0d9488' },
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
