/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          indigo: '#7A0019', // Primary (Maroon) mapped from indigo for backward compatibility
          cyan: '#A61E4D',   // Secondary
          emerald: '#10B981', // Success
          amber: '#D4AF37',   // Accent
          red: '#EF4444',     // Error
          blue: '#3B82F6',
          purple: '#8B5CF6',
        },
        primary: {
          50: '#fcf3f5',
          100: '#f8e6eb',
          200: '#efc1cd',
          300: '#e59caf',
          400: '#cf5a73',
          500: '#7A0019', // Primary Maroon
          600: '#6e0017',
          700: '#5c0013',
          800: '#49000f',
          900: '#3d000c',
          950: '#210006',
        },
                dark: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b', // Zinc 900
          950: '#09090b', // Zinc 950 (Background)
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-space-grotesk)', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'slide-in-right': 'slideInRight 0.3s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(37, 99, 235, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(37, 99, 235, 0.6)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-glass': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0))',
        'gradient-primary': 'linear-gradient(135deg, #2563EB, #4F46E5)',
        'gradient-success': 'linear-gradient(135deg, #10B981, #059669)',
        'gradient-danger': 'linear-gradient(135deg, #EF4444, #B91C1C)',
        'gradient-warning': 'linear-gradient(135deg, #F97316, #EA580C)',
      },
    },
  },
  plugins: [],
};
