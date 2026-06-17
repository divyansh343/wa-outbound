/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        slate: {
          50: '#f9f9f9',
          100: '#111111', // text-slate-100 -> dark charcoal
          200: '#1a1a1a', // text-slate-200 -> dark charcoal
          300: '#333333', // text-slate-300 -> charcoal
          400: '#555555', // text-slate-400 -> dark gray
          500: '#737373', // text-slate-500 -> medium gray
          600: '#8f8f8f', // text-slate-600 -> gray
          700: '#d4d4d4', // border-slate-700 -> light gray
          800: '#ebebeb', // border-slate-800 / bg-slate-800 -> light border gray
          900: '#ffffff', // bg-slate-900 -> white card background
          950: '#f9fafb', // bg-slate-950 -> very light gray page background
        },
        indigo: {
          50: '#f9f9f9',
          100: '#f0f0f0',
          200: '#e5e5e5',
          300: '#cccccc',
          400: '#111111', // text-indigo-400 -> black
          500: '#000000', // text-indigo-500 -> black
          600: '#000000', // bg-indigo-600 -> Squarespace Black primary action button!
          700: '#1c1c1c', // bg-indigo-700 -> Slightly lighter black for hover state!
          800: '#333333',
          900: '#111111',
          950: '#000000',
        },
        violet: {
          400: '#000000',
          500: '#000000',
        },
        emerald: {
          50: '#f0fdf4',
          100: '#dcfce7',
          400: '#16a34a',
          500: '#15803d',
          600: '#166534',
        },
        rose: {
          50: '#fff1f2',
          100: '#ffe4e6',
          400: '#e11d48',
          500: '#be123c',
          600: '#9f1239',
        },
      },
      borderRadius: {
        xl: '4px',
        '2xl': '6px',
        '3xl': '8px',
      },
      boxShadow: {
        lg: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        '2xl': '0 4px 20px -2px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
};
