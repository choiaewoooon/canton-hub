import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canton: {
          lime: "#c8e64a",
          bg: "#09090b",
          card: "#0f0f12",
          border: "#1c1c1f",
          up: "#4ade80",
          down: "#f87171",
          burn: "#fb923c",
          mint: "#60a5fa",
          private: "#a78bfa",
        },
      },
    },
  },
  plugins: [],
};

export default config;
