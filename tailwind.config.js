/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette from Abyssal Liturgy
        void:    '#050506',
        charcoal:'#111318',
        panel:   '#0b0c10',
        slate:   '#2b3038',
        ash:     '#6d727b',
        bone:    '#e9e4da',
        silver:  '#9a9d95',
        hair:    'rgba(233,228,218,0.14)',
        // Accent colours kept for transport/UI
        brand: {
          400: '#8b8ef5',
          500: '#4f4ef1',
          600: '#3e35e5',
        },
        accent: {
          teal:   '#2dd4bf',
          amber:  '#f59e0b',
          rose:   '#f43f5e',
        },
        // Surface aliases mapping to brand
        surface: {
          base:    '#050506',
          raised:  '#0b0c10',
          overlay: '#111318',
          border:  'rgba(233,228,218,0.14)',
          muted:   '#6d727b',
        },
      },
      fontFamily: {
        serif: ['Fraunces', 'serif'],
        sans:  ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono:  ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'xl':  '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        'glass': '0 4px 24px rgba(0,0,0,0.6)',
        'glow':  '0 0 20px rgba(79,78,241,0.25)',
      },
    },
  },
  plugins: [],
}
