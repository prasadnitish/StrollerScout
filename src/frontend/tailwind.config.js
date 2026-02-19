/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Space Grotesk", "sans-serif"],
        serif: ["Fraunces", "serif"],
      },
      colors: {
        ink: "#0b0b0c",
        paper: "#f6f4ef",
        muted: "#a7a29b",
        accent: "#e7d3a0",
        primary: {
          50: "#fef9ed",
          100: "#fdf0cf",
          500: "#e7d3a0",
          600: "#cfb67c",
          700: "#b59a5c",
        },
      },
    },
  },
  plugins: [],
};
