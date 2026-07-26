/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        honeywell: {
          red: "#EE3124",
          dark: "#0B0F19",
          card: "#151C2C",
          border: "#232E45",
          highlight: "#1E293B",
          text: "#F8FAFC",
          textMuted: "#94A3B8"
        }
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"]
      }
    },
  },
  plugins: [],
}
