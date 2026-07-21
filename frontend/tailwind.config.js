/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: "#7A0019",
        'primary-hover': "#600014",
        accent: "#D4AF37",
        background: "#F8F6F2",
        surface: "#FFFFFF",
        border: "#E2D7C8",
        text: "#222222",
        muted: "#666666",
        brand: {
          indigo: '#7A0019', // Maroon
          cyan: '#D4AF37',   // Gold
          emerald: '#10B981', // Success
          amber: '#D4AF37',   // Gold
          red: '#EF4444',     // Error
          blue: '#7A0019',    // Maroon
          purple: '#7A0019',  // Maroon
        },
        primary_old: {
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
          50: '#F8F6F2',
          100: '#F8F6F2',
          200: '#E2D7C8',
          300: '#D4AF37',
          400: '#666666',
          500: '#666666',
          600: '#222222',
          700: '#222222',
          800: '#600014',
          900: '#7A0019', // Maroon
          950: '#7A0019', // Maroon (Sidebar background)
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
