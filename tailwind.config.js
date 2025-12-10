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
    },
  },
  plugins: [],
}
