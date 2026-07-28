/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT:"#7A5AF8",
          dark: "#5A3EBF",
        },  
        secondary: "#B3A0D3",
        background: "#ffffff", 
        text: "#4A4A4A", 
      },
      keyframes: {
        "fade-in": {
          "0%": {opacity: "0", transform: "scale(0.98)"},
          "100%": {opacity: "1", transform: "scale(1)"},
        },
      },
      animation: {
        "fade-in": "fade-in 0.5s ease-out",
      },
    },
  },
  plugins: [],
}
