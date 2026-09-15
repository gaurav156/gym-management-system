/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#e11d48",
          dark: "#9f1239"
        },
        // Used for the hero and footer bands on the landing page - a warm near-black
        // rather than pure #000, paired with the existing brand rose rather than
        // introducing an unrelated accent color.
        ink: {
          DEFAULT: "#16151a",
          soft: "#211f26"
        }
      },
      fontFamily: {
        display: ["Oswald", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    },
  },
  plugins: [],
}