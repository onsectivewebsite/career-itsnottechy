import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // It's Not Techy brand teal — matches itsnottechy.com
        brand: {
          DEFAULT: '#00b3a4',
          50:  '#e6fbf9',
          100: '#ccf7f3',
          200: '#99efe6',
          300: '#66e7da',
          400: '#33dfcd',
          500: '#00b3a4',
          600: '#009085',
          700: '#006d63',
          800: '#004a42',
          900: '#002721',
        },
        // Brand ink (near-black) used for dark sections
        ink: {
          DEFAULT: '#1C1F26',
          50:  '#f3f4f6',
          100: '#dbdde2',
          200: '#b5b9c3',
          300: '#8f94a3',
          400: '#5a606f',
          500: '#363a45',
          600: '#1C1F26',
          700: '#14161c',
          800: '#0d0e13',
          900: '#06070a',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [typography],
};

export default config;
