/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#07070D",
        surface: "#0D1B36",
        surface2: "#0F2040",
        surface3: "#1A3060",
        blue: "#0066CC",
        "blue-dim": "#0052A3",
        red: "#FF3B30",
        green: "#00D084",
        amber: "#F5A623",
        "gray-1": "#FFFFFF",
        "gray-2": "rgba(255,255,255,0.6)",
        "gray-3": "rgba(255,255,255,0.35)",
      },
      fontFamily: {
        sans: ["SpaceGrotesk", "sans-serif"],
      },
    },
  },
  plugins: [],
};
