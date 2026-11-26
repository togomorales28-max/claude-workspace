/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      colors: {
        tinta: { DEFAULT: '#14171C', suave: '#5A6270', linea: '#E3E5E8' },
        fondo: '#F5F6F7',
        marca: { DEFAULT: '#0F5C52', oscuro: '#0A4740', claro: '#E3F1EE' },
        alerta: { DEFAULT: '#B4321F', claro: '#FBE9E6' },
      },
    },
  },
  plugins: [],
}
