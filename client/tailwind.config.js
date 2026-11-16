/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        wa: {
          green:     '#00a884',
          dark:      '#111b21',
          sidebar:   '#111b21',
          chat:      '#0b141a',
          bubble:    '#005c4b',
          'bubble-in': '#202c33',
          header:    '#202c33',
          input:     '#2a3942',
          icon:      '#aebac1',
          text:      '#e9edef',
          secondary: '#8696a0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'slide-in-right':  'slideInRight 0.25s ease-out',
        'fade-in':         'fadeIn 0.2s ease-out',
        'fade-in-up':      'fadeInUp 0.25s ease-out',
        'bounce-dot':      'bounceDot 1.4s infinite ease-in-out',
        'toast-in':        'toastIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        slideInRight: {
          '0%':   { transform: 'translateX(100%)', opacity: 0 },
          '100%': { transform: 'translateX(0)',     opacity: 1 },
        },
        fadeIn: {
          '0%':   { opacity: 0, transform: 'scale(0.95)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
        fadeInUp: {
          '0%':   { opacity: 0, transform: 'translateY(16px) scale(0.97)' },
          '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
        },
        toastIn: {
          '0%':   { opacity: 0, transform: 'translateX(110%) scale(0.9)' },
          '100%': { opacity: 1, transform: 'translateX(0) scale(1)' },
        },
        bounceDot: {
          '0%, 80%, 100%': { transform: 'scale(0)' },
          '40%':           { transform: 'scale(1.0)' },
        },
      },
      typography: (theme) => ({
        invert: {
          css: {
            '--tw-prose-body':    theme('colors.wa.text'),
            '--tw-prose-code':    theme('colors.wa.text'),
            '--tw-prose-pre-bg':  'rgba(0,0,0,0.3)',
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
