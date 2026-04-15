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
        // Values come from CSS variables defined in app/globals.css
        // (:root = light default, .dark = dark override)
        canton: {
          lime: "var(--canton-lime)",
          bg: "var(--canton-bg)",
          card: "var(--canton-card)",
          border: "var(--canton-border)",
          up: "var(--canton-up)",
          down: "var(--canton-down)",
          burn: "var(--canton-burn)",
          mint: "var(--canton-mint)",
          private: "var(--canton-private)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
