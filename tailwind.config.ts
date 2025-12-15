import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mavs: {
          blue: '#00538C',
          silver: '#C4CED4',
          navy: '#002B5C',
        },
        toss: {
          blue: '#3182F6',
          'blue-light': '#E3F2FD',
          'blue-dark': '#1E40AF',
          gray: {
            50: '#F8FAFC',
            100: '#F1F5F9',
            200: '#E2E8F0',
            300: '#CBD5E1',
            400: '#94A3B8',
            500: '#64748B',
            600: '#475569',
            700: '#334155',
            800: '#1E293B',
            900: '#0F172A',
          },
          white: '#FFFFFF',
          black: '#1A1A1A',
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: ['Pretendard', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'toss': '16px',
        'toss-lg': '20px',
        'toss-xl': '24px',
      },
      boxShadow: {
        'toss': '0 2px 16px rgba(0, 0, 0, 0.08)',
        'toss-lg': '0 4px 24px rgba(0, 0, 0, 0.12)',
        'toss-xl': '0 8px 32px rgba(0, 0, 0, 0.16)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'bounce-slow': 'bounce 2s infinite',
        'toss-bounce': 'tossBounce 0.6s ease-out',
        'modal-slide': 'modalSlide 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        tossBounce: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '50%': { transform: 'scale(1.02)', opacity: '0.8' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        modalSlide: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};

export default config;
