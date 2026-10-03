/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        studio: {
          bg: '#FAF7FB',
          card: '#FFFFFF',
          border: '#F1E9F6',
          purple: {
            50: '#FAF5FF',
            100: '#F3E8FF',
            200: '#E9D5FF',
            300: '#D8B4FE',
            400: '#C084FC',
            500: '#A855F7',
            600: '#9333EA',
            700: '#7E22CE',
            800: '#6B21A8',
            900: '#581C87',
            950: '#2E1065',
          },
          pink: {
            50: '#FDF2F8',
            100: '#FCE7F3',
            200: '#FBCFE8',
            300: '#F472B6',
            400: '#EC4899',
            500: '#DB2777',
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 8px 30px -4px rgba(147, 51, 234, 0.08), 0 4px 12px -2px rgba(0, 0, 0, 0.03)',
        'card': '0 4px 20px -2px rgba(186, 147, 219, 0.12), 0 2px 6px -1px rgba(0, 0, 0, 0.02)',
      }
    },
  },
  plugins: [],
}
