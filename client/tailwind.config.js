/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        red: {
          DEFAULT: '#e5383b',
          dim: '#3a1515',
        },
        bg: '#0f0f0f',
        bg2: '#1a1a1a',
        bg3: '#242424',
        bg4: '#2e2e2e',
      },
    },
  },
  plugins: [],
}
