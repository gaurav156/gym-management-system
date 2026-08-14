/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#e11d48",
          dark: "#9f1239"
        }
      }
    },
  },
  plugins: [],
}
