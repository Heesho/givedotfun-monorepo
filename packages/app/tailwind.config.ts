import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: [
  				'Inter',
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'Segoe UI',
  				'Roboto',
  				'Helvetica Neue',
  				'Arial',
  				'sans-serif'
  			]
  		},
  		colors: {
  			moss: {
  				'300': '#6EE7A0',
  				'400': '#3DDC84',
  				'500': '#2BA866',
  				'600': '#1F8A4F',
  				'700': '#166B3B',
  			},
  			prism: {
  				'300': '#D4FF99',
  				'400': '#B2FF59',
  				'500': '#8FCC47',
  			},
  			slate: {
  				'400': '#8E8E8E',
  				'500': '#6E6E6E',
  				'600': '#4E4E4E',
  			},
  			concrete: {
  				'800': '#1A1A1A',
  				'700': '#242424',
  				'600': '#2E2E2E',
  				'500': '#3A3A3A',
  			},
  			success: {
  				'400': '#3DDC84',
  				'500': '#2BA866',
  				'600': '#1F8A4F',
  			},
  			warning: {
  				'400': '#fbbf24',
  				'500': '#f59e0b',
  				'600': '#d97706',
  			},
  			error: {
  				'400': '#f87171',
  				'500': '#ef4444',
  				'600': '#dc2626',
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))',
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))',
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))',
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))',
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))',
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))',
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))',
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))',
  			},
  		},
  		backgroundImage: {
  			'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
  			'gradient-glow': 'linear-gradient(135deg, #3DDC84 0%, #2BA866 100%)',
  			'gradient-subtle': 'linear-gradient(180deg, rgba(61, 220, 132, 0.05) 0%, transparent 100%)',
  			'gradient-reward': 'linear-gradient(135deg, #B2FF59 0%, #3DDC84 100%)',
  			'gradient-concrete': 'linear-gradient(180deg, #242424 0%, #1A1A1A 100%)',
  		},
  		boxShadow: {
  			'glow': '0 0 20px rgba(61, 220, 132, 0.25)',
  			'glow-lg': '0 0 40px rgba(61, 220, 132, 0.35)',
  			'glow-sm': '0 0 10px rgba(61, 220, 132, 0.15)',
  			'glow-reward': '0 0 30px rgba(178, 255, 89, 0.3)',
  			'card': '0 1px 3px rgba(0, 0, 0, 0.3)',
  			'card-hover': '0 4px 12px rgba(0, 0, 0, 0.4)',
  			'slab': '0 2px 8px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
  			'input-inset': 'inset 0 2px 4px rgba(0, 0, 0, 0.3)',
  		},
  		borderRadius: {
  			'2xl': '16px',
  			'xl': '12px',
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		animation: {
  			'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
  			'shimmer': 'shimmer 1.5s linear infinite',
  			'fade-in': 'fade-in 0.2s ease-out',
  			'slide-up': 'slide-up 0.3s ease-out',
  			'iridescent': 'iridescent 3s linear infinite',
  		},
  		keyframes: {
  			'pulse-glow': {
  				'0%, 100%': {
  					opacity: '0.6'
  				},
  				'50%': {
  					opacity: '1'
  				}
  			},
  			'shimmer': {
  				'0%': {
  					transform: 'translateX(-100%)'
  				},
  				'100%': {
  					transform: 'translateX(100%)'
  				}
  			},
  			'fade-in': {
  				'0%': {
  					opacity: '0'
  				},
  				'100%': {
  					opacity: '1'
  				}
  			},
  			'slide-up': {
  				'0%': {
  					opacity: '0',
  					transform: 'translateY(10px)'
  				},
  				'100%': {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			'iridescent': {
  				'0%': {
  					backgroundPosition: '0% 50%'
  				},
  				'50%': {
  					backgroundPosition: '100% 50%'
  				},
  				'100%': {
  					backgroundPosition: '0% 50%'
  				}
  			}
  		}
  	}
  },
  plugins: [tailwindcssAnimate],
};

export default config;
