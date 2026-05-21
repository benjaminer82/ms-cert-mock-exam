/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        msblue: {
          50: "#eff6fc",
          500: "#0078d4",
          600: "#106ebe",
          700: "#005a9e",
        },
      },
      fontFamily: {
        sans: [
          "Segoe UI",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
