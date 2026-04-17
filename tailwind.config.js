/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tantra: {
          red: "#DB130D",        // primary brand red
          redDark: "#9E0D09",
          redGlow: "#FF1F17",
          black: "#000000",
          bg: "#050505",         // slightly off-true-black for contrast
          card: "#0E0E0E",
          surface: "#161616",
          border: "#2a1010",     // dark red-tinged border
          borderStrong: "#3d1414",
          muted: "#6b6b6b",
          mutedLight: "#a0a0a0",
          white: "#ffffff",
        },
      },
      fontFamily: {
        // Radley is the display serif; Archivo is the body sans — both on Google Fonts
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
