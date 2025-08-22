/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0f172a',
          light: '#1e293b',
          accent: '#22c55e'
        }
      }
    },
  },
  plugins: [],
}