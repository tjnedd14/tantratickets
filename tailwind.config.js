/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tantra: {
          red: "#DB130D",
          redDark: "#9E0D09",
          redGlow: "#FF1F17",
        },
      },
      fontFamily: {
        display: ['"Archivo Black"', '"Archivo"', "sans-serif"],
        body: ['"Archivo"', "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-red": "pulse-red 2s ease-in-out infinite",
      },
      keyframes: {
        "pulse-red": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(219, 19, 13, 0.4)" },
          "50%": { boxShadow: "0 0 0 12px rgba(219, 19, 13, 0)" },
        },
      },
    },
  },
  plugins: [],
};
