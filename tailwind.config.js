/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      colors: {
        n: {
          50: '#F8F8F7', 100: '#F1F0EE', 200: '#E3E1DE',
          300: '#CAC8C4', 400: '#A39F99', 500: '#7F7C76',
          600: '#5F5D58', 700: '#444340', 800: '#2A2928',
        },
      },
    },
  },
  plugins: [],
}

