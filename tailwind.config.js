/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      height: {
        dvh: '100dvh',
        svh: '100svh',
      },
      minHeight: {
        dvh: '100dvh',
        svh: '100svh',
      },
      colors: {
        recycling: '#22c55e',
        garbage: '#ef4444',
        compost: '#a3e635',
        depot: '#f97316',
        bulk: '#8b5cf6',
      },
    },
  },
  plugins: [],
};
