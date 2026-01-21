/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                dark: {
                    bg: '#0a0a0a',          // Preto mais profundo
                    surface: '#141414',     // Superfície escura
                    hover: '#1f1f1f',       // Hover state
                    border: '#262626',      // Bordas sutis
                    text: {
                        primary: '#e5e5e5',   // Texto principal
                        secondary: '#a3a3a3', // Texto secundário
                        muted: '#525252',     // Texto muted
                    }
                },
                matrix: {
                    primary: '#22c55e',     // Verde Matrix principal
                    secondary: '#16a34a',   // Verde mais escuro
                    glow: '#4ade80',        // Verde brilhante para glow
                    dim: '#166534',         // Verde escuro para fundos
                },
                accent: {
                    primary: '#22c55e',     // Verde Matrix (era violet-500)
                    secondary: '#16a34a',   // Verde escuro (era violet-600)
                    success: '#22c55e',     // Verde 
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'glow': 'glow 2s ease-in-out infinite alternate',
            },
            keyframes: {
                glow: {
                    '0%': { boxShadow: '0 0 5px rgba(34, 197, 94, 0.2)' },
                    '100%': { boxShadow: '0 0 20px rgba(34, 197, 94, 0.4)' },
                }
            }
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
}
