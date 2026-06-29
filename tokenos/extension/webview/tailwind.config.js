/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#0f1117',
        card: '#1a1d27',
        border: '#2d3148',
        accent: '#818cf8',
        success: '#4ade80',
        danger: '#f87171',
      },
    },
  },
  plugins: [],
};
