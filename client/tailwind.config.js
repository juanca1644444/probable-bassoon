function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgba(var(${variableName}), ${opacityValue})`
    }
    return `rgb(var(${variableName}))`
  }
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        wa: {
          green:       withOpacity('--wa-green-rgb'),
          'green-hover': withOpacity('--wa-green-hover-rgb'),
          dark:        withOpacity('--wa-dark-rgb'),
          sidebar:     withOpacity('--wa-sidebar-rgb'),
          chat:        withOpacity('--wa-chat-rgb'),
          'chat-bg':   withOpacity('--wa-chat-rgb'),
          bubble:      withOpacity('--wa-bubble-rgb'),
          'bubble-in': withOpacity('--wa-bubble-in-rgb'),
          header:      withOpacity('--wa-header-rgb'),
          input:       withOpacity('--wa-input-rgb'),
          icon:        withOpacity('--wa-icon-rgb'),
          text:        withOpacity('--wa-text-rgb'),
          secondary:   withOpacity('--wa-secondary-rgb'),
          border:      withOpacity('--wa-border-rgb'),
          hover:       withOpacity('--wa-hover-rgb'),
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
