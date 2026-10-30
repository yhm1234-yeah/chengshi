import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF1FF',
          100: '#E0E5FF',
          200: '#C4CCFF',
          300: '#9AA7FF',
          400: '#7383FA',
          500: '#4C5DF0',
          600: '#3B4AD6',
          700: '#2F3BAD',
          800: '#28328A',
          900: '#232B6E'
        },
        ink: {
          DEFAULT: '#101828',
          50: '#F8FAFC',
          100: '#F1F4F9',
          200: '#E6EAF2',
          300: '#CBD3E1',
          400: '#98A2B3',
          500: '#667085',
          600: '#475467',
          700: '#344054',
          800: '#1D2939',
          900: '#101828'
        },
        teal: {
          50: '#E9FBF7',
          100: '#C9F4EA',
          200: '#94E8D8',
          300: '#5ED6C1',
          400: '#2CBBA6',
          500: '#12A38F',
          600: '#0B8474',
          700: '#0B6A5F',
          800: '#0C544C',
          900: '#0A453F'
        },
        amber: {
          50: '#FFF8EB',
          100: '#FFEFCC',
          200: '#FFDD99',
          300: '#FFC666',
          400: '#FFAD33',
          500: '#F59300',
          600: '#D97800',
          700: '#B35C00'
        },
        danger: {
          50: '#FFF1F1',
          100: '#FFE0E0',
          200: '#FFC7C7',
          300: '#FFA3A3',
          400: '#FB7070',
          500: '#F04438',
          600: '#D92D20',
          700: '#B42318'
        },
        screen: {
          bg: '#04070F',
          panel: '#0A1424',
          line: '#18304F',
          cyan: '#36E5FF',
          blue: '#4D7CFF',
          lime: '#8CFFC1',
          amber: '#FFC24D',
          muted: '#7E97B8',
          text: '#D8E7FB'
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Noto Sans SC"',
          'sans-serif'
        ],
        mono: ['"SF Mono"', 'Consolas', '"Liberation Mono"', 'monospace']
      },
      borderRadius: {
        xl2: '20px',
        xl3: '28px'
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16,24,40,.04), 0 8px 24px rgba(16,24,40,.06)',
        card: '0 1px 3px rgba(16,24,40,.06), 0 16px 40px rgba(16,24,40,.08)',
        float: '0 24px 60px rgba(16,24,40,.16)',
        glow: '0 0 0 1px rgba(54,229,255,.25), 0 0 28px rgba(54,229,255,.18)'
      },
      keyframes: {
        scan: {
          '0%': { top: '0%', opacity: '0' },
          '12%': { opacity: '1' },
          '88%': { opacity: '1' },
          '100%': { top: '100%', opacity: '0' }
        },
        floaty: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' }
        },
        breathe: {
          '0%,100%': { opacity: '0.35' },
          '50%': { opacity: '0.9' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        dashmove: {
          '0%': { strokeDashoffset: '0' },
          '100%': { strokeDashoffset: '-40' }
        },
        rise: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        ring: {
          '0%': { transform: 'scale(.6)', opacity: '.8' },
          '100%': { transform: 'scale(1.8)', opacity: '0' }
        }
      },
      animation: {
        scan: 'scan 2.4s cubic-bezier(.4,0,.2,1) infinite',
        floaty: 'floaty 6s ease-in-out infinite',
        breathe: 'breathe 3s ease-in-out infinite',
        shimmer: 'shimmer 2.2s linear infinite',
        dashmove: 'dashmove 1.2s linear infinite',
        rise: 'rise .35s ease-out both',
        ring: 'ring 2.4s ease-out infinite'
      }
    }
  },
  plugins: []
};

export default config;
