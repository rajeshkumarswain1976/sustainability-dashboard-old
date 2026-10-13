/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#0A0B0D',
          900: '#111216',
          850: '#16171C',
          800: '#1A1B22',
          750: '#20222B',
          700: '#2A2D38',
          600: '#3A3E4D',
          500: '#52576B',
          400: '#7E849A',
          300: '#A3A9BE',
          200: '#C7CCE0',
          100: '#E4E7F4',
        },
        brand: {
          orange: '#FF5722',
          orangeLight: '#FF7043',
          orangeDark: '#E64A19',
          gradientStart: '#FF5500',
          gradientEnd: '#FF3D00',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'glow-orange': '0 0 25px -5px rgba(255, 87, 34, 0.35)',
        'card-dark': '0 4px 20px -2px rgba(0, 0, 0, 0.45)',
      }
    },
  },
  plugins: [],
}
