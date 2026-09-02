/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        verdictTrue: "#1B7A3D",
        verdictFalse: "#B3261E",
        verdictMisleading: "#B8860B",
        brand: "#407348",
        brandDark: "#1A241C",
      },
      fontFamily: {
        sans: ["Poppins_400Regular"],
        poppinsMedium: ["Poppins_500Medium"],
        poppinsSemibold: ["Poppins_600SemiBold"],
        poppinsBold: ["Poppins_700Bold"],
      },
    },
  },
  plugins: [],
};
