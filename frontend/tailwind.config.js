/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        aai: {
          blue: "#0284C7",
          navy: "#0F172A",
          deepBlue: "#1E3A8A",
          sky: "#38BDF8",
          accent: "#2563EB",
          light: "#F0F9FF",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
