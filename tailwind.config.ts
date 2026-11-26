import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#172b25',
        muted: '#708078',
        canvas: '#f7f9f8',
        line: '#e7ece9',
        brand: { DEFAULT: '#13845b', dark: '#0d6847', soft: '#e8f5ef' },
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 1px 3px rgba(23, 43, 37, 0.05)' },
    },
  },
  plugins: [],
} satisfies Config
