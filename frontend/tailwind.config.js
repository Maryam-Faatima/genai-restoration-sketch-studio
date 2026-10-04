/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        scafos: {
          bg: '#F8E7E3',          // signature Scafos warm blush peach
          surface: '#FFF7F4',     // clean crisp warm white card
          terracotta: '#C24B38',  // signature Scafos rust button color
          terracottaDark: '#A63827',
          sage: '#B5D3CA',        // Scafos minty sage green accent
          ochre: '#E8A735',       // warm golden ochre
          charcoal: '#2D2424',    // friendly dark charcoal text
          muted: '#7C6F6F',       // soft brown/gray secondary text
          border: 'rgba(45, 36, 36, 0.12)',
        },
        studio: {
          bg: '#F8E7E3',
          card: '#FFF7F4',
          border: '#ECD0C9',
          purple: {
            50: '#FFF7F4',
            100: '#F8E7E3',
            200: '#ECD0C9',
            300: '#DDB6AC',
            400: '#BA8D82',
            500: '#8E675D',
            600: '#6A4A41',
            700: '#4D332D',
            800: '#38221D',
            900: '#2D1B17',
            950: '#1F110E',
          },
          pink: {
            50: '#FFF5F3',
            100: '#FFE6E1',
            200: '#FDC7BD',
            300: '#F49B8B',
            400: '#E06B57',
            500: '#C24B38',
          }
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Montserrat', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        handwriting: ['Caveat', '"Italianno"', 'cursive'],
      },
      boxShadow: {
        'scafos': '0 20px 40px -15px rgba(194, 75, 56, 0.12), 0 4px 12px rgba(45, 36, 36, 0.04)',
        'elevated': '0 25px 50px -12px rgba(45, 36, 36, 0.08)',
        'card': '0 4px 20px -2px rgba(45, 36, 36, 0.05)',
      }
    },
  },
  plugins: [],
}
