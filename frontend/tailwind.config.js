/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  variants: {
    extend: {
      backgroundColor: ['print'], // ✅ allow print variant for bg
      textColor: ['print'],       // optional, if you want text colors too
    },
  },
  plugins: [],
}

