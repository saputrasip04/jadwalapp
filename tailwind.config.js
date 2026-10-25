/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc7fb',
          400: '#36abf7',
          500: '#0c90e6',
          600: '#0171c4',
          700: '#025ba0',
          800: '#064d84',
          900: '#0b416f',
          950: '#072a4a',
        },
      },
    },
  },
  plugins: [],
}
